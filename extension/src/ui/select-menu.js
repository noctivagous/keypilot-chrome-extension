/**
 * Custom select / menu list for KeyPilot chrome.
 *
 * Native <select> cannot host icons or titlebar kbd chips, and Click Element
 * cannot pick individual <option>s (OS picker). Items here are real buttons
 * with role="option" so hover + F-activate work.
 *
 * The list is a `position:fixed` node on `document.body` (never inside a
 * chrome window that clips overflow). It lives in its own open shadow so
 * host-page rules (e.g. `button { text-transform: uppercase }` on Windows
 * Central) cannot style the items. Popover top-layer was losing to the
 * Keyboard Ref compositor layer, so stacking is a plain z-index above
 * FLOATING_KEYBOARD_HELP.
 */

import { Z_INDEX } from '../config/constants.js';
import { applyThemeCssVars, applyThemeDataset, getActiveTheme } from '../modules/theme-manager.js';
import { getSelectMenuCss, getThemeIconUrl, getTitlebarChromeCss } from '../../themes/index.js';
import { ensureOpenChromeShadow, injectChromeStyles } from './kp-chrome-shadow.js';
import { createTitlebarKbd } from './popover-titlebar.js';

const STYLE_ATTR = 'data-kp-select-menu-style';

/**
 * Isolation for the body-mounted list host only. Do not inject this into
 * Keyboard Reference / Config shadows — `:host { all: initial }` would reset
 * those windows.
 */
const SELECT_LIST_HOST_CSS = `
:host {
  all: initial;
  display: block !important;
  position: fixed !important;
  z-index: ${Z_INDEX.SELECT_MENU} !important;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  overflow: visible !important;
  clip-path: none !important;
  pointer-events: none;
}
:host([hidden]) {
  display: none !important;
}
.kp-select-menu {
  pointer-events: auto;
}
`.trim();

let _idSeq = 0;

/**
 * @param {Element|null|undefined} el
 * @returns {string}
 */
function readComposedSurface(el) {
  let node = el;
  try {
    while (node) {
      const surface = node.getAttribute?.('data-kp-surface');
      if (surface) return String(surface);
      const next = node.parentElement;
      if (next) {
        node = next;
        continue;
      }
      const root = node.getRootNode?.();
      node = root && root !== node && root.host ? root.host : null;
    }
  } catch { /* ignore */ }
  return '';
}

/**
 * @param {Document|null|undefined} doc
 * @returns {HTMLElement|null}
 */
function getBodyMount(doc) {
  try {
    const d = doc?.defaultView?.document || doc || document;
    return d.body || d.documentElement || null;
  } catch {
    return document.body || document.documentElement || null;
  }
}

/**
 * @param {Document|ShadowRoot|null|undefined} root
 */
function ensureSelectMenuStyles(root) {
  if (!root) return;
  injectChromeStyles(root, {
    attr: STYLE_ATTR,
    css: `${getTitlebarChromeCss()}\n${getSelectMenuCss()}`
  });
}

/**
 * @param {Document} doc
 * @param {string} [iconId]
 * @param {string} className
 * @returns {HTMLElement|null}
 */
function createSelectIcon(doc, iconId, className) {
  const id = typeof iconId === 'string' && iconId.trim() ? iconId.trim() : '';
  if (!id) return null;
  const el = doc.createElement('span');
  el.className = className;
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('data-kp-theme-icon', id);
  try {
    const url = getThemeIconUrl(id, getActiveTheme());
    if (url) {
      const img = `url("${String(url).replace(/"/g, '\\"')}")`;
      el.style.webkitMaskImage = img;
      el.style.maskImage = img;
    }
  } catch { /* ignore */ }
  return el;
}

/**
 * @param {HTMLElement} list
 */
function themeListHost(list) {
  try {
    const theme = getActiveTheme();
    applyThemeDataset(list, theme);
    applyThemeCssVars(list, theme);
  } catch { /* ignore */ }
}

/**
 * @typedef {object} SelectMenuChoice
 * @property {string} value
 * @property {string} label
 * @property {string} [icon]
 * @property {string} [shortcut]
 * @property {boolean} [disabled]
 */

