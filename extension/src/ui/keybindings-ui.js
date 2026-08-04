/**
 * Reusable UI renderer for KeyPilot keybindings (keyboard visualization + legend table).
 *
 * Designed to be independent of any particular HTML file: you provide container elements.
 */
import { Z_INDEX } from '../config/constants.js';
import {
  KEYBINDINGS_KEYBOARD_LAYOUT,
  KEYBINDINGS_UI_ROOT_CLASS,
  KEYBINDINGS_UI_STYLE_ATTR,
  ensureKeyBackgroundIcon,
  ensureKeyPressOverlay,
  getActionIconDataUri,
  getKeybindingsUiCss
} from './keybindings-ui-shared.js';

function getRuntimeFontUrls() {
  try {
    const getURL = (typeof chrome !== 'undefined' && chrome && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL.bind(chrome.runtime)
      : null;
    if (!getURL) return null;
    return {
      robotech: getURL('fonts/ROBOTECHGPRegular.ttf'),
      titillium: getURL('fonts/TitilliumTextRegular.otf'),
      cubellan: getURL('fonts/CubellanRegular.ttf'),
      ezarion: getURL('fonts/EzarionRegular.ttf'),
      dosis: getURL('fonts/DosisBook.ttf')
    };
  } catch {
    return null;
  }
}

function getStyleCss() {
  return getKeybindingsUiCss({
    zKeybindingsPopover: Z_INDEX.KEYBINDINGS_POPOVER,
    fontUrls: getRuntimeFontUrls()
  });
}

function ensureStylesInjected(doc = document) {
  if (!doc || !doc.head) return;
  const css = getStyleCss();
  let style = null;
  try {
    const attr = typeof KEYBINDINGS_UI_STYLE_ATTR === 'string' && KEYBINDINGS_UI_STYLE_ATTR
      ? KEYBINDINGS_UI_STYLE_ATTR
      : 'data-kp-keybindings-ui-style';
    style = doc.head.querySelector(`style[${attr}]`);
  } catch {
    // If the selector is invalid for any reason, fall back to "first matching style tag" search.
    try {
      const all = doc.head.querySelectorAll('style');
      for (const s of all) {
        if (s && s.getAttribute && s.getAttribute('data-kp-keybindings-ui-style') === 'true') {
          style = s;
          break;
        }
      }
    } catch { /* ignore */ }
  }
  if (!style) {
    style = doc.createElement('style');
    try {
      style.setAttribute(
        (typeof KEYBINDINGS_UI_STYLE_ATTR === 'string' && KEYBINDINGS_UI_STYLE_ATTR)
          ? KEYBINDINGS_UI_STYLE_ATTR
          : 'data-kp-keybindings-ui-style',
        'true'
      );
    } catch {
      // ignore
    }
    style.textContent = css;
    doc.head.appendChild(style);
    return;
  }
  // Keep styles up-to-date (also replaces any build-time font URL placeholders).
  if (style.textContent !== css) {
    style.textContent = css;
  }
}

function clearElement(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
}

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function updateExistingKeyboardDOM({ container, keybindings }) {
  const doc = container.ownerDocument || document;

  // Strip leftover icon layers from keys that have no KeyPilot function.
  try {
    container.querySelectorAll('.key:not([data-kp-action-id]) > .key-bg-icon').forEach((el) => {
      try { el.remove(); } catch { /* ignore */ }
    });
  } catch { /* ignore */ }

  // Every key gets a press-overlay host (shown on keydown).
  try {
    container.querySelectorAll('.key').forEach((keyEl) => {
      ensureKeyPressOverlay(doc, keyEl);
    });
  } catch { /* ignore */ }

  const actionEls = container.querySelectorAll('[data-kp-action-id]');
  if (!actionEls || actionEls.length === 0) return false;

  for (const keyEl of actionEls) {
    const actionId = keyEl.dataset.kpActionId;
    const binding = keybindings && keybindings[actionId];
    const baseClass = keyEl.dataset.kpBaseClass || 'key';
    const keyboardClass = binding && binding.keyboardClass ? String(binding.keyboardClass) : '';
    keyEl.className = `${baseClass}${keyboardClass ? ' ' + keyboardClass : ''}`;
    // Only function-bearing keys get FA background icons.
    ensureKeyBackgroundIcon(doc, keyEl);
    ensureKeyPressOverlay(doc, keyEl);

    const title = (binding && (binding.description || binding.label)) || actionId;
    // Prefer aria-label over title so the browser native tooltip doesn't fight our hover popover.
    try { keyEl.removeAttribute('title'); } catch { /* ignore */ }
    keyEl.setAttribute('aria-label', title);

    const main = keyEl.querySelector('.key-main');
    if (main) main.textContent = (binding && binding.label) || actionId;

    const labelText = (binding && (binding.displayKey || binding.keyLabel)) || '';
    const existingLabel = keyEl.querySelector('.key-label');
    if (labelText) {
      if (existingLabel) existingLabel.textContent = labelText;
      else keyEl.appendChild(el(doc, 'div', 'key-label', labelText));
    } else if (existingLabel) {
      existingLabel.remove();
    }
  }

  return true;
}

/**
 * Render a keyboard visualization into a container.
 *
 * @param {Object} params
 * @param {HTMLElement} params.container
 * @param {Record<string, {label?: string, description?: string, displayKey?: string, keyboardClass?: string}>} params.keybindings
 * @param {any[]} [params.keyboardLayout]
 * @param {string} [params.layoutId]
 */
export function renderKeybindingsKeyboard({ container, keybindings, keyboardLayout, layoutId } = {}) {
  if (!container) return;
  const doc = container.ownerDocument || document;
  ensureStylesInjected(doc);

  const layout = (keyboardLayout && Array.isArray(keyboardLayout)) ? keyboardLayout : KEYBINDINGS_KEYBOARD_LAYOUT;
  const layoutKey = typeof layoutId === 'string' ? layoutId : '';

  // If an early-inject (or previous render) already built the keyboard DOM,
  // just update the labels/classes to avoid flicker and layout jumps.
  let existingVisual = null;
  try {
    existingVisual = container.querySelector(':scope > .keyboard-visual');
  } catch {
    // Some environments (or odd documents) may not support :scope; fall back.
    try { existingVisual = container.querySelector('.keyboard-visual'); } catch { /* ignore */ }
  }
  if (existingVisual && existingVisual.dataset && existingVisual.dataset.kpKeyboardBuilt === 'true') {
    const existingLayoutKey = String(existingVisual.dataset.kpLayoutId || '');
    // If the caller provided a layoutId, only reuse DOM when it matches exactly.
    // This ensures switching layouts re-builds the keyboard positions (not just labels).
    const canReuse = !layoutKey ? true : (existingLayoutKey === layoutKey);
    if (canReuse) {
      if (updateExistingKeyboardDOM({ container, keybindings })) {
        attachKeyPopoverBehavior({ root: container, keybindings });
        return;
      }
    }
  }

  clearElement(container);

  const visual = el(doc, 'div', `keyboard-visual ${KEYBINDINGS_UI_ROOT_CLASS}`);
  visual.dataset.kpKeyboardBuilt = 'true';
  if (layoutKey) visual.dataset.kpLayoutId = layoutKey;
  container.appendChild(visual);

  // Layout is intentionally stable + reusable (not tied to popup.html).
  // Action keys are looked up by ID in `keybindings`.
  for (const row of layout) {
    const rowEl = el(doc, 'div', 'keyboard-row');
    visual.appendChild(rowEl);

    for (const item of row) {
      if (item.type === 'special') {
        // No KeyPilot function → no background icon.
        const keyEl = el(doc, 'div', item.className || 'key');
        keyEl.appendChild(el(doc, 'span', 'key-text', item.text));
        ensureKeyPressOverlay(doc, keyEl);
        rowEl.appendChild(keyEl);
        continue;
      }

      if (item.type === 'key') {
        // Unassigned alphanumeric key → no background icon.
        const keyEl = el(doc, 'div', item.className || 'key');
        keyEl.appendChild(el(doc, 'span', 'key-text', item.text));
        ensureKeyPressOverlay(doc, keyEl);
        rowEl.appendChild(keyEl);
        continue;
      }

      // action
      const binding = keybindings && keybindings[item.id];
      const baseClass = item.className || 'key';
      const className = `${baseClass}${binding && binding.keyboardClass ? ' ' + binding.keyboardClass : ''}`;
      const keyEl = el(doc, 'button', className);
      keyEl.dataset.kpActionId = item.id;
      keyEl.dataset.kpBaseClass = baseClass;
      keyEl.type = 'button'; // Prevent form submission if inside a form
      // Prefer aria-label over title so the browser native tooltip doesn't fight our hover popover.
      try { keyEl.removeAttribute('title'); } catch { /* ignore */ }
      keyEl.setAttribute(
        'aria-label',
        (binding && (binding.description || binding.label)) || item.fallbackText || item.id
      );
      // Only keys with functions get FA background icons.
      ensureKeyBackgroundIcon(doc, keyEl);

      const main = el(
        doc,
        'div',
        'key-main',
        (binding && binding.label) || item.fallbackText || item.id
      );
      keyEl.appendChild(main);

      const labelText = (binding && binding.displayKey) || (binding && binding.keyLabel) || '';
      if (labelText) {
        keyEl.appendChild(el(doc, 'div', 'key-label', labelText));
      }

      ensureKeyPressOverlay(doc, keyEl);
      rowEl.appendChild(keyEl);
    }
  }

  // Attach popover behavior directly to each key element (reusable, not tied to any page).
  attachKeyPopoverBehavior({
    root: container,
    keybindings
  });
}

/**
 * Whether the HTML Popover API is available on this element/document.
 * @param {HTMLElement|null} el
 * @returns {boolean}
 */
function supportsPopoverApi(el) {
  try {
    return !!(el && typeof el.showPopover === 'function' && typeof HTMLElement !== 'undefined'
      && 'popover' in HTMLElement.prototype);
  } catch {
    return false;
  }
}

/**
 * Ensure the shared key-info popover exists on document.body and is wired for
 * the Popover API (top layer — escapes keyboard panel overflow).
 * @param {Document} doc
 * @param {HTMLElement|null} [_container] ignored; kept for call-site compatibility
 * @returns {HTMLElement|null}
 */
function ensurePopover(doc, _container) {
  ensureStylesInjected(doc);
  if (!doc || !doc.body) return null;

  // Prefer a single shared popover on body (top-layer / fixed), not inside the panel.
  let pop = doc.body.querySelector('.kp-keybindings-popover[data-kp-key-info-popover="true"]')
    || doc.body.querySelector('.kp-keybindings-popover');

  // Migrate any legacy popover that still lives inside the floating keyboard panel.
  if (!pop) {
    try {
      const legacy = doc.querySelector('.kp-floating-keyboard-help .kp-keybindings-popover');
      if (legacy) {
        pop = legacy;
        doc.body.appendChild(pop);
      }
    } catch { /* ignore */ }
  }

  if (!pop) {
    pop = doc.createElement('div');
    pop.className = 'kp-keybindings-popover';
    pop.setAttribute('data-kp-key-info-popover', 'true');
    pop.setAttribute('data-placement', 'top');
    pop.setAttribute('role', 'tooltip');
    pop.innerHTML = `
      <div class="kp-popover-head">
        <div class="kp-popover-icon" aria-hidden="true"></div>
        <div class="kp-popover-title-wrap">
          <div class="kp-popover-title"></div>
          <div class="kp-popover-keys"></div>
        </div>
      </div>
      <p class="kp-popover-desc"></p>
    `;
    doc.body.appendChild(pop);
  } else {
    try { pop.setAttribute('data-kp-key-info-popover', 'true'); } catch { /* ignore */ }
    if (pop.parentElement !== doc.body) {
      try { doc.body.appendChild(pop); } catch { /* ignore */ }
    }
    if (!pop.querySelector('.kp-popover-icon')) {
      // Upgrade legacy popover markup (from older sessions / early inject).
      try {
        pop.setAttribute('role', 'tooltip');
        pop.innerHTML = `
          <div class="kp-popover-head">
            <div class="kp-popover-icon" aria-hidden="true"></div>
            <div class="kp-popover-title-wrap">
              <div class="kp-popover-title"></div>
              <div class="kp-popover-keys"></div>
            </div>
          </div>
          <p class="kp-popover-desc"></p>
        `;
      } catch { /* ignore */ }
    }
  }

  // HTML Popover API: manual mode so hover lifecycle owns show/hide (not light dismiss).
  try {
    if (supportsPopoverApi(pop)) {
      pop.popover = 'manual';
    }
  } catch {
    try { pop.setAttribute('popover', 'manual'); } catch { /* ignore */ }
  }

  // Start closed.
  try { pop.hidden = true; } catch { /* ignore */ }
  try { pop.removeAttribute('data-kp-popover-open'); } catch { /* ignore */ }

  return pop;
}

/**
 * @param {HTMLElement|null} pop
 */
function hidePopover(pop) {
  if (!pop) return;
  try {
    if (supportsPopoverApi(pop) && typeof pop.hidePopover === 'function') {
      try {
        if (pop.matches?.(':popover-open')) pop.hidePopover();
      } catch {
        try { pop.hidePopover(); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
  try { pop.hidden = true; } catch { /* ignore */ }
  try { pop.removeAttribute('data-kp-popover-open'); } catch { /* ignore */ }
  try {
    const iconEl = pop.querySelector('.kp-popover-icon');
    if (iconEl) {
      iconEl.style.backgroundImage = '';
      iconEl.style.webkitMaskImage = '';
      iconEl.style.maskImage = '';
      iconEl.style.backgroundColor = '';
      iconEl.hidden = true;
    }
    // Clear key-theme overrides so the next hover starts clean.
    ['--kp-key-face', '--kp-key-mid', '--kp-key-deep', '--kp-key-icon'].forEach((prop) => {
      try { pop.style.removeProperty(prop); } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
}

/**
 * Open the popover element (Popover API preferred; legacy display fallback).
 * @param {HTMLElement} pop
 */
function openPopoverElement(pop) {
  if (!pop) return;
  try { pop.hidden = false; } catch { /* ignore */ }
  try { pop.setAttribute('data-kp-popover-open', 'true'); } catch { /* ignore */ }
  if (supportsPopoverApi(pop) && typeof pop.showPopover === 'function') {
    try {
      if (!pop.matches?.(':popover-open')) pop.showPopover();
    } catch {
      try { pop.showPopover(); } catch { /* ignore */ }
    }
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Copy keycap material CSS variables from the hovered key onto the popover
 * so the tooltip matches that key's color family.
 * @param {HTMLElement} pop
 * @param {HTMLElement} targetEl
 */
function applyKeyMaterialToPopover(pop, targetEl) {
  if (!pop || !targetEl) return;
  try {
    const cs = (targetEl.ownerDocument || document).defaultView?.getComputedStyle?.(targetEl);
    if (!cs) return;
    const face = (cs.getPropertyValue('--kp-key-face') || '').trim();
    const mid = (cs.getPropertyValue('--kp-key-mid') || '').trim();
    const deep = (cs.getPropertyValue('--kp-key-deep') || '').trim();
    const icon = (cs.getPropertyValue('--kp-key-icon') || '').trim();
    if (face) pop.style.setProperty('--kp-key-face', face);
    if (mid) pop.style.setProperty('--kp-key-mid', mid);
    if (deep) pop.style.setProperty('--kp-key-deep', deep);
    if (icon) pop.style.setProperty('--kp-key-icon', icon);
  } catch { /* ignore */ }
}

/**
 * Fill content and position the key-info popover against the *viewport*
 * (not the keyboard panel). Top-row keys can open above the panel; bottom-row
 * keys can open below it.
 *
 * @param {{
 *   doc: Document,
 *   pop: HTMLElement,
 *   targetEl: HTMLElement,
 *   binding: any,
 *   actionId: string,
 *   container?: HTMLElement|null
 * }} args
 */
function showPopoverForTarget({ doc, pop, targetEl, binding, actionId }) {
  if (!doc || !pop || !targetEl) return;

  const titleEl = pop.querySelector('.kp-popover-title');
  const keysEl = pop.querySelector('.kp-popover-keys');
  const descEl = pop.querySelector('.kp-popover-desc');
  const iconEl = pop.querySelector('.kp-popover-icon');

  const title = (binding && binding.label) || actionId;
  const keys = (binding && (binding.displayKey || binding.keyLabel)) || '';
  const desc = (binding && (binding.description || binding.label)) || '';
  // Black SVG for mask (same approach as key glyphs).
  const iconMaskUri = getActionIconDataUri(actionId, { fill: 'black' });

  // Match popover surface to this key's material tokens.
  applyKeyMaterialToPopover(pop, targetEl);

  if (titleEl) titleEl.textContent = title;
  if (keysEl) keysEl.textContent = keys ? `Key: ${keys}` : '';
  if (descEl) descEl.textContent = desc;
  if (iconEl) {
    if (iconMaskUri) {
      iconEl.hidden = false;
      iconEl.style.backgroundImage = 'none';
      iconEl.style.backgroundColor = 'var(--kp-key-icon)';
      iconEl.style.webkitMaskImage = iconMaskUri;
      iconEl.style.maskImage = iconMaskUri;
      iconEl.style.webkitMaskRepeat = 'no-repeat';
      iconEl.style.maskRepeat = 'no-repeat';
      iconEl.style.webkitMaskPosition = 'center';
      iconEl.style.maskPosition = 'center';
      iconEl.style.webkitMaskSize = '62% 62%';
      iconEl.style.maskSize = '62% 62%';
    } else {
      iconEl.hidden = true;
      iconEl.style.backgroundImage = '';
      iconEl.style.webkitMaskImage = '';
      iconEl.style.maskImage = '';
      iconEl.style.backgroundColor = '';
    }
  }

  // Capture key geometry *before* open (stable, independent of popover layer).
  const targetRect = targetEl.getBoundingClientRect();

  // Open first so layout/measurement works (top layer via Popover API).
  openPopoverElement(pop);

  /**
   * Write fixed coords so UA [popover] inset/margin cannot win the cascade.
   * Prefer setProperty with important for left/top (survives inset conflicts).
   *
   * Never call removeProperty('inset') *after* setting left/top: Chrome often
   * serializes left/top as the inset shorthand, so removing inset wipes them
   * and the tooltip jumps to the viewport origin.
   *
   * @param {number} leftPx
   * @param {number} topPx
   */
  const placeAt = (leftPx, topPx) => {
    try {
      // Drop any prior inset shorthand *first*, then set longhands.
      try { pop.style.removeProperty('inset'); } catch { /* ignore */ }
      pop.style.setProperty('position', 'fixed', 'important');
      pop.style.setProperty('margin', '0', 'important');
      pop.style.setProperty('right', 'auto', 'important');
      pop.style.setProperty('bottom', 'auto', 'important');
      pop.style.setProperty('left', `${Math.round(leftPx)}px`, 'important');
      pop.style.setProperty('top', `${Math.round(topPx)}px`, 'important');
    } catch {
      try { pop.style.removeProperty('inset'); } catch { /* ignore */ }
      pop.style.position = 'fixed';
      pop.style.margin = '0';
      pop.style.right = 'auto';
      pop.style.bottom = 'auto';
      pop.style.left = `${Math.round(leftPx)}px`;
      pop.style.top = `${Math.round(topPx)}px`;
    }
  };

  // Viewport-relative fixed positioning (escapes panel overflow).
  const margin = 10;
  const gap = 10; // distance between target and popover box (arrow included)

  // Measure while open; park off-screen first to avoid one-frame flicker at 0,0.
  placeAt(-9999, -9999);

  const popRect = pop.getBoundingClientRect();
  const popW = popRect.width || pop.offsetWidth || 160;
  const popH = popRect.height || pop.offsetHeight || 80;
  const vw = Math.max(
    doc.documentElement?.clientWidth || 0,
    (typeof window !== 'undefined' ? window.innerWidth : 0) || 0
  );
  const vh = Math.max(
    doc.documentElement?.clientHeight || 0,
    (typeof window !== 'undefined' ? window.innerHeight : 0) || 0
  );

  // Prefer above the key when there is room in the *viewport* (not the panel).
  // Top-row keys can therefore render above the keyboard reference window.
  const spaceAbove = targetRect.top;
  const spaceBelow = vh - targetRect.bottom;
  const needs = popH + gap + margin;
  const placeAbove = spaceAbove >= needs || (spaceAbove >= spaceBelow && spaceAbove >= gap + 24);
  const placement = placeAbove ? 'top' : 'bottom';
  pop.setAttribute('data-placement', placement);

  const targetCenterX = targetRect.left + targetRect.width / 2;

  let left = targetCenterX - popW / 2;
  const maxLeft = Math.max(margin, vw - margin - popW);
  left = clamp(left, margin, maxLeft);

  let top;
  if (placement === 'top') {
    top = targetRect.top - gap - popH;
    // Soft clamp: keep fully on-screen when possible, but never force bottom
    // placement just because the panel is short — we already chose above.
    if (top < margin) top = margin;
  } else {
    top = targetRect.bottom + gap;
    const maxTop = Math.max(margin, vh - margin - popH);
    if (top > maxTop) top = maxTop;
  }

  placeAt(left, top);

  // Arrow alignment: set CSS variable relative to popover box.
  const arrowLeft = clamp(targetCenterX - left - 9, 12, Math.max(12, popW - 24));
  pop.style.setProperty('--kp-arrow-left', `${Math.round(arrowLeft)}px`);
}

/**
 * Notify listeners that a Keyboard Reference key info popover was shown via hover/focus.
 * Uses the same keypilot:action channel as F-key activations so onboarding can complete
 * tasks like "hover a key to see what it does".
 * @param {{ actionId?: string, keyEl?: Element|null }} [detail]
 */
function emitKeyboardHelpKeyHover(detail = {}) {
  try {
    // Debounce rapid pointerenter chatter across adjacent keys so onboarding only needs one real hover.
    const now = Date.now();
    if (emitKeyboardHelpKeyHover._lastAt && now - emitKeyboardHelpKeyHover._lastAt < 120) return;
    emitKeyboardHelpKeyHover._lastAt = now;

    document.dispatchEvent(new CustomEvent('keypilot:action', {
      detail: {
        action: 'hover',
        isKeyboardHelpKey: true,
        actionId: detail.actionId ? String(detail.actionId) : null,
        timestamp: now
      }
    }));
  } catch {
    // ignore
  }
}

function attachKeyPopoverBehavior({ root, keybindings }) {
  if (!root) return;
  const doc = root.ownerDocument || document;

  // Popover lives on document.body + Popover API top layer (not clipped by panel).
  const pop = ensurePopover(doc, null);
  if (!pop) return;

  // Store handlers on the root to avoid duplicate attachments
  if (!root._kpKeyHandlers) {
    root._kpKeyHandlers = {
      enter: null,
      leave: null,
      focusin: null,
      focusout: null,
      docKeydown: null,
      resize: null,
      hideTimer: null
    };
  }

  const clearHideTimer = () => {
    if (root._kpKeyHandlers.hideTimer != null) {
      try { clearTimeout(root._kpKeyHandlers.hideTimer); } catch { /* ignore */ }
      root._kpKeyHandlers.hideTimer = null;
    }
  };

  const scheduleHide = () => {
    clearHideTimer();
    root._kpKeyHandlers.hideTimer = setTimeout(() => {
      hidePopover(pop);
      root._kpKeyHandlers.hideTimer = null;
    }, 60);
  };

  const showForKeyEl = (keyEl) => {
    if (!keyEl || !keyEl.dataset?.kpActionId) return;
    // Text mode: only Click Element stays interactive on the keyboard reference.
    try {
      if (keyEl.classList?.contains('kp-key-text-mode-disabled')) return;
    } catch { /* ignore */ }
    const actionId = keyEl.dataset.kpActionId;
    const binding = keybindings && keybindings[actionId];
    if (!binding) return;
    clearHideTimer();
    showPopoverForTarget({ doc, pop, targetEl: keyEl, binding, actionId });
    // Onboarding / other listeners: user hovered a Keyboard Reference key and saw its info.
    emitKeyboardHelpKeyHover({ actionId, keyEl });
  };

  // Remove existing handlers if re-attaching
  const keyElements = root.querySelectorAll('[data-kp-action-id]');
  if (root._kpKeyHandlers.enter) {
    keyElements.forEach((keyEl) => {
      try {
        if (root._kpKeyHandlers.enter) keyEl.removeEventListener('pointerenter', root._kpKeyHandlers.enter);
        if (root._kpKeyHandlers.leave) keyEl.removeEventListener('pointerleave', root._kpKeyHandlers.leave);
        if (root._kpKeyHandlers.focusin) keyEl.removeEventListener('focusin', root._kpKeyHandlers.focusin);
        if (root._kpKeyHandlers.focusout) keyEl.removeEventListener('focusout', root._kpKeyHandlers.focusout);
      } catch { /* ignore */ }
    });
  }

  function handleKeyEnter(e) {
    showForKeyEl(e.currentTarget);
  }

  function handleKeyLeave() {
    scheduleHide();
  }

  function handleKeyFocusIn(e) {
    showForKeyEl(e.currentTarget);
  }

  function handleKeyFocusOut() {
    scheduleHide();
  }

  // Store handlers for cleanup / re-attach
  root._kpKeyHandlers.enter = handleKeyEnter;
  root._kpKeyHandlers.leave = handleKeyLeave;
  root._kpKeyHandlers.focusin = handleKeyFocusIn;
  root._kpKeyHandlers.focusout = handleKeyFocusOut;

  if (keyElements.length === 0) {
    console.warn('[KeyPilot] No key elements found for popover behavior in:', root);
  }

  keyElements.forEach((keyEl) => {
    // Hover (pointer) — primary interaction
    keyEl.addEventListener('pointerenter', handleKeyEnter);
    keyEl.addEventListener('pointerleave', handleKeyLeave);
    // Keyboard focus for accessibility
    keyEl.addEventListener('focusin', handleKeyFocusIn);
    keyEl.addEventListener('focusout', handleKeyFocusOut);
  });

  // Escape / resize hide (only attach once per root)
  if (!root._kpKeyHandlers.docKeydown) {
    function handleDocKeydown(e) {
      if (e.key === 'Escape') hidePopover(pop);
    }
    
    function handleResize() {
      hidePopover(pop);
    }

    root._kpKeyHandlers.docKeydown = handleDocKeydown;
    root._kpKeyHandlers.resize = handleResize;

    doc.addEventListener('keydown', handleDocKeydown, true);
    window.addEventListener('resize', handleResize);
  }
}

function normalizeLegendRows(keybindings, extraRows) {
  const rows = [];
  for (const [id, b] of Object.entries(keybindings || {})) {
    rows.push({
      id,
      keys: b.displayKey || b.keyLabel || (Array.isArray(b.keys) ? b.keys.join(' / ') : ''),
      action: b.description || b.label || id,
      sortRow: typeof b.row === 'number' ? b.row : 99
    });
  }

  for (const extra of extraRows || []) {
    rows.push({
      id: extra.id || `extra_${rows.length}`,
      keys: extra.keys,
      action: extra.action,
      sortRow: 100
    });
  }

  // Stable sort: row then key label.
  rows.sort((a, b) => {
    if (a.sortRow !== b.sortRow) return a.sortRow - b.sortRow;
    return String(a.keys).localeCompare(String(b.keys));
  });

  return rows;
}

/**
 * Render the legend table body.
 *
 * @param {Object} params
 * @param {HTMLElement} params.tbody
 * @param {Record<string, any>} params.keybindings
 * @param {Array<{id?: string, keys: string, action: string}>} [params.extraRows]
 */
export function renderKeybindingsLegendTable({ tbody, keybindings, extraRows = [] }) {
  if (!tbody) return;
  const doc = tbody.ownerDocument || document;
  clearElement(tbody);

  const rows = normalizeLegendRows(keybindings, extraRows);
  for (const r of rows) {
    const tr = el(doc, 'tr');
    tr.appendChild(el(doc, 'td', '', r.keys));
    tr.appendChild(el(doc, 'td', '', r.action));
    tbody.appendChild(tr);
  }
}

/**
 * Convenience wrapper for rendering both keyboard + legend.
 */
export function renderKeybindingsUI({ keyboardContainer, legendTbody, keybindings, keyboardLayout, layoutId, extraRows = [] }) {
  renderKeybindingsKeyboard({ container: keyboardContainer, keybindings, keyboardLayout, layoutId });
  renderKeybindingsLegendTable({ tbody: legendTbody, keybindings, extraRows });
}


