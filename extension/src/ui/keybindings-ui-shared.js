/**
 * Shared pieces of the KeyPilot keybindings UI that need to stay consistent
 * across:
 * - bundled content UI (`src/ui/keybindings-ui.js`)
 * - early injection UI (`extension/early-inject.js`)
 *
 * NOTE: `early-inject.js` cannot import ESM at runtime (it must run at
 * `document_start` and is loaded directly by the manifest). Instead, the build
 * script stamps generated constants into `early-inject.js` from this module.
 */

export const KEYBINDINGS_UI_STYLE_ATTR = 'data-kp-keybindings-ui-style';
export const KEYBINDINGS_UI_ROOT_CLASS = 'kp-keybindings-ui';
/** Document-level @font-face sheet so Dosis starts loading before the first keycap paint. */
export const KEYBINDINGS_UI_FONT_STYLE_ATTR = 'data-kp-keybindings-fonts';
export const KEYBINDINGS_UI_FONT_PRELOAD_ATTR = 'data-kp-keybindings-font-preload';

// Used in generated CSS when runtime URLs are not available (e.g. build-time stamping into early-inject.js).
export const KEYBINDINGS_UI_FONT_PLACEHOLDERS = {
  ROBOTECH: '__KP_FONT_ROBOTECH_URL__',
  TITILLIUM: '__KP_FONT_TITILLIUM_URL__',
  CUBELLAN: '__KP_FONT_CUBELLAN_URL__',
  EZARION: '__KP_FONT_EZARION_URL__',
  DOSIS: '__KP_FONT_DOSIS_URL__'
};

import { DEFAULT_KEYBOARD_LAYOUT_ID, getKeyboardUiLayoutForLayout } from '../config/keyboard-layouts.js';

/**
 * Canonical keyboard layout used by both early-inject and the bundled UI.
 * Action keys reference IDs in `KEYBINDINGS`.
 */
export const KEYBINDINGS_KEYBOARD_LAYOUT = getKeyboardUiLayoutForLayout(DEFAULT_KEYBOARD_LAYOUT_ID);

/**
 * Font Awesome Free solid-style SVG path data (viewBox 0 0 512 512).
 * Used as faded key background icons behind white foreground labels.
 * Paths are FA Free solid equivalents for offline/CSP-safe data-URI embedding.
 */
