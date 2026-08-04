/**
 * Shared onboarding walkthrough primitives.
 *
 * Zero imports so this file can be:
 * - imported by ESM modules (panel / manager)
 * - stamped into early-inject.js by build.js (export keywords stripped)
 *
 * Keep DOM construction and progress shape here so early-inject and the
 * bundled content script cannot drift.
 */

// ── Storage / progress ──────────────────────────────────────────────────────

export const ONBOARDING_STORAGE_KEYS = {
  ACTIVE: 'keypilot_onboarding_active',
  PROGRESS: 'keypilot_onboarding_progress'
};

export const ONBOARDING_FIRST_SLIDE_ID = 'basic_navigation';
export const ONBOARDING_PANEL_CLASS = 'kp-onboarding-panel';
export const ONBOARDING_DEFAULT_TITLE = 'Welcome to KeyPilot';
export const ONBOARDING_REOPEN_TIP = 'Tip: Press Alt + / to re-open this walkthrough later.';

/** Default z-index fallback if caller does not pass Z_INDEX.ONBOARDING_PANEL. */
export const ONBOARDING_PANEL_Z_FALLBACK = 2147483026;

/** Layout: control strip stays at top; walkthrough sits just below it. */
export const ONBOARDING_DEFAULT_LEFT_PX = 16;
export const ONBOARDING_DEFAULT_TOP_PX = 16;
/** Prefixed names avoid clashing with early-inject locals when this file is stamped. */
export const ONBOARDING_STRIP_TOP_PX = 16;
export const ONBOARDING_STRIP_HEIGHT_PX = 28;
export const ONBOARDING_BELOW_STRIP_GAP_PX = 8;

/**
 * Preferred top offset for the walkthrough so the control strip stays visible above it.
 * @returns {number}
 */
export function getOnboardingTopBelowControlStrip() {
  try {
    const strip = document.querySelector('.kp-control-strip');
    if (strip && strip.isConnected) {
      const cs = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(strip) : null;
      const hidden =
        strip.hidden === true ||
        strip.getAttribute('hidden') !== null ||
        (strip.style && strip.style.display === 'none') ||
        (cs && (cs.display === 'none' || cs.visibility === 'hidden'));
      if (!hidden) {
        const rect = strip.getBoundingClientRect();
        if (rect && rect.height > 0) {
          return Math.max(
            ONBOARDING_DEFAULT_TOP_PX,
            Math.round(rect.bottom + ONBOARDING_BELOW_STRIP_GAP_PX)
          );
        }
      }
    }
  } catch { /* ignore */ }
  // Fallback assuming strip is at its default top-left perch.
  return ONBOARDING_STRIP_TOP_PX + ONBOARDING_STRIP_HEIGHT_PX + ONBOARDING_BELOW_STRIP_GAP_PX;
}

/**
 * @param {HTMLElement|null} root
 */
export function positionOnboardingBelowControlStrip(root) {
  if (!root) return;
  try {
    root.style.top = `${getOnboardingTopBelowControlStrip()}px`;
  } catch { /* ignore */ }
}

/**
 * @typedef {Object} OnboardingProgress
 * @property {string|null} slideId
 * @property {string[]} completedTaskIds
 * @property {string[]} onEnterDoneSlideIds
 * @property {boolean} completed
 * @property {number} timestamp
 */

/**
 * @param {string|null} [slideId]
 * @returns {OnboardingProgress}
 */
export function createEmptyProgress(slideId = null) {
  return {
    slideId: slideId || null,
    completedTaskIds: [],
    onEnterDoneSlideIds: [],
    completed: false,
    timestamp: Date.now()
  };
}

/**
 * @param {any} progress
 * @returns {OnboardingProgress}
 */
