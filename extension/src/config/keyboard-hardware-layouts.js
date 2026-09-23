/**
 * Physical keyboard models for Keyboard Reference presentation.
 *
 * A model describes hardware positions (`KeyboardEvent.code` / USB HID usage),
 * geometry, and visible legends. It deliberately does not describe KeyPilot
 * actions: action bindings will resolve against a model's `code` values.
 */

export const DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID = /** @type {const} */ ('us-ansi-qwerty');

/**
 * @typedef {{
 *   base: string,
 *   shift?: string,
 *   altGr?: string,
 *   shiftAltGr?: string
 * }} KeyLegends
 */

/**
 * @typedef {{
 *   code: string,
 *   hidUsage: string,
 *   width?: number,
 *   legends: KeyLegends
 * }} PhysicalKey
 */

/**
 * @typedef {{
 *   id: string,
 *   offset?: number,
 *   keys: readonly PhysicalKey[]
 * }} PhysicalKeyboardRow
 */

/**
 * Keyboard Reference's current compact presentation is intentionally distinct
 * from a complete physical keyboard: it omits the number/modifier rows and
 * paints Backspace at the displayed top-row end. `codes` keeps that view tied
 * to the model's physical-key data rather than duplicating legends.
 *
 * @typedef {{
 *   id: string,
 *   codes: readonly string[]
 * }} KeyboardReferenceRow
 */

/**
 * @typedef {{
 *   rows: readonly KeyboardReferenceRow[],
 *   numberRowCodes: readonly string[]
 * }} KeyboardReferenceGeometry
 */

/**
 * @typedef {{
 *   id: string,
 *   labelKey: string,
 *   formFactor: 'ANSI'|'ISO'|'JIS',
 *   rows: readonly PhysicalKeyboardRow[],
 *   keyboardReference: KeyboardReferenceGeometry
 * }} KeyboardHardwareLayout
 */

function key(code, hidUsage, base, { shift, altGr, shiftAltGr, width } = {}) {
  return Object.freeze({
    code,
    hidUsage,
    ...(typeof width === 'number' ? { width } : {}),
    legends: Object.freeze({
      base,
      ...(typeof shift === 'string' ? { shift } : {}),
      ...(typeof altGr === 'string' ? { altGr } : {}),
      ...(typeof shiftAltGr === 'string' ? { shiftAltGr } : {})
    })
  });
}

function row(id, keys, { offset } = {}) {
  return Object.freeze({
    id,
    ...(typeof offset === 'number' ? { offset } : {}),
    keys: Object.freeze(keys)
  });
}

function referenceRow(id, codes) {
  return Object.freeze({ id, codes: Object.freeze(codes) });
}

