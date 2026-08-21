/**
 * Settings storage + helpers.
 *
 * Stored in chrome.storage.sync so values sync across Chrome profiles and across tabs.
 */

import { CURSOR_MODE, SCROLL } from '../config/constants.js';
import { DEFAULT_THEME_ID, normalizeThemeId } from '../../themes/schema.js';
import {
  DEFAULT_KEYBOARD_HANDEDNESS,
  DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID,
  DEFAULT_KEYBOARD_LAYOUT_ID,
  inferFamilyAndHandednessFromLayoutId,
  normalizeKeyboardHandedness,
  normalizeKeyboardLayoutFamilyId,
  normalizeKeyboardLayoutId,
  resolveKeyboardLayoutId
} from '../config/keyboard-layouts.js';
import {
  SEARCH_ENGINE_META,
  DEFAULT_SEARCH_ENGINE_ID,
  normalizeSearchEngineId,
  getSearchEngineMeta
} from '../config/search-engines.js';
import { storageGetValue, storageSetValue } from '../utils/storage.js';
import { isMacPlatform } from '../utils/platform.js';

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
 * Focus-ring paint backend preference (Click Mode → Advanced).
 * - `auto`: full A→B→C (element outline when possible)
 * - `BC`: Auto B→C (skip A; in-target then body-fixed)
 * @typedef {'auto'|'BC'} ClickPaintStrategy
 */

/**
 * @typedef {{
 *   cursor: ClickCursorSettings,
 *   focusColor: FocusColor,
 *   overlayFillEnabled: boolean,
 *   overlayShadowEnabled: boolean,
 *   rectangleThickness: number,
 *   clickEffect: ClickEffect,
 *   keyboardLinkHoverHints: boolean,
 *   paintStrategy: ClickPaintStrategy,
 *   paintBackendDebugDashes: boolean,
 *   focusPadding: number,
 *   skipForParent: boolean
 * }} ClickModeSettings
 */

/**
 * @typedef {{
 *   cursorType: TextCursorType,
 *   labelsEnabled: boolean,
 *   strokeThickness: number,
 *   focusStyle: TextFocusStyle,
 *   leftEdgeWidth: number
 * }} TextModeSettings
 */

/**
 * @typedef {{
 *   halfPagePx: number,
 *   speed: ScrollSpeed,
 *   middleClickScrollLine: boolean,
 *   linePreferPortraitTargets: boolean
 * }} ScrollSettings
 */

/**
 * @typedef {{
 *   visible: boolean,
 *   collapsed: boolean
 * }} ControlStripSettings
 */

/**
 * Saved fixed-panel dock / free position (see utils/panel-position.js).
 * Prefer `anchor` when set so layout adapts across viewport sizes.
 * @typedef {{
 *   left?: number,
 *   top?: number,
 *   anchor?: string|null,
 *   width?: number,
 *   height?: number
 * }} PanelPositionSettings
 */

/**
 * Named panel slots that share the generalized positioning system.
 * @typedef {{
 *   keyboardReference: PanelPositionSettings,
 *   controlStrip: PanelPositionSettings,
 *   keyboardLayoutConfig: PanelPositionSettings,
 *   topSites: PanelPositionSettings
 * }} PanelPositionsSettings
 */

/**
 * @typedef {{
 *   themeId: string,
 *   themeOverrides: Record<string, any>,
 *   clickModeThemeId: string,
 *   searchEngine: SearchEngine,
 *   cursorMode: CursorMode,
 *   keyboardLayoutFamilyId: string,
 *   keyboardHandedness: 'left'|'right',
 *   keyboardLayoutId: string,
 *   currentKeyboardLayoutId: string,
 *   keyboardReferenceKeyFeedback: boolean,
 *   keyboardReferenceShowNumberRow: boolean,
 *   keyboardReferenceCollapsed: boolean,
 *   topSitesPersistent: boolean,
 *   debugLogging: boolean,
 *   actionsLibraryTableExpanded: string[],
 *   actionsLibraryInstructionsExpanded: boolean,
 *   controlStrip: ControlStripSettings,
 *   panelPositions: PanelPositionsSettings,
 *   clickMode: ClickModeSettings,
 *   textMode: TextModeSettings,
 *   scroll: ScrollSettings,
 *   actionSettings: Record<string, { mode?: string, parameters?: Record<string, any> }>
 * }} KeyPilotSettings
 */