export function cloneProgress(progress) {
  const p = progress && typeof progress === 'object' ? progress : {};
  return {
    slideId: typeof p.slideId === 'string' ? p.slideId : null,
    completedTaskIds: Array.isArray(p.completedTaskIds) ? p.completedTaskIds.map(String) : [],
    onEnterDoneSlideIds: Array.isArray(p.onEnterDoneSlideIds) ? p.onEnterDoneSlideIds.map(String) : [],
    completed: !!p.completed,
    timestamp: typeof p.timestamp === 'number' ? p.timestamp : Date.now()
  };
}

/**
 * @param {string[]} a
 * @param {string[]} b
 */
export function arraysEqualString(a, b) {
  const aa = Array.isArray(a) ? a : [];
  const bb = Array.isArray(b) ? b : [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    if (String(aa[i]) !== String(bb[i])) return false;
  }
  return true;
}

/**
 * @param {OnboardingProgress|any} a
 * @param {OnboardingProgress|any} b
 */
export function progressEqual(a, b) {
  const aa = cloneProgress(a);
  const bb = cloneProgress(b);
  return (
    aa.slideId === bb.slideId &&
    aa.completed === bb.completed &&
    aa.timestamp === bb.timestamp &&
    arraysEqualString(aa.completedTaskIds, bb.completedTaskIds) &&
    arraysEqualString(aa.onEnterDoneSlideIds, bb.onEnterDoneSlideIds)
  );
}

/**
 * @param {{tasks?: Array<{id?: string}>}|null|undefined} slide
 * @param {Set<string>|string[]} completedTaskIds
 */
export function isSlideComplete(slide, completedTaskIds) {
  const tasks = slide?.tasks || [];
  if (!tasks.length) return true;
  const set = completedTaskIds instanceof Set
    ? completedTaskIds
    : new Set(Array.isArray(completedTaskIds) ? completedTaskIds.map(String) : []);
  for (const t of tasks) {
    if (!t?.id) continue;
    if (!set.has(String(t.id))) return false;
  }
  return true;
}

// ── Text helpers ────────────────────────────────────────────────────────────

/**
 * Convert backtick-wrapped segments into <kbd> nodes (no innerHTML).
 * Safer on hostile pages than parsing HTML strings.
 * @param {ParentNode} el
 * @param {string} text
 */
