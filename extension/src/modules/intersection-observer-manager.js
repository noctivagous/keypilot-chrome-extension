import { FEATURE_FLAGS } from '../config/constants.js';

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
      'a[href], button, input, select, textarea, [role="button"], [role="link"], [contenteditable="true"], [onclick]';

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
    this._rtreeItemsByPanelId = new Map(); // Panel ID -> item object for negative regions
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
      rtreeFallbacks: 0,
      culledCount: 0,
      totalCulled: 0,
    };

    // RBush debug overlays (only when ENABLE_DEBUG_PANEL is true)
    this.rbushDebugOverlays = [];
    this.rbushDebugOverlayTimeout = null;

    // Complex page detection and adaptation
    this.complexPageDetector = {
      isAnalyzed: false,
      complexityLevel: 'unknown',
      lastAnalysis: 0,
      analysisInterval: 10000, // Re-analyze every 10 seconds

      // Static metrics (computed once)
      staticMetrics: {
        scriptCount: 0,
        styleCount: 0,
        initialElementCount: 0,
        hasInfiniteScroll: false,
        isSocialMedia: false,
        urlPatterns: []
      },

      // Dynamic metrics (updated periodically)
      dynamicMetrics: {
        currentElementCount: 0,
        interactiveElementCount: 0,
        observerCount: 0,
        mutationRate: 0,
        scrollEventsPerSecond: 0,
        mouseMoveEventsPerSecond: 0
      },

      // IO adaptation settings
      ioAdaptation: {
        rootMargin: '100px',
        threshold: [0, 0.1, 0.5, 1.0],
        maxObservations: 1000,
        spatialCullDistance: 200,
        batchSize: 50
      }
    };
  }

  // =============================================================================
  // COMPLEX PAGE DETECTION - Adaptive IO behavior for performance optimization
  // Detects complex pages (Twitter, Facebook, etc.) and adapts IO settings accordingly
  // =============================================================================

  /**
   * Analyze page complexity and determine optimal IO settings
   */
  analyzePageComplexity() {
    const now = Date.now();
    if (this.complexPageDetector.isAnalyzed &&
        now - this.complexPageDetector.lastAnalysis < this.complexPageDetector.analysisInterval) {
      return this.complexPageDetector.complexityLevel;
    }

    this.performStaticAnalysis();
    this.performDynamicAnalysis();
    this.determineComplexityLevel();
    this.adaptIOStrategy();

    this.complexPageDetector.isAnalyzed = true;
    this.complexPageDetector.lastAnalysis = now;

    if (window.KEYPILOT_DEBUG) {
      console.log('[KeyPilot Debug] Complex page analysis completed:', {
        complexityLevel: this.complexPageDetector.complexityLevel,
        staticMetrics: this.complexPageDetector.staticMetrics,
        dynamicMetrics: this.complexPageDetector.dynamicMetrics,
        ioAdaptation: this.complexPageDetector.ioAdaptation
      });
    }

    return this.complexPageDetector.complexityLevel;
  }

  /**
   * Static analysis: URL patterns, initial DOM structure, known complex sites
   */
  performStaticAnalysis() {
    const url = window.location.href;
    const hostname = window.location.hostname;

    // URL pattern detection for known complex sites
    this.complexPageDetector.staticMetrics.urlPatterns = [];
    if (url.includes('twitter.com') || url.includes('x.com')) {
      this.complexPageDetector.staticMetrics.urlPatterns.push('twitter');
      this.complexPageDetector.staticMetrics.isSocialMedia = true;
    }
    if (url.includes('facebook.com') || url.includes('instagram.com')) {
      this.complexPageDetector.staticMetrics.urlPatterns.push('facebook');
      this.complexPageDetector.staticMetrics.isSocialMedia = true;
    }
    if (url.includes('reddit.com')) {
      this.complexPageDetector.staticMetrics.urlPatterns.push('reddit');
      this.complexPageDetector.staticMetrics.isSocialMedia = true;
    }

    // Count initial resources
    this.complexPageDetector.staticMetrics.scriptCount = document.querySelectorAll('script').length;
    this.complexPageDetector.staticMetrics.styleCount = document.querySelectorAll('style, link[rel="stylesheet"]').length;
    this.complexPageDetector.staticMetrics.initialElementCount = document.querySelectorAll('*').length;

    // Detect infinite scroll patterns
    this.complexPageDetector.staticMetrics.hasInfiniteScroll =
      document.querySelectorAll('[data-testid*="timeline"], [role="feed"], .timeline, .feed').length > 0 ||
      hostname.includes('twitter') || hostname.includes('facebook') || hostname.includes('reddit');
  }

  /**
   * Dynamic analysis: Current DOM state, performance metrics, user interaction patterns
   */
  performDynamicAnalysis() {
    // Current element counts
    this.complexPageDetector.dynamicMetrics.currentElementCount = document.querySelectorAll('*').length;
    this.complexPageDetector.dynamicMetrics.interactiveElementCount = document.querySelectorAll(
      'a[href], button, input, select, textarea, [role="button"], [role="link"], [contenteditable="true"], [onclick]'
    ).length;
    this.complexPageDetector.dynamicMetrics.observerCount = this.observedInteractiveElements.size;

    // Estimate mutation rate (how often DOM changes)
    const timeSinceLastAnalysis = Date.now() - this.complexPageDetector.lastAnalysis;
    if (timeSinceLastAnalysis > 0) {
      const elementGrowth = this.complexPageDetector.dynamicMetrics.currentElementCount -
                           this.complexPageDetector.staticMetrics.initialElementCount;
      this.complexPageDetector.dynamicMetrics.mutationRate = elementGrowth / (timeSinceLastAnalysis / 1000); // elements per second
    }
  }

  /**
   * Determine complexity level based on all metrics
   */
  determineComplexityLevel() {
    const staticMetrics = this.complexPageDetector.staticMetrics;
    const dynamicMetrics = this.complexPageDetector.dynamicMetrics;

    let complexityScore = 0;

    // Static factors (high weight)
    if (staticMetrics.isSocialMedia) complexityScore += 30;
    if (staticMetrics.hasInfiniteScroll) complexityScore += 20;
    if (staticMetrics.scriptCount > 20) complexityScore += 15;
    if (staticMetrics.styleCount > 10) complexityScore += 10;
    if (staticMetrics.initialElementCount > 1000) complexityScore += 15;

    // Dynamic factors (medium weight)
    if (dynamicMetrics.currentElementCount > 2000) complexityScore += 15;
    if (dynamicMetrics.interactiveElementCount > 500) complexityScore += 15;
    if (dynamicMetrics.mutationRate > 10) complexityScore += 10; // High DOM mutation rate

    // Performance factors (high weight)
    if (dynamicMetrics.observerCount > 200) complexityScore += 20;

    // Determine level
    if (complexityScore >= 50) {
      this.complexPageDetector.complexityLevel = 'high';
    } else if (complexityScore >= 25) {
      this.complexPageDetector.complexityLevel = 'medium';
    } else {
      this.complexPageDetector.complexityLevel = 'low';
    }
  }

  /**
   * Adapt IO strategy based on complexity level
   */
  adaptIOStrategy() {
    const level = this.complexPageDetector.complexityLevel;
    const adaptation = this.complexPageDetector.ioAdaptation;

    switch (level) {
      case 'high':
        // Aggressive optimization for complex sites like Twitter
        adaptation.rootMargin = '25px';  // Much smaller observation area
        adaptation.threshold = [0, 1.0]; // Simplified thresholds
        adaptation.maxObservations = 200; // Limit observations
        adaptation.spatialCullDistance = 100; // Cull distant elements
        adaptation.batchSize = 20; // Smaller processing batches
        break;

      case 'medium':
        // Moderate optimization
        adaptation.rootMargin = '50px';
        adaptation.threshold = [0, 0.5, 1.0];
        adaptation.maxObservations = 500;
        adaptation.spatialCullDistance = 150;
        adaptation.batchSize = 30;
        break;

      case 'low':
      default:
        // Default behavior for simple pages
        adaptation.rootMargin = '100px';
        adaptation.threshold = [0, 0.1, 0.5, 1.0];
        adaptation.maxObservations = 1000;
        adaptation.spatialCullDistance = 200;
        adaptation.batchSize = 50;
        break;
    }
  }

  /**
   * Check if current page is complex
   */
  isComplexPage() {
    return this.analyzePageComplexity() !== 'low';
  }

  /**
   * Get current IO adaptation settings
   */
  getIOAdaptation() {
    return this.complexPageDetector.ioAdaptation;
  }

  /**
   * Get extended viewport bounds for spatial culling
   * @param {number} margin - Additional margin around viewport in pixels
   * @returns {Object} - Bounds object with left, top, right, bottom
   */
  getViewportBounds(margin = 200) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

    return {
      left: scrollX - margin,
      top: scrollY - margin,
      right: scrollX + viewportWidth + margin,
      bottom: scrollY + viewportHeight + margin,
      width: viewportWidth + (2 * margin),
      height: viewportHeight + (2 * margin)
    };
  }

  /**
   * Find interactive elements within spatial bounds (for complex page optimization)
   * @param {Object} bounds - Viewport bounds with left, top, right, bottom
   * @param {number} maxElements - Maximum number of elements to return
   * @returns {Array} - Array of elements within bounds
   */
  findElementsInSpatialBounds(bounds, maxElements = 500) {
    const interactiveElements = document.querySelectorAll(this.interactiveSelector);
    const elementsInBounds = [];

    for (const element of interactiveElements) {
      if (elementsInBounds.length >= maxElements) break;

      try {
        const rect = element.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

        // Convert to document coordinates
        const elementLeft = rect.left + scrollX;
        const elementTop = rect.top + scrollY;
        const elementRight = rect.right + scrollX;
        const elementBottom = rect.bottom + scrollY;

        // Check if element intersects with viewport bounds
        if (elementRight > bounds.left &&
            elementLeft < bounds.right &&
            elementBottom > bounds.top &&
            elementTop < bounds.bottom) {
          elementsInBounds.push(element);
        }
      } catch (error) {
        // Skip elements that cause errors (e.g., detached elements)
        continue;
      }
    }

    return elementsInBounds;
  }

  /**
   * Periodically cull observations for elements outside viewport (complex pages only)
   */
  startSpatialCulling() {
    if (!this.isComplexPage()) return;

    // Clear any existing culling interval
    if (this._spatialCullingInterval) {
      clearInterval(this._spatialCullingInterval);
    }

    const adaptation = this.getIOAdaptation();

    // Cull every 3 seconds on complex pages
    this._spatialCullingInterval = setInterval(() => {
      if (!this.interactiveObserver || !this.isComplexPage()) {
        this.stopSpatialCulling();
        return;
      }

      const viewportBounds = this.getViewportBounds(adaptation.spatialCullDistance);
      const elementsToCull = [];

      // Find observed elements outside viewport bounds
      for (const element of this.observedInteractiveElements) {
        try {
          const rect = element.getBoundingClientRect();
          const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
          const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

          const elementLeft = rect.left + scrollX;
          const elementTop = rect.top + scrollY;
          const elementRight = rect.right + scrollX;
          const elementBottom = rect.bottom + scrollY;

          // Check if element is completely outside viewport bounds
          if (elementRight < viewportBounds.left ||
              elementLeft > viewportBounds.right ||
              elementBottom < viewportBounds.top ||
              elementTop > viewportBounds.bottom) {
            elementsToCull.push(element);
          }
        } catch (error) {
          // Element might be detached, mark for cleanup
          elementsToCull.push(element);
        }
      }

      // Remove observations for out-of-bounds elements
      if (elementsToCull.length > 0) {
        elementsToCull.forEach(element => {
          this.unobserveInteractiveElement(element);
        });

        // Update culling metrics
        this.metrics.culledCount = elementsToCull.length;
        this.metrics.totalCulled += elementsToCull.length;

        if (window.KEYPILOT_DEBUG) {
          console.log('[KeyPilot Debug] Spatial culling removed observations:', {
            culledCount: elementsToCull.length,
            totalCulled: this.metrics.totalCulled,
            remainingObservations: this.observedInteractiveElements.size
          });
        }
      }
    }, 3000); // Check every 3 seconds
  }

  /**
   * Stop spatial culling
   */
  stopSpatialCulling() {
    if (this._spatialCullingInterval) {
      clearInterval(this._spatialCullingInterval);
      this._spatialCullingInterval = null;
    }
  }

  async init() {
    // Setup spatial index asynchronously (doesn't block other initialization)
    this.setupSpatialIndex();

    this.setupInteractiveElementObserver();
    this.setupOverlayObserver();
    this.setupMutationObserver();

    // Only start periodic updates after observers are set up
    if (this.interactiveObserver && this.overlayObserver) {
      this.startPeriodicCacheUpdate();

      // Start spatial culling for complex pages
      if (this.isComplexPage()) {
        this.startSpatialCulling();
      }
    }
  }

  async setupSpatialIndex() {
    // Allow disabling via global flag for quick rollback / debugging.
    // Example: `window.KEYPILOT_DISABLE_RBUSH = true`
    if (typeof window !== 'undefined' && window.KEYPILOT_DISABLE_RBUSH) {
      this._rtree = null;
      this._rtreeReady = false;
      return;
    }

    try {
      // Check if RBush is available globally (should be set by the bundle)
      if (typeof window !== 'undefined' && typeof window.RBush === 'function') {
        this._rtree = new window.RBush(this._rtreeMaxEntries);
        this._rtreeReady = true;
        if (window.KEYPILOT_DEBUG) {
          console.log('[KeyPilot Debug] RBush spatial index initialized successfully');
        }
      } else {
        // RBush not available yet, wait for it to become available
        this._rtree = null;
        this._rtreeReady = false;
        if (window.KEYPILOT_DEBUG) {
          console.log('[KeyPilot Debug] RBush not available during setupSpatialIndex, waiting...');
        }

        // Wait for RBush to become available using a Promise
        await this.waitForRBush();
      }
    } catch (e) {
      console.warn('[KeyPilot] Failed to init RBush index:', e);
      this._rtree = null;
      this._rtreeReady = false;
    }
  }

  /**
   * Wait for RBush to become available globally using a Promise
   * Uses requestIdleCallback for efficient polling when available
   */
  waitForRBush() {
    return new Promise((resolve) => {
      const checkRBush = () => {
        if (typeof window !== 'undefined' && typeof window.RBush === 'function') {
          // RBush is now available, initialize it
          try {
            this._rtree = new window.RBush(this._rtreeMaxEntries);
            this._rtreeReady = true;
            if (window.KEYPILOT_DEBUG) {
              console.log('[KeyPilot Debug] RBush spatial index initialized successfully after waiting');
            }
            resolve();
          } catch (e) {
            console.warn('[KeyPilot] Failed to init RBush index after waiting:', e);
            resolve(); // Resolve anyway to not block initialization
          }
        } else {
          // RBush still not available, schedule another check
          if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
            // Use requestIdleCallback for better performance (waits until browser is idle)
            window.requestIdleCallback(checkRBush, { timeout: 100 });
          } else {
            // Fallback to setTimeout
            window.setTimeout(checkRBush, 10);
          }
        }
      };

      // Start checking
      checkRBush();
    });
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
        attributeFilter: ['href', 'role', 'onclick', 'contenteditable', 'aria-disabled', 'disabled']
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
    // Analyze page complexity to determine optimal IO settings
    this.analyzePageComplexity();
    const adaptation = this.getIOAdaptation();

    try {
      // Observer for interactive elements with adaptive settings based on page complexity
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
          // Adaptive root margin based on page complexity
          rootMargin: adaptation.rootMargin,
          // Adaptive thresholds based on page complexity
          threshold: adaptation.threshold
        }
      );

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] IntersectionObserver created with adaptive settings:', {
          complexityLevel: this.complexPageDetector.complexityLevel,
          rootMargin: adaptation.rootMargin,
          threshold: adaptation.threshold,
          maxObservations: adaptation.maxObservations
        });
      }
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

    const adaptation = this.getIOAdaptation();
    const isComplexPage = this.isComplexPage();

    let elementsToObserve;

    if (isComplexPage) {
      // Spatial culling for complex pages: only observe elements near viewport
      const viewportBounds = this.getViewportBounds(adaptation.spatialCullDistance);
      elementsToObserve = this.findElementsInSpatialBounds(viewportBounds, adaptation.maxObservations);

      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Spatial culling for complex page:', {
          viewportBounds,
          elementsFound: elementsToObserve.length,
          maxObservations: adaptation.maxObservations
        });
      }
    } else {
      // Standard behavior for simple pages
      const interactiveElements = document.querySelectorAll(this.interactiveSelector);
      elementsToObserve = Array.from(interactiveElements);
    }

    // Observe new elements (with batching for performance)
    const batchSize = adaptation.batchSize;
    for (let i = 0; i < elementsToObserve.length; i += batchSize) {
      const batch = elementsToObserve.slice(i, i + batchSize);

      // Use requestIdleCallback for non-blocking observation
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => {
          batch.forEach(element => {
            if (!this.isElementObserved(element)) {
              this.observeInteractiveElement(element);
            }
          });
        });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          batch.forEach(element => {
            if (!this.isElementObserved(element)) {
              this.observeInteractiveElement(element);
            }
          });
        }, 0);
      }
    }

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

  /**
   * Compute z-index for an element (including handling auto and stacking contexts)
   * @param {HTMLElement} element
   * @returns {number}
   */
  _computeZIndex(element) {
    if (!element || element.nodeType !== 1) return 0;
    try {
      const style = window.getComputedStyle(element);
      const zIndex = style.zIndex;
      if (zIndex === 'auto') return 0;
      const parsed = parseInt(zIndex, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  }

  _rtreeUpsertElementRect(element, rectLike) {
    if (!this._rtreeEnabled()) return;
    if (!element || element.nodeType !== 1) return;
    if (!rectLike) return;

    // Convert viewport coordinates (from getBoundingClientRect) to page/document coordinates
    // This ensures the spatial index remains valid across page scrolls
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

    const minX = Number(rectLike.left) + scrollX;
    const minY = Number(rectLike.top) + scrollY;
    const maxX = Number(rectLike.right) + scrollX;
    const maxY = Number(rectLike.bottom) + scrollY;
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return;

    // Ensure non-negative/valid box.
    if (maxX <= minX || maxY <= minY) return;

    const zIndex = this._computeZIndex(element);
    const existing = this._rtreeItemsByElement.get(element);
    if (existing) {
      // RBush doesn't have an explicit update; remove + reinsert by reference.
      try { this._rtree.remove(existing); } catch { /* ignore */ }
      existing.minX = minX;
      existing.minY = minY;
      existing.maxX = maxX;
      existing.maxY = maxY;
      existing.zIndex = zIndex;
      // Keep isNegative flag unchanged (should only be set for panel containers)
      try { this._rtree.insert(existing); } catch { /* ignore */ }
      return;
    }

    const item = { minX, minY, maxX, maxY, element, zIndex, isNegative: false };
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
   * Register a panel container as a negative region (blocking area)
   * Negative regions block elements underneath them unless those elements have higher z-index
   * @param {string} panelId - Unique identifier for the panel
   * @param {HTMLElement} panelElement - The panel container element
   */
  registerPanelContainer(panelId, panelElement) {
    if (!this._rtreeEnabled() || !panelElement || panelElement.nodeType !== 1) return;
    
    // Remove existing registration if present
    this.unregisterPanelContainer(panelId);

    try {
      const rect = panelElement.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;

      const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

      const minX = Number(rect.left) + scrollX;
      const minY = Number(rect.top) + scrollY;
      const maxX = Number(rect.right) + scrollX;
      const maxY = Number(rect.bottom) + scrollY;
      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return;
      if (maxX <= minX || maxY <= minY) return;

      const zIndex = this._computeZIndex(panelElement);
      const item = { 
        minX, 
        minY, 
        maxX, 
        maxY, 
        element: panelElement, 
        zIndex, 
        isNegative: true,
        panelId 
      };
      
      this._rtreeItemsByPanelId.set(panelId, item);
      this._rtreeItemsByElement.set(panelElement, item);
      try { 
        this._rtree.insert(item); 
      } catch { 
        /* ignore */ 
      }
    } catch (e) {
      if (window.KEYPILOT_DEBUG) {
        console.warn('[KeyPilot Debug] Failed to register panel container:', e);
      }
    }
  }

  /**
   * Unregister a panel container (remove its negative region)
   * @param {string} panelId - Unique identifier for the panel
   */
  unregisterPanelContainer(panelId) {
    if (!this._rtreeReady || !this._rtree) return;
    const item = this._rtreeItemsByPanelId.get(panelId);
    if (!item) return;
    
    this._rtreeItemsByPanelId.delete(panelId);
    if (item.element) {
      this._rtreeItemsByElement.delete(item.element);
    }
    try { 
      this._rtree.remove(item); 
    } catch { 
      /* ignore */ 
    }
  }

  /**
   * Update a registered panel container's bounds (call when panel moves/resizes)
   * @param {string} panelId - Unique identifier for the panel
   */
  updatePanelContainer(panelId) {
    if (!this._rtreeEnabled()) return;
    const item = this._rtreeItemsByPanelId.get(panelId);
    if (!item || !item.element) return;

    // Re-register to update bounds
    this.registerPanelContainer(panelId, item.element);
  }

  // =============================================================================
  // RBUSH SPATIAL INDEX - Mouse coordinate detection functions
  // These functions use the RBush spatial index to quickly find interactive
  // elements at specific mouse coordinates for hover/focus detection
  // =============================================================================

  /**
   * MOUSE COORDINATE DETECTION: Query indexed interactive elements that intersect a point
   * Uses RBush spatial index for fast coordinate-based lookups during mouse movement
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} radiusPx - Optional radius for point queries
   * @returns {Array} - Array of interactive elements at the coordinates
   */
  queryInteractiveAtPoint(x, y, radiusPx = 0) {
    if (!this._rtreeEnabled()) return [];

    const px = Number(x);
    const py = Number(y);
    const r = Math.max(0, Number(radiusPx) || 0);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return [];

    // Convert viewport coordinates to page/document coordinates to match stored rects
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    
    const pageX = px + scrollX;
    const pageY = py + scrollY;

    this.metrics.rtreeQueries++;

    const bbox = { minX: pageX - r, minY: pageY - r, maxX: pageX + r, maxY: pageY + r };
    let items = [];
    try {
      items = this._rtree.search(bbox) || [];
    } catch {
      items = [];
    }

    if (!items.length) return [];
    this.metrics.rtreeHits++;

    // Separate positive elements from negative regions
    const positiveItems = [];
    const negativeItems = [];
    
    for (const it of items) {
      // Guard against stale items (detached nodes).
      if (it.element) {
        try {
          if (!document.contains(it.element)) {
            if (it.isNegative && it.panelId) {
              this.unregisterPanelContainer(it.panelId);
            } else {
              this._rtreeRemoveElement(it.element);
            }
            continue;
          }
        } catch { /* ignore */ }
      }

      if (it.isNegative) {
        negativeItems.push(it);
      } else {
        positiveItems.push(it);
      }
    }

    // If there are negative regions, filter out positive elements that are occluded
    if (negativeItems.length > 0 && positiveItems.length > 0) {
      // Find the highest z-index negative region that contains this point
      let highestNegativeZ = -Infinity;
      let highestNegativeItem = null;
      
      for (const item of negativeItems) {
        // Check if point is inside this negative region
        if (pageX >= item.minX && pageX <= item.maxX && 
            pageY >= item.minY && pageY <= item.maxY) {
          const itemZ = item.zIndex || 0;
          if (itemZ > highestNegativeZ) {
            highestNegativeZ = itemZ;
            highestNegativeItem = item;
          }
        }
      }

      // Filter positive items:
      // - Keep if z-index is higher than the highest negative region (above the panel)
      // - Keep if element is inside the panel (children render above parent due to DOM order, regardless of z-index)
      // - Otherwise filter out (occluded by panel underneath)
      const filtered = positiveItems.filter(item => {
        const itemZ = item.zIndex || 0;
        
        // If no negative region at this point, keep all positive elements
        if (highestNegativeZ === -Infinity) {
          return true;
        }
        
        // Keep if z-index is higher than the negative region (element is above the panel)
        if (itemZ > highestNegativeZ) {
          return true;
        }
        
        // Keep if element is inside the panel (children naturally render above parent background
        // due to DOM order within the same stacking context, even with z-index: auto or lower values)
        if (highestNegativeItem && highestNegativeItem.element && item.element) {
          try {
            if (highestNegativeItem.element.contains(item.element)) {
              return true;
            }
          } catch {
            // ignore
          }
        }
        
        // Otherwise, element is underneath the panel and should be blocked
        return false;
      });

      // Build result array from filtered positive items
      const out = [];
      for (const it of filtered) {
        const el = it && it.element;
        if (!el || el.nodeType !== 1) continue;
        out.push(el);
      }

      // Show debug overlays for elements found via RBush tree query
      if (out.length > 0) {
        this.showRBushDebugOverlays(out);
      }

      return out;
    }

    // No negative regions, return all positive elements
    const out = [];
    for (const it of positiveItems) {
      const el = it && it.element;
      if (!el || el.nodeType !== 1) continue;
      out.push(el);
    }

    // Show debug overlays for elements found via RBush tree query
    if (out.length > 0) {
      this.showRBushDebugOverlays(out);
    }

    return out;
  }

  /**
   * Get z-index for an element from the rbush item (if available) or compute it
   * @param {HTMLElement} element
   * @returns {number}
   */
  getZIndexForElement(element) {
    if (!element) return 0;
    const item = this._rtreeItemsByElement.get(element);
    if (item && typeof item.zIndex === 'number') {
      return item.zIndex;
    }
    return this._computeZIndex(element);
  }

  /**
   * MOUSE COORDINATE DETECTION: Best-effort mapping from cursor position to interactive element
   * Uses RBush spatial index as a fast pre-filter to find the most likely interactive element
   * at mouse coordinates, avoiding expensive DOM queries during mouse movement.
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

  /**
   * MOUSE COORDINATE DETECTION: Track element at mouse position for performance metrics and caching
   * Maintains RBush spatial index and performance tracking during mouse movement
   * Optionally accepts pre-computed values to avoid redundant DOM queries in hot paths
   */
  trackElementAtPoint(x, y, element = null, clickable = null) {

    // Important: callers on hot paths may provide `clickable` but intentionally omit `element`
    // to avoid a DOM hit-test (`elementFromPoint`). Preserve that optimization here.
    let resolvedElement = null;
    let resolvedClickable = null;

    if (!element && !clickable) {
      resolvedElement = this.elementDetector.deepElementFromPoint(x, y);
      resolvedClickable = this.elementDetector.findClickable(resolvedElement);
    } else {
      resolvedElement = element || clickable || null;
      resolvedClickable = clickable || (resolvedElement ? this.elementDetector.findClickable(resolvedElement) : null);
    }
    
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

  /**
   * Show blue debug overlays for elements returned from RBush tree queries
   * Only active when ENABLE_DEBUG_PANEL is true
   */
  showRBushDebugOverlays(elements) {
    if (!FEATURE_FLAGS.ENABLE_DEBUG_PANEL || !elements?.length) return;

    // Clear any existing overlays
    this.clearRBushDebugOverlays();

    // Create blue overlays for each element
    elements.forEach(element => {
      try {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: fixed;
          left: ${rect.left}px;
          top: ${rect.top}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          background-color: rgba(0,120,255,0.2);
          border: 2px solid rgba(0,120,255,0.9);
          pointer-events: none;
          z-index: 2147483040;
          box-sizing: border-box;
        `;

        document.body.appendChild(overlay);
        this.rbushDebugOverlays.push(overlay);
      } catch (e) {
        // Ignore errors for detached elements
      }
    });

    // Auto-clear overlays after 2 seconds
    if (this.rbushDebugOverlayTimeout) {
      clearTimeout(this.rbushDebugOverlayTimeout);
    }
    this.rbushDebugOverlayTimeout = setTimeout(() => {
      this.clearRBushDebugOverlays();
    }, 2000);
  }

  /**
   * Clear all RBush debug overlays
   */
  clearRBushDebugOverlays() {
    this.rbushDebugOverlays.forEach(overlay => {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    });
    this.rbushDebugOverlays = [];

    if (this.rbushDebugOverlayTimeout) {
      clearTimeout(this.rbushDebugOverlayTimeout);
      this.rbushDebugOverlayTimeout = null;
    }
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
    this._rtreeItemsByPanelId.clear();

    // Stop spatial culling
    this.stopSpatialCulling();

    // Clear RBush debug overlays
    this.clearRBushDebugOverlays();
  }
}