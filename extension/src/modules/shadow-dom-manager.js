/**
 * Shadow DOM support and patching
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

  patchAttachShadow() {
    if (this.originalAttachShadow) return; // Already patched

    const original = Element.prototype.attachShadow;
    this.originalAttachShadow = original;

    const styleManager = this.styleManager;
    const shadowRoots = this.shadowRoots;

    // Important: do NOT bind this function to the manager.
    // The receiver (`this`) must remain the element instance so original attachShadow works.
    Element.prototype.attachShadow = function attachShadowPatched(init) {
      // Call native attachShadow on the element instance.
      const root = original.call(this, init);

      // Only open shadow roots are accessible to content scripts.
      try {
        if (init && init.mode === 'open' && root) {
          styleManager.injectIntoShadowRoot(root);
          shadowRoots.add(root);
        }
      } catch (error) {
        console.warn('[KeyPilot] Failed to inject styles into shadow root:', error);
      }

      return root;
    };
  }

  processExistingShadowRoots() {
    const walker = document.createTreeWalker(
      document.documentElement,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );

    let node;
    while ((node = walker.nextNode())) {
      if (node.shadowRoot) {
        try {
          this.styleManager.injectIntoShadowRoot(node.shadowRoot);
          this.shadowRoots.add(node.shadowRoot);
        } catch (error) {
          console.warn('[KeyPilot] Failed to inject styles into existing shadow root:', error);
        }
      }
    }
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