const FA_SOLID_PATHS = Object.freeze({
  // Navigation / history
  'arrow-left': 'M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 288 480 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-370.7 0 137.4-137.4c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z',
  'arrow-right': 'M502.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-192-192c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L402.7 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l370.7 0-137.4 137.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l192-192z',
  'arrow-up': 'M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 173.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z',
  'arrow-down': 'M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z',
  'angles-up': 'M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 173.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192zm0 160c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 333.3 86.6 502.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z',
  'angles-down': 'M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192zm0-160c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 178.7 86.6 9.4C74.1-3.1 53.8-3.1 41.3 9.4s-12.5 32.8 0 45.3l192 192z',
  'chevron-left': 'M41.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 256 246.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z',
  'chevron-right': 'M470.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L402.7 256 265.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z',

  // Clicks / tabs / windows (Font Awesome Free solid-style glyphs)
  'hand-pointer': 'M320 0c17.7 0 32 14.3 32 32V176h16c17.7 0 32 14.3 32 32s-14.3 32-32 32H352v16c0 17.7-14.3 32-32 32s-32-14.3-32-32V240H272v16c0 17.7-14.3 32-32 32s-32-14.3-32-32V240H192v80c0 53 43 96 96 96h32c53 0 96-43 96-96V224h32c17.7 0 32-14.3 32-32s-14.3-32-32-32H416V32c0-17.7-14.3-32-32-32H320zM192 96c0-17.7-14.3-32-32-32H128C57.3 64 0 121.3 0 192v96c0 53 43 96 96 96h32c17.7 0 32-14.3 32-32s-14.3-32-32-32H96c-17.7 0-32-14.3-32-32V192c0-35.3 28.7-64 64-64h32c17.7 0 32-14.3 32-32z',
  'arrow-up-right-from-square': 'M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32h82.7L201.4 265.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3V192c0 17.7 14.3 32 32 32s32-14.3 32-32V32c0-17.7-14.3-32-32-32H320zM80 32C35.8 32 0 67.8 0 112V432c0 44.2 35.8 80 80 80H400c44.2 0 80-35.8 80-80V320c0-17.7-14.3-32-32-32s-32 14.3-32 32V432c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V112c0-8.8 7.2-16 16-16H192c17.7 0 32-14.3 32-32s-14.3-32-32-32H80z',
  'clone': 'M64 464H288c8.8 0 16-7.2 16-16V384h48v64c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64h64v48H64c-8.8 0-16 7.2-16 16V448c0 8.8 7.2 16 16 16zM224 0c-35.3 0-64 28.7-64 64V288c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64H224zm0 48H448c8.8 0 16 7.2 16 16V288c0 8.8-7.2 16-16 16H224c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16z',
  'window-maximize': 'M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm32 96H416c17.7 0 32 14.3 32 32v32H64V160c0-17.7 14.3-32 32-32z',
  'eye': 'M256 96c-89.6 0-168.5 48.8-212.7 122.3c-7.3 12.1-7.3 27.3 0 39.4C87.5 331.2 166.4 380 256 380s168.5-48.8 212.7-122.3c7.3-12.1 7.3-27.3 0-39.4C424.5 144.8 345.6 96 256 96zm0 224a96 96 0 1 1 0-192 96 96 0 1 1 0 192zm0-144a48 48 0 1 0 0 96 48 48 0 1 0 0-96z',
  'plus': 'M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z',
  'folder-plus': 'M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H298.5c-17 0-33.3-6.7-45.3-18.7L226.7 50.7C214.7 38.7 198.5 32 181.5 32H64zM232 248v-48c0-13.3 10.7-24 24-24s24 10.7 24 24v48h48c13.3 0 24 10.7 24 24s-10.7 24-24 24H280v48c0 13.3-10.7 24-24 24s-24-10.7-24-24V296H184c-13.3 0-24-10.7-24-24s10.7-24 24-24h48z',
  'xmark': 'M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z',
  'trash': 'M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H384l-7.2-14.3C372.4 6.8 361.3 0 349.2 0H162.8c-12.1 0-23.2 6.8-28.6 17.7zM32 128V448c0 35.3 28.7 64 64 64H416c35.3 0 64-28.7 64-64V128H32zm112 64c8.8 0 16 7.2 16 16V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V208c0-8.8 7.2-16 16-16zm96 0c8.8 0 16 7.2 16 16V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V208c0-8.8 7.2-16 16-16zm96 0c8.8 0 16 7.2 16 16V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V208c0-8.8 7.2-16 16-16z',
  'delete-left': 'M576 128c0-35.3-28.7-64-64-64H205.3c-17 0-33.3 6.7-45.3 18.7L9.4 233.4c-6 6-9.4 14.1-9.4 22.6s3.4 16.6 9.4 22.6L160 429.3c12 12 28.3 18.7 45.3 18.7H512c35.3 0 64-28.7 64-64V128zM271 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z',

  // UI / utility
  'gear': 'M495.9 166.1c3.3 12.7 .9 26.3-7.1 36.1l-37.3 45.7c2.1 11.1 3.2 22.6 3.2 34.3s-1.1 23.2-3.2 34.3l37.3 45.7c8 9.8 10.4 23.4 7.1 36.1c-6.3 24.2-17.7 46.6-33.1 66.3c-8.1 10.3-21.2 14.9-33.9 12.1l-57.5-12.7c-17.9 15.3-38.4 27.3-60.7 35.4l-13.7 57.5c-2.9 12.1-12.9 21.1-25.4 22.4c-24.2 2.6-49.1 2.6-73.3 0c-12.5-1.3-22.5-10.3-25.4-22.4l-13.7-57.5c-22.3-8.1-42.8-20.1-60.7-35.4L71.6 436.6c-12.7 2.8-25.8-1.8-33.9-12.1C22.3 404.8 10.9 382.4 4.6 358.2c-3.3-12.7-.9-26.3 7.1-36.1l37.3-45.7C46.9 265.2 45.8 253.7 45.8 242s1.1-23.2 3.2-34.3L11.7 161.9c-8-9.8-10.4-23.4-7.1-36.1C10.9 101.6 22.3 79.2 37.7 59.5c8.1-10.3 21.2-14.9 33.9-12.1l57.5 12.7c17.9-15.3 38.4-27.3 60.7-35.4L203.5-32.8c2.9-12.1 12.9-21.1 25.4-22.4c24.2-2.6 49.1-2.6 73.3 0c12.5 1.3 22.5 10.3 25.4 22.4l13.7 57.5c22.3 8.1 42.8 20.1 60.7 35.4l57.5-12.7c12.7-2.8 25.8 1.8 33.9 12.1c15.4 19.7 26.8 42.1 33.1 66.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z',
  'magnifying-glass': 'M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z',
  'keyboard': 'M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zm128 64v32h32V160H128zm64 0v32h32V160H192zm64 0v32h32V160H256zm64 0v32h32V160H320zm64 0v32h32V160H384zM96 256v32h64V256H96zm96 0v32h32V256H192zm64 0v32h32V256H256zm64 0v32h32V256H320zm64 0v32h32V256H384zm64 0v32h32V256H448zM128 352v32H384V352H128z',
  'clock-rotate-left': 'M256 0C114.6 0 0 114.6 0 256S114.6 512 256 512c53 0 102-16.2 142.7-43.9c10.8-7.4 13.6-22.3 6.2-33.1s-22.3-13.6-33.1-6.2C340.8 449.1 299.6 464 256 464C141.1 464 48 370.9 48 256S141.1 48 256 48c60.7 0 115.5 26.1 153.4 67.7l-33.5 33.5c-9.4 9.4-2.7 25.5 10.5 25.5H456c13.3 0 24-10.7 24-24V56c0-13.2-16.1-19.9-25.5-10.5L418.7 81.3C368.5 31.4 315.1 0 256 0zM232 120c0-13.3-10.7-24-24-24s-24 10.7-24 24V256c0 6.4 2.5 12.5 7 17l72 72c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-65-65V120z',
  'rocket': 'M156.6 384.9L125.7 354c-8.5-8.5-11.5-20.8-7.7-32.2c3-8.9 7-20.5 11.8-33.8L24 288c-8.6 0-16.6-4.6-20.9-12.1s-4.2-16.7 .2-24.1l52.5-88.5c13-21.9 36.5-35.3 61.9-35.3h82.3c2.4-4 4.8-7.7 7.2-11.3C289.1-4.1 411.1-8.1 483.9 5.3c11.6 2.1 20.6 11.2 22.8 22.8c13.4 72.9 9.3 194.8-111.4 276.7c-3.5 2.4-7.3 4.8-11.3 7.2v82.3c0 25.4-13.4 49-35.3 61.9l-88.5 52.5c-7.4 4.4-16.6 4.5-24.1 .2s-12.1-12.2-12.1-20.9V384.9c-13.3 4.8-24.9 8.8-33.8 11.8c-11.4 3.7-23.7 .7-32.2-7.8zM215.3 237.3c28.3-28.3 73.1-31.3 105.4-8.5L200.5 348.5c-22.8-32.3-19.8-77.1 8.5-105.4l6.3-5.8z',
  'house': 'M575.8 255.5c0 18-15 32.1-32 32.1h-32l.7 160.2c.2 35.5-28.5 64.3-64 64.3H392c-22.1 0-40-17.9-40-40V448 384c0-17.7-14.3-32-32-32H256c-17.7 0-32 14.3-32 32v64 24c0 22.1-17.9 40-40 40H128.1c-35.3 0-64-28.7-64-64V287.6H32c-18 0-32-14-32-32.1c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z',
  'ban': 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0L368 334.1c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0L175 208.9c-9.4-9.4-9.4-24.6 0-33.9z',

  // Special keys
  'arrow-right-to-bracket': 'M512 256c0 17.7-14.3 32-32 32H178.7l73.4 73.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3l128-128c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3L178.7 224H480c17.7 0 32 14.3 32 32zM0 128C0 92.7 28.7 64 64 64H192c17.7 0 32 14.3 32 32s-14.3 32-32 32H64V384H192c17.7 0 32 14.3 32 32s-14.3 32-32 32H64c-35.3 0-64-28.7-64-64V128z',
  'turn-down': 'M54.6 310.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L128 293.3V64c0-17.7 14.3-32 32-32H352c17.7 0 32 14.3 32 32s-14.3 32-32 32H192V293.3l28.1-28.1c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3l-80 80c-12.5 12.5-32.8 12.5-45.3 0l-80-80z',
  'up-long': 'M278.6 9.4c-12.5-12.5-32.8-12.5-45.3 0l-128 128c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L224 109.3V480c0 17.7 14.3 32 32 32s32-14.3 32-32V109.3l73.4 73.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-128-128z',
  'arrow-up-from-line': 'M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l96 96c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 205.3V384c0 17.7-14.3 32-32 32s-32-14.3-32-32V205.3l-41.4 41.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l96-96zM64 448c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H96c-17.7 0-32-14.3-32-32z',
  'arrow-down-to-line': 'M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l96-96c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 306.7V128c0-17.7-14.3-32-32-32s-32 14.3-32 32V306.7l-41.4-41.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l96 96zM64 64c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H96C78.3 96 64 81.7 64 64z',
  'circle': 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512z',

  // Text / rectangle selection
  // FA Free solid "font" (A glyph) — text select
  'font': 'M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c6.1 10.4 6.1 23.3 0 33.7s-17.4 16.5-29.9 16.5H35.4c-12.5 0-23.8-6.6-29.9-16.5s-6.1-23.3 0-33.7l216-368C228.7 39.5 241.8 32 256 32zm0 88.4L96.7 392h318.6L256 120.4z',
  // FA Free solid "i-cursor" — caret / character select
  'i-cursor': 'M128 64c0-17.7 14.3-32 32-32H352c17.7 0 32 14.3 32 32s-14.3 32-32 32H288v128h64c17.7 0 32 14.3 32 32s-14.3 32-32 32H288v128h64c17.7 0 32 14.3 32 32s-14.3 32-32 32H160c-17.7 0-32-14.3-32-32s14.3-32 32-32h64V288H160c-17.7 0-32-14.3-32-32s14.3-32 32-32h64V96H160c-17.7 0-32-14.3-32-32z',
  // FA Free solid "vector-square" — rectangle marquee corners
  'vector-square': 'M32 32C14.3 32 0 46.3 0 64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM32 320c-17.7 0-32 14.3-32 32v64c0 17.7 14.3 32 32 32h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352c0-17.7-14.3-32-32-32zM320 64c0 17.7 14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H352c-17.7 0-32 14.3-32 32zM480 320c-17.7 0-32 14.3-32 32v64H384c-17.7 0-32 14.3-32 32s14.3 32 32 32h64c17.7 0 32-14.3 32-32V352c0-17.7-14.3-32-32-32z',

  // FA Free solid "image" — copy hovered image
  'image': 'M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM323.8 202.5c-4.5-6.6-11.9-10.5-19.8-10.5s-15.4 3.9-19.8 10.5l-87 127.6L170.7 297c-4.6-5.7-11.5-9-18.7-9s-14.2 3.3-18.7 9l-64 80c-5.8 7.2-6.9 17.1-2.9 25.4s12.4 13.6 21.6 13.6h96 32H424c8.9 0 17.1-4.9 21.2-12.8s3.6-17.4-1.4-24.7l-120-176zM112 192a48 48 0 1 0 0-96 48 48 0 1 0 0 96z',
  // FA Free solid "video"
  'video': 'M0 128C0 92.7 28.7 64 64 64H320c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128zM559.1 99.8c10.4 5.6 16.9 16.4 16.9 28.2V384c0 11.8-6.5 22.6-16.9 28.2s-23 6-32.9 1.3L384 337.1V174.9l142.2-76.4c9.8-4.7 22.4-4.3 32.9 1.3z',
  // FA Free solid "link" — copy hovered URL
  'link': 'M326.612 185.391c59.747 59.809 58.927 155.698.36 214.59-.11.12-.24.25-.36.37l-67.2 67.2c-59.27 59.27-155.699 59.262-214.96 0-59.27-59.26-59.27-155.7 0-214.96l37.106-37.106c9.84-9.84 26.786-3.3 27.294 10.606.648 17.722 3.826 35.527 9.69 52.721 1.986 5.822.567 12.262-3.783 16.612l-13.087 13.087c-28.026 28.026-28.026 73.66 0 101.682 28.026 28.026 73.66 28.026 101.682 0l67.2-67.2c28.026-28.026 28.026-73.66 0-101.682-3.794-3.808-7.368-5.703-10.954-6.817-10.756-3.356-22.666 1.983-27.085 12.227-5.575 12.941-17.35 20.326-30.978 20.326-12.802 0-22.414-11.312-19.101-23.541 6.027-22.318 9.025-49.922 2.753-73.389-13.415-49.971.392-102.811 37.393-139.813 59.17-59.117 154.849-59.262 214.096-.31zM213.388 326.609c-59.747-59.809-58.927-155.698-.36-214.59.11-.12.24-.25.36-.37l67.2-67.2c59.27-59.27 155.699-59.262 214.96 0 59.27 59.26 59.27 155.7 0 214.96l-37.106 37.106c-9.84 9.84-26.786 3.3-27.294-10.606-.648-17.722-3.826-35.527-9.69-52.721-1.986-5.822-.567-12.262 3.783-16.612l13.087-13.087c28.026-28.026 28.026-73.66 0-101.682-28.026-28.026-73.66-28.026-101.682 0l-67.2 67.2c-28.026 28.026-28.026 73.66 0 101.682 3.794 3.808 7.368 5.703 10.954 6.817 10.756 3.356 22.666-1.983 27.085-12.227 5.575-12.941 17.35-20.326 30.978-20.326 12.802 0 22.414 11.312 19.101 23.541-6.027 22.318-9.025 49.922-2.753 73.389 13.415 49.971-.392 102.811-37.393 139.813-59.17 59.117-154.849 59.262-214.096.31z',

  // FA Free solid "table-columns" — Cols Toggle multicol layout
  'table-columns': 'M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zm64 64V416H224V160H64zm320 0H288V416H448V160z',

  // Library / macro / clipboard / AI (Config card keycaps + Reference parity)
  'clipboard': 'M192 0c35.3 0 64 28.7 64 64l0 32 112 0c35.3 0 64 28.7 64 64l0 288c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 160c0-35.3 28.7-64 64-64l112 0 0-32c0-35.3 28.7-64 64-64zm0 64l0 32 64 0 0-32c0-17.7-14.3-32-32-32s-32 14.3-32 32zM64 160l0 288c0 17.7 14.3 32 32 32l256 0c17.7 0 32-14.3 32-32l0-288c0-17.7-14.3-32-32-32L64 128c-17.7 0-32 14.3-32 32z',
  'scissors': 'M44.6 66.2l117.5 117.5c-4.7 8-7.1 17-7.1 26.3c0 26.5 21.5 48 48 48s48-21.5 48-48s-21.5-48-48-48c-4.8 0-9.4 .7-13.7 2L44.6 66.2C39.3 60.9 30.7 60.9 25.4 66.2S20.1 80.1 25.4 85.4L44.6 66.2zM203.2 237.8L85.4 355.6c-5.3 5.3-5.3 13.9 0 19.2s13.9 5.3 19.2 0l117.8-117.8c4.3 1.3 8.9 2 13.7 2c26.5 0 48-21.5 48-48s-21.5-48-48-48c-9.3 0-18.3 2.4-26.3 7.1zM432 144c26.5 0 48-21.5 48-48s-21.5-48-48-48s-48 21.5-48 48s21.5 48 48 48zm0 256c26.5 0 48-21.5 48-48s-21.5-48-48-48s-48 21.5-48 48s21.5 48 48 48zM162.6 466.2c5.3 5.3 13.9 5.3 19.2 0L467.4 180.6c5.3-5.3 5.3-13.9 0-19.2s-13.9-5.3-19.2 0L162.6 447c-5.3 5.3-5.3 13.9 0 19.2z',
  'robot': 'M32 160c0-35.3 28.7-64 64-64l32 0 0-32c0-17.7 14.3-32 32-32s32 14.3 32 32l0 32 128 0 0-32c0-17.7 14.3-32 32-32s32 14.3 32 32l0 32 32 0c35.3 0 64 28.7 64 64l0 32 32 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-32 0 0 128c0 35.3-28.7 64-64 64l-16 0 0 48c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-48-128 0 0 48c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-48-16 0c-35.3 0-64-28.7-64-64l0-128-32 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l32 0 0-32zm96 64a32 32 0 1 0 0 64 32 32 0 1 0 0-64zm128 32a32 32 0 1 0 64 0 32 32 0 1 0-64 0z',
  'book': 'M96 0C43 0 0 43 0 96L0 416c0 53 43 96 96 96l288 0 32 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l0-64c17.7 0 32-14.3 32-32l0-320c0-17.7-14.3-32-32-32L384 0 96 0zM384 416l0 32L96 448c-17.7 0-32-14.3-32-32s14.3-32 32-32l288 0zM112 64l160 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-160 0c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 96l160 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-160 0c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 96l96 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-96 0c-8.8 0-16-7.2-16-16s7.2-16 16-16z',
  'language': 'M478.3 73.8c-5.7-10.7-16.8-17.3-28.7-17.3l-51.1 0c-12.5 0-24.7 4.9-33.7 13.7L192 242.7 96 146.7c-9-8.8-21.2-13.7-33.7-13.7L11.2 133C-.7 133-11.8 139.6-17.5 150.3S-24 174.1-18.5 185.3L73.1 352 18.5 454.7C13 465.9 16.1 478.9 24.9 486.6S47.1 496 58.5 490.5L160 432.9 261.5 490.5c11.4 5.5 24.9 2.6 33.7-5.1s11.9-20.7 6.4-32.1L246.9 352 338.5 185.3c5.5-11.2 2.4-24.2-6.4-31.9zM192 309.3L128 192l64 117.3zm192-245.3L480 192 384 64z',
  'bolt': 'M234.5 5.7c13.9-5 29.1-.6 38.2 10.9l144 176c9.2 11.2 11.2 27.1 5.1 40.3s-19.2 21.1-33.3 21.1L320 254V432c0 26.5-21.5 48-48 48H176c-26.5 0-48-21.5-48-48V254H53.5c-14.1 0-27.1-7.9-33.3-21.1s-4.1-29 5.1-40.3l144-176c9.2-11.5 24.3-15.9 38.2-10.9z',
  'arrows-rotate': 'M105.1 202.6c7.7-21.8 20.2-42.3 37.8-59.1c62.5-62.5 163.8-62.5 226.3 0L417.3 192 384 192c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0 16 0c17.7 0 32-14.3 32-32l0-96c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 36.7L425.4 89.9C332.4-3.1 181.2-3.1 88.2 89.9c-29.1 29.1-48.5 64.9-56.5 103.5c-3.8 18.5 10.1 36.9 29.1 36.9c14.2 0 26.8-9.9 30.3-23.7zM406.9 309.4c-7.7 21.8-20.2 42.3-37.8 59.1c-62.5 62.5-163.8 62.5-226.3 0L94.7 320l33.3 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 256l-16 0C-1.7 256-16 270.3-16 288l0 96c0 17.7 14.3 32 32 32s32-14.3 32-32l0-36.7 33.9 33.9C186.8 515.1 338 515.1 431 422.1c29.1-29.1 48.5-64.9 56.5-103.5c3.8-18.5-10.1-36.9-29.1-36.9c-14.2 0-26.8 9.9-30.3 23.7z',
  'layer-group': 'M32 96l224-80 224 80L256 176 32 96zM32 192l224 80 224-80 0 32L256 304 32 224l0-32zm0 96l224 80 224-80 0 32L256 400 32 320l0-32z',
  'globe': 'M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-196.8 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-144 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z',
  'location-dot': 'M256 64c-70.7 0-128 57.3-128 128c0 82.4 92.3 197.6 118.7 227.5c4.8 5.4 13.8 5.4 18.6 0C291.7 389.6 384 274.4 384 192c0-70.7-57.3-128-128-128zm0 176a48 48 0 1 1 0-96 48 48 0 1 1 0 96z'
});

