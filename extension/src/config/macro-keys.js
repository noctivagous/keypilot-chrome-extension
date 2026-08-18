/**
 * Built-in Macro Keys — configurable keystroke primitives for Keyboard Layout Config.
 *
 * These are NOT layout-family actions. Users create configured instances, then assign
 * them to layout slots. The same instances are reusable as Function steps in the
 * User Macros builder (alongside Wait / Gate / Stop / Run Macro Logic steps).
 *
 * Kinds:
 *  1. hotkey      — modifier + key (Ctrl+C, Win+R, Ctrl+Shift+Esc)
 *  2. burst       — one press fires a short sequence of strokes
 *  3. roundRobin  — successive presses cycle A → B → C → A…
 *  4. continuous  — press to start repeating a stroke; press again to stop
 *  5. mouse       — synthetic left / middle / right click
 *  6. key         — remap to a normal (usually unmodified) key
 */

/**
 * @typedef {'hotkey'|'burst'|'roundRobin'|'continuous'|'mouse'|'key'} MacroKeyKind
 *
 * @typedef {{
 *   key: string,
 *   code?: string,
 *   ctrl?: boolean,
 *   alt?: boolean,
 *   shift?: boolean,
 *   meta?: boolean
 * }} KeyStroke
 *
 * @typedef {{ button: 'left'|'middle'|'right' }} MouseClickConfig
 *
 * @typedef {{
 *   id: string,
 *   kind: MacroKeyKind,
 *   label: string,
 *   // Kind-specific payload (see defaults / normalize below)
 *   config: Record<string, any>,
 *   createdAt: number,
 *   updatedAt: number
 * }} UserMacroKey
 *
 * Macro builder step shapes live on `MacroStep` in `keyboard-layout-store.js`
 * (`function` | `wait` | `gate` | `stop` | `runMacro`). See KEY_ACTION_ARCHITECTURE.md.
 */

/** Stable id prefix for user-configured macro keys. */
export const MACRO_KEY_ID_PREFIX = 'macroKey:';

/**
 * Catalog of built-in kinds shown in Keyboard Layout Config.
 * @type {ReadonlyArray<{ id: MacroKeyKind, label: string, description: string, details?: string, keyboardClass: string }>}
 */
export const MACRO_KEY_KIND_DEFS = Object.freeze([
  Object.freeze({
    id: /** @type {const} */ ('hotkey'),
    label: 'Combination / Hotkey',
    description: 'Send a modifier chord',
    details: 'One key sends a modifier chord such as Ctrl+C, Win+R, or Ctrl+Shift+Esc. Configure the chord on the Action Instance.',
    keyboardClass: 'key-orange'
  }),
  Object.freeze({
    id: /** @type {const} */ ('burst'),
    label: 'Burst Keys',
    description: 'Type a short key sequence',
    details: 'One press types a short sequence of keystrokes (e.g. a→b→c or Ctrl+C → Ctrl+V → Enter). Configure the steps on the Action Instance.',
    keyboardClass: 'key-purple'
  }),
  Object.freeze({
    id: /** @type {const} */ ('roundRobin'),
    label: 'Round Robin',
    description: 'Cycle through stroke options',
    details: 'Each press advances a cycle of strokes (A, then B, then C, then A…). Useful when one key should rotate through several outputs.',
    keyboardClass: 'key-scroll'
  }),
  Object.freeze({
    id: /** @type {const} */ ('continuous'),
    label: 'Continue / Continuous',
    description: 'Repeat a stroke until stopped',
    details: 'Press to start sending a stroke repeatedly; press again to stop. Configure the repeated stroke on the Action Instance.',
    keyboardClass: 'key-highlight'
  }),
  Object.freeze({
    id: /** @type {const} */ ('mouse'),
    label: 'Synthetic Mouse',
    description: 'Click under the cursor',
    details: 'Synthesizes a left, middle, or right click under the cursor without moving your physical mouse buttons. Choose the button on the Action Instance.',
    keyboardClass: 'key-activate'
  }),
  Object.freeze({
    id: /** @type {const} */ ('key'),
    label: 'Normal Key',
    description: 'Remap this slot to another key',
    details: 'Remaps this layout slot so pressing it sends a different key (e.g. F sends 1). Configure the target key on the Action Instance.',
    keyboardClass: 'key-gray'
  })
]);

/** @type {ReadonlySet<string>} */
const KNOWN_KINDS = new Set(MACRO_KEY_KIND_DEFS.map((d) => d.id));

/**
 * @param {any} raw
 * @returns {MacroKeyKind|null}
 */
export function normalizeMacroKeyKind(raw) {
  const v = String(raw || '').trim();
  return KNOWN_KINDS.has(v) ? /** @type {MacroKeyKind} */ (v) : null;
}

/**
 * @param {any} raw
 * @returns {KeyStroke}
 */
export function normalizeKeyStroke(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const key = String(src.key || '').trim();
  /** @type {KeyStroke} */
  const out = { key: key || '' };
  if (typeof src.code === 'string' && src.code.trim()) out.code = src.code.trim();
  if (src.ctrl === true) out.ctrl = true;
  if (src.alt === true) out.alt = true;
  if (src.shift === true) out.shift = true;
  if (src.meta === true) out.meta = true;
  return out;
}

/**
 * @param {KeyStroke|null|undefined} stroke
 * @returns {boolean}
 */
export function isKeyStrokeValid(stroke) {
  return !!(stroke && typeof stroke.key === 'string' && stroke.key.trim());
}

/**
 * Human-readable chord label, e.g. "Ctrl+Shift+Esc".
 * @param {KeyStroke|null|undefined} stroke
 * @returns {string}
 */
