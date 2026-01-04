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
    
    // ---- DOM hover listener mode (alternative hover target selection) ----
    // When enabled, we track a single "currently hovered" element using browser-native
    // hover targeting (occlusion + clipping). We prefer *delegated* pointer events
    // on `document` (one listener) over per-element listeners (many listeners) so we
    // don't need to constantly attach/detach listeners as the page mutates.
    this._domHoverEnabled = false;
    this._domHoveredElement = null;
    this._domHoverOnChange = null; // (HTMLElement|null) => void
    this._domHoverUseDelegation = true;
    this._domHoverDelegationAttached = false;
    this._domHoverAttachedElements = new Set(); // legacy per-element mode
    this._domHoverMetrics = { attached: 0, skipped: 0, delegated: 0 };

    this._boundDomHoverEnter = (e) => {
      try {
        if (!this._domHoverEnabled) return;
        const el = e?.currentTarget;
        if (!el || el.nodeType !== 1) return;
        // Keep a global debug hook for the "currently hovered" element.
        try { window.__KP_HOVERED_INTERACTIVE_EL = el; } catch { /* ignore */ }
        this._domHoveredElement = el;
        if (typeof this._domHoverOnChange === 'function') {
          try { this._domHoverOnChange(/** @type {HTMLElement} */ (el)); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    };

    this._boundDomHoverLeave = (e) => {
      try {
        if (!this._domHoverEnabled) return;
        const el = e?.currentTarget;
        if (!el || el.nodeType !== 1) return;
        if (this._domHoveredElement !== el) return;
        this._domHoveredElement = null;
        try { window.__KP_HOVERED_INTERACTIVE_EL = null; } catch { /* ignore */ }
        if (typeof this._domHoverOnChange === 'function') {
          try { this._domHoverOnChange(null); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    };

    this._boundDocPointerOver = (e) => {
      try {
        if (!this._domHoverEnabled) return;
        const path = (e && typeof e.composedPath === 'function') ? e.composedPath() : null;
        let raw = null;
        if (Array.isArray(path)) {
          for (const n of path) {
            if (n && n.nodeType === 1) { raw = n; break; }
          }
        }
        if (!raw && e?.target && e.target.nodeType === 1) raw = e.target;
        if (!raw || raw.nodeType !== 1) return;

        const el = /** @type {HTMLElement} */ (raw);
        if (this._isKeyPilotUiElement(el)) return;

        // Map the actual event target to the nearest "clickable" ancestor using our detector
        // (keeps semantics consistent with non-DOM-hover mode).
        let clickable = null;
        try {
          clickable = this.elementDetector?.findClickable
            ? this.elementDetector.findClickable(el)
            : el;
        } catch {
          clickable = el;
        }

        // Check if we should focus the parent container instead of the individual clickable element
        clickable = this._findParentContainerForClickable(clickable);

        const next = (clickable && clickable.nodeType === 1) ? /** @type {HTMLElement} */ (clickable) : null;
        try {
          if (next && (next.tagName === 'HTML' || next.tagName === 'BODY')) return;
        } catch { /* ignore */ }

        if (next === this._domHoveredElement) return;
        this._domHoveredElement = next;
        try { window.__KP_HOVERED_INTERACTIVE_EL = next; } catch { /* ignore */ }
        if (typeof this._domHoverOnChange === 'function') {
          try { this._domHoverOnChange(next); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    };

    this._boundDocPointerOut = (e) => {
      try {
        if (!this._domHoverEnabled) return;
        // When leaving the document/window, relatedTarget is typically null; clear hover.
        const rt = e?.relatedTarget;
        if (rt) return;
        if (!this._domHoveredElement) return;
        this._domHoveredElement = null;
        try { window.__KP_HOVERED_INTERACTIVE_EL = null; } catch { /* ignore */ }
        if (typeof this._domHoverOnChange === 'function') {
          try { this._domHoverOnChange(null); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    };

    this._boundWindowBlur = () => {
      try {
        if (!this._domHoverEnabled) return;
        if (!this._domHoveredElement) return;
        this._domHoveredElement = null;
        try { window.__KP_HOVERED_INTERACTIVE_EL = null; } catch { /* ignore */ }
        if (typeof this._domHoverOnChange === 'function') {
          try { this._domHoverOnChange(null); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    };

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
    this._discoverWalker = null;
    this._discoverCursor = null;
    this._discoverDone = false;

    // ---- Spatial index (RBush) for fast hit-testing ----
    // Populated from `elementPositionCache` for visible interactive elements.
    // NOTE: The bundle provides `RBush` as a global symbol (vendored in src/vendor/rbush.js).
    this._rtree = null;
    this._rtreeItemsByElement = new Map(); // Element -> item object (kept by reference for removal)
    this._rtreeReady = false;
    // When DOM-hover targeting mode is enabled, we can disable RBush entirely so this mode is
    // a true alternative (no index maintenance + no RBush queries in normal browsing).
    this._rtreeDisabledByDomHover = false;
    this._rtreeMaxEntries = 16;
    this._rtreeRemoveEquals = null; // unused (reference removal)

    // Destination index for link grouping / display coalescing.
    // Key: normalized destination (string), Value: Set<HTMLElement>
    this._destIndex = new Map();
    // Cache for display-rect coalescing (computed on demand).
    this._displayRectCache = {
      version: 0,
      destination: null,
      anchorEl: null,
      // Store the rect in *page coordinates* (minX/minY/maxX/maxY). We convert to viewport
      // coordinates on demand so scrolling doesn't stale-cache the overlay position.
      pageRect: null
    };
    this._rtreeVersion = 0;
    
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
      analysisInterval: 30000, // Re-analyze every 30 seconds (cheap, but no need to spam)

      // Static metrics (computed once)
      staticMetrics: {
        hasInfiniteScroll: false,
        isSocialMedia: false,
        urlPatterns: []
      },

      // Dynamic metrics (updated periodically)
      dynamicMetrics: {
        observerCount: 0,
        visibleCount: 0,
        rbushItems: 0,
        pendingMutations: 0,
        rtreeHitRate: 0,
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

  /**
   * Check if a parent container should be focused instead of an individual clickable element.
   * If the hovered element is clickable and its parent has similar clickable properties,
   * and all children of the parent have similar properties, focus the parent instead.
   * @param {HTMLElement} element
   * @returns {HTMLElement}
   */
  _findParentContainerForClickable(element) {
    if (!element || element.nodeType !== 1) return element;

    try {
      // Only apply this logic to elements that are actually clickable
      if (!this.elementDetector?.isLikelyInteractive(element)) return element;

      const parent = element.parentElement;
      if (!parent || parent.nodeType !== 1) return element;

      // Check if parent is also clickable
      if (!this.elementDetector.isLikelyInteractive(parent)) return element;

      // Get the clickability profiles for comparison
      const elementProfile = this._getClickabilityProfile(element);
      const parentProfile = this._getClickabilityProfile(parent);

      // Check if parent has similar clickable characteristics
      if (!this._profilesAreSimilar(elementProfile, parentProfile)) return element;

      // Check if all clickable children of parent have similar profiles
      const children = Array.from(parent.children);
      const clickableChildren = children.filter(child => {
        if (child.nodeType !== 1) return false;
        return this.elementDetector.isLikelyInteractive(child);
      });

      // If no other clickable children, return original element
      if (clickableChildren.length === 0) return element;

      // Check if all clickable children have similar profiles
      const allChildrenSimilar = clickableChildren.every(child => {
        const childProfile = this._getClickabilityProfile(child);
        return this._profilesAreSimilar(elementProfile, childProfile);
      });

      // If all children have similar clickable characteristics, focus the parent
      if (allChildrenSimilar) {
        if (window.KEYPILOT_DEBUG) {
          console.log('[KeyPilot Debug] Focusing parent container instead of child element:', {
            originalElement: element,
            parentElement: parent,
            elementProfile: elementProfile,
            parentProfile: parentProfile
          });
        }
        return parent;
      }
    } catch (error) {
      // If anything fails, return the original element
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] Error in parent container detection:', error);
      }
    }

    return element;
  }

  /**
   * Get a profile of what makes an element clickable
   * @param {HTMLElement} element
   * @returns {Object} profile object
   */
  _getClickabilityProfile(element) {
    const profile = {
      tagName: element.tagName,
      href: '',
      role: '',
      hasClickHandler: false,
      hasCursorPointer: false,
      inputType: '',
      isContentEditable: false
    };

    try {
      // Get href for links
      if (element.tagName === 'A') {
        profile.href = this._getNormalizedDestination(element);
      }

      // Get role attribute
      profile.role = (element.getAttribute && element.getAttribute('role') || '').trim().toLowerCase();

      // Check for click handlers
      profile.hasClickHandler = !!(element.onclick ||
                                   element.getAttribute('onclick') ||
                                   this.elementDetector?.hasTrackedClickHandler(element));

      // Check for cursor pointer (only if other conditions don't apply)
      if (!profile.href && !profile.role && !profile.hasClickHandler) {
        try {
          profile.hasCursorPointer = !!(window.getComputedStyle &&
                                       window.getComputedStyle(element).cursor === 'pointer');
        } catch {
          profile.hasCursorPointer = false;
        }
      }

      // Get input type for form elements
      if (element.tagName === 'INPUT') {
        profile.inputType = (element.getAttribute('type') || 'text').toLowerCase();
      }

      // Check if content editable
      profile.isContentEditable = !!(element.isContentEditable ||
                                    element.getAttribute('contenteditable') === 'true');

    } catch (error) {
      // Ignore errors when building profile
    }

    return profile;
  }

  /**
   * Check if two clickability profiles are similar enough to be considered
   * part of the same interactive unit
   * @param {Object} profile1
   * @param {Object} profile2
   * @returns {boolean}
   */
  _profilesAreSimilar(profile1, profile2) {
    // Same tag name (button, input, etc.)
    if (profile1.tagName === profile2.tagName) {
      // For inputs, same type
      if (profile1.tagName === 'INPUT' && profile1.inputType === profile2.inputType) {
        return true;
      }
      // For other matching tags
      if (profile1.tagName !== 'INPUT') {
        return true;
      }
    }

    // Same role attribute
    if (profile1.role && profile1.role === profile2.role) {
      return true;
    }

    // Same href (for links)
    if (profile1.href && profile1.href === profile2.href) {
      return true;
    }

    // Both have click handlers (similar interaction pattern)
    if (profile1.hasClickHandler && profile2.hasClickHandler) {
      return true;
    }

    // Both have cursor pointer (similar visual cue)
    if (profile1.hasCursorPointer && profile2.hasCursorPointer) {
      return true;
    }

    // Both are content editable
    if (profile1.isContentEditable && profile2.isContentEditable) {
      return true;
    }

    return false;
  }

  /**
   * Extract and normalize a destination string for an element.
   * For now we only use <a href> to keep semantics reliable.
   * @param {HTMLElement} element
   * @returns {string} normalized destination or '' if none
   */
  _getNormalizedDestination(element) {
    try {
      if (!element || element.nodeType !== 1) return '';
      if (element.tagName !== 'A') return '';
      const hrefAttr = element.getAttribute && element.getAttribute('href');
      if (!hrefAttr) return '';
      // Prefer the fully-resolved absolute href when available (handles base tags).
      const resolved = element.href || hrefAttr;
      // Normalize via URL when possible.
      try {
        return new URL(resolved, window.location.href).href;
      } catch {
        return String(resolved || '');
      }
    } catch {
      return '';
    }
  }

  /**
   * Enable/disable DOM hover listener mode.
   * @param {boolean} enabled
   * @param {(el: HTMLElement|null) => void} [onChange]
   */
  setDomHoverListenersEnabled(enabled, onChange) {
    const next = !!enabled;
    this._domHoverEnabled = next;
    this._domHoverOnChange = typeof onChange === 'function' ? onChange : null;
    // Make DOM-hover mode exclusive vs RBush (reduces work and avoids mixed-mode confusion).
    this._rtreeDisabledByDomHover = next;

    // Prefer delegated events on the document (one-time attach).
    if (this._domHoverUseDelegation) {
      if (next) this._domHoverAttachDelegated();
      else this._domHoverDetachDelegated();
    } else {
      // Legacy per-element attach/detach for already-observed elements.
      try {
        for (const el of this.observedInteractiveElements) {
          if (next) this._domHoverAttach(el);
          else this._domHoverDetach(el);
        }
      } catch { /* ignore */ }
    }

    if (!next) {
      this._domHoveredElement = null;
      try { window.__KP_HOVERED_INTERACTIVE_EL = null; } catch { /* ignore */ }
      if (typeof this._domHoverOnChange === 'function') {
        try { this._domHoverOnChange(null); } catch { /* ignore */ }
      }
    }
  }

  /**
   * @returns {HTMLElement|null}
   */
  getDomHoveredElement() {
    return (this._domHoveredElement && this._domHoveredElement.nodeType === 1)
      ? /** @type {HTMLElement} */ (this._domHoveredElement)
      : null;
  }

  _rectsRoughlyEqual(a, b, tolPx = 1) {
    const t = Math.max(0, Number(tolPx) || 0);
    if (!a || !b) return false;
    return (
      Math.abs(a.left - b.left) <= t &&
      Math.abs(a.top - b.top) <= t &&
      Math.abs(a.right - b.right) <= t &&
      Math.abs(a.bottom - b.bottom) <= t
    );
  }

  _domHoverShouldAttach(el) {
    try {
      if (!el || el.nodeType !== 1) return false;
      // Omit attaching to <a> links whose rect matches an interactive parent.
      // This reduces duplicate hover targeting on "full-row link" UIs.
      if (el.tagName === 'A') {
        const parent = el.parentElement;
        if (parent && parent.nodeType === 1) {
          let parentMatches = false;
          try { parentMatches = !!(parent.matches && parent.matches(this.interactiveSelector)); } catch { parentMatches = false; }
          if (parentMatches) {
            let r1 = null;
            let r2 = null;
            try { r1 = el.getBoundingClientRect(); } catch { r1 = null; }
            try { r2 = parent.getBoundingClientRect(); } catch { r2 = null; }
            if (r1 && r2 && this._rectsRoughlyEqual(r1, r2, 1)) return false;
          }
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  _domHoverAttach(el) {
    if (this._domHoverUseDelegation) return;
    if (!this._domHoverEnabled) return;
    if (!el || el.nodeType !== 1) return;
    if (this._domHoverAttachedElements.has(el)) return;
    if (!this._domHoverShouldAttach(el)) {
      this._domHoverMetrics.skipped++;
      return;
    }
    try {
      // Use mouseenter/mouseleave to avoid event bubbling noise.
      el.addEventListener('mouseenter', this._boundDomHoverEnter, true);
      el.addEventListener('mouseleave', this._boundDomHoverLeave, true);
      this._domHoverAttachedElements.add(el);
      this._domHoverMetrics.attached++;
    } catch {
      // ignore
    }
  }

  _domHoverDetach(el) {
    if (this._domHoverUseDelegation) return;
    if (!el || el.nodeType !== 1) return;
    if (!this._domHoverAttachedElements.has(el)) return;
    try {
      el.removeEventListener('mouseenter', this._boundDomHoverEnter, true);
      el.removeEventListener('mouseleave', this._boundDomHoverLeave, true);
    } catch { /* ignore */ }
    this._domHoverAttachedElements.delete(el);
    // If we detach the currently hovered element, clear it.
    if (this._domHoveredElement === el) {
      this._domHoveredElement = null;
      try { window.__KP_HOVERED_INTERACTIVE_EL = null; } catch { /* ignore */ }
      if (typeof this._domHoverOnChange === 'function') {
        try { this._domHoverOnChange(null); } catch { /* ignore */ }
      }
    }
  }

  _isKeyPilotUiElement(el) {
    try {
      let n = el;
      let guard = 0;
      while (n && n.nodeType === 1 && guard++ < 12) {
        const id = typeof n.id === 'string' ? n.id : '';
        if (id && id.startsWith('kpv2-')) return true;
        const cl = n.classList;
        if (cl && cl.length) {
          for (const c of cl) {
            if (typeof c === 'string' && c.startsWith('kpv2-')) return true;
          }
        }
        n = n.parentElement;
      }
    } catch { /* ignore */ }
    return false;
  }

  _domHoverAttachDelegated() {
    if (!this._domHoverEnabled) return;
    if (this._domHoverDelegationAttached) return;
    try {
      // Attach to `window` in capture phase so we're earlier than document-level capture listeners
      // that might call stopImmediatePropagation(). Also attach mouseover/mouseout as a fallback
      // for environments where PointerEvents are unavailable or suppressed.
      window.addEventListener('pointerover', this._boundDocPointerOver, true);
      window.addEventListener('pointerout', this._boundDocPointerOut, true);
      window.addEventListener('mouseover', this._boundDocPointerOver, true);
      window.addEventListener('mouseout', this._boundDocPointerOut, true);
      window.addEventListener('blur', this._boundWindowBlur, true);
      this._domHoverDelegationAttached = true;
      this._domHoverMetrics.delegated++;
    } catch { /* ignore */ }
  }

  _domHoverDetachDelegated() {
    if (!this._domHoverDelegationAttached) return;
    try {
      window.removeEventListener('pointerover', this._boundDocPointerOver, true);
      window.removeEventListener('pointerout', this._boundDocPointerOut, true);
      window.removeEventListener('mouseover', this._boundDocPointerOver, true);
      window.removeEventListener('mouseout', this._boundDocPointerOut, true);
      window.removeEventListener('blur', this._boundWindowBlur, true);
    } catch { /* ignore */ }
    this._domHoverDelegationAttached = false;
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

    // Detect infinite scroll patterns
    this.complexPageDetector.staticMetrics.hasInfiniteScroll =
      hostname.includes('twitter') || hostname.includes('x.com') || hostname.includes('facebook') ||
      hostname.includes('instagram') || hostname.includes('reddit');

    // Avoid expensive DOM-wide counting here. We lean on hostname heuristics + internal counters.
  }

  /**
   * Dynamic analysis: Current DOM state, performance metrics, user interaction patterns
   */
  performDynamicAnalysis() {
    this.complexPageDetector.dynamicMetrics.observerCount = this.observedInteractiveElements.size;
    this.complexPageDetector.dynamicMetrics.visibleCount = this.visibleInteractiveElements.size;
    this.complexPageDetector.dynamicMetrics.rbushItems = this._rtreeItemsByElement?.size || 0;
    this.complexPageDetector.dynamicMetrics.pendingMutations =
      (this._pendingAddedRoots?.size || 0) +
      (this._pendingRemovedRoots?.length || 0) +
      (this._pendingAttributeTargets?.size || 0);

    const queries = Number(this.metrics?.rtreeQueries) || 0;
    const hits = Number(this.metrics?.rtreeHits) || 0;
    this.complexPageDetector.dynamicMetrics.rtreeHitRate = queries > 0 ? (hits / queries) : 0;

    // Note: we intentionally avoid expensive mutation-rate estimation via DOM-wide counts.
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

    // Performance factors (high weight)
    if (dynamicMetrics.observerCount > 200) complexityScore += 20;
    if (dynamicMetrics.observerCount > 600) complexityScore += 20;
    if (dynamicMetrics.rbushItems > 500) complexityScore += 10;
    if (dynamicMetrics.rbushItems > 2000) complexityScore += 20;
    if (dynamicMetrics.pendingMutations > 200) complexityScore += 15;
    if (dynamicMetrics.pendingMutations > 1000) complexityScore += 25;

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
    // Setup spatial index and ensure it's ready before callers rely on RBush queries.
    // KeyPilot.enable() awaits init(); without awaiting here, the extension can re-enable
    // with RBush still uninitialized, causing hover selection to temporarily fail.
    await this.setupSpatialIndex();

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

    // Skip RBush initialization when DOM hover listeners are enabled
    // This provides a true alternative to spatial indexing during normal browsing
    // Note: Check runtime state (_domHoverEnabled) instead of compile-time flag since
    // the mode can be toggled at runtime via window.KEYPILOT_ENABLE_DOM_HOVER_LISTENERS
    if (this._domHoverEnabled) {
      this._rtree = null;
      this._rtreeReady = false;
      this._rtreeDisabledByDomHover = true;
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] RBush initialization skipped - DOM hover listeners enabled');
      }
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
      this._domHoverAttach(el);
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
    this._domHoverDetach(el);
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

    const run = (deadline) => {
      this._discoverScheduled = false;
      this._discoverIdleHandle = null;
      try {
        this.discoverInteractiveElements(deadline);
      } catch (e) {
        console.warn('[KeyPilot] Failed to discover interactive elements:', e);
      }
    };

    // Prefer requestIdleCallback (Background Tasks API) when available.
    if (typeof window.requestIdleCallback === 'function') {
      this._discoverIdleHandle = window.requestIdleCallback(run, { timeout: 1000 });
    } else {
      this._discoverIdleHandle = window.setTimeout(() => run({ timeRemaining: () => 0 }), 0);
    }
  }

  resetDiscoveryAndSchedule() {
    // Reset the incremental discovery cursor so we can re-seed observations around the
    // current viewport (useful after scroll-end, major DOM changes, SPA navigations, etc.).
    this._discoverWalker = null;
    this._discoverCursor = null;
    this._discoverDone = false;
    this._discoverScheduled = false;
    this.scheduleDiscoverInteractiveElements();

    // Refresh RBush positions for all currently visible elements after scroll
    // (IntersectionObserver only fires for elements entering/leaving, not for position changes)
    this.refreshVisibleElementPositions();
  }

  refreshVisibleElementPositions() {
    // Update RBush spatial index with new positions for all visible interactive elements
    // This is needed after scrolling because elements that remain visible don't trigger
    // IntersectionObserver callbacks, but their viewport coordinates have changed
    if (!this._rtreeEnabled()) return;

    try {
      for (const element of this.visibleInteractiveElements) {
        if (!element || element.nodeType !== 1) continue;
        try {
          const rect = element.getBoundingClientRect();
          this.updateElementPositionCache(element, rect);
        } catch { /* ignore stale/detached elements */ }
      }
    } catch { /* ignore */ }
  }

  _ensureDiscoverWalker() {
    if (this._discoverWalker && this._discoverCursor) return;
    try {
      const root = document.body || document.documentElement;
      if (!root) return;
      this._discoverWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      this._discoverCursor = this._discoverWalker.currentNode;
    } catch {
      this._discoverWalker = null;
      this._discoverCursor = null;
    }
  }

  discoverInteractiveElements(deadline) {
    // Skip if observer is not initialized
    if (!this.interactiveObserver) {
      return;
    }

    const adaptation = this.getIOAdaptation();

    // Locality-first, incremental discovery:
    // - Avoid full-page synchronous querySelectorAll.
    // - Walk the DOM in idle slices, but only observe elements near the viewport.
    // - Respect a global max observation cap (adaptive).
    const timeRemaining = typeof deadline?.timeRemaining === 'function'
      ? () => deadline.timeRemaining()
      : () => 0;

    const cap = Math.max(0, Number(adaptation.maxObservations) || 0);
    if (cap > 0 && this.observedInteractiveElements.size >= cap) {
      this._discoverDone = true;
      return;
    }

    this._ensureDiscoverWalker();
    if (!this._discoverWalker) return;

    const margin = Math.max(0, Number(adaptation.spatialCullDistance) || 0);
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;

    let observedThisSlice = 0;
    const maxPerSlice = Math.max(10, Number(adaptation.batchSize) || 50);

    while (this._discoverCursor) {
      // Stay responsive: stop when idle budget is low and we already did some work.
      if (observedThisSlice >= maxPerSlice) break;
      if (observedThisSlice > 0 && timeRemaining() < 2) break;

      const el = this._discoverCursor;
      // Advance cursor early so errors don't stall scanning.
      try {
        this._discoverCursor = this._discoverWalker.nextNode();
      } catch {
        this._discoverCursor = null;
      }

      if (!el || el.nodeType !== 1) continue;
      if (cap > 0 && this.observedInteractiveElements.size >= cap) { this._discoverDone = true; break; }
      if (this.isElementObserved(el)) continue;

      let matches = false;
      try { matches = !!(el.matches && el.matches(this.interactiveSelector)); } catch { matches = false; }
      if (!matches) continue;

      // Viewport-first: only observe if the element is near the viewport in viewport coordinates.
      // (This avoids scrollX/scrollY and keeps discovery locality-first.)
      let rect;
      try { rect = el.getBoundingClientRect(); } catch { rect = null; }
      if (!rect) continue;
      if (rect.bottom < -margin || rect.top > vh + margin || rect.right < -margin || rect.left > vw + margin) continue;

      this.observeInteractiveElement(el);
      observedThisSlice++;
    }

    // If scanning is not done and we haven't hit cap, schedule another idle slice.
    if (!this._discoverDone && this._discoverCursor && (cap === 0 || this.observedInteractiveElements.size < cap)) {
      this.scheduleDiscoverInteractiveElements();
    } else {
      this._discoverDone = true;
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
      try {
        if (element && element.isConnected === false) {
          this.unobserveInteractiveElement(element);
          continue;
        }
      } catch { /* ignore */ }
      // Fallback for older environments / weird nodes.
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

    // Keep spatial index in sync with clipped bounds (accounts for parent clipping).
    this._rtreeUpsertElementRect(element);
  }

  _rtreeEnabled() {
    if (!this._rtreeReady || !this._rtree) {
      if (window.KEYPILOT_DEBUG && this._rtreeDisabledByDomHover) {
        console.log('[KeyPilot Debug] RBush disabled by DOM hover listeners');
      }
      return false;
    }
    if (this._rtreeDisabledByDomHover) {
      if (window.KEYPILOT_DEBUG) {
        console.log('[KeyPilot Debug] RBush disabled by DOM hover listeners');
      }
      return false;
    }
    try {
      if (typeof window !== 'undefined' && window.KEYPILOT_DISABLE_RBUSH) return false;
    } catch { /* ignore */ }
    return true;
  }

  _getScrollXY() {
    const scrollX = (typeof window !== 'undefined' && typeof window.scrollX === 'number')
      ? window.scrollX
      : (window.pageXOffset || 0);
    const scrollY = (typeof window !== 'undefined' && typeof window.scrollY === 'number')
      ? window.scrollY
      : (window.pageYOffset || 0);
    return { scrollX, scrollY };
  }

  /**
   * Extract and normalize a destination string for an element.
   * For now we only use <a href> to keep semantics reliable.
   * @param {HTMLElement} element
   * @returns {string} normalized destination or '' if none
   */
  _getNormalizedDestination(element) {
    try {
      if (!element || element.nodeType !== 1) return '';
      if (element.tagName !== 'A') return '';
      const hrefAttr = element.getAttribute && element.getAttribute('href');
      if (!hrefAttr) return '';
      // Prefer the fully-resolved absolute href when available (handles base tags).
      const resolved = element.href || hrefAttr;
      // Normalize via URL when possible.
      try {
        return new URL(resolved, window.location.href).href;
      } catch {
        return String(resolved || '');
      }
    } catch {
      return '';
    }
  }

  _destIndexAdd(element, destination) {
    if (!destination) return;
    let set = this._destIndex.get(destination);
    if (!set) {
      set = new Set();
      this._destIndex.set(destination, set);
    }
    set.add(element);
  }

  _destIndexRemove(element, destination) {
    if (!destination) return;
    const set = this._destIndex.get(destination);
    if (!set) return;
    set.delete(element);
    if (set.size === 0) this._destIndex.delete(destination);
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

  _rtreeUpsertElementRect(element) {
    if (!this._rtreeEnabled()) return;
    if (!element || element.nodeType !== 1) return;

    // Use getClientRects() to get visible rectangles (accounts for clipping by parent containers)
    // This ensures we only index the actually clickable portions of elements
    let clientRects;
    try {
      clientRects = element.getClientRects();
    } catch (e) {
      // Fallback to getBoundingClientRect if getClientRects fails
      const rect = element.getBoundingClientRect();
      clientRects = rect ? [rect] : [];
    }

    if (!clientRects || clientRects.length === 0) return;

    // Compute union of all visible client rectangles
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const rect of clientRects) {
      minX = Math.min(minX, rect.left);
      minY = Math.min(minY, rect.top);
      maxX = Math.max(maxX, rect.right);
      maxY = Math.max(maxY, rect.bottom);
    }

    // Convert viewport coordinates to page/document coordinates
    // This ensures the spatial index remains valid across page scrolls
    const { scrollX, scrollY } = this._getScrollXY();

    minX = Number(minX) + scrollX;
    minY = Number(minY) + scrollY;
    maxX = Number(maxX) + scrollX;
    maxY = Number(maxY) + scrollY;

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return;

    // Ensure non-negative/valid box.
    if (maxX <= minX || maxY <= minY) return;

    const zIndex = this._computeZIndex(element);
    const existing = this._rtreeItemsByElement.get(element);
    if (existing) {
      // RBush doesn't have an explicit update; remove + reinsert by reference.
      try { this._rtree.remove(existing); } catch { /* ignore */ }

      // Maintain destination index if it changed.
      const nextDest = this._getNormalizedDestination(element);
      const prevDest = existing.destination || '';
      if (prevDest !== nextDest) {
        this._destIndexRemove(element, prevDest);
        this._destIndexAdd(element, nextDest);
        existing.destination = nextDest;
      }

      existing.minX = minX;
      existing.minY = minY;
      existing.maxX = maxX;
      existing.maxY = maxY;
      existing.zIndex = zIndex;
      try { this._rtree.insert(existing); } catch { /* ignore */ }
      this._rtreeVersion++;
      return;
    }

    // =============================================================================
    // RBUSH OPTIMIZATION: omit enclosed elements with same link destination
    // If this element is a link and is completely enclosed by a larger element
    // with the same link destination, omit the smaller element to reduce redundancy
    // =============================================================================
    const destination = this._getNormalizedDestination(element);
    if (destination) {
      // Query for elements that might contain this element
      const containingElements = this._rtree.search({
        minX: minX - 1, // Slight expansion to handle edge cases
        minY: minY - 1,
        maxX: maxX + 1,
        maxY: maxY + 1
      }).filter(item => {
        // Must contain this element
        return item.element !== element && // Not the same element
               item.minX <= minX &&
               item.minY <= minY &&
               item.maxX >= maxX &&
               item.maxY >= maxY &&
               item.element.tagName === 'A' &&
               (item.destination || '') === destination;
      });

      // If any larger element with same link destination contains this element, skip it
      if (containingElements.length > 0) {
        if (window.KEYPILOT_DEBUG) {
          console.log('[KeyPilot Debug] Omitting enclosed link element:', {
            smallerElement: element,
            linkDestination: destination,
            enclosedBy: containingElements[0].element
          });
        }
        return; // Don't add this smaller element
      }

      // Order-independent improvement:
      // If THIS element encloses already-indexed smaller link elements with the same destination,
      // remove the smaller ones before inserting the larger one. This prevents duplicate boxes
      // and reduces hover flicker due to insertion order.
      try {
        const enclosedCandidates = this._rtree.search({
          minX: minX - 1,
          minY: minY - 1,
          maxX: maxX + 1,
          maxY: maxY + 1
        }) || [];
        for (const it of enclosedCandidates) {
          const el2 = it && it.element;
          if (!el2 || el2 === element) continue;
          if (it.minX >= minX &&
              it.minY >= minY &&
              it.maxX <= maxX &&
              it.maxY <= maxY &&
              (it.destination || '') === destination) {
            // Don't remove equal-sized rects (could be the same link rendered twice with same bbox).
            const strictlyInside = (it.minX > minX || it.minY > minY || it.maxX < maxX || it.maxY < maxY);
            if (!strictlyInside) continue;
            this._rtreeRemoveElement(el2);
          }
        }
      } catch { /* ignore */ }
    }

    // =============================================================================
    // RBUSH OPTIMIZATION: expand link bounds to include contained images
    // When an <img> is inside an <a href=""> and the link's computed box is smaller
    // than the image's computed box, expand the link's bounds to match the image
    // =============================================================================
    if (element.tagName === 'A') {
      try {
        const images = element.querySelectorAll('img');
        for (const img of images) {
          // Use getClientRects for images too, for consistency with clipping handling
          let imgRects;
          try {
            imgRects = img.getClientRects();
          } catch (e) {
            const imgRect = img.getBoundingClientRect();
            imgRects = imgRect ? [imgRect] : [];
          }

          if (imgRects && imgRects.length > 0) {
            // Compute union of image's visible rectangles
            let imgMinX = Infinity, imgMinY = Infinity, imgMaxX = -Infinity, imgMaxY = -Infinity;
            for (const rect of imgRects) {
              imgMinX = Math.min(imgMinX, rect.left);
              imgMinY = Math.min(imgMinY, rect.top);
              imgMaxX = Math.max(imgMaxX, rect.right);
              imgMaxY = Math.max(imgMaxY, rect.bottom);
            }

            // Convert image viewport coordinates to page coordinates
            imgMinX = imgMinX + scrollX;
            imgMinY = imgMinY + scrollY;
            imgMaxX = imgMaxX + scrollX;
            imgMaxY = imgMaxY + scrollY;

            // Expand link bounds to include image if image extends beyond link bounds
            if (imgMinX < minX) minX = imgMinX;
            if (imgMinY < minY) minY = imgMinY;
            if (imgMaxX > maxX) maxX = imgMaxX;
            if (imgMaxY > maxY) maxY = imgMaxY;
          }
        }
      } catch (e) {
        // Ignore errors when accessing image bounds
      }
    }

    const item = { minX, minY, maxX, maxY, element, zIndex, destination };
    this._rtreeItemsByElement.set(element, item);
    try { this._rtree.insert(item); } catch { /* ignore */ }
    this._destIndexAdd(element, destination);
    this._rtreeVersion++;
  }

  _rtreeRemoveElement(element) {
    if (!this._rtreeReady || !this._rtree) return;
    const item = this._rtreeItemsByElement.get(element);
    if (!item) return;
    this._rtreeItemsByElement.delete(element);
    try { this._rtree.remove(item); } catch { /* ignore */ }
    try { this._destIndexRemove(element, item.destination || ''); } catch { /* ignore */ }
    this._rtreeVersion++;
  }

  _rectIntersects(a, b) {
    if (!a || !b) return false;
    return !(a.maxX <= b.minX || a.minX >= b.maxX || a.maxY <= b.minY || a.minY >= b.maxY);
  }

  _rectExpandedIntersects(a, b, tolPx = 0) {
    const t = Math.max(0, Number(tolPx) || 0);
    const aa = {
      minX: a.minX - t,
      minY: a.minY - t,
      maxX: a.maxX + t,
      maxY: a.maxY + t
    };
    return this._rectIntersects(aa, b);
  }

  _unionRects(items) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const it of items) {
      if (!it) continue;
      minX = Math.min(minX, Number(it.minX));
      minY = Math.min(minY, Number(it.minY));
      maxX = Math.max(maxX, Number(it.maxX));
      maxY = Math.max(maxY, Number(it.maxY));
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
    if (maxX <= minX || maxY <= minY) return null;
    return { minX, minY, maxX, maxY };
  }

  _rectContainsPoint(rect, px, py) {
    return px >= rect.minX && px <= rect.maxX && py >= rect.minY && py <= rect.maxY;
  }

  _toViewportRect(pageRect) {
    if (!pageRect) return null;
    const { scrollX, scrollY } = this._getScrollXY();
    const left = pageRect.minX - scrollX;
    const top = pageRect.minY - scrollY;
    const width = pageRect.maxX - pageRect.minX;
    const height = pageRect.maxY - pageRect.minY;
    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height)) return null;
    if (width <= 0 || height <= 0) return null;
    return { left, top, width, height };
  }

  /**
   * Compute a "display rectangle" for an element that may be part of a cluster
   * of adjacent/overlapping links with the same destination.
   *
   * This is display-only: we still select a real DOM element for click behavior.
   *
   * Safety rule:
   * - Do NOT return a coalesced rect if it would intersect any RBush item that has
   *   a different destination (conservative: avoids obscuring other links).
   *
   * @param {HTMLElement} element
   * @param {object} [opts]
   * @param {number} [opts.tolerancePx] proximity threshold for clustering
   * @returns {{left:number,top:number,width:number,height:number}|null}
   */
  getDisplayRectForElement(element, opts = {}) {
    if (!this._rtreeEnabled()) return null;
    if (!element || element.nodeType !== 1) return null;

    const destination = this._getNormalizedDestination(element);
    if (!destination) return null;

    // Cache: same destination + same anchor element + same RBush version.
    if (this._displayRectCache &&
        this._displayRectCache.version === this._rtreeVersion &&
        this._displayRectCache.destination === destination &&
        this._displayRectCache.anchorEl === element) {
      // Convert cached page rect to viewport rect using current scroll offsets.
      return this._toViewportRect(this._displayRectCache.pageRect) || null;
    }

    const anchorItem = this._rtreeItemsByElement.get(element);
    if (!anchorItem) return null;

    const tol = Math.max(0, Number(opts.tolerancePx));
    const tolerancePx = Number.isFinite(tol) ? tol : 6;

    const set = this._destIndex.get(destination);
    if (!set || set.size < 2) {
      this._displayRectCache = { version: this._rtreeVersion, destination, anchorEl: element, pageRect: anchorItem };
      return this._toViewportRect(anchorItem);
    }

    // Build items list for this destination.
    const items = [];
    for (const el of set) {
      const it = this._rtreeItemsByElement.get(el);
      if (!it) continue;
      // Skip stale nodes proactively.
      try {
        if (el && el.isConnected === false) {
          this._rtreeRemoveElement(el);
          continue;
        }
      } catch { /* ignore */ }
      items.push(it);
    }
    if (items.length < 2) {
      this._displayRectCache = { version: this._rtreeVersion, destination, anchorEl: element, pageRect: anchorItem };
      return this._toViewportRect(anchorItem);
    }

    // Cluster by proximity/overlap; return the connected component that includes anchorItem.
    const visited = new Set();
    const queue = [anchorItem];
    visited.add(anchorItem);

    while (queue.length) {
      const cur = queue.pop();
      for (const other of items) {
        if (visited.has(other)) continue;
        if (this._rectExpandedIntersects(cur, other, tolerancePx) || this._rectExpandedIntersects(other, cur, tolerancePx)) {
          visited.add(other);
          queue.push(other);
        }
      }
    }

    // If there wasn't actually a multi-rect cluster, return the anchor rect.
    if (visited.size < 2) {
      this._displayRectCache = { version: this._rtreeVersion, destination, anchorEl: element, pageRect: anchorItem };
      return this._toViewportRect(anchorItem);
    }

    const component = Array.from(visited);
    const unionPageRect = this._unionRects(component);
    if (!unionPageRect) {
      this._displayRectCache = { version: this._rtreeVersion, destination, anchorEl: element, pageRect: anchorItem };
      return this._toViewportRect(anchorItem);
    }

    // Conservative conflict check: if union intersects any other-destination item, don't coalesce.
    try {
      const hits = this._rtree.search(unionPageRect) || [];
      for (const it of hits) {
        if (!it || !it.element) continue;
        if (component.includes(it)) continue;
        const otherDest = it.destination || '';
        // If the other item has no destination, ignore it (buttons, inputs, etc.).
        // Only enforce the "don't obscure" rule across destinations we can reason about.
        if (otherDest && otherDest !== destination) {
          this._displayRectCache = { version: this._rtreeVersion, destination, anchorEl: element, pageRect: anchorItem };
          return this._toViewportRect(anchorItem);
        }
      }
    } catch { /* ignore */ }

    this._displayRectCache = { version: this._rtreeVersion, destination, anchorEl: element, pageRect: unionPageRect };
    return this._toViewportRect(unionPageRect);
  }

  // =============================================================================
  // OCCLUSION NOTE
  // We intentionally do NOT maintain custom “negative regions” in RBush anymore.
  //
  // Generalized occlusion is handled by pairing RBush (fast bbox candidate generation)
  // with a single DOM hit-test (`elementFromPoint` / `deepElementFromPoint`) at the
  // cursor. We only accept candidates that are in the ancestor chain of the topmost
  // hit-tested element. This naturally respects third-party modals, menus, lightboxes,
  // backdrops, and any other overlays.
  // =============================================================================

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
    // Prefer `scrollX/scrollY` (fast path) and avoid touching layout-backed properties.
    const scrollX = (typeof window !== 'undefined' && typeof window.scrollX === 'number')
      ? window.scrollX
      : (window.pageXOffset || 0);
    const scrollY = (typeof window !== 'undefined' && typeof window.scrollY === 'number')
      ? window.scrollY
      : (window.pageYOffset || 0);
    
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

    // Return all positive elements (occlusion is handled by DOM hit-test gating at selection time).
    // Also opportunistically clean up stale items. Prefer `isConnected` over `document.contains()`.
    const out = [];
    for (const it of items) {
      const el = it && it.element;
      if (!el || el.nodeType !== 1) continue;
      try {
        if (el.isConnected === false) {
          this._rtreeRemoveElement(el);
          continue;
        }
      } catch { /* ignore */ }
      out.push(el);
    }

    // Show debug overlays for elements found via RBush tree query
    if (FEATURE_FLAGS.ENABLE_DEBUG_PANEL && out.length > 0) {
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
   * Pick the best interactive element from a set of RBush candidates, gated by the
   * topmost DOM hit-test element under the cursor (`underEl`).
   *
   * Rules:
   * - If `underEl` exists, ONLY accept candidates that are on the ancestor chain of `underEl`
   *   (shadow-host aware). If none match, return null (prevents “clicking through” overlays).
   * - If `underEl` is null/unknown, fall back to smallest-area candidate.
   *
   * @param {HTMLElement[]} candidates
   * @param {HTMLElement|null} underEl
   * @returns {HTMLElement|null}
   */
  pickBestInteractiveFromCandidates(candidates, underEl) {
    if (!candidates || !candidates.length) return null;

    // If we know what the browser considers topmost, never “click through” it.
    if (underEl && underEl.nodeType === 1) {
      // Avoid allocating a Set for the common case where candidate count is small.
      const useSet = candidates.length > 16;
      const candSet = useSet ? new Set(candidates) : null;
      let n = underEl;
      let depth = 0;
      while (n && depth++ < 20) {
        if (useSet) {
          if (candSet.has(n)) return n;
        } else {
          if (candidates.includes(n)) return n;
        }
        // Prefer parentElement, but handle shadow root hosts as well.
        try {
          const root = n.getRootNode && n.getRootNode();
          n = n.parentElement || (root instanceof ShadowRoot ? root.host : null);
        } catch {
          n = n.parentElement;
        }
      }
      // Topmost element is not inside any RBush candidate -> treat as occluded / not interactive.
      return null;
    }

    // No underEl: choose smallest area rect (best-effort).
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
    return best;
  }

  /**
   * MOUSE COORDINATE DETECTION: Best-effort mapping from cursor position to interactive element
   * Uses RBush spatial index as a fast pre-filter to find the most likely interactive element
   * at mouse coordinates, avoiding expensive DOM queries during mouse movement.
   *
   * Strategy:
   * - Query spatial index at point.
   * - Prefer a candidate that is `underEl` or an ancestor of `underEl` (shadow-host aware).
   * - If none match the `underEl` chain, return null (prevents “click through” on overlays).
   * - If `underEl` is null/unknown, fall back to smallest-area candidate (best-effort).
   */
  findBestInteractiveForUnderPoint({ x, y, underEl }) {
    if (!this._rtreeEnabled()) return null;

    const candidates = this.queryInteractiveAtPoint(x, y, 0);
    const best = this.pickBestInteractiveFromCandidates(candidates, underEl);
    return best || null;
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
    if (resolvedClickable && this.interactiveObserver && !this.visibleInteractiveElements.has(resolvedClickable)) {
      // Avoid redundant layout reads: compute rect once and reuse for visibility + caching.
      let rect = null;
      try { rect = resolvedClickable.getBoundingClientRect(); } catch { rect = null; }

      if (rect &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < window.innerHeight &&
          rect.left < window.innerWidth) {
        this.visibleInteractiveElements.add(resolvedClickable);
        try { this.interactiveObserver.observe(resolvedClickable); } catch { /* ignore */ }
        this.updateElementPositionCache(resolvedClickable, rect);
      }
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
    // Detach DOM hover listeners first (before we clear the observed set)
    try {
      // This handles both delegated + legacy per-element modes.
      this.setDomHoverListenersEnabled(false, null);
    } catch { /* ignore */ }
    try { this._domHoverAttachedElements.clear(); } catch { /* ignore */ }

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
    this._discoverWalker = null;
    this._discoverCursor = null;
    this._discoverDone = false;

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

    // Stop spatial culling
    this.stopSpatialCulling();

    // Clear RBush debug overlays
    this.clearRBushDebugOverlays();
  }
}