/**
 * @typedef {{ type: 'group', label: string } | { type: 'separator' } | SelectMenuChoice} SelectMenuOption
 */

/**
 * @param {{
 *   doc?: Document,
 *   ariaLabel?: string,
 *   value?: string,
 *   variant?: 'titlebar' | 'field',
 *   className?: string,
 *   options?: SelectMenuOption[],
 *   onChange?: (value: string, previous: string|null) => void,
 * }} [config]
 */
export function createSelectMenu(config = {}) {
  const doc = config.doc || document;
  const variant = config.variant === 'field' ? 'field' : 'titlebar';
  const listId = `kp-select-list-${++_idSeq}`;

  /** @type {SelectMenuOption[]} */
  let options = Array.isArray(config.options) ? config.options.slice() : [];
  /** @type {string|null} */
  let currentValue = config.value != null ? String(config.value) : null;
  let disabled = false;
  /** @type {boolean} */
  let fallbackOpen = false;
  /** @type {HTMLElement|null} */
  let listHost = null;

  const root = doc.createElement('div');
  root.className = `kp-select kp-select--${variant}${config.className ? ` ${config.className}` : ''}`;
  root.setAttribute('data-kp-select', 'true');

  const trigger = doc.createElement('button');
  trigger.type = 'button';
  trigger.className = 'kp-select-trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', listId);
  if (config.ariaLabel) trigger.setAttribute('aria-label', config.ariaLabel);

  const triggerIcon = doc.createElement('span');
  triggerIcon.className = 'kp-select-trigger-icon';
  triggerIcon.setAttribute('aria-hidden', 'true');
  triggerIcon.hidden = true;

  const triggerLabel = doc.createElement('span');
  triggerLabel.className = 'kp-select-trigger-label';

  const chevron = doc.createElement('span');
  chevron.className = 'kp-select-chevron';
  chevron.setAttribute('aria-hidden', 'true');

  trigger.appendChild(triggerIcon);
  trigger.appendChild(triggerLabel);
  trigger.appendChild(chevron);
  root.appendChild(trigger);

  const list = doc.createElement('div');
  list.id = listId;
  list.className = 'kp-select-menu';
  list.setAttribute('role', 'listbox');
  if (config.ariaLabel) list.setAttribute('aria-label', config.ariaLabel);
  try { list.style.setProperty('position', 'fixed', 'important'); } catch { /* ignore */ }
  try { list.style.setProperty('z-index', String(Z_INDEX.SELECT_MENU), 'important'); } catch {
    list.style.zIndex = String(Z_INDEX.SELECT_MENU);
  }
  list.setAttribute('data-kp-select-fallback', 'true');
  list.hidden = true;
  try { list.style.setProperty('display', 'none', 'important'); } catch { /* ignore */ }

  const stopDrag = (e) => {
    try { e.stopPropagation(); } catch { /* ignore */ }
  };
  trigger.addEventListener('pointerdown', stopDrag, true);
  trigger.addEventListener('mousedown', stopDrag, true);
  list.addEventListener('pointerdown', stopDrag, true);
  list.addEventListener('mousedown', stopDrag, true);

  const choiceOptions = () => options.filter((o) => o && o.type !== 'group' && o.type !== 'separator' && o.value != null);

  const findChoice = (value) => choiceOptions().find((o) => String(o.value) === String(value)) || null;

  const syncTrigger = () => {
    const choice = findChoice(currentValue);
    const label = choice?.label != null ? String(choice.label) : (currentValue ? String(currentValue) : '');
    triggerLabel.textContent = label;
    const iconId = choice?.icon;
    let showIcon = false;
    if (iconId) {
      try {
        triggerIcon.setAttribute('data-kp-theme-icon', iconId);
        const url = getThemeIconUrl(iconId, getActiveTheme());
        if (url) {
          const img = `url("${String(url).replace(/"/g, '\\"')}")`;
          triggerIcon.style.webkitMaskImage = img;
          triggerIcon.style.maskImage = img;
          showIcon = true;
        }
      } catch { /* ignore */ }
    }
    if (!showIcon) {
      triggerIcon.removeAttribute('data-kp-theme-icon');
      triggerIcon.style.webkitMaskImage = '';
      triggerIcon.style.maskImage = '';
    }
    triggerIcon.hidden = !showIcon;
  };

  const isListOpen = () => fallbackOpen;

  const setExpanded = (open) => {
    try { trigger.setAttribute('aria-expanded', open ? 'true' : 'false'); } catch { /* ignore */ }
    try { root.classList.toggle('is-open', !!open); } catch { /* ignore */ }
  };

  const positionList = () => {
    let tr;
    try { tr = trigger.getBoundingClientRect(); } catch { return; }
    if (!tr) return;
    const minW = Math.max(tr.width, variant === 'titlebar' ? 190 : 160);
    list.style.minWidth = `${Math.round(minW)}px`;
    list.style.left = `${Math.round(tr.left)}px`;
    list.style.top = `${Math.round(tr.bottom + 4)}px`;
    let lr;
    try { lr = list.getBoundingClientRect(); } catch { return; }
    const spaceBelow = window.innerHeight - tr.bottom;
    const openUp = lr.height + 8 > spaceBelow && tr.top > spaceBelow;
    if (openUp) {
      list.style.top = `${Math.max(8, Math.round(tr.top - lr.height - 4))}px`;
    }
    try { lr = list.getBoundingClientRect(); } catch { return; }
    if (lr.right > window.innerWidth - 8) {
      list.style.left = `${Math.max(8, Math.round(window.innerWidth - lr.width - 8))}px`;
    }
    if (lr.left < 8) list.style.left = '8px';
  };

  const setHostOpen = (open) => {
    if (!listHost) return;
    listHost.hidden = !open;
    try {
      if (open) listHost.style.removeProperty('display');
      else listHost.style.setProperty('display', 'none', 'important');
    } catch { /* ignore */ }
  };

  const closeFallback = () => {
    fallbackOpen = false;
    list.hidden = true;
    try { list.style.setProperty('display', 'none', 'important'); } catch { /* ignore */ }
    setHostOpen(false);
    setExpanded(false);
    try { doc.removeEventListener('pointerdown', onDocPointerDown, true); } catch { /* ignore */ }
  };

  const onDocPointerDown = (e) => {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    if (path.includes(list) || path.includes(trigger) || path.includes(root)) return;
    closeFallback();
  };

  const syncListSurface = () => {
    const surface = readComposedSurface(trigger) || readComposedSurface(root);
    try {
      if (surface) {
        list.setAttribute('data-kp-surface', surface);
        listHost?.setAttribute('data-kp-surface', surface);
      } else {
        list.removeAttribute('data-kp-surface');
        listHost?.removeAttribute('data-kp-surface');
      }
    } catch { /* ignore */ }
  };

  const openList = () => {
    if (disabled) return;
    mountList();
    syncListSurface();
    if (listHost) themeListHost(listHost);
    themeListHost(list);
    fallbackOpen = true;
    setHostOpen(true);
    list.hidden = false;
    try { list.style.setProperty('display', 'block', 'important'); } catch { /* ignore */ }
    setExpanded(true);
    positionList();
    try { doc.addEventListener('pointerdown', onDocPointerDown, true); } catch { /* ignore */ }
  };

  const closeList = () => {
    closeFallback();
  };

  const toggleList = () => {
    if (isListOpen()) closeList();
    else openList();
  };

  const pickValue = (value) => {
    const next = String(value);
    const prev = currentValue;
    currentValue = next;
    paintSelection();
    syncTrigger();
    closeList();
    if (typeof config.onChange === 'function' && next !== prev) {
      try { config.onChange(next, prev); } catch { /* ignore */ }
    }
  };

  const paintSelection = () => {
    const items = list.querySelectorAll('.kp-select-item');
    for (const btn of items) {
      const selected = btn.getAttribute('data-kp-select-value') === String(currentValue);
      try { btn.setAttribute('aria-selected', selected ? 'true' : 'false'); } catch { /* ignore */ }
      try { btn.classList.toggle('is-active', false); } catch { /* ignore */ }
    }
  };

  const rebuildList = () => {
    while (list.firstChild) list.removeChild(list.firstChild);
    for (const opt of options) {
      if (!opt) continue;
      if (opt.type === 'separator') {
        const hr = doc.createElement('div');
        hr.className = 'kp-select-separator';
        hr.setAttribute('role', 'separator');
        list.appendChild(hr);
        continue;
      }
      if (opt.type === 'group') {
        const g = doc.createElement('div');
        g.className = 'kp-select-group';
        g.textContent = String(opt.label || '');
        list.appendChild(g);
        continue;
      }
      if (opt.value == null) continue;
      const value = String(opt.value);
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'kp-select-item';
      btn.setAttribute('role', 'option');
      btn.setAttribute('data-kp-select-value', value);
      btn.setAttribute('aria-selected', value === String(currentValue) ? 'true' : 'false');
      if (opt.disabled) btn.disabled = true;

      const icon = createSelectIcon(doc, opt.icon, 'kp-select-item-icon');
      if (icon) btn.appendChild(icon);

      const lab = doc.createElement('span');
      lab.className = 'kp-select-item-label';
      lab.textContent = String(opt.label || value);
      btn.appendChild(lab);

      if (opt.shortcut) {
        const kbd = createTitlebarKbd(doc, opt.shortcut);
        btn.appendChild(kbd);
      }

      btn.addEventListener('click', (e) => {
        try { e.preventDefault(); e.stopPropagation(); } catch { /* ignore */ }
        if (btn.disabled) return;
        pickValue(value);
      });
      btn.addEventListener('pointerdown', stopDrag, true);
      list.appendChild(btn);
    }
    paintSelection();
    syncTrigger();
  };

  trigger.addEventListener('click', (e) => {
    try { e.stopPropagation(); } catch { /* ignore */ }
    try { e.preventDefault(); } catch { /* ignore */ }
    if (disabled) return;
    toggleList();
  });

  trigger.addEventListener('keydown', (e) => {
    const key = e?.key;
    if (key === 'ArrowDown' || key === 'Enter' || key === ' ') {
      try { e.preventDefault(); e.stopPropagation(); } catch { /* ignore */ }
      if (!isListOpen()) openList();
    } else if (key === 'Escape' && isListOpen()) {
      try { e.preventDefault(); e.stopPropagation(); } catch { /* ignore */ }
      closeList();
    }
  });

  list.addEventListener('keydown', (e) => {
    if (e?.key === 'Escape') {
      try { e.preventDefault(); } catch { /* ignore */ }
      closeList();
      try { trigger.focus(); } catch { /* ignore */ }
    }
  });

  const ensureListHost = () => {
    if (listHost) return listHost;
    listHost = doc.createElement('div');
    listHost.className = 'kp-select-menu-host';
    listHost.setAttribute('data-kp-select', 'true');
    listHost.hidden = true;
    try { listHost.style.setProperty('display', 'none', 'important'); } catch { /* ignore */ }
    const shadow = ensureOpenChromeShadow(listHost, { id: 'select-menu' });
    // Cut-corner clip on a 0×0 host would hide the fixed list.
    try { listHost.removeAttribute('data-kp-corner'); } catch { /* ignore */ }
    try { listHost.classList.remove('kp-chrome-window'); } catch { /* ignore */ }
    if (shadow) {
      injectChromeStyles(shadow, {
        attr: STYLE_ATTR,
        css: `${SELECT_LIST_HOST_CSS}\n${getTitlebarChromeCss()}\n${getSelectMenuCss()}`
      });
      try { shadow.appendChild(list); } catch { /* ignore */ }
    } else {
      try { listHost.appendChild(list); } catch { /* ignore */ }
    }
    themeListHost(listHost);
    themeListHost(list);
    syncListSurface();
    return listHost;
  };

  const mountList = () => {
    const host = ensureListHost();
    const parent = getBodyMount(doc);
    if (parent && host.parentNode !== parent) {
      try { parent.appendChild(host); } catch { /* ignore */ }
    }
  };

  const triggerRoot = () => {
    try { return trigger.getRootNode?.() || null; } catch { return null; }
  };

  rebuildList();
  mountList();
  try {
    const rn = triggerRoot();
    if (rn && rn !== doc) ensureSelectMenuStyles(rn);
  } catch { /* ignore */ }

  return {
    root,
    list,
    trigger,
    getValue() {
      return currentValue;
    },
    setValue(value, opts = {}) {
      currentValue = value != null ? String(value) : null;
      paintSelection();
      syncTrigger();
      if (!opts.silent && typeof config.onChange === 'function') {
        try { config.onChange(currentValue, null); } catch { /* ignore */ }
      }
    },
    setOptions(next) {
      options = Array.isArray(next) ? next.slice() : [];
      rebuildList();
    },
    setDisabled(next) {
      disabled = !!next;
      trigger.disabled = disabled;
      if (disabled) closeList();
    },
    open: openList,
    close: closeList,
    destroy() {
      closeList();
      try { doc.removeEventListener('pointerdown', onDocPointerDown, true); } catch { /* ignore */ }
      try { listHost?.remove(); } catch {
        try { listHost?.parentNode?.removeChild(listHost); } catch { /* ignore */ }
      }
      listHost = null;
      try { list.remove(); } catch {
        try { list.parentNode?.removeChild(list); } catch { /* ignore */ }
      }
      try { root.remove(); } catch { /* ignore */ }
    }
  };
}

