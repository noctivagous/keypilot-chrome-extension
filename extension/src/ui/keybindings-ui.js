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
  KEYBINDINGS_UI_FONT_STYLE_ATTR,
  ensureKeyBackgroundIcon,
  ensureKeyPressOverlay,
  getActionIconDataUri,
  getKeybindingsUiCss,
  getKeybindingsUiFontFaceCss,
  preloadKeybindingsUiFonts
} from './keybindings-ui-shared.js';
import {
  actionHasDestination,
  actionHasModes,
  actionHasParameters,
  getActionDestinationDef,
  getActionMode,
  getActionParameter,
  getActionSettingsDef,
  getSharedKeyActionConfigPanel,
  setActionMode,
  setActionParameter
} from './key-action-settings.js';
import { getOrCreateBuiltinFunctionUserAction } from '../modules/keyboard-layout-store.js';
import {
  closestComposed,
  containsComposed,
  getComposedEventElement,
  injectChromeStyles
} from './kp-chrome-shadow.js';

/** @type {{ root: HTMLElement, keybindings: Record<string, any> }|null} */
let _activePopoverContext = null;
/** @type {string|null} */
let _pinnedActionId = null;
/** @type {HTMLElement|null} */
let _pinnedKeyEl = null;

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

/** Ensure KeyPilot keyboard visualization CSS is present in its owning root. */
export function ensureStylesInjected(root = document) {
  const fontUrls = getRuntimeFontUrls();
  const css = getStyleCss();
  const attrName = (typeof KEYBINDINGS_UI_STYLE_ATTR === 'string' && KEYBINDINGS_UI_STYLE_ATTR)
    ? KEYBINDINGS_UI_STYLE_ATTR
    : 'data-kp-keybindings-ui-style';
  injectChromeStyles(root, { attr: attrName, css });
  try {
    const doc = root && root.nodeType === 9 ? root : (root?.ownerDocument || document);
    preloadKeybindingsUiFonts(doc, fontUrls);
    // Register @font-face on the document as well as the shadow tree so Dosis
    // can start loading before the first Keyboard Reference paint.
    if (doc && fontUrls) {
      injectChromeStyles(doc, {
        attr: KEYBINDINGS_UI_FONT_STYLE_ATTR,
        css: getKeybindingsUiFontFaceCss(fontUrls)
      });
    }
  } catch { /* ignore */ }
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
 * @param {boolean} [params.attachPopovers=true] When false, skip key info popovers (edit mode).
 */
export function renderKeybindingsKeyboard({ container, keybindings, keyboardLayout, layoutId, attachPopovers = true } = {}) {
  if (!container) return;
  const doc = container.ownerDocument || document;
  ensureStylesInjected(container.getRootNode?.() || doc);

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
        if (attachPopovers) {
          attachKeyPopoverBehavior({ root: container, keybindings });
        } else {
          detachKeyPopoverBehavior(container);
        }
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
      // Keyboard Reference keys are pointer targets, not page-tab navigation targets.
      keyEl.tabIndex = -1;
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
  if (attachPopovers) {
    attachKeyPopoverBehavior({
      root: container,
      keybindings
    });
  } else {
    detachKeyPopoverBehavior(container);
  }
}

/**
 * Remove key-info popover listeners from a keyboard root (edit mode).
 * @param {HTMLElement|null} root
 */
export function detachKeyPopoverBehavior(root) {
  if (!root || !root._kpKeyHandlers) return;
  try {
    unpinKeyPopover();
  } catch { /* ignore */ }
  const keyElements = root.querySelectorAll('[data-kp-action-id]');
  const h = root._kpKeyHandlers;
  keyElements.forEach((keyEl) => {
    try {
      if (h.enter) keyEl.removeEventListener('pointerenter', h.enter);
      if (h.leave) keyEl.removeEventListener('pointerleave', h.leave);
      if (h.focusin) keyEl.removeEventListener('focusin', h.focusin);
      if (h.focusout) keyEl.removeEventListener('focusout', h.focusout);
      if (h.click) keyEl.removeEventListener('click', h.click);
    } catch { /* ignore */ }
  });
  try {
    if (h.docKeydown) document.removeEventListener('keydown', h.docKeydown, true);
    if (h.docPointerDown) document.removeEventListener('pointerdown', h.docPointerDown, true);
    if (h.resize) window.removeEventListener('resize', h.resize, true);
  } catch { /* ignore */ }
  root._kpKeyHandlers = null;
  try {
    if (_activePopoverContext && _activePopoverContext.root === root) {
      _activePopoverContext = null;
    }
  } catch { /* ignore */ }
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
      <div class="kp-popover-settings" hidden></div>
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
          <div class="kp-popover-settings" hidden></div>
        `;
      } catch { /* ignore */ }
    }
    if (!pop.querySelector('.kp-popover-settings')) {
      try {
        const settingsHost = doc.createElement('div');
        settingsHost.className = 'kp-popover-settings';
        settingsHost.hidden = true;
        pop.appendChild(settingsHost);
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
 * @param {{ clearPinned?: boolean }} [opts]
 */
function hidePopover(pop, opts = {}) {
  if (!pop) return;
  if (opts.clearPinned !== false) {
    _pinnedActionId = null;
    _pinnedKeyEl = null;
    try { pop.removeAttribute('data-kp-popover-pinned'); } catch { /* ignore */ }
    try { pop.style.pointerEvents = ''; } catch { /* ignore */ }
  }
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
    const settingsHost = pop.querySelector('.kp-popover-settings');
    if (settingsHost) {
      settingsHost.hidden = true;
      settingsHost.replaceChildren();
    }
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
 *   pinned?: boolean,
 *   container?: HTMLElement|null
 * }} args
 */
function showPopoverForTarget({ doc, pop, targetEl, binding, actionId, pinned = false }) {
  if (!doc || !pop || !targetEl) return;

  const titleEl = pop.querySelector('.kp-popover-title');
  const keysEl = pop.querySelector('.kp-popover-keys');
  const descEl = pop.querySelector('.kp-popover-desc');
  const iconEl = pop.querySelector('.kp-popover-icon');

  const title = (binding && binding.label) || actionId;
  const keys = (binding && (binding.displayKey || binding.keyLabel)) || '';
  const desc = (binding && (binding.description || binding.label)) || '';
  const iconMaskUri = getActionIconDataUri(actionId, { fill: 'black' });

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

  try {
    if (pinned) {
      pop.setAttribute('data-kp-popover-pinned', 'true');
      pop.style.pointerEvents = 'auto';
      void renderPopoverSettings({ doc, pop, targetEl, binding, actionId });
    } else {
      pop.removeAttribute('data-kp-popover-pinned');
      pop.style.pointerEvents = '';
      const settingsHost = pop.querySelector('.kp-popover-settings');
      if (settingsHost) {
        settingsHost.hidden = true;
        settingsHost.replaceChildren();
      }
    }
  } catch { /* ignore */ }

  const targetRect = targetEl.getBoundingClientRect();
  openPopoverElement(pop);

  const placeAt = (leftPx, topPx) => {
    try {
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

  const margin = 10;
  const gap = 10;
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
    if (top < margin) top = margin;
  } else {
    top = targetRect.bottom + gap;
    const maxTop = Math.max(margin, vh - margin - popH);
    if (top > maxTop) top = maxTop;
  }

  placeAt(left, top);
  const arrowLeft = clamp(targetCenterX - left - 9, 12, Math.max(12, popW - 24));
  pop.style.setProperty('--kp-arrow-left', `${Math.round(arrowLeft)}px`);
}

/**
 * Render mode switch / Config controls into the sticky popover.
 * @param {{ doc: Document, pop: HTMLElement, targetEl: HTMLElement, binding: any, actionId: string }} args
 */
async function renderPopoverSettings({ doc, pop, targetEl, binding, actionId }) {
  const host = pop.querySelector('.kp-popover-settings');
  if (!host) return;

  const hasModes = actionHasModes(actionId);
  const hasDestination = actionHasDestination(actionId);
  const hasParams = actionHasParameters(actionId);
  if (!hasModes && !hasDestination && !hasParams) {
    host.hidden = true;
    host.replaceChildren();
    return;
  }

  host.hidden = false;
  host.replaceChildren();

  let builtinAction = null;
  try { builtinAction = await getOrCreateBuiltinFunctionUserAction(actionId); } catch { builtinAction = null; }

  if (hasModes) {
    const def = getActionSettingsDef(actionId);
    const currentMode = getActionMode(builtinAction?.parameters, actionId);
    const modeWrap = doc.createElement('div');
    modeWrap.className = 'kp-popover-mode-switch';
    modeWrap.setAttribute('role', 'group');
    const modeParam = (def?.parameters || []).find((p) => p && p.id === 'mode');
    modeWrap.setAttribute('aria-label', modeParam?.label || 'Selection mode');

    for (const mode of def.modes) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'kp-popover-mode-btn';
      btn.dataset.modeId = mode.id;
      btn.textContent = mode.label;
      btn.setAttribute('aria-pressed', mode.id === currentMode ? 'true' : 'false');
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          // setActionMode() persists the value AND notifies live KeyPilot instances itself
          // (see notifyActionSettingsChanged in key-action-settings.js) — no need to redispatch.
          await setActionMode(actionId, mode.id);
          modeWrap.querySelectorAll('.kp-popover-mode-btn').forEach((el) => {
            el.setAttribute('aria-pressed', el.dataset.modeId === mode.id ? 'true' : 'false');
          });
        } catch (err) {
          console.warn('[KeyPilot] Failed to set action mode:', err);
        }
      });
      modeWrap.appendChild(btn);
    }
    host.appendChild(modeWrap);
  }

  if (hasDestination) {
    const destDef = getActionDestinationDef(actionId);
    if (destDef) {
      const currentDest = getActionParameter(builtinAction?.parameters, actionId, 'destination');
      const destWrap = doc.createElement('div');
      destWrap.className = 'kp-popover-mode-switch';
      destWrap.setAttribute('role', 'group');
      destWrap.setAttribute('aria-label', destDef.label || 'Destination');

      for (const opt of destDef.options || []) {
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'kp-popover-mode-btn';
        btn.dataset.destinationId = opt.id;
        btn.textContent = opt.label;
        btn.setAttribute('aria-pressed', opt.id === currentDest ? 'true' : 'false');
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            await setActionParameter(actionId, 'destination', opt.id);
            destWrap.querySelectorAll('.kp-popover-mode-btn').forEach((el) => {
              el.setAttribute('aria-pressed', el.dataset.destinationId === opt.id ? 'true' : 'false');
            });
          } catch (err) {
            console.warn('[KeyPilot] Failed to set action destination:', err);
          }
        });
        destWrap.appendChild(btn);
      }
      host.appendChild(destWrap);
    }
  }

  if (hasParams) {
    const configBtn = doc.createElement('button');
    configBtn.type = 'button';
    configBtn.className = 'kp-popover-config-btn';
    configBtn.textContent = 'Config';
    configBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      // setActionParameter() (called by the panel's own controls) already notifies live
      // KeyPilot instances — no onSettingsChanged hook needed here.
      const panel = getSharedKeyActionConfigPanel();
      await panel.open(actionId, {
        title: (binding && binding.label) || actionId,
        anchorRect: targetEl.getBoundingClientRect()
      });
    });
    host.appendChild(configBtn);
  }
}

/**
 * Notify listeners that a Keyboard Reference key info popover was shown via hover/focus.
 * @param {{ actionId?: string, keyEl?: Element|null }} [detail]
 */
function emitKeyboardHelpKeyHover(detail = {}) {
  try {
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

/**
 * Pin (or show sticky) the key-info popover for an action id.
 * Used by click on the key and by F-activate of a Keyboard Reference key.
 * @param {string} actionId
 * @param {{ keyEl?: HTMLElement|null, keybindings?: Record<string, any>|null }} [opts]
 * @returns {boolean}
 */
export function pinKeyPopover(actionId, opts = {}) {
  if (!actionId) return false;
  const ctx = _activePopoverContext;
  const root = ctx?.root;
  const keybindings = opts.keybindings || ctx?.keybindings;
  if (!root || !keybindings) return false;

  const doc = root.ownerDocument || document;
  const pop = ensurePopover(doc, null);
  if (!pop) return false;

  let keyEl = opts.keyEl || null;
  if (!keyEl) {
    try {
      keyEl = root.querySelector(`[data-kp-action-id="${CSS.escape(actionId)}"]`);
    } catch {
      keyEl = root.querySelector(`[data-kp-action-id="${actionId}"]`);
    }
  }
  if (!keyEl) return false;

  const binding = keybindings[actionId];
  if (!binding) return false;

  _pinnedActionId = actionId;
  _pinnedKeyEl = keyEl;
  if (root._kpKeyHandlers) {
    try { clearTimeout(root._kpKeyHandlers.hideTimer); } catch { /* ignore */ }
    root._kpKeyHandlers.hideTimer = null;
  }

  showPopoverForTarget({ doc, pop, targetEl: keyEl, binding, actionId, pinned: true });
  emitKeyboardHelpKeyHover({ actionId, keyEl });
  return true;
}

/**
 * Show the pinned key-info “inspector” popover for an action, anchored to any element
 * (e.g. Keyboard Layout Config palette). Does not require active Reference popover wiring.
 *
 * @param {string} actionId
 * @param {{
 *   anchorEl: HTMLElement,
 *   keybindings?: Record<string, any>|null,
 *   binding?: any
 * }} opts
 * @returns {boolean}
 */
export function inspectKeyActionFromAnchor(actionId, opts = {}) {
  const anchorEl = opts.anchorEl;
  if (!actionId || !anchorEl) return false;
  const doc = anchorEl.ownerDocument || document;
  const pop = ensurePopover(doc, null);
  if (!pop) return false;

  const keybindings = opts.keybindings || _activePopoverContext?.keybindings || {};
  const binding = opts.binding || keybindings[actionId] || null;
  if (!binding) return false;

  _pinnedActionId = actionId;
  _pinnedKeyEl = anchorEl;
  showPopoverForTarget({ doc, pop, targetEl: anchorEl, binding, actionId, pinned: true });
  emitKeyboardHelpKeyHover({ actionId, keyEl: anchorEl });
  return true;
}

/**
 * Unpin / hide the sticky key popover if open.
 */
export function unpinKeyPopover() {
  const doc = document;
  const pop = doc.body?.querySelector?.('.kp-keybindings-popover[data-kp-key-info-popover="true"]')
    || doc.body?.querySelector?.('.kp-keybindings-popover');
  hidePopover(pop);
}

export function attachKeyPopoverBehavior({ root, keybindings }) {
  if (!root) return;
  const doc = root.ownerDocument || document;

  const pop = ensurePopover(doc, null);
  if (!pop) return;

  _activePopoverContext = { root, keybindings };

  if (!root._kpKeyHandlers) {
    root._kpKeyHandlers = {
      enter: null,
      leave: null,
      focusin: null,
      focusout: null,
      click: null,
      docKeydown: null,
      docPointerDown: null,
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
    if (_pinnedActionId) return;
    clearHideTimer();
    root._kpKeyHandlers.hideTimer = setTimeout(() => {
      if (_pinnedActionId) return;
      hidePopover(pop);
      root._kpKeyHandlers.hideTimer = null;
    }, 60);
  };

  const showForKeyEl = (keyEl, { pinned = false } = {}) => {
    if (!keyEl || !keyEl.dataset?.kpActionId) return;
    try {
      if (keyEl.classList?.contains('kp-key-text-mode-disabled')) return;
    } catch { /* ignore */ }
    const actionId = keyEl.dataset.kpActionId;
    const binding = keybindings && keybindings[actionId];
    if (!binding) return;
    clearHideTimer();
    if (pinned) {
      _pinnedActionId = actionId;
      _pinnedKeyEl = keyEl;
    }
    showPopoverForTarget({
      doc,
      pop,
      targetEl: keyEl,
      binding,
      actionId,
      pinned: pinned || (_pinnedActionId === actionId)
    });
    emitKeyboardHelpKeyHover({ actionId, keyEl });
  };

  const keyElements = root.querySelectorAll('[data-kp-action-id]');
  if (root._kpKeyHandlers.enter) {
    keyElements.forEach((keyEl) => {
      try {
        if (root._kpKeyHandlers.enter) keyEl.removeEventListener('pointerenter', root._kpKeyHandlers.enter);
        if (root._kpKeyHandlers.leave) keyEl.removeEventListener('pointerleave', root._kpKeyHandlers.leave);
        if (root._kpKeyHandlers.focusin) keyEl.removeEventListener('focusin', root._kpKeyHandlers.focusin);
        if (root._kpKeyHandlers.focusout) keyEl.removeEventListener('focusout', root._kpKeyHandlers.focusout);
        if (root._kpKeyHandlers.click) keyEl.removeEventListener('click', root._kpKeyHandlers.click);
      } catch { /* ignore */ }
    });
  }

  function handleKeyEnter(e) {
    const keyEl = e.currentTarget;
    if (_pinnedActionId && keyEl?.dataset?.kpActionId !== _pinnedActionId) return;
    showForKeyEl(keyEl, { pinned: false });
  }

  function handleKeyLeave() {
    scheduleHide();
  }

  function handleKeyFocusIn(e) {
    showForKeyEl(e.currentTarget, { pinned: false });
  }

  function handleKeyFocusOut() {
    scheduleHide();
  }

  function handleKeyClick(e) {
    e.preventDefault();
    e.stopPropagation();
    showForKeyEl(e.currentTarget, { pinned: true });
  }

  root._kpKeyHandlers.enter = handleKeyEnter;
  root._kpKeyHandlers.leave = handleKeyLeave;
  root._kpKeyHandlers.focusin = handleKeyFocusIn;
  root._kpKeyHandlers.focusout = handleKeyFocusOut;
  root._kpKeyHandlers.click = handleKeyClick;

  if (keyElements.length === 0) {
    console.warn('[KeyPilot] No key elements found for popover behavior in:', root);
  }

  keyElements.forEach((keyEl) => {
    keyEl.addEventListener('pointerenter', handleKeyEnter);
    keyEl.addEventListener('pointerleave', handleKeyLeave);
    keyEl.addEventListener('focusin', handleKeyFocusIn);
    keyEl.addEventListener('focusout', handleKeyFocusOut);
    keyEl.addEventListener('click', handleKeyClick);
  });

  if (!root._kpKeyHandlers.docKeydown) {
    function handleDocKeydown(e) {
      if (e.key === 'Escape') hidePopover(pop);
    }

    function handleDocPointerDown(e) {
      if (!_pinnedActionId) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (pop.contains(t)) return;
      const keyInPath = getComposedEventElement(e, '.key');
      if (_pinnedKeyEl && (containsComposed(_pinnedKeyEl, t) || containsComposed(_pinnedKeyEl, keyInPath))) return;
      try {
        if (closestComposed(keyInPath || t, '.kp-action-config-panel')) return;
      } catch { /* ignore */ }
      hidePopover(pop);
    }

    function handleResize() {
      hidePopover(pop);
    }

    root._kpKeyHandlers.docKeydown = handleDocKeydown;
    root._kpKeyHandlers.docPointerDown = handleDocPointerDown;
    root._kpKeyHandlers.resize = handleResize;

    doc.addEventListener('keydown', handleDocKeydown, true);
    doc.addEventListener('pointerdown', handleDocPointerDown, true);
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