export function renderKeyboardKeysInto(el, text) {
  if (!el) return;
  try { el.textContent = ''; } catch { /* ignore */ }
  const parts = String(text || '').split(/`/);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    if (i % 2 === 1) {
      const k = document.createElement('kbd');
      k.textContent = part;
      el.appendChild(k);
    } else {
      el.appendChild(document.createTextNode(part));
    }
  }
}

/**
 * @param {string} text
 * @returns {string} HTML with <kbd> (for callers that intentionally use innerHTML)
 */
export function formatKeyboardKeysHtml(text) {
  return String(text || '').replace(/`([^`]+)`/g, '<kbd>$1</kbd>');
}

// ── CSS ─────────────────────────────────────────────────────────────────────

/**
 * @param {{includeViewTransitions?: boolean}} [opts]
 * @returns {string}
 */
export function getOnboardingPanelCss(opts = {}) {
  const includeVt = opts.includeViewTransitions !== false;
  let css =
    `.${ONBOARDING_PANEL_CLASS} kbd {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 11px;
        padding: 1px 6px;
        border: 1px solid #3a3a3a;
        border-bottom-color: #2a2a2a;
        border-radius: 4px;
        background: linear-gradient(180deg, #2b2b2b 0%, #1a1a1a 100%);
        color: #f1f1f1;
      }`;
  if (includeVt) {
    css += `
      @keyframes kpOnboardingSlideOut {
        to { transform: translateX(calc(var(--kp-onboarding-slide-dir, 1) * -100%)); opacity: 0.0; }
      }
      @keyframes kpOnboardingSlideIn {
        from { transform: translateX(calc(var(--kp-onboarding-slide-dir, 1) * 100%)); opacity: 0.0; }
        to { transform: translateX(0%); opacity: 1.0; }
      }
      ::view-transition-old(kp-onboarding-slide-surface) {
        animation: kpOnboardingSlideOut 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }
      ::view-transition-new(kp-onboarding-slide-surface) {
        animation: kpOnboardingSlideIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }`;
  }
  return css;
}

// ── Shell DOM ───────────────────────────────────────────────────────────────

function assignStyle(el, styles) {
  if (!el || !styles) return;
  try { Object.assign(el.style, styles); } catch { /* ignore */ }
}

function mkIconBtn(doc, label, dataAttr, aria) {
  const b = doc.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.setAttribute(dataAttr, 'true');
  if (aria) b.setAttribute('aria-label', aria);
  assignStyle(b, {
    width: '28px',
    height: '28px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.95)',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: '26px',
    padding: '0',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  });
  return b;
}

/**
 * Build the floating walkthrough panel shell (header / body / footer).
 * Does not attach event listeners — callers wire close/prev/next/reset.
 *
 * @param {Document} doc
 * @param {Object} [opts]
 * @param {number|string} [opts.zIndex]
 * @param {boolean} [opts.early] Mark as early-inject shell for adoption
 * @param {boolean} [opts.initiallyHidden]
 * @param {boolean} [opts.includeViewTransitions]
 * @param {(el: HTMLElement) => void} [opts.applyTheme]
 * @param {string} [opts.title]
 * @param {string} [opts.stepText]
 * @param {boolean} [opts.navDisabled] Disable prev/next (early shell until wired)
 * @returns {{
 *   root: HTMLElement,
 *   body: HTMLElement,
 *   slideSurface: HTMLElement,
 *   titleEl: HTMLElement,
 *   stepEl: HTMLElement,
 *   prevBtn: HTMLButtonElement,
 *   nextBtn: HTMLButtonElement,
 *   resetBtn: HTMLButtonElement,
 *   closeBtn: HTMLButtonElement
 * }}
 */
export function createOnboardingShell(doc, opts = {}) {
  const zIndex = opts.zIndex != null ? opts.zIndex : ONBOARDING_PANEL_Z_FALLBACK;
  const initiallyHidden = opts.initiallyHidden !== false;
  const includeVt = opts.includeViewTransitions !== false;

  const root = doc.createElement('div');
  root.className = ONBOARDING_PANEL_CLASS;
  root.hidden = initiallyHidden;
  if (opts.early) root.dataset.kpEarlyOnboarding = 'true';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'KeyPilot onboarding walkthrough');

  // When initially hidden, use display:none + pointer-events:none.
  // Some pages override [hidden]; never put display:flex on a hidden shell.
  assignStyle(root, {
    position: 'fixed',
    left: `${ONBOARDING_DEFAULT_LEFT_PX}px`,
    // Prefer sitting below the control strip so the strip is not pushed down.
    top: `${getOnboardingTopBelowControlStrip()}px`,
    width: '360px',
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: 'calc(100vh - 24px)',
    display: initiallyHidden ? 'none' : 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: String(zIndex),
    background: 'rgba(18, 18, 18, 0.94)',
    color: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '14px',
    boxShadow: '0 12px 34px rgba(0,0,0,0.45)',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    pointerEvents: initiallyHidden ? 'none' : 'auto'
  });

  try { opts.applyTheme?.(root); } catch { /* ignore */ }

  const style = doc.createElement('style');
  style.textContent = getOnboardingPanelCss({ includeViewTransitions: includeVt });
  root.appendChild(style);

  const header = doc.createElement('div');
  assignStyle(header, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '10px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.10)'
  });

  const titleWrap = doc.createElement('div');
  assignStyle(titleWrap, {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: '0'
  });

  const titleEl = doc.createElement('div');
  titleEl.textContent = String(opts.title || ONBOARDING_DEFAULT_TITLE);
  titleEl.setAttribute('data-kp-onboarding-title', 'true');
  assignStyle(titleEl, {
    fontSize: '13px',
    fontWeight: '800',
    letterSpacing: '0.2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  });

  const stepEl = doc.createElement('div');
  stepEl.textContent = String(opts.stepText || '1 / 1');
  stepEl.setAttribute('data-kp-onboarding-step', 'true');
  assignStyle(stepEl, {
    fontSize: '12px',
    fontWeight: '600',
    opacity: '0.75'
  });

  // Title wrap only gets the title; step lives in the footer stepWrap
  // (appendChild moves nodes — keep a single step element).
  titleWrap.appendChild(titleEl);

  const navWrap = doc.createElement('div');
  assignStyle(navWrap, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    flex: '0 0 auto'
  });

  const stepWrap = doc.createElement('div');
  assignStyle(stepWrap, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px'
  });

  const prevBtn = mkIconBtn(doc, '←', 'data-kp-onboarding-prev', 'Previous slide');
  const nextBtn = mkIconBtn(doc, '→', 'data-kp-onboarding-next', 'Next slide');
  if (opts.navDisabled) {
    prevBtn.disabled = true;
    nextBtn.disabled = true;
  }

  stepWrap.appendChild(prevBtn);
  stepWrap.appendChild(stepEl);
  stepWrap.appendChild(nextBtn);

  const resetBtn = doc.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = 'Reset';
  resetBtn.setAttribute('data-kp-onboarding-reset', 'true');
  assignStyle(resetBtn, {
    height: '28px',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.92)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    padding: '0 10px',
    lineHeight: '26px'
  });

  const closeBtn = doc.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close onboarding walkthrough');
  closeBtn.setAttribute('data-kp-onboarding-close', 'true');
  assignStyle(closeBtn, {
    width: '30px',
    height: '30px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.95)',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: '28px',
    padding: '0',
    flex: '0 0 auto'
  });

  navWrap.appendChild(closeBtn);
  header.appendChild(titleWrap);
  header.appendChild(navWrap);

  const body = doc.createElement('div');
  body.setAttribute('data-kp-onboarding-body', 'true');
  assignStyle(body, {
    flex: '1',
    overflowY: 'auto',
    minHeight: '0',
    position: 'relative'
  });

  const slideSurface = doc.createElement('div');
  slideSurface.setAttribute('data-kp-onboarding-slide-surface', 'true');
  assignStyle(slideSurface, { padding: '12px' });
  body.appendChild(slideSurface);

  const footer = doc.createElement('div');
  assignStyle(footer, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '10px 12px',
    borderTop: '1px solid rgba(255,255,255,0.10)'
  });
  footer.appendChild(stepWrap);
  footer.appendChild(resetBtn);

  root.appendChild(header);
  root.appendChild(body);
  root.appendChild(footer);

  return {
    root,
    body,
    slideSurface,
    titleEl,
    stepEl,
    prevBtn,
    nextBtn,
    resetBtn,
    closeBtn
  };
}

