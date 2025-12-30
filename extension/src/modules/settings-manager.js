/**
 * Settings storage + helpers.
 *
 * Stored in chrome.storage.sync so values sync across Chrome profiles and across tabs.
 */

import { CURSOR_MODE } from '../config/constants.js';

export const SETTINGS_STORAGE_KEY = 'kp_settings_v1';

/** @typedef {'brave'|'google'|'duckduckgo'} SearchEngine */

/** @typedef {'crosshair'|'native_arrow'|'native_pointer'} ClickCursorType */
/** @typedef {'t_square'|'crosshair'} TextCursorType */
/** @typedef {typeof CURSOR_MODE[keyof typeof CURSOR_MODE]} CursorMode */

/**
 * @typedef {{
 *   type: ClickCursorType,
 *   lineWidth: number,
 *   sizePixels: number,
 *   gap: number
 * }} ClickCursorSettings
 */

/**
 * @typedef {{
 *   cursor: ClickCursorSettings,
 *   overlayFillEnabled: boolean,
 *   rectangleThickness: number
 * }} ClickModeSettings
 */

/**
 * @typedef {{
 *   cursorType: TextCursorType,
 *   labelsEnabled: boolean,
 *   strokeThickness: number
 * }} TextModeSettings
 */

/**
 * @typedef {{
 *   searchEngine: SearchEngine,
 *   cursorMode: CursorMode,
 *   keyboardReferenceKeyFeedback: boolean,
 *   clickMode: ClickModeSettings,
 *   textMode: TextModeSettings
 * }} KeyPilotSettings
 */

/** @type {KeyPilotSettings} */
export const DEFAULT_SETTINGS = Object.freeze({
  searchEngine: 'brave',
  cursorMode: CURSOR_MODE.NO_CUSTOM_CURSORS,
  // When true, the floating keyboard reference panel highlights keys on keydown/keyup.
  keyboardReferenceKeyFeedback: true,
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: 'crosshair',
      // Cursor SVG stroke width. Slider range: 1–12.
      lineWidth: 4,
      // Cursor size in pixels. Default is half of previous (was ~30px, now 15px).
      sizePixels: 10,
      // Gap between center and crosshair bars in pixels. 0 = intersecting lines, >0 = separate bars.
      gap: 6
    }),
    // When true, the green focus rectangle can include a translucent fill (where applicable).
    overlayFillEnabled: true,
    // Focus rectangle border thickness in px.
    rectangleThickness: 3
  }),
  textMode: Object.freeze({
    cursorType: 't_square',
    // When true, show both labels: "Active text field" + "Press ESC to close".
    labelsEnabled: false,
    // Stroke thickness in px for orange text-mode rectangles.
    strokeThickness: 3
  })
});

export const SEARCH_ENGINE_META = Object.freeze({
  brave: Object.freeze({
    id: 'brave',
    label: 'Brave',
    homeUrl: 'https://search.brave.com/',
    searchUrlPrefix: 'https://search.brave.com/search?q='
  }),
  google: Object.freeze({
    id: 'google',
    label: 'Google',
    homeUrl: 'https://www.google.com/',
    searchUrlPrefix: 'https://www.google.com/search?q='
  }),
  duckduckgo: Object.freeze({
    id: 'duckduckgo',
    label: 'DuckDuckGo',
    homeUrl: 'https://duckduckgo.com/',
    searchUrlPrefix: 'https://duckduckgo.com/?q='
  })
});

/**
 * @param {any} raw
 * @returns {SearchEngine}
 */
export function normalizeSearchEngine(raw) {
  if (raw === 'google' || raw === 'duckduckgo' || raw === 'brave') return raw;
  return DEFAULT_SETTINGS.searchEngine;
}

/**
 * @param {any} raw
 * @returns {CursorMode}
 */
export function normalizeCursorMode(raw) {
  if (raw === CURSOR_MODE.NO_CUSTOM_CURSORS || raw === CURSOR_MODE.CUSTOM_CURSORS) return raw;
  return DEFAULT_SETTINGS.cursorMode;
}

/**
 * @param {any} raw
 * @param {boolean} fallback
 */
function normalizeBoolean(raw, fallback) {
  if (raw === true || raw === false) return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return !!fallback;
}

/**
 * @param {any} raw
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 */
function normalizeNumber(raw, fallback, min, max) {
  const n = typeof raw === 'number' ? raw : (typeof raw === 'string' ? Number(raw) : NaN);
  const v = Number.isFinite(n) ? n : fallback;
  const clamped = Math.min(Math.max(v, min), max);
  return clamped;
}

/**
 * @param {any} raw
 * @returns {ClickCursorType}
 */
function normalizeClickCursorType(raw) {
  if (raw === 'crosshair' || raw === 'native_arrow' || raw === 'native_pointer') return raw;
  return DEFAULT_SETTINGS.clickMode.cursor.type;
}

/**
 * @param {any} raw
 * @returns {TextCursorType}
 */
