/**
 * Shared KeyPilot hub cards used by the extension popup and the Top Sites
 * "KeyPilot" tab. Visual chrome matches Top Sites tiles (80px NCT cards).
 */
import { getActionIconDataUri } from './keybindings-ui-shared.js';
import {
  NCT_DARK_UI_COLORS,
  NCT_DARK_UI_FONT
} from './nct-dark-ui.js';
import { getSettings, setSettings } from '../modules/settings-manager.js';

export const KP_KEYBOARD_HELP_STORAGE_KEY = 'keypilot_keyboard_help_visible';
export const ONBOARDING_ACTIVE_STORAGE_KEY = 'keypilot_onboarding_active';

/** @typedef {'keyboard'|'docs'|'tutorial'|'settings'|'control-strip'} KeypilotHubAction */

/**
 * @typedef {object} KeypilotHubCardDef
 * @property {KeypilotHubAction} action
 * @property {string} title
 * @property {string} icon
 * @property {string} hint
 * @property {'switch'|'button'} role
 */

/** @type {readonly KeypilotHubCardDef[]} */
export const KEYPILOT_HUB_CARDS = Object.freeze([
  Object.freeze({
    action: 'keyboard',
    title: 'Keyboard Reference',
    icon: 'TOGGLE_KEYBOARD_HELP',
    hint: 'K',
    role: 'switch'
  }),
  Object.freeze({
    action: 'docs',
    title: 'Help / Docs',
    icon: 'LOOKUP_WORD',
    hint: 'Alt+H',
    meta: 'Documentation',
    role: 'button'
  }),
  Object.freeze({
    action: 'tutorial',
    title: 'Onboarding Tutorial',
    icon: 'LAUNCHER',
    hint: 'Alt+I',
    meta: 'Walkthrough',
    role: 'button'
  }),
  Object.freeze({
    action: 'settings',
    title: 'Settings',
    icon: 'OPEN_SETTINGS_POPOVER',
    hint: "'",
    meta: 'Preferences',
    role: 'button'
  }),
  Object.freeze({
    action: 'control-strip',
    title: 'Control Strip',
    icon: 'TOP_SITES',
    hint: 'Alt+J',
    role: 'switch'
  })
]);

export async function queryKeyboardHelpVisible() {
  try {
    const syncResult = await chrome.storage.sync.get([KP_KEYBOARD_HELP_STORAGE_KEY]);
    if (typeof syncResult?.[KP_KEYBOARD_HELP_STORAGE_KEY] === 'boolean') {
      return syncResult[KP_KEYBOARD_HELP_STORAGE_KEY];
    }
  } catch { /* ignore */ }
  try {
    const localResult = await chrome.storage.local.get([KP_KEYBOARD_HELP_STORAGE_KEY]);
    if (typeof localResult?.[KP_KEYBOARD_HELP_STORAGE_KEY] === 'boolean') {
      return localResult[KP_KEYBOARD_HELP_STORAGE_KEY];
    }
  } catch { /* ignore */ }
  return true;
}

export async function setKeyboardHelpVisible(visible) {
  const desired = Boolean(visible);
  const payload = { [KP_KEYBOARD_HELP_STORAGE_KEY]: desired, timestamp: Date.now() };
  try { await chrome.storage.sync.set(payload); } catch { /* ignore */ }
  try { await chrome.storage.local.set(payload); } catch { /* ignore */ }
  return desired;
}

export async function queryControlStripVisible() {
  try {
    const settings = await getSettings();
    return settings?.controlStrip?.visible !== false;
  } catch {
    return true;
  }
}

export async function setControlStripVisible(visible) {
  const desired = Boolean(visible);
  await setSettings({ controlStrip: { visible: desired } });
  return desired;
}

export async function queryOnboardingActive() {
  try {
    const syncResult = await chrome.storage.sync.get([ONBOARDING_ACTIVE_STORAGE_KEY]);
    if (typeof syncResult?.[ONBOARDING_ACTIVE_STORAGE_KEY] === 'boolean') {
      return syncResult[ONBOARDING_ACTIVE_STORAGE_KEY];
    }
  } catch { /* ignore */ }
  try {
    const localResult = await chrome.storage.local.get([ONBOARDING_ACTIVE_STORAGE_KEY]);
    if (typeof localResult?.[ONBOARDING_ACTIVE_STORAGE_KEY] === 'boolean') {
      return localResult[ONBOARDING_ACTIVE_STORAGE_KEY];
    }
  } catch { /* ignore */ }
  return false;
}

