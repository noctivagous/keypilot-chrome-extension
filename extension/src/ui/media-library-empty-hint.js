/**
 * Media Library empty-state copy: dark-pro card, layout-aware kbd chips,
 * and Keyboard Reference / Layout Editor hints. DOM-only (TrustedHTML-safe).
 */

import { getMessage, localizeKeycapLabel } from '../utils/i18n.js';
import { altModifierLabel } from '../utils/platform.js';
import { getFunctionDef } from '../config/function-library.js';
import { getStockActionById, isStockActionId } from '../config/stock-actions.js';
import { getKeyboardHardwareLayout } from '../config/keyboard-hardware-layouts.js';
import {
  CHARACTER_SLOT_PREFIX,
  physicalCodeFromSlotKey
} from '../modules/keyboard-layout-store.js';
import { parseChordSlotKey } from '../utils/key-chord.js';
import { createTitlebarKbd } from './popover-titlebar.js';

const SLOT_MARK = (i) => `@@KP${i}@@`;
const SLOT_RE = /@@KP(\d+)@@/g;

function getKeyPilot() {
  try {
    return globalThis.window?.__KeyPilotInstance || null;
  } catch {
    return null;
  }
}

function functionIdsEqual(slotId, functionId, userActions) {
  const id = String(slotId || '');
  const want = String(functionId || '');
  if (!id || !want) return false;
  if (id === want) return true;
  if (id.startsWith('action:')) {
    const inst = (userActions || []).find((a) => a && a.id === id);
    return !!(inst && inst.functionId === want);
  }
  if (isStockActionId(id)) {
    return getStockActionById(id)?.functionId === want;
  }
  return false;
}

function legendForDomCode(code) {
  const raw = String(code || '');
  if (!raw) return '';
  const kp = getKeyPilot();
  const hw = getKeyboardHardwareLayout(kp?._settings?.keyboardHardwareLayoutId);
  for (const row of hw?.rows || []) {
    for (const key of row.keys || []) {
      if (key.code === raw) return localizeKeycapLabel(key.legends?.base || raw);
    }
  }
  if (/^Key[A-Z]$/.test(raw)) return raw.slice(3);
  if (/^Digit[0-9]$/.test(raw)) return raw.slice(5);
  return localizeKeycapLabel(raw);
}

/**
 * @param {string} slotKey
 * @returns {string[]}
 */
function labelsFromSlotKey(slotKey) {
  const chord = parseChordSlotKey(slotKey);
  if (chord) {
    const parts = [];
    if (chord.ctrl) parts.push('Ctrl');
    if (chord.alt) parts.push(altModifierLabel());
    if (chord.shift) parts.push('Shift');
    if (chord.meta) parts.push('Win');
    const token = String(chord.key || '');
    parts.push(legendForDomCode(token) || token);
    return parts.filter(Boolean);
  }
  const code = physicalCodeFromSlotKey(slotKey);
  if (code) {
    const label = legendForDomCode(code);
    return label ? [label] : [];
  }
  const raw = String(slotKey || '');
  if (raw.startsWith(CHARACTER_SLOT_PREFIX)) {
    const ch = raw.slice(CHARACTER_SLOT_PREFIX.length);
    return ch ? [ch] : [];
  }
  return raw ? [raw] : [];
}

/**
 * @param {string} functionId
 * @returns {string[][]}
 */
export function collectFunctionKeyGroups(functionId) {
  const kp = getKeyPilot();
  const want = String(functionId || '');
  if (!want) return [];
  /** @type {string[][]} */
  const groups = [];
  const sel = String(kp?._currentKeyboardLayoutId || '');
  if (sel.startsWith('user:') && kp._currentKeySlotMap && typeof kp._currentKeySlotMap === 'object') {
    for (const [slot, val] of Object.entries(kp._currentKeySlotMap)) {
      if (!val || (val.type !== 'function' && val.type !== 'action')) continue;
      if (!functionIdsEqual(val.id, want, kp._currentUserActions)) continue;
      const labels = labelsFromSlotKey(slot);
      if (labels.length) groups.push(labels);
    }
    return groups;
  }
  const kb = kp?.keybindings || {};
  for (const [actionId, binding] of Object.entries(kb)) {
    const fid = binding?.functionId || actionId;
    if (actionId !== want && fid !== want) continue;
    if (Array.isArray(binding?.keys) && binding.keys.length === 0) continue;
    if (binding?.displayKey) {
      groups.push([String(binding.displayKey)]);
      continue;
    }
    if (binding?.keyLabel) {
      groups.push([String(binding.keyLabel)]);
      continue;
    }
    if (binding?.bindingType === 'physical' && Array.isArray(binding.keys) && binding.keys[0]) {
      const label = legendForDomCode(String(binding.keys[0]));
      if (label) groups.push([label]);
    }
  }
  return groups;
}

