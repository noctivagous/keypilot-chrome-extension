/**
 * Alt chrome shortcuts (Alt+K, Alt+I, …).
 *
 * These are Alt-only chords. Ctrl, Meta, or Shift held with Alt must not claim
 * the event (Ctrl+Alt+I is the page's shortcut, not the tutorial).
 * Windows AltGr is reported as Ctrl+Alt plus AltGraph; that still counts as Alt.
 */

/**
 * @typedef {{ codes?: string[], keys?: string[] }} AltChromeSpec
 */

/**
 * @param {KeyboardEvent|null|undefined} e
 * @returns {boolean}
 */
export function isExclusiveAltModifier(e) {
  if (!e) return false;
  let altGraph = false;
  try {
    altGraph = typeof e.getModifierState === 'function' && e.getModifierState('AltGraph') === true;
  } catch {
    altGraph = false;
  }
  const alt = e.altKey === true || e.code === 'AltRight' || altGraph;
  if (!alt) return false;
  if (e.metaKey || e.shiftKey) return false;
  // AltGr is Ctrl+Alt. A real Ctrl+Alt chord is not this shortcut.
  if (e.ctrlKey && !altGraph) return false;
  return true;
}

/**
 * @param {KeyboardEvent|null|undefined} e
 * @param {AltChromeSpec|null|undefined} spec
 * @returns {boolean}
 */
export function isAltChromeShortcut(e, spec) {
  if (!isExclusiveAltModifier(e) || !spec) return false;
  if (Array.isArray(spec.codes) && spec.codes.includes(e.code)) return true;
  if (Array.isArray(spec.keys) && spec.keys.includes(e.key)) return true;
  return false;
}

export const ALT_CHROME = Object.freeze({
  TOGGLE: Object.freeze({ codes: ['KeyK'], keys: ['k', 'K'] }),
  CONTROL_STRIP: Object.freeze({ codes: ['KeyJ'], keys: ['j', 'J'] }),
  OMNIBOX: Object.freeze({ codes: ['KeyL'], keys: ['l', 'L'] }),
  // Alt+; and Alt+A both open the launcher (right- and left-handed).
  LAUNCHER: Object.freeze({ codes: ['Semicolon', 'KeyA'], keys: [';', ':', 'a', 'A'] }),
  PAINT_DEBUG: Object.freeze({ codes: ['KeyD'], keys: ['d', 'D'] }),
  LAYOUT_PREV: Object.freeze({ codes: ['BracketLeft'], keys: ['['] }),
  LAYOUT_NEXT: Object.freeze({ codes: ['BracketRight'], keys: [']'] }),
  LAYOUT_EDIT: Object.freeze({ codes: ['KeyC'], keys: ['c', 'C'] }),
  DOCS: Object.freeze({ codes: ['KeyH'], keys: ['h', 'H'] }),
  TUTORIAL: Object.freeze({ codes: ['KeyI'], keys: ['i', 'I'] })
});

/**
 * Order matches the previous handleKeyDown chain.
 * topOnly / enabledOnly still consume the event (return from handleKeyDown)
 * without running the action, same as the old early returns.
 * @type {ReadonlyArray<{ id: string, spec: AltChromeSpec, topOnly?: boolean, enabledOnly?: boolean, flag?: string }>}
 */
export const ALT_CHROME_BINDINGS = Object.freeze([
  Object.freeze({ id: 'toggle', spec: ALT_CHROME.TOGGLE, flag: '__kpToggleHandled' }),
  Object.freeze({ id: 'controlStrip', spec: ALT_CHROME.CONTROL_STRIP, flag: '__kpControlStripHandled' }),
  Object.freeze({ id: 'omnibox', spec: ALT_CHROME.OMNIBOX, topOnly: true, enabledOnly: true }),
  Object.freeze({ id: 'launcher', spec: ALT_CHROME.LAUNCHER, topOnly: true, enabledOnly: true }),
  Object.freeze({ id: 'paintDebug', spec: ALT_CHROME.PAINT_DEBUG, topOnly: true, enabledOnly: true }),
  Object.freeze({ id: 'layoutPrev', spec: ALT_CHROME.LAYOUT_PREV, topOnly: true, enabledOnly: true }),
  Object.freeze({ id: 'layoutNext', spec: ALT_CHROME.LAYOUT_NEXT, topOnly: true, enabledOnly: true }),
  Object.freeze({ id: 'layoutEdit', spec: ALT_CHROME.LAYOUT_EDIT, topOnly: true, enabledOnly: true }),
  Object.freeze({ id: 'docs', spec: ALT_CHROME.DOCS, topOnly: true, enabledOnly: true })
]);