function normalizeTextCursorType(raw) {
  if (raw === 't_square' || raw === 'crosshair') return raw;
  return DEFAULT_SETTINGS.textMode.cursorType;
}

/**
 * @param {any} raw
 * @returns {ClickModeSettings}
 */
function normalizeClickMode(raw) {
  const stored = raw && typeof raw === 'object' ? raw : {};
  const storedCursor = stored.cursor && typeof stored.cursor === 'object' ? stored.cursor : {};
  return {
    cursor: {
      type: normalizeClickCursorType(storedCursor.type),
      lineWidth: normalizeNumber(
        storedCursor.lineWidth,
        DEFAULT_SETTINGS.clickMode.cursor.lineWidth,
        1,
        12
      ),
      sizePixels: normalizeNumber(
        storedCursor.sizePixels,
        DEFAULT_SETTINGS.clickMode.cursor.sizePixels,
        5,
        60
      ),
      gap: normalizeNumber(
        storedCursor.gap,
        DEFAULT_SETTINGS.clickMode.cursor.gap,
        0,
        20
      )
    },
    overlayFillEnabled: normalizeBoolean(
      stored.overlayFillEnabled,
      DEFAULT_SETTINGS.clickMode.overlayFillEnabled
    ),
    rectangleThickness: normalizeNumber(
      stored.rectangleThickness,
      DEFAULT_SETTINGS.clickMode.rectangleThickness,
      1,
      16
    )
  };
}

/**
 * @param {any} raw
 * @returns {TextModeSettings}
 */
function normalizeTextMode(raw) {
  const stored = raw && typeof raw === 'object' ? raw : {};
  return {
    cursorType: normalizeTextCursorType(stored.cursorType),
    labelsEnabled: normalizeBoolean(stored.labelsEnabled, DEFAULT_SETTINGS.textMode.labelsEnabled),
    strokeThickness: normalizeNumber(
      stored.strokeThickness,
      DEFAULT_SETTINGS.textMode.strokeThickness,
      1,
      16
    )
  };
}

/**
 * @returns {Promise<KeyPilotSettings>}
 */
export async function getSettings() {
  try {
    const result = await chrome.storage.sync.get(SETTINGS_STORAGE_KEY);
    const stored = result && result[SETTINGS_STORAGE_KEY] ? result[SETTINGS_STORAGE_KEY] : {};
    return {
      ...DEFAULT_SETTINGS,
      ...(stored && typeof stored === 'object' ? stored : {}),
      searchEngine: normalizeSearchEngine(stored?.searchEngine),
      cursorMode: normalizeCursorMode(stored?.cursorMode),
      keyboardReferenceKeyFeedback: normalizeBoolean(
        stored?.keyboardReferenceKeyFeedback,
        DEFAULT_SETTINGS.keyboardReferenceKeyFeedback
      ),
      clickMode: normalizeClickMode(stored?.clickMode),
      textMode: normalizeTextMode(stored?.textMode)
    };
  } catch (_e) {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * @param {Partial<KeyPilotSettings>} partial
 * @returns {Promise<KeyPilotSettings>}
 */
export async function setSettings(partial) {
  const current = await getSettings();
  const p = partial && typeof partial === 'object' ? partial : {};

  // Shallow merge for top-level, plus deep merge for known nested settings.
  /** @type {KeyPilotSettings} */
  const next = {
    ...current,
    ...p,
    clickMode: {
      ...current.clickMode,
      ...(p.clickMode && typeof p.clickMode === 'object' ? p.clickMode : {}),
      cursor: {
        ...current.clickMode.cursor,
        ...(p.clickMode && typeof p.clickMode === 'object' && p.clickMode.cursor && typeof p.clickMode.cursor === 'object'
          ? p.clickMode.cursor
          : {})
      }
    },
    textMode: {
      ...current.textMode,
      ...(p.textMode && typeof p.textMode === 'object' ? p.textMode : {})
    }
  };
  next.searchEngine = normalizeSearchEngine(next.searchEngine);
  next.cursorMode = normalizeCursorMode(next.cursorMode);
  next.keyboardReferenceKeyFeedback = normalizeBoolean(
    next.keyboardReferenceKeyFeedback,
    DEFAULT_SETTINGS.keyboardReferenceKeyFeedback
  );
  next.clickMode = normalizeClickMode(next.clickMode);
  next.textMode = normalizeTextMode(next.textMode);
  try {
    await chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: next });
  } catch (_e) {
    // ignore
  }
  return next;
}

/**
 * @param {SearchEngine} engine
 * @param {string} query
 */
export function buildSearchUrl(engine, query) {
  const meta = SEARCH_ENGINE_META[normalizeSearchEngine(engine)];
  const q = typeof query === 'string' ? query : '';
  return `${meta.searchUrlPrefix}${encodeURIComponent(q)}`;
}

/**
 * @param {SearchEngine} engine
 */
export function getEngineHomeUrl(engine) {
  const meta = SEARCH_ENGINE_META[normalizeSearchEngine(engine)];
  return meta.homeUrl;
}


