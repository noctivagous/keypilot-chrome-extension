/**
 * Deferred opening settings window.
 * Mounted from the settings UI bundle into its own popover.
 */

import { getFunctionDef } from '../src/config/function-library.js';
import { getStockActionById } from '../src/config/stock-actions.js';
import { bindSettingsControls, writeSettingsInputValue } from '../src/modules/settings-binder.js';
import { createSettingsController } from '../src/modules/settings-controller.js';
import {
  getUserActionById,
  getUserKeyboardLayoutById,
  getUserMacroById,
  upsertUserKeyboardLayout
} from '../src/modules/keyboard-layout-store.js';
import { DEFAULT_SETTINGS } from '../src/modules/settings-manager.js';
import { getMessage, localizeElements } from '../src/utils/i18n.js';
import {
  applyDeferredNumberRowSlots,
  clearDeferredNumberRowSlots,
  inspectDeferredNumberRowSlots
} from '../src/utils/deferred-number-row.js';

/** @type {Document|ShadowRoot} */
let scope = document;
/** @type {import('../src/modules/settings-controller.js').SettingsController|null} */
let controller = null;
/** @type {(() => void)|null} */
let unsubscribe = null;
/** @type {AbortController|null} */
let abort = null;
/** @type {'enable'|'assign'|null} */
let conflictMode = null;

function el(id) {
  if (!scope || !id) return null;
  try {
    if (typeof scope.getElementById === 'function') {
      const hit = scope.getElementById(id);
      if (hit) return hit;
    }
  } catch { /* ignore */ }
  try {
    return scope.querySelector?.(`#${CSS.escape(id)}`) || null;
  } catch {
    return null;
  }
}

function all(sel) {
  try { return scope.querySelectorAll(sel); } catch { return []; }
}

function setInputValue(node, value) {
  writeSettingsInputValue(node, value);
}

/**
 * @param {{ type?: string, id?: string }} assigned
 * @returns {Promise<string>}
 */
async function labelForAssignment(assigned) {
  const id = String(assigned?.id || '');
  if (assigned?.type === 'macro') {
    try {
      const macro = await getUserMacroById(id);
      if (macro?.label) return String(macro.label);
    } catch { /* ignore */ }
    return id;
  }
  if (id.startsWith('action:')) {
    try {
      const action = await getUserActionById(id);
      if (action?.label) return String(action.label);
      const def = getFunctionDef(action?.functionId);
      if (def?.label) return String(def.label);
    } catch { /* ignore */ }
  }
  if (id.startsWith('stock:')) {
    const stock = getStockActionById(id);
    if (stock?.label) return String(stock.label);
  }
  const named = getMessage(`fn_${id}_label`);
  return named || id;
}

function hideConflict() {
  conflictMode = null;
  const box = el('deferred-open-conflict');
  if (box) box.hidden = true;
  const list = el('deferred-open-conflict-list');
  if (list) list.replaceChildren();
}

/**
 * @param {Array<{ label: string, current: { type: string, id: string } }>} conflicts
 * @param {'enable'|'assign'} mode
 */
async function showConflict(conflicts, mode) {
  conflictMode = mode;
  const box = el('deferred-open-conflict');
  const list = el('deferred-open-conflict-list');
  if (!box || !list) return;
  list.replaceChildren();
  for (const conflict of conflicts) {
    const item = document.createElement('li');
    const name = await labelForAssignment(conflict.current);
    item.textContent = getMessage('deferred_open_conflict_item', [conflict.label, name])
      || `${conflict.label} is ${name}`;
    list.appendChild(item);
  }
  box.hidden = false;
}

/**
 * @returns {Promise<{ id: string, layout: any }|null>}
 */
async function activeUserLayout() {
  const sel = String(controller?.state?.currentKeyboardLayoutId || '');
  if (!sel.startsWith('user:')) return null;
  const id = sel.slice('user:'.length);
  const layout = await getUserKeyboardLayoutById(id);
  return layout ? { id, layout } : null;
}

/**
 * @param {{ numberRowKeys: 'applied'|'kept'|'auto', showNumberRow?: boolean }} patch
 */
async function commitEnabled(patch) {
  /** @type {Record<string, any>} */
  const partial = {
    deferredOpen: {
      enabled: true,
      numberRowKeys: patch.numberRowKeys
    }
  };
  if (patch.showNumberRow) partial.keyboardReferenceShowNumberRow = true;
  await controller.updatePartial(partial);
}

async function writeLayoutSlots(layout, slots) {
  await upsertUserKeyboardLayout({ ...layout, slots });
}

async function turnOff() {
  hideConflict();
  const active = await activeUserLayout();
  if (active) {
    const next = clearDeferredNumberRowSlots(active.layout.slots);
    await writeLayoutSlots(active.layout, next);
  }
  await controller.updatePartial({
    deferredOpen: { enabled: false, numberRowKeys: 'auto' }
  });
}

