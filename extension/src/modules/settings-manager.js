/**
 * Settings storage + helpers.
 *
 * Stored in chrome.storage.sync so values sync across Chrome profiles and across tabs.
 */

import { CURSOR_MODE, SCROLL } from '../config/constants.js';
import { DEFAULT_KEYBOARD_LAYOUT_ID, normalizeKeyboardLayoutId } from '../config/keyboard-layouts.js';
import {
  SEARCH_ENGINE_META,
  DEFAULT_SEARCH_ENGINE_ID,
  normalizeSearchEngineId,
  getSearchEngineMeta
} from '../config/search-engines.js';
import { storageGetValue, storageSetValue } from '../utils/storage.js';

export const SETTINGS_STORAGE_KEY = 'kp_settings_v1';

// Re-export search engine catalog so consumers can keep importing from settings-manager.
export { SEARCH_ENGINE_META, DEFAULT_SEARCH_ENGINE_ID, getSearchEngineMeta };

/** @typedef {import('../config/search-engines.js').SearchEngineId} SearchEngine */

/** @typedef {'crosshair'|'native_arrow'|'native_pointer'} ClickCursorType */
/** @typedef {'t_square'|'crosshair'} TextCursorType */
/** @typedef {'left_edge'|'background_tint'} TextFocusStyle */
/** @typedef {typeof CURSOR_MODE[keyof typeof CURSOR_MODE]} CursorMode */
/** @typedef {'smooth'|'instant'} ScrollSpeed */
/** @typedef {'flash'|'dash'|'marquee'|'scale'|'none'} ClickEffect */

/** Valid text-mode focus field styles (order is settings UI preference). */
export const TEXT_FOCUS_STYLE_IDS = Object.freeze(/** @type {const} */ ([
  'left_edge',
  'background_tint'
]));

/** Valid F-key click activation effects (order is settings UI preference). */
export const CLICK_EFFECT_IDS = Object.freeze(/** @type {const} */ ([
  'flash',
  'dash',
  'marquee',
  'scale',
  'none'
]));

/**
 * @typedef {{
 *   type: ClickCursorType,
 *   lineWidth: number,
 *   sizePixels: number,
 *   gap: number
 * }} ClickCursorSettings
 */

/** @typedef {'blue'|'green'} FocusColor */

/**
 * @typedef {{
 *   cursor: ClickCursorSettings,
 *   focusColor: FocusColor,
 *   overlayFillEnabled: boolean,
 *   overlayShadowEnabled: boolean,
 *   rectangleThickness: number,
 *   clickEffect: ClickEffect
 * }} ClickModeSettings
 */

/**
 * @typedef {{
 *   cursorType: TextCursorType,
 *   labelsEnabled: boolean,
 *   strokeThickness: number,
 *   focusStyle: TextFocusStyle
 * }} TextModeSettings
 */

/**
 * @typedef {{
 *   halfPagePx: number,
 *   speed: ScrollSpeed
 * }} ScrollSettings
 */

/**
 * @typedef {{
 *   visible: boolean,
 *   collapsed: boolean
 * }} ControlStripSettings
 */

/**
 * @typedef {{
 *   searchEngine: SearchEngine,
 *   cursorMode: CursorMode,
 *   keyboardLayoutId: string,
 *   keyboardReferenceKeyFeedback: boolean,
 *   controlStrip: ControlStripSettings,
 *   clickMode: ClickModeSettings,
 *   textMode: TextModeSettings,
 *   scroll: ScrollSettings
 * }} KeyPilotSettings
 */

