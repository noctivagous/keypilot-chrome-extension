/**
 * Intersection Observer-based performance optimization manager
 * Tracks element visibility and reduces expensive DOM queries
 */
export class IntersectionObserverManager {
  constructor(elementDetector) {
    this.elementDetector = elementDetector;
    
    // Observer for tracking interactive elements in viewport
    this.interactiveObserver = null;
    
    // Observer for tracking overlay visibility
    this.overlayObserver = null;
    
    // Cache of interactive elements currently in viewport
    this.visibleInteractiveElements = new Set();
    
    // Cache of element positions for quick lookups
    this.elementPositionCache = new Map();
    
    // Debounced cache update
    this.cacheUpdateTimeout = null;

    // Selector used to discover "interactive" elements cheaply (no computed style).
    // Note: this intentionally doesn't include cursor:pointer-only elements.
    this.interactiveSelector =
      'a[href], button, input, select, textarea, [role="button"], [role="link"], [contenteditable="true"], [onclick], [tabindex]:not([tabindex="-1"])';

    // Track elements we have asked the IntersectionObserver to observe.
    // (An element may be observed but not currently intersecting/visible.)
    this.observedInteractiveElements = new Set();

    // MutationObserver-based incremental discovery for dynamic pages.
    this.mutationObserver = null;
    this._pendingAddedRoots = new Set();
    this._pendingRemovedRoots = [];
    this._pendingAttributeTargets = new Set();
    this._mutationProcessScheduled = false;
    this._mutationIdleHandle = null;

    // Background discovery scheduling (avoid doing heavy querySelectorAll during hot startup)
    this._discoverScheduled = false;
    this._discoverIdleHandle = null;

    // ---- Spatial index (RBush) for fast hit-testing ----
    // Populated from `elementPositionCache` for visible interactive elements.
    // NOTE: The bundle provides `RBush` as a global symbol (vendored in src/vendor/rbush.js).
    this._rtree = null;
    this._rtreeItemsByElement = new Map(); // Element -> item object (kept by reference for removal)
    this._rtreeReady = false;
    this._rtreeMaxEntries = 16;
    this._rtreeRemoveEquals = null; // unused (reference removal)
    
    // Performance metrics
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      observerUpdates: 0,
      rtreeQueries: 0,
      rtreeHits: 0,
      rtreeFallbacks: 0
    };
  }

  init() {
    this.setupSpatialIndex();
    this.setupInteractiveElementObserver();
    this.setupOverlayObserver();
    this.setupMutationObserver();
    
    // Only start periodic updates after observers are set up
    if (this.interactiveObserver && this.overlayObserver) {
      this.startPeriodicCacheUpdate();
    }
  }

  setupSpatialIndex() {
    // Allow disabling via global flag for quick rollback / debugging.
    // Example: `window.KEYPILOT_DISABLE_RBUSH = true`
    if (typeof window !== 'undefined' && window.KEYPILOT_DISABLE_RBUSH) {
      this._rtree = null;
      this._rtreeReady = false;
      return;
    }

    try {
      if (typeof RBush === 'function') {
        this._rtree = new RBush(this._rtreeMaxEntries);
        this._rtreeReady = true;
      } else {
        this._rtree = null;
        this._rtreeReady = false;
      }
    } catch (e) {
      console.warn('[KeyPilot] Failed to init RBush index:', e);
      this._rtree = null;
      this._rtreeReady = false;
    }
  }

  setupMutationObserver() {
    if (!window.MutationObserver) return;
    if (this.mutationObserver) return;

    try {
      this.mutationObserver = new MutationObserver((mutations) => {
        let sawWork = false;

        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            // Added nodes: discover any interactive descendants.
            for (const n of mutation.addedNodes) {
              if (n && n.nodeType === 1) {
                this._pendingAddedRoots.add(n);
                sawWork = true;
              }
            }

            // Removed nodes: unobserve any interactive descendants we were tracking.
            for (const n of mutation.removedNodes) {
              if (n && n.nodeType === 1) {
                this._pendingRemovedRoots.push(n);
                sawWork = true;
              }
            }
          } else if (mutation.type === 'attributes') {
            const t = mutation.target;
            if (t && t.nodeType === 1) {
              this._pendingAttributeTargets.add(t);
              sawWork = true;
            }
          }
        }

        if (sawWork) {
          this.scheduleProcessMutations();
        }
      });

      // Watch for subtree changes and attribute changes that commonly flip "interactivity".
      // We avoid watching class/style because it's extremely noisy on many sites.
      this.mutationObserver.observe(document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href', 'role', 'onclick', 'tabindex', 'contenteditable', 'aria-disabled', 'disabled']
      });
    } catch (e) {
      console.warn('[KeyPilot] Failed to set up MutationObserver for interactive discovery:', e);
      this.mutationObserver = null;
    }
  }

  scheduleProcessMutations() {
    if (this._mutationProcessScheduled) return;
    this._mutationProcessScheduled = true;

    const run = (deadline) => {
      this._mutationProcessScheduled = false;
      this._mutationIdleHandle = null;
      this.processPendingMutations(deadline);
    };

    // Run in idle time to avoid interfering with input/animation.
    if (typeof window.requestIdleCallback === 'function') {
      this._mutationIdleHandle = window.requestIdleCallback(run, { timeout: 500 });
    } else {
      this._mutationIdleHandle = window.setTimeout(() => run({ timeRemaining: () => 0 }), 0);
    }
  }

  processPendingMutations(deadline) {
    if (!this.interactiveObserver) {
      // Clear queues if we can't act on them.
      this._pendingAddedRoots.clear();
      this._pendingRemovedRoots.length = 0;
      this._pendingAttributeTargets.clear();
      return;
    }

    const timeRemaining = typeof deadline?.timeRemaining === 'function'
      ? () => deadline.timeRemaining()
      : () => 0;

    // 1) Process removals first to avoid holding onto detached elements.
    while (this._pendingRemovedRoots.length > 0) {
      const root = this._pendingRemovedRoots.pop();
      this.unobserveInteractiveInSubtree(root);
      if (timeRemaining() < 2) break;
    }

    // 2) Process attribute changes (can flip interactivity on existing nodes).
    if (timeRemaining() >= 2 && this._pendingAttributeTargets.size > 0) {
      // Copy out a chunk to avoid iterating a Set while mutating it.
      const batch = [];
      for (const el of this._pendingAttributeTargets) {
        batch.push(el);
        this._pendingAttributeTargets.delete(el);
        if (batch.length >= 50) break;
      }
      for (const el of batch) {
        this.refreshInteractiveObservationForElement(el);
        if (timeRemaining() < 2) break;
      }
    }

    // 3) Process additions (discover interactive descendants).
    if (timeRemaining() >= 2 && this._pendingAddedRoots.size > 0) {
      const batchRoots = [];
      for (const r of this._pendingAddedRoots) {
        batchRoots.push(r);
        this._pendingAddedRoots.delete(r);
        if (batchRoots.length >= 10) break;
      }
      for (const r of batchRoots) {
        this.observeInteractiveInSubtree(r);
        if (timeRemaining() < 2) break;
      }
    }

    // If more work remains, schedule another slice.
    if (this._pendingRemovedRoots.length > 0 || this._pendingAddedRoots.size > 0 || this._pendingAttributeTargets.size > 0) {
      this.scheduleProcessMutations();
    }
  }

  refreshInteractiveObservationForElement(el) {
    if (!el || el.nodeType !== 1) return;

    let shouldObserve = false;
    try {
      // Fast path: selector match.
      shouldObserve = !!(el.matches && el.matches(this.interactiveSelector));
    } catch {
      shouldObserve = false;
    }

    if (!shouldObserve) {
      // Broader heuristic: includes onclick property, tabindex, and (as a last resort) cursor:pointer.
      try {
        shouldObserve = !!this.elementDetector?.isLikelyInteractive?.(el);
      } catch {
        shouldObserve = false;
      }
    }

    if (shouldObserve) {
      this.observeInteractiveElement(el);
    } else {
      this.unobserveInteractiveElement(el);
    }
  }

  observeInteractiveElement(el) {
    if (!this.interactiveObserver || !el || el.nodeType !== 1) return;
    if (this.observedInteractiveElements.has(el)) return;
    try {
      this.interactiveObserver.observe(el);
      this.observedInteractiveElements.add(el);
    } catch {
      // Ignore failures on weird nodes
    }
  }

  unobserveInteractiveElement(el) {
    if (!this.interactiveObserver || !el || el.nodeType !== 1) return;
    if (!this.observedInteractiveElements.has(el)) return;
    try {
      this.interactiveObserver.unobserve(el);
    } catch {
      // Ignore
    }
    this.observedInteractiveElements.delete(el);
    this.visibleInteractiveElements.delete(el);
    this.elementPositionCache.delete(el);
    this._rtreeRemoveElement(el);
  }

  observeInteractiveInSubtree(root) {
    if (!root || root.nodeType !== 1) return;

    try {
      if (root.matches && root.matches(this.interactiveSelector)) {
        this.observeInteractiveElement(root);
      }
    } catch {
      // Ignore
    }

    // Query inside the newly added subtree only (incremental, not full-document).
    try {
      if (root.querySelectorAll) {
        const matches = root.querySelectorAll(this.interactiveSelector);
        matches.forEach((el) => this.observeInteractiveElement(el));
      }
    } catch {
      // Ignore
    }
  }

  unobserveInteractiveInSubtree(root) {
    if (!root || root.nodeType !== 1) return;

    // Root itself
    this.unobserveInteractiveElement(root);

    // Descendants
    try {
      if (root.querySelectorAll) {
        const matches = root.querySelectorAll(this.interactiveSelector);
        matches.forEach((el) => this.unobserveInteractiveElement(el));
      }
    } catch {
      // Ignore
    }
  }

  setupInteractiveElementObserver() {
    try {
      // Observer for interactive elements with expanded root margin for preloading
      this.interactiveObserver = new IntersectionObserver(
        (entries) => {
          this.metrics.observerUpdates++;
          
          entries.forEach(entry => {
            const element = entry.target;
            
            if (entry.isIntersecting) {
              this.visibleInteractiveElements.add(element);
              this.updateElementPositionCache(element, element.getBoundingClientRect());
            } else {
              this.visibleInteractiveElements.delete(element);
              this.elementPositionCache.delete(element);
              this._rtreeRemoveElement(element);
            }
          });
        },
        {
          // Expanded margins to preload elements before they're visible
          rootMargin: '100px',
          // Multiple thresholds for better granularity
          threshold: [0, 0.1, 0.5, 1.0]
        }
      );
    } catch (error) {
      console.warn('[KeyPilot] Failed to create IntersectionObserver for interactive elements:', error);
      this.interactiveObserver = null;
    }
  }

  setupOverlayObserver() {
    try {
      // Observer specifically for overlay elements to optimize repositioning
      this.overlayObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            const overlay = entry.target;
            
            // Hide overlays that are completely out of view to save rendering
            if (entry.intersectionRatio === 0) {
              overlay.style.visibility = 'hidden';
            } else {
              overlay.style.visibility = 'visible';
            }
          });
        },
        {
          rootMargin: '50px',
          threshold: [0, 1.0]
        }
      );
    } catch (error) {
      console.warn('[KeyPilot] Failed to create IntersectionObserver for overlays:', error);
      this.overlayObserver = null;
    }
  }

  startPeriodicCacheUpdate() {
    // Periodic cache updates removed - cache updated on-demand.
    // Initial discovery can still be expensive on huge pages, so schedule it for idle time.
    this.scheduleDiscoverInteractiveElements();
  }

  scheduleDiscoverInteractiveElements() {
    if (!this.interactiveObserver) return;
    if (this._discoverScheduled) return;
    this._discoverScheduled = true;

    const run = () => {
      this._discoverScheduled = false;
      this._discoverIdleHandle = null;
      try {
        this.discoverInteractiveElements();
      } catch (e) {
        console.warn('[KeyPilot] Failed to discover interactive elements:', e);
      }
    };

    // Prefer requestIdleCallback (Background Tasks API) when available.
    if (typeof window.requestIdleCallback === 'function') {
      this._discoverIdleHandle = window.requestIdleCallback(run, { timeout: 1000 });
    } else {
      this._discoverIdleHandle = window.setTimeout(run, 0);
    }
  }

  discoverInteractiveElements() {
    // Skip if observer is not initialized
    if (!this.interactiveObserver) {
      return;
    }

    // Find all interactive elements in the document
    const interactiveElements = document.querySelectorAll(
      this.interactiveSelector
    );

    // Observe new elements
    interactiveElements.forEach(element => {
      if (!this.isElementObserved(element)) {
        this.observeInteractiveElement(element);
      }
    });

    // Clean up observers for removed elements
    this.cleanupRemovedElements();
  }

  isElementObserved(element) {
    // Check if element is already being observed
    return this.observedInteractiveElements.has(element) ||
           this.visibleInteractiveElements.has(element) || 
           this.elementPositionCache.has(element);
  }

  cleanupRemovedElements() {
    // Skip if observer is not initialized
    if (!this.interactiveObserver) {
      return;
    }

    // Remove elements that are no longer in the DOM
    for (const element of this.observedInteractiveElements) {
      if (!document.contains(element)) {
        this.unobserveInteractiveElement(element);
      }
    }
  }

  updateElementPositionCache(element, rect) {
    this.elementPositionCache.set(element, {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      timestamp: Date.now()
    });

    // Keep spatial index in sync (no extra DOM reads here — uses the rect we already computed).
    this._rtreeUpsertElementRect(element, rect);
  }

  _rtreeEnabled() {
    if (!this._rtreeReady || !this._rtree) return false;
    try {
      if (typeof window !== 'undefined' && window.KEYPILOT_DISABLE_RBUSH) return false;
    } catch { /* ignore */ }
    return true;
  }

  _rtreeUpsertElementRect(element, rectLike) {
    if (!this._rtreeEnabled()) return;
    if (!element || element.nodeType !== 1) return;
    if (!rectLike) return;

    const minX = Number(rectLike.left);
    const minY = Number(rectLike.top);
    const maxX = Number(rectLike.right);
    const maxY = Number(rectLike.bottom);
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return;

    // Ensure non-negative/valid box.
    if (maxX <= minX || maxY <= minY) return;

    const existing = this._rtreeItemsByElement.get(element);
    if (existing) {
      // RBush doesn't have an explicit update; remove + reinsert by reference.
      try { this._rtree.remove(existing); } catch { /* ignore */ }
      existing.minX = minX;
      existing.minY = minY;
      existing.maxX = maxX;
      existing.maxY = maxY;
      try { this._rtree.insert(existing); } catch { /* ignore */ }
      return;
    }

    const item = { minX, minY, maxX, maxY, element };
    this._rtreeItemsByElement.set(element, item);
    try { this._rtree.insert(item); } catch { /* ignore */ }
  }

  _rtreeRemoveElement(element) {
    if (!this._rtreeReady || !this._rtree) return;
    const item = this._rtreeItemsByElement.get(element);
    if (!item) return;
    this._rtreeItemsByElement.delete(element);
    try { this._rtree.remove(item); } catch { /* ignore */ }
  }

  /**
   * Query indexed interactive elements that intersect a point (optionally with a radius).
   * Returns Elements (not RBush item objects).
   */
  queryInteractiveAtPoint(x, y, radiusPx = 0) {
    if (!this._rtreeEnabled()) return [];

    const px = Number(x);
    const py = Number(y);
    const r = Math.max(0, Number(radiusPx) || 0);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return [];

    this.metrics.rtreeQueries++;

    const bbox = { minX: px - r, minY: py - r, maxX: px + r, maxY: py + r };
    let items = [];
    try {
      items = this._rtree.search(bbox) || [];
    } catch {
      items = [];
    }

    if (!items.length) return [];
    this.metrics.rtreeHits++;

    const out = [];
    for (const it of items) {
      const el = it && it.element;
      if (!el || el.nodeType !== 1) continue;
      // Guard against stale items (detached nodes).
      try {
        if (!document.contains(el)) {
          this._rtreeRemoveElement(el);
          continue;
        }
      } catch { /* ignore */ }
      out.push(el);
    }
    return out;
  }

  /**
   * Best-effort mapping from a deep element at the cursor to the most likely
   * interactive element, using the spatial index as a fast pre-filter.
   *
   * Strategy:
   * - Query spatial index at point.
   * - Prefer a candidate that is `underEl` or an ancestor of `underEl` (shadow-host aware).
   * - Otherwise choose smallest-area candidate (often best matches "closest" target).
   */
  findBestInteractiveForUnderPoint({ x, y, underEl }) {
    if (!this._rtreeEnabled()) return null;

    const candidates = this.queryInteractiveAtPoint(x, y, 0);
    if (!candidates.length) return null;

    // Walk up from underEl and find first matching candidate.
    if (underEl && underEl.nodeType === 1) {
      const candSet = new Set(candidates);
      let n = underEl;
      let depth = 0;
      while (n && depth++ < 12) {
        if (candSet.has(n)) return n;
        // Prefer parentElement, but handle shadow root hosts as well.
        n = n.parentElement || (n.getRootNode && n.getRootNode() instanceof ShadowRoot ? n.getRootNode().host : null);
      }
    }

    // Otherwise choose smallest area rect.
    let best = null;
    let bestArea = Infinity;
    for (const el of candidates) {
      const rect = this.elementPositionCache.get(el);
      const w = rect && Number(rect.width);
      const h = rect && Number(rect.height);
      const area = (Number.isFinite(w) ? w : 0) * (Number.isFinite(h) ? h : 0);
      if (area > 0 && area < bestArea) {
        bestArea = area;
        best = el;
      }
    }

    return best || candidates[0] || null;
  }

  // Track element for performance metrics and caching
  // Optionally accept already-computed values to avoid redundant deepElementFromPoint() work
  // in hot paths (mousemove).
  trackElementAtPoint(x, y, element = null, clickable = null) {
    // This method is called to track elements for performance optimization
    // It doesn't replace the main element detection, just optimizes it
    
    const resolvedElement = element || this.elementDetector.deepElementFromPoint(x, y);
    const resolvedClickable = clickable || this.elementDetector.findClickable(resolvedElement);
    
    // Check if we found this element in our cache (for metrics)
    if (resolvedClickable && this.visibleInteractiveElements.has(resolvedClickable)) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
    
    // Add to cache if it's interactive and visible but not already cached
    if (resolvedClickable && this.interactiveObserver && this.isElementVisible(resolvedClickable) && !this.visibleInteractiveElements.has(resolvedClickable)) {
      this.visibleInteractiveElements.add(resolvedClickable);
      this.interactiveObserver.observe(resolvedClickable);
      this.updateElementPositionCache(resolvedClickable, resolvedClickable.getBoundingClientRect());
    }
    
    return resolvedClickable;
  }

  // Legacy method name for compatibility
  findInteractiveElementAtPoint(x, y) {
    return this.trackElementAtPoint(x, y);
  }

  isPointInRect(x, y, rect) {
    return x >= rect.left && 
           x <= rect.right && 
           y >= rect.top && 
           y <= rect.bottom;
  }

  rectsAreClose(rect1, rect2, tolerance = 5) {
    return Math.abs(rect1.left - rect2.left) <= tolerance &&
           Math.abs(rect1.top - rect2.top) <= tolerance &&
           Math.abs(rect1.width - rect2.width) <= tolerance &&
           Math.abs(rect1.height - rect2.height) <= tolerance;
  }

  isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && 
           rect.height > 0 && 
           rect.bottom > 0 && 
           rect.right > 0 && 
           rect.top < window.innerHeight && 
           rect.left < window.innerWidth;
  }

  // Observe overlay elements for visibility optimization
  observeOverlay(overlayElement) {
    if (this.overlayObserver && overlayElement) {
      this.overlayObserver.observe(overlayElement);
    }
  }

  unobserveOverlay(overlayElement) {
    if (this.overlayObserver && overlayElement) {
      this.overlayObserver.unobserve(overlayElement);
    }
  }

  // Get performance metrics
  getMetrics() {
    const totalQueries = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate = totalQueries > 0 ? (this.metrics.cacheHits / totalQueries * 100).toFixed(1) : 0;
    
    return {
      ...this.metrics,
      cacheHitRate: `${cacheHitRate}%`,
      visibleElements: this.visibleInteractiveElements.size,
      cachedPositions: this.elementPositionCache.size
    };
  }

  // Cleanup method
  cleanup() {
    if (this.mutationObserver) {
      try {
        this.mutationObserver.disconnect();
      } catch { }
      this.mutationObserver = null;
    }

    if (this._mutationIdleHandle) {
      try {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(this._mutationIdleHandle);
        } else {
          clearTimeout(this._mutationIdleHandle);
        }
      } catch { }
      this._mutationIdleHandle = null;
    }
    this._pendingAddedRoots.clear();
    this._pendingRemovedRoots.length = 0;
    this._pendingAttributeTargets.clear();
    this._mutationProcessScheduled = false;

    if (this._discoverIdleHandle) {
      try {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(this._discoverIdleHandle);
        } else {
          clearTimeout(this._discoverIdleHandle);
        }
      } catch { }
      this._discoverIdleHandle = null;
    }
    this._discoverScheduled = false;

    if (this.interactiveObserver) {
      this.interactiveObserver.disconnect();
      this.interactiveObserver = null;
    }
    
    if (this.overlayObserver) {
      this.overlayObserver.disconnect();
      this.overlayObserver = null;
    }
    
    if (this.cacheUpdateTimeout) {
      clearTimeout(this.cacheUpdateTimeout);
      this.cacheUpdateTimeout = null;
    }
    
    if (this.cacheUpdateInterval) {
      clearInterval(this.cacheUpdateInterval);
      this.cacheUpdateInterval = null;
    }
    
    this.visibleInteractiveElements.clear();
    this.elementPositionCache.clear();
    this.observedInteractiveElements.clear();

    if (this._rtree && this._rtree.clear) {
      try { this._rtree.clear(); } catch { /* ignore */ }
    }
    this._rtree = null;
    this._rtreeReady = false;
    this._rtreeItemsByElement.clear();
  }
}