const US_ANSI_QWERTY_ROWS = Object.freeze([
  row('number', [
    key('Backquote', '0x35', '`', { shift: '~' }),
    key('Digit1', '0x1E', '1', { shift: '!' }),
    key('Digit2', '0x1F', '2', { shift: '@' }),
    key('Digit3', '0x20', '3', { shift: '#' }),
    key('Digit4', '0x21', '4', { shift: '$' }),
    key('Digit5', '0x22', '5', { shift: '%' }),
    key('Digit6', '0x23', '6', { shift: '^' }),
    key('Digit7', '0x24', '7', { shift: '&' }),
    key('Digit8', '0x25', '8', { shift: '*' }),
    key('Digit9', '0x26', '9', { shift: '(' }),
    key('Digit0', '0x27', '0', { shift: ')' }),
    key('Minus', '0x2D', '-', { shift: '_' }),
    key('Equal', '0x2E', '=', { shift: '+' }),
    key('Backspace', '0x2A', 'Backspace', { width: 1.55 })
  ]),
  row('top', [
    key('Tab', '0x2B', 'Tab', { width: 1.5 }),
    key('KeyQ', '0x14', 'Q', { shift: 'Q' }),
    key('KeyW', '0x1A', 'W', { shift: 'W' }),
    key('KeyE', '0x08', 'E', { shift: 'E' }),
    key('KeyR', '0x15', 'R', { shift: 'R' }),
    key('KeyT', '0x17', 'T', { shift: 'T' }),
    key('KeyY', '0x1C', 'Y', { shift: 'Y' }),
    key('KeyU', '0x18', 'U', { shift: 'U' }),
    key('KeyI', '0x0C', 'I', { shift: 'I' }),
    key('KeyO', '0x12', 'O', { shift: 'O' }),
    key('KeyP', '0x13', 'P', { shift: 'P' }),
    key('BracketLeft', '0x2F', '[', { shift: '{' }),
    key('BracketRight', '0x30', ']', { shift: '}' }),
    key('Backslash', '0x31', '\\', { shift: '|', width: 1.5 })
  ]),
  row('home', [
    key('CapsLock', '0x39', 'Caps', { width: 1.75 }),
    key('KeyA', '0x04', 'A', { shift: 'A' }),
    key('KeyS', '0x16', 'S', { shift: 'S' }),
    key('KeyD', '0x07', 'D', { shift: 'D' }),
    key('KeyF', '0x09', 'F', { shift: 'F' }),
    key('KeyG', '0x0A', 'G', { shift: 'G' }),
    key('KeyH', '0x0B', 'H', { shift: 'H' }),
    key('KeyJ', '0x0D', 'J', { shift: 'J' }),
    key('KeyK', '0x0E', 'K', { shift: 'K' }),
    key('KeyL', '0x0F', 'L', { shift: 'L' }),
    key('Semicolon', '0x33', ';', { shift: ':' }),
    key('Quote', '0x34', "'", { shift: '"' }),
    key('Enter', '0x28', 'Enter', { width: 2 })
  ]),
  row('bottom', [
    key('ShiftLeft', '0xE1', 'Shift', { width: 2.15 }),
    key('KeyZ', '0x1D', 'Z', { shift: 'Z' }),
    key('KeyX', '0x1B', 'X', { shift: 'X' }),
    key('KeyC', '0x06', 'C', { shift: 'C' }),
    key('KeyV', '0x19', 'V', { shift: 'V' }),
    key('KeyB', '0x05', 'B', { shift: 'B' }),
    key('KeyN', '0x11', 'N', { shift: 'N' }),
    key('KeyM', '0x10', 'M', { shift: 'M' }),
    key('Comma', '0x36', ',', { shift: '<' }),
    key('Period', '0x37', '.', { shift: '>' }),
    key('Slash', '0x38', '/', { shift: '?' }),
    key('ShiftRight', '0xE5', 'Shift', { width: 2.15 })
  ]),
  row('modifier', [
    key('ControlLeft', '0xE0', 'Ctrl', { width: 1.25 }),
    key('MetaLeft', '0xE3', 'Meta', { width: 1.25 }),
    key('AltLeft', '0xE2', 'Alt', { width: 1.25 }),
    key('Space', '0x2C', 'Space', { width: 6.25 }),
    key('AltRight', '0xE6', 'Alt', { width: 1.25 }),
    key('MetaRight', '0xE7', 'Meta', { width: 1.25 }),
    key('ContextMenu', '0x65', 'Menu', { width: 1.25 }),
    key('ControlRight', '0xE4', 'Ctrl', { width: 1.25 })
  ])
]);

/**
 * Matches the current `KEYBOARD_UI_LAYOUT_RIGHT` visual geometry exactly,
 * including its optional ten-key number row. Future renderers can consume this
 * structure before physical layouts add ISO/JIS-specific geometry.
 * @type {KeyboardReferenceGeometry}
 */
const US_ANSI_QWERTY_KEYBOARD_REFERENCE = Object.freeze({
  rows: Object.freeze([
    referenceRow('top', [
      'Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI',
      'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backspace'
    ]),
    referenceRow('home', [
      'CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ',
      'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'
    ]),
    referenceRow('bottom', [
      'ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM',
      'Comma', 'Period', 'Slash', 'ShiftRight'
    ])
  ]),
  numberRowCodes: Object.freeze([
    'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
    'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'
  ])
});

/** @type {Readonly<Record<string, KeyboardHardwareLayout>>} */
export const KEYBOARD_HARDWARE_LAYOUTS = Object.freeze({
  'us-ansi-qwerty': Object.freeze({
    id: 'us-ansi-qwerty',
    labelKey: 'keyboard_hardware_layout_us_ansi_qwerty',
    formFactor: 'ANSI',
    rows: US_ANSI_QWERTY_ROWS,
    keyboardReference: US_ANSI_QWERTY_KEYBOARD_REFERENCE
  })
});