/**
 * Map KeyPilot action IDs → FA icon keys (for CSS data-kp-icon / attribute selectors).
 * @type {Readonly<Record<string, string>>}
 */
export const KEYBOARD_ACTION_ICON_IDS = Object.freeze({
  ACTIVATE: 'hand-pointer',
  ACTIVATE_NEW_TAB: 'arrow-up-right-from-square',
  ACTIVATE_NEW_TAB_BACKGROUND: 'clone',
  BACK: 'arrow-left',
  BACK2: 'arrow-left',
  FORWARD: 'arrow-right',
  DELETE: 'trash',
  COLS_TOGGLE: 'table-columns',
  TAB_LEFT: 'chevron-left',
  TAB_RIGHT: 'chevron-right',
  ROOT: 'house',
  LAUNCHER: 'rocket',
  CLOSE_TAB: 'xmark',
  CANCEL: 'ban',
  PAGE_UP_INSTANT: 'arrow-up',
  PAGE_DOWN_INSTANT: 'arrow-down',
  PAGE_TOP: 'arrow-up-from-line',
  PAGE_BOTTOM: 'arrow-down-to-line',
  SCROLL_LINE: 'circle',
  NEW_TAB: 'folder-plus',
  OPEN_POPOVER: 'window-maximize',
  PREVIEW_LINK_POPOVER: 'eye',
  POI_WEBSITE: 'globe',
  POI_ADDRESS: 'location-dot',
  OPEN_SETTINGS_POPOVER: 'gear',
  OMNIBOX: 'magnifying-glass',
  TAB_HISTORY: 'clock-rotate-left',
  TOGGLE_KEYBOARD_HELP: 'keyboard',
  // Selection tools (recently re-enabled; were missing from the icon map)
  HIGHLIGHT: 'i-cursor',
  RECTANGLE_HIGHLIGHT: 'vector-square',
  COPY_HOVERED_IMAGE: 'image',
  COPY_HOVERED_URL: 'link',
  COPY_HOVERED_VIDEO: 'video',
  PAGE_MEDIA: 'image',
  OPEN_MEDIA_LIBRARY: 'image',
  // Function Library (Config cards + placeable Actions)
  CLIPBOARD_COPY: 'clipboard',
  CLIPBOARD_CUT: 'scissors',
  CLIPBOARD_PASTE: 'clipboard',
  CLIPBOARD_SELECT_ALL: 'font',
  SEND_TEXT_TO_AI: 'robot',
  SEND_HOTKEY: 'keyboard',
  SEND_BURST: 'bolt',
  CYCLE_ROUND_ROBIN: 'arrows-rotate',
  HOLD_CONTINUOUS: 'circle',
  CLICK_MOUSE_BUTTON: 'hand-pointer',
  REMAP_KEY: 'keyboard',
  TYPE_CHARACTERS: 'font',
  GET_TEXT_AT_CURSOR: 'i-cursor',
  GET_TEXT_RANGE: 'font',
  GET_MEDIA_AT_CURSOR: 'image',
  LOOKUP_WORD: 'book',
  TRANSLATE: 'language',
  SHOW_POPOVER: 'window-maximize',
  ADD_URL_TO_MEDIA_LIBRARY: 'plus',
  FETCH_URL_FOR_MEDIA_LIBRARY: 'arrow-down'
});