/**
 * Query shell refs from an existing panel root (early-inject adoption).
 * @param {Element|null} root
 */
export function queryOnboardingShellRefs(root) {
  if (!root) return null;
  const body =
    root.querySelector('[data-kp-onboarding-body="true"]') ||
    root.querySelector(':scope > div[data-kp-onboarding-body]');
  if (!body) return null;
  let slideSurface = body.querySelector('[data-kp-onboarding-slide-surface="true"]');
  if (!slideSurface) {
    slideSurface = document.createElement('div');
    slideSurface.setAttribute('data-kp-onboarding-slide-surface', 'true');
    assignStyle(slideSurface, { padding: '12px' });
    try { body.appendChild(slideSurface); } catch { /* ignore */ }
  }
  return {
    root,
    body,
    slideSurface,
    titleEl: root.querySelector('[data-kp-onboarding-title="true"]'),
    stepEl: root.querySelector('[data-kp-onboarding-step="true"]'),
    prevBtn: root.querySelector('button[data-kp-onboarding-prev="true"]'),
    nextBtn: root.querySelector('button[data-kp-onboarding-next="true"]'),
    resetBtn: root.querySelector('button[data-kp-onboarding-reset="true"]'),
    closeBtn: root.querySelector('button[data-kp-onboarding-close="true"]')
  };
}