/**
 * Replace the visible face of an existing native select while retaining the
 * native control as the value/event bridge for older callers. This lets
 * existing form code continue to read `.value` and listen for `change`.
 *
 * @param {HTMLSelectElement|null|undefined} select
 * @param {{ variant?: 'titlebar'|'field', className?: string }} [opts]
 * @returns {ReturnType<typeof createSelectMenu>|null}
 */
export function enhanceNativeSelect(select, opts = {}) {
  if (!select || select.dataset?.kpSelectEnhanced === 'true') return null;
  const doc = select.ownerDocument || document;
  const options = Array.from(select.options || []).map((option) => ({
    value: String(option.value),
    label: String(option.textContent || option.label || option.value),
    disabled: !!option.disabled
  }));
  const menu = createSelectMenu({
    doc,
    ariaLabel: select.getAttribute('aria-label') || undefined,
    value: select.value,
    variant: opts.variant === 'titlebar' ? 'titlebar' : 'field',
    className: opts.className || select.className || '',
    options,
    onChange: (value) => {
      select.value = value;
      try {
        select.dispatchEvent(new Event('change', { bubbles: true }));
      } catch {
        try {
          select.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
        } catch { /* ignore */ }
      }
    }
  });
  select.dataset.kpSelectEnhanced = 'true';
  select.setAttribute('aria-hidden', 'true');
  try { select.style.setProperty('display', 'none', 'important'); } catch { /* ignore */ }
  try { select.parentNode?.insertBefore(menu.root, select.nextSibling); } catch { /* ignore */ }
  menu.setDisabled(!!select.disabled);
  let observer = null;
  const api = {
    ...menu,
    syncFromNative() {
      menu.setOptions(Array.from(select.options || []).map((option) => ({
        value: String(option.value),
        label: String(option.textContent || option.label || option.value),
        disabled: !!option.disabled
      })));
      menu.setValue(select.value, { silent: true });
      menu.setDisabled(!!select.disabled);
    },
    destroy() {
      try { observer?.disconnect?.(); } catch { /* ignore */ }
      observer = null;
      menu.destroy();
    }
  };
  try {
    const target = doc.documentElement || doc.body;
    if (target && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => {
        if (!select.isConnected) api.destroy();
      });
      observer.observe(target, { childList: true, subtree: true });
    }
  } catch { /* ignore */ }
  // Kept on the native bridge for callers that still update its options/value.
  select._kpSelectMenu = api;
  return api;
}