/**
 * @param {'enable'|'assign'} mode
 */
async function requestNumberRow(mode) {
  const active = await activeUserLayout();
  if (!active) {
    await commitEnabled({ numberRowKeys: 'applied', showNumberRow: true });
    hideConflict();
    return;
  }
  const inspection = inspectDeferredNumberRowSlots(active.layout.slots);
  if (inspection.conflicts.length) {
    await showConflict(inspection.conflicts, mode);
    return;
  }
  if (inspection.needsWrite) {
    await writeLayoutSlots(active.layout, applyDeferredNumberRowSlots(active.layout.slots));
  }
  await commitEnabled({ numberRowKeys: 'applied', showNumberRow: true });
  hideConflict();
}

async function replaceConflictKeys() {
  const mode = conflictMode;
  const active = await activeUserLayout();
  if (active) {
    await writeLayoutSlots(active.layout, applyDeferredNumberRowSlots(active.layout.slots));
  }
  hideConflict();
  if (mode === 'assign' && controller?.state?.deferredOpen?.enabled === true) {
    await controller.updatePartial({
      deferredOpen: { numberRowKeys: 'applied' },
      keyboardReferenceShowNumberRow: true
    });
    return;
  }
  await commitEnabled({ numberRowKeys: 'applied', showNumberRow: true });
}

async function keepConflictKeys() {
  const mode = conflictMode;
  hideConflict();
  if (mode === 'assign' && controller?.state?.deferredOpen?.enabled === true) {
    await controller.updatePartial({ deferredOpen: { numberRowKeys: 'kept' } });
    return;
  }
  await commitEnabled({ numberRowKeys: 'kept' });
}

/**
 * @param {string} inputId
 * @param {string} textId
 * @param {boolean} on
 */
function paintSwitch(inputId, textId, on) {
  const input = /** @type {HTMLInputElement|null} */ (el(inputId));
  if (input) input.checked = !!on;
  const text = el(textId);
  if (!text) return;
  text.textContent = getMessage(on ? 'settings_state_on' : 'settings_state_off');
  text.setAttribute('data-state', on ? 'on' : 'off');
}

function cancelConflict() {
  const mode = conflictMode;
  hideConflict();
  if (mode === 'enable') paintSwitch('deferred-open-enabled', 'deferred-open-enabled-text', false);
}

function applyDeferredOpen(deferredOpen) {
  const value = deferredOpen || DEFAULT_SETTINGS.deferredOpen;
  const openUrls = value.openUrls || DEFAULT_SETTINGS.deferredOpen.openUrls;
  const randomBookmarks = value.randomBookmarks || DEFAULT_SETTINGS.deferredOpen.randomBookmarks;
  const clickElement = value.clickElement || DEFAULT_SETTINGS.deferredOpen.clickElement;
  const closeTab = value.closeTab || DEFAULT_SETTINGS.deferredOpen.closeTab;
  const closeWindow = value.closeWindow || DEFAULT_SETTINGS.deferredOpen.closeWindow;
  if (!conflictMode) {
    paintSwitch('deferred-open-enabled', 'deferred-open-enabled-text', value.enabled === true);
  }
  const urls = /** @type {HTMLInputElement|null} */ (el('deferred-open-urls-enabled'));
  if (urls) urls.checked = openUrls.enabled !== false;
  setInputValue(el('deferred-open-urls-min-range'), openUrls.minMinutes);
  setInputValue(el('deferred-open-urls-min-number'), openUrls.minMinutes);
  setInputValue(el('deferred-open-urls-max-range'), openUrls.maxMinutes);
  setInputValue(el('deferred-open-urls-max-number'), openUrls.maxMinutes);
  const bookmarks = /** @type {HTMLInputElement|null} */ (el('deferred-random-bookmarks-enabled'));
  if (bookmarks) bookmarks.checked = randomBookmarks.enabled !== false;
  setInputValue(el('deferred-random-bookmarks-min-range'), randomBookmarks.minMinutes);
  setInputValue(el('deferred-random-bookmarks-min-number'), randomBookmarks.minMinutes);
  setInputValue(el('deferred-random-bookmarks-max-range'), randomBookmarks.maxMinutes);
  setInputValue(el('deferred-random-bookmarks-max-number'), randomBookmarks.maxMinutes);
  const click = /** @type {HTMLInputElement|null} */ (el('deferred-click-element-enabled'));
  if (click) click.checked = clickElement.enabled !== false;
  setInputValue(el('deferred-click-element-min-range'), clickElement.minMinutes);
  setInputValue(el('deferred-click-element-min-number'), clickElement.minMinutes);
  setInputValue(el('deferred-click-element-max-range'), clickElement.maxMinutes);
  setInputValue(el('deferred-click-element-max-number'), clickElement.maxMinutes);
  const closeTabToggle = /** @type {HTMLInputElement|null} */ (el('deferred-close-tab-enabled'));
  if (closeTabToggle) closeTabToggle.checked = closeTab.enabled !== false;
  setInputValue(el('deferred-close-tab-min-range'), closeTab.minMinutes);
  setInputValue(el('deferred-close-tab-min-number'), closeTab.minMinutes);
  setInputValue(el('deferred-close-tab-max-range'), closeTab.maxMinutes);
  setInputValue(el('deferred-close-tab-max-number'), closeTab.maxMinutes);
  const closeWindowToggle = /** @type {HTMLInputElement|null} */ (el('deferred-close-window-enabled'));
  if (closeWindowToggle) closeWindowToggle.checked = closeWindow.enabled !== false;
  setInputValue(el('deferred-close-window-min-range'), closeWindow.minMinutes);
  setInputValue(el('deferred-close-window-min-number'), closeWindow.minMinutes);
  setInputValue(el('deferred-close-window-max-range'), closeWindow.maxMinutes);
  setInputValue(el('deferred-close-window-max-number'), closeWindow.maxMinutes);
  setInputValue(el('deferred-open-target'), value.target === 'originalWindow' ? 'originalWindow' : 'activeWindow');
  paintSwitch('deferred-silent-random', 'deferred-silent-random-text', value.silentRandomScheduling === true);
}

