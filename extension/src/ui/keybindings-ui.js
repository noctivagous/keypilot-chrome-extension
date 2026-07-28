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
        rowEl.appendChild(keyEl);
        continue;
      }

      if (item.type === 'key') {
        // Unassigned alphanumeric key → no background icon.
        const keyEl = el(doc, 'div', item.className || 'key');
        keyEl.appendChild(el(doc, 'span', 'key-text', item.text));
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

      rowEl.appendChild(keyEl);
    }
  }

  // Attach popover behavior directly to each key element (reusable, not tied to any page).
  attachKeyPopoverBehavior({
    root: container,
    keybindings
  });
}

function ensurePopover(doc, container) {
  ensureStylesInjected(doc);
  // Try to find existing popover in the container first
  let pop = container && container.querySelector('.kp-keybindings-popover');
  // Fallback to body search for backwards compatibility
  if (!pop && doc.body) {
    pop = doc.body.querySelector('.kp-keybindings-popover');
    // If found in body, move it to container
    if (pop && container) {
      pop.remove();
      container.appendChild(pop);
    }
  }
  // Create new popover if not found
  if (!pop && container) {
    pop = doc.createElement('div');
    pop.className = 'kp-keybindings-popover';
    pop.hidden = true;
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
    container.appendChild(pop);
  } else if (pop && !pop.querySelector('.kp-popover-icon')) {
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
  return pop;
}

function hidePopover(pop) {
  if (!pop) return;
  pop.hidden = true;
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

function showPopoverForTarget({ doc, pop, targetEl, binding, actionId, container }) {
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

  pop.hidden = false;

  // Measure and position.
  const margin = 10;
  const gap = 10; // distance between target and popover box (arrow included)
  const targetRect = targetEl.getBoundingClientRect();

  // Get container rect for relative positioning
  const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
  
  // Calculate target position relative to container
  const targetRelativeTop = targetRect.top - containerRect.top;
  const targetRelativeLeft = targetRect.left - containerRect.left;
  const targetRelativeBottom = targetRect.bottom - containerRect.top;
  const targetRelativeRight = targetRect.right - containerRect.left;

  // Temporarily move offscreen to measure without jitter.
  pop.style.left = '-9999px';
  pop.style.top = '-9999px';
  pop.style.maxWidth = '280px';

  const popRect = pop.getBoundingClientRect();
  
  // Use container dimensions for bounds checking
  const containerWidth = containerRect.width || (container ? container.clientWidth : 0);
  const containerHeight = containerRect.height || (container ? container.clientHeight : 0);
  const vw = container ? containerWidth : Math.max(doc.documentElement.clientWidth || 0, window.innerWidth || 0);
  const vh = container ? containerHeight : Math.max(doc.documentElement.clientHeight || 0, window.innerHeight || 0);

  const spaceAbove = targetRelativeTop;
  const spaceBelow = vh - targetRelativeBottom;
  const placeAbove = spaceAbove >= popRect.height + gap + margin || spaceAbove >= spaceBelow;
  const placement = placeAbove ? 'top' : 'bottom';
  pop.setAttribute('data-placement', placement);

  const targetCenterX = targetRelativeLeft + targetRect.width / 2;

  let left = targetCenterX - popRect.width / 2;
  left = clamp(left, margin, vw - margin - popRect.width);

  let top;
  if (placement === 'top') {
    top = targetRelativeTop - gap - popRect.height;
    top = Math.max(margin, top);
  } else {
    top = targetRelativeBottom + gap;
    top = Math.min(vh - margin - popRect.height, top);
  }

  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;

  // Arrow alignment: set CSS variable relative to popover box.
  const arrowLeft = clamp(targetCenterX - left - 9, 12, popRect.width - 24);
  pop.style.setProperty('--kp-arrow-left', `${Math.round(arrowLeft)}px`);
}

function attachKeyPopoverBehavior({ root, keybindings }) {
  if (!root) return;
  const doc = root.ownerDocument || document;
  
  // Find the floating keyboard reference container (parent of the keyboard container)
  // This is the container that will hold the popover for absolute positioning
  let floatingContainer = root.closest('.kp-floating-keyboard-help');
  // Fallback: if not found, use root's parent or body
  if (!floatingContainer) {
    floatingContainer = root.parentElement || doc.body;
  }
  
  const pop = ensurePopover(doc, floatingContainer);
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
    const actionId = keyEl.dataset.kpActionId;
    const binding = keybindings && keybindings[actionId];
    if (!binding) return;
    clearHideTimer();
    showPopoverForTarget({ doc, pop, targetEl: keyEl, binding, actionId, container: floatingContainer });
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


