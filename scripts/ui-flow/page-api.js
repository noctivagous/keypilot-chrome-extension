/**
 * Injected into the KeyPilot isolated world for UI-flow probes.
 * Walks open shadow roots the same way store-screenshot capture does.
 */
(function kpUiFlowApi() {
  function queryDeep(selector, root = document) {
    if (!selector || !root) return null;
    try {
      const direct = root.querySelector(selector);
      if (direct) return direct;
    } catch { /* invalid selector */ }
    const nodes = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const node of nodes) {
      if (node.shadowRoot) {
        const hit = queryDeep(selector, node.shadowRoot);
        if (hit) return hit;
      }
    }
    return null;
  }

  function queryDeepAll(selector, root = document, acc = []) {
    if (!selector || !root) return acc;
    try {
      const matches = root.querySelectorAll(selector);
      for (const node of matches) acc.push(node);
    } catch { /* invalid selector */ }
    const nodes = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const node of nodes) {
      if (node.shadowRoot) queryDeepAll(selector, node.shadowRoot, acc);
    }
    return acc;
  }

  function boxOf(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return null;
    const rect = el.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const style = el.ownerDocument?.defaultView?.getComputedStyle?.(el);
    const hidden = el.hidden
      || (el.hasAttribute && el.hasAttribute('hidden'))
      || style?.display === 'none'
      || style?.visibility === 'hidden';
    return {
      x: rect.x,
      y: rect.y,
      width,
      height,
      visible: !hidden && width > 0 && height > 0
    };
  }

  function probe(selectors) {
    return (selectors || []).map((selector) => {
      const el = queryDeep(selector);
      const box = boxOf(el);
      return {
        selector,
        found: Boolean(el),
        visible: Boolean(box?.visible)
      };
    });
  }

  function paintedTasks() {
    return queryDeepAll('[data-kp-onboarding-task-id]').map((row) => ({
      id: row.getAttribute('data-kp-onboarding-task-id'),
      done: row.getAttribute('data-kp-onboarding-task-done') === 'true',
      next: row.getAttribute('data-kp-onboarding-task-next') === 'true'
    }));
  }

  window.__KP_UI_FLOW = {
    ready() {
      return Boolean(window.__KeyPilotInstance);
    },
    queryDeep,
    box(selector) {
      return boxOf(queryDeep(selector));
    },
    probe,
    paintedTasks,
    overlayOpen() {
      const overlay = queryDeep('[data-kp-onboarding-overlay="true"]');
      const box = boxOf(overlay);
      return Boolean(box?.visible);
    },
    onboarding() {
      const ob = window.__KeyPilotOnboarding;
      return {
        slideId: ob?.progress?.slideId || null,
        completed: Boolean(ob?.progress?.completed),
        completedTaskIds: Array.isArray(ob?.progress?.completedTaskIds)
          ? ob.progress.completedTaskIds.map(String)
          : [],
        slideIds: Array.isArray(ob?.model?.slides)
          ? ob.model.slides.map((s) => s?.id).filter(Boolean)
          : []
      };
    },
    href: () => String(location.href || '')
  };
})();