async function injectDom(root) {
  if (root.querySelector?.('.deferred-open-app')) return;
  const url = chrome.runtime.getURL('pages/settings.html');
  const stylesheetHrefs = ['pages/ui-standards.css', 'pages/settings.css'];
  const [html, ...cssTexts] = await Promise.all([
    fetch(url).then((res) => res.text()),
    ...stylesheetHrefs.map((href) => fetch(chrome.runtime.getURL(href)).then((res) => res.text()))
  ]);
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  for (const cssText of cssTexts) {
    const style = document.createElement('style');
    style.textContent = cssText;
    root.appendChild(style);
  }
  const template = parsed.querySelector('#deferred-open-template');
  const fragment = template?.content?.cloneNode(true);
  if (fragment) root.appendChild(fragment);
}

/**
 * @param {Document|ShadowRoot} root
 */
export async function mountDeferredOpenApp(root) {
  scope = root && root.nodeType !== 9 ? root : document;
  if (scope !== document) await injectDom(scope);
  localizeElements(scope);
  abort?.abort();
  abort = new AbortController();
  const signal = abort.signal;
  controller = createSettingsController();
  unsubscribe = controller.subscribe((settings) => applyDeferredOpen(settings?.deferredOpen));
  let live = null;
  try {
    const kp = window.__KeyPilotInstance || window.keyPilot;
    if (kp?._settings) live = kp._settings;
  } catch { /* ignore */ }
  await controller.load({ snapshot: live });

  bindSettingsControls({
    controller,
    el,
    all,
    setInputValue,
    signal
  });

  const listen = { signal, capture: true };
  el('deferred-open-enabled')?.addEventListener('change', () => {
    const toggle = /** @type {HTMLInputElement|null} */ (el('deferred-open-enabled'));
    if (!toggle) return;
    paintSwitch('deferred-open-enabled', 'deferred-open-enabled-text', toggle.checked);
    if (toggle.checked) {
      void requestNumberRow('enable');
      return;
    }
    void turnOff();
  }, listen);
  el('deferred-silent-random')?.addEventListener('change', () => {
    const input = /** @type {HTMLInputElement|null} */ (el('deferred-silent-random'));
    paintSwitch('deferred-silent-random', 'deferred-silent-random-text', !!input?.checked);
  }, listen);
  el('deferred-open-assign-keys')?.addEventListener('click', () => {
    const enabled = controller?.state?.deferredOpen?.enabled === true;
    if (!enabled) {
      paintSwitch('deferred-open-enabled', 'deferred-open-enabled-text', true);
    }
    void requestNumberRow(enabled ? 'assign' : 'enable');
  }, listen);
  el('deferred-open-conflict-replace')?.addEventListener('click', () => {
    void replaceConflictKeys();
  }, listen);
  el('deferred-open-conflict-keep')?.addEventListener('click', () => {
    void keepConflictKeys();
  }, listen);
  el('deferred-open-conflict-cancel')?.addEventListener('click', () => {
    cancelConflict();
  }, listen);

  return () => {
    try { abort?.abort(); } catch { /* ignore */ }
    abort = null;
    try { unsubscribe?.(); } catch { /* ignore */ }
    unsubscribe = null;
    try { controller?.dispose(); } catch { /* ignore */ }
    controller = null;
    scope = document;
    conflictMode = null;
  };
}