/**
 * Show/hide panel in a way that survives hostile [hidden] CSS overrides.
 * @param {HTMLElement|null} root
 * @param {boolean} visible
 */
export function setOnboardingPanelVisible(root, visible) {
  if (!root) return;
  const show = !!visible;
  try {
    root.hidden = !show;
    root.style.display = show ? 'flex' : 'none';
    root.style.pointerEvents = show ? 'auto' : 'none';
    if (show) positionOnboardingBelowControlStrip(root);
  } catch { /* ignore */ }
}

// ── Slide content ───────────────────────────────────────────────────────────

function applyTaskRowInteractive(row, { uncheckable, onTaskRowClick }) {
  if (!row) return;
  try {
    if (uncheckable) {
      row.setAttribute('data-kp-onboarding-uncheckable', 'true');
      row.style.cursor = 'pointer';
      row.title = 'Click to uncheck (undo last completed step)';
      row.setAttribute('role', 'button');
      row.tabIndex = 0;
    } else {
      row.removeAttribute('data-kp-onboarding-uncheckable');
      row.style.cursor = '';
      row.removeAttribute('title');
      row.removeAttribute('role');
      row.removeAttribute('tabindex');
    }
  } catch { /* ignore */ }

  try {
    if (row._kpOnboardingTaskClick) {
      row.removeEventListener('click', row._kpOnboardingTaskClick);
      row._kpOnboardingTaskClick = null;
    }
  } catch { /* ignore */ }
  if (uncheckable && typeof onTaskRowClick === 'function') {
    row._kpOnboardingTaskClick = onTaskRowClick;
    try { row.addEventListener('click', onTaskRowClick); } catch { /* ignore */ }
  }
}

function applyTaskRowVisual(row, task, done, opts = {}) {
  if (!row) return;
  assignStyle(row, {
    background: done ? 'rgba(46, 204, 113, 0.10)' : 'rgba(255,255,255,0.04)'
  });

  const box =
    row.querySelector(':scope > div[aria-hidden="true"]') ||
    row.firstElementChild;
  const textEl =
    (box && box.nextElementSibling) ||
    row.querySelector(':scope > div:last-child');

  if (box) {
    assignStyle(box, {
      border: done ? '1px solid rgba(46, 204, 113, 0.9)' : '1px solid rgba(255,255,255,0.22)',
      background: done ? 'rgba(46, 204, 113, 0.85)' : 'transparent',
      boxShadow: done ? '0 0 0 2px rgba(46, 204, 113, 0.18)' : 'none'
    });
    try {
      const existingCheck = box.querySelector(':scope > div');
      if (done) {
        if (!existingCheck) {
          const check = document.createElement('div');
          check.textContent = '✓';
          assignStyle(check, {
            position: 'absolute',
            inset: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: '800',
            color: '#0b1410'
          });
          box.appendChild(check);
        }
      } else if (existingCheck) {
        box.removeChild(existingCheck);
      }
    } catch { /* ignore */ }
  }

  if (textEl) {
    try {
      renderKeyboardKeysInto(textEl, task.label || task.id);
      assignStyle(textEl, {
        color: done ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.88)',
        opacity: done ? '0.95' : '1'
      });
    } catch { /* ignore */ }
  }

  applyTaskRowInteractive(row, {
    uncheckable: !!(done && opts.uncheckable),
    onTaskRowClick: opts.onTaskRowClick
  });
}

