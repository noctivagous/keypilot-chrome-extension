/**
 * Modifier-chord slot keys.
 *
 * Bare-key layout slots are keyed by a single uppercased character/label (e.g. "Q", ";").
 * Some Functions (see `worksWhileTyping` in function-library.js) must run *while a text field
 * is focused* — a bare key would either be silently swallowed by normal typing or blocked by
 * KeyPilot's typing-safety gate. Those Functions may only be bound to a *modifier chord*
 * instead, encoded as a distinctly-prefixed string so it can live in the same
 * `UserKeyboardLayout.slots` map as bare-key slots without any ambiguity or schema change.
 *
 * See KEY_ACTION_ARCHITECTURE.md → "Text-active Functions & modifier-chord assignment".
 */

/** Prefix that marks a slot key as a modifier chord rather than a bare key. */
export const CHORD_SLOT_KEY_PREFIX = 'CHORD:';

/**
 * @typedef {{ key: string, ctrl?: boolean, alt?: boolean, shift?: boolean, meta?: boolean }} Chord
 */

/**
 * @param {string} rawKey
 * @returns {string}
 */
function normalizeChordKeyToken(rawKey) {
  const k = String(rawKey || '').trim();
  if (!k) return '';
  if (k.length === 1) return k.toUpperCase();
  // Normalize common multi-char key names to a stable, short label.
  const named = {
    ' ': 'SPACE',
    'Spacebar': 'SPACE',
    'Escape': 'ESC',
    'ArrowUp': 'UP',
    'ArrowDown': 'DOWN',
    'ArrowLeft': 'LEFT',
    'ArrowRight': 'RIGHT'
  };
  return (named[k] || k).toUpperCase();
}

/**
 * Build the canonical slot-key string for a chord, e.g. `CHORD:CTRL+ALT+Q`.
 * Modifier order is fixed (Ctrl, Alt, Shift, Meta) so equal chords always produce equal strings.
 * @param {Chord} chord
 * @returns {string} empty string if the chord has no key or no modifiers.
 */
export function buildChordSlotKey(chord) {
  const key = normalizeChordKeyToken(chord?.key);
  if (!key) return '';
  const mods = [];
  if (chord?.ctrl) mods.push('CTRL');
  if (chord?.alt) mods.push('ALT');
  if (chord?.shift) mods.push('SHIFT');
  if (chord?.meta) mods.push('META');
  // A "chord" without any modifier is just a bare key — not a valid chord slot key.
  if (!mods.length) return '';
  return `${CHORD_SLOT_KEY_PREFIX}${mods.join('+')}+${key}`;
}

/**
 * Build the canonical chord slot key directly from a live KeyboardEvent.
 * @param {KeyboardEvent} e
 * @returns {string}
 */
export function chordSlotKeyFromEvent(e) {
  if (!e) return '';
  return buildChordSlotKey({
    key: e.key,
    ctrl: !!e.ctrlKey,
    alt: !!e.altKey,
    shift: !!e.shiftKey,
    meta: !!e.metaKey
  });
}

/**
 * @param {string} slotKey
 * @returns {boolean}
 */
export function isChordSlotKey(slotKey) {
  return typeof slotKey === 'string' && slotKey.startsWith(CHORD_SLOT_KEY_PREFIX);
}

/**
 * Parse a chord slot key back into its parts. Returns null if not a valid chord slot key.
 * @param {string} slotKey
 * @returns {Chord|null}
 */
export function parseChordSlotKey(slotKey) {
  if (!isChordSlotKey(slotKey)) return null;
  const parts = slotKey.slice(CHORD_SLOT_KEY_PREFIX.length).split('+').filter(Boolean);
  if (parts.length < 2) return null;
  const key = parts[parts.length - 1];
  const mods = new Set(parts.slice(0, -1));
  return {
    key,
    ctrl: mods.has('CTRL'),
    alt: mods.has('ALT'),
    shift: mods.has('SHIFT'),
    meta: mods.has('META')
  };
}

/**
 * Human-readable label for a chord slot key, e.g. "Ctrl+Alt+Q".
 * @param {string} slotKey
 * @returns {string}
 */
export function formatChordSlotKeyLabel(slotKey) {
  const chord = parseChordSlotKey(slotKey);
  if (!chord) return String(slotKey || '');
  const parts = [];
  if (chord.ctrl) parts.push('Ctrl');
  if (chord.alt) parts.push('Alt');
  if (chord.shift) parts.push('Shift');
  if (chord.meta) parts.push('Win');
  parts.push(chord.key.length === 1 ? chord.key.toUpperCase() : chord.key);
  return parts.join('+');
}