/**
 * @param {string} pathD
 * @param {string} [fill='black']
 * @returns {string} CSS url("data:image/svg+xml,...") for a solid glyph
 */
function faIconDataUri(pathD, fill = 'black') {
  const safeFill = String(fill || 'black').replace(/"/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="${safeFill}"><path d="${pathD}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Data-URI for a KeyPilot action's Font Awesome-style icon (for popovers / UI chrome).
 * @param {string} actionId
 * @param {{ fill?: string }} [opts]
 * @returns {string} empty string when no icon is mapped
 */
export function getActionIconDataUri(actionId, opts = {}) {
  const iconName = KEYBOARD_ACTION_ICON_IDS[actionId];
  const pathD = iconName ? FA_SOLID_PATHS[iconName] : null;
  if (!pathD) return '';
  return faIconDataUri(pathD, opts.fill || 'white');
}

/**
 * Pro keycap material tokens for a color family.
 * Icons use a darker solid of the same family via --kp-key-icon.
 * @param {{ face: string, mid: string, deep: string, icon: string, glow?: string }} t
 * @returns {string}
 */
function keycapMaterial(t) {
  return `
  --kp-key-face: ${t.face};
  --kp-key-mid: ${t.mid};
  --kp-key-deep: ${t.deep};
  --kp-key-icon: ${t.icon};
  --kp-key-glow: ${t.glow || 'transparent'};
`;
}

/**
 * Build CSS rules that paint FA icons as darker monochrome key glyphs.
 * Uses mask-image + background-color so the icon inherits --kp-key-icon per key family.
 * @returns {string}
 */
function getKeyboardKeyIconCss() {
  const iconUris = {};
  for (const [name, pathD] of Object.entries(FA_SOLID_PATHS)) {
    iconUris[name] = faIconDataUri(pathD);
  }

  const lines = [];

  lines.push(`
.${KEYBINDINGS_UI_ROOT_CLASS} .key > .key-bg-icon {
  position: absolute;
  inset: 7%;
  z-index: 0;
  pointer-events: none;
  /*
   * Transparent until an action rule applies both a mask and paint color.
   * mask-image:none + solid background-color otherwise paints a dark rectangle
   * (was visible on unmapped action keys like COPY_HOVERED_IMAGE before its icon).
   */
  background-color: transparent;
  background-image: none;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center center;
  mask-position: center center;
  -webkit-mask-size: 86% 86%;
  mask-size: 86% 86%;
  -webkit-mask-image: none;
  mask-image: none;
  opacity: 0.92;
}

/*
 * IMPORTANT: do NOT force position:relative on all non-icon children.
 * Action names (.key-main) and letter labels (.key-label) are absolutely
 * layered; a later relative rule would put letters back into flex flow.
 */

.${KEYBINDINGS_UI_ROOT_CLASS} .key:hover > .key-bg-icon {
  opacity: 1;
}

/* Keys without functions/macros never paint an icon layer */
.${KEYBINDINGS_UI_ROOT_CLASS} .key:not([data-kp-action-id]):not([data-kp-macro-id]) > .key-bg-icon {
  display: none;
}

/*
 * Solid darken overlay for keydown feedback (more reliable than filter).
 * No opacity transition: when content-script replaces early-inject CSS (font URLs),
 * a transitioned opacity:0 rule animates from the UA default (1→0) and every key
 * briefly looks pressed — most noticeable on colored caps like K (KB Reference).
 */
.${KEYBINDINGS_UI_ROOT_CLASS} .key > .key-press-overlay {
  position: absolute;
  inset: 0;
  z-index: 6;
  box-sizing: border-box;
  border-radius: inherit;
  background: rgba(0, 0, 0, 0.78);
  opacity: 0;
  pointer-events: none;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.kp-key-pressed > .key-press-overlay,
.${KEYBINDINGS_UI_ROOT_CLASS} .key > .key-press-overlay.is-on {
  opacity: 1;
}
`);

  // Action-specific icon masks only (keys with KeyPilot functions).
  // Color is applied here (not on the base rule) so unmapped actions stay transparent.
  for (const [actionId, iconName] of Object.entries(KEYBOARD_ACTION_ICON_IDS)) {
    const uri = iconUris[iconName];
    if (!uri) continue;
    lines.push(
      `.${KEYBINDINGS_UI_ROOT_CLASS} .key[data-kp-action-id="${actionId}"] > .key-bg-icon {` +
      ` -webkit-mask-image: ${uri}; mask-image: ${uri};` +
      ` background-color: var(--kp-key-icon, #0c1018); }`
    );
  }

  // Macros share one glyph (Reference + Config library cards).
  if (iconUris['layer-group']) {
    lines.push(
      `.${KEYBINDINGS_UI_ROOT_CLASS} .key[data-kp-macro-id] > .key-bg-icon {` +
      ` -webkit-mask-image: ${iconUris['layer-group']}; mask-image: ${iconUris['layer-group']};` +
      ` background-color: var(--kp-key-icon, #0c1018); }`
    );
  }

  return lines.join('\n');
}

/**
 * Ensure a key element has the faded background-icon layer.
 * Safe to call repeatedly (idempotent).
 * @param {Document} doc
 * @param {HTMLElement} keyEl
 */
export function ensureKeyBackgroundIcon(doc, keyEl) {
  if (!doc || !keyEl) return;
  try {
    if (keyEl.querySelector(':scope > .key-bg-icon')) return;
  } catch {
    if (keyEl.querySelector('.key-bg-icon')) return;
  }
  const icon = doc.createElement('span');
  icon.className = 'key-bg-icon';
  icon.setAttribute('aria-hidden', 'true');
  keyEl.insertBefore(icon, keyEl.firstChild);
}

/**
 * Ensure a key has a dedicated press-feedback overlay element.
 * Appended last so it paints above legends/icons.
 * Safe to call repeatedly (idempotent).
 * @param {Document} doc
 * @param {HTMLElement} keyEl
 * @returns {HTMLElement|null}
 */
export function ensureKeyPressOverlay(doc, keyEl) {
  if (!doc || !keyEl) return null;
  let overlay = null;
  try {
    overlay = keyEl.querySelector(':scope > .key-press-overlay');
  } catch {
    overlay = keyEl.querySelector('.key-press-overlay');
  }
  if (overlay) return overlay;
  overlay = doc.createElement('span');
  overlay.className = 'key-press-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  // Keep the overlay hidden even during the brief stylesheet handoff from
  // early-inject to the bundled UI stylesheet.
  overlay.style.opacity = '0';
  overlay.style.transition = 'none';
  keyEl.appendChild(overlay);
  return overlay;
}

/**
 * Toggle overt press feedback via a dedicated dark overlay element.
 * Prefer this over filter/transform on the key itself.
 * @param {HTMLElement} keyEl
 * @param {boolean} pressed
 * @param {Document} [doc]
 */
export function setKeyPressedState(keyEl, pressed, doc) {
  if (!keyEl) return;
  const d = doc || keyEl.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (pressed) {
    keyEl.classList.add('kp-key-pressed');
    const overlay = d ? ensureKeyPressOverlay(d, keyEl) : null;
    if (overlay) overlay.classList.add('is-on');
  } else {
    keyEl.classList.remove('kp-key-pressed');
    let overlay = null;
    try {
      overlay = keyEl.querySelector(':scope > .key-press-overlay');
    } catch {
      overlay = keyEl.querySelector('.key-press-overlay');
    }
    if (overlay) overlay.classList.remove('is-on');
  }
}

/**
 * @font-face rules for keyboard UI fonts.
 * `font-display: block` avoids a fallback-font flash on key labels (FOUT from `swap`).
 * Pair with {@link preloadKeybindingsUiFonts} so the block period is typically zero.
 *
 * @param {{ robotech?: string, titillium?: string, cubellan?: string, ezarion?: string, dosis?: string }} [fontUrls]
 * @returns {string}
 */
export function getKeybindingsUiFontFaceCss(fontUrls = {}) {
  const urlRobotech = fontUrls.robotech || KEYBINDINGS_UI_FONT_PLACEHOLDERS.ROBOTECH;
  const urlTitillium = fontUrls.titillium || KEYBINDINGS_UI_FONT_PLACEHOLDERS.TITILLIUM;
  const urlCubellan = fontUrls.cubellan || KEYBINDINGS_UI_FONT_PLACEHOLDERS.CUBELLAN;
  const urlEzarion = fontUrls.ezarion || KEYBINDINGS_UI_FONT_PLACEHOLDERS.EZARION;
  const urlDosis = fontUrls.dosis || KEYBINDINGS_UI_FONT_PLACEHOLDERS.DOSIS;
  return `
@font-face {
  font-family: "ROBOTECHGPRegular";
  src: url("${urlRobotech}") format("truetype");
  font-weight: normal;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: "TitilliumText";
  src: url("${urlTitillium}") format("opentype");
  font-weight: normal;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: "Cubellan";
  src: url("${urlCubellan}") format("truetype");
  font-weight: normal;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: "Ezarion";
  src: url("${urlEzarion}") format("truetype");
  font-weight: normal;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: "Dosis";
  src: url("${urlDosis}") format("truetype");
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
`.trim();
}

/**
 * Start fetching keyboard fonts before the first keycap paint.
 * Dosis is the key-label face; the others are declared in the same @font-face sheet.
 *
 * @param {Document|null|undefined} doc
 * @param {{ robotech?: string, titillium?: string, cubellan?: string, ezarion?: string, dosis?: string }|null|undefined} fontUrls
 */
export function preloadKeybindingsUiFonts(doc, fontUrls) {
  if (!doc || !fontUrls) return;
  const head = doc.head || doc.documentElement;
  if (!head?.appendChild) return;
  const entries = [
    { id: 'dosis', href: fontUrls.dosis, type: 'font/ttf' },
    { id: 'robotech', href: fontUrls.robotech, type: 'font/ttf' },
    { id: 'titillium', href: fontUrls.titillium, type: 'font/otf' },
    { id: 'cubellan', href: fontUrls.cubellan, type: 'font/ttf' },
    { id: 'ezarion', href: fontUrls.ezarion, type: 'font/ttf' }
  ];
  for (const { id, href, type } of entries) {
    if (!href || String(href).includes('__KP_FONT_')) continue;
    try {
      if (head.querySelector(`link[${KEYBINDINGS_UI_FONT_PRELOAD_ATTR}="${id}"]`)) continue;
    } catch { /* ignore */ }
    try {
      const link = doc.createElement('link');
      link.rel = 'preload';
      link.as = 'font';
      link.type = type;
      link.href = href;
      link.crossOrigin = 'anonymous';
      link.setAttribute(KEYBINDINGS_UI_FONT_PRELOAD_ATTR, id);
      head.appendChild(link);
    } catch { /* ignore */ }
  }
  try {
    if (fontUrls.dosis && !String(fontUrls.dosis).includes('__KP_FONT_') && doc.fonts?.load) {
      void doc.fonts.load('10px "Dosis"');
    }
  } catch { /* ignore */ }
}

/**
 * Generate the injected CSS used by the keyboard UI (both early + bundled).
 *
 * @param {Object} params
 * @param {number} params.zKeybindingsPopover
 */
export function getKeybindingsUiCss({ zKeybindingsPopover, fontUrls } = {}) {
  const z = Number.isFinite(zKeybindingsPopover) ? zKeybindingsPopover : Number(zKeybindingsPopover);
  // Default matches Z_INDEX.KEYBINDINGS_POPOVER in constants.js (stamped at build time when possible).
  const zIndex = Number.isFinite(z) ? z : 2147483046;

  // Font URLs are optional because `build.js` needs to stamp CSS into `early-inject.js`
  // without knowing the runtime extension ID. When omitted, we emit placeholders that
  // can be replaced at runtime (early-inject) or overwritten by the bundled UI.
  const urlRobotech = (fontUrls && fontUrls.robotech) || KEYBINDINGS_UI_FONT_PLACEHOLDERS.ROBOTECH;
  const urlTitillium = (fontUrls && fontUrls.titillium) || KEYBINDINGS_UI_FONT_PLACEHOLDERS.TITILLIUM;
  const urlCubellan = (fontUrls && fontUrls.cubellan) || KEYBINDINGS_UI_FONT_PLACEHOLDERS.CUBELLAN;
  const urlEzarion = (fontUrls && fontUrls.ezarion) || KEYBINDINGS_UI_FONT_PLACEHOLDERS.EZARION;
  const urlDosis = (fontUrls && fontUrls.dosis) || KEYBINDINGS_UI_FONT_PLACEHOLDERS.DOSIS;

  const keyIconCss = getKeyboardKeyIconCss();
  const fontFaceCss = getKeybindingsUiFontFaceCss({
    robotech: urlRobotech,
    titillium: urlTitillium,
    cubellan: urlCubellan,
    ezarion: urlEzarion,
    dosis: urlDosis
  });

  return `
/* KeyPilot Keybindings UI (injected) */
${fontFaceCss}

/* Style isolation: all keyboard rules are scoped so host page CSS won't override them */
.${KEYBINDINGS_UI_ROOT_CLASS} {
  --kp-accent: #5be2f1;
}

/* ── Keyboard plate (pro app tray) ─────────────────────────────── */
.keyboard-visual.${KEYBINDINGS_UI_ROOT_CLASS} {
  --kp-kb-surface: #12151c;
  --kp-kb-well: #0a0c11;
  --kp-kb-rim: rgba(255, 255, 255, 0.08);
  box-sizing: border-box;
  width: 100%;
  padding: 5px;
  border-radius: 14px;
  border: 1px solid var(--kp-kb-rim);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0%, transparent 28%),
    radial-gradient(120% 80% at 50% 0%, rgba(91, 226, 241, 0.05) 0%, transparent 55%),
    linear-gradient(180deg, #161a22 0%, var(--kp-kb-surface) 45%, var(--kp-kb-well) 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.06) inset,
    0 -1px 0 rgba(0, 0, 0, 0.45) inset,
    0 12px 28px rgba(0, 0, 0, 0.45),
    0 2px 0 rgba(0, 0, 0, 0.35);
  font-family: "Dosis", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-size: 10px;
  line-height: 1.1;
  user-select: none;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .keyboard-row {
  display: flex;
  justify-content: center;
  align-items: stretch;
  margin-bottom: 7px;
  gap: 5px;
  width: 100%;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .keyboard-row:last-child {
  margin-bottom: 0;
}

/* ── Base keycap: low-profile chiclet (flat + lightly realistic) ─ */
.${KEYBINDINGS_UI_ROOT_CLASS} .key {
  --kp-key-face: #3d4454;
  --kp-key-mid: #343a48;
  --kp-key-deep: #2c313e;
  --kp-key-icon: #1a1e28;
  --kp-key-glow: transparent;

  position: relative;
  /*
   * This UI lives in the page's light DOM. Some sites apply high-priority
   * button resets (large min-heights, padding, and white focus rings), which
   * can briefly win during the early-shell → bundled-style handoff.
   */
  box-sizing: border-box !important;
  margin: 0 !important;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  cursor: default;
  appearance: none !important;
  -webkit-appearance: none !important;
  outline: none !important;
  color: rgba(248, 250, 252, 0.94);
  text-align: center;
  overflow: hidden;

  /* Equal geometry for alphanumeric keys */
  flex: 1 1 0 !important;
  min-width: 0 !important;
  width: 0 !important;
  height: 50px !important;
  min-height: 50px !important;
  max-height: 50px !important;
  /* Block layout: letter/name layers are absolutely positioned (not flex-flow) */
  display: block !important;
  padding: 0 !important;
  border-radius: 7px;

  /*
   * Low-profile key: nearly flat face, thin rim, soft ground shadow.
   * Reads more like a real chiclet key than a heavy 3D bevel.
   */
  border: 1px solid rgba(0, 0, 0, 0.4);
  border-top-color: rgba(255, 255, 255, 0.1);
  border-bottom-color: rgba(0, 0, 0, 0.5);

  background:
    linear-gradient(180deg,
      rgba(255, 255, 255, 0.07) 0%,
      rgba(255, 255, 255, 0.02) 18%,
      transparent 42%),
    linear-gradient(180deg,
      var(--kp-key-face) 0%,
      var(--kp-key-mid) 70%,
      var(--kp-key-deep) 100%);

  box-shadow:
    0 1px 0 rgba(0, 0, 0, 0.45),
    0 2px 4px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -1px 0 rgba(0, 0, 0, 0.18);

  transition:
    transform 100ms ease,
    box-shadow 100ms ease,
    filter 100ms ease,
    border-color 100ms ease,
    background 100ms ease;
}

/* Minimal face sheen (not a tall sculpted plate) */
.${KEYBINDINGS_UI_ROOT_CLASS} .key::before {
  content: '';
  position: absolute;
  z-index: 0;
  top: 1px;
  left: 2px;
  right: 2px;
  height: 38%;
  border-radius: 5px 5px 40% 40%;
  background: linear-gradient(180deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.02) 60%,
    transparent 100%);
  pointer-events: none;
}

/* Prevent UA :disabled washout on edit-readonly keycaps (still non-interactive). */
.${KEYBINDINGS_UI_ROOT_CLASS} .key:disabled {
  opacity: 1;
  color: inherit;
  cursor: default;
}

.${KEYBINDINGS_UI_ROOT_CLASS} [data-kp-action-id] {
  cursor: pointer;
}

.${KEYBINDINGS_UI_ROOT_CLASS} [data-kp-action-id]:hover {
  filter: brightness(1.07);
  border-top-color: rgba(255, 255, 255, 0.14);
  box-shadow:
    0 1px 0 rgba(0, 0, 0, 0.4),
    0 3px 8px rgba(0, 0, 0, 0.28),
    0 0 0 1px rgba(255, 255, 255, 0.04),
    0 0 10px var(--kp-key-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -1px 0 rgba(0, 0, 0, 0.16);
}

/*
 * Layered key legend (independent of each other):
 * - .key-main  = action name — upper band only
 * - .key-label = physical key letter — always pinned bottom-center
 * - .key-text  = special / unassigned glyph
 */
.${KEYBINDINGS_UI_ROOT_CLASS} .key > .key-main {
  position: absolute;
  z-index: 1;
  /* Pin action name to the top of the key face */
  top: 3px;
  left: 2px;
  right: 2px;
  bottom: auto;
  /* Leave a fixed bottom band for the letter; never push it */
  height: auto;
  max-height: 30px;
  box-sizing: border-box;
  margin: 0;
  padding: 0 1px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.02em;
  line-height: 1.1;
  opacity: 0.9;
  text-transform: uppercase;
  color: rgba(248, 250, 252, 0.94);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  word-break: break-word;
  hyphens: auto;
  text-align: center;
  pointer-events: none;
}

/* Letter / chrome labels: fixed bottom layer on every key */
.${KEYBINDINGS_UI_ROOT_CLASS} .key > .key-label,
.${KEYBINDINGS_UI_ROOT_CLASS} .key > .key-text {
  position: absolute;
  z-index: 2;
  left: 0;
  right: 0;
  bottom: 3px;
  top: auto;
  transform: none;
  box-sizing: border-box;
  margin: 0;
  padding: 0 2px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1;
  text-align: center;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key > .key-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--kp-accent, #5be2f1);
}

/* Edit-mode slot delete: pin to the keycap's upper-right, above the FA glyph. */
.${KEYBINDINGS_UI_ROOT_CLASS} .key > .kp-key-delete {
  position: absolute !important;
  top: 1px !important;
  right: 1px !important;
  left: auto !important;
  bottom: auto !important;
  width: 14px !important;
  height: 14px !important;
  min-width: 14px !important;
  min-height: 14px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  border-radius: 3px;
  display: none;
  align-items: center;
  justify-content: center;
  line-height: 12px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  color: rgba(248, 250, 252, 0.95);
  background: rgba(220, 50, 50, 0.85);
  z-index: 8;
  pointer-events: auto;
}
.${KEYBINDINGS_UI_ROOT_CLASS} .key:hover > .kp-key-delete,
.${KEYBINDINGS_UI_ROOT_CLASS} .key:focus-within > .kp-key-delete {
  display: flex !important;
}
.${KEYBINDINGS_UI_ROOT_CLASS} .key > .kp-key-delete:hover {
  background: rgba(255, 70, 70, 1);
}

/* Edit-mode plate hatch (same steel lines as Keyboard Layout Config). */
.keyboard-visual.${KEYBINDINGS_UI_ROOT_CLASS}.kp-kb-edit-hatch {
  background:
    repeating-linear-gradient(
      -45deg,
      rgba(180, 200, 220, 0.08) 0px,
      rgba(180, 200, 220, 0.08) 1px,
      transparent 1px,
      transparent 7px
    ),
    linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, transparent 28%),
    radial-gradient(120% 80% at 50% 0%, rgba(91, 226, 241, 0.07) 0%, transparent 55%),
    linear-gradient(180deg, #222833 0%, #1a1f28 45%, #13161e 100%) !important;
}

/* Special chrome labels (Tab/Caps/…) */
.${KEYBINDINGS_UI_ROOT_CLASS} .key > .key-text {
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.02em;
  color: rgba(248, 250, 252, 0.92);
}

/* Unassigned letter-only keys: still bottom-centered (same letter layer) */
.${KEYBINDINGS_UI_ROOT_CLASS} .key:not([data-kp-action-id]):not(.key-tab):not(.key-caps):not(.key-enter):not(.key-shift):not(.key-backspace) > .key-text {
  bottom: 3px;
  top: auto;
  transform: none;
  font-size: 12px;
  font-weight: 700;
  color: var(--kp-accent, #5be2f1);
}

/* Special keys: wider, same height */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-tab,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-caps,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-enter,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-shift,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-backspace {
  height: 50px;
  min-height: 50px;
  max-height: 50px;
  width: auto;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-tab { flex: 1.25 1 0; }
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-caps { flex: 1.35 1 0; }
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-enter { flex: 1.55 1 0; }
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-shift { flex: 1.65 1 0; }
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-backspace { flex: 1.55 1 0; }

/* ── Color families (muted pro tints + darker icon color) ─────── */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-activate,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-activate-new,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-activate-new-over,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-tab-right,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-new-tab,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-open-popover,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-preview-popover,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-page-up,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-page-down,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-page-up-instant,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-page-down-instant,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-help,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-omnibox {
  ${keycapMaterial({
    face: '#2f8f5b',
    mid: '#247a4c',
    deep: '#17633a',
    icon: '#0d3a22',
    glow: 'rgba(34, 197, 94, 0.18)'
  })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-back,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-forward,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-scroll-top,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-scroll-bottom {
  ${keycapMaterial({
    face: '#2f7ea8',
    mid: '#256b92',
    deep: '#1a5475',
    icon: '#0d3044',
    glow: 'rgba(56, 189, 248, 0.16)'
  })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-delete,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-close-tab {
  ${keycapMaterial({
    face: '#b84a4a',
    mid: '#9e3b3b',
    deep: '#7a2b2b',
    icon: '#401616',
    glow: 'rgba(248, 113, 113, 0.16)'
  })}
}

/* Selection tools: indigo family (distinct from green activate / blue nav / amber unused) */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-highlight,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-rect-highlight {
  ${keycapMaterial({
    face: '#5b6fd4',
    mid: '#4a5cbb',
    deep: '#3949a0',
    icon: '#1a2258',
    glow: 'rgba(99, 102, 241, 0.18)'
  })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-scroll {
  ${keycapMaterial({
    face: '#7a5638',
    mid: '#63452c',
    deep: '#4a3320',
    icon: '#26180f',
    glow: 'rgba(180, 120, 70, 0.12)'
  })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-purple,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-cols {
  ${keycapMaterial({
    face: '#7a4ab8',
    mid: '#663d9e',
    deep: '#4e2e7a',
    icon: '#281646',
    glow: 'rgba(167, 139, 250, 0.14)'
  })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-orange {
  ${keycapMaterial({
    face: '#c97a28',
    mid: '#a8641e',
    deep: '#834f16',
    icon: '#3f250a',
    glow: 'rgba(255, 165, 0, 0.14)'
  })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-launcher-orange {
  ${keycapMaterial({
    face: '#a06a3a',
    mid: '#85562e',
    deep: '#664122',
    icon: '#322010',
    glow: 'rgba(184, 115, 51, 0.12)'
  })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-settings-dark {
  ${keycapMaterial({
    face: '#3a4250',
    mid: '#2a313c',
    deep: '#1a1f28',
    icon: '#0c0f14',
    glow: 'rgba(148, 163, 184, 0.1)'
  })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-gray {
  ${keycapMaterial({
    face: '#5a6270',
    mid: '#484f5c',
    deep: '#343a45',
    icon: '#1a1e26',
    glow: 'rgba(148, 163, 184, 0.1)'
  })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-launcher {
  ${keycapMaterial({
    face: '#2a8fa3',
    mid: '#22788a',
    deep: '#185e6d',
    icon: '#0c343c',
    glow: 'rgba(34, 211, 238, 0.14)'
  })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-hatched {
  position: relative;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-hatched::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    repeating-linear-gradient(
      45deg,
      rgba(200, 200, 200, 0.4) 0px,
      rgba(200, 200, 200, 0.4) 1px,
      transparent 1px,
      transparent 4px
    );
  pointer-events: none;
  border-radius: 4px;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-radial-overlay::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at center,
    rgba(150, 150, 150, 0.3) 0%,
    rgba(120, 120, 120, 0.25) 30%,
    transparent 70%);
  pointer-events: none;
  border-radius: 4px;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-checkerboard-overlay::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    radial-gradient(circle at 25% 25%, rgba(160, 160, 160, 0.3) 2px, transparent 2px),
    radial-gradient(circle at 75% 75%, rgba(160, 160, 160, 0.3) 2px, transparent 2px);
  background-size: 8px 8px;
  pointer-events: none;
  border-radius: 4px;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-stripes-overlay::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    linear-gradient(90deg, transparent 0%, transparent 40%, rgba(180, 180, 180, 0.25) 40%, rgba(180, 180, 180, 0.25) 60%, transparent 60%);
  background-size: 6px 100%;
  pointer-events: none;
  border-radius: 4px;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-crosshatch-overlay::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    repeating-linear-gradient(45deg, rgba(170, 170, 170, 0.25) 0px, rgba(170, 170, 170, 0.25) 1px, transparent 1px, transparent 4px),
    repeating-linear-gradient(-45deg, rgba(170, 170, 170, 0.25) 0px, rgba(170, 170, 170, 0.25) 1px, transparent 1px, transparent 4px);
  pointer-events: none;
  border-radius: 4px;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-noise-overlay::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    linear-gradient(45deg, rgba(80, 80, 80, 0.2) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(80, 80, 80, 0.2) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(80, 80, 80, 0.2) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(80, 80, 80, 0.2) 75%);
  background-size: 4px 4px;
  pointer-events: none;
  border-radius: 4px;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-conic-overlay::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: conic-gradient(
    from 45deg,
    rgba(100, 100, 100, 0.2) 0deg,
    rgba(120, 120, 120, 0.25) 90deg,
    rgba(140, 140, 140, 0.2) 180deg,
    rgba(100, 100, 100, 0.2) 360deg
  );
  pointer-events: none;
  border-radius: 4px;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-dashed-overlay::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  box-shadow: inset 0 0 0 2px rgba(140, 140, 140, 0.4);
  pointer-events: none;
  border-radius: 4px;
}

/*
 * Keydown/keyup press feedback is a dedicated .key-press-overlay element
 * (see ensureKeyPressOverlay / setKeyPressedState). Avoid filter/transform
 * on the key itself — those were hard to see on colored keycaps.
 */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.kp-key-pressed {
  outline: none;
}

/*
 * Text / typing mode:
 * - Default keys: plain typing chiclets (no function color/icon/label) + crisp orange outline.
 * - Countdown-armed actions (.kp-key-text-mode-active): full function chrome restored
 *   (color fill, FA icon, action label) with the key's own material glow (green for
 *   Click Element). The live-action set is TEXT_MODE_COUNTDOWN_ACTION_IDS.
 */
.${KEYBINDINGS_UI_ROOT_CLASS}.kp-text-mode-filter .key:not(.kp-key-text-mode-active) {
  /* Orange-cast chiclet face (same family as titlebar / control-strip text mode). */
  --kp-key-face: #5a4834;
  --kp-key-mid: #4a3a28;
  --kp-key-deep: #3a2c1c;
  --kp-key-icon: #1a1e28;
  --kp-key-glow: transparent;
  opacity: 1;
  filter: none;
  border-color: rgba(255, 140, 0, 0.85) !important;
  border-top-color: rgba(255, 170, 70, 0.9) !important;
  border-bottom-color: rgba(200, 100, 0, 0.9) !important;
  /* Crisp orange outline — no soft glow bloom. */
  box-shadow:
    0 0 0 1px rgba(255, 140, 0, 0.8),
    0 1px 0 rgba(0, 0, 0, 0.45),
    0 2px 4px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 200, 120, 0.12),
    inset 0 -1px 0 rgba(0, 0, 0, 0.18) !important;
  background:
    linear-gradient(180deg,
      rgba(255, 140, 0, 0.18) 0%,
      rgba(255, 140, 0, 0.06) 28%,
      transparent 55%),
    linear-gradient(180deg,
      rgba(255, 255, 255, 0.07) 0%,
      rgba(255, 255, 255, 0.02) 18%,
      transparent 42%),
    linear-gradient(180deg,
      var(--kp-key-face) 0%,
      var(--kp-key-mid) 70%,
      var(--kp-key-deep) 100%);
}
.${KEYBINDINGS_UI_ROOT_CLASS}.kp-text-mode-filter .key:not(.kp-key-text-mode-active) > .key-bg-icon,
.${KEYBINDINGS_UI_ROOT_CLASS}.kp-text-mode-filter .key:not(.kp-key-text-mode-active) > .key-main {
  display: none !important;
}
/* Pattern overlays (hatch / checkerboard / …) — plain face only while typing. */
.${KEYBINDINGS_UI_ROOT_CLASS}.kp-text-mode-filter .key:not(.kp-key-text-mode-active)::after {
  display: none !important;
}
/*
 * Center physical letters on every plain key. !important beats the higher-specificity
 * unassigned key-text rule (cyan / bottom-pinned) that would otherwise leave empty
 * keys like U O [ ] N , / looking different from assigned key-label keys.
 */
.${KEYBINDINGS_UI_ROOT_CLASS}.kp-text-mode-filter .key:not(.kp-key-text-mode-active) > .key-label,
.${KEYBINDINGS_UI_ROOT_CLASS}.kp-text-mode-filter .key:not(.kp-key-text-mode-active) > .key-text {
  top: 50% !important;
  bottom: auto !important;
  left: 0 !important;
  right: 0 !important;
  transform: translateY(-50%) !important;
  font-size: 14px !important;
  font-weight: 700 !important;
  letter-spacing: 0.02em !important;
  color: rgba(248, 250, 252, 0.94) !important;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.45) !important;
}
.${KEYBINDINGS_UI_ROOT_CLASS}.kp-text-mode-filter .key.kp-key-text-mode-disabled {
  pointer-events: none;
  cursor: default;
}
/* Countdown-live keys: keep assigned color fill / icon / labels; emphasize material glow. */
.${KEYBINDINGS_UI_ROOT_CLASS}.kp-text-mode-filter .key.kp-key-text-mode-active {
  opacity: 1;
  filter: none;
  z-index: 2;
  outline: none;
  pointer-events: auto;
  cursor: pointer;
  box-shadow:
    0 0 0 2px rgba(34, 197, 94, 0.5),
    0 0 14px 3px var(--kp-key-glow, rgba(34, 197, 94, 0.35)),
    0 0 24px 4px rgba(34, 197, 94, 0.22),
    0 1px 0 rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    inset 0 -1px 0 rgba(0, 0, 0, 0.18) !important;
}

/*
 * Link-hover hint: when the page pointer is over a link and the keyboard
 * reference is open, highlight the keys that activate / open that link.
 */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.kp-key-link-hint {
  z-index: 2;
  outline: none;
  filter: brightness(1.12) saturate(1.15);
  border-color: rgba(91, 226, 241, 0.85) !important;
  border-top-color: rgba(180, 245, 255, 0.95) !important;
  border-bottom-color: rgba(40, 180, 200, 0.9) !important;
  box-shadow:
    0 0 0 2px rgba(91, 226, 241, 0.55),
    0 0 14px 3px rgba(91, 226, 241, 0.55),
    0 0 28px 6px rgba(56, 189, 248, 0.28),
    0 1px 0 rgba(0, 0, 0, 0.35),
    inset 0 0 0 1px rgba(255, 255, 255, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.18) !important;
  animation: kp-key-link-hint-pulse 1.35s ease-in-out infinite;
}

@keyframes kp-key-link-hint-pulse {
  0%, 100% {
    box-shadow:
      0 0 0 2px rgba(91, 226, 241, 0.5),
      0 0 12px 2px rgba(91, 226, 241, 0.45),
      0 0 22px 4px rgba(56, 189, 248, 0.22),
      0 1px 0 rgba(0, 0, 0, 0.35),
      inset 0 0 0 1px rgba(255, 255, 255, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.14);
  }
  50% {
    box-shadow:
      0 0 0 3px rgba(120, 240, 255, 0.75),
      0 0 18px 5px rgba(91, 226, 241, 0.7),
      0 0 34px 10px rgba(56, 189, 248, 0.38),
      0 1px 0 rgba(0, 0, 0, 0.35),
      inset 0 0 0 1px rgba(255, 255, 255, 0.28),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
}

/* Popover (tooltip) — matches the hovered key material via CSS vars.
 * Uses the HTML Popover API (top layer) so it can escape the keyboard panel's
 * overflow:hidden and sit above/below keys outside the panel bounds.
 *
 * Do NOT set inset with !important: that locks left/top longhands and beats
 * JS style.left/top, pinning every tooltip at the viewport origin. Override UA
 * popover defaults with non-important longhands + margin:0 instead. */
.kp-keybindings-popover {
  --kp-key-face: #3d4454;
  --kp-key-mid: #343a48;
  --kp-key-deep: #2c313e;
  --kp-key-icon: #1a1e28;

  position: fixed !important;
  /* Kill UA popover centering (inset 0 / margin auto) without locking longhands. */
  margin: 0 !important;
  top: auto;
  right: auto;
  bottom: auto;
  left: auto;
  width: max-content;
  height: fit-content;
  overflow: visible;
  box-sizing: border-box;

  z-index: ${zIndex};
  max-width: min(300px, calc(100vw - 20px));
  min-width: 160px;
  color: rgba(248, 250, 252, 0.95);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.35;
  pointer-events: none; /* hover tooltips shouldn't steal pointer */

  /* Same low-profile key face treatment as .key */
  border: 1px solid rgba(0, 0, 0, 0.4);
  border-top-color: rgba(255, 255, 255, 0.12);
  border-bottom-color: rgba(0, 0, 0, 0.5);
  background:
    linear-gradient(180deg,
      rgba(255, 255, 255, 0.08) 0%,
      rgba(255, 255, 255, 0.02) 18%,
      transparent 42%),
    linear-gradient(180deg,
      var(--kp-key-face) 0%,
      var(--kp-key-mid) 70%,
      var(--kp-key-deep) 100%);
  box-shadow:
    0 1px 0 rgba(0, 0, 0, 0.45),
    0 10px 24px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -1px 0 rgba(0, 0, 0, 0.18);
}

/* Closed: both attribute + Popover API states */
.kp-keybindings-popover:not(:popover-open):not([data-kp-popover-open="true"]),
.kp-keybindings-popover[hidden] {
  display: none !important;
}

/* Open via Popover API or legacy fallback flag */
.kp-keybindings-popover:popover-open,
.kp-keybindings-popover[data-kp-popover-open="true"] {
  display: block;
  /* Re-assert after :popover-open (UA may reapply margin/inset). */
  margin: 0 !important;
  position: fixed !important;
}

.kp-keybindings-popover .kp-popover-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0 0 6px 0;
}

.kp-keybindings-popover .kp-popover-icon {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.3);
  border-top-color: rgba(255, 255, 255, 0.1);
  /* Glyph uses same darker icon color as keys */
  background-color: var(--kp-key-icon);
  background-image: none;
  background-repeat: no-repeat;
  background-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: 62% 62%;
  mask-size: 62% 62%;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -1px 0 rgba(0, 0, 0, 0.2);
}

.kp-keybindings-popover .kp-popover-icon[hidden] {
  display: none;
}

.kp-keybindings-popover .kp-popover-title-wrap {
  min-width: 0;
  flex: 1 1 auto;
}

.kp-keybindings-popover .kp-popover-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 3px 0;
}

.kp-keybindings-popover .kp-popover-title {
  font-weight: 700;
  margin: 0;
  min-width: 0;
  color: rgba(248, 250, 252, 0.96);
  letter-spacing: 0.01em;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
}

.kp-keybindings-popover .kp-popover-settings-hint {
  flex: 0 0 auto;
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.58);
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.kp-keybindings-popover .kp-popover-settings-hint[hidden] {
  display: none !important;
}

.kp-keybindings-popover .kp-popover-keys {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  color: rgba(255, 255, 255, 0.72);
  margin: 0;
  font-size: 11px;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.25);
}

.kp-keybindings-popover .kp-popover-desc {
  margin: 0;
  color: rgba(248, 250, 252, 0.9);
  opacity: 0.95;
  font-size: 11.5px;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.25);
}

.kp-keybindings-popover[data-kp-popover-pinned="true"] {
  pointer-events: auto;
  max-width: min(340px, calc(100vw - 20px));
}

.kp-keybindings-popover .kp-popover-settings {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kp-keybindings-popover .kp-popover-settings[hidden] {
  display: none !important;
}

.kp-popover-setting-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kp-popover-setting-label {
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(248, 250, 252, 0.55);
}

.kp-popover-mode-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.kp-popover-mode-btn {
  appearance: none;
  flex: 1 1 auto;
  min-width: 0;
  border: 1px solid rgba(0, 0, 0, 0.4);
  border-radius: 6px;
  padding: 5px 8px;
  font: inherit;
  font-size: 11px;
  color: rgba(248, 250, 252, 0.92);
  background: rgba(0, 0, 0, 0.22);
  cursor: pointer;
}

.kp-popover-mode-btn[aria-pressed="true"] {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.28);
}

.kp-popover-config-btn {
  appearance: none;
  align-self: flex-start;
  border: 1px solid rgba(0, 0, 0, 0.4);
  border-radius: 6px;
  padding: 5px 10px;
  font: inherit;
  font-size: 11px;
  color: inherit;
  background: rgba(0, 0, 0, 0.28);
  cursor: pointer;
}

.kp-keybindings-popover::before {
  content: "";
  position: absolute;
  width: 0;
  height: 0;
  left: var(--kp-arrow-left, 18px);
  border: 9px solid transparent;
}

.kp-keybindings-popover[data-placement="top"]::before {
  top: 100%;
  border-top-color: rgba(0, 0, 0, 0.45);
}

.kp-keybindings-popover[data-placement="top"]::after {
  content: "";
  position: absolute;
  width: 0;
  height: 0;
  left: var(--kp-arrow-left, 18px);
  top: calc(100% - 1px);
  border: 8px solid transparent;
  border-top-color: var(--kp-key-deep);
}

.kp-keybindings-popover[data-placement="bottom"]::before {
  bottom: 100%;
  border-bottom-color: rgba(255, 255, 255, 0.12);
}

.kp-keybindings-popover[data-placement="bottom"]::after {
  content: "";
  position: absolute;
  width: 0;
  height: 0;
  left: var(--kp-arrow-left, 18px);
  bottom: calc(100% - 1px);
  border: 8px solid transparent;
  border-bottom-color: var(--kp-key-face);
}

/* Font Awesome-style faded key background icons (behind white labels) */
${keyIconCss}

/*
 * TEMP suspended: Floating Keyboard Reference flex-scale keys with panel resize.
 * Keys use the global fixed 50px keycap rules again. Re-enable together with
 * makePopoverResizable in floating-keyboard-help.js when resuming this work.
 *
 * .kp-floating-keyboard-help .kp-floating-keyboard-help__keyboard {
 *   box-sizing: border-box;
 *   flex: 1 1 auto;
 *   min-height: 0;
 *   width: 100%;
 *   height: 100%;
 *   display: flex;
 *   flex-direction: column;
 * }
 * .kp-floating-keyboard-help .keyboard-visual.${KEYBINDINGS_UI_ROOT_CLASS} {
 *   flex: 1 1 auto;
 *   min-height: 0;
 *   width: 100%;
 *   height: 100%;
 *   display: flex;
 *   flex-direction: column;
 *   gap: 7px;
 *   padding: clamp(4px, 1.2%, 10px);
 * }
 * .kp-floating-keyboard-help .${KEYBINDINGS_UI_ROOT_CLASS} .keyboard-row {
 *   flex: 1 1 0;
 *   min-height: 0;
 *   margin-bottom: 0;
 *   gap: clamp(3px, 0.7%, 7px);
 *   align-items: stretch;
 * }
 * .kp-floating-keyboard-help .${KEYBINDINGS_UI_ROOT_CLASS} .key,
 * .kp-floating-keyboard-help .${KEYBINDINGS_UI_ROOT_CLASS} .key.key-tab,
 * .kp-floating-keyboard-help .${KEYBINDINGS_UI_ROOT_CLASS} .key.key-caps,
 * .kp-floating-keyboard-help .${KEYBINDINGS_UI_ROOT_CLASS} .key.key-enter,
 * .kp-floating-keyboard-help .${KEYBINDINGS_UI_ROOT_CLASS} .key.key-shift,
 * .kp-floating-keyboard-help .${KEYBINDINGS_UI_ROOT_CLASS} .key.key-backspace {
 *   height: 100%;
 *   min-height: 0;
 *   max-height: none;
 *   border-radius: clamp(5px, 12%, 10px);
 *   container-type: size;
 *   container-name: kp-key;
 * }
 * .kp-floating-keyboard-help .${KEYBINDINGS_UI_ROOT_CLASS} .key > .key-main {
 *   font-size: clamp(9px, 18cqh, 15px);
 *   max-height: 55%;
 *   top: clamp(2px, 8cqh, 8px);
 * }
 * .kp-floating-keyboard-help .${KEYBINDINGS_UI_ROOT_CLASS} .key > .key-label {
 *   font-size: clamp(10px, 22cqh, 18px);
 *   bottom: clamp(2px, 8cqh, 8px);
 * }
 * .kp-floating-keyboard-help .${KEYBINDINGS_UI_ROOT_CLASS} .key > .key-text {
 *   font-size: clamp(9px, 18cqh, 15px);
 *   bottom: clamp(2px, 8cqh, 8px);
 * }
 */
`;
}