function createTaskRow(doc, task, done, opts = {}) {
  const row = doc.createElement('div');
  row.setAttribute('data-kp-onboarding-task-id', task.id);
  assignStyle(row, {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.10)',
    background: done ? 'rgba(46, 204, 113, 0.10)' : 'rgba(255,255,255,0.04)'
  });

  const box = doc.createElement('div');
  box.setAttribute('aria-hidden', 'true');
  assignStyle(box, {
    width: '18px',
    height: '18px',
    borderRadius: '6px',
    border: done ? '1px solid rgba(46, 204, 113, 0.9)' : '1px solid rgba(255,255,255,0.22)',
    background: done ? 'rgba(46, 204, 113, 0.85)' : 'transparent',
    boxShadow: done ? '0 0 0 2px rgba(46, 204, 113, 0.18)' : 'none',
    flex: '0 0 auto',
    marginTop: '1px',
    position: 'relative'
  });

  if (done) {
    const check = doc.createElement('div');
    check.textContent = '✓';
    assignStyle(check, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '13px',
      fontWeight: '800',
      color: '#0b1410'
    });
    box.appendChild(check);
  }

  const text = doc.createElement('div');
  renderKeyboardKeysInto(text, task.label || task.id);
  assignStyle(text, {
    fontSize: '13px',
    lineHeight: '1.35',
    color: done ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.88)',
    opacity: done ? '0.95' : '1'
  });

  row.appendChild(box);
  row.appendChild(text);
  applyTaskRowInteractive(row, {
    uncheckable: !!(done && opts.uncheckable),
    onTaskRowClick: opts.onTaskRowClick
  });
  return row;
}

/**
 * Render or update slide checklist into the slide surface.
 *
 * @param {HTMLElement} surface
 * @param {Object} params
 * @param {Array<{id:string, label?:string}>} [params.tasks]
 * @param {Set<string>|string[]} [params.completedTaskIds]
 * @param {string|null} [params.lastCompletedTaskId]
 * @param {(e:Event)=>void} [params.onTaskRowClick]
 * @param {string} [params.bodyText]
 * @param {boolean} [params.forceRebuild]
 * @param {boolean} [params.showTip]
 * @param {Document} [params.doc]
 */