/**
 * @param {HTMLElement} card
 * @param {boolean} on
 * @param {string} [statusText]
 */
export function paintHubToggleCard(card, on, statusText) {
  if (!card) return;
  const visible = Boolean(on);
  card.classList.toggle('is-on', visible);
  if (card.getAttribute('role') === 'switch') {
    card.setAttribute('aria-checked', visible ? 'true' : 'false');
  }
  const status = card.querySelector('[data-status]');
  if (status) status.textContent = statusText ?? (visible ? 'ON' : 'OFF');
}

/**
 * @param {HTMLElement} card
 * @param {boolean} active
 */
export function paintHubOnboardingCard(card, active) {
  if (!card) return;
  const on = Boolean(active);
  card.classList.toggle('is-on', on);
  const status = card.querySelector('[data-status]');
  if (status) status.textContent = on ? 'ACTIVE' : 'Walkthrough';
}

/**
 * @param {ParentNode} root
 */
export async function refreshKeypilotHubCards(root) {
  if (!root) return;
  const keyboard = root.querySelector('[data-action="keyboard"]');
  const controlStrip = root.querySelector('[data-action="control-strip"]');
  const tutorial = root.querySelector('[data-action="tutorial"]');
  try {
    paintHubToggleCard(keyboard, await queryKeyboardHelpVisible());
  } catch {
    paintHubToggleCard(keyboard, true);
  }
  try {
    paintHubToggleCard(controlStrip, await queryControlStripVisible());
  } catch {
    paintHubToggleCard(controlStrip, true);
  }
  try {
    paintHubOnboardingCard(tutorial, await queryOnboardingActive());
  } catch {
    paintHubOnboardingCard(tutorial, false);
  }
}

/**
 * @param {Document} doc
 * @param {KeypilotHubCardDef} def
 * @returns {HTMLButtonElement}
 */
export function createKeypilotHubCard(doc, def) {
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = 'kp-url-row kp-hub-card';
  btn.dataset.action = def.action;
  btn.setAttribute('aria-label', def.title);
  if (def.role === 'switch') {
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-checked', 'false');
  }

  const content = doc.createElement('span');
  content.className = 'kp-url-content';

  const icon = doc.createElement('span');
  icon.className = 'kp-url-favicon kp-hub-icon';
  icon.setAttribute('aria-hidden', 'true');
  const uri = getActionIconDataUri(def.icon, { fill: 'rgba(255,255,255,0.94)' });
  if (uri) icon.style.setProperty('--kp-hub-icon', uri);

  const text = doc.createElement('span');
  text.className = 'kp-url-text';

  const title = doc.createElement('span');
  title.className = 'kp-url-domain';
  title.textContent = def.title;

  const meta = doc.createElement('span');
  meta.className = 'kp-url-title';
  meta.dataset.status = '';
  meta.textContent = def.role === 'switch' ? '…' : (def.meta || def.hint);

  const path = doc.createElement('span');
  path.className = 'kp-url-path';
  path.textContent = def.hint;

  text.append(title, meta, path);
  content.append(icon, text);
  btn.append(content);

  if (def.role === 'switch') {
    const sw = doc.createElement('span');
    sw.className = 'kp-hub-switch';
    sw.setAttribute('aria-hidden', 'true');
    const track = doc.createElement('span');
    track.className = 'kp-hub-switch-track';
    const thumb = doc.createElement('span');
    thumb.className = 'kp-hub-switch-thumb';
    track.append(thumb);
    sw.append(track);
    btn.append(sw);
  }

  return btn;
}

/**
 * Card chrome matching Top Sites tiles, for the extension popup (no shadow).
 * @returns {string}
 */
export function getKeypilotHubCardCss() {
  const c = NCT_DARK_UI_COLORS;
  return `
.kp-hub-card.kp-url-row,
.hub-card.kp-url-row {
  box-sizing: border-box;
  display: block;
  position: relative;
  align-self: start;
  width: 100%;
  height: 80px;
  min-height: 80px;
  max-height: 80px;
  padding: 8px 9px;
  border-radius: 10px;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  user-select: none;
  overflow: hidden;
  margin: 0;
  min-width: 0;
  appearance: none;
  -webkit-appearance: none;
  font-family: ${NCT_DARK_UI_FONT};
  text-align: left;
  background: linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 48%, ${c.btnBot} 100%);
  border: 1px solid ${c.panelEdgeDark};
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.18),
    inset 0 -1px 0 rgba(0,0,0,0.45),
    0 4px 10px rgba(0,0,0,0.38);
}

.kp-hub-card.kp-url-row:hover,
.hub-card.kp-url-row:hover {
  transform: translateY(-1px);
  background: linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 48%, ${c.btnBot} 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.22),
    inset 0 -1px 0 rgba(0,0,0,0.5),
    0 8px 16px rgba(0,0,0,0.45);
}

.kp-hub-card.kp-url-row:focus-visible,
.hub-card.kp-url-row:focus-visible,
.kp-hub-card.kp-url-row--selected,
.hub-card.kp-url-row.is-on {
  outline: none;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.18),
    0 0 0 2px ${c.litEdge},
    0 6px 14px rgba(0,0,0,0.4);
}

.kp-hub-card.kp-url-row:disabled,
.hub-card.kp-url-row:disabled {
  opacity: 0.55;
  cursor: wait;
  transform: none;
}

.kp-hub-card .kp-url-content,
.hub-card .kp-url-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 4px;
}

.kp-hub-card .kp-url-favicon,
.hub-card .kp-url-favicon,
.kp-hub-icon {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  flex: 0 0 auto;
  background-color: rgba(255,255,255,0.94);
  background-image: none;
  -webkit-mask: var(--kp-hub-icon) center / contain no-repeat;
  mask: var(--kp-hub-icon) center / contain no-repeat;
}

.kp-hub-card .kp-url-text,
.hub-card .kp-url-text {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  justify-content: flex-end;
}

.kp-hub-card .kp-url-domain,
.kp-hub-card .kp-url-title,
.kp-hub-card .kp-url-path,
.hub-card .kp-url-domain,
.hub-card .kp-url-title,
.hub-card .kp-url-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kp-hub-card .kp-url-domain,
.hub-card .kp-url-domain {
  font-size: 12px;
  font-weight: 800;
  color: rgba(255,255,255,0.94);
}

.kp-hub-card .kp-url-title,
.hub-card .kp-url-title {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255,255,255,0.78);
}

.kp-hub-card .kp-url-path,
.hub-card .kp-url-path {
  font-size: 10px;
  color: rgba(255,255,255,0.55);
}

.kp-hub-card.is-on .kp-url-title,
.hub-card.is-on .kp-url-title {
  color: #7dcea0;
}

.kp-hub-card .kp-hub-switch,
.hub-card .kp-hub-switch {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  pointer-events: none;
}

.kp-hub-card .kp-hub-switch-track,
.hub-card .kp-hub-switch-track {
  display: block;
  box-sizing: border-box;
  width: 32px;
  height: 16px;
  padding: 2px;
  border-radius: 3px;
  border: 1px solid rgba(248, 113, 113, 0.4);
  background: rgba(248, 113, 113, 0.18);
  transition: background 140ms ease, border-color 140ms ease;
}

.kp-hub-card .kp-hub-switch-thumb,
.hub-card .kp-hub-switch-thumb {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  transform: translateX(0);
  transition: transform 140ms ease, background 140ms ease;
}

.kp-hub-card.is-on .kp-hub-switch-track,
.hub-card.is-on .kp-hub-switch-track,
.kp-hub-card[aria-checked="true"] .kp-hub-switch-track,
.hub-card[aria-checked="true"] .kp-hub-switch-track {
  border-color: rgba(16, 185, 129, 0.5);
  background: rgba(16, 185, 129, 0.28);
}

.kp-hub-card.is-on .kp-hub-switch-thumb,
.hub-card.is-on .kp-hub-switch-thumb,
.kp-hub-card[aria-checked="true"] .kp-hub-switch-thumb,
.hub-card[aria-checked="true"] .kp-hub-switch-thumb {
  transform: translateX(16px);
  background: #ecfdf5;
}
`.trim();
}