export function formatKeyStroke(stroke) {
  if (!isKeyStrokeValid(stroke)) return '(empty)';
  const parts = [];
  if (stroke.ctrl) parts.push('Ctrl');
  if (stroke.alt) parts.push('Alt');
  if (stroke.shift) parts.push('Shift');
  if (stroke.meta) parts.push('Win');
  const key = String(stroke.key);
  const pretty = key.length === 1 ? key.toUpperCase() : key;
  parts.push(pretty);
  return parts.join('+');
}

/**
 * Default config payload for a kind.
 * @param {MacroKeyKind} kind
 * @returns {Record<string, any>}
 */
export function defaultMacroKeyConfig(kind) {
  switch (kind) {
    case 'hotkey':
      return { stroke: normalizeKeyStroke({ key: 'c', ctrl: true }) };
    case 'burst':
      return {
        steps: [
          normalizeKeyStroke({ key: 'a' }),
          normalizeKeyStroke({ key: 'b' }),
          normalizeKeyStroke({ key: 'c' })
        ],
        gapMs: 40
      };
    case 'roundRobin':
      return {
        items: [
          normalizeKeyStroke({ key: 'a' }),
          normalizeKeyStroke({ key: 'b' }),
          normalizeKeyStroke({ key: 'c' })
        ]
      };
    case 'continuous':
      return {
        stroke: normalizeKeyStroke({ key: 'w' }),
        intervalMs: 50
      };
    case 'mouse':
      return { button: 'left' };
    case 'key':
      return { stroke: normalizeKeyStroke({ key: '1' }) };
    default:
      return {};
  }
}

/**
 * Normalize / clamp a kind-specific config object.
 * @param {MacroKeyKind} kind
 * @param {any} raw
 * @returns {Record<string, any>}
 */
export function normalizeMacroKeyConfig(kind, raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const base = defaultMacroKeyConfig(kind);

  switch (kind) {
    case 'hotkey':
    case 'key':
      return { stroke: normalizeKeyStroke(src.stroke || base.stroke) };

    case 'burst': {
      const stepsRaw = Array.isArray(src.steps) ? src.steps : base.steps;
      const steps = stepsRaw.map((s) => normalizeKeyStroke(s)).filter((s) => s.key);
      const gap = Number(src.gapMs);
      return {
        steps: steps.length ? steps : base.steps,
        gapMs: Number.isFinite(gap) ? Math.max(0, Math.min(2000, gap)) : 40
      };
    }

    case 'roundRobin': {
      const itemsRaw = Array.isArray(src.items) ? src.items : base.items;
      const items = itemsRaw.map((s) => normalizeKeyStroke(s)).filter((s) => s.key);
      return { items: items.length ? items : base.items };
    }

    case 'continuous': {
      const interval = Number(src.intervalMs);
      return {
        stroke: normalizeKeyStroke(src.stroke || base.stroke),
        intervalMs: Number.isFinite(interval) ? Math.max(10, Math.min(5000, interval)) : 50
      };
    }

    case 'mouse': {
      const button = String(src.button || 'left').toLowerCase();
      return {
        button: (button === 'middle' || button === 'right' || button === 'left') ? button : 'left'
      };
    }

    default:
      return { ...base };
  }
}

/**
 * Short summary for palette badges / inspect popovers.
 * @param {UserMacroKey|null|undefined} mk
 * @returns {string}
 */
export function summarizeMacroKey(mk) {
  if (!mk || !mk.kind) return '';
  const cfg = normalizeMacroKeyConfig(mk.kind, mk.config);
  switch (mk.kind) {
    case 'hotkey':
    case 'key':
      return formatKeyStroke(cfg.stroke);
    case 'burst':
      return (cfg.steps || []).map(formatKeyStroke).join(' → ');
    case 'roundRobin':
      return (cfg.items || []).map(formatKeyStroke).join(' / ');
    case 'continuous':
      return `${formatKeyStroke(cfg.stroke)} @ ${cfg.intervalMs}ms`;
    case 'mouse':
      return `${cfg.button} click`;
    default:
      return String(mk.kind);
  }
}

/**
 * Default label when creating a new instance of a kind.
 * @param {MacroKeyKind} kind
 * @returns {string}
 */
export function defaultMacroKeyLabel(kind) {
  const def = MACRO_KEY_KIND_DEFS.find((d) => d.id === kind);
  return def ? def.label : 'Macro Key';
}

/**
 * @param {MacroKeyKind} kind
 * @returns {string}
 */
export function macroKeyKeyboardClass(kind) {
  const def = MACRO_KEY_KIND_DEFS.find((d) => d.id === kind);
  return def?.keyboardClass || 'key-purple';
}

/**
 * Macro-builder Logic / step-type catalog (UI convention). The persisted schema is
 * `MacroStep` in `keyboard-layout-store.js` (`function` | `wait` | `gate` | `stop` | `runMacro`).
 * Configured Macro Keys are added as Function steps whose `functionId` is a
 * `legacyMacroKeyKind` Function — not a separate step kind.
 */
export const MACRO_BUILDER_STEP_TYPES = Object.freeze([
  Object.freeze({ id: 'function', label: 'Function', description: 'Run a Function Library entry (including Macro Keys).' }),
  Object.freeze({ id: 'wait', label: 'Wait', description: 'Pause for N milliseconds.' }),
  Object.freeze({ id: 'gate', label: 'Gate', description: 'If condition fails, skip following steps.' }),
  Object.freeze({ id: 'stop', label: 'Stop', description: 'End the macro immediately.' }),
  Object.freeze({ id: 'runMacro', label: 'Run Macro', description: 'Call another macro (cycle-guarded).' })
]);