/** @type {KeyPilotSettings} */
export const DEFAULT_SETTINGS = Object.freeze({
  themeId: DEFAULT_THEME_ID,
  themeOverrides: Object.freeze({}),
  // Last theme whose clickDefaults were written into clickMode/cursorMode.
  // Empty means never synced (adopt the active theme's click defaults once).
  clickModeThemeId: '',
  searchEngine: DEFAULT_SEARCH_ENGINE_ID,
  cursorMode: CURSOR_MODE.NO_CUSTOM_CURSORS,
  // New model:
  // - keyboardLayoutFamilyId + keyboardHandedness are the user-facing selection.
  // - keyboardLayoutId is the resolved concrete implementation (kept for back-compat + early-inject).
  keyboardLayoutFamilyId: DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID,
  keyboardHandedness: DEFAULT_KEYBOARD_HANDEDNESS,
  keyboardLayoutId: DEFAULT_KEYBOARD_LAYOUT_ID,
  // Active layout selection for runtime + keyboard reference:
  // - 'builtin' uses the current built-in family + handedness selection.
  // - 'user:<layoutId>' uses a stored user layout (created/duplicated in Alt+C).
  currentKeyboardLayoutId: 'builtin',
  // When true, the floating keyboard reference panel highlights keys on keydown/keyup.
  keyboardReferenceKeyFeedback: true,
  // When true, the floating keyboard reference panel includes the number row (1–0).
  // Default is off to keep the panel compact.
  keyboardReferenceShowNumberRow: false,
  // When true, the floating keyboard reference panel is titlebar-only (body hidden).
  keyboardReferenceCollapsed: false,
  // When true, Top Sites remounts on each page while left open (Keyboard Reference-style).
  topSitesPersistent: false,
  // Verbose console.log / debug / info in extension isolated worlds. Off in store builds.
  debugLogging: false,
  // Actions Library hierarchical table: expanded group keys (top-level open by default;
  // nested categories / parents start collapsed until the user opens them).
  actionsLibraryTableExpanded: Object.freeze(['functions', 'macros', 'macroKeys']),
  // Actions Library placement instructions section (between titlebar and cards).
  actionsLibraryInstructionsExpanded: true,
  // Floating Control Strip (upper-left): visibility + collapsed (On/Off-only) state.
  controlStrip: Object.freeze({
    visible: true,
    collapsed: true
  }),
  // Dock / free positions for movable chrome (keyboard reference, control strip, …).
  // Anchors re-resolve on resize; free left/top reclamps inside the viewport margin.
  panelPositions: Object.freeze({
    keyboardReference: Object.freeze({ anchor: 'bottom-left' }),
    controlStrip: Object.freeze({ anchor: 'top-left' }),
    keyboardLayoutConfig: Object.freeze({ anchor: 'middle-right' }),
    // Empty: first open stays viewport-centered until the user moves/resizes.
    topSites: Object.freeze({})
  }),
  // Per-key action settings (Keyboard Reference mode switches / config params).
  actionSettings: Object.freeze({
    RECTANGLE_HIGHLIGHT: Object.freeze({
      mode: 'element',
      parameters: Object.freeze({})
    })
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
    clickEffect: 'flash',
    // When true, hovering a link glows matching green keys on the Keyboard Reference.
    // Off by default (opt-in via Settings → Click Mode).
    keyboardLinkHoverHints: false,
    // Default skip DOM outline (A); use in-target (B) then body-fixed (C).
    // Matches Shadow Root Debug “Auto B→C”.
    paintStrategy: 'BC',
    // When true, dash A/B/C hover rings differently for paint-backend recognition.
    // Off by default (opt-in via Settings → Click Mode → Advanced).
    paintBackendDebugDashes: false,
    // Outward ring padding (px). Strategy A uses this as preferred outline-offset;
    // B/C expand their boxes by the same amount (A historically ~2px; B→C was 0).
    focusPadding: 2,
    // When a nested control shares the parent's destination (same URL), hover
    // the parent card instead. Different-destination children keep their own ring.
    skipForParent: true
  }),
  textMode: Object.freeze({
    cursorType: 't_square',
    // When true, show both labels: "Active text field" + "Press ESC to close".
    labelsEnabled: false,
    // Stroke thickness in px for orange text-mode rectangles.
    strokeThickness: 3,
    // How the focused text field is styled while in text mode.
    // left_edge: pulsating orange bar on the left inset edge (default).
    // background_tint: full-field orange wash (legacy).
    focusStyle: 'left_edge',
    // Width of the left-edge pulse bar in px (when focusStyle is left_edge).
    leftEdgeWidth: 5
  }),
  scroll: Object.freeze({
    // C / V scroll distance in pixels (default = prior 400 × 1.25).
    halfPagePx: SCROLL.HALF_PAGE_PX,
    // Animation speed for keyboard scrolling: smooth (animated) or instant (jump).
    speed: SCROLL.BEHAVIOR === 'smooth' ? 'smooth' : 'instant',
    // Middle mouse button → Scroll Line Function (empty page only). On by default on Mac.
    middleClickScrollLine: isMacPlatform(),
    // Scroll Line: skip horizontal-only landscape overflow (carousels).
    linePreferPortraitTargets: true
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
 * @returns {Record<string, any>}
 */
export function normalizeThemeOverrides(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw;
}

/**
 * @param {any} raw
 * @returns {string}
 */
export function normalizeUiThemeId(raw) {
  return normalizeThemeId(raw);
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
 * @returns {string}
 */
function normalizeCurrentKeyboardLayoutId(raw) {
  const v = String(raw || '').trim();
  if (!v) return DEFAULT_SETTINGS.currentKeyboardLayoutId;
  if (v === 'builtin') return 'builtin';
  if (v.startsWith('user:') && v.length > 'user:'.length) return v;
  return DEFAULT_SETTINGS.currentKeyboardLayoutId;
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
 * @returns {ClickPaintStrategy}
 */
export function normalizePaintStrategy(raw) {
  if (raw === 'auto' || raw === 'BC') return raw;
  // Accept HUD-style aliases from experiments / older notes.
  const upper = raw == null ? '' : String(raw).trim().toUpperCase();
  if (
    upper === 'B->C' ||
    upper === 'B→C' ||
    upper === 'AUTO_BC' ||
    upper === 'AUTO-BC' ||
    upper === 'AUTO B->C' ||
    upper === 'AUTO B→C'
  ) {
    return 'BC';
  }
  if (upper === 'AUTO' || upper === 'A->B->C' || upper === 'A→B→C') {
    return 'auto';
  }
  return DEFAULT_SETTINGS.clickMode.paintStrategy;
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
    clickEffect: normalizeClickEffect(stored.clickEffect),
    keyboardLinkHoverHints: normalizeBoolean(
      stored.keyboardLinkHoverHints,
      DEFAULT_SETTINGS.clickMode.keyboardLinkHoverHints
    ),
    paintStrategy: normalizePaintStrategy(stored.paintStrategy),
    paintBackendDebugDashes: normalizeBoolean(
      stored.paintBackendDebugDashes,
      DEFAULT_SETTINGS.clickMode.paintBackendDebugDashes
    ),
    focusPadding: normalizeNumber(
      stored.focusPadding,
      DEFAULT_SETTINGS.clickMode.focusPadding,
      0,
      16
    ),
    skipForParent: normalizeBoolean(
      stored.skipForParent,
      DEFAULT_SETTINGS.clickMode.skipForParent
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
    ),
    focusStyle: normalizeTextFocusStyle(stored.focusStyle),
    leftEdgeWidth: normalizeNumber(
      stored.leftEdgeWidth,
      DEFAULT_SETTINGS.textMode.leftEdgeWidth,
      1,
      24
    )
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
  const middleClickDefault = DEFAULT_SETTINGS.scroll.middleClickScrollLine;
  return {
    halfPagePx: normalizeNumber(
      stored.halfPagePx,
      DEFAULT_SETTINGS.scroll.halfPagePx,
      50,
      2000
    ),
    speed: normalizeScrollSpeed(stored.speed),
    // Missing key → platform default (Mac on, others off). Explicit boolean is honored on any OS.
    middleClickScrollLine: normalizeBoolean(stored.middleClickScrollLine, middleClickDefault),
    linePreferPortraitTargets: normalizeBoolean(
      stored.linePreferPortraitTargets,
      DEFAULT_SETTINGS.scroll.linePreferPortraitTargets
    )
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

const PANEL_ANCHOR_IDS = new Set([
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right'
]);

/**
 * @param {any} raw
 * @param {PanelPositionSettings} fallback
 * @returns {PanelPositionSettings}
 */
function normalizePanelPositionEntry(raw, fallback) {
  const fb = fallback && typeof fallback === 'object' ? fallback : {};
  if (!raw || typeof raw !== 'object') {
    return {
      left: Number.isFinite(fb.left) ? fb.left : undefined,
      top: Number.isFinite(fb.top) ? fb.top : undefined,
      anchor: typeof fb.anchor === 'string' ? fb.anchor : (fb.anchor === null ? null : undefined)
    };
  }
  /** @type {PanelPositionSettings} */
  const out = {};
  const left = typeof raw.left === 'number' ? raw.left : (typeof raw.left === 'string' ? Number(raw.left) : NaN);
  const top = typeof raw.top === 'number' ? raw.top : (typeof raw.top === 'string' ? Number(raw.top) : NaN);
  const width = typeof raw.width === 'number' ? raw.width : (typeof raw.width === 'string' ? Number(raw.width) : NaN);
  const height = typeof raw.height === 'number' ? raw.height : (typeof raw.height === 'string' ? Number(raw.height) : NaN);
  if (Number.isFinite(left)) out.left = left;
  if (Number.isFinite(top)) out.top = top;
  if (Number.isFinite(width) && width > 0) out.width = width;
  if (Number.isFinite(height) && height > 0) out.height = height;
  if (raw.anchor === null) {
    out.anchor = null;
  } else if (typeof raw.anchor === 'string' && PANEL_ANCHOR_IDS.has(raw.anchor.trim())) {
    out.anchor = raw.anchor.trim();
  } else if (typeof fb.anchor === 'string' && !Number.isFinite(left) && !Number.isFinite(top)) {
    out.anchor = fb.anchor;
  }
  // If nothing useful, fall back to default entry.
  if (out.left === undefined && out.top === undefined && out.anchor === undefined) {
    return {
      left: Number.isFinite(fb.left) ? fb.left : undefined,
      top: Number.isFinite(fb.top) ? fb.top : undefined,
      anchor: typeof fb.anchor === 'string' ? fb.anchor : (fb.anchor === null ? null : undefined)
    };
  }
  return out;
}

/**
 * @param {any} raw
 * @returns {PanelPositionsSettings}
 */
function normalizePanelPositions(raw) {
  const stored = raw && typeof raw === 'object' ? raw : {};
  return {
    keyboardReference: normalizePanelPositionEntry(
      stored.keyboardReference,
      DEFAULT_SETTINGS.panelPositions.keyboardReference
    ),
    controlStrip: normalizePanelPositionEntry(
      stored.controlStrip,
      DEFAULT_SETTINGS.panelPositions.controlStrip
    ),
    keyboardLayoutConfig: normalizePanelPositionEntry(
      stored.keyboardLayoutConfig,
      DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig
    ),
    topSites: normalizePanelPositionEntry(
      stored.topSites,
      DEFAULT_SETTINGS.panelPositions.topSites
    )
  };
}

/**
 * @param {any} raw
 * @param {readonly string[]} fallback
 * @returns {string[]}
 */
function normalizeStringIdList(raw, fallback) {
  const fb = Array.isArray(fallback) ? [...fallback] : [];
  if (!Array.isArray(raw)) return fb;
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const id = v.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * @param {any} raw
 * @returns {string[]}
 */
export function normalizeActionsLibraryTableExpanded(raw) {
  // Missing / non-array → defaults. Explicit [] means user collapsed everything.
  if (!Array.isArray(raw)) {
    return [...DEFAULT_SETTINGS.actionsLibraryTableExpanded];
  }
  return normalizeStringIdList(raw, DEFAULT_SETTINGS.actionsLibraryTableExpanded);
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
 * @param {any} raw
 * @returns {Record<string, { mode?: string, parameters?: Record<string, any> }>}
 */
export function normalizeActionSettings(raw) {
  const defaults = DEFAULT_SETTINGS.actionSettings || {};
  const stored = raw && typeof raw === 'object' ? raw : {};
  /** @type {Record<string, { mode?: string, parameters?: Record<string, any> }>} */
  const out = {};

  const keys = new Set([...Object.keys(defaults), ...Object.keys(stored)]);
  for (const actionId of keys) {
    const fb = defaults[actionId] && typeof defaults[actionId] === 'object' ? defaults[actionId] : {};
    const entry = stored[actionId] && typeof stored[actionId] === 'object' ? stored[actionId] : {};
    const mode = typeof entry.mode === 'string' && entry.mode
      ? entry.mode
      : (typeof fb.mode === 'string' ? fb.mode : undefined);
    const parameters = {
      ...(fb.parameters && typeof fb.parameters === 'object' ? fb.parameters : {}),
      ...(entry.parameters && typeof entry.parameters === 'object' ? entry.parameters : {})
    };
    out[actionId] = { mode, parameters };
  }
  return out;
}

/**
 * @returns {Promise<KeyPilotSettings>}
 */
export async function getSettings() {
  try {
    let stored = await storageGetValue(SETTINGS_STORAGE_KEY, null);
    if (!stored || typeof stored !== 'object') stored = {};

    // Normalize keyboard layout selection with backward compatibility:
    // - Old storage: { keyboardLayoutId: 'browsing-right'|'browsing-left' }
    // - New storage: { keyboardLayoutFamilyId: 'browsing', keyboardHandedness: 'left'|'right' }
    let familyId = normalizeKeyboardLayoutFamilyId(stored?.keyboardLayoutFamilyId);
    let handedness = normalizeKeyboardHandedness(stored?.keyboardHandedness);
    const hasNewFields =
      Object.prototype.hasOwnProperty.call(stored || {}, 'keyboardLayoutFamilyId') ||
      Object.prototype.hasOwnProperty.call(stored || {}, 'keyboardHandedness');
    if (!hasNewFields) {
      const inferred = inferFamilyAndHandednessFromLayoutId(stored?.keyboardLayoutId);
      familyId = normalizeKeyboardLayoutFamilyId(inferred.familyId);
      handedness = normalizeKeyboardHandedness(inferred.handedness);
    }
    const resolvedLayoutId = resolveKeyboardLayoutId({ familyId, handedness });

    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      themeId: normalizeThemeId(stored?.themeId),
      themeOverrides: normalizeThemeOverrides(stored?.themeOverrides),
      clickModeThemeId: (typeof stored?.clickModeThemeId === 'string' && stored.clickModeThemeId.trim())
        ? normalizeThemeId(stored.clickModeThemeId)
        : '',
      searchEngine: normalizeSearchEngine(stored?.searchEngine),
      cursorMode: normalizeCursorMode(stored?.cursorMode),
      keyboardLayoutFamilyId: familyId,
      keyboardHandedness: handedness,
      keyboardLayoutId: resolvedLayoutId,
      currentKeyboardLayoutId: normalizeCurrentKeyboardLayoutId(stored?.currentKeyboardLayoutId),
      keyboardReferenceKeyFeedback: normalizeBoolean(
        stored?.keyboardReferenceKeyFeedback,
        DEFAULT_SETTINGS.keyboardReferenceKeyFeedback
      ),
      keyboardReferenceShowNumberRow: normalizeBoolean(
        stored?.keyboardReferenceShowNumberRow,
        DEFAULT_SETTINGS.keyboardReferenceShowNumberRow
      ),
      keyboardReferenceCollapsed: normalizeBoolean(
        stored?.keyboardReferenceCollapsed,
        DEFAULT_SETTINGS.keyboardReferenceCollapsed
      ),
      topSitesPersistent: normalizeBoolean(
        stored?.topSitesPersistent,
        DEFAULT_SETTINGS.topSitesPersistent
      ),
      debugLogging: normalizeBoolean(
        stored?.debugLogging,
        DEFAULT_SETTINGS.debugLogging
      ),
      actionsLibraryTableExpanded: normalizeActionsLibraryTableExpanded(
        stored?.actionsLibraryTableExpanded
      ),
      actionsLibraryInstructionsExpanded: normalizeBoolean(
        stored?.actionsLibraryInstructionsExpanded,
        DEFAULT_SETTINGS.actionsLibraryInstructionsExpanded
      ),
      controlStrip: normalizeControlStrip(stored?.controlStrip),
      panelPositions: normalizePanelPositions(stored?.panelPositions),
      actionSettings: normalizeActionSettings(stored?.actionSettings),
      clickMode: normalizeClickMode(stored?.clickMode),
      textMode: normalizeTextMode(stored?.textMode),
      scroll: normalizeScroll(stored?.scroll)
    };
  } catch (_e) {
    return {
      ...DEFAULT_SETTINGS,
      controlStrip: { ...DEFAULT_SETTINGS.controlStrip },
      panelPositions: {
        keyboardReference: { ...DEFAULT_SETTINGS.panelPositions.keyboardReference },
        controlStrip: { ...DEFAULT_SETTINGS.panelPositions.controlStrip },
        keyboardLayoutConfig: { ...DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig },
        topSites: { ...DEFAULT_SETTINGS.panelPositions.topSites }
      },
      actionSettings: normalizeActionSettings(null),
      clickMode: { ...DEFAULT_SETTINGS.clickMode, cursor: { ...DEFAULT_SETTINGS.clickMode.cursor } },
      textMode: { ...DEFAULT_SETTINGS.textMode },
      scroll: { ...DEFAULT_SETTINGS.scroll },
      actionsLibraryTableExpanded: [...DEFAULT_SETTINGS.actionsLibraryTableExpanded],
      actionsLibraryInstructionsExpanded: DEFAULT_SETTINGS.actionsLibraryInstructionsExpanded,
      themeId: DEFAULT_THEME_ID,
      themeOverrides: {},
      clickModeThemeId: '',
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
  const pPositions = p.panelPositions && typeof p.panelPositions === 'object' ? p.panelPositions : null;

  /** @type {KeyPilotSettings} */
  const next = {
    ...current,
    ...p,
    controlStrip: {
      ...current.controlStrip,
      ...(p.controlStrip && typeof p.controlStrip === 'object' ? p.controlStrip : {})
    },
    panelPositions: {
      keyboardReference: {
        ...current.panelPositions.keyboardReference,
        ...(pPositions?.keyboardReference && typeof pPositions.keyboardReference === 'object'
          ? pPositions.keyboardReference
          : {})
      },
      controlStrip: {
        ...current.panelPositions.controlStrip,
        ...(pPositions?.controlStrip && typeof pPositions.controlStrip === 'object'
          ? pPositions.controlStrip
          : {})
      },
      keyboardLayoutConfig: {
        ...(current.panelPositions.keyboardLayoutConfig || DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig),
        ...(pPositions?.keyboardLayoutConfig && typeof pPositions.keyboardLayoutConfig === 'object'
          ? pPositions.keyboardLayoutConfig
          : {})
      },
      topSites: {
        ...(current.panelPositions.topSites || DEFAULT_SETTINGS.panelPositions.topSites),
        ...(pPositions?.topSites && typeof pPositions.topSites === 'object'
          ? pPositions.topSites
          : {})
      }
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
    },
    actionSettings: (() => {
      const merged = { ...(current.actionSettings || {}) };
      const patch = p.actionSettings && typeof p.actionSettings === 'object' ? p.actionSettings : {};
      for (const [id, entry] of Object.entries(patch)) {
        const prev = merged[id] && typeof merged[id] === 'object' ? merged[id] : {};
        const next = entry && typeof entry === 'object' ? entry : {};
        merged[id] = {
          ...prev,
          ...next,
          parameters: {
            ...(prev.parameters && typeof prev.parameters === 'object' ? prev.parameters : {}),
            ...(next.parameters && typeof next.parameters === 'object' ? next.parameters : {})
          }
        };
      }
      return normalizeActionSettings(merged);
    })()
  };
  next.searchEngine = normalizeSearchEngine(next.searchEngine);
  next.cursorMode = normalizeCursorMode(next.cursorMode);
  next.themeId = normalizeThemeId(next.themeId);
  next.themeOverrides = normalizeThemeOverrides(next.themeOverrides);
  next.clickModeThemeId = (typeof next.clickModeThemeId === 'string' && next.clickModeThemeId.trim())
    ? normalizeThemeId(next.clickModeThemeId)
    : '';

  // Keyboard layout resolution rules:
  // - If caller set keyboardLayoutId directly (legacy), infer family/handedness from it.
  // - Otherwise, normalize family/handedness and compute the concrete keyboardLayoutId.
  const callerSetLayoutId = Object.prototype.hasOwnProperty.call(p, 'keyboardLayoutId');
  if (callerSetLayoutId) {
    const inferred = inferFamilyAndHandednessFromLayoutId(p?.keyboardLayoutId);
    next.keyboardLayoutFamilyId = normalizeKeyboardLayoutFamilyId(inferred.familyId);
    next.keyboardHandedness = normalizeKeyboardHandedness(inferred.handedness);
    next.keyboardLayoutId = normalizeKeyboardLayoutId(p?.keyboardLayoutId);
  } else {
    next.keyboardLayoutFamilyId = normalizeKeyboardLayoutFamilyId(next.keyboardLayoutFamilyId);
    next.keyboardHandedness = normalizeKeyboardHandedness(next.keyboardHandedness);
    next.keyboardLayoutId = resolveKeyboardLayoutId({
      familyId: next.keyboardLayoutFamilyId,
      handedness: next.keyboardHandedness
    });
  }

  next.currentKeyboardLayoutId = normalizeCurrentKeyboardLayoutId(next.currentKeyboardLayoutId);
  next.keyboardReferenceKeyFeedback = normalizeBoolean(
    next.keyboardReferenceKeyFeedback,
    DEFAULT_SETTINGS.keyboardReferenceKeyFeedback
  );
  next.keyboardReferenceShowNumberRow = normalizeBoolean(
    next.keyboardReferenceShowNumberRow,
    DEFAULT_SETTINGS.keyboardReferenceShowNumberRow
  );
  next.keyboardReferenceCollapsed = normalizeBoolean(
    next.keyboardReferenceCollapsed,
    DEFAULT_SETTINGS.keyboardReferenceCollapsed
  );
  next.topSitesPersistent = normalizeBoolean(
    next.topSitesPersistent,
    DEFAULT_SETTINGS.topSitesPersistent
  );
  next.debugLogging = normalizeBoolean(
    next.debugLogging,
    DEFAULT_SETTINGS.debugLogging
  );
  next.actionsLibraryTableExpanded = normalizeActionsLibraryTableExpanded(
    next.actionsLibraryTableExpanded
  );
  next.actionsLibraryInstructionsExpanded = normalizeBoolean(
    next.actionsLibraryInstructionsExpanded,
    DEFAULT_SETTINGS.actionsLibraryInstructionsExpanded
  );
  next.controlStrip = normalizeControlStrip(next.controlStrip);
  next.panelPositions = normalizePanelPositions(next.panelPositions);
  next.actionSettings = normalizeActionSettings(next.actionSettings);
  next.clickMode = normalizeClickMode(next.clickMode);
  next.textMode = normalizeTextMode(next.textMode);
  next.scroll = normalizeScroll(next.scroll);
  next._updatedAt = Date.now();
  await storageSetValue(SETTINGS_STORAGE_KEY, next, { dualWrite: true });
  return next;
}

/**
 * Replace stored settings with product defaults (does not merge with current).
 * @returns {Promise<KeyPilotSettings>}
 */
export async function resetAllSettings() {
  const next = {
    ...DEFAULT_SETTINGS,
    themeOverrides: {},
    controlStrip: { ...DEFAULT_SETTINGS.controlStrip },
    panelPositions: {
      keyboardReference: { ...DEFAULT_SETTINGS.panelPositions.keyboardReference },
      controlStrip: { ...DEFAULT_SETTINGS.panelPositions.controlStrip },
      keyboardLayoutConfig: { ...DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig },
      topSites: { ...DEFAULT_SETTINGS.panelPositions.topSites }
    },
    actionSettings: normalizeActionSettings(null),
    clickMode: {
      ...DEFAULT_SETTINGS.clickMode,
      cursor: { ...DEFAULT_SETTINGS.clickMode.cursor }
    },
    textMode: { ...DEFAULT_SETTINGS.textMode },
    scroll: { ...DEFAULT_SETTINGS.scroll },
    actionsLibraryTableExpanded: [...DEFAULT_SETTINGS.actionsLibraryTableExpanded],
    actionsLibraryInstructionsExpanded: DEFAULT_SETTINGS.actionsLibraryInstructionsExpanded,
    _updatedAt: Date.now()
  };
  await storageSetValue(SETTINGS_STORAGE_KEY, next, { dualWrite: true });
  return getSettings();
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