function textNode(parent, value) {
  parent.appendChild(parent.ownerDocument.createTextNode(value));
}

function appendKeyGroups(parent, groups) {
  const doc = parent.ownerDocument;
  groups.forEach((group, gi) => {
    if (gi > 0) parent.appendChild(doc.createTextNode(' / '));
    (group || []).forEach((part, pi) => {
      if (pi > 0) parent.appendChild(doc.createTextNode(' + '));
      const kbd = createTitlebarKbd(doc, localizeKeycapLabel(part));
      kbd.classList.add('kpv2-media-lib-empty-kbd');
      parent.appendChild(kbd);
    });
  });
}

function appendPlaceOnKeyboardInner(parent) {
  const editor = getMessage('context_menu_group_layout_editor') || 'Keyboard Layout Editor';
  textNode(parent, getMessage('media_library_empty_place_on_keyboard', editor));
  textNode(parent, ', ');
  appendKeyGroups(parent, [[altModifierLabel(), 'C']]);
}

function appendPlaceOnKeyboardHint(parent) {
  textNode(parent, ' (');
  appendPlaceOnKeyboardInner(parent);
  textNode(parent, ')');
}

function appendFunctionToken(parent, functionId) {
  const label = getFunctionDef(functionId)?.label || functionId;
  textNode(parent, label);
  const groups = collectFunctionKeyGroups(functionId);
  if (groups.length) {
    textNode(parent, ' (');
    appendKeyGroups(parent, groups);
    textNode(parent, ')');
  } else {
    appendPlaceOnKeyboardHint(parent);
  }
}

function appendI18nSlots(parent, messageKey, slotFns) {
  const marks = slotFns.map((_, i) => SLOT_MARK(i));
  const filled = getMessage(messageKey, marks) || '';
  const doc = parent.ownerDocument;
  let last = 0;
  SLOT_RE.lastIndex = 0;
  let m = SLOT_RE.exec(filled);
  if (!m) {
    parent.appendChild(doc.createTextNode(filled));
    return;
  }
  while (m) {
    if (m.index > last) parent.appendChild(doc.createTextNode(filled.slice(last, m.index)));
    const fn = slotFns[Number(m[1])];
    if (typeof fn === 'function') fn(parent);
    last = m.index + m[0].length;
    m = SLOT_RE.exec(filled);
  }
  if (last < filled.length) parent.appendChild(doc.createTextNode(filled.slice(last)));
}

function destMediaLibrary() {
  return getMessage('fn_dest_media_library') || 'Media Library';
}

function destBoth() {
  return getMessage('media_library_empty_dest_both') || 'Both';
}

function keyboardReferenceTitle() {
  return getMessage('keyboard_help_title') || 'Keyboard Reference';
}

function appendClickKeyInReference(parent, functionId) {
  const groups = collectFunctionKeyGroups(functionId);
  const ref = keyboardReferenceTitle();
  if (groups.length) {
    appendI18nSlots(parent, 'media_library_empty_click_bound', [
      (p) => appendKeyGroups(p, groups),
      (p) => textNode(p, ref)
    ]);
    return;
  }
  appendI18nSlots(parent, 'media_library_empty_click_after_place', [
    (p) => appendPlaceOnKeyboardInner(p),
    (p) => textNode(p, ref)
  ]);
}

function appendCopyDestinationOption(li, functionId, destLabel) {
  appendI18nSlots(li, 'media_library_empty_opt_use_copy', [
    (p) => appendFunctionToken(p, functionId)
  ]);
  textNode(li, ' ');
  appendI18nSlots(li, 'media_library_empty_opt_set_dest', [
    (p) => textNode(p, destLabel)
  ]);
  textNode(li, ' ');
  appendClickKeyInReference(li, functionId);
}

function appendSendFromPageMediaOption(li, kindNounKey) {
  appendI18nSlots(li, 'media_library_empty_opt_send_page', [
    (p) => textNode(p, getMessage('page_media_action_send_title') || 'Send to Media Library'),
    (p) => textNode(p, getMessage(kindNounKey)),
    (p) => appendFunctionToken(p, 'PAGE_MEDIA')
  ]);
}

