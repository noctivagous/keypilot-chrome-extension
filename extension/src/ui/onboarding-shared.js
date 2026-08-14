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
export const ONBOARDING_REOPEN_TIP = 'Tip: Press Alt + T to re-open this walkthrough later.';

/** Default z-index fallback if caller does not pass Z_INDEX.ONBOARDING_PANEL. */
export const ONBOARDING_PANEL_Z_FALLBACK = 2147483026;

/** Layout: control strip stays at top; walkthrough sits just below it. */
export const ONBOARDING_DEFAULT_LEFT_PX = 16;
export const ONBOARDING_DEFAULT_TOP_PX = 16;

/**
 * Lighter metal chrome for the walkthrough panel
 * (cool mid-gray bevel — lighter than NCT dark panels; no grain texture).
 */
const ONBOARDING_METAL_SPECULAR =
  'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.08) 28%, transparent 55%)';
export const ONBOARDING_METAL = {
  fg: '#1c1c1c',
  fgDim: 'rgba(28,28,28,0.72)',
  fgMute: 'rgba(28,28,28,0.55)',
  panelBg:
    `${ONBOARDING_METAL_SPECULAR}, ` +
    'linear-gradient(180deg, #9a9a9a 0%, #838383 48%, #707070 100%)',
  titlebarBg:
    `${ONBOARDING_METAL_SPECULAR}, ` +
    'linear-gradient(180deg, #b0b0b0 0%, #929292 45%, #787878 100%)',
  footerBg: 'linear-gradient(180deg, #8a8a8a 0%, #767676 100%)',
  btnBg: 'linear-gradient(180deg, #c2c2c2 0%, #9e9e9e 50%, #868686 100%)',
  panelBorder: '1px solid rgba(42,52,62,0.92)',
  panelShadow:
    '0 0 0 1px rgba(255,255,255,0.28) inset, ' +
    '0 0 0 1px rgba(190,190,190,0.48), ' +
    '0 0 10px rgba(255,255,255,0.12), ' +
    '0 16px 40px rgba(0,0,0,0.45)',
  titlebarBorder: '1px solid #4a4a4a',
  titlebarShadow: '0 1px 0 rgba(255,255,255,0.35)',
  footerBorder: '1px solid rgba(0,0,0,0.28)',
  btnBorder: '1px solid #4a4a4a',
  btnShadow: '0 1px 0 rgba(255,255,255,0.40) inset, 0 -1px 0 rgba(0,0,0,0.18) inset',
  rowBg: 'rgba(255,255,255,0.18)',
  rowBorder: '1px solid rgba(0,0,0,0.18)',
  rowDoneBg: 'rgba(46, 204, 113, 0.22)',
  checkBorder: '1px solid rgba(0,0,0,0.35)',
  kbdBg: 'linear-gradient(180deg, #e4e4e4 0%, #c8c8c8 45%, #b0b0b0 55%, #9a9a9a 100%)',
  kbdBorder: '1px solid #3d3d3d',
  kbdColor: '#141414',
  kbdShadow:
    '0 1px 0 rgba(255,255,255,0.72) inset, ' +
    '0 -1px 0 rgba(0,0,0,0.28) inset, ' +
    '0 1px 2px rgba(0,0,0,0.32)'
};
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
  // Styles live in the open shadow root; `:host` matches there.
  // `.kp-onboarding-panel …` covers the light-DOM fallback when shadow attach fails.
  const s = (sel) => `:host ${sel}, .${ONBOARDING_PANEL_CLASS} ${sel}`;
  let css =
    `${s('kbd')} {
        display: inline-block;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.2;
        letter-spacing: 0.02em;
        padding: 2px 7px;
        margin: 0 1px;
        border: ${ONBOARDING_METAL.kbdBorder};
        border-radius: 4px;
        background: ${ONBOARDING_METAL.kbdBg};
        color: ${ONBOARDING_METAL.kbdColor};
        box-shadow: ${ONBOARDING_METAL.kbdShadow};
        vertical-align: baseline;
        white-space: nowrap;
      }
      ${s('[data-kp-onboarding-overlay-title="true"]')} {
        color: #ffffff;
      }
      /* Next incomplete checklist row — same light-blue glow language as the toggle-off arrow. */
      @keyframes kp-onboarding-next-task-glow {
        0%, 100% {
          box-shadow:
            0 0 0 1px rgba(33, 150, 243, 0.40),
            0 0 10px rgba(120, 210, 255, 0.45),
            0 0 18px rgba(120, 210, 255, 0.25);
        }
        50% {
          box-shadow:
            0 0 0 1px rgba(33, 150, 243, 0.70),
            0 0 16px rgba(120, 210, 255, 0.75),
            0 0 32px rgba(120, 210, 255, 0.45);
        }
      }
      ${s('[data-kp-onboarding-task-next="true"]')} {
        animation: kp-onboarding-next-task-glow 1.5s ease-in-out infinite;
        will-change: box-shadow;
      }
      /* Brief flash + check pop when a checklist step completes. */
      @keyframes kp-onboarding-check-flash {
        0% {
          transform: scale(0.55);
          filter: brightness(2);
          box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.95);
        }
        45% {
          transform: scale(1.28);
          filter: brightness(1.45);
          box-shadow:
            0 0 0 5px rgba(46, 204, 113, 0.40),
            0 0 16px rgba(46, 204, 113, 0.75);
        }
        100% {
          transform: scale(1);
          filter: brightness(1);
          box-shadow: 0 0 0 2px rgba(46, 204, 113, 0.18);
        }
      }
      @keyframes kp-onboarding-check-pop {
        0% { opacity: 0; transform: scale(0.15); }
        55% { opacity: 1; transform: scale(1.2); }
        100% { opacity: 1; transform: scale(1); }
      }
      ${s('.kp-onboarding-check-flash')} {
        animation: kp-onboarding-check-flash 420ms cubic-bezier(0.2, 0.9, 0.25, 1.15) both;
        will-change: transform, box-shadow, filter;
      }
      ${s('.kp-onboarding-check-flash > div')} {
        animation: kp-onboarding-check-pop 380ms cubic-bezier(0.2, 0.9, 0.25, 1.1) both;
      }
      @media (prefers-reduced-motion: reduce) {
        ${s('[data-kp-onboarding-task-next="true"]')} {
          animation: none;
        }
        ${s('.kp-onboarding-check-flash')},
        ${s('.kp-onboarding-check-flash > div')} {
          animation: none;
        }
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
    borderRadius: '2px',
    border: ONBOARDING_METAL.btnBorder,
    background: ONBOARDING_METAL.btnBg,
    boxShadow: ONBOARDING_METAL.btnShadow,
    color: ONBOARDING_METAL.fg,
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '700',
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
  try { root.setAttribute('data-kp-ui-shadow', 'onboarding'); } catch { /* ignore */ }
  let shell = root;
  try { shell = root.shadowRoot || root.attachShadow({ mode: 'open' }); } catch { /* light fallback */ }

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
    background: ONBOARDING_METAL.panelBg,
    color: ONBOARDING_METAL.fg,
    border: ONBOARDING_METAL.panelBorder,
    borderRadius: '3px',
    boxShadow: ONBOARDING_METAL.panelShadow,
    fontFamily: 'Helvetica, Arial, sans-serif',
    pointerEvents: initiallyHidden ? 'none' : 'auto'
  });

  try { opts.applyTheme?.(root); } catch { /* ignore */ }

  const style = doc.createElement('style');
  style.textContent = getOnboardingPanelCss({ includeViewTransitions: includeVt });
  shell.appendChild(style);

  const header = doc.createElement('div');
  assignStyle(header, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '10px 12px',
    background: ONBOARDING_METAL.titlebarBg,
    borderBottom: ONBOARDING_METAL.titlebarBorder,
    boxShadow: ONBOARDING_METAL.titlebarShadow
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
    color: ONBOARDING_METAL.fg,
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
    color: ONBOARDING_METAL.fgDim
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
    borderRadius: '2px',
    border: ONBOARDING_METAL.btnBorder,
    background: ONBOARDING_METAL.btnBg,
    boxShadow: ONBOARDING_METAL.btnShadow,
    color: ONBOARDING_METAL.fg,
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
    width: '28px',
    height: '28px',
    borderRadius: '2px',
    border: ONBOARDING_METAL.btnBorder,
    background: ONBOARDING_METAL.btnBg,
    boxShadow: ONBOARDING_METAL.btnShadow,
    color: ONBOARDING_METAL.fg,
    cursor: 'pointer',
    fontSize: '18px',
    fontWeight: '700',
    lineHeight: '26px',
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
    background: ONBOARDING_METAL.footerBg,
    borderTop: ONBOARDING_METAL.footerBorder
  });
  footer.appendChild(stepWrap);
  footer.appendChild(resetBtn);

  shell.appendChild(header);
  shell.appendChild(body);
  shell.appendChild(footer);

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
  const shell = root.shadowRoot || root;
  const body =
    shell.querySelector('[data-kp-onboarding-body="true"]') ||
    shell.querySelector(':scope > div[data-kp-onboarding-body]');
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
    titleEl: shell.querySelector('[data-kp-onboarding-title="true"]'),
    stepEl: shell.querySelector('[data-kp-onboarding-step="true"]'),
    prevBtn: shell.querySelector('button[data-kp-onboarding-prev="true"]'),
    nextBtn: shell.querySelector('button[data-kp-onboarding-next="true"]'),
    resetBtn: shell.querySelector('button[data-kp-onboarding-reset="true"]'),
    closeBtn: shell.querySelector('button[data-kp-onboarding-close="true"]')
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

/** Light-blue next-step outline (matches toggle-off arrow glow). */
const NEXT_TASK_BORDER = '1px solid rgba(120, 210, 255, 0.65)';
const NEXT_TASK_BG = 'rgb(231, 231, 231)';
const NEXT_TASK_GLOW =
  '0 0 0 1px rgba(33, 150, 243, 0.45), 0 0 12px rgba(120, 210, 255, 0.55), 0 0 24px rgba(120, 210, 255, 0.35)';

/**
 * Restart the checkbox complete flash on a checklist box.
 * @param {HTMLElement|null} box
 */
function playCheckboxCompleteFlash(box) {
  if (!box) return;
  try {
    box.classList.remove('kp-onboarding-check-flash');
    // Force reflow so re-adding the class retriggers the animation.
    void box.offsetWidth;
    box.classList.add('kp-onboarding-check-flash');
  } catch { /* ignore */ }
}

function applyTaskRowVisual(row, task, done, opts = {}) {
  if (!row) return;
  const isNext = !!(!done && opts.isNext);
  let wasDone = false;
  try {
    wasDone = row.getAttribute('data-kp-onboarding-task-done') === 'true';
  } catch { /* ignore */ }
  try {
    if (isNext) row.setAttribute('data-kp-onboarding-task-next', 'true');
    else row.removeAttribute('data-kp-onboarding-task-next');
  } catch { /* ignore */ }
  try {
    if (done) row.setAttribute('data-kp-onboarding-task-done', 'true');
    else row.removeAttribute('data-kp-onboarding-task-done');
  } catch { /* ignore */ }

  assignStyle(row, {
    background: done ? ONBOARDING_METAL.rowDoneBg : (isNext ? NEXT_TASK_BG : ONBOARDING_METAL.rowBg),
    border: isNext ? NEXT_TASK_BORDER : ONBOARDING_METAL.rowBorder,
    boxShadow: isNext ? NEXT_TASK_GLOW : 'none'
  });

  const box =
    row.querySelector(':scope > div[aria-hidden="true"]') ||
    row.firstElementChild;
  const textEl =
    (box && box.nextElementSibling) ||
    row.querySelector(':scope > div:last-child');

  if (box) {
    try { box.classList.remove('kp-onboarding-check-flash'); } catch { /* ignore */ }
    assignStyle(box, {
      border: done
        ? '1px solid rgba(46, 204, 113, 0.9)'
        : (isNext ? '1px solid rgba(120, 210, 255, 0.75)' : ONBOARDING_METAL.checkBorder),
      background: done ? 'rgba(46, 204, 113, 0.85)' : 'rgba(255,255,255,0.25)',
      boxShadow: done
        ? '0 0 0 2px rgba(46, 204, 113, 0.18)'
        : (isNext ? '0 0 0 2px rgba(33, 150, 243, 0.28)' : 'none')
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

    // Flash only on the incomplete → complete transition (not on every re-render).
    if (done && !wasDone) {
      playCheckboxCompleteFlash(box);
    }
  }

  if (textEl) {
    try {
      renderKeyboardKeysInto(textEl, task.label || task.id);
      assignStyle(textEl, {
        color: done ? ONBOARDING_METAL.fgDim : ONBOARDING_METAL.fg,
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
  if (done) {
    try { row.setAttribute('data-kp-onboarding-task-done', 'true'); } catch { /* ignore */ }
  }
  const isNext = !!(!done && opts.isNext);
  if (isNext) {
    try { row.setAttribute('data-kp-onboarding-task-next', 'true'); } catch { /* ignore */ }
  }
  assignStyle(row, {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '3px',
    border: isNext ? NEXT_TASK_BORDER : ONBOARDING_METAL.rowBorder,
    background: done ? ONBOARDING_METAL.rowDoneBg : (isNext ? NEXT_TASK_BG : ONBOARDING_METAL.rowBg),
    boxShadow: isNext ? NEXT_TASK_GLOW : 'none'
  });

  const box = doc.createElement('div');
  box.setAttribute('aria-hidden', 'true');
  assignStyle(box, {
    width: '18px',
    height: '18px',
    borderRadius: '2px',
    border: done
      ? '1px solid rgba(46, 204, 113, 0.9)'
      : (isNext ? '1px solid rgba(120, 210, 255, 0.75)' : ONBOARDING_METAL.checkBorder),
    background: done ? 'rgba(46, 204, 113, 0.85)' : 'rgba(255,255,255,0.25)',
    boxShadow: done
      ? '0 0 0 2px rgba(46, 204, 113, 0.18)'
      : (isNext ? '0 0 0 2px rgba(33, 150, 243, 0.28)' : 'none'),
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
    // Animate when this row was just completed (e.g. rebuild right after a step).
    if (opts.animateComplete) {
      try {
        requestAnimationFrame(() => playCheckboxCompleteFlash(box));
      } catch {
        playCheckboxCompleteFlash(box);
      }
    }
  }

  const text = doc.createElement('div');
  renderKeyboardKeysInto(text, task.label || task.id);
  assignStyle(text, {
    fontSize: '13px',
    lineHeight: '1.35',
    color: done ? ONBOARDING_METAL.fgDim : ONBOARDING_METAL.fg,
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
 * @param {boolean} [params.showTip] Opt-in reopen tip (off by default)
 * @param {boolean} [params.showCloseButton] Show a "Close Tutorial" button (completion slide)
 * @param {(e: Event) => void} [params.onCloseClick]
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
  const onCloseClick = typeof params.onCloseClick === 'function' ? params.onCloseClick : null;
  const bodyTextStr = String(params.bodyText || '').trim();
  const forceRebuild = !!params.forceRebuild;
  const showTip = params.showTip === true;
  const showCloseButton = params.showCloseButton === true;
  // First incomplete task in slide order is the "next" recommended step.
  const nextTaskId = (tasks.find((t) => !completedSet.has(t.id)) || null)?.id || null;

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
        existingBody.style.marginBottom = (tasks.length || showCloseButton) ? '12px' : '0px';
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
        isNext: !!(nextTaskId && task.id === nextTaskId),
        uncheckable: done && task.id === lastCompletedTaskId,
        onTaskRowClick
      });
    });
    // Tip is opt-in; drop any leftover tip from older builds / slides.
    try {
      const existingTip = surface.querySelector('[data-kp-onboarding-tip="true"]');
      if (!showTip && existingTip) existingTip.remove();
    } catch { /* ignore */ }
    syncCloseTutorialButton(surface, { show: showCloseButton, onClick: onCloseClick, doc });
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
      color: ONBOARDING_METAL.fg,
      marginBottom: (tasks.length || showCloseButton) ? '12px' : '0px',
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
      isNext: !!(nextTaskId && task.id === nextTaskId),
      uncheckable: done && task.id === lastCompletedTaskId,
      animateComplete: !!(done && lastCompletedTaskId && task.id === lastCompletedTaskId),
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
      lineHeight: '1.35',
      color: ONBOARDING_METAL.fgMute
    });
    surface.appendChild(tip);
  }

  syncCloseTutorialButton(surface, { show: showCloseButton, onClick: onCloseClick, doc });
}

/**
 * Add / update / remove the completion-slide "Close Tutorial" button.
 * @param {HTMLElement} surface
 * @param {{ show?: boolean, onClick?: ((e: Event) => void)|null, doc?: Document }} opts
 */
function syncCloseTutorialButton(surface, opts = {}) {
  if (!surface) return;
  const doc = opts.doc || surface.ownerDocument || document;
  const show = opts.show === true;
  const onClick = typeof opts.onClick === 'function' ? opts.onClick : null;
  let btn = null;
  try {
    btn = surface.querySelector('button[data-kp-onboarding-close-tutorial="true"]');
  } catch { /* ignore */ }

  if (!show) {
    try {
      if (btn) btn.remove();
    } catch { /* ignore */ }
    return;
  }

  if (!btn) {
    btn = doc.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-kp-onboarding-close-tutorial', 'true');
    btn.textContent = 'Close Tutorial';
    assignStyle(btn, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 'fit-content',
      marginLeft: 'auto',
      alignSelf: 'flex-end',
      height: '32px',
      borderRadius: '2px',
      border: '1px solid rgba(30, 120, 70, 0.75)',
      background:
        'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 35%, transparent 60%), ' +
        'linear-gradient(180deg, #7dcf9a 0%, #4caf72 50%, #3a8f5a 100%)',
      boxShadow: '0 1px 0 rgba(255,255,255,0.35) inset, 0 -1px 0 rgba(0,0,0,0.18) inset',
      color: '#0b1410',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '800',
      padding: '0 14px',
      lineHeight: '30px',
      fontFamily: 'inherit'
    });
    surface.appendChild(btn);
  } else {
    // Keep alignment current for in-place updates (button may already exist).
    try {
      btn.style.marginLeft = 'auto';
      btn.style.alignSelf = 'flex-end';
      btn.style.width = 'fit-content';
      btn.style.display = 'flex';
    } catch { /* ignore */ }
  }

  try {
    if (btn._kpOnboardingCloseClick) {
      btn.removeEventListener('click', btn._kpOnboardingCloseClick);
      btn._kpOnboardingCloseClick = null;
    }
  } catch { /* ignore */ }
  if (onClick) {
    btn._kpOnboardingCloseClick = onClick;
    try { btn.addEventListener('click', onClick); } catch { /* ignore */ }
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
 * Ensure modal overlay exists on the onboarding panel root.
 * Attaches to the panel root (not the scrollable body) so a flex body with
 * min-height:0 cannot collapse the overlay to zero height on Chrome.
 * @param {HTMLElement} host Panel root or any descendant inside it
 * @param {Document} [doc]
 * @returns {{
 *   overlayEl: HTMLElement,
 *   titleEl: HTMLElement,
 *   msgEl: HTMLElement,
 *   primaryBtn: HTMLButtonElement,
 *   secondaryBtn: HTMLButtonElement
 * }|null}
 */
export function ensureOnboardingOverlay(host, doc) {
  if (!host) return null;
  const d = doc || host.ownerDocument || document;

  let root = host;
  try {
    if (!host.classList?.contains?.(ONBOARDING_PANEL_CLASS)) {
      root = host.closest?.(`.${ONBOARDING_PANEL_CLASS}`) || host;
      if (!root.classList?.contains?.(ONBOARDING_PANEL_CLASS)) {
        const shadow = host.getRootNode?.();
        if (shadow?.host?.classList?.contains?.(ONBOARDING_PANEL_CLASS)) root = shadow.host;
      }
    }
  } catch {
    root = host;
  }

  const shell = root.shadowRoot || root;
  const existing = shell.querySelector('[data-kp-onboarding-overlay="true"]');
  if (existing) {
    // Migrate legacy overlays that lived inside the scrollable body.
    try {
      if (existing.parentElement !== shell) shell.appendChild(existing);
    } catch { /* ignore */ }
    try {
      const titleEl = existing.querySelector('[data-kp-onboarding-overlay-title="true"]');
      if (titleEl) titleEl.style.color = '#ffffff';
    } catch { /* ignore */ }
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
    zIndex: '20',
    pointerEvents: 'none',
    boxSizing: 'border-box'
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
    marginBottom: '8px',
    color: '#ffffff'
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
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '12px'
  });

  const mkBtn = (variant) => {
    const b = d.createElement('button');
    b.type = 'button';
    assignStyle(b, {
      minHeight: '30px',
      height: 'auto',
      borderRadius: '999px',
      border: variant === 'primary' ? '1px solid rgba(46, 204, 113, 0.55)' : '1px solid rgba(255,255,255,0.20)',
      background: variant === 'primary' ? 'rgba(46, 204, 113, 0.18)' : 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.92)',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '800',
      padding: '4px 12px',
      lineHeight: '20px',
      whiteSpace: 'normal',
      textAlign: 'center'
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
  shell.appendChild(overlay);

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
    if (open) {
      // Hostile pages sometimes override [hidden]/display; reinforce when opening.
      overlayEl.style.setProperty('display', 'flex', 'important');
      overlayEl.style.setProperty('pointer-events', 'auto', 'important');
    } else {
      overlayEl.style.removeProperty('display');
      overlayEl.style.removeProperty('pointer-events');
      overlayEl.style.display = 'none';
      overlayEl.style.pointerEvents = 'none';
    }
  } catch { /* ignore */ }
  try {
    if (root) {
      if (open) root.dataset.kpOnboardingOverlayOpen = 'true';
      else delete root.dataset.kpOnboardingOverlayOpen;
    }
  } catch { /* ignore */ }
}