export function renderOnboardingSlideSurface(surface, params = {}) {
  if (!surface) return;
  const doc = params.doc || surface.ownerDocument || document;
  const tasks = (params.tasks || []).filter((t) => t && t.id);
  const completedSet = params.completedTaskIds instanceof Set
    ? params.completedTaskIds
    : new Set(Array.isArray(params.completedTaskIds) ? params.completedTaskIds.map(String) : []);
  const lastCompletedTaskId = params.lastCompletedTaskId != null ? String(params.lastCompletedTaskId) : '';
  const onTaskRowClick = typeof params.onTaskRowClick === 'function' ? params.onTaskRowClick : null;
  const bodyTextStr = String(params.bodyText || '').trim();
  const forceRebuild = !!params.forceRebuild;
  const showTip = params.showTip !== false;

  const existingRows = surface.querySelectorAll('[data-kp-onboarding-task-id]');
  const existingBody = surface.querySelector('[data-kp-onboarding-body-text="true"]');

  const canUpdateInPlace =
    !forceRebuild &&
    existingRows.length === tasks.length &&
    tasks.every((t, i) => existingRows[i]?.getAttribute('data-kp-onboarding-task-id') === t.id);

  // Body text (independent of task update mode when possible)
  try {
    if (bodyTextStr) {
      if (existingBody && canUpdateInPlace) {
        existingBody.textContent = '';
        // Preserve line breaks without full HTML parse
        const lines = bodyTextStr.split('\n');
        lines.forEach((line, i) => {
          if (i > 0) existingBody.appendChild(doc.createElement('br'));
          renderKeyboardKeysInto(
            (() => { const s = doc.createElement('span'); existingBody.appendChild(s); return s; })(),
            line
          );
        });
        existingBody.style.display = 'block';
        existingBody.style.marginBottom = tasks.length ? '12px' : '0px';
      }
    } else if (existingBody && canUpdateInPlace) {
      existingBody.style.display = 'none';
      existingBody.textContent = '';
    }
  } catch { /* ignore */ }

  if (canUpdateInPlace) {
    tasks.forEach((task, i) => {
      const done = completedSet.has(task.id);
      applyTaskRowVisual(existingRows[i], task, done, {
        uncheckable: done && task.id === lastCompletedTaskId,
        onTaskRowClick
      });
    });
    return;
  }

  // Full rebuild
  while (surface.firstChild) surface.removeChild(surface.firstChild);

  if (bodyTextStr) {
    const body = doc.createElement('div');
    body.setAttribute('data-kp-onboarding-body-text', 'true');
    const lines = bodyTextStr.split('\n');
    lines.forEach((line, i) => {
      if (i > 0) body.appendChild(doc.createElement('br'));
      const span = doc.createElement('span');
      renderKeyboardKeysInto(span, line);
      body.appendChild(span);
    });
    assignStyle(body, {
      fontSize: '13px',
      lineHeight: '1.45',
      color: 'rgba(255,255,255,0.90)',
      marginBottom: tasks.length ? '12px' : '0px',
      opacity: '0.95'
    });
    surface.appendChild(body);
  }

  const list = doc.createElement('div');
  assignStyle(list, {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  });

  for (const task of tasks) {
    const done = completedSet.has(task.id);
    list.appendChild(createTaskRow(doc, task, done, {
      uncheckable: done && task.id === lastCompletedTaskId,
      onTaskRowClick
    }));
  }
  surface.appendChild(list);

  if (showTip) {
    const tip = doc.createElement('div');
    tip.setAttribute('data-kp-onboarding-tip', 'true');
    tip.textContent = ONBOARDING_REOPEN_TIP;
    assignStyle(tip, {
      marginTop: '10px',
      fontSize: '12px',
      opacity: '0.78',
      lineHeight: '1.35',
      color: 'rgba(255,255,255,0.85)'
    });
    surface.appendChild(tip);
  }
}

/**
 * Update chrome (title, step counter, nav disabled state).
 * @param {Object} refs
 * @param {Object} params
 */
export function updateOnboardingChrome(refs, params = {}) {
  if (!refs) return;
  const idx = Number(params.slideIndex) || 0;
  const total = Math.max(1, Number(params.slideCount) || 1);
  try {
    if (refs.titleEl) refs.titleEl.textContent = String(params.title || ONBOARDING_DEFAULT_TITLE);
  } catch { /* ignore */ }
  try {
    if (refs.stepEl) refs.stepEl.textContent = `${idx + 1} / ${total}`;
  } catch { /* ignore */ }
  try {
    if (refs.root && params.slideId != null) {
      refs.root.dataset.kpOnboardingSlideId = String(params.slideId || '');
    }
  } catch { /* ignore */ }
  try {
    if (refs.prevBtn) refs.prevBtn.disabled = idx <= 0;
  } catch { /* ignore */ }
  try {
    if (refs.nextBtn) refs.nextBtn.disabled = idx >= total - 1;
  } catch { /* ignore */ }
}

// ── Overlay ─────────────────────────────────────────────────────────────────

/**
 * Ensure modal overlay exists inside the scrollable body host.
 * @param {HTMLElement} bodyHost
 * @param {Document} [doc]
 * @returns {{
 *   overlayEl: HTMLElement,
 *   titleEl: HTMLElement,
 *   msgEl: HTMLElement,
 *   primaryBtn: HTMLButtonElement,
 *   secondaryBtn: HTMLButtonElement
 * }|null}
 */