/** @type {KeyPilotSettings} */
export const DEFAULT_SETTINGS = Object.freeze({
  searchEngine: DEFAULT_SEARCH_ENGINE_ID,
  cursorMode: CURSOR_MODE.NO_CUSTOM_CURSORS,
  keyboardLayoutId: DEFAULT_KEYBOARD_LAYOUT_ID,
  // When true, the floating keyboard reference panel highlights keys on keydown/keyup.
  keyboardReferenceKeyFeedback: true,
  // Floating Control Strip (upper-left): visibility + collapsed (On/Off-only) state.
  controlStrip: Object.freeze({
    visible: true,
    collapsed: true
  }),
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
    // Hover focus ring color (DOM-hover mode default is blue).
    focusColor: 'blue',
    // When true, the focus rectangle can include a translucent fill (where applicable).
    overlayFillEnabled: false,
    // When true, draw a soft outer glow/shadow on the focus rectangle.
    overlayShadowEnabled: false,
    // Focus rectangle border thickness in px.
    rectangleThickness: 3,
    // F-key activation feedback on link-style targets (flash is the default).
    clickEffect: 'flash'
  }),
  textMode: Object.freeze({
    cursorType: 't_square',
    // When true, show both labels: "Active text field" + "Press ESC to close".
    labelsEnabled: false,
    // Stroke thickness in px for orange text-mode rectangles.
    strokeThickness: 3,
    // How the focused text field is styled while in text mode.
    // left_edge: 10px pulsating orange bar on the left inset edge (default).
    // background_tint: full-field orange wash (legacy).
    focusStyle: 'left_edge'
  }),
  scroll: Object.freeze({
    // C / V scroll distance in pixels (default = prior 400 × 1.25).
    halfPagePx: SCROLL.HALF_PAGE_PX,
    // Animation speed for keyboard scrolling: smooth (animated) or instant (jump).
    speed: SCROLL.BEHAVIOR === 'smooth' ? 'smooth' : 'instant'
  })
});

/**
 * @param {any} raw
 * @returns {SearchEngine}
 */
export function normalizeSearchEngine(raw) {
  return normalizeSearchEngineId(raw);
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
 * @returns {ClickEffect}
 */
function normalizeClickEffect(raw) {
  if (raw === 'flash' || raw === 'dash' || raw === 'marquee' || raw === 'scale' || raw === 'none') {
    return raw;
  }
  return DEFAULT_SETTINGS.clickMode.clickEffect;
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
 * @returns {TextFocusStyle}
 */
export function normalizeTextFocusStyle(raw) {
  if (raw === 'left_edge' || raw === 'background_tint') return raw;
  return DEFAULT_SETTINGS.textMode.focusStyle;
}

/**
 * @param {any} raw
 * @returns {FocusColor}
 */
export function normalizeFocusColor(raw) {
  if (raw === 'blue' || raw === 'green') return raw;
  return DEFAULT_SETTINGS.clickMode.focusColor;
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
    focusColor: normalizeFocusColor(stored.focusColor),
    overlayFillEnabled: normalizeBoolean(
      stored.overlayFillEnabled,
      DEFAULT_SETTINGS.clickMode.overlayFillEnabled
    ),
    overlayShadowEnabled: normalizeBoolean(
      stored.overlayShadowEnabled,
      DEFAULT_SETTINGS.clickMode.overlayShadowEnabled
    ),
    rectangleThickness: normalizeNumber(
      stored.rectangleThickness,
      DEFAULT_SETTINGS.clickMode.rectangleThickness,
      1,
      16
    ),
    clickEffect: normalizeClickEffect(stored.clickEffect)
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
    ),
    focusStyle: normalizeTextFocusStyle(stored.focusStyle)
  };
}

/**
 * @param {any} raw
 * @returns {ScrollSpeed}
 */
function normalizeScrollSpeed(raw) {
  if (raw === 'smooth' || raw === 'instant') return raw;
  // Accept CSS scroll-behavior aliases from older/local experiments.
  if (raw === 'auto') return 'instant';
  return DEFAULT_SETTINGS.scroll.speed;
}

/**
 * @param {any} raw
 * @returns {ScrollSettings}
 */
function normalizeScroll(raw) {
  const stored = raw && typeof raw === 'object' ? raw : {};
  return {
    halfPagePx: normalizeNumber(
      stored.halfPagePx,
      DEFAULT_SETTINGS.scroll.halfPagePx,
      50,
      2000
    ),
    speed: normalizeScrollSpeed(stored.speed)
  };
}

