import {
  BUILTIN_KEYBOARD_LAYOUT_META,
  buildKeybindingsForLayout,
  normalizeKeyboardLayoutId
} from '../src/config/keyboard-layouts.js';
import { getSettings, SETTINGS_STORAGE_KEY } from '../src/modules/settings-manager.js';
import { startKeyPilotOnPage } from './keypilot-page-init.js';
import { MSG } from '../src/messaging/types.js';

function postCloseRequest() {
  try {
    window.parent.postMessage({ type: MSG.POPOVER_REQUEST_CLOSE, key: 'Escape' }, '*');
  } catch {
    // ignore
  }
}

/**
 * Close the Guide popover (if embedded) and open the walkthrough in a reset state.
 * Prefer parent postMessage when embedded; fall back to runtime/local APIs standalone.
 */
function launchWalkthrough() {
  const embedded = (() => {
    try {
      return !!(window.parent && window.parent !== window);
    } catch {
      return false;
    }
  })();

  if (embedded) {
    try {
      window.parent.postMessage({ type: MSG.POPOVER_LAUNCH_WALKTHROUGH }, '*');
      return;
    } catch {
      // fall through
    }
  }

  // Standalone guide tab (or postMessage failed): reset/open locally if possible.
  try {
    const ob = window.__KeyPilotOnboarding;
    if (ob && typeof ob.resetTutorial === 'function') {
      void ob.resetTutorial();
      return;
    }
  } catch {
    // ignore
  }

  try {
    void chrome.runtime.sendMessage({ type: MSG.LAUNCH_WALKTHROUGH });
  } catch {
    // ignore
  }
}

/**
 * When Guide is embedded in the KeyPilot iframe popover, the outer chrome
 * already provides a standard titlebar + × close. Hide the in-page header so
 * we don't stack two header bars.
 */
function adaptHeaderForPopoverEmbed() {
  try {
    const embedded = window.parent && window.parent !== window;
    if (!embedded) return;
    document.documentElement.classList.add('kp-popover-embed');
    document.body?.classList?.add('kp-popover-embed');
    const header = document.querySelector('main.wrap > .header, .header');
    if (header) {
      header.hidden = true;
      header.setAttribute('aria-hidden', 'true');
    }
  } catch {
    // ignore
  }
}

/**
 * @param {Record<string, any>|null|undefined} bindings
 * @param {string} actionId
 * @returns {string}
 */
function displayKeyFor(bindings, actionId) {
  const b = bindings?.[actionId];
  if (!b) return '';
  if (typeof b.displayKey === 'string' && b.displayKey.trim()) return b.displayKey.trim();
  if (typeof b.keyLabel === 'string' && b.keyLabel.trim()) return b.keyLabel.trim();
  if (Array.isArray(b.keys) && b.keys.length) return String(b.keys[0]);
  return '';
}

/**
 * Unique display labels for one or more action ids (e.g. BACK + BACK2).
 * @param {Record<string, any>} bindings
 * @param {string[]} actionIds
 * @returns {string[]}
 */