export function ensureOnboardingOverlay(bodyHost, doc) {
  if (!bodyHost) return null;
  const d = doc || bodyHost.ownerDocument || document;

  const existing = bodyHost.querySelector('[data-kp-onboarding-overlay="true"]');
  if (existing) {
    return {
      overlayEl: existing,
      titleEl: existing.querySelector('[data-kp-onboarding-overlay-title="true"]'),
      msgEl: existing.querySelector('[data-kp-onboarding-overlay-message="true"]'),
      primaryBtn: existing.querySelector('button[data-kp-onboarding-overlay-primary="true"]'),
      secondaryBtn: existing.querySelector('button[data-kp-onboarding-overlay-secondary="true"]')
    };
  }

  const overlay = d.createElement('div');
  overlay.setAttribute('data-kp-onboarding-overlay', 'true');
  overlay.hidden = true;
  assignStyle(overlay, {
    position: 'absolute',
    inset: '0',
    padding: '14px',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.42)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    zIndex: '5',
    pointerEvents: 'none'
  });

  const card = d.createElement('div');
  assignStyle(card, {
    width: '100%',
    maxWidth: '320px',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(18, 18, 18, 0.78)',
    boxShadow: '0 16px 44px rgba(0,0,0,0.55)',
    padding: '14px 14px 12px 14px'
  });

  const titleEl = d.createElement('div');
  titleEl.setAttribute('data-kp-onboarding-overlay-title', 'true');
  titleEl.textContent = 'Nice!';
  assignStyle(titleEl, {
    fontSize: '14px',
    fontWeight: '900',
    letterSpacing: '0.2px',
    marginBottom: '8px'
  });

  const msgEl = d.createElement('div');
  msgEl.setAttribute('data-kp-onboarding-overlay-message', 'true');
  msgEl.textContent = '';
  assignStyle(msgEl, {
    fontSize: '13px',
    lineHeight: '1.35',
    color: 'rgba(255,255,255,0.90)',
    whiteSpace: 'pre-wrap'
  });

  const btnRow = d.createElement('div');
  assignStyle(btnRow, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '12px'
  });

  const mkBtn = (variant) => {
    const b = d.createElement('button');
    b.type = 'button';
    assignStyle(b, {
      height: '30px',
      borderRadius: '999px',
      border: variant === 'primary' ? '1px solid rgba(46, 204, 113, 0.55)' : '1px solid rgba(255,255,255,0.20)',
      background: variant === 'primary' ? 'rgba(46, 204, 113, 0.18)' : 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.92)',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '800',
      padding: '0 12px',
      lineHeight: '28px'
    });
    return b;
  };

  const secondaryBtn = mkBtn('secondary');
  secondaryBtn.hidden = true;
  secondaryBtn.textContent = '';
  secondaryBtn.setAttribute('data-kp-onboarding-overlay-secondary', 'true');

  const primaryBtn = mkBtn('primary');
  primaryBtn.textContent = 'OK';
  primaryBtn.setAttribute('data-kp-onboarding-overlay-primary', 'true');

  btnRow.appendChild(secondaryBtn);
  btnRow.appendChild(primaryBtn);
  card.appendChild(titleEl);
  card.appendChild(msgEl);
  card.appendChild(btnRow);
  overlay.appendChild(card);
  bodyHost.appendChild(overlay);

  return { overlayEl: overlay, titleEl, msgEl, primaryBtn, secondaryBtn };
}

/**
 * @param {HTMLElement|null} overlayEl
 * @param {boolean} open
 * @param {HTMLElement|null} [root]
 */
export function setOnboardingOverlayOpen(overlayEl, open, root = null) {
  if (!overlayEl) return;
  try {
    overlayEl.hidden = !open;
    overlayEl.style.display = open ? 'flex' : 'none';
    overlayEl.style.pointerEvents = open ? 'auto' : 'none';
    if (root) {
      if (open) root.dataset.kpOnboardingOverlayOpen = 'true';
      else delete root.dataset.kpOnboardingOverlayOpen;
    }
  } catch { /* ignore */ }
}