/**
 * @param {any} raw
 * @returns {ControlStripSettings}
 */
function normalizeControlStrip(raw) {
  const stored = raw && typeof raw === 'object' ? raw : {};
  return {
    visible: normalizeBoolean(stored.visible, DEFAULT_SETTINGS.controlStrip.visible),
    collapsed: normalizeBoolean(stored.collapsed, DEFAULT_SETTINGS.controlStrip.collapsed)
  };
}

/**
 * Map Settings scroll speed to ScrollOptions.behavior.
 * @param {ScrollSpeed|string|undefined|null} speed
 * @returns {'smooth'|'auto'}
 */
export function scrollBehaviorFromSpeed(speed) {
  return normalizeScrollSpeed(speed) === 'instant' ? 'auto' : 'smooth';
}

/**
 * @returns {Promise<KeyPilotSettings>}
 */
export async function getSettings() {
  try {
    let stored = await storageGetValue(SETTINGS_STORAGE_KEY, null);
    if (!stored || typeof stored !== 'object') stored = {};
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      searchEngine: normalizeSearchEngine(stored?.searchEngine),
      cursorMode: normalizeCursorMode(stored?.cursorMode),
      keyboardLayoutId: normalizeKeyboardLayoutId(stored?.keyboardLayoutId),
      keyboardReferenceKeyFeedback: normalizeBoolean(
        stored?.keyboardReferenceKeyFeedback,
        DEFAULT_SETTINGS.keyboardReferenceKeyFeedback
      ),
      controlStrip: normalizeControlStrip(stored?.controlStrip),
      clickMode: normalizeClickMode(stored?.clickMode),
      textMode: normalizeTextMode(stored?.textMode),
      scroll: normalizeScroll(stored?.scroll)
    };
  } catch (_e) {
    return {
      ...DEFAULT_SETTINGS,
      controlStrip: { ...DEFAULT_SETTINGS.controlStrip },
      clickMode: { ...DEFAULT_SETTINGS.clickMode, cursor: { ...DEFAULT_SETTINGS.clickMode.cursor } },
      textMode: { ...DEFAULT_SETTINGS.textMode },
      scroll: { ...DEFAULT_SETTINGS.scroll }
    };
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
    controlStrip: {
      ...current.controlStrip,
      ...(p.controlStrip && typeof p.controlStrip === 'object' ? p.controlStrip : {})
    },
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
    },
    scroll: {
      ...current.scroll,
      ...(p.scroll && typeof p.scroll === 'object' ? p.scroll : {})
    }
  };
  next.searchEngine = normalizeSearchEngine(next.searchEngine);
  next.cursorMode = normalizeCursorMode(next.cursorMode);
  next.keyboardLayoutId = normalizeKeyboardLayoutId(next.keyboardLayoutId);
  next.keyboardReferenceKeyFeedback = normalizeBoolean(
    next.keyboardReferenceKeyFeedback,
    DEFAULT_SETTINGS.keyboardReferenceKeyFeedback
  );
  next.controlStrip = normalizeControlStrip(next.controlStrip);
  next.clickMode = normalizeClickMode(next.clickMode);
  next.textMode = normalizeTextMode(next.textMode);
  next.scroll = normalizeScroll(next.scroll);
  await storageSetValue(SETTINGS_STORAGE_KEY, next);
  return next;
}

/**
 * @param {SearchEngine} engine
 * @param {string} query
 */
export function buildSearchUrl(engine, query) {
  const meta = getSearchEngineMeta(engine);
  const q = typeof query === 'string' ? query : '';
  return `${meta.searchUrlPrefix}${encodeURIComponent(q)}`;
}

/**
 * @param {SearchEngine} engine
 */
export function getEngineHomeUrl(engine) {
  return getSearchEngineMeta(engine).homeUrl;
}


