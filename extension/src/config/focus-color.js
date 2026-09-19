/**
 * Click Mode focus-rectangle colors: five presets plus a custom hex.
 */

export const FOCUS_COLOR_PRESET_IDS = Object.freeze([
  'blue',
  'green',
  'orange',
  'red',
  'purple'
]);

export const FOCUS_COLOR_PRESET_HEX = Object.freeze({
  blue: '#2196f3',
  green: '#00b400',
  orange: '#ff8c00',
  red: '#e53935',
  purple: '#9c27b0'
});

const DEFAULT_FOCUS_COLOR = 'blue';

/**
 * @param {unknown} raw
 * @returns {string|null} `#rrggbb` or null
 */
export function parseFocusColorHex(raw) {
  const s = String(raw || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  return null;
}

/**
 * @param {unknown} raw
 * @returns {string} preset id or `#rrggbb`
 */
export function normalizeFocusColor(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (FOCUS_COLOR_PRESET_IDS.includes(s)) return s;
  return parseFocusColorHex(s) || DEFAULT_FOCUS_COLOR;
}

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isFocusColorPreset(raw) {
  return FOCUS_COLOR_PRESET_IDS.includes(String(raw || '').trim().toLowerCase());
}

/**
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }|null}
 */
function rgbFromHex(hex) {
  const parsed = parseFocusColorHex(hex);
  if (!parsed) return null;
  return {
    r: parseInt(parsed.slice(1, 3), 16),
    g: parseInt(parsed.slice(3, 5), 16),
    b: parseInt(parsed.slice(5, 7), 16)
  };
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} a
 * @returns {string}
 */
function rgba(r, g, b, a) {
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * @param {{ r: number, g: number, b: number }} rgb
 */
function paletteFromRgb(rgb) {
  const { r, g, b } = rgb;
  return {
    borderColor: rgba(r, g, b, 0.95),
    shadowColor: rgba(r, g, b, 0.35),
    shadowBrightColor: rgba(r, g, b, 0.45),
    backgroundColor: rgba(r, g, b, 0.25),
    hex: `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
  };
}

/**
 * @param {unknown} raw
 * @returns {{ borderColor: string, shadowColor: string, shadowBrightColor: string, backgroundColor: string, hex: string }}
 */
export function getFocusColorPalette(raw) {
  const id = normalizeFocusColor(raw);
  if (isFocusColorPreset(id)) {
    const rgb = rgbFromHex(FOCUS_COLOR_PRESET_HEX[id]);
    if (rgb) return paletteFromRgb(rgb);
  }
  const custom = rgbFromHex(id);
  if (custom) return paletteFromRgb(custom);
  return paletteFromRgb(rgbFromHex(FOCUS_COLOR_PRESET_HEX.blue));
}

/**
 * Hex for the color well (preset or custom).
 * @param {unknown} raw
 * @returns {string}
 */
export function hexForFocusColor(raw) {
  return getFocusColorPalette(raw).hex;
}