function labelsForActions(bindings, actionIds) {
  const seen = new Set();
  const out = [];
  for (const id of actionIds) {
    const label = displayKeyFor(bindings, id);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

/**
 * Build: [kbd] / [kbd] … + trailing description text.
 * @param {string[]} keyLabels
 * @param {string} description
 * @returns {HTMLLIElement}
 */
function createGuideListItem(keyLabels, description) {
  const li = document.createElement('li');
  const labels = (Array.isArray(keyLabels) ? keyLabels : []).filter((k) => k != null && String(k).length);
  labels.forEach((label, i) => {
    if (i > 0) li.appendChild(document.createTextNode(' / '));
    const kbd = document.createElement('kbd');
    kbd.textContent = String(label);
    li.appendChild(kbd);
  });
  if (description) {
    const needsSpace = labels.length > 0;
    li.appendChild(document.createTextNode(needsSpace ? ` ${description}` : description));
  }
  return li;
}

/**
 * @param {HTMLElement|null} listEl
 * @param {Array<{ keys: string[], text: string }>} rows
 */
function fillList(listEl, rows) {
  if (!listEl) return;
  listEl.replaceChildren();
  for (const row of rows) {
    if (!row) continue;
    listEl.appendChild(createGuideListItem(row.keys, row.text));
  }
}

/**
 * @param {string} layoutId
 * @returns {string}
 */
function layoutLabelText(layoutId) {
  const id = normalizeKeyboardLayoutId(layoutId);
  const meta = BUILTIN_KEYBOARD_LAYOUT_META.find((m) => m.id === id);
  return meta?.label || id;
}

/**
 * Render guide lists from the active keyboard layout.
 * @param {string} [layoutIdRaw]
 */
function renderGuideForLayout(layoutIdRaw) {
  const layoutId = normalizeKeyboardLayoutId(layoutIdRaw);
  const bindings = buildKeybindingsForLayout(layoutId);

  const layoutLabelEl = document.getElementById('layout-label');
  if (layoutLabelEl) {
    const label = layoutLabelText(layoutId);
    layoutLabelEl.textContent = `Layout: ${label}`;
    layoutLabelEl.hidden = false;
    layoutLabelEl.title = label;
  }

  const activate = labelsForActions(bindings, ['ACTIVATE']);
  const back = labelsForActions(bindings, ['BACK', 'BACK2']);
  const root = labelsForActions(bindings, ['ROOT']);
  const forward = labelsForActions(bindings, ['FORWARD']);
  const tabs = labelsForActions(bindings, ['TAB_LEFT', 'TAB_RIGHT']);
  const omnibox = labelsForActions(bindings, ['OMNIBOX']);
  const cancel = labelsForActions(bindings, ['CANCEL']);
  const openPopover = labelsForActions(bindings, ['OPEN_POPOVER']);
  const settings = labelsForActions(bindings, ['OPEN_SETTINGS_POPOVER']);
  const scroll = labelsForActions(bindings, [
    'PAGE_TOP',
    'PAGE_BOTTOM',
    'PAGE_UP_INSTANT',
    'PAGE_DOWN_INSTANT'
  ]);

  fillList(document.getElementById('guide-core-list'), [
    { keys: activate, text: 'click element under the KeyPilot cursor' },
    { keys: back, text: 'back' },
    { keys: root, text: 'site root' },
    { keys: forward, text: 'forward' },
    { keys: tabs, text: 'tab left/right' },
    { keys: omnibox, text: 'omnibox' },
    { keys: cancel, text: 'cancel / exit' }
  ]);

  fillList(document.getElementById('guide-popover-list'), [
    { keys: openPopover, text: 'open link-under-cursor in popover' },
    { keys: settings, text: 'open Settings popover' },
    { keys: scroll, text: 'scroll' },
    { keys: cancel, text: 'close' }
  ]);
}

async function refreshGuideFromSettings() {
  try {
    const settings = await getSettings();
    renderGuideForLayout(settings?.keyboardLayoutId);
  } catch {
    renderGuideForLayout(undefined);
  }
}

function installSettingsListener() {
  try {
    chrome.storage?.onChanged?.addListener((changes, area) => {
      if (area !== 'sync' && area !== 'local') return;
      if (!changes || !changes[SETTINGS_STORAGE_KEY]) return;
      void refreshGuideFromSettings();
    });
  } catch {
    // ignore
  }
}

async function init() {
  adaptHeaderForPopoverEmbed();

  // Paint layout-aware keys ASAP (before KeyPilot boot), then keep in sync.
  await refreshGuideFromSettings();
  installSettingsListener();

  // Start KeyPilot inside the Guide page (this page is often loaded in an iframe popover).
  await startKeyPilotOnPage({ allowInIframe: true });

  const openSettingsBtn = document.getElementById('open-settings');
  const closeBtn = document.getElementById('close');
  const launchWalkthroughBtn = document.getElementById('launch-walkthrough');

  openSettingsBtn?.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ type: MSG.OPEN_SETTINGS_POPOVER });
    } catch {
      // ignore
    }
  }, true);

  closeBtn?.addEventListener('click', () => postCloseRequest(), true);
  launchWalkthroughBtn?.addEventListener('click', () => launchWalkthrough(), true);
}

init();