/**
 * @param {unknown} rawId
 * @returns {KeyboardHardwareLayout}
 */
export function getKeyboardHardwareLayout(rawId) {
  const id = String(rawId || '').trim();
  return KEYBOARD_HARDWARE_LAYOUTS[id] || KEYBOARD_HARDWARE_LAYOUTS[DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID];
}

/**
 * @returns {readonly KeyboardHardwareLayout[]}
 */
export function listKeyboardHardwareLayouts() {
  return Object.freeze(Object.values(KEYBOARD_HARDWARE_LAYOUTS));
}

/**
 * Return registry errors so unit tests and future build-time checks can reject
 * ambiguous physical positions before a model reaches the UI.
 *
 * @param {Readonly<Record<string, KeyboardHardwareLayout>>} layouts
 * @returns {string[]}
 */
export function validateKeyboardHardwareLayouts(layouts = KEYBOARD_HARDWARE_LAYOUTS) {
  const errors = [];
  for (const [registryId, layout] of Object.entries(layouts || {})) {
    const prefix = `keyboard hardware layout "${registryId}"`;
    if (!layout || layout.id !== registryId) {
      errors.push(`${prefix} must have an id matching its registry key`);
      continue;
    }
    if (!['ANSI', 'ISO', 'JIS'].includes(layout.formFactor)) {
      errors.push(`${prefix} has an unsupported form factor`);
    }
    if (!layout.labelKey) errors.push(`${prefix} must have a label key`);

    const codes = new Set();
    const hidUsages = new Set();
    for (const physicalRow of layout.rows || []) {
      if (!physicalRow?.id) errors.push(`${prefix} has a row without an id`);
      for (const physicalKey of physicalRow?.keys || []) {
        if (!physicalKey?.code) {
          errors.push(`${prefix} has a key without a DOM code`);
        } else if (codes.has(physicalKey.code)) {
          errors.push(`${prefix} repeats DOM code "${physicalKey.code}"`);
        } else {
          codes.add(physicalKey.code);
        }
        if (!/^0x[0-9A-F]{2}$/i.test(String(physicalKey?.hidUsage || ''))) {
          errors.push(`${prefix} key "${physicalKey?.code || '?'}" has an invalid HID usage`);
        } else if (hidUsages.has(physicalKey.hidUsage)) {
          errors.push(`${prefix} repeats HID usage "${physicalKey.hidUsage}"`);
        } else {
          hidUsages.add(physicalKey.hidUsage);
        }
        if (!physicalKey?.legends?.base) {
          errors.push(`${prefix} key "${physicalKey?.code || '?'}" has no base legend`);
        }
        if (physicalKey?.width !== undefined && (!(physicalKey.width > 0) || !Number.isFinite(physicalKey.width))) {
          errors.push(`${prefix} key "${physicalKey?.code || '?'}" has an invalid width`);
        }
      }
    }
    const referenceCodes = new Set();
    const reference = layout.keyboardReference;
    if (!reference || !Array.isArray(reference.rows) || !Array.isArray(reference.numberRowCodes)) {
      errors.push(`${prefix} must define Keyboard Reference geometry`);
      continue;
    }
    for (const referenceRowDef of reference.rows) {
      if (!referenceRowDef?.id) errors.push(`${prefix} has a Keyboard Reference row without an id`);
      for (const code of referenceRowDef?.codes || []) {
        if (!codes.has(code)) {
          errors.push(`${prefix} Keyboard Reference uses unknown DOM code "${code}"`);
        } else if (referenceCodes.has(code)) {
          errors.push(`${prefix} Keyboard Reference repeats DOM code "${code}"`);
        } else {
          referenceCodes.add(code);
        }
      }
    }
    for (const code of reference.numberRowCodes) {
      if (!codes.has(code)) {
        errors.push(`${prefix} Keyboard Reference number row uses unknown DOM code "${code}"`);
      } else if (referenceCodes.has(code)) {
        errors.push(`${prefix} Keyboard Reference repeats DOM code "${code}"`);
      } else {
        referenceCodes.add(code);
      }
    }
  }
  return errors;
}
