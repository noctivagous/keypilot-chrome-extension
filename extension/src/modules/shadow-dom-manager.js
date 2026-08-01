/**
 * Shadow DOM support and patching
 *
 * Style injection strategy (cheap + correct):
 * 1. Pre-warm: patch attachShadow so new open roots get styles at creation.
 * 2. Pre-warm: inject into open roots already present in the *light* DOM at setup
 *    (shallow — nested roots inside those shadows are NOT eagerly walked).
 * 3. Lazy (primary correctness): StyleManager.ensureStylesForNode() injects into
 *    the owning open ShadowRoot on first hover/focus styling. No MutationObserver;
 *    infinite-scroll / SPA content is covered when the user first targets it.
 */
export class ShadowDOMManager {
  constructor(styleManager) {
    this.styleManager = styleManager;
    this.shadowRoots = new Set();
    this.originalAttachShadow = null;
  }

  setup() {
    this.patchAttachShadow();
    this.processExistingShadowRoots();
  }

  /**
   * Track a shadow root we've injected (or intend to use) for optional IO discovery.
   * @param {ShadowRoot} root
   */
  trackShadowRoot(root) {
    if (root) {
      try { this.shadowRoots.add(root); } catch { /* ignore */ }
    }
  }

  patchAttachShadow() {
    if (this.originalAttachShadow) return; // Already patched

    const original = Element.prototype.attachShadow;
    this.originalAttachShadow = original;

    const styleManager = this.styleManager;
    const manager = this;

    // Important: do NOT bind this function to the manager.
    // The receiver (`this`) must remain the element instance so original attachShadow works.
    Element.prototype.attachShadow = function attachShadowPatched(init) {
      // Call native attachShadow on the element instance.
      const root = original.call(this, init);

      // Only open shadow roots are accessible to content scripts.
      try {
        if (init && init.mode === 'open' && root) {
          // Optional pre-warm: O(1) per attach. Nested roots created after setup
          // get styles without waiting for first hover.
          styleManager.injectIntoShadowRoot(root);
          manager.trackShadowRoot(root);
        }
      } catch (error) {
        console.warn('[KeyPilot] Failed to inject styles into shadow root:', error);
      }

      return root;
    };
  }

  /**
   * Pre-warm open shadow roots already in the tree, including nested roots
   * (archive.org: app-root → ia-topnav → primary-nav → media-button → …).
   * Lazy ensureStylesForNode remains the wipe-resistant correctness path.
   */
  processExistingShadowRoots() {
    const injectTree = (root) => {
      if (!root) return;
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT,
        null,
        false
      );

      let node;
      while ((node = walker.nextNode())) {
        if (!node.shadowRoot) continue;
        try {
          this.styleManager.injectIntoShadowRoot(node.shadowRoot);
          this.trackShadowRoot(node.shadowRoot);
          // Recurse into this open root so nested hosts get CSS before first hover.
          injectTree(node.shadowRoot);
        } catch (error) {
          console.warn('[KeyPilot] Failed to inject styles into existing shadow root:', error);
        }
      }
    };

    injectTree(document.documentElement);
  }

  cleanup() {
    // Restore original attachShadow
    if (this.originalAttachShadow) {
      Element.prototype.attachShadow = this.originalAttachShadow;
      this.originalAttachShadow = null;
    }
    
    this.shadowRoots.clear();
  }
}