function addOption(ol, fill) {
  const li = ol.ownerDocument.createElement('li');
  fill(li);
  ol.appendChild(li);
}

/**
 * @param {Document} doc
 * @param {string} leadMessageKey
 * @param {string} howtoMessageKey
 * @param {(ol: HTMLOListElement) => void} fillList
 * @returns {HTMLElement}
 */
function wrapEmptyCard(doc, leadMessageKey, howtoMessageKey, fillList) {
  const wrap = doc.createElement('div');
  wrap.className = 'kpv2-media-lib-empty';
  const card = doc.createElement('div');
  card.className = 'kpv2-media-lib-empty-card';
  const lead = getMessage(leadMessageKey);
  if (lead) {
    const pLead = doc.createElement('p');
    pLead.className = 'kpv2-media-lib-empty-lead';
    pLead.textContent = lead;
    card.appendChild(pLead);
  }
  const howto = getMessage(howtoMessageKey);
  if (howto) {
    const pHow = doc.createElement('p');
    pHow.className = 'kpv2-media-lib-empty-howto';
    pHow.textContent = howto;
    card.appendChild(pHow);
  }
  const ol = doc.createElement('ol');
  ol.className = 'kpv2-media-lib-empty-list';
  fillList(ol);
  if (ol.childNodes.length) card.appendChild(ol);
  wrap.appendChild(card);
  return wrap;
}

/**
 * @param {Document} doc
 * @param {string} text
 * @returns {HTMLElement}
 */
export function createMediaLibraryEmptyTextCard(doc, text) {
  const wrap = doc.createElement('div');
  wrap.className = 'kpv2-media-lib-empty';
  const card = doc.createElement('div');
  card.className = 'kpv2-media-lib-empty-card';
  const p = doc.createElement('p');
  p.className = 'kpv2-media-lib-empty-body';
  p.textContent = String(text || '');
  card.appendChild(p);
  wrap.appendChild(card);
  return wrap;
}

/**
 * @param {Document} doc
 * @param {'image'|'video'|'document'|'url'} kind
 * @returns {HTMLElement}
 */
export function createMediaLibraryEmptyHint(doc, kind) {
  if (kind === 'url') {
    const dest = `${destMediaLibrary()} ${getMessage('media_library_empty_or') || 'or'} ${destBoth()}`;
    return wrapEmptyCard(doc, 'media_library_empty_urls', 'media_library_empty_howto_urls', (ol) => {
      addOption(ol, (li) => appendCopyDestinationOption(li, 'COPY_HOVERED_URL', dest));
      addOption(ol, (li) => {
        appendI18nSlots(li, 'media_library_empty_opt_add_url', [
          (p) => appendFunctionToken(p, 'ADD_URL_TO_MEDIA_LIBRARY')
        ]);
      });
    });
  }
  if (kind === 'video') {
    const dest = `${destMediaLibrary()} ${getMessage('media_library_empty_or') || 'or'} ${destBoth()}`;
    return wrapEmptyCard(doc, 'media_library_empty_videos', 'media_library_empty_howto_videos', (ol) => {
      addOption(ol, (li) => appendCopyDestinationOption(li, 'COPY_HOVERED_VIDEO', dest));
      addOption(ol, (li) => appendSendFromPageMediaOption(li, 'media_library_empty_kind_video'));
    });
  }
  if (kind === 'document') {
    return wrapEmptyCard(doc, 'media_library_empty_documents', 'media_library_empty_howto_documents', (ol) => {
      addOption(ol, (li) => {
        appendI18nSlots(li, 'media_library_empty_opt_fetch_url', [
          (p) => appendFunctionToken(p, 'FETCH_URL_FOR_MEDIA_LIBRARY')
        ]);
      });
      addOption(ol, (li) => appendSendFromPageMediaOption(li, 'media_library_empty_kind_document'));
    });
  }
  return wrapEmptyCard(doc, 'media_library_empty_images', 'media_library_empty_howto_images', (ol) => {
    addOption(ol, (li) => appendCopyDestinationOption(li, 'COPY_HOVERED_IMAGE', destMediaLibrary()));
    addOption(ol, (li) => appendSendFromPageMediaOption(li, 'media_library_empty_kind_image'));
  });
}
