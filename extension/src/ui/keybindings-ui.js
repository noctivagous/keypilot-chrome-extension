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
  const actionEls = container.querySelectorAll('[data-kp-action-id]');
  if (!actionEls || actionEls.length === 0) return false;

  for (const keyEl of actionEls) {
    const actionId = keyEl.dataset.kpActionId;
    const binding = keybindings && keybindings[actionId];
    const baseClass = keyEl.dataset.kpBaseClass || 'key';
    const keyboardClass = binding && binding.keyboardClass ? String(binding.keyboardClass) : '';
    keyEl.className = `${baseClass}${keyboardClass ? ' ' + keyboardClass : ''}`;

    const title = (binding && (binding.description || binding.label)) || actionId;
    keyEl.title = title;

    const main = keyEl.querySelector('.key-main');
    if (main) main.textContent = (binding && binding.label) || actionId;

    const labelText = (binding && (binding.displayKey || binding.keyLabel)) || '';
    const existingLabel = keyEl.querySelector('.key-label');
    if (labelText) {
      if (existingLabel) existingLabel.textContent = labelText;
      else keyEl.appendChild(el(container.ownerDocument || document, 'div', 'key-label', labelText));
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
        rowEl.appendChild(el(doc, 'div', item.className || 'key', item.text));
        continue;
      }

      if (item.type === 'key') {
        rowEl.appendChild(el(doc, 'div', item.className || 'key', item.text));
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
      keyEl.title = (binding && (binding.description || binding.label)) || item.fallbackText || item.id;

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
    pop.innerHTML = `
      <div class="kp-popover-title"></div>
      <div class="kp-popover-keys"></div>
      <p class="kp-popover-desc"></p>
    `;
    container.appendChild(pop);
  }
  return pop;
}

function hidePopover(pop) {
  if (!pop) return;
  pop.hidden = true;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function showPopoverForTarget({ doc, pop, targetEl, binding, actionId, container }) {
  if (!doc || !pop || !targetEl) return;

  const titleEl = pop.querySelector('.kp-popover-title');
  const keysEl = pop.querySelector('.kp-popover-keys');
  const descEl = pop.querySelector('.kp-popover-desc');

  const title = (binding && binding.label) || actionId;
  const keys = (binding && (binding.displayKey || binding.keyLabel)) || '';
  const desc = (binding && (binding.description || binding.label)) || '';

  if (titleEl) titleEl.textContent = title;
  if (keysEl) keysEl.textContent = keys ? `Keys: ${keys}` : '';
  if (descEl) descEl.textContent = desc;

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
      click: null,
      keydown: null,
      docClick: null,
      docKeydown: null,
      resize: null
    };
  }

  // Remove existing handlers if re-attaching
  if (root._kpKeyHandlers.click) {
    const keyElements = root.querySelectorAll('[data-kp-action-id]');
    keyElements.forEach(keyEl => {
      if (root._kpKeyHandlers.click) keyEl.removeEventListener('click', root._kpKeyHandlers.click);
      if (root._kpKeyHandlers.keydown) keyEl.removeEventListener('keydown', root._kpKeyHandlers.keydown);
    });
  }

  function handleKeyClick(e) {
    // Handle clicks on button or its children (e.g., .key-main, .key-label)
    const keyEl = e.currentTarget;
    if (!keyEl || !keyEl.dataset || !keyEl.dataset.kpActionId) {
      // If currentTarget isn't the button (shouldn't happen), try to find it
      const button = e.target.closest('button[data-kp-action-id]');
      if (!button) return;
      const actionId = button.dataset.kpActionId;
      const binding = keybindings && keybindings[actionId];
      if (!binding) return;
      e.preventDefault();
      e.stopPropagation();
      showPopoverForTarget({ doc, pop, targetEl: button, binding, actionId, container: floatingContainer });
      return;
    }

    const actionId = keyEl.dataset.kpActionId;
    const binding = keybindings && keybindings[actionId];
    if (!binding) return;

    e.preventDefault();
    e.stopPropagation();
    showPopoverForTarget({ doc, pop, targetEl: keyEl, binding, actionId, container: floatingContainer });
  }

  function handleKeyKeydown(e) {
    const keyEl = e.currentTarget;
    if (!keyEl || !keyEl.dataset.kpActionId) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;

    const actionId = keyEl.dataset.kpActionId;
    const binding = keybindings && keybindings[actionId];
    if (!binding) return;

    e.preventDefault();
    e.stopPropagation();
    showPopoverForTarget({ doc, pop, targetEl: keyEl, binding, actionId, container: floatingContainer });
  }

  // Store handlers for cleanup
  root._kpKeyHandlers.click = handleKeyClick;
  root._kpKeyHandlers.keydown = handleKeyKeydown;

  // Attach handlers directly to each key element (can be button or div depending on context)
  const keyElements = root.querySelectorAll('[data-kp-action-id]');

  if (keyElements.length === 0) {
    console.warn('[KeyPilot] No key elements found for popover behavior in:', root);
  }

  keyElements.forEach(keyEl => {
    keyEl.addEventListener('click', handleKeyClick);
    keyEl.addEventListener('keydown', handleKeyKeydown);
  });

  // Close popover on outside click or Escape (only attach once)
  if (!root._kpKeyHandlers.docClick) {
    function handleDocClick(e) {
      if (pop.hidden) return;
      const insidePopover = pop.contains(e.target);
      if (!insidePopover) hidePopover(pop);
    }
    
    function handleDocKeydown(e) {
      if (e.key === 'Escape') hidePopover(pop);
    }
    
    function handleResize() {
      hidePopover(pop);
    }

    root._kpKeyHandlers.docClick = handleDocClick;
    root._kpKeyHandlers.docKeydown = handleDocKeydown;
    root._kpKeyHandlers.resize = handleResize;

    doc.addEventListener('click', handleDocClick, true);
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


