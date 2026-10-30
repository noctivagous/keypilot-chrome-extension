/**
 * KeyPilot Chrome Extension — esbuild bundle
 * Generated on 2026-10-30T02:30:11.299Z
 */

var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};

// src/utils/i18n.js
function isDebugBuild() {
  try {
    return !!globalThis.KEYPILOT_DEBUG;
  } catch {
    return false;
  }
}
function missingMessage(key2) {
  if (!isDebugBuild()) return "";
  console.warn(`[KeyPilot i18n] Missing message: ${key2}`);
  return `[i18n:${key2}]`;
}
function getLocaleCandidates(uiLanguage, baseLocale = DEFAULT_LOCALE) {
  const fallback = String(baseLocale || DEFAULT_LOCALE);
  const raw = String(
    uiLanguage ?? globalThis.chrome?.i18n?.getUILanguage?.() ?? fallback
  ).trim();
  const exact = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+)*$/.test(raw) ? raw : "";
  const base = exact.split(/[-_]/)[0].toLowerCase();
  const alt = exact.includes("-") ? exact.replace(/-/g, "_") : exact.includes("_") ? exact.replace(/_/g, "-") : "";
  return [...new Set([exact, alt, base, fallback].filter(Boolean))];
}
function normalizeLocaleTag(value) {
  const tag = String(value ?? "").trim().replace(/_/g, "-");
  return LOCALE_TAG_PATTERN.test(tag) ? tag : "";
}
function getUILocaleTag() {
  try {
    const fromCatalog = normalizeLocaleTag(globalThis.chrome?.i18n?.getMessage?.("locale_tag"));
    if (fromCatalog) return fromCatalog;
  } catch {
  }
  try {
    const fromUi = normalizeLocaleTag(globalThis.chrome?.i18n?.getUILanguage?.());
    if (fromUi) return fromUi;
  } catch {
  }
  return DEFAULT_LOCALE;
}
function getUITextDirection() {
  try {
    const dir = globalThis.chrome?.i18n?.getMessage?.("@@bidi_dir");
    return dir === "rtl" ? "rtl" : "ltr";
  } catch {
    return "ltr";
  }
}
function applyDocumentLocale(doc = document) {
  try {
    const root = doc?.documentElement;
    root?.setAttribute?.("lang", getUILocaleTag());
    root?.setAttribute?.("dir", getUITextDirection());
  } catch {
  }
}
function getMessage(key2, substitutions) {
  const messageKey = typeof key2 === "string" ? key2.trim() : "";
  if (!messageKey) return missingMessage(String(key2 || "(empty key)"));
  try {
    const message = globalThis.chrome?.i18n?.getMessage?.(messageKey, substitutions);
    return typeof message === "string" && message ? message : missingMessage(messageKey);
  } catch {
    return missingMessage(messageKey);
  }
}
function localizeElements(root = document) {
  if (!root?.querySelectorAll) return;
  for (const [attribute, property] of ATTRIBUTE_BINDINGS) {
    for (const element of root.querySelectorAll(`[${attribute}]`)) {
      const key2 = element.getAttribute(attribute);
      const message = getMessage(key2 || "");
      if (!message) continue;
      if (property === "textContent") {
        element.textContent = message;
      } else {
        element.setAttribute(property, message);
      }
    }
  }
  try {
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    if (doc) applyDocumentLocale(doc);
  } catch {
  }
}
var DEFAULT_LOCALE, KEYCAP_MESSAGE_KEYS, LOCALE_TAG_PATTERN, ATTRIBUTE_BINDINGS;
var init_i18n = __esm({
  "src/utils/i18n.js"() {
    DEFAULT_LOCALE = "en";
    KEYCAP_MESSAGE_KEYS = Object.freeze({
      Tab: "keycap_tab",
      Caps: "keycap_caps",
      Shift: "keycap_shift",
      Enter: "keycap_enter",
      Backspace: "keycap_backspace",
      Esc: "keycap_esc",
      Escape: "keycap_esc"
    });
    LOCALE_TAG_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]+)*$/;
    ATTRIBUTE_BINDINGS = Object.freeze([
      ["data-i18n", "textContent"],
      ["data-i18n-placeholder", "placeholder"],
      ["data-i18n-aria-label", "aria-label"],
      ["data-i18n-title", "title"]
    ]);
  }
});

// src/config/keyboard-hardware-layouts.js
function key(code, hidUsage, base, { shift, altGr, shiftAltGr, width } = {}) {
  return Object.freeze({
    code,
    hidUsage,
    ...typeof width === "number" ? { width } : {},
    legends: Object.freeze({
      base,
      ...typeof shift === "string" ? { shift } : {},
      ...typeof altGr === "string" ? { altGr } : {},
      ...typeof shiftAltGr === "string" ? { shiftAltGr } : {}
    })
  });
}
function row(id, keys, { offset } = {}) {
  return Object.freeze({
    id,
    ...typeof offset === "number" ? { offset } : {},
    keys: Object.freeze(keys)
  });
}
function referenceRow(id, codes) {
  return Object.freeze({ id, codes: Object.freeze(codes) });
}
function cloneRowsWithLegends(baseRows, overrides = {}, extraBottomKey = null) {
  return Object.freeze(baseRows.map((physicalRow) => {
    const keys = physicalRow.keys.flatMap((physicalKey) => {
      const override = overrides[physicalKey.code];
      const next = override ? Object.freeze({ ...physicalKey, legends: Object.freeze({ ...physicalKey.legends, ...override }) }) : physicalKey;
      if (extraBottomKey && physicalRow.id === "bottom" && physicalKey.code === "KeyZ") {
        return [extraBottomKey, next];
      }
      return [next];
    });
    return row(physicalRow.id, keys, { offset: physicalRow.offset });
  }));
}
function cloneReferenceGeometry(base, { extraBottomCode = "", extraTopCode = "" } = {}) {
  return Object.freeze({
    rows: Object.freeze(base.rows.map((referenceRowDef) => {
      const codes = referenceRowDef.codes.flatMap((code) => {
        if (extraBottomCode && referenceRowDef.id === "bottom" && code === "KeyZ") return [extraBottomCode, code];
        if (extraTopCode && referenceRowDef.id === "top" && code === "Backspace") return [extraTopCode, code];
        return [code];
      });
      return referenceRow(referenceRowDef.id, codes);
    })),
    numberRowCodes: base.numberRowCodes
  });
}
function normalizeKeyboardHardwareLayoutId(rawId) {
  const id = String(rawId || "").trim();
  return KEYBOARD_HARDWARE_LAYOUTS[id] ? id : DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID;
}
var DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID, US_ANSI_QWERTY_ROWS, US_ANSI_QWERTY_KEYBOARD_REFERENCE, ISO_INTL_BACKSLASH, GERMAN_ISO_QWERTZ_ROWS, SPAIN_ISO_QWERTY_ROWS, SLOVAK_ISO_QWERTZ_ROWS, JIS_INTL_YEN, JIS_INTL_RO, JIS_NON_CONVERT, JIS_CONVERT, JIS_KANA_MODE, JAPANESE_JIS_ROWS, JAPANESE_JIS_KEYBOARD_REFERENCE, KEYBOARD_HARDWARE_LAYOUTS, KEYBOARD_REFERENCE_SPECIAL_CLASS_BY_CODE;
var init_keyboard_hardware_layouts = __esm({
  "src/config/keyboard-hardware-layouts.js"() {
    DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID = /** @type {const} */
    "us-ansi-qwerty";
    US_ANSI_QWERTY_ROWS = Object.freeze([
      row("number", [
        key("Backquote", "0x35", "`", { shift: "~" }),
        key("Digit1", "0x1E", "1", { shift: "!" }),
        key("Digit2", "0x1F", "2", { shift: "@" }),
        key("Digit3", "0x20", "3", { shift: "#" }),
        key("Digit4", "0x21", "4", { shift: "$" }),
        key("Digit5", "0x22", "5", { shift: "%" }),
        key("Digit6", "0x23", "6", { shift: "^" }),
        key("Digit7", "0x24", "7", { shift: "&" }),
        key("Digit8", "0x25", "8", { shift: "*" }),
        key("Digit9", "0x26", "9", { shift: "(" }),
        key("Digit0", "0x27", "0", { shift: ")" }),
        key("Minus", "0x2D", "-", { shift: "_" }),
        key("Equal", "0x2E", "=", { shift: "+" }),
        key("Backspace", "0x2A", "Backspace", { width: 1.55 })
      ]),
      row("top", [
        key("Tab", "0x2B", "Tab", { width: 1.5 }),
        key("KeyQ", "0x14", "Q", { shift: "Q" }),
        key("KeyW", "0x1A", "W", { shift: "W" }),
        key("KeyE", "0x08", "E", { shift: "E" }),
        key("KeyR", "0x15", "R", { shift: "R" }),
        key("KeyT", "0x17", "T", { shift: "T" }),
        key("KeyY", "0x1C", "Y", { shift: "Y" }),
        key("KeyU", "0x18", "U", { shift: "U" }),
        key("KeyI", "0x0C", "I", { shift: "I" }),
        key("KeyO", "0x12", "O", { shift: "O" }),
        key("KeyP", "0x13", "P", { shift: "P" }),
        key("BracketLeft", "0x2F", "[", { shift: "{" }),
        key("BracketRight", "0x30", "]", { shift: "}" }),
        key("Backslash", "0x31", "\\", { shift: "|", width: 1.5 })
      ]),
      row("home", [
        key("CapsLock", "0x39", "Caps", { width: 1.75 }),
        key("KeyA", "0x04", "A", { shift: "A" }),
        key("KeyS", "0x16", "S", { shift: "S" }),
        key("KeyD", "0x07", "D", { shift: "D" }),
        key("KeyF", "0x09", "F", { shift: "F" }),
        key("KeyG", "0x0A", "G", { shift: "G" }),
        key("KeyH", "0x0B", "H", { shift: "H" }),
        key("KeyJ", "0x0D", "J", { shift: "J" }),
        key("KeyK", "0x0E", "K", { shift: "K" }),
        key("KeyL", "0x0F", "L", { shift: "L" }),
        key("Semicolon", "0x33", ";", { shift: ":" }),
        key("Quote", "0x34", "'", { shift: '"' }),
        key("Enter", "0x28", "Enter", { width: 2 })
      ]),
      row("bottom", [
        key("ShiftLeft", "0xE1", "Shift", { width: 2.15 }),
        key("KeyZ", "0x1D", "Z", { shift: "Z" }),
        key("KeyX", "0x1B", "X", { shift: "X" }),
        key("KeyC", "0x06", "C", { shift: "C" }),
        key("KeyV", "0x19", "V", { shift: "V" }),
        key("KeyB", "0x05", "B", { shift: "B" }),
        key("KeyN", "0x11", "N", { shift: "N" }),
        key("KeyM", "0x10", "M", { shift: "M" }),
        key("Comma", "0x36", ",", { shift: "<" }),
        key("Period", "0x37", ".", { shift: ">" }),
        key("Slash", "0x38", "/", { shift: "?" }),
        key("ShiftRight", "0xE5", "Shift", { width: 2.15 })
      ]),
      row("modifier", [
        key("ControlLeft", "0xE0", "Ctrl", { width: 1.25 }),
        key("MetaLeft", "0xE3", "Meta", { width: 1.25 }),
        key("AltLeft", "0xE2", "Alt", { width: 1.25 }),
        key("Space", "0x2C", "Space", { width: 6.25 }),
        key("AltRight", "0xE6", "Alt", { width: 1.25 }),
        key("MetaRight", "0xE7", "Meta", { width: 1.25 }),
        key("ContextMenu", "0x65", "Menu", { width: 1.25 }),
        key("ControlRight", "0xE4", "Ctrl", { width: 1.25 })
      ])
    ]);
    US_ANSI_QWERTY_KEYBOARD_REFERENCE = Object.freeze({
      rows: Object.freeze([
        referenceRow("top", [
          "Tab",
          "KeyQ",
          "KeyW",
          "KeyE",
          "KeyR",
          "KeyT",
          "KeyY",
          "KeyU",
          "KeyI",
          "KeyO",
          "KeyP",
          "BracketLeft",
          "BracketRight",
          "Backspace"
        ]),
        referenceRow("home", [
          "CapsLock",
          "KeyA",
          "KeyS",
          "KeyD",
          "KeyF",
          "KeyG",
          "KeyH",
          "KeyJ",
          "KeyK",
          "KeyL",
          "Semicolon",
          "Quote",
          "Enter"
        ]),
        referenceRow("bottom", [
          "ShiftLeft",
          "KeyZ",
          "KeyX",
          "KeyC",
          "KeyV",
          "KeyB",
          "KeyN",
          "KeyM",
          "Comma",
          "Period",
          "Slash",
          "ShiftRight"
        ])
      ]),
      numberRowCodes: Object.freeze([
        "Digit1",
        "Digit2",
        "Digit3",
        "Digit4",
        "Digit5",
        "Digit6",
        "Digit7",
        "Digit8",
        "Digit9",
        "Digit0"
      ])
    });
    ISO_INTL_BACKSLASH = key("IntlBackslash", "0x64", "<", { shift: ">" });
    GERMAN_ISO_QWERTZ_ROWS = cloneRowsWithLegends(US_ANSI_QWERTY_ROWS, {
      KeyY: { base: "Z", shift: "Z" },
      KeyZ: { base: "Y", shift: "Y" },
      BracketLeft: { base: "\xDC", shift: "\xDC" },
      BracketRight: { base: "+", shift: "*", altGr: "~" },
      Semicolon: { base: "\xD6", shift: "\xD6" },
      Quote: { base: "\xC4", shift: "\xC4" }
    }, ISO_INTL_BACKSLASH);
    SPAIN_ISO_QWERTY_ROWS = cloneRowsWithLegends(US_ANSI_QWERTY_ROWS, {
      Semicolon: { base: "\xD1", shift: "\xD1" },
      Quote: { base: "\xB4", shift: "\xA8", altGr: "{" },
      Backslash: { base: "\xC7", shift: "\xC7", altGr: "}" }
    }, ISO_INTL_BACKSLASH);
    SLOVAK_ISO_QWERTZ_ROWS = cloneRowsWithLegends(US_ANSI_QWERTY_ROWS, {
      KeyY: { base: "Z", shift: "Z" },
      KeyZ: { base: "Y", shift: "Y" },
      BracketLeft: { base: "\xDA", shift: "/" },
      BracketRight: { base: "\xC4", shift: "(" },
      Semicolon: { base: "\xD4", shift: '"' },
      Quote: { base: "\xA7", shift: "!" }
    }, ISO_INTL_BACKSLASH);
    JIS_INTL_YEN = key("IntlYen", "0x89", "\xA5", { shift: "|" });
    JIS_INTL_RO = key("IntlRo", "0x87", "\u308D", { shift: "\u30ED" });
    JIS_NON_CONVERT = key("NonConvert", "0x8B", "\u7121\u5909\u63DB", { width: 1.25 });
    JIS_CONVERT = key("Convert", "0x8A", "\u5909\u63DB", { width: 1.25 });
    JIS_KANA_MODE = key("KanaMode", "0x88", "\u304B\u306A", { width: 1.25 });
    JAPANESE_JIS_ROWS = Object.freeze([
      ...US_ANSI_QWERTY_ROWS.slice(0, 1).map((physicalRow) => row(
        physicalRow.id,
        physicalRow.keys.flatMap((physicalKey) => physicalKey.code === "Backspace" ? [JIS_INTL_YEN, physicalKey] : [physicalKey]),
        { offset: physicalRow.offset }
      )),
      ...US_ANSI_QWERTY_ROWS.slice(1, 3),
      row("bottom", US_ANSI_QWERTY_ROWS.find((physicalRow) => physicalRow.id === "bottom").keys.flatMap((physicalKey) => physicalKey.code === "ShiftRight" ? [JIS_INTL_RO, physicalKey] : [physicalKey])),
      row("modifier", [
        key("ControlLeft", "0xE0", "Ctrl", { width: 1.25 }),
        key("MetaLeft", "0xE3", "\u82F1\u6570", { width: 1.25 }),
        key("AltLeft", "0xE2", "Alt", { width: 1.25 }),
        JIS_NON_CONVERT,
        key("Space", "0x2C", "Space", { width: 3 }),
        JIS_CONVERT,
        JIS_KANA_MODE,
        key("AltRight", "0xE6", "Alt", { width: 1.25 }),
        key("ControlRight", "0xE4", "Ctrl", { width: 1.25 })
      ])
    ]);
    JAPANESE_JIS_KEYBOARD_REFERENCE = Object.freeze({
      rows: Object.freeze([
        referenceRow("top", [
          "Tab",
          "KeyQ",
          "KeyW",
          "KeyE",
          "KeyR",
          "KeyT",
          "KeyY",
          "KeyU",
          "KeyI",
          "KeyO",
          "KeyP",
          "BracketLeft",
          "BracketRight",
          "Backspace"
        ]),
        referenceRow("home", [
          "CapsLock",
          "KeyA",
          "KeyS",
          "KeyD",
          "KeyF",
          "KeyG",
          "KeyH",
          "KeyJ",
          "KeyK",
          "KeyL",
          "Semicolon",
          "Quote",
          "Enter"
        ]),
        referenceRow("bottom", [
          "ShiftLeft",
          "KeyZ",
          "KeyX",
          "KeyC",
          "KeyV",
          "KeyB",
          "KeyN",
          "KeyM",
          "Comma",
          "Period",
          "Slash",
          "IntlRo",
          "ShiftRight"
        ])
      ]),
      numberRowCodes: Object.freeze([
        "Digit1",
        "Digit2",
        "Digit3",
        "Digit4",
        "Digit5",
        "Digit6",
        "Digit7",
        "Digit8",
        "Digit9",
        "Digit0"
      ])
    });
    KEYBOARD_HARDWARE_LAYOUTS = Object.freeze({
      "us-ansi-qwerty": Object.freeze({
        id: "us-ansi-qwerty",
        labelKey: "keyboard_hardware_layout_us_ansi_qwerty",
        formFactor: "ANSI",
        rows: US_ANSI_QWERTY_ROWS,
        keyboardReference: US_ANSI_QWERTY_KEYBOARD_REFERENCE
      }),
      "de-de-qwertz-iso": Object.freeze({
        id: "de-de-qwertz-iso",
        labelKey: "keyboard_hardware_layout_de_de_qwertz_iso",
        formFactor: "ISO",
        rows: GERMAN_ISO_QWERTZ_ROWS,
        keyboardReference: cloneReferenceGeometry(US_ANSI_QWERTY_KEYBOARD_REFERENCE, { extraBottomCode: "IntlBackslash" })
      }),
      "es-es-qwerty-iso": Object.freeze({
        id: "es-es-qwerty-iso",
        labelKey: "keyboard_hardware_layout_es_es_qwerty_iso",
        formFactor: "ISO",
        rows: SPAIN_ISO_QWERTY_ROWS,
        keyboardReference: cloneReferenceGeometry(US_ANSI_QWERTY_KEYBOARD_REFERENCE, { extraBottomCode: "IntlBackslash" })
      }),
      "sk-sk-qwertz-iso": Object.freeze({
        id: "sk-sk-qwertz-iso",
        labelKey: "keyboard_hardware_layout_sk_sk_qwertz_iso",
        formFactor: "ISO",
        rows: SLOVAK_ISO_QWERTZ_ROWS,
        keyboardReference: cloneReferenceGeometry(US_ANSI_QWERTY_KEYBOARD_REFERENCE, { extraBottomCode: "IntlBackslash" })
      }),
      "ja-jis-106": Object.freeze({
        id: "ja-jis-106",
        labelKey: "keyboard_hardware_layout_ja_jis_106",
        formFactor: "JIS",
        rows: JAPANESE_JIS_ROWS,
        keyboardReference: JAPANESE_JIS_KEYBOARD_REFERENCE
      })
    });
    KEYBOARD_REFERENCE_SPECIAL_CLASS_BY_CODE = Object.freeze({
      Tab: "key key-tab",
      CapsLock: "key key-caps",
      Enter: "key key-enter",
      ShiftLeft: "key key-shift",
      ShiftRight: "key key-shift",
      Backspace: "key key-backspace"
    });
  }
});

// src/utils/open-url-list.js
function canonicalizeHttpUrl(value) {
  let raw = String(value ?? "").trim();
  if (!raw || /\s/.test(raw)) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = `https://${raw}`;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (!url.hostname || !url.hostname.includes(".")) return "";
    return url.href;
  } catch {
    return "";
  }
}
function normalizeOpenUrlList(raw, max = OPEN_URLS_MAX) {
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : OPEN_URLS_MAX;
  const items = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/\r?\n/) : [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of items) {
    const url = canonicalizeHttpUrl(item);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= limit) break;
  }
  return out;
}
var OPEN_URLS_MAX;
var init_open_url_list = __esm({
  "src/utils/open-url-list.js"() {
    OPEN_URLS_MAX = 20;
  }
});

// src/config/region-defaults-data.js
var regionDefaultFiles;
var init_region_defaults_data = __esm({
  "src/config/region-defaults-data.js"() {
    regionDefaultFiles = {
      de: { "stockSocialMedia": { "urls": ["facebook.com", "instagram.com", "youtube.com", "x.com", "whatsapp.com"] }, "searchEngineUrls": { "google": { "homeUrl": "https://www.google.de/", "searchUrlPrefix": "https://www.google.de/search?q=" } }, "launcherSearchSites": [{ "title": "Google", "url": "https://www.google.de" }, { "title": "Bing", "url": "https://bing.com" }, { "title": "DuckDuckGo", "url": "https://duckduckgo.com" }, { "title": "Yahoo", "url": "https://yahoo.com" }, { "title": "Brave Search", "url": "https://search.brave.com" }, { "title": "Ecosia", "url": "https://ecosia.org" }, { "title": "Startpage", "url": "https://startpage.com" }, { "title": "Yandex", "url": "https://yandex.com" }] },
      en: { "stockSocialMedia": { "urls": ["facebook.com", "instagram.com", "youtube.com", "x.com"] }, "searchEngineUrls": { "google": { "homeUrl": "https://www.google.com/", "searchUrlPrefix": "https://www.google.com/search?q=" } }, "launcherSearchSites": [{ "title": "Google", "url": "https://google.com" }, { "title": "Bing", "url": "https://bing.com" }, { "title": "DuckDuckGo", "url": "https://duckduckgo.com" }, { "title": "Yahoo", "url": "https://yahoo.com" }, { "title": "Brave Search", "url": "https://search.brave.com" }, { "title": "Ecosia", "url": "https://ecosia.org" }, { "title": "Startpage", "url": "https://startpage.com" }, { "title": "Yandex", "url": "https://yandex.com" }] },
      es: { "stockSocialMedia": { "urls": ["facebook.com", "instagram.com", "youtube.com", "x.com", "whatsapp.com"] }, "searchEngineUrls": { "google": { "homeUrl": "https://www.google.es/", "searchUrlPrefix": "https://www.google.es/search?q=" } }, "launcherSearchSites": [{ "title": "Google", "url": "https://www.google.es" }, { "title": "Bing", "url": "https://bing.com" }, { "title": "DuckDuckGo", "url": "https://duckduckgo.com" }, { "title": "Yahoo", "url": "https://yahoo.com" }, { "title": "Brave Search", "url": "https://search.brave.com" }, { "title": "Ecosia", "url": "https://ecosia.org" }, { "title": "Startpage", "url": "https://startpage.com" }, { "title": "Yandex", "url": "https://yandex.com" }] },
      es_419: { "searchEngineUrls": { "google": { "homeUrl": "https://www.google.com.mx/", "searchUrlPrefix": "https://www.google.com.mx/search?q=" } }, "launcherSearchSites": [{ "title": "Google", "url": "https://www.google.com.mx" }, { "title": "Bing", "url": "https://bing.com" }, { "title": "DuckDuckGo", "url": "https://duckduckgo.com" }, { "title": "Yahoo", "url": "https://yahoo.com" }, { "title": "Brave Search", "url": "https://search.brave.com" }, { "title": "Ecosia", "url": "https://ecosia.org" }, { "title": "Startpage", "url": "https://startpage.com" }, { "title": "Yandex", "url": "https://yandex.com" }] },
      he: { "stockSocialMedia": { "urls": ["facebook.com", "instagram.com", "youtube.com", "x.com", "whatsapp.com"] }, "searchEngineUrls": { "google": { "homeUrl": "https://www.google.co.il/", "searchUrlPrefix": "https://www.google.co.il/search?q=" } }, "launcherSearchSites": [{ "title": "Google", "url": "https://www.google.co.il" }, { "title": "Bing", "url": "https://bing.com" }, { "title": "DuckDuckGo", "url": "https://duckduckgo.com" }, { "title": "Yahoo", "url": "https://yahoo.com" }, { "title": "Brave Search", "url": "https://search.brave.com" }, { "title": "Ecosia", "url": "https://ecosia.org" }, { "title": "Startpage", "url": "https://startpage.com" }, { "title": "Yandex", "url": "https://yandex.com" }] },
      hi: { "stockSocialMedia": { "urls": ["youtube.com", "instagram.com", "facebook.com", "whatsapp.com", "x.com"] }, "searchEngineUrls": { "google": { "homeUrl": "https://www.google.co.in/", "searchUrlPrefix": "https://www.google.co.in/search?q=" } }, "launcherSearchSites": [{ "title": "Google", "url": "https://www.google.co.in" }, { "title": "Bing", "url": "https://bing.com" }, { "title": "DuckDuckGo", "url": "https://duckduckgo.com" }, { "title": "Yahoo", "url": "https://yahoo.com" }, { "title": "Brave Search", "url": "https://search.brave.com" }, { "title": "Ecosia", "url": "https://ecosia.org" }, { "title": "Startpage", "url": "https://startpage.com" }, { "title": "Yandex", "url": "https://yandex.com" }] },
      ja: { "stockSocialMedia": { "urls": ["youtube.com", "x.com", "instagram.com", "line.me", "tiktok.com"] }, "searchEngineUrls": { "google": { "homeUrl": "https://www.google.co.jp/", "searchUrlPrefix": "https://www.google.co.jp/search?q=" } }, "launcherSearchSites": [{ "title": "Google", "url": "https://www.google.co.jp" }, { "title": "Yahoo Japan", "url": "https://www.yahoo.co.jp" }, { "title": "Bing", "url": "https://bing.com" }, { "title": "DuckDuckGo", "url": "https://duckduckgo.com" }, { "title": "Brave Search", "url": "https://search.brave.com" }, { "title": "Ecosia", "url": "https://ecosia.org" }, { "title": "Startpage", "url": "https://startpage.com" }] },
      sk: { "stockSocialMedia": { "urls": ["facebook.com", "instagram.com", "youtube.com", "tiktok.com"] }, "searchEngineUrls": { "google": { "homeUrl": "https://www.google.sk/", "searchUrlPrefix": "https://www.google.sk/search?q=" } }, "launcherSearchSites": [{ "title": "Google", "url": "https://www.google.sk" }, { "title": "Seznam", "url": "https://www.seznam.cz" }, { "title": "Bing", "url": "https://bing.com" }, { "title": "DuckDuckGo", "url": "https://duckduckgo.com" }, { "title": "Yahoo", "url": "https://yahoo.com" }, { "title": "Brave Search", "url": "https://search.brave.com" }, { "title": "Ecosia", "url": "https://ecosia.org" }, { "title": "Startpage", "url": "https://startpage.com" }] },
      zh_CN: { "stockSocialMedia": { "urls": ["weibo.com", "douyin.com", "bilibili.com", "xiaohongshu.com", "weixin.qq.com"] }, "searchEngineUrls": { "google": { "homeUrl": "https://www.google.com/", "searchUrlPrefix": "https://www.google.com/search?q=" } }, "launcherSearchSites": [{ "title": "Baidu", "url": "https://www.baidu.com" }, { "title": "Bing", "url": "https://bing.com" }, { "title": "Sogou", "url": "https://www.sogou.com" }, { "title": "Google", "url": "https://www.google.com" }, { "title": "DuckDuckGo", "url": "https://duckduckgo.com" }, { "title": "Brave Search", "url": "https://search.brave.com" }] },
      zh_HK: { "searchEngineUrls": { "google": { "homeUrl": "https://www.google.com.hk/", "searchUrlPrefix": "https://www.google.com.hk/search?q=" } }, "launcherSearchSites": [{ "title": "Google", "url": "https://www.google.com.hk" }, { "title": "Bing", "url": "https://bing.com" }, { "title": "Yahoo", "url": "https://yahoo.com" }, { "title": "DuckDuckGo", "url": "https://duckduckgo.com" }, { "title": "Brave Search", "url": "https://search.brave.com" }, { "title": "Ecosia", "url": "https://ecosia.org" }, { "title": "Startpage", "url": "https://startpage.com" }] },
      zh_TW: { "stockSocialMedia": { "urls": ["facebook.com", "instagram.com", "youtube.com", "line.me"] }, "searchEngineUrls": { "google": { "homeUrl": "https://www.google.com.tw/", "searchUrlPrefix": "https://www.google.com.tw/search?q=" } }, "launcherSearchSites": [{ "title": "Google", "url": "https://www.google.com.tw" }, { "title": "Bing", "url": "https://bing.com" }, { "title": "Yahoo", "url": "https://yahoo.com" }, { "title": "DuckDuckGo", "url": "https://duckduckgo.com" }, { "title": "Brave Search", "url": "https://search.brave.com" }, { "title": "Ecosia", "url": "https://ecosia.org" }, { "title": "Startpage", "url": "https://startpage.com" }] }
    };
  }
});

// src/config/region-defaults.js
function catalogId(tag) {
  return String(tag || "").trim().replace(/-/g, "_");
}
function candidateCatalogIds(uiLanguage) {
  const out = [];
  for (const tag of getLocaleCandidates(uiLanguage)) {
    const id = catalogId(tag);
    if (!id) continue;
    out.push(id);
    const parent = REGION_PARENT[id];
    if (parent) out.push(parent);
  }
  return [...new Set(out)];
}
function mergeRegion(base, overlay) {
  if (!overlay) return base;
  const searchEngineUrls = { ...base.searchEngineUrls || {} };
  for (const [id, urls] of Object.entries(overlay.searchEngineUrls || {})) {
    searchEngineUrls[id] = {
      ...searchEngineUrls[id] || {},
      ...urls
    };
  }
  return {
    stockSocialMedia: overlay.stockSocialMedia || base.stockSocialMedia,
    searchEngineUrls,
    launcherSearchSites: overlay.launcherSearchSites || base.launcherSearchSites
  };
}
function getRegionDefaults(uiLanguage) {
  let resolved = (
    /** @type {RegionDefaultsFile} */
    { ...en }
  );
  for (const id of [...candidateCatalogIds(uiLanguage)].reverse()) {
    const file = REGION_FILES[id];
    if (file) resolved = mergeRegion(resolved, file);
  }
  return resolved;
}
function getStockSocialMediaUrls(uiLanguage) {
  const urls = getRegionDefaults(uiLanguage).stockSocialMedia?.urls;
  return Array.isArray(urls) ? urls.slice() : [];
}
function getLauncherSearchSites(uiLanguage) {
  const rows = getRegionDefaults(uiLanguage).launcherSearchSites;
  if (!Array.isArray(rows)) return [];
  return rows.filter((row2) => row2 && typeof row2.title === "string" && typeof row2.url === "string").map((row2) => ({ title: row2.title, url: row2.url, isDefault: true }));
}
var REGION_FILES, en, REGION_PARENT;
var init_region_defaults = __esm({
  "src/config/region-defaults.js"() {
    init_i18n();
    init_region_defaults_data();
    REGION_FILES = regionDefaultFiles;
    en = REGION_FILES.en;
    REGION_PARENT = Object.freeze({
      es_419: "es",
      zh_HK: "zh_TW"
    });
  }
});

// src/config/stock-actions.js
function getStockActionById(id) {
  const key2 = String(id || "");
  const found = STOCK_ACTIONS.find((action) => action && action.id === key2);
  if (!found) return null;
  const parameters = found.id === STOCK_SOCIAL_MEDIA_ACTION_ID ? Object.freeze({
    ...found.parameters,
    urls: Object.freeze(normalizeOpenUrlList(getStockSocialMediaUrls()))
  }) : found.parameters;
  return {
    ...found,
    parameters,
    label: getMessage(found.labelKey) || found.label || found.id,
    description: found.descriptionKey && getMessage(found.descriptionKey) || found.description || ""
  };
}
var STOCK_SOCIAL_MEDIA_ACTION_ID, STOCK_RANDOM_BOOKMARK_ACTION_ID, STOCK_ACTIONS;
var init_stock_actions = __esm({
  "src/config/stock-actions.js"() {
    init_i18n();
    init_open_url_list();
    init_region_defaults();
    STOCK_SOCIAL_MEDIA_ACTION_ID = "stock:social-media";
    STOCK_RANDOM_BOOKMARK_ACTION_ID = "stock:random-bookmark";
    STOCK_ACTIONS = Object.freeze([
      Object.freeze({
        id: STOCK_SOCIAL_MEDIA_ACTION_ID,
        functionId: "OPEN_URLS",
        handler: "handleOpenUrlsKey",
        keyboardClass: "key-open-urls",
        labelKey: "fn_stock_social_media_label",
        descriptionKey: "fn_stock_social_media_description",
        label: "Social media",
        description: "Open several social media sites in new tabs",
        parameters: Object.freeze({
          urls: Object.freeze(normalizeOpenUrlList([
            "facebook.com",
            "instagram.com",
            "youtube.com",
            "x.com"
          ]))
        })
      }),
      Object.freeze({
        id: STOCK_RANDOM_BOOKMARK_ACTION_ID,
        functionId: "RANDOM_BOOKMARK",
        handler: "handleRandomBookmarkKey",
        keyboardClass: "key-open-urls",
        labelKey: "fn_stock_random_bookmark_label",
        descriptionKey: "fn_stock_random_bookmark_description",
        label: "Random Bookmark",
        description: "Open one random bookmark",
        parameters: Object.freeze({
          folderId: "",
          count: 1
        })
      })
    ]);
  }
});

// src/config/keyboard-layouts.js
function isBuildExcludedKeyAction(actionId) {
  const id = String(actionId || "");
  return !!id && BUILD_EXCLUDED_KEY_ACTION_SET.has(id);
}
function normalizeKeyboardLayoutId(raw) {
  const v = String(raw || "").trim();
  if (KNOWN_BUILTIN_LAYOUT_IDS.has(v)) return (
    /** @type {BuiltinKeyboardLayoutId} */
    v
  );
  return DEFAULT_KEYBOARD_LAYOUT_ID;
}
function normalizeKeyboardLayoutFamilyId(raw) {
  const v = String(raw || "").trim();
  if (v === "navigation") return "browsing";
  if (!v) return DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID;
  const known = BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META.some((m) => m && m.id === v);
  if (known) return v;
  if (Object.prototype.hasOwnProperty.call(LEGACY_KEYBOARD_LAYOUT_FAMILY_VARIANTS, v)) {
    return (
      /** @type {KeyboardLayoutFamilyId} */
      v
    );
  }
  return DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID;
}
function normalizeKeyboardHandedness(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "left" || v === "right") return (
    /** @type {KeyboardHandedness} */
    v
  );
  return DEFAULT_KEYBOARD_HANDEDNESS;
}
function resolveKeyboardLayoutId({ familyId, handedness } = {}) {
  const fam = normalizeKeyboardLayoutFamilyId(familyId);
  const hand = normalizeKeyboardHandedness(handedness);
  const meta = BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META.find((m) => m && m.id === fam);
  const legacy = LEGACY_KEYBOARD_LAYOUT_FAMILY_VARIANTS[fam];
  const resolved = meta?.variants?.[hand] || legacy?.[hand];
  return normalizeKeyboardLayoutId(resolved);
}
function inferFamilyAndHandednessFromLayoutId(rawLayoutId) {
  const id = normalizeKeyboardLayoutId(rawLayoutId);
  if (id.endsWith("-left")) {
    const familyId = id.slice(0, -"-left".length);
    return {
      familyId: normalizeKeyboardLayoutFamilyId(familyId),
      handedness: "left"
    };
  }
  if (id.endsWith("-right")) {
    const familyId = id.slice(0, -"-right".length);
    return {
      familyId: normalizeKeyboardLayoutFamilyId(familyId),
      handedness: "right"
    };
  }
  return { familyId: DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID, handedness: DEFAULT_KEYBOARD_HANDEDNESS };
}
function upperLetter(s) {
  const ch = String(s || "");
  if (!ch) return "";
  return ch.length === 1 ? ch.toUpperCase() : ch;
}
function normalizeAssignmentLabels(a) {
  const keys = Array.isArray(a?.keys) ? a.keys : [];
  const first = keys[0] || "";
  const explicitDisplay = typeof a?.displayKey === "string" ? a.displayKey : "";
  const explicitKeyLabel = typeof a?.keyLabel === "string" ? a.keyLabel : "";
  if (explicitDisplay || explicitKeyLabel) {
    const dk = explicitDisplay || explicitKeyLabel;
    const kl = explicitKeyLabel || explicitDisplay;
    return { keyLabel: kl || dk || "", displayKey: dk || kl || "" };
  }
  if (typeof first === "string" && first.length === 1 && /[a-zA-Z]/.test(first)) {
    const up = upperLetter(first);
    return { keyLabel: up, displayKey: up };
  }
  return { keyLabel: String(first || ""), displayKey: String(first || "") };
}
function localizedActionCopy(actionId, def) {
  const id = String(actionId || "");
  return {
    label: getMessage(`fn_${id}_label`) || def?.label || id,
    description: getMessage(`fn_${id}_description`) || def?.description || ""
  };
}
function isBrowsingKeyboardLayoutId(layoutId) {
  const id = normalizeKeyboardLayoutId(layoutId);
  return id === "browsing-right" || id === "browsing-left";
}
function buildKeybindingsForLayout(layoutId, opts = {}) {
  const id = normalizeKeyboardLayoutId(layoutId);
  const layout = BUILTIN_KEYBOARD_LAYOUTS[id];
  const out = {};
  const assignments = {
    ...layout?.assignments || {},
    ...opts?.deferredNumberRow && isBrowsingKeyboardLayoutId(id) ? DEFERRED_NUMBER_ROW_ASSIGNMENTS : {}
  };
  for (const [actionId, def] of Object.entries(KEYBINDING_ACTION_DEFS)) {
    if (isBuildExcludedKeyAction(actionId)) continue;
    const assign = assignments[actionId];
    if (!assign || !Array.isArray(assign.keys)) continue;
    const labels = normalizeAssignmentLabels(assign);
    const copy = localizedActionCopy(actionId, def);
    out[actionId] = {
      keys: assign.keys.slice(),
      ...assign.bindingType ? { bindingType: assign.bindingType } : {},
      ...Array.isArray(assign.matchOn) ? { matchOn: assign.matchOn.slice() } : {},
      handler: def.handler,
      label: copy.label,
      description: copy.description,
      keyLabel: labels.keyLabel,
      keyboardClass: def.keyboardClass ?? null,
      row: def.row ?? null,
      displayKey: labels.displayKey
    };
  }
  for (const stock of STOCK_ACTIONS) {
    const assign = assignments[stock.id];
    if (!assign || !Array.isArray(assign.keys)) continue;
    const labels = normalizeAssignmentLabels(assign);
    const localized = getStockActionById(stock.id);
    out[stock.id] = {
      keys: assign.keys.slice(),
      ...assign.bindingType ? { bindingType: assign.bindingType } : {},
      ...Array.isArray(assign.matchOn) ? { matchOn: assign.matchOn.slice() } : {},
      handler: stock.handler,
      functionId: stock.functionId,
      instanceId: stock.id,
      parameters: localized?.parameters || stock.parameters,
      label: localized?.label || stock.id,
      description: localized?.description || "",
      keyLabel: labels.keyLabel,
      keyboardClass: stock.keyboardClass ?? null,
      row: null,
      displayKey: labels.displayKey
    };
  }
  return out;
}
function physicalAssignment(code, displayKey) {
  return Object.freeze({
    bindingType: "physical",
    keys: Object.freeze([code]),
    matchOn: Object.freeze(["code"]),
    displayKey,
    keyLabel: displayKey
  });
}
function buildSystemKeybindings(handedness = DEFAULT_KEYBOARD_HANDEDNESS) {
  const hand = normalizeKeyboardHandedness(handedness);
  const assignments = hand === "left" ? SYSTEM_LAYER_ASSIGNMENTS_LEFT : SYSTEM_LAYER_ASSIGNMENTS_RIGHT;
  const out = {};
  for (const actionId of SYSTEM_LAYER_ACTION_IDS) {
    const def = KEYBINDING_ACTION_DEFS[actionId];
    const assign = assignments[actionId];
    if (!def || !assign || !Array.isArray(assign.keys)) continue;
    const labels = normalizeAssignmentLabels(assign);
    const copy = localizedActionCopy(actionId, def);
    out[actionId] = {
      keys: assign.keys.slice(),
      ...assign.bindingType ? { bindingType: assign.bindingType } : {},
      ...Array.isArray(assign.matchOn) ? { matchOn: assign.matchOn.slice() } : {},
      handler: def.handler,
      label: copy.label,
      description: copy.description,
      keyLabel: labels.keyLabel,
      keyboardClass: def.keyboardClass ?? null,
      row: def.row ?? null,
      displayKey: labels.displayKey,
      systemLayer: true
    };
  }
  return out;
}
function buildEffectiveKeybindings(layoutId, handedness = DEFAULT_KEYBOARD_HANDEDNESS, opts = {}) {
  return {
    ...buildKeybindingsForLayout(layoutId, opts),
    ...buildSystemKeybindings(handedness)
  };
}
function pickAssignments(source, allowedIds) {
  const allowed = new Set(allowedIds);
  const out = {};
  for (const id of allowedIds) {
    if (isBuildExcludedKeyAction(id)) continue;
    if (source[id]) out[id] = source[id];
  }
  for (const [id, assignment] of Object.entries(source || {})) {
    if (isBuildExcludedKeyAction(id)) continue;
    if (allowed.has(id) && !out[id]) out[id] = assignment;
  }
  return Object.freeze(out);
}
function physicalSlotLabelFromBinding(binding) {
  const namedSlot = (raw) => {
    const token = String(raw || "").trim();
    if (!token) return "";
    if (token.length === 1) return /[a-z]/i.test(token) ? token.toUpperCase() : token;
    if (/^(Backspace|Escape)$/i.test(token)) {
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    }
    return "";
  };
  const s = String(binding?.displayKey || binding?.keyLabel || "").trim();
  const fromLabel = namedSlot(s);
  if (fromLabel) return fromLabel;
  if (s.includes("/")) {
    const first = s.split("/")[0];
    const fromComposite = namedSlot(first);
    if (fromComposite) return fromComposite;
  }
  const keys = Array.isArray(binding?.keys) ? binding.keys : [];
  for (const k of keys) {
    const fromKey = namedSlot(k);
    if (fromKey) return fromKey;
  }
  return "";
}
function letterFromAssignment(assignment) {
  if (!assignment) return "";
  const slot = physicalSlotLabelFromBinding(assignment);
  if (slot) return slot;
  if (typeof assignment.displayKey === "string" && assignment.displayKey) return assignment.displayKey;
  if (typeof assignment.keyLabel === "string" && assignment.keyLabel) return assignment.keyLabel;
  const keys = Array.isArray(assignment.keys) ? assignment.keys : [];
  for (const k of keys) {
    const s = String(k || "");
    if (!s || s === "Semicolon" || s === "Quote" || s === "Backquote") continue;
    if (s.length === 1) return s.toUpperCase();
    if (s === "Backspace" || s === "Escape") return s;
  }
  return "";
}
function projectKeyboardUiLayout(baseLayout, fullAssignments, allowedIds) {
  const allowed = new Set(allowedIds);
  return Object.freeze(
    (Array.isArray(baseLayout) ? baseLayout : []).map(
      (row2) => Object.freeze(
        (Array.isArray(row2) ? row2 : []).map((cell) => {
          if (!cell || cell.type !== "action" || !cell.id) return cell;
          if (isBuildExcludedKeyAction(cell.id) || !allowed.has(cell.id)) {
            if (cell.id === "DELETE" || cell.className && String(cell.className).includes("key-backspace")) {
              return Object.freeze({ type: "special", text: "Backspace", className: "key key-backspace" });
            }
            const text = letterFromAssignment(fullAssignments[cell.id]);
            if (!text) return Object.freeze({ type: "key", text: "" });
            if (text === "Backspace") {
              return Object.freeze({ type: "special", text: "Backspace", className: "key key-backspace" });
            }
            const glyph = text.length <= 3 ? text : text.slice(0, 1).toUpperCase();
            return Object.freeze({ type: "key", text: glyph.length === 1 ? glyph.toUpperCase() : glyph });
          }
          return cell;
        })
      )
    )
  );
}
var DEFAULT_KEYBOARD_LAYOUT_ID, DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID, DEFAULT_KEYBOARD_HANDEDNESS, SOURCE_BUILD_ENABLE_MACRO_BUILDER, BUILD_ENABLE_MACRO_BUILDER, BUILD_EXCLUDED_KEY_ACTIONS, BUILD_EXCLUDED_KEY_ACTION_SET, BUILTIN_KEYBOARD_LAYOUT_META, BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META, LEGACY_KEYBOARD_LAYOUT_FAMILY_VARIANTS, KNOWN_BUILTIN_LAYOUT_IDS, KEYBINDING_ACTION_DEFS, KEYBINDING_ACTION_CATEGORY_BY_ID, KEYBINDING_ACTION_CATEGORY_ORDER, DEFERRED_NUMBER_ROW_ASSIGNMENTS, CATALOG_KEYBINDINGS, ASSIGNMENTS_BROWSING_RIGHT, ASSIGNMENTS_BROWSING_LEFT, SYSTEM_LAYER_ACTION_IDS, SYSTEM_LAYER_ASSIGNMENTS_RIGHT, SYSTEM_LAYER_ASSIGNMENTS_LEFT, BASIC_NAVIGATION_ACTION_IDS, CLICK_HISTORY_ACTION_IDS, BASIC_NAVIGATION_UI_ACTION_IDS, CLICK_HISTORY_UI_ACTION_IDS, ASSIGNMENTS_BASIC_NAVIGATION_RIGHT, ASSIGNMENTS_BASIC_NAVIGATION_LEFT, ASSIGNMENTS_CLICK_HISTORY_RIGHT, ASSIGNMENTS_CLICK_HISTORY_LEFT, KEYBOARD_UI_LAYOUT_RIGHT, KEYBOARD_UI_LAYOUT_LEFT, BUILTIN_KEYBOARD_LAYOUTS;
var init_keyboard_layouts = __esm({
  "src/config/keyboard-layouts.js"() {
    init_i18n();
    init_keyboard_hardware_layouts();
    init_stock_actions();
    DEFAULT_KEYBOARD_LAYOUT_ID = /** @type {const} */
    "browsing-right";
    DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID = /** @type {const} */
    "browsing";
    DEFAULT_KEYBOARD_HANDEDNESS = /** @type {const} */
    "right";
    SOURCE_BUILD_ENABLE_MACRO_BUILDER = false;
    BUILD_ENABLE_MACRO_BUILDER = typeof __KP_BUILD_ENABLE_MACRO_BUILDER__ !== "undefined" ? !!__KP_BUILD_ENABLE_MACRO_BUILDER__ : SOURCE_BUILD_ENABLE_MACRO_BUILDER;
    BUILD_EXCLUDED_KEY_ACTIONS = Object.freeze([
      "COLS_TOGGLE",
      // Type — "Type saved text into the focused field."
      "TYPE_CHARACTERS",
      // Data — "Read text or media under the cursor, or from a highlight."
      "GET_TEXT_AT_CURSOR",
      "GET_TEXT_RANGE",
      "GET_MEDIA_AT_CURSOR",
      // Script — "Run a user-authored JavaScript snippet against page state."
      "EXECUTE_JS",
      // Create built-in Macro Key — "Saved Macro Key instances (hotkey, burst, round-robin, and related kinds) ready to place."
      "SEND_HOTKEY",
      "SEND_BURST",
      "CYCLE_ROUND_ROBIN",
      "HOLD_CONTINUOUS",
      "CLICK_MOUSE_BUTTON",
      "REMAP_KEY",
      // Translate — "Translate highlighted or under-cursor text."
      "TRANSLATE",
      // AI — "Send selected text to AI with a prompt and result destination."
      "SEND_TEXT_TO_AI"
    ]);
    BUILD_EXCLUDED_KEY_ACTION_SET = new Set(BUILD_EXCLUDED_KEY_ACTIONS);
    BUILTIN_KEYBOARD_LAYOUT_META = Object.freeze([
      Object.freeze({
        id: (
          /** @type {const} */
          "browsing-right"
        ),
        label: "Browsing: right-handed",
        description: "Full browsing layout. Mouse: right hand. Shortcuts primarily on the left."
      }),
      Object.freeze({
        id: (
          /** @type {const} */
          "browsing-left"
        ),
        label: "Browsing: left-handed",
        description: "Full browsing layout. Mouse: left hand. Shortcuts primarily on the right."
      }),
      Object.freeze({
        id: (
          /** @type {const} */
          "basic-navigation-right"
        ),
        label: "Basic Navigation: right-handed",
        description: "Page scroll, click, tab switch, back/forward only."
      }),
      Object.freeze({
        id: (
          /** @type {const} */
          "basic-navigation-left"
        ),
        label: "Basic Navigation: left-handed",
        description: "Page scroll, click, tab switch, back/forward only."
      }),
      Object.freeze({
        id: (
          /** @type {const} */
          "click-history-right"
        ),
        label: "Navigation: right-handed",
        description: "Click element, go back, and go forward only."
      }),
      Object.freeze({
        id: (
          /** @type {const} */
          "click-history-left"
        ),
        label: "Navigation: left-handed",
        description: "Click element, go back, and go forward only."
      })
    ]);
    BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META = Object.freeze([
      Object.freeze({
        id: (
          /** @type {const} */
          "browsing"
        ),
        labelKey: "layout_family_browsing_label",
        builtIn: true,
        descriptionKey: "layout_family_browsing_description",
        variants: Object.freeze({
          right: (
            /** @type {const} */
            "browsing-right"
          ),
          left: (
            /** @type {const} */
            "browsing-left"
          )
        })
      }),
      Object.freeze({
        id: (
          /** @type {const} */
          "click-history"
        ),
        labelKey: "layout_family_navigation_label",
        builtIn: true,
        descriptionKey: "layout_family_navigation_description",
        variants: Object.freeze({
          right: (
            /** @type {const} */
            "click-history-right"
          ),
          left: (
            /** @type {const} */
            "click-history-left"
          )
        })
      })
    ]);
    LEGACY_KEYBOARD_LAYOUT_FAMILY_VARIANTS = Object.freeze({
      "basic-navigation": Object.freeze({
        right: (
          /** @type {const} */
          "basic-navigation-right"
        ),
        left: (
          /** @type {const} */
          "basic-navigation-left"
        )
      })
    });
    KNOWN_BUILTIN_LAYOUT_IDS = new Set(
      BUILTIN_KEYBOARD_LAYOUT_META.map((m) => m && m.id).filter(Boolean)
    );
    KEYBINDING_ACTION_DEFS = Object.freeze({
      ACTIVATE: Object.freeze({
        handler: "handleActivateKey",
        label: "Click Element",
        description: "Click the hovered element",
        details: "Activates the clickable under the cursor \u2014 the same as a left mouse click on that element. Works with links, buttons, and other interactive targets KeyPilot highlights.",
        keyboardClass: "key-activate",
        row: 2
      }),
      ACTIVATE_DEFERRED_RANDOM: Object.freeze({
        handler: "handleActivateDeferredRandomKey",
        label: "Click Element Deferred Random",
        description: "Schedule the hovered link for a random time",
        details: "Schedules the link under the cursor for a random time in the Delay Click Element range. Same as Alt+Shift with Click Element.",
        keyboardClass: "key-activate",
        row: 0
      }),
      ACTIVATE_DEFERRED_SCHEDULED: Object.freeze({
        handler: "handleActivateDeferredScheduledKey",
        label: "Click Element Deferred Scheduled",
        description: "Schedule the hovered link for an exact time",
        details: "Opens the time dialog for the link under the cursor. Same as Ctrl+Alt+Shift with Click Element.",
        keyboardClass: "key-activate",
        row: 0
      }),
      SCHEDULE_LINK_MANUAL: Object.freeze({
        handler: "handleScheduleLinkManualKey",
        label: "Schedule Link Manual",
        description: "Schedule a typed URL for an exact time",
        details: "Opens the time dialog with a URL field. The address you type is opened at the time you choose.",
        keyboardClass: "key-activate",
        row: 0
      }),
      // Foreground new tab (switch to the new tab).
      ACTIVATE_NEW_TAB: Object.freeze({
        handler: "handleActivateNewTabKey",
        label: "Click New Tab",
        description: "Open link in a new foreground tab",
        details: "Opens the hovered link in a new tab and switches to it immediately. Use when you want to follow a link without leaving your place permanently, but still jump to the new page right away.",
        keyboardClass: "key-activate-new",
        row: 2
      }),
      // Background new tab (middle-click style; do not switch focus).
      ACTIVATE_NEW_TAB_BACKGROUND: Object.freeze({
        handler: "handleActivateNewTabBackgroundKey",
        label: "Click New Tab Background",
        description: "Open link in a new background tab",
        details: "Opens the hovered link in a new tab without switching focus \u2014 like a middle-click. Useful for queueing several links while you keep reading the current page.",
        keyboardClass: "key-activate-new-over",
        row: 2
      }),
      BACK: Object.freeze({
        handler: "handleBackKey",
        label: "Go Back",
        description: "Browser history back",
        details: "Navigates one step back in the current tab\u2019s history, equivalent to the browser Back button.",
        keyboardClass: "key-back",
        row: 2
      }),
      BACK2: Object.freeze({
        handler: "handleBackKey",
        label: "Go Back",
        description: "Browser history back",
        details: "Navigates one step back in the current tab\u2019s history, equivalent to the browser Back button. Duplicate id for layouts that expose a second Back binding.",
        keyboardClass: "key-back",
        row: 2
      }),
      FORWARD: Object.freeze({
        handler: "handleForwardKey",
        label: "Go Forward",
        description: "Browser history forward",
        details: "Navigates one step forward in the current tab\u2019s history, equivalent to the browser Forward button.",
        keyboardClass: "key-forward",
        row: 1
      }),
      DELETE: Object.freeze({
        handler: "handleDeleteKey",
        label: "Delete Mode",
        description: "Hide elements under the cursor",
        details: "Toggles Delete Mode: hover elements and remove (hide) them from the page so you can declutter layouts. Exit with Exit Focus or by toggling again.",
        keyboardClass: "key-delete",
        row: 2
      }),
      COLS_TOGGLE: Object.freeze({
        handler: "handleColsToggleKey",
        label: "Cols Toggle",
        description: "Multi-column layout under cursor",
        details: "Columnizes the element under the cursor into a multi-column layout so dense text or lists are easier to scan. Toggle again to restore the original layout.",
        keyboardClass: "key-highlight",
        row: 3
      }),
      TAB_LEFT: Object.freeze({
        handler: "handleTabLeftKey",
        label: "Tab Left",
        description: "Switch to the previous tab",
        details: "Activates the tab to the left of the current one in the window\u2019s tab strip.",
        keyboardClass: "key-browser-chrome",
        row: 1
      }),
      TAB_RIGHT: Object.freeze({
        handler: "handleTabRightKey",
        label: "Tab Right",
        description: "Switch to the next tab",
        details: "Activates the tab to the right of the current one in the window\u2019s tab strip.",
        keyboardClass: "key-browser-chrome",
        row: 1
      }),
      ROOT: Object.freeze({
        handler: "handleRootKey",
        label: "Go to Site Root",
        description: "Navigate to the site origin",
        details: "Jumps to the site root (scheme + host) of the current page \u2014 useful for escaping deep paths without typing a URL.",
        keyboardClass: "key-open-urls",
        row: 2
      }),
      LAUNCHER: Object.freeze({
        handler: "handleLauncherKey",
        label: "Launcher",
        description: "Quick-access site launcher",
        details: "Opens the Launcher popover for jumping to favorite or configured sites without using the omnibox.",
        keyboardClass: "key-kp-ui",
        row: 2
      }),
      TOP_SITES: Object.freeze({
        handler: "handleTopSitesKey",
        label: "Top Sites",
        description: "Toolbar, visits, and bookmarks",
        details: "Opens Top Sites: a quick list drawn from the toolbar, most-visited pages, and recent bookmarks so you can open a frequent destination in one step.",
        keyboardClass: "key-kp-ui",
        row: 2
      }),
      CLOSE_TAB: Object.freeze({
        handler: "handleCloseTabKey",
        label: "Close Tab",
        description: "Close the current tab",
        details: "Closes the active tab. Behavior matches the browser\u2019s close-tab action for the current window.",
        keyboardClass: "key-close-tab",
        row: 3
      }),
      CLOSE_WINDOW: Object.freeze({
        handler: "handleCloseWindowKey",
        label: "Close Window",
        description: "Close the current window",
        details: "Closes the browser window that contains the current tab, including its other tabs.",
        keyboardClass: "key-close-tab",
        row: 3
      }),
      CANCEL: Object.freeze({
        handler: "cancelModes",
        label: "Exit Focus",
        description: "Leave modes and overlays",
        details: "Cancels the current KeyPilot mode or overlay (Delete Mode, Scroll Line, text focus helpers, and similar) and returns to normal browsing.",
        keyboardClass: "key-gray",
        row: null
      }),
      PAGE_UP_INSTANT: Object.freeze({
        handler: "handleInstantPageUp",
        label: "Page Up",
        description: "Jump one page up instantly",
        details: "Scrolls the current scroll target up by roughly one viewport without animation \u2014 faster than a smooth page-up when you need to move quickly.",
        keyboardClass: "key-page-scroll",
        row: 3
      }),
      PAGE_DOWN_INSTANT: Object.freeze({
        handler: "handleInstantPageDown",
        label: "Page Down",
        description: "Jump one page down instantly",
        details: "Scrolls the current scroll target down by roughly one viewport without animation \u2014 faster than a smooth page-down when you need to move quickly.",
        keyboardClass: "key-page-scroll",
        row: 3
      }),
      PAGE_TOP: Object.freeze({
        handler: "handlePageTop",
        label: "Scroll To Top",
        description: "Jump to top of scroll target",
        details: "Moves to the top of the current scroll target. Fade mode hides the jump; Scroll mode animates. Configure the motion style in Settings \u2192 Scrolling.",
        keyboardClass: "key-page-scroll",
        row: 3
      }),
      PAGE_BOTTOM: Object.freeze({
        handler: "handlePageBottom",
        label: "Scroll To Bottom",
        description: "Jump to bottom of scroll target",
        details: "Moves to the bottom of the current scroll target. Fade mode hides the jump; Scroll mode animates. Configure the motion style in Settings \u2192 Scrolling.",
        keyboardClass: "key-page-scroll",
        row: 3
      }),
      SCROLL_LINE: Object.freeze({
        handler: "handleScrollLineKey",
        label: "Scroll Line",
        description: "Origin-based continuous scroll",
        details: "Scrolls from a fixed origin: move the mouse away from the on-screen dot to scroll faster in that direction. Optionally enable middle-click on empty page area under Settings \u2192 Scrolling.",
        keyboardClass: "key-page-scroll",
        row: 3,
        mode: "scroll_line",
        cancelOnPointerDown: true,
        pointerBinding: Object.freeze({
          button: "middle",
          yieldToClickables: true,
          yieldToTextEntry: true,
          yieldToModes: Object.freeze(["text_focus", "popover", "omnibox"]),
          enabledSetting: "scroll.middleClickScrollLine"
        })
      }),
      ZOOM_OUT: Object.freeze({
        handler: "handleZoomOutKey",
        label: "Zoom Out",
        description: "Zoom the page out at the cursor",
        details: "Zooms the tab out one browser zoom step and keeps the point under the cursor fixed, the same as a pinch-out gesture.",
        keyboardClass: "key-browser-chrome",
        row: 1
      }),
      ZOOM_IN: Object.freeze({
        handler: "handleZoomInKey",
        label: "Zoom In",
        description: "Zoom the page in at the cursor",
        details: "Zooms the tab in one browser zoom step and keeps the point under the cursor fixed, the same as a pinch-in gesture.",
        keyboardClass: "key-browser-chrome",
        row: 1
      }),
      NEW_TAB: Object.freeze({
        handler: "handleNewTabKey",
        label: "New Tab",
        description: "Open the KeyPilot new tab",
        details: "Opens a KeyPilot new tab with your bookmarks bar, top sites, and search. The browser\u2019s own new tab stays unchanged.",
        keyboardClass: "key-browser-chrome",
        row: 1
      }),
      OPEN_POPOVER: Object.freeze({
        handler: "handleOpenPopover",
        label: "Open Popover",
        description: "Open link in a popup window",
        details: "Opens the hovered link in a KeyPilot popup window so you can peek or work in a separate chrome without a full new tab.",
        keyboardClass: "key-open-popover",
        row: 2
      }),
      PREVIEW_LINK_POPOVER: Object.freeze({
        handler: "handlePreviewLinkPopover",
        label: "Preview Link",
        description: "Preview link in a popup",
        details: "Opens Link Preview for the hovered URL in a popup window \u2014 skim the destination without committing a full navigation in the main tab.",
        keyboardClass: "key-preview-popover",
        row: 2
      }),
      POI_WEBSITE: Object.freeze({
        handler: "handlePoiWebsiteKey",
        label: "POI Website",
        description: "Open map place website",
        details: "When a map place (POI) is under the cursor, opens that place\u2019s website in Link Preview so you can visit the business or location page without leaving the map.",
        keyboardClass: "key-preview-popover",
        row: null
      }),
      POI_ADDRESS: Object.freeze({
        handler: "handlePoiAddressKey",
        label: "POI Address",
        description: "Copy map place address",
        details: "When a map place (POI) is under the cursor, copies its street address to the clipboard for pasting into directions, notes, or forms.",
        keyboardClass: "key-page-media",
        row: null
      }),
      OPEN_SETTINGS_POPOVER: Object.freeze({
        handler: "handleToggleSettingsPopover",
        label: "Settings",
        description: "Open KeyPilot Settings",
        details: "Opens or closes the KeyPilot Settings popover for themes, scrolling, click mode, layouts, and other preferences.",
        keyboardClass: "key-kp-ui",
        row: null
      }),
      OMNIBOX: Object.freeze({
        handler: "handleOpenOmnibox",
        label: "Omnibox",
        description: "Address bar overlay",
        details: "Opens KeyPilot\u2019s omnibox overlay so you can type a URL or search without clicking the browser address bar.",
        keyboardClass: "key-kp-ui",
        row: 2
      }),
      TAB_HISTORY: Object.freeze({
        handler: "handleToggleTabHistoryPopover",
        label: "Tab History",
        description: "Browse this tab\u2019s history",
        details: "Opens Tab History for the current tab so you can jump to a previously visited page in this tab\u2019s session without using the browser\u2019s native history UI.",
        keyboardClass: "key-kp-ui",
        row: 2
      }),
      TABS_OVERVIEW: Object.freeze({
        handler: "handleToggleTabsOverview",
        label: "Tabs Overview",
        description: "Show every window and tab",
        details: "Opens an overlay of every browser window with its tabs listed inside. Key-click a tab to switch to it, or key-click a window header to focus that window and keep its active tab. The current window is listed first, and the current tab is highlighted.",
        keyboardClass: "key-kp-ui",
        row: 3
      }),
      TOGGLE_KEYBOARD_HELP: Object.freeze({
        handler: "handleToggleKeyboardHelp",
        label: "KB Reference",
        description: "Show or hide the keyboard map",
        details: "Toggles the floating Keyboard Reference window that shows your current layout\u2019s keycaps and bindings.",
        keyboardClass: "key-kp-ui",
        row: 2
      }),
      // Text select: default character-level (H on right-handed layout).
      HIGHLIGHT: Object.freeze({
        handler: "handleHighlightKey",
        label: "Text Select",
        description: "Select text and copy rich text",
        details: "Enters character-level text selection under the cursor. By default, the selection is copied as rich text so formatting is preserved when you paste.",
        keyboardClass: "key-highlight",
        row: 2
      }),
      // Rectangle region select (Y on right-handed; Q on left-handed — R is Lookup Word).
      RECTANGLE_HIGHLIGHT: Object.freeze({
        handler: "handleRectangleHighlightKey",
        label: "Element Select",
        description: "Rectangle or cumulative element pick",
        details: "Selects HTML elements that intersect a dragged rectangle, or pick elements cumulatively. Useful for grabbing structure (not just plain text) from a page region.",
        keyboardClass: "key-rect-highlight",
        row: 1
      }),
      // Copy image under cursor — Clipboard category (I on right-handed; E on left-handed — I is READER_MODE there).
      COPY_HOVERED_IMAGE: Object.freeze({
        handler: "handleCopyHoveredImageKey",
        label: "Copy Image",
        description: "Copy hovered image",
        details: "Copies the image under the cursor to the clipboard, Media Library, or both \u2014 configure the destination on the action. Prefer this when you want the image bytes or a saved library entry, not just a URL.",
        keyboardClass: "key-page-media",
        row: 1
      }),
      // Copy hyperlink under cursor — Clipboard category; Actions Library only (no built-in layout key).
      COPY_HOVERED_URL: Object.freeze({
        handler: "handleCopyHoveredUrlKey",
        label: "Copy URL",
        description: "Copy hovered link URL",
        details: "Copies the URL under the cursor to the clipboard, Media Library, or both. Use this when you need the href itself rather than fetching or opening the resource. No default layout key \u2014 bind it in Layout Editor if you need it.",
        keyboardClass: "key-page-media",
        row: null
      }),
      // Dictionary for the word under the cursor (U on right-handed; R on left-handed, the KeyU mirror).
      LOOKUP_WORD: Object.freeze({
        handler: "handleLookupWordKey",
        label: "Lookup Word",
        description: "Look up the word under the cursor",
        details: "Opens a Wiktionary popover for the word directly under the cursor. Shows a brief notice if there is no word there.",
        keyboardClass: "key-page-media",
        row: 1
      }),
      // Copy video under cursor — Clipboard category; Actions Library only (no built-in layout key).
      COPY_HOVERED_VIDEO: Object.freeze({
        handler: "handleCopyHoveredVideoKey",
        label: "Copy Video",
        description: "Copy hovered video",
        details: "Copies the video under the cursor (file bytes to Media Library when fetchable, or the video URL to the clipboard). No default layout key \u2014 bind it in Layout Editor if you need it.",
        keyboardClass: "key-page-media",
        row: null
      }),
      // Font under cursor — Actions Library only (no built-in layout key).
      FONT_INFO: Object.freeze({
        handler: "handleFontInfoKey",
        label: "Font Info",
        description: "Inspect font under the cursor",
        details: "Shows a popover with the font name, size, family, file type, and resource URL for the styled text under the cursor, and outlines that text run. No default layout key \u2014 bind it in Layout Editor if you need it.",
        keyboardClass: "key-page-media",
        row: null
      }),
      // Page-wide Image / Video / Text gallery (O on right-handed; O is TAB_RIGHT on left-handed).
      PAGE_MEDIA: Object.freeze({
        handler: "handlePageMediaKey",
        label: "Page Media",
        description: "Browse media found on this page",
        details: "Opens a gallery of images, videos, documents, fonts, and URLs discovered on the current page so you can review or collect them without hunting through the DOM.",
        keyboardClass: "key-page-media",
        row: 1
      }),
      READER_MODE: Object.freeze({
        handler: "handleReaderModeKey",
        label: "Reader Mode",
        description: "Read this page without clutter",
        details: "Opens a KeyPilot overlay with the article text (or your current selection). Press again or Esc to close. Unavailable on pages with no extractable article.",
        keyboardClass: "key-reader-mode",
        row: 1
      }),
      // Media Library entry point (M on right-handed only — M is PAGE_DOWN_INSTANT on left-handed,
      // so this doesn't get a default binding there yet).
      OPEN_MEDIA_LIBRARY: Object.freeze({
        handler: "handleOpenMediaLibraryKey",
        label: "Media Library",
        description: "Open saved Media Library",
        details: "Opens the Media Library where items you previously copied or saved (images, videos, URLs, and related assets) are kept for reuse.",
        keyboardClass: "key-media-library",
        row: 1
      }),
      // Clipboard commands (Functions palette — Clipboard category).
      CLIPBOARD_COPY: Object.freeze({
        handler: "handleClipboardCopyKey",
        label: "Copy",
        description: "Copy selection to clipboard",
        details: "Copies the current text selection to the system clipboard. Prefer this over OS shortcuts when you want Copy available as a KeyPilot layout binding.",
        keyboardClass: "key-clipboard",
        row: null
      }),
      CLIPBOARD_CUT: Object.freeze({
        handler: "handleClipboardCutKey",
        label: "Cut",
        description: "Cut selection to clipboard",
        details: "Cuts the current text selection to the system clipboard from the focused field or editable region.",
        keyboardClass: "key-clipboard",
        row: null
      }),
      CLIPBOARD_PASTE: Object.freeze({
        handler: "handleClipboardPasteKey",
        label: "Paste",
        description: "Paste into the focused field",
        details: "Pastes clipboard text into the focused text field or editable element. Bind with a modifier chord if you need it while typing.",
        keyboardClass: "key-clipboard",
        row: null
      }),
      CLIPBOARD_SELECT_ALL: Object.freeze({
        handler: "handleClipboardSelectAllKey",
        label: "Select All",
        description: "Select all in field or page",
        details: "Selects all text in the focused field, or the page content when nothing editable is focused \u2014 same idea as the usual Select All shortcut.",
        keyboardClass: "key-clipboard",
        row: null
      }),
      SELECT_WORD: Object.freeze({
        handler: "handleSelectWordKey",
        label: "Select Word",
        description: "Select the word under the cursor",
        details: "Selects the word under the KeyPilot cursor. Press again over the same word to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key). Copy reads this selection.",
        keyboardClass: "key-highlight",
        row: null
      }),
      SELECT_SENTENCE: Object.freeze({
        handler: "handleSelectSentenceKey",
        label: "Select Sentence",
        description: "Select the sentence under the cursor",
        details: "Selects the sentence under the KeyPilot cursor. Press again over the same sentence to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key).",
        keyboardClass: "key-highlight",
        row: null
      }),
      SELECT_PARAGRAPH: Object.freeze({
        handler: "handleSelectParagraphKey",
        label: "Select Paragraph",
        description: "Select the paragraph under the cursor",
        details: "Selects the paragraph (or nearest block) under the KeyPilot cursor. Press again over the same block to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key).",
        keyboardClass: "key-highlight",
        row: null
      }),
      SELECT_IMAGE: Object.freeze({
        handler: "handleSelectImageKey",
        label: "Select Image",
        description: "Select the image under the cursor",
        details: "Selects the image under the KeyPilot cursor. Press again over the same image to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key). Copy can copy selected images.",
        keyboardClass: "key-highlight",
        row: null
      }),
      // AI (Functions palette — AI category).
      SEND_TEXT_TO_AI: Object.freeze({
        handler: "handleSendTextToAiKey",
        label: "Send Text To AI",
        description: "Run AI on selected text",
        details: "Sends the selected text to AI with a configurable instruction, then routes the result to the clipboard and/or a popover. Configure the prompt and destination on the action instance.",
        keyboardClass: "key-purple",
        row: null
      })
    });
    KEYBINDING_ACTION_CATEGORY_BY_ID = Object.freeze({
      // Navigation — click / link preview / history
      ACTIVATE: "Navigation",
      ACTIVATE_DEFERRED_RANDOM: "Deferred Open URLs",
      ACTIVATE_DEFERRED_SCHEDULED: "Deferred Open URLs",
      SCHEDULE_LINK_MANUAL: "Deferred Open URLs",
      ACTIVATE_NEW_TAB: "Navigation",
      ACTIVATE_NEW_TAB_BACKGROUND: "Navigation",
      PREVIEW_LINK_POPOVER: "Navigation",
      POI_WEBSITE: "Maps",
      POI_ADDRESS: "Maps",
      OPEN_POPOVER: "Navigation",
      FORWARD: "Navigation",
      BACK: "Navigation",
      BACK2: "Navigation",
      ROOT: "Navigation",
      // Tab Control
      CLOSE_TAB: "Tab Control",
      CLOSE_WINDOW: "Tab Control",
      TAB_LEFT: "Tab Control",
      TAB_RIGHT: "Tab Control",
      NEW_TAB: "Tab Control",
      TAB_HISTORY: "Tab Control",
      TABS_OVERVIEW: "Tab Control",
      PAGE_UP_INSTANT: "Scroll",
      PAGE_DOWN_INSTANT: "Scroll",
      PAGE_TOP: "Scroll",
      PAGE_BOTTOM: "Scroll",
      SCROLL_LINE: "Scroll",
      ZOOM_OUT: "Scroll",
      ZOOM_IN: "Scroll",
      HIGHLIGHT: "Get Page Data",
      RECTANGLE_HIGHLIGHT: "Get Page Data",
      FONT_INFO: "Get Page Data",
      LOOKUP_WORD: "Lookup",
      PAGE_MEDIA: "Get Page Data",
      READER_MODE: "Get Page Data",
      DELETE: "Select",
      COLS_TOGGLE: "Select",
      OPEN_MEDIA_LIBRARY: "Media Library",
      CLIPBOARD_COPY: "Clipboard",
      CLIPBOARD_CUT: "Clipboard",
      CLIPBOARD_PASTE: "Clipboard",
      CLIPBOARD_SELECT_ALL: "Clipboard",
      COPY_HOVERED_IMAGE: "Clipboard",
      COPY_HOVERED_URL: "Clipboard",
      COPY_HOVERED_VIDEO: "Clipboard",
      SELECT_WORD: "Clipboard",
      SELECT_SENTENCE: "Clipboard",
      SELECT_PARAGRAPH: "Clipboard",
      SELECT_IMAGE: "Clipboard",
      SEND_TEXT_TO_AI: "AI",
      LAUNCHER: "Begin URL",
      TOP_SITES: "Begin URL",
      OMNIBOX: "Begin URL",
      TOGGLE_KEYBOARD_HELP: "KeyPilot",
      OPEN_SETTINGS_POPOVER: "KeyPilot",
      CANCEL: "System"
    });
    KEYBINDING_ACTION_CATEGORY_ORDER = Object.freeze([
      "Navigation",
      "Deferred Open URLs",
      "Tab Control",
      "Begin URL",
      "Get Page Data",
      "Maps",
      "Scroll",
      "Select",
      "Media Library",
      "Clipboard",
      "Lookup",
      "AI",
      "KeyPilot",
      "Tools",
      "System",
      "Other"
    ]);
    DEFERRED_NUMBER_ROW_ASSIGNMENTS = Object.freeze({
      ACTIVATE_DEFERRED_RANDOM: physicalAssignment("Digit1", "1"),
      ACTIVATE_DEFERRED_SCHEDULED: physicalAssignment("Digit2", "2"),
      SCHEDULE_LINK_MANUAL: physicalAssignment("Digit4", "4")
    });
    CATALOG_KEYBINDINGS = (() => {
      const out = {};
      for (const [actionId, def] of Object.entries(KEYBINDING_ACTION_DEFS)) {
        if (isBuildExcludedKeyAction(actionId)) continue;
        const copy = localizedActionCopy(actionId, def);
        out[actionId] = Object.freeze({
          keys: Object.freeze([]),
          handler: def.handler,
          label: copy.label,
          description: copy.description,
          keyboardClass: def.keyboardClass ?? null,
          row: def.row ?? null,
          displayKey: "",
          keyLabel: ""
        });
      }
      return Object.freeze(out);
    })();
    ASSIGNMENTS_BROWSING_RIGHT = Object.freeze({
      TAB_LEFT: physicalAssignment("KeyQ", "Q"),
      TAB_RIGHT: physicalAssignment("KeyW", "W"),
      READER_MODE: physicalAssignment("KeyP", "P"),
      PREVIEW_LINK_POPOVER: physicalAssignment("KeyE", "E"),
      FORWARD: physicalAssignment("KeyR", "R"),
      NEW_TAB: physicalAssignment("KeyT", "T"),
      CLOSE_TAB: physicalAssignment("KeyA", "A"),
      ROOT: physicalAssignment("KeyS", "S"),
      BACK: physicalAssignment("KeyD", "D"),
      ACTIVATE: physicalAssignment("KeyF", "F"),
      ACTIVATE_NEW_TAB_BACKGROUND: physicalAssignment("KeyG", "G"),
      HIGHLIGHT: physicalAssignment("KeyH", "H"),
      TAB_HISTORY: physicalAssignment("KeyJ", "J"),
      OMNIBOX: physicalAssignment("KeyL", "L"),
      TOP_SITES: physicalAssignment("Semicolon", ";"),
      PAGE_TOP: physicalAssignment("KeyZ", "Z"),
      PAGE_BOTTOM: physicalAssignment("KeyX", "X"),
      PAGE_UP_INSTANT: physicalAssignment("KeyC", "C"),
      PAGE_DOWN_INSTANT: physicalAssignment("KeyV", "V"),
      SCROLL_LINE: physicalAssignment("KeyB", "B"),
      ZOOM_OUT: physicalAssignment("BracketLeft", "["),
      ZOOM_IN: physicalAssignment("BracketRight", "]"),
      ACTIVATE_NEW_TAB: physicalAssignment("KeyN", "N"),
      RECTANGLE_HIGHLIGHT: physicalAssignment("KeyY", "Y"),
      COPY_HOVERED_IMAGE: physicalAssignment("KeyI", "I"),
      LOOKUP_WORD: physicalAssignment("KeyU", "U"),
      PAGE_MEDIA: physicalAssignment("KeyO", "O"),
      // M is otherwise unused on the right-handed layout (it's PAGE_DOWN_INSTANT on left-handed).
      OPEN_MEDIA_LIBRARY: physicalAssignment("KeyM", "M"),
      // Period mirrors to KeyX on the left-handed layout.
      [STOCK_SOCIAL_MEDIA_ACTION_ID]: physicalAssignment("Period", "."),
      // Comma is free on the right-handed layout. Left-handed mirror is KeyC.
      [STOCK_RANDOM_BOOKMARK_ACTION_ID]: physicalAssignment("Comma", ","),
      DELETE: physicalAssignment("Backspace", "Backspace"),
      // COLS_TOGGLE omitted — see BUILD_EXCLUDED_KEY_ACTIONS
      // Slash mirrors to KeyZ on the left-handed layout.
      TABS_OVERVIEW: physicalAssignment("Slash", "/")
    });
    ASSIGNMENTS_BROWSING_LEFT = Object.freeze({
      // Top row cluster: Q W E R T  ->  P O I U Y (mirrored)
      TAB_LEFT: physicalAssignment("KeyP", "P"),
      TAB_RIGHT: physicalAssignment("KeyO", "O"),
      PREVIEW_LINK_POPOVER: physicalAssignment("KeyW", "W"),
      FORWARD: physicalAssignment("KeyU", "U"),
      READER_MODE: physicalAssignment("KeyI", "I"),
      NEW_TAB: physicalAssignment("KeyY", "Y"),
      SCROLL_LINE: physicalAssignment("KeyT", "T"),
      ZOOM_OUT: physicalAssignment("BracketLeft", "["),
      ZOOM_IN: physicalAssignment("BracketRight", "]"),
      // Home row cluster: A S D F G  ->  ; L K J H (mirrored-ish around center)
      CLOSE_TAB: physicalAssignment("Semicolon", ";"),
      ROOT: physicalAssignment("KeyL", "L"),
      BACK: physicalAssignment("KeyK", "K"),
      ACTIVATE: physicalAssignment("KeyJ", "J"),
      ACTIVATE_NEW_TAB_BACKGROUND: physicalAssignment("KeyH", "H"),
      // H is background-tab open on left; G is text select.
      HIGHLIGHT: physicalAssignment("KeyG", "G"),
      // Mirror of right-handed KeyU (Lookup Word). Rectangle moves to KeyQ (free on left).
      LOOKUP_WORD: physicalAssignment("KeyR", "R"),
      RECTANGLE_HIGHLIGHT: physicalAssignment("KeyQ", "Q"),
      // Utility actions on the left avoid colliding with J/K/L cluster.
      // (KB Reference / Settings / Esc live in the system layer, not layout assignments.)
      TAB_HISTORY: physicalAssignment("KeyF", "F"),
      OMNIBOX: physicalAssignment("KeyS", "S"),
      TOP_SITES: physicalAssignment("KeyA", "A"),
      // Bottom row cluster: Z X C V B  ->  / . , M N (mirrored)
      // Mirror of right-handed Period.
      [STOCK_SOCIAL_MEDIA_ACTION_ID]: physicalAssignment("KeyX", "X"),
      PAGE_TOP: physicalAssignment("Slash", "/"),
      ACTIVATE_NEW_TAB: physicalAssignment("KeyB", "B"),
      PAGE_UP_INSTANT: physicalAssignment("Comma", ","),
      // Mirror of right-handed Comma. KeyC is free here (PAGE_UP sits on Comma).
      [STOCK_RANDOM_BOOKMARK_ACTION_ID]: physicalAssignment("KeyC", "C"),
      PAGE_DOWN_INSTANT: physicalAssignment("KeyM", "M"),
      PAGE_BOTTOM: physicalAssignment("KeyN", "N"),
      // I is READER_MODE on left-handed; E is free.
      COPY_HOVERED_IMAGE: physicalAssignment("KeyE", "E"),
      // COLS_TOGGLE omitted — see BUILD_EXCLUDED_KEY_ACTIONS
      DELETE: physicalAssignment("Backspace", "Backspace"),
      // Mirror of right-handed Slash. KeyZ is free here (PAGE_TOP sits on Slash).
      TABS_OVERVIEW: physicalAssignment("KeyZ", "Z")
    });
    SYSTEM_LAYER_ACTION_IDS = Object.freeze([
      "CANCEL",
      "TOGGLE_KEYBOARD_HELP",
      "OPEN_SETTINGS_POPOVER"
    ]);
    SYSTEM_LAYER_ASSIGNMENTS_RIGHT = Object.freeze({
      CANCEL: physicalAssignment("Escape", "Esc"),
      TOGGLE_KEYBOARD_HELP: physicalAssignment("KeyK", "K"),
      OPEN_SETTINGS_POPOVER: physicalAssignment("Quote", "'")
    });
    SYSTEM_LAYER_ASSIGNMENTS_LEFT = Object.freeze({
      CANCEL: physicalAssignment("Escape", "Esc"),
      TOGGLE_KEYBOARD_HELP: physicalAssignment("KeyD", "D"),
      OPEN_SETTINGS_POPOVER: physicalAssignment("Quote", "'")
    });
    BASIC_NAVIGATION_ACTION_IDS = Object.freeze([
      "ACTIVATE",
      "TAB_LEFT",
      "TAB_RIGHT",
      "FORWARD",
      "BACK",
      "ROOT",
      "PAGE_TOP",
      "PAGE_BOTTOM",
      "PAGE_UP_INSTANT",
      "PAGE_DOWN_INSTANT"
    ]);
    CLICK_HISTORY_ACTION_IDS = Object.freeze([
      "ACTIVATE",
      "BACK",
      "ROOT",
      "FORWARD"
    ]);
    BASIC_NAVIGATION_UI_ACTION_IDS = Object.freeze([
      ...BASIC_NAVIGATION_ACTION_IDS,
      ...SYSTEM_LAYER_ACTION_IDS
    ]);
    CLICK_HISTORY_UI_ACTION_IDS = Object.freeze([
      ...CLICK_HISTORY_ACTION_IDS,
      ...SYSTEM_LAYER_ACTION_IDS
    ]);
    ASSIGNMENTS_BASIC_NAVIGATION_RIGHT = pickAssignments(ASSIGNMENTS_BROWSING_RIGHT, BASIC_NAVIGATION_ACTION_IDS);
    ASSIGNMENTS_BASIC_NAVIGATION_LEFT = pickAssignments(ASSIGNMENTS_BROWSING_LEFT, BASIC_NAVIGATION_ACTION_IDS);
    ASSIGNMENTS_CLICK_HISTORY_RIGHT = pickAssignments(ASSIGNMENTS_BROWSING_RIGHT, CLICK_HISTORY_ACTION_IDS);
    ASSIGNMENTS_CLICK_HISTORY_LEFT = pickAssignments(ASSIGNMENTS_BROWSING_LEFT, CLICK_HISTORY_ACTION_IDS);
    KEYBOARD_UI_LAYOUT_RIGHT = Object.freeze([
      [
        { type: "special", text: "Tab", className: "key key-tab" },
        { type: "action", id: "TAB_LEFT", fallbackText: "Tab Left" },
        { type: "action", id: "TAB_RIGHT", fallbackText: "Tab Right" },
        { type: "action", id: "PREVIEW_LINK_POPOVER", fallbackText: "Preview Link" },
        { type: "action", id: "FORWARD", fallbackText: "Go Forward" },
        { type: "action", id: "NEW_TAB", fallbackText: "New Tab" },
        { type: "action", id: "RECTANGLE_HIGHLIGHT", fallbackText: "Rectangle Select" },
        { type: "action", id: "LOOKUP_WORD", fallbackText: "Lookup Word" },
        { type: "action", id: "COPY_HOVERED_IMAGE", fallbackText: "Copy Image" },
        { type: "action", id: "PAGE_MEDIA", fallbackText: "Page Media" },
        { type: "action", id: "READER_MODE", fallbackText: "Reader Mode" },
        { type: "key", text: "[" },
        { type: "key", text: "]" },
        { type: "action", id: "DELETE", fallbackText: "Delete Mode", className: "key key-backspace" }
      ],
      [
        { type: "special", text: "Caps", className: "key key-caps" },
        { type: "action", id: "CLOSE_TAB", fallbackText: "Close Tab" },
        { type: "action", id: "ROOT", fallbackText: "Go to Site Root" },
        { type: "action", id: "BACK", fallbackText: "Go Back" },
        { type: "action", id: "ACTIVATE", fallbackText: "Click Element" },
        { type: "action", id: "ACTIVATE_NEW_TAB_BACKGROUND", fallbackText: "Click New Tab Background" },
        { type: "action", id: "HIGHLIGHT", fallbackText: "Text Select" },
        { type: "action", id: "TAB_HISTORY", fallbackText: "History" },
        { type: "action", id: "TOGGLE_KEYBOARD_HELP", fallbackText: "KB Reference" },
        { type: "action", id: "OMNIBOX", fallbackText: "Omnibox" },
        { type: "action", id: "TOP_SITES", fallbackText: "Top Sites" },
        { type: "action", id: "OPEN_SETTINGS_POPOVER", fallbackText: "Settings" },
        { type: "special", text: "Enter", className: "key key-enter" }
      ],
      [
        { type: "special", text: "Shift", className: "key key-shift" },
        { type: "action", id: "PAGE_TOP", fallbackText: "Scroll To Top" },
        { type: "action", id: "PAGE_BOTTOM", fallbackText: "Scroll To Bottom" },
        { type: "action", id: "PAGE_UP_INSTANT", fallbackText: "Page Up" },
        { type: "action", id: "PAGE_DOWN_INSTANT", fallbackText: "Page Down" },
        { type: "action", id: "SCROLL_LINE", fallbackText: "Scroll Line" },
        { type: "action", id: "ACTIVATE_NEW_TAB", fallbackText: "Click New Tab" },
        { type: "action", id: "OPEN_MEDIA_LIBRARY", fallbackText: "Media Library" },
        { type: "action", id: STOCK_RANDOM_BOOKMARK_ACTION_ID, fallbackText: "Random Bookmark" },
        { type: "action", id: STOCK_SOCIAL_MEDIA_ACTION_ID, fallbackText: "Social media" },
        { type: "action", id: "TABS_OVERVIEW", fallbackText: "Tabs Overview" },
        { type: "special", text: "Shift", className: "key key-shift" }
      ]
    ]);
    KEYBOARD_UI_LAYOUT_LEFT = Object.freeze([
      [
        { type: "special", text: "Tab", className: "key key-tab" },
        { type: "action", id: "RECTANGLE_HIGHLIGHT", fallbackText: "Rectangle Select" },
        // Q (Y's true mirror is T)
        { type: "action", id: "PREVIEW_LINK_POPOVER", fallbackText: "Preview Link" },
        // W
        { type: "action", id: "COPY_HOVERED_IMAGE", fallbackText: "Copy Image" },
        // E
        { type: "action", id: "LOOKUP_WORD", fallbackText: "Lookup Word" },
        // R, mirror of U
        { type: "action", id: "SCROLL_LINE", fallbackText: "Scroll Line" },
        // T
        { type: "action", id: "NEW_TAB", fallbackText: "New Tab" },
        // Y
        { type: "action", id: "FORWARD", fallbackText: "Go Forward" },
        // U
        { type: "action", id: "READER_MODE", fallbackText: "Reader Mode" },
        // I
        { type: "action", id: "TAB_RIGHT", fallbackText: "Tab Right" },
        // O
        { type: "action", id: "TAB_LEFT", fallbackText: "Tab Left" },
        // P
        { type: "key", text: "[" },
        { type: "key", text: "]" },
        { type: "action", id: "DELETE", fallbackText: "Delete Mode", className: "key key-backspace" }
      ],
      [
        { type: "special", text: "Caps", className: "key key-caps" },
        { type: "action", id: "TOP_SITES", fallbackText: "Top Sites" },
        // Utility keys on the left (to avoid colliding with right-hand cluster)
        { type: "action", id: "OMNIBOX", fallbackText: "Omnibox" },
        // S
        { type: "action", id: "TOGGLE_KEYBOARD_HELP", fallbackText: "KB Reference" },
        // D
        { type: "action", id: "TAB_HISTORY", fallbackText: "History" },
        // F
        { type: "action", id: "HIGHLIGHT", fallbackText: "Text Select" },
        // G
        { type: "action", id: "ACTIVATE_NEW_TAB_BACKGROUND", fallbackText: "Click New Tab Background" },
        // H
        { type: "action", id: "ACTIVATE", fallbackText: "Click Element" },
        // J
        { type: "action", id: "BACK", fallbackText: "Go Back" },
        // K
        { type: "action", id: "ROOT", fallbackText: "Go to Site Root" },
        // L
        { type: "action", id: "CLOSE_TAB", fallbackText: "Close Tab" },
        // ;
        { type: "action", id: "OPEN_SETTINGS_POPOVER", fallbackText: "Settings" },
        // '
        { type: "special", text: "Enter", className: "key key-enter" }
      ],
      [
        { type: "special", text: "Shift", className: "key key-shift" },
        { type: "action", id: "TABS_OVERVIEW", fallbackText: "Tabs Overview" },
        // Z, mirror of /
        { type: "action", id: STOCK_SOCIAL_MEDIA_ACTION_ID, fallbackText: "Social media" },
        // X, mirror of .
        { type: "action", id: STOCK_RANDOM_BOOKMARK_ACTION_ID, fallbackText: "Random Bookmark" },
        // C, mirror of ,
        { type: "key", text: "V" },
        { type: "action", id: "ACTIVATE_NEW_TAB", fallbackText: "Click New Tab" },
        // B
        { type: "action", id: "PAGE_BOTTOM", fallbackText: "Scroll To Bottom" },
        // N
        { type: "action", id: "PAGE_DOWN_INSTANT", fallbackText: "Page Down" },
        // M
        { type: "action", id: "PAGE_UP_INSTANT", fallbackText: "Page Up" },
        // ,
        { type: "key", text: "." },
        { type: "action", id: "PAGE_TOP", fallbackText: "Scroll To Top" },
        // /
        { type: "special", text: "Shift", className: "key key-shift" }
      ]
    ]);
    BUILTIN_KEYBOARD_LAYOUTS = Object.freeze({
      "browsing-right": Object.freeze({
        id: "browsing-right",
        label: "Browsing: right-handed",
        description: "Full browsing layout. Mouse: right hand. Shortcuts primarily on the left.",
        assignments: ASSIGNMENTS_BROWSING_RIGHT,
        keyboardLayout: KEYBOARD_UI_LAYOUT_RIGHT
      }),
      "browsing-left": Object.freeze({
        id: "browsing-left",
        label: "Browsing: left-handed",
        description: "Full browsing layout. Mouse: left hand. Shortcuts primarily on the right.",
        assignments: ASSIGNMENTS_BROWSING_LEFT,
        keyboardLayout: KEYBOARD_UI_LAYOUT_LEFT
      }),
      "basic-navigation-right": Object.freeze({
        id: "basic-navigation-right",
        label: "Basic Navigation: right-handed",
        description: "Page scroll, click, tab switch, back/forward only.",
        assignments: ASSIGNMENTS_BASIC_NAVIGATION_RIGHT,
        keyboardLayout: projectKeyboardUiLayout(
          KEYBOARD_UI_LAYOUT_RIGHT,
          { ...ASSIGNMENTS_BROWSING_RIGHT, ...SYSTEM_LAYER_ASSIGNMENTS_RIGHT },
          BASIC_NAVIGATION_UI_ACTION_IDS
        )
      }),
      "basic-navigation-left": Object.freeze({
        id: "basic-navigation-left",
        label: "Basic Navigation: left-handed",
        description: "Page scroll, click, tab switch, back/forward only.",
        assignments: ASSIGNMENTS_BASIC_NAVIGATION_LEFT,
        keyboardLayout: projectKeyboardUiLayout(
          KEYBOARD_UI_LAYOUT_LEFT,
          { ...ASSIGNMENTS_BROWSING_LEFT, ...SYSTEM_LAYER_ASSIGNMENTS_LEFT },
          BASIC_NAVIGATION_UI_ACTION_IDS
        )
      }),
      "click-history-right": Object.freeze({
        id: "click-history-right",
        label: "Navigation: right-handed",
        description: "Click element, go back, and go forward only.",
        assignments: ASSIGNMENTS_CLICK_HISTORY_RIGHT,
        keyboardLayout: projectKeyboardUiLayout(
          KEYBOARD_UI_LAYOUT_RIGHT,
          { ...ASSIGNMENTS_BROWSING_RIGHT, ...SYSTEM_LAYER_ASSIGNMENTS_RIGHT },
          CLICK_HISTORY_UI_ACTION_IDS
        )
      }),
      "click-history-left": Object.freeze({
        id: "click-history-left",
        label: "Navigation: left-handed",
        description: "Click element, go back, and go forward only.",
        assignments: ASSIGNMENTS_CLICK_HISTORY_LEFT,
        keyboardLayout: projectKeyboardUiLayout(
          KEYBOARD_UI_LAYOUT_LEFT,
          { ...ASSIGNMENTS_BROWSING_LEFT, ...SYSTEM_LAYER_ASSIGNMENTS_LEFT },
          CLICK_HISTORY_UI_ACTION_IDS
        )
      })
    });
  }
});

// src/config/constants.js
var KEYBINDINGS, SCROLL, INSPECTOR_KIND, ELEMENT_SELECT_AGGREGATES, ELEMENT_SELECT_LANDMARKS, ELEMENT_SELECT_ATOMS, ELEMENT_SELECT_FRAGMENTS, ELEMENT_SELECT_TAGS, CURSOR_MODE, COLORS;
var init_constants = __esm({
  "src/config/constants.js"() {
    init_keyboard_layouts();
    KEYBINDINGS = buildEffectiveKeybindings(DEFAULT_KEYBOARD_LAYOUT_ID, DEFAULT_KEYBOARD_HANDEDNESS);
    SCROLL = Object.freeze({
      /** Legacy large page step (popover parent→iframe PAGE_UP/DOWN path) */
      PAGE_PX: 800,
      /** C / V: smaller step (default = prior 400px × 1.25) */
      HALF_PAGE_PX: 500,
      /**
       * Hold C / V: continuous rAF scroll speed (px/s). Instant per-frame deltas —
       * not CSS smooth — so overlapping animations cannot jitter.
       */
      HOLD_PX_PER_SEC: 1400,
      /**
       * Delay before continuous rAF starts after the first keydown. Keeps a quick
       * tap as a single configured step; holding past this (or first OS repeat)
       * engages continuous motion.
       */
      HOLD_RAF_START_MS: 120,
      /** Default CSS scroll-behavior for keyboard scrolling */
      BEHAVIOR: "smooth",
      /** Blur-in duration for Scroll To Top / Bottom "Fade" jump style */
      EDGE_JUMP_BLUR_MS: 140,
      /** Opaque cover transition before the instant jump */
      EDGE_JUMP_COVER_MS: 90,
      /** Soft destination reveal duration after the jump */
      EDGE_JUMP_REVEAL_MS: 160,
      /** Clear the veil after the destination reveal */
      EDGE_JUMP_CLEAR_MS: 140,
      /**
       * After the instant jump, keep the veil opaque until scroll position is
       * stable (or this timeout). Covers CSS `scroll-behavior: smooth` and
       * Lenis-style hijacks that keep interpolating after scrollTo returns.
       */
      EDGE_JUMP_SETTLE_MS: 480,
      /** Scroll Line: no scroll inside this radius from the origin dot */
      LINE_DEADZONE_PX: 12,
      /**
       * Scroll Line: ease-in power. 1 = linear, 2 = quadratic (gentle near the
       * dot, ramps harder toward the edge of the range).
       */
      LINE_CURVE_EXPONENT: 1.75,
      /** Scroll Line: offset beyond the dead zone that maps to max speed */
      LINE_CURVE_RANGE_PX: 360,
      /** Scroll Line: cap on each axis */
      LINE_MAX_PX_PER_SEC: 2400
    });
    INSPECTOR_KIND = Object.freeze({
      DELETE: "delete",
      COLS: "cols",
      /** Cumulative element pick for Rectangle Select (Y) alternate mode */
      RECTANGLE_PICK: "rectangle_pick"
    });
    ELEMENT_SELECT_AGGREGATES = Object.freeze([
      "table",
      "figure",
      "picture",
      "ul",
      "ol",
      "dl"
    ]);
    ELEMENT_SELECT_LANDMARKS = Object.freeze([
      "article",
      "section",
      "aside",
      "header",
      "footer",
      "main",
      "nav"
    ]);
    ELEMENT_SELECT_ATOMS = Object.freeze([
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "blockquote",
      "pre",
      "li",
      "img",
      "video",
      "audio",
      "svg"
    ]);
    ELEMENT_SELECT_FRAGMENTS = Object.freeze([
      "a",
      "code",
      "label",
      "td",
      "th",
      "caption",
      "figcaption",
      "dt",
      "dd",
      "summary"
    ]);
    ELEMENT_SELECT_TAGS = Object.freeze([
      ...ELEMENT_SELECT_AGGREGATES,
      ...ELEMENT_SELECT_LANDMARKS,
      ...ELEMENT_SELECT_ATOMS,
      ...ELEMENT_SELECT_FRAGMENTS
    ]);
    CURSOR_MODE = Object.freeze({
      NO_CUSTOM_CURSORS: "NO-CUSTOM-CURSORS",
      CUSTOM_CURSORS: "CUSTOM-CURSORS"
    });
    COLORS = {
      // Primary cursor colors
      FOCUS_GREEN: "rgba(0,180,0,0.95)",
      FOCUS_GREEN_BRIGHT: "rgba(0,128,0,0.95)",
      DELETE_RED: "rgba(220,0,0,0.95)",
      /** Cols Toggle accent (purple, distinct from delete red / highlight blue) */
      COLS_PURPLE: "rgba(156,39,176,0.95)",
      COLS_PURPLE_BRIGHT: "rgba(186,104,200,0.95)",
      HIGHLIGHT_BLUE: "rgba(0,120,255,0.95)",
      ORANGE: "#ff8c00",
      // Focus overlay (alternate) colors (used to visually distinguish DOM-hover targeting mode)
      FOCUS_BLUE: "rgba(33,150,243,0.95)",
      // Text and background colors
      TEXT_WHITE_PRIMARY: "rgba(255,255,255,0.95)",
      TEXT_WHITE_SECONDARY: "rgba(255,255,255,0.8)",
      TEXT_GREEN_BRIGHT: "#6ced2b",
      // Background colors
      MESSAGE_BG_BROWN: "#ad6007",
      MESSAGE_BG_GREEN: "#10911b",
      // Border and shadow colors
      ORANGE_BORDER: "rgba(255,140,0,0.4)",
      ORANGE_SHADOW: "rgba(255,140,0,0.45)",
      ORANGE_SHADOW_DARK: "rgba(255,140,0,0.8)",
      ORANGE_SHADOW_LIGHT: "rgba(255,140,0,0.3)",
      GREEN_SHADOW: "rgba(0,180,0,0.45)",
      GREEN_SHADOW_BRIGHT: "rgba(0,180,0,0.5)",
      BLUE_SHADOW: "rgba(33,150,243,0.35)",
      BLUE_SHADOW_BRIGHT: "rgba(33,150,243,0.45)",
      DELETE_SHADOW: "rgba(220,0,0,0.35)",
      DELETE_SHADOW_BRIGHT: "rgba(220,0,0,0.45)",
      COLS_SHADOW: "rgba(156,39,176,0.35)",
      COLS_SHADOW_BRIGHT: "rgba(156,39,176,0.5)",
      HIGHLIGHT_SHADOW: "rgba(0,120,255,0.35)",
      HIGHLIGHT_SHADOW_BRIGHT: "rgba(0,120,255,0.45)",
      BLACK_SHADOW: "rgba(40, 40, 40, 0.7)",
      // Ripple effect colors
      RIPPLE_GREEN: "rgba(0,200,0,0.35)",
      RIPPLE_GREEN_MID: "rgba(0,200,0,0.22)",
      RIPPLE_GREEN_TRANSPARENT: "rgba(0,200,0,0)",
      // Flash animation colors
      FLASH_GREEN: "rgba(0,255,0,1)",
      FLASH_GREEN_SHADOW: "rgba(0,255,0,0.8)",
      FLASH_GREEN_GLOW: "rgba(0,255,0,0.9)",
      /** URL actions (new tab, preview, popover) when the hover target has no URL */
      FLASH_DENIED: "rgba(255,140,0,1)",
      FLASH_DENIED_SHADOW: "rgba(255,140,0,0.85)",
      FLASH_DENIED_GLOW: "rgba(255,140,0,0.7)",
      // Image-copy pulse (distinct from green F-click pulse)
      IMAGE_COPY_FRAME: "rgba(33,150,243,0.95)",
      IMAGE_COPY_FRAME_SHADOW: "rgba(33,150,243,0.55)",
      IMAGE_COPY_FRAME_GLOW: "rgba(100,180,255,0.75)",
      IMAGE_COPY_FILL: "rgba(33,150,243,0.14)",
      IMAGE_COPY_FLASH: "rgba(255,255,255,0.45)",
      // Notification colors
      NOTIFICATION_SUCCESS: "#4CAF50",
      NOTIFICATION_ERROR: "#f44336",
      NOTIFICATION_WARNING: "#ff9800",
      NOTIFICATION_INFO: "#2196F3",
      NOTIFICATION_SHADOW: "rgba(0, 0, 0, 0.15)",
      // Text field glow
      TEXT_FIELD_GLOW: "rgba(255,165,0,0.8)",
      // Highlight selection colors
      HIGHLIGHT_SELECTION_BG: "rgba(0,120,255,0.3)",
      HIGHLIGHT_SELECTION_BORDER: "rgba(0,120,255,0.6)",
      // Font Info inspected-run outline (stroke, not Text Select fill)
      FONT_INFO_OUTLINE: "rgba(255, 193, 7, 0.95)",
      FONT_INFO_OUTLINE_SHADOW: "rgba(255, 193, 7, 0.45)",
      FONT_INFO_OUTLINE_FILL: "rgba(255, 193, 7, 0.08)",
      // Solid accents for ESC exit labels (distinct from translucent overlay borders)
      ORANGE_BG: "rgba(255, 165, 0, 0.9)",
      ORANGE_TEXT: "#fff",
      ORANGE_BORDER_SOLID: "#d35400",
      FOCUS_GREEN_BG: "rgba(46, 204, 113, 0.9)",
      FOCUS_GREEN_BG_T2: "rgba(46, 204, 113, 0.4)",
      FOCUS_GREEN_TEXT: "#fff",
      FOCUS_GREEN_SOLID: "#27ae60",
      FOCUS_BLUE_BG_T2: "rgba(33,150,243,0.25)"
    };
  }
});

// src/config/search-engines.js
function normalizeSearchEngineId(raw) {
  if (raw === "google" || raw === "duckduckgo" || raw === "brave") return raw;
  return DEFAULT_SEARCH_ENGINE_ID;
}
var SEARCH_ENGINE_META, DEFAULT_SEARCH_ENGINE_ID, LAUNCHER_SEARCH_SITES;
var init_search_engines = __esm({
  "src/config/search-engines.js"() {
    init_region_defaults();
    init_region_defaults();
    SEARCH_ENGINE_META = Object.freeze({
      brave: Object.freeze({
        id: "brave",
        label: "Brave",
        homeUrl: "https://search.brave.com/",
        searchUrlPrefix: "https://search.brave.com/search?q="
      }),
      google: Object.freeze({
        id: "google",
        label: "Google",
        homeUrl: "https://www.google.com/",
        searchUrlPrefix: "https://www.google.com/search?q="
      }),
      duckduckgo: Object.freeze({
        id: "duckduckgo",
        label: "DuckDuckGo",
        homeUrl: "https://duckduckgo.com/",
        searchUrlPrefix: "https://duckduckgo.com/?q="
      })
    });
    DEFAULT_SEARCH_ENGINE_ID = /** @type {SearchEngineId} */
    "brave";
    LAUNCHER_SEARCH_SITES = Object.freeze(
      getLauncherSearchSites("en").map((row2) => Object.freeze(row2))
    );
  }
});

// themes/schema.js
function createProTypeTokens(stacks = {}) {
  return {
    stacks: {
      display: stacks.display || PRO_SANS,
      heading: stacks.heading || PRO_SANS,
      subhead: stacks.subhead || PRO_SANS,
      body: stacks.body || PRO_SANS,
      ui: stacks.ui || PRO_SANS,
      kbd: stacks.kbd || PRO_MONO,
      mono: stacks.mono || PRO_MONO,
      caption: stacks.caption || PRO_SANS
    },
    size: {
      display: "22px",
      h1: "22px",
      h2: "16px",
      h3: "14px",
      body: "13px",
      ui: "12px",
      kbd: "10px",
      caption: "11px",
      code: "12px"
    },
    scale: "1.25",
    weight: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700"
    },
    letterSpacing: {
      display: "0.02em",
      titlebar: "0.02em",
      ui: "normal"
    },
    textTransform: {
      display: "none",
      titlebar: "none"
    },
    lineHeight: {
      tight: "1.2",
      body: "1.35",
      prose: "1.55"
    }
  };
}
function createTitlebarChromeTokens(overrides = {}) {
  return {
    titleWeight: "600",
    iconDisplay: "none",
    iconSize: "12px",
    kbdTransform: "none",
    kbdTracking: "0.02em",
    ...overrides
  };
}
function createProRadiusTokens(overrides = {}) {
  return {
    none: "0px",
    xs: "2px",
    sm: "3px",
    md: "6px",
    lg: "10px",
    pill: "999px",
    panel: "3px",
    btn: "2px",
    field: "2px",
    key: "7px",
    plate: "14px",
    ...overrides
  };
}
function createKeyChromeTokens(overrides = {}) {
  return {
    shading: "bevel",
    border: "1px solid rgba(0, 0, 0, 0.4)",
    cornerMode: "radius",
    cutSize: "4px",
    ...overrides
  };
}
function keyClipPath(cutSize) {
  const s = cutSize || "4px";
  return `polygon(${s} 0, calc(100% - ${s}) 0, 100% ${s}, 100% calc(100% - ${s}), calc(100% - ${s}) 100%, ${s} 100%, 0 calc(100% - ${s}), 0 ${s})`;
}
function themeToCssVars(theme) {
  const t = theme && typeof theme === "object" ? theme : {};
  const type2 = t.type || createProTypeTokens();
  const stacks = type2.stacks || {};
  const size = type2.size || {};
  const weight = type2.weight || {};
  const ls = type2.letterSpacing || {};
  const tf = type2.textTransform || {};
  const lh = type2.lineHeight || {};
  const radius = t.radius || createProRadiusTokens();
  const color4 = t.color || {};
  const effect = t.effect || {};
  const shape = t.shape || { cornerMode: "radius", cutSize: "0px" };
  const keys = t.keys || createKeyChromeTokens();
  const keyCornerCut = (keys.cornerMode || "radius") === "cut";
  const icons = t.icons || {};
  const iconColor = icons.color || {};
  const vars = {
    "--kp-theme-id": String(t.id || DEFAULT_THEME_ID),
    "--kp-font-display": stacks.display || PRO_SANS,
    "--kp-font-heading": stacks.heading || PRO_SANS,
    "--kp-font-subhead": stacks.subhead || PRO_SANS,
    "--kp-font-body": stacks.body || PRO_SANS,
    "--kp-font-ui": stacks.ui || PRO_SANS,
    "--kp-font-kbd": stacks.kbd || PRO_MONO,
    "--kp-font-mono": stacks.mono || PRO_MONO,
    "--kp-font-caption": stacks.caption || PRO_SANS,
    "--kp-type-scale": String(type2.scale || "1"),
    "--kp-type-display-size": size.display || "22px",
    "--kp-type-h1-size": size.h1 || "22px",
    "--kp-type-h2-size": size.h2 || "16px",
    "--kp-type-h3-size": size.h3 || "14px",
    "--kp-type-body-size": size.body || "13px",
    "--kp-type-ui-size": size.ui || "12px",
    "--kp-type-kbd-size": size.kbd || "10px",
    "--kp-type-caption-size": size.caption || "11px",
    "--kp-type-code-size": size.code || "12px",
    "--kp-type-weight-regular": weight.regular || "400",
    "--kp-type-weight-medium": weight.medium || "500",
    "--kp-type-weight-semibold": weight.semibold || "600",
    "--kp-type-weight-bold": weight.bold || "700",
    "--kp-type-tracking-display": ls.display || "0.02em",
    "--kp-type-tracking-titlebar": ls.titlebar || "0.02em",
    "--kp-type-tracking-ui": ls.ui || "normal",
    "--kp-type-transform-display": tf.display || "none",
    "--kp-type-transform-titlebar": tf.titlebar || "none",
    "--kp-titlebar-title-weight": t.titlebar && t.titlebar.titleWeight || "600",
    "--kp-titlebar-icon-display": t.titlebar && t.titlebar.iconDisplay || "none",
    "--kp-titlebar-icon-size": t.titlebar && t.titlebar.iconSize || "12px",
    "--kp-kbd-transform": t.titlebar && t.titlebar.kbdTransform || "none",
    "--kp-kbd-tracking": t.titlebar && t.titlebar.kbdTracking || "0.02em",
    "--kp-type-leading-tight": lh.tight || "1.2",
    "--kp-type-leading-body": lh.body || "1.35",
    "--kp-type-leading-prose": lh.prose || "1.55",
    "--kp-radius-none": radius.none || "0px",
    "--kp-radius-xs": radius.xs || "2px",
    "--kp-radius-sm": radius.sm || "3px",
    "--kp-radius-md": radius.md || "6px",
    "--kp-radius-lg": radius.lg || "10px",
    "--kp-radius-pill": radius.pill || "999px",
    "--kp-radius-panel": radius.panel || "3px",
    "--kp-radius-btn": radius.btn || "2px",
    "--kp-radius-field": radius.field || "2px",
    "--kp-radius-key": radius.key || "7px",
    "--kp-radius-plate": radius.plate || "14px",
    "--kp-color-bg": color4.bg || "#0f0f10",
    "--kp-color-panel": color4.panel || "#232323",
    "--kp-color-panel-edge": color4.panelEdge || "#3a3a3a",
    "--kp-color-panel-edge-dark": color4.panelEdgeDark || "#111",
    "--kp-color-title-top": color4.titleTop || "#4c4c4c",
    "--kp-color-title-mid": color4.titleMid || "#353535",
    "--kp-color-title-bot": color4.titleBot || "#252525",
    "--kp-color-btn-top": color4.btnTop || "#4a4a4a",
    "--kp-color-btn-mid": color4.btnMid || "#343434",
    "--kp-color-btn-bot": color4.btnBot || "#2a2a2a",
    "--kp-color-lit-top": color4.litTop || "#5a7a9a",
    "--kp-color-lit-bot": color4.litBot || "#3a5570",
    "--kp-color-lit-edge": color4.litEdge || "#2a4a66",
    "--kp-color-accent": color4.accent || "#4a90c8",
    "--kp-color-accent-2": color4.accent2 || color4.accent || "#4a90c8",
    "--kp-color-fg": color4.fg || "#ddd",
    "--kp-color-fg-dim": color4.fgDim || "#aaa",
    "--kp-color-fg-mute": color4.fgMute || "#777",
    "--kp-color-field-bg": color4.fieldBg || "#141414",
    "--kp-color-field-edge": color4.fieldEdge || "#0a0a0a",
    "--kp-color-field-inset": color4.fieldInsetTop || "#333",
    "--kp-color-hover": color4.hover || "rgba(255,255,255,0.06)",
    "--kp-color-selected": color4.selected || "rgba(74,144,200,0.22)",
    "--kp-color-selected-text": color4.selectedText || "#e8f0f8",
    "--kp-color-focus-ring": color4.focusRing || "inset 0 0 0 1px rgba(74,144,200,0.55)",
    "--kp-color-kbd-fg": color4.kbdColor || color4.fg || "#ddd",
    "--kp-titlebar-bg": (() => {
      const titleGrad = `linear-gradient(180deg, ${color4.titleTop || "#4c4c4c"} 0%, ${color4.titleMid || "#353535"} 45%, ${color4.titleBot || "#252525"} 100%)`;
      const baked = String(effect.titlebarBg || "");
      const idx = baked.lastIndexOf("linear-gradient(180deg");
      return idx > 0 ? `${baked.slice(0, idx)}${titleGrad}` : titleGrad;
    })(),
    "--kp-titlebar-border": effect.titlebarBorder || `1px solid ${color4.panelEdgeDark || "#111"}`,
    "--kp-titlebar-shadow": effect.titlebarShadow || `0 1px 0 ${color4.panelEdge || "#3a3a3a"}`,
    "--kp-panel-bg": color4.panel || effect.panelBg || "#232323",
    "--kp-panel-border": effect.panelBorder || `1px solid ${color4.panelEdgeDark || "#111"}`,
    "--kp-panel-shadow": effect.panelShadow || `0 0 0 1px ${color4.panelEdge || "#3a3a3a"} inset, 0 0 0 1px rgba(190, 190, 190, 0.52), 0 0 10px rgba(255, 255, 255, 0.14), 0 16px 40px rgba(0,0,0,0.55)`,
    "--kp-btn-bg": effect.btnBg || `linear-gradient(180deg, ${color4.btnTop || "#4a4a4a"} 0%, ${color4.btnMid || "#343434"} 50%, ${color4.btnBot || "#2a2a2a"} 100%)`,
    "--kp-btn-border": effect.btnBorder || `1px solid ${color4.panelEdgeDark || "#111"}`,
    "--kp-btn-lit-bg": effect.btnLitBg || `linear-gradient(180deg, ${color4.litTop || "#5a7a9a"} 0%, ${color4.litBot || "#3a5570"} 100%)`,
    "--kp-btn-lit-border": effect.btnLitBorder || `1px solid ${color4.litEdge || "#2a4a66"}`,
    "--kp-field-bg": effect.fieldBg || (color4.fieldBg || "#141414"),
    "--kp-field-border": effect.fieldBorder || `1px solid ${color4.fieldEdge || "#0a0a0a"}`,
    "--kp-field-shadow": effect.fieldShadow || `inset 0 1px 0 ${color4.fieldInsetTop || "#333"}`,
    "--kp-kbd-bg": effect.kbdBg || (color4.fieldBg || "#141414"),
    "--kp-kbd-border": effect.kbdBorder || `1px solid ${color4.panelEdgeDark || "#111"}`,
    "--kp-kbd-shadow": effect.kbdShadow || "none",
    "--kp-backdrop-bg": effect.backdropBg || "rgba(0,0,0,0.35)",
    "--kp-backdrop-blur": effect.backdropBlur || "blur(6px)",
    "--kp-hatch-edit": effect.hatchEdit || "repeating-linear-gradient(-45deg, rgba(180, 200, 220, 0.08) 0px, rgba(180, 200, 220, 0.08) 1px, transparent 1px, transparent 7px)",
    "--kp-hatch-edit-titlebar-bg": effect.hatchEditTitlebarBg || "linear-gradient(180deg, #646464 0%, #4a4a4a 45%, #383838 100%)",
    "--kp-hatch-edit-body-bg": effect.hatchEditBodyBg || "#1a1c20",
    "--kp-scrollbar-thumb": color4.scrollbarThumb || "#4a4a4a",
    "--kp-scrollbar-thumb-hover": color4.scrollbarThumbHover || "#5c5c5c",
    "--kp-scrollbar-track": color4.scrollbarTrack || (color4.fieldBg || "#141414"),
    "--kp-corner-mode": shape.cornerMode || "radius",
    "--kp-cut-size": shape.cutSize || "0px",
    "--kp-key-shading": keys.shading || "bevel",
    "--kp-key-border": keys.border || "1px solid rgba(0, 0, 0, 0.4)",
    "--kp-key-corner-mode": keys.cornerMode || "radius",
    "--kp-key-cut-size": keys.cutSize || "4px",
    "--kp-key-clip": keyCornerCut ? keyClipPath(keys.cutSize || "4px") : KEY_CLIP_NONE,
    "--kp-key-effective-radius": keyCornerCut ? "0px" : radius.key || "7px",
    // Used by @supports (corner-shape: bevel) upgrade (clip-path baseline otherwise).
    "--kp-key-shape-radius": keyCornerCut ? keys.cutSize || "4px" : radius.key || "7px",
    "--kp-key-corner-shape": keyCornerCut ? "bevel" : "round",
    "--kp-key-sheen-opacity": (keys.shading || "bevel") === "flat" ? "0" : "1",
    "--kp-key-shade-layer": (keys.shading || "bevel") === "flat" ? "transparent" : KEY_SHADE_BEVEL,
    "--kp-icon-chrome": iconColor.chrome || (color4.fg || "#ddd"),
    "--kp-icon-keycap": iconColor.keycap || (color4.fg || "#0c1018"),
    "--kp-icon-accent": iconColor.accent || (color4.accent || "#4a90c8"),
    "--kp-key-icon": iconColor.keycap || "#0c1018"
  };
  return vars;
}
function cssVarsToBlock(vars, selector = ":host, :root, [data-kp-theme]") {
  const lines = Object.entries(vars || {}).map(([k, v]) => `  ${k}: ${v};`);
  return `${selector} {
${lines.join("\n")}
}`;
}
function getTitlebarChromeCss() {
  return `
.kp-titlebar-icon {
  display: var(--kp-titlebar-icon-display, none);
  width: var(--kp-titlebar-icon-size, 12px);
  height: var(--kp-titlebar-icon-size, 12px);
  flex: 0 0 auto;
  background-color: var(--kp-icon-chrome, currentColor);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}
[data-kp-titlebar-shortcut],
.kp-titlebar-kbd {
  font-family: var(--kp-font-kbd, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  font-size: var(--kp-type-kbd-size, 10px);
  font-weight: var(--kp-type-weight-regular, 400);
  line-height: 1.2;
  text-transform: var(--kp-kbd-transform, none);
  letter-spacing: var(--kp-kbd-tracking, 0.02em);
  padding: 1px 6px;
  border: var(--kp-kbd-border, 1px solid #111);
  border-radius: var(--kp-radius-btn, 2px);
  background: var(--kp-kbd-bg, #141414);
  color: var(--kp-color-kbd-fg, #ddd);
  box-shadow: var(--kp-kbd-shadow, none);
  box-sizing: border-box;
}
.kpv2-popover-titlebar,
[data-kp-popover-titlebar],
[data-kp-floating-keyboard-titlebar],
.kp-cfg-titlebar,
.kp-action-config-panel__titlebar,
.kp-procedure-result__titlebar,
.kp-practice-popover__header {
  letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
  text-transform: var(--kp-type-transform-titlebar, none);
}
.kpv2-popover-titlebar-title,
[data-kp-floating-keyboard-title],
.kp-cfg-title,
.kp-action-config-panel__title,
.kp-procedure-result__title,
.kp-practice-popover__title {
  font-weight: var(--kp-titlebar-title-weight, 600);
  letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
  text-transform: var(--kp-type-transform-titlebar, none);
  color: var(--kp-color-fg, inherit);
}
`.trim();
}
function getSelectMenuCss() {
  return `
.kp-select {
  display: inline-flex;
  align-items: stretch;
  flex: 0 0 auto;
  min-width: 0;
  box-sizing: border-box;
  font-family: var(--kp-font-ui, Helvetica, Arial, sans-serif);
}
.kp-select-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 2px 6px;
  border: var(--kp-field-border, 1px solid #0a0a0a);
  border-radius: var(--kp-radius-field, 2px);
  background: var(--kp-field-bg, #141414);
  color: var(--kp-color-fg, #ddd);
  box-shadow: var(--kp-field-shadow, none);
  font: inherit;
  font-size: 11px;
  line-height: 1.2;
  text-align: left;
  text-transform: none;
  letter-spacing: normal;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  outline: none;
  box-sizing: border-box;
}
.kp-select--titlebar .kp-select-trigger {
  width: 190px;
  height: 22px;
  margin-left: 6px;
}
.kp-select-trigger:hover {
  background: color-mix(in srgb, var(--kp-color-hover, rgba(255,255,255,0.08)) 70%, var(--kp-field-bg, #141414));
}
.kp-select-trigger:focus-visible {
  outline: 1px solid var(--kp-color-focus-ring, var(--kp-color-accent, #4a90c8));
  outline-offset: 1px;
}
.kp-select.is-open .kp-select-trigger,
.kp-select-trigger[aria-expanded="true"] {
  border-color: var(--kp-color-accent, #4a90c8);
}
.kp-select-trigger-icon,
.kp-select-item-icon {
  display: none;
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  background-color: var(--kp-icon-chrome, currentColor);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}
.kp-select-trigger-icon:not([hidden]),
.kp-select-item-icon:not([hidden]) {
  display: block;
}
.kp-select-trigger-label,
.kp-select-item-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: none;
  letter-spacing: normal;
}
.kp-select-chevron {
  width: 0;
  height: 0;
  margin-left: 2px;
  border-left: 3.5px solid transparent;
  border-right: 3.5px solid transparent;
  border-top: 4px solid currentColor;
  opacity: 0.65;
  flex: 0 0 auto;
}
.kp-select-menu {
  position: fixed;
  /* Kill UA popover centering (inset 0 / margin auto) without locking longhands. */
  margin: 0;
  top: auto;
  right: auto;
  bottom: auto;
  left: auto;
  width: max-content;
  height: fit-content;
  z-index: 2147483049;
  padding: 4px 0;
  min-width: 190px;
  max-width: min(360px, calc(100vw - 16px));
  max-height: min(320px, calc(100vh - 16px));
  overflow-x: hidden;
  overflow-y: scroll !important;
  box-sizing: border-box;
  border: var(--kp-panel-border, 1px solid #111);
  border-radius: var(--kp-radius-panel, 3px);
  background: var(--kp-panel-bg, #232323);
  box-shadow: var(--kp-panel-shadow, 0 8px 24px rgba(0,0,0,0.45));
  color: var(--kp-color-fg, #ddd);
  font-family: var(--kp-font-ui, Helvetica, Arial, sans-serif);
  font-size: 12px;
  line-height: 1.3;
  text-transform: none;
  letter-spacing: normal;
  scrollbar-color: #a8a8a8 #747474;
}
/* Blink: scrollbar-width uses overlay bars that only appear on scroll and
   suppress ::-webkit-scrollbar. Unset so the themed classic bar paints. */
@supports selector(::-webkit-scrollbar) {
  .kp-select-menu {
    scrollbar-width: unset;
    scrollbar-color: unset;
  }
}
.kp-select-menu::-webkit-scrollbar {
  -webkit-appearance: none;
  appearance: none;
  display: block !important;
  width: 10px !important;
  height: 10px !important;
  background: #747474;
}
.kp-select-menu::-webkit-scrollbar-corner {
  background: #747474;
}
.kp-select-menu::-webkit-scrollbar-track {
  background: #747474;
  border-left: 1px solid rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(0, 0, 0, 0.3);
}
.kp-select-menu::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #c0c0c0 0%, #a8a8a8 45%, #8d8d8d 100%);
  border: 1px solid #4a4a4a;
  border-radius: 2px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
  min-height: 28px;
  min-width: 28px;
}
.kp-select-menu::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #cecece 0%, #b5b5b5 45%, #999 100%);
}
.kp-select-menu::-webkit-scrollbar-thumb:active {
  background: linear-gradient(180deg, #b5b5b5 0%, #8d8d8d 100%);
  border-color: #3d3d3d;
}
.kp-select-menu[data-kp-select-fallback="true"][hidden] {
  display: none !important;
}
.kp-select-group {
  padding: 6px 10px 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--kp-color-fg-mute, #777);
  pointer-events: none;
  user-select: none;
}
.kp-select-separator {
  height: 1px;
  margin: 4px 8px;
  background: var(--kp-color-field-edge, #0a0a0a);
  border: 0;
  pointer-events: none;
}
.kp-select-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 5px 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 400;
  text-align: left;
  text-transform: none;
  letter-spacing: normal;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  box-sizing: border-box;
  outline: none;
}
.kp-select-item:hover,
.kp-select-item.is-active {
  background: var(--kp-color-hover, rgba(255,255,255,0.08));
  outline: 1px solid var(--kp-color-focus-ring, var(--kp-color-accent, #4a90c8));
  outline-offset: -1px;
}
.kp-select-item[aria-selected="true"] {
  background: var(--kp-color-selected, rgba(74, 144, 200, 0.28));
  color: var(--kp-color-selected-text, var(--kp-color-fg, #ddd));
}
.kp-select-item .kp-titlebar-kbd {
  margin-left: auto;
  flex-shrink: 0;
}
`.trim();
}
function getCutCornerCss() {
  return `
.kp-chrome-window {
  overflow: hidden;
}
.kp-chrome-window:not([data-kp-corner="cut"]) {
  border-radius: var(--kp-radius-panel, 3px);
}
/* Baseline (presentation): proven clip-path chamfer */
[data-kp-corner="cut"],
:host([data-kp-corner="cut"]),
.kp-chrome-window[data-kp-corner="cut"] {
  clip-path: polygon(
    var(--kp-cut-size, 8px) 0,
    calc(100% - var(--kp-cut-size, 8px)) 0,
    100% var(--kp-cut-size, 8px),
    100% calc(100% - var(--kp-cut-size, 8px)),
    calc(100% - var(--kp-cut-size, 8px)) 100%,
    var(--kp-cut-size, 8px) 100%,
    0 calc(100% - var(--kp-cut-size, 8px)),
    0 var(--kp-cut-size, 8px)
  );
  border-radius: 0;
}
/* Upgrade: native chamfer keeps stroke + shadow on the cut edge */
@supports (corner-shape: bevel) {
  [data-kp-corner="cut"],
  :host([data-kp-corner="cut"]),
  .kp-chrome-window[data-kp-corner="cut"] {
    clip-path: none !important;
    border-radius: var(--kp-cut-size, 8px) !important;
    corner-shape: bevel;
  }
}
`.trim();
}
function mergeTheme(base, overrides) {
  if (!overrides || typeof overrides !== "object") return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
      out[k] = mergeTheme(base[k], v);
    } else if (v !== void 0) {
      out[k] = v;
    }
  }
  return out;
}
function normalizeThemeId(raw) {
  const id = typeof raw === "string" ? raw.trim() : "";
  return THEME_IDS.includes(id) ? id : DEFAULT_THEME_ID;
}
function hasThemeOverrides(raw) {
  return !!(raw && typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw).length > 0);
}
var DEFAULT_THEME_ID, THEME_IDS, THEME_META, PRO_SANS, PRO_MONO, TYPE_ROLES, KEY_CLIP_NONE, KEY_SHADE_BEVEL;
var init_schema = __esm({
  "themes/schema.js"() {
    DEFAULT_THEME_ID = "dark-pro";
    THEME_IDS = Object.freeze([
      "dark-pro",
      "gray-metal-pro",
      "gx-er"
    ]);
    THEME_META = Object.freeze({
      "dark-pro": { name: "Dark Pro" },
      "gray-metal-pro": { name: "Gray Metal Pro" },
      "gx-er": { name: "GX-er" }
    });
    PRO_SANS = "Helvetica, Arial, sans-serif";
    PRO_MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    TYPE_ROLES = Object.freeze([
      "display",
      "heading",
      "subhead",
      "body",
      "ui",
      "kbd",
      "mono",
      "caption"
    ]);
    KEY_CLIP_NONE = "none";
    KEY_SHADE_BEVEL = "linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 18%, transparent 42%)";
  }
});

// src/utils/storage.js
function pickNewerStoredValue(syncVal, localVal) {
  const syncAt = syncVal && typeof syncVal === "object" ? Number(syncVal._updatedAt) : 0;
  const localAt = localVal && typeof localVal === "object" ? Number(localVal._updatedAt) : 0;
  const syncTs = Number.isFinite(syncAt) ? syncAt : 0;
  const localTs = Number.isFinite(localAt) ? localAt : 0;
  if (syncTs && localTs) return localTs >= syncTs ? localVal : syncVal;
  if (localTs && !syncTs) return localVal;
  if (syncTs && !localTs) return syncVal;
  return syncVal;
}
function resolveStoredAreas(syncVal, syncHas, localVal, localHas, defaultValue) {
  if (syncHas && localHas) return pickNewerStoredValue(syncVal, localVal);
  if (syncHas) return syncVal;
  if (localHas) return localVal;
  return defaultValue;
}
async function storageGetValue(key2, defaultValue = void 0) {
  if (!key2 || typeof key2 !== "string") return defaultValue;
  let syncVal = void 0;
  let syncHas = false;
  try {
    if (chrome?.storage?.sync?.get) {
      const syncResult = await chrome.storage.sync.get([key2]);
      if (syncResult && Object.prototype.hasOwnProperty.call(syncResult, key2) && syncResult[key2] !== void 0) {
        syncHas = true;
        syncVal = /** @type {T} */
        syncResult[key2];
      }
    }
  } catch {
  }
  let localVal = void 0;
  let localHas = false;
  try {
    if (chrome?.storage?.local?.get) {
      const localResult = await chrome.storage.local.get([key2]);
      if (localResult && Object.prototype.hasOwnProperty.call(localResult, key2) && localResult[key2] !== void 0) {
        localHas = true;
        localVal = /** @type {T} */
        localResult[key2];
      }
    }
  } catch {
  }
  return (
    /** @type {T} */
    resolveStoredAreas(syncVal, syncHas, localVal, localHas, defaultValue)
  );
}
async function storageSetValue(key2, value, opts = {}) {
  if (!key2 || typeof key2 !== "string") return false;
  const payload = { [key2]: value };
  if (opts.includeTimestamp) {
    payload.timestamp = Date.now();
  }
  let wroteSync = false;
  try {
    if (chrome?.storage?.sync?.set) {
      await chrome.storage.sync.set(payload);
      wroteSync = true;
      if (!opts.dualWrite) return true;
    }
  } catch {
  }
  try {
    if (chrome?.storage?.local?.set) {
      await chrome.storage.local.set(payload);
      return true;
    }
  } catch {
  }
  return wroteSync;
}
var init_storage = __esm({
  "src/utils/storage.js"() {
  }
});

// src/utils/platform.js
function isMacPlatform() {
  try {
    const uaPlatform = navigator.userAgentData?.platform;
    if (typeof uaPlatform === "string" && uaPlatform) {
      return uaPlatform === "macOS";
    }
  } catch {
  }
  try {
    const plat = String(navigator.platform || "");
    const ua = String(navigator.userAgent || "");
    return /^Mac/i.test(plat) || /Mac OS X/i.test(ua);
  } catch {
  }
  return false;
}
function altModifierLabel() {
  return isMacPlatform() ? "Opt" : "Alt";
}
function formatAltShortcut(key2, options = {}) {
  const joiner = options.joiner ?? "+";
  return `${altModifierLabel()}${joiner}${key2}`;
}
var init_platform = __esm({
  "src/utils/platform.js"() {
  }
});

// src/config/focus-color.js
function parseFocusColorHex(raw) {
  const s = String(raw || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  return null;
}
function normalizeFocusColor(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (FOCUS_COLOR_PRESET_IDS.includes(s)) return s;
  return parseFocusColorHex(s) || DEFAULT_FOCUS_COLOR;
}
function isFocusColorPreset(raw) {
  return FOCUS_COLOR_PRESET_IDS.includes(String(raw || "").trim().toLowerCase());
}
function rgbFromHex(hex) {
  const parsed = parseFocusColorHex(hex);
  if (!parsed) return null;
  return {
    r: parseInt(parsed.slice(1, 3), 16),
    g: parseInt(parsed.slice(3, 5), 16),
    b: parseInt(parsed.slice(5, 7), 16)
  };
}
function rgba(r, g, b, a) {
  return `rgba(${r},${g},${b},${a})`;
}
function paletteFromRgb(rgb) {
  const { r, g, b } = rgb;
  return {
    borderColor: rgba(r, g, b, 0.95),
    shadowColor: rgba(r, g, b, 0.35),
    shadowBrightColor: rgba(r, g, b, 0.45),
    backgroundColor: rgba(r, g, b, 0.25),
    hex: `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`
  };
}
function getFocusColorPalette(raw) {
  const id = normalizeFocusColor(raw);
  if (isFocusColorPreset(id)) {
    const rgb = rgbFromHex(FOCUS_COLOR_PRESET_HEX[id]);
    if (rgb) return paletteFromRgb(rgb);
  }
  const custom = rgbFromHex(id);
  if (custom) return paletteFromRgb(custom);
  return paletteFromRgb(rgbFromHex(FOCUS_COLOR_PRESET_HEX.blue));
}
function hexForFocusColor(raw) {
  return getFocusColorPalette(raw).hex;
}
var FOCUS_COLOR_PRESET_IDS, FOCUS_COLOR_PRESET_HEX, DEFAULT_FOCUS_COLOR;
var init_focus_color = __esm({
  "src/config/focus-color.js"() {
    FOCUS_COLOR_PRESET_IDS = Object.freeze([
      "blue",
      "green",
      "orange",
      "red",
      "purple"
    ]);
    FOCUS_COLOR_PRESET_HEX = Object.freeze({
      blue: "#2196f3",
      green: "#00b400",
      orange: "#ff8c00",
      red: "#e53935",
      purple: "#9c27b0"
    });
    DEFAULT_FOCUS_COLOR = "blue";
  }
});

// src/modules/settings-manager.js
function normalizeSearchEngine(raw) {
  return normalizeSearchEngineId(raw);
}
function normalizeCursorMode(raw) {
  if (raw === CURSOR_MODE.NO_CUSTOM_CURSORS || raw === CURSOR_MODE.CUSTOM_CURSORS) return raw;
  return DEFAULT_SETTINGS.cursorMode;
}
function normalizeThemeOverrides(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw;
}
function normalizeBoolean(raw, fallback) {
  if (raw === true || raw === false) return raw;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return !!fallback;
}
function normalizeCurrentKeyboardLayoutId(raw) {
  const v = String(raw || "").trim();
  if (!v) return DEFAULT_SETTINGS.currentKeyboardLayoutId;
  if (v === "builtin") return "builtin";
  if (v.startsWith("user:") && v.length > "user:".length) return v;
  return DEFAULT_SETTINGS.currentKeyboardLayoutId;
}
function normalizeNumber(raw, fallback, min, max) {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  const v = Number.isFinite(n) ? n : fallback;
  const clamped = Math.min(Math.max(v, min), max);
  return clamped;
}
function normalizeClickCursorType(raw) {
  if (raw === "crosshair" || raw === "native_arrow" || raw === "native_pointer") return raw;
  return DEFAULT_SETTINGS.clickMode.cursor.type;
}
function normalizeClickEffect(raw) {
  if (raw === "flash" || raw === "dash" || raw === "marquee" || raw === "scale" || raw === "none") {
    return raw;
  }
  return DEFAULT_SETTINGS.clickMode.clickEffect;
}
function normalizeTextCursorType(raw) {
  if (raw === "t_square" || raw === "crosshair") return raw;
  return DEFAULT_SETTINGS.textMode.cursorType;
}
function normalizeTextFocusStyle(raw) {
  if (raw === "left_edge" || raw === "background_tint") return raw;
  return DEFAULT_SETTINGS.textMode.focusStyle;
}
function normalizeFocusColor2(raw) {
  return normalizeFocusColor(raw);
}
function normalizePaintStrategy(raw) {
  if (raw === "auto" || raw === "BC") return raw;
  const upper = raw == null ? "" : String(raw).trim().toUpperCase();
  if (upper === "B->C" || upper === "B\u2192C" || upper === "AUTO_BC" || upper === "AUTO-BC" || upper === "AUTO B->C" || upper === "AUTO B\u2192C") {
    return "BC";
  }
  if (upper === "AUTO" || upper === "A->B->C" || upper === "A\u2192B\u2192C") {
    return "auto";
  }
  return DEFAULT_SETTINGS.clickMode.paintStrategy;
}
function normalizeClickMode(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
  const storedCursor = stored.cursor && typeof stored.cursor === "object" ? stored.cursor : {};
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
    focusColor: normalizeFocusColor2(stored.focusColor),
    overlayFillEnabled: normalizeBoolean(
      stored.overlayFillEnabled,
      DEFAULT_SETTINGS.clickMode.overlayFillEnabled
    ),
    overlayFillMaxWidth: normalizeNumber(
      stored.overlayFillMaxWidth,
      DEFAULT_SETTINGS.clickMode.overlayFillMaxWidth,
      OVERLAY_FILL_MAX_SIZE_MIN,
      OVERLAY_FILL_MAX_SIZE_MAX
    ),
    overlayFillMaxHeight: normalizeNumber(
      stored.overlayFillMaxHeight,
      DEFAULT_SETTINGS.clickMode.overlayFillMaxHeight,
      OVERLAY_FILL_MAX_SIZE_MIN,
      OVERLAY_FILL_MAX_SIZE_MAX
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
function normalizeTextMode(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
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
function normalizeScrollSpeed(raw) {
  if (raw === "smooth" || raw === "instant") return raw;
  if (raw === "auto") return "instant";
  return DEFAULT_SETTINGS.scroll.speed;
}
function normalizeScroll(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
  const middleClickDefault = DEFAULT_SETTINGS.scroll.middleClickScrollLine;
  return {
    halfPagePx: normalizeNumber(
      stored.halfPagePx,
      DEFAULT_SETTINGS.scroll.halfPagePx,
      50,
      2e3
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
function normalizeDeferredOpenRange(raw, fallback) {
  const stored = raw && typeof raw === "object" ? raw : {};
  const minMinutes = normalizeNumber(
    stored.minMinutes,
    fallback.minMinutes,
    DEFERRED_OPEN_MIN_MINUTES,
    DEFERRED_OPEN_MAX_MINUTES
  );
  const maxMinutes = normalizeNumber(
    stored.maxMinutes,
    fallback.maxMinutes,
    DEFERRED_OPEN_MIN_MINUTES,
    DEFERRED_OPEN_MAX_MINUTES
  );
  return {
    enabled: normalizeBoolean(stored.enabled, fallback.enabled),
    minMinutes: Math.min(minMinutes, maxMinutes),
    maxMinutes: Math.max(minMinutes, maxMinutes)
  };
}
function normalizeDeferredNumberRowKeys(raw) {
  return raw === "applied" || raw === "kept" ? raw : "auto";
}
function normalizeDeferredOpen(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
  return {
    // Absent means off, including profiles saved before this flag existed.
    enabled: normalizeBoolean(stored.enabled, false),
    numberRowKeys: normalizeDeferredNumberRowKeys(stored.numberRowKeys),
    openUrls: normalizeDeferredOpenRange(stored.openUrls, DEFAULT_SETTINGS.deferredOpen.openUrls),
    randomBookmarks: normalizeDeferredOpenRange(
      stored.randomBookmarks,
      DEFAULT_SETTINGS.deferredOpen.randomBookmarks
    ),
    clickElement: normalizeDeferredOpenRange(
      stored.clickElement,
      DEFAULT_SETTINGS.deferredOpen.clickElement
    ),
    closeTab: normalizeDeferredOpenRange(
      stored.closeTab,
      DEFAULT_SETTINGS.deferredOpen.closeTab
    ),
    closeWindow: normalizeDeferredOpenRange(
      stored.closeWindow,
      DEFAULT_SETTINGS.deferredOpen.closeWindow
    ),
    target: stored.target === "originalWindow" ? "originalWindow" : "activeWindow",
    silentRandomScheduling: normalizeBoolean(
      stored.silentRandomScheduling,
      DEFAULT_SETTINGS.deferredOpen.silentRandomScheduling
    )
  };
}
function normalizeControlStrip(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
  return {
    visible: normalizeBoolean(stored.visible, DEFAULT_SETTINGS.controlStrip.visible),
    collapsed: normalizeBoolean(stored.collapsed, DEFAULT_SETTINGS.controlStrip.collapsed)
  };
}
function normalizePanelPositionEntry(raw, fallback) {
  const fb = fallback && typeof fallback === "object" ? fallback : {};
  if (!raw || typeof raw !== "object") {
    return {
      left: Number.isFinite(fb.left) ? fb.left : void 0,
      top: Number.isFinite(fb.top) ? fb.top : void 0,
      anchor: typeof fb.anchor === "string" ? fb.anchor : fb.anchor === null ? null : void 0
    };
  }
  const out = {};
  const left = typeof raw.left === "number" ? raw.left : typeof raw.left === "string" ? Number(raw.left) : NaN;
  const top = typeof raw.top === "number" ? raw.top : typeof raw.top === "string" ? Number(raw.top) : NaN;
  const width = typeof raw.width === "number" ? raw.width : typeof raw.width === "string" ? Number(raw.width) : NaN;
  const height = typeof raw.height === "number" ? raw.height : typeof raw.height === "string" ? Number(raw.height) : NaN;
  if (Number.isFinite(left)) out.left = left;
  if (Number.isFinite(top)) out.top = top;
  if (Number.isFinite(width) && width > 0) out.width = width;
  if (Number.isFinite(height) && height > 0) out.height = height;
  if (raw.anchor === null) {
    out.anchor = null;
  } else if (typeof raw.anchor === "string" && PANEL_ANCHOR_IDS.has(raw.anchor.trim())) {
    out.anchor = raw.anchor.trim();
  } else if (typeof fb.anchor === "string" && !Number.isFinite(left) && !Number.isFinite(top)) {
    out.anchor = fb.anchor;
  }
  if (out.left === void 0 && out.top === void 0 && out.anchor === void 0) {
    return {
      left: Number.isFinite(fb.left) ? fb.left : void 0,
      top: Number.isFinite(fb.top) ? fb.top : void 0,
      anchor: typeof fb.anchor === "string" ? fb.anchor : fb.anchor === null ? null : void 0
    };
  }
  return out;
}
function normalizePanelPositions(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
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
function normalizeStringIdList(raw, fallback) {
  const fb = Array.isArray(fallback) ? [...fallback] : [];
  if (!Array.isArray(raw)) return fb;
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const id = v.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
function normalizeActionsLibraryTableExpanded(raw) {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_SETTINGS.actionsLibraryTableExpanded];
  }
  return normalizeStringIdList(raw, DEFAULT_SETTINGS.actionsLibraryTableExpanded);
}
function normalizeActionSettings(raw) {
  const defaults = DEFAULT_SETTINGS.actionSettings || {};
  const stored = raw && typeof raw === "object" ? raw : {};
  const out = {};
  const keys = /* @__PURE__ */ new Set([...Object.keys(defaults), ...Object.keys(stored)]);
  for (const actionId of keys) {
    const fb = defaults[actionId] && typeof defaults[actionId] === "object" ? defaults[actionId] : {};
    const entry = stored[actionId] && typeof stored[actionId] === "object" ? stored[actionId] : {};
    const mode = typeof entry.mode === "string" && entry.mode ? entry.mode : typeof fb.mode === "string" ? fb.mode : void 0;
    const parameters = {
      ...fb.parameters && typeof fb.parameters === "object" ? fb.parameters : {},
      ...entry.parameters && typeof entry.parameters === "object" ? entry.parameters : {}
    };
    out[actionId] = { mode, parameters };
  }
  return out;
}
async function getSettings() {
  try {
    let stored = await storageGetValue(SETTINGS_STORAGE_KEY, null);
    if (!stored || typeof stored !== "object") stored = {};
    let familyId = normalizeKeyboardLayoutFamilyId(stored?.keyboardLayoutFamilyId);
    let handedness = normalizeKeyboardHandedness(stored?.keyboardHandedness);
    const hasNewFields = Object.prototype.hasOwnProperty.call(stored || {}, "keyboardLayoutFamilyId") || Object.prototype.hasOwnProperty.call(stored || {}, "keyboardHandedness");
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
      clickModeThemeId: typeof stored?.clickModeThemeId === "string" && stored.clickModeThemeId.trim() ? normalizeThemeId(stored.clickModeThemeId) : "",
      searchEngine: normalizeSearchEngine(stored?.searchEngine),
      cursorMode: normalizeCursorMode(stored?.cursorMode),
      keyboardLayoutFamilyId: familyId,
      keyboardHandedness: handedness,
      keyboardLayoutId: resolvedLayoutId,
      keyboardHardwareLayoutId: normalizeKeyboardHardwareLayoutId(stored?.keyboardHardwareLayoutId),
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
      scroll: normalizeScroll(stored?.scroll),
      deferredOpen: normalizeDeferredOpen(stored?.deferredOpen)
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
      deferredOpen: normalizeDeferredOpen(null),
      actionsLibraryTableExpanded: [...DEFAULT_SETTINGS.actionsLibraryTableExpanded],
      actionsLibraryInstructionsExpanded: DEFAULT_SETTINGS.actionsLibraryInstructionsExpanded,
      themeId: DEFAULT_THEME_ID,
      themeOverrides: {},
      clickModeThemeId: ""
    };
  }
}
function applySettingsPartial(current, partial) {
  const p = partial && typeof partial === "object" ? partial : {};
  const pPositions = p.panelPositions && typeof p.panelPositions === "object" ? p.panelPositions : null;
  const next = {
    ...current,
    ...p,
    controlStrip: {
      ...current.controlStrip,
      ...p.controlStrip && typeof p.controlStrip === "object" ? p.controlStrip : {}
    },
    panelPositions: {
      keyboardReference: {
        ...current.panelPositions.keyboardReference,
        ...pPositions?.keyboardReference && typeof pPositions.keyboardReference === "object" ? pPositions.keyboardReference : {}
      },
      controlStrip: {
        ...current.panelPositions.controlStrip,
        ...pPositions?.controlStrip && typeof pPositions.controlStrip === "object" ? pPositions.controlStrip : {}
      },
      keyboardLayoutConfig: {
        ...current.panelPositions.keyboardLayoutConfig || DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig,
        ...pPositions?.keyboardLayoutConfig && typeof pPositions.keyboardLayoutConfig === "object" ? pPositions.keyboardLayoutConfig : {}
      },
      topSites: {
        ...current.panelPositions.topSites || DEFAULT_SETTINGS.panelPositions.topSites,
        ...pPositions?.topSites && typeof pPositions.topSites === "object" ? pPositions.topSites : {}
      }
    },
    clickMode: {
      ...current.clickMode,
      ...p.clickMode && typeof p.clickMode === "object" ? p.clickMode : {},
      cursor: {
        ...current.clickMode.cursor,
        ...p.clickMode && typeof p.clickMode === "object" && p.clickMode.cursor && typeof p.clickMode.cursor === "object" ? p.clickMode.cursor : {}
      }
    },
    textMode: {
      ...current.textMode,
      ...p.textMode && typeof p.textMode === "object" ? p.textMode : {}
    },
    scroll: {
      ...current.scroll,
      ...p.scroll && typeof p.scroll === "object" ? p.scroll : {}
    },
    deferredOpen: {
      ...current.deferredOpen,
      ...p.deferredOpen && typeof p.deferredOpen === "object" ? p.deferredOpen : {},
      openUrls: {
        ...current.deferredOpen.openUrls,
        ...p.deferredOpen?.openUrls && typeof p.deferredOpen.openUrls === "object" ? p.deferredOpen.openUrls : {}
      },
      randomBookmarks: {
        ...current.deferredOpen.randomBookmarks,
        ...p.deferredOpen?.randomBookmarks && typeof p.deferredOpen.randomBookmarks === "object" ? p.deferredOpen.randomBookmarks : {}
      },
      clickElement: {
        ...current.deferredOpen.clickElement || {},
        ...p.deferredOpen?.clickElement && typeof p.deferredOpen.clickElement === "object" ? p.deferredOpen.clickElement : {}
      },
      closeTab: {
        ...current.deferredOpen.closeTab || {},
        ...p.deferredOpen?.closeTab && typeof p.deferredOpen.closeTab === "object" ? p.deferredOpen.closeTab : {}
      },
      closeWindow: {
        ...current.deferredOpen.closeWindow || {},
        ...p.deferredOpen?.closeWindow && typeof p.deferredOpen.closeWindow === "object" ? p.deferredOpen.closeWindow : {}
      }
    },
    actionSettings: (() => {
      const merged = { ...current.actionSettings || {} };
      const patch = p.actionSettings && typeof p.actionSettings === "object" ? p.actionSettings : {};
      for (const [id, entry] of Object.entries(patch)) {
        const prev = merged[id] && typeof merged[id] === "object" ? merged[id] : {};
        const next2 = entry && typeof entry === "object" ? entry : {};
        merged[id] = {
          ...prev,
          ...next2,
          parameters: {
            ...prev.parameters && typeof prev.parameters === "object" ? prev.parameters : {},
            ...next2.parameters && typeof next2.parameters === "object" ? next2.parameters : {}
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
  next.clickModeThemeId = typeof next.clickModeThemeId === "string" && next.clickModeThemeId.trim() ? normalizeThemeId(next.clickModeThemeId) : "";
  const callerSetLayoutId = Object.prototype.hasOwnProperty.call(p, "keyboardLayoutId");
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
  next.keyboardHardwareLayoutId = normalizeKeyboardHardwareLayoutId(next.keyboardHardwareLayoutId);
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
  next.deferredOpen = normalizeDeferredOpen(next.deferredOpen);
  next._updatedAt = Date.now();
  return next;
}
async function setSettings(partial, opts = {}) {
  const current = opts.base && typeof opts.base === "object" ? opts.base : await getSettings();
  const next = applySettingsPartial(current, partial);
  await storageSetValue(SETTINGS_STORAGE_KEY, next, { dualWrite: true });
  return next;
}
async function resetAllSettings() {
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
    deferredOpen: normalizeDeferredOpen(null),
    actionsLibraryTableExpanded: [...DEFAULT_SETTINGS.actionsLibraryTableExpanded],
    actionsLibraryInstructionsExpanded: DEFAULT_SETTINGS.actionsLibraryInstructionsExpanded,
    _updatedAt: Date.now()
  };
  await storageSetValue(SETTINGS_STORAGE_KEY, next, { dualWrite: true });
  return getSettings();
}
var SETTINGS_STORAGE_KEY, DEFERRED_OPEN_MIN_MINUTES, DEFERRED_OPEN_MAX_MINUTES, OVERLAY_FILL_MAX_SIZE_MIN, OVERLAY_FILL_MAX_SIZE_MAX, OVERLAY_FILL_MAX_SIZE_DEFAULT, TEXT_FOCUS_STYLE_IDS, CLICK_EFFECT_IDS, DEFAULT_SETTINGS, PANEL_ANCHOR_IDS;
var init_settings_manager = __esm({
  "src/modules/settings-manager.js"() {
    init_constants();
    init_schema();
    init_keyboard_layouts();
    init_keyboard_hardware_layouts();
    init_search_engines();
    init_storage();
    init_platform();
    init_focus_color();
    SETTINGS_STORAGE_KEY = "kp_settings_v1";
    DEFERRED_OPEN_MIN_MINUTES = 1;
    DEFERRED_OPEN_MAX_MINUTES = 48 * 60;
    OVERLAY_FILL_MAX_SIZE_MIN = 20;
    OVERLAY_FILL_MAX_SIZE_MAX = 2e3;
    OVERLAY_FILL_MAX_SIZE_DEFAULT = 250;
    TEXT_FOCUS_STYLE_IDS = Object.freeze(
      /** @type {const} */
      [
        "left_edge",
        "background_tint"
      ]
    );
    CLICK_EFFECT_IDS = Object.freeze(
      /** @type {const} */
      [
        "flash",
        "dash",
        "marquee",
        "scale",
        "none"
      ]
    );
    DEFAULT_SETTINGS = Object.freeze({
      themeId: DEFAULT_THEME_ID,
      themeOverrides: Object.freeze({}),
      // Last theme whose clickDefaults were written into clickMode/cursorMode.
      // Empty means never synced (adopt the active theme's click defaults once).
      clickModeThemeId: "",
      searchEngine: DEFAULT_SEARCH_ENGINE_ID,
      cursorMode: CURSOR_MODE.NO_CUSTOM_CURSORS,
      // New model:
      // - keyboardLayoutFamilyId + keyboardHandedness are the user-facing selection.
      // - keyboardLayoutId is the resolved concrete implementation (kept for back-compat + early-inject).
      keyboardLayoutFamilyId: DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID,
      keyboardHandedness: DEFAULT_KEYBOARD_HANDEDNESS,
      keyboardLayoutId: DEFAULT_KEYBOARD_LAYOUT_ID,
      // Physical keycap model for Keyboard Reference. This remains independent
      // from Chrome UI language and OS input-source selection.
      keyboardHardwareLayoutId: DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID,
      // Active layout selection for runtime + keyboard reference:
      // - 'builtin' uses the current built-in family + handedness selection.
      // - 'user:<layoutId>' uses a stored user layout (created/duplicated in Alt+C).
      currentKeyboardLayoutId: "builtin",
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
      actionsLibraryTableExpanded: Object.freeze(["functions", "macros", "macroKeys"]),
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
        keyboardReference: Object.freeze({ anchor: "bottom-left" }),
        controlStrip: Object.freeze({ anchor: "top-left" }),
        keyboardLayoutConfig: Object.freeze({ anchor: "middle-right" }),
        // Empty: first open stays viewport-centered until the user moves/resizes.
        topSites: Object.freeze({})
      }),
      // Per-key action settings (Keyboard Reference mode switches / config params).
      actionSettings: Object.freeze({
        RECTANGLE_HIGHLIGHT: Object.freeze({
          mode: "element",
          parameters: Object.freeze({})
        })
      }),
      clickMode: Object.freeze({
        cursor: Object.freeze({
          type: "crosshair",
          // Cursor SVG stroke width. Slider range: 1–12.
          lineWidth: 4,
          // Cursor size in pixels. Default is half of previous (was ~30px, now 15px).
          sizePixels: 10,
          // Gap between center and crosshair bars in pixels. 0 = intersecting lines, >0 = separate bars.
          gap: 6
        }),
        // Hover focus ring color (DOM-hover mode default is blue).
        focusColor: "blue",
        // When true, the focus rectangle can include a translucent fill (where applicable).
        overlayFillEnabled: true,
        overlayFillMaxWidth: OVERLAY_FILL_MAX_SIZE_DEFAULT,
        overlayFillMaxHeight: OVERLAY_FILL_MAX_SIZE_DEFAULT,
        // When true, draw a soft outer glow/shadow on the focus rectangle.
        overlayShadowEnabled: false,
        // Focus rectangle border thickness in px.
        rectangleThickness: 3,
        // F-key activation feedback on link-style targets (flash is the default).
        clickEffect: "flash",
        // When true, hovering a link glows matching green keys on the Keyboard Reference.
        // Off by default (opt-in via Settings → Click Mode).
        keyboardLinkHoverHints: false,
        // Default skip DOM outline (A); use in-target (B) then body-fixed (C).
        // Matches Shadow Root Debug “Auto B→C”.
        paintStrategy: "BC",
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
        cursorType: "t_square",
        // When true, show both labels: "Active text field" + "Press ESC to close".
        labelsEnabled: false,
        // Stroke thickness in px for orange text-mode rectangles.
        strokeThickness: 3,
        // How the focused text field is styled while in text mode.
        // left_edge: pulsating orange bar on the left inset edge (default).
        // background_tint: full-field orange wash (legacy).
        focusStyle: "left_edge",
        // Width of the left-edge pulse bar in px (when focusStyle is left_edge).
        leftEdgeWidth: 5
      }),
      scroll: Object.freeze({
        // C / V scroll distance in pixels (default = prior 400 × 1.25).
        halfPagePx: SCROLL.HALF_PAGE_PX,
        // Animation speed for keyboard scrolling: smooth (animated) or instant (jump).
        speed: SCROLL.BEHAVIOR === "smooth" ? "smooth" : "instant",
        // Middle mouse button → Scroll Line Function (empty page only). On by default on Mac.
        middleClickScrollLine: isMacPlatform(),
        // Scroll Line: skip horizontal-only landscape overflow (carousels).
        linePreferPortraitTargets: true
      }),
      deferredOpen: Object.freeze({
        // Bonus feature. Missing `enabled` on older stored settings stays off.
        enabled: false,
        // 'auto' asks on enable; 'applied' wrote 1/2/4; 'kept' left existing keys.
        numberRowKeys: "auto",
        openUrls: Object.freeze({
          enabled: true,
          minMinutes: 1,
          maxMinutes: 60
        }),
        randomBookmarks: Object.freeze({
          enabled: true,
          minMinutes: 1,
          maxMinutes: 60
        }),
        clickElement: Object.freeze({
          enabled: true,
          minMinutes: 1,
          maxMinutes: 60
        }),
        closeTab: Object.freeze({
          enabled: true,
          minMinutes: 1,
          maxMinutes: 60
        }),
        closeWindow: Object.freeze({
          enabled: true,
          minMinutes: 1,
          maxMinutes: 60
        }),
        target: "activeWindow",
        silentRandomScheduling: false
      })
    });
    PANEL_ANCHOR_IDS = /* @__PURE__ */ new Set([
      "top-left",
      "top-center",
      "top-right",
      "middle-left",
      "middle-right",
      "bottom-left",
      "bottom-center",
      "bottom-right"
    ]);
  }
});

// pages/settings.js
init_constants();
init_keyboard_layouts();
init_search_engines();
init_settings_manager();
init_focus_color();

// src/modules/settings-controller.js
init_settings_manager();

// themes/index.js
init_schema();

// themes/dark-pro/theme.js
init_schema();

// themes/chrome-recipes.js
var METAL_SPECULAR = "linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.08) 28%, transparent 55%)";
function createDarkProColor() {
  return {
    bg: "#0f0f10",
    panel: "#232323",
    panelEdge: "#3a3a3a",
    panelEdgeDark: "#111",
    titleTop: "#4c4c4c",
    titleMid: "#353535",
    titleBot: "#252525",
    btnTop: "#4a4a4a",
    btnMid: "#343434",
    btnBot: "#2a2a2a",
    litTop: "#5a7a9a",
    litBot: "#3a5570",
    litEdge: "#2a4a66",
    accent: "#4a90c8",
    accent2: "#4a90c8",
    fg: "#ddd",
    fgDim: "#aaa",
    fgMute: "#777",
    fieldBg: "#141414",
    fieldEdge: "#0a0a0a",
    fieldInsetTop: "#333",
    hover: "rgba(255,255,255,0.06)",
    selected: "rgba(74,144,200,0.22)",
    selectedText: "#e8f0f8",
    focusRing: "inset 0 0 0 1px rgba(74,144,200,0.55)",
    kbdColor: "#ddd",
    scrollbarThumb: "#4a4a4a",
    scrollbarThumbHover: "#5c5c5c",
    scrollbarTrack: "#141414"
  };
}
function createDarkProEffect(c) {
  return {
    titlebarBg: `linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    titlebarBorder: `1px solid ${c.panelEdgeDark}`,
    titlebarShadow: `0 1px 0 ${c.panelEdge}`,
    panelBg: c.panel,
    panelBorder: `1px solid ${c.panelEdgeDark}`,
    panelShadow: `0 0 0 1px ${c.panelEdge} inset, 0 0 0 1px rgba(190, 190, 190, 0.52), 0 0 10px rgba(255, 255, 255, 0.14), 0 16px 40px rgba(0,0,0,0.55)`,
    btnBg: `linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 50%, ${c.btnBot} 100%)`,
    btnBorder: `1px solid ${c.panelEdgeDark}`,
    btnLitBg: `linear-gradient(180deg, ${c.litTop} 0%, ${c.litBot} 100%)`,
    btnLitBorder: `1px solid ${c.litEdge}`,
    fieldBg: c.fieldBg,
    fieldBorder: `1px solid ${c.fieldEdge}`,
    fieldShadow: `inset 0 1px 0 ${c.fieldInsetTop}`,
    kbdBg: c.fieldBg,
    kbdBorder: `1px solid ${c.panelEdgeDark}`,
    kbdShadow: "none",
    backdropBg: "rgba(0,0,0,0.35)",
    backdropBlur: "blur(6px)",
    hatchEdit: "repeating-linear-gradient(-45deg, rgba(180, 200, 220, 0.08) 0px, rgba(180, 200, 220, 0.08) 1px, transparent 1px, transparent 7px)",
    hatchEditTitlebarBg: "linear-gradient(180deg, #646464 0%, #4a4a4a 45%, #383838 100%)",
    hatchEditBodyBg: "#1a1c20"
  };
}
function createMetalColor() {
  return {
    bg: "#6e6e6e",
    panel: "#838383",
    panelEdge: "rgba(190,190,190,0.48)",
    panelEdgeDark: "rgba(42,52,62,0.92)",
    titleTop: "#b0b0b0",
    titleMid: "#929292",
    titleBot: "#787878",
    btnTop: "#c2c2c2",
    btnMid: "#9e9e9e",
    btnBot: "#868686",
    litTop: "#7aa0c0",
    litBot: "#4a7090",
    litEdge: "#3a5a78",
    accent: "#3a6a94",
    accent2: "#3a6a94",
    fg: "#1c1c1c",
    fgDim: "rgba(28,28,28,0.72)",
    fgMute: "rgba(28,28,28,0.55)",
    fieldBg: "#9a9a9a",
    fieldEdge: "#4a4a4a",
    fieldInsetTop: "rgba(255,255,255,0.35)",
    hover: "rgba(255,255,255,0.22)",
    selected: "rgba(58,106,148,0.28)",
    selectedText: "#0e1a24",
    focusRing: "inset 0 0 0 1px rgba(58,106,148,0.55)",
    kbdColor: "#141414",
    scrollbarThumb: "#a8a8a8",
    scrollbarThumbHover: "#b5b5b5",
    scrollbarTrack: "#747474"
  };
}
function createMetalEffect(c) {
  return {
    titlebarBg: `${METAL_SPECULAR}, linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    titlebarBorder: "1px solid #4a4a4a",
    titlebarShadow: "0 1px 0 rgba(255,255,255,0.35)",
    panelBg: `${METAL_SPECULAR}, linear-gradient(180deg, #9a9a9a 0%, #838383 48%, #707070 100%)`,
    panelBorder: "1px solid rgba(42,52,62,0.92)",
    panelShadow: "0 0 0 1px rgba(255,255,255,0.28) inset, 0 0 0 1px rgba(190,190,190,0.48), 0 0 10px rgba(255,255,255,0.12), 0 16px 40px rgba(0,0,0,0.45)",
    btnBg: `linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 50%, ${c.btnBot} 100%)`,
    btnBorder: "1px solid #4a4a4a",
    btnLitBg: `linear-gradient(180deg, ${c.litTop} 0%, ${c.litBot} 100%)`,
    btnLitBorder: `1px solid ${c.litEdge}`,
    fieldBg: c.fieldBg,
    fieldBorder: "1px solid #4a4a4a",
    fieldShadow: "inset 0 1px 0 rgba(255,255,255,0.40)",
    kbdBg: "linear-gradient(180deg, #e4e4e4 0%, #c8c8c8 45%, #b0b0b0 55%, #9a9a9a 100%)",
    kbdBorder: "1px solid #3d3d3d",
    kbdShadow: "0 1px 0 rgba(255,255,255,0.72) inset, 0 -1px 0 rgba(0,0,0,0.28) inset, 0 1px 2px rgba(0,0,0,0.32)",
    backdropBg: "rgba(40,40,40,0.35)",
    backdropBlur: "blur(6px)",
    hatchEdit: "repeating-linear-gradient(-45deg, rgba(24, 24, 24, 0.28) 0px, rgba(24, 24, 24, 0.28) 1px, transparent 1px, transparent 7px)",
    hatchEditTitlebarBg: `${METAL_SPECULAR}, linear-gradient(180deg, #b8b8b8 0%, #9a9a9a 45%, #808080 100%)`,
    hatchEditBodyBg: "#8a8a8a"
  };
}
function createGxColor() {
  return {
    bg: "#0a0a0c",
    panel: "#16161a",
    panelEdge: "#2a2a32",
    panelEdgeDark: "#050506",
    titleTop: "#2c2c34",
    titleMid: "#1c1c22",
    titleBot: "#121216",
    btnTop: "#3a3a44",
    btnMid: "#26262e",
    btnBot: "#1a1a20",
    litTop: "#00e5ff",
    litBot: "#0088aa",
    litEdge: "#006688",
    accent: "#00e5ff",
    accent2: "#ff2d95",
    fg: "#e8e8ef",
    fgDim: "#9aa0b0",
    fgMute: "#6a7080",
    fieldBg: "#0c0c10",
    fieldEdge: "#000",
    fieldInsetTop: "#333344",
    hover: "rgba(0,229,255,0.08)",
    selected: "rgba(0,229,255,0.18)",
    selectedText: "#f0ffff",
    focusRing: "inset 0 0 0 1px rgba(0,229,255,0.55)",
    kbdColor: "#00e5ff",
    scrollbarThumb: "#3a3a44",
    scrollbarThumbHover: "#00e5ff",
    scrollbarTrack: "#0c0c10"
  };
}
function createGxEffect(c) {
  return {
    titlebarBg: `linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    titlebarBorder: `1px solid ${c.panelEdgeDark}`,
    titlebarShadow: `0 1px 0 ${c.accent}33`,
    panelBg: `linear-gradient(180deg, #1c1c22 0%, ${c.panel} 48%, #101014 100%)`,
    panelBorder: `1px solid ${c.panelEdgeDark}`,
    panelShadow: `0 0 0 1px ${c.panelEdge} inset, 0 0 0 1px rgba(0, 229, 255, 0.22), 0 0 14px rgba(0, 229, 255, 0.12), 0 16px 40px rgba(0,0,0,0.65)`,
    btnBg: `linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 50%, ${c.btnBot} 100%)`,
    btnBorder: `1px solid ${c.panelEdgeDark}`,
    btnLitBg: `linear-gradient(180deg, ${c.litTop} 0%, ${c.litBot} 100%)`,
    btnLitBorder: `1px solid ${c.litEdge}`,
    fieldBg: c.fieldBg,
    fieldBorder: `1px solid ${c.fieldEdge}`,
    fieldShadow: `inset 0 1px 0 ${c.fieldInsetTop}`,
    kbdBg: "rgba(0, 229, 255, 0.08)",
    kbdBorder: `1px solid ${c.accent}`,
    kbdShadow: `0 0 0 1px ${c.accent}55, 0 0 8px ${c.accent}44`,
    backdropBg: "rgba(0,0,0,0.5)",
    backdropBlur: "blur(8px)",
    hatchEdit: "repeating-linear-gradient(-45deg, rgba(0, 229, 255, 0.16) 0px, rgba(0, 229, 255, 0.16) 1px, transparent 1px, transparent 7px)",
    hatchEditTitlebarBg: `linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    hatchEditBodyBg: "#101014"
  };
}

// themes/click-defaults.js
var NO_CUSTOM = "NO-CUSTOM-CURSORS";
var DARK_PRO_CLICK_DEFAULTS = Object.freeze({
  cursorMode: NO_CUSTOM,
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: "crosshair",
      lineWidth: 4,
      sizePixels: 10,
      gap: 6
    }),
    focusColor: "blue",
    overlayFillEnabled: true,
    overlayFillMaxWidth: 250,
    overlayFillMaxHeight: 250,
    overlayShadowEnabled: false,
    rectangleThickness: 3,
    clickEffect: "flash",
    keyboardLinkHoverHints: false,
    paintStrategy: "BC",
    focusPadding: 2,
    skipForParent: true
  })
});
var GRAY_METAL_CLICK_DEFAULTS = Object.freeze({
  cursorMode: NO_CUSTOM,
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: "crosshair",
      lineWidth: 5,
      sizePixels: 12,
      gap: 6
    }),
    focusColor: "blue",
    overlayFillEnabled: true,
    overlayFillMaxWidth: 250,
    overlayFillMaxHeight: 250,
    overlayShadowEnabled: false,
    rectangleThickness: 4,
    clickEffect: "flash",
    keyboardLinkHoverHints: false,
    paintStrategy: "BC",
    focusPadding: 2,
    skipForParent: true
  })
});
var GX_ER_CLICK_DEFAULTS = Object.freeze({
  cursorMode: NO_CUSTOM,
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: "crosshair",
      lineWidth: 3,
      sizePixels: 14,
      gap: 8
    }),
    focusColor: "green",
    overlayFillEnabled: false,
    overlayFillMaxWidth: 250,
    overlayFillMaxHeight: 250,
    overlayShadowEnabled: true,
    rectangleThickness: 3,
    clickEffect: "flash",
    keyboardLinkHoverHints: false,
    paintStrategy: "BC",
    focusPadding: 2,
    skipForParent: true
  })
});

// themes/dark-pro/theme.js
var color = createDarkProColor();
var metalColor = createMetalColor();
var DARK_PRO_THEME = Object.freeze({
  id: "dark-pro",
  meta: Object.freeze({ name: "Dark Pro" }),
  type: createProTypeTokens(),
  titlebar: createTitlebarChromeTokens(),
  keys: createKeyChromeTokens(),
  radius: createProRadiusTokens(),
  color,
  effect: createDarkProEffect(color),
  shape: Object.freeze({ cornerMode: "radius", cutSize: "0px" }),
  icons: Object.freeze({
    pack: "dark-pro",
    fallbackPack: "shared",
    overrides: Object.freeze({}),
    color: Object.freeze({
      chrome: color.fg,
      keycap: "#0c1018",
      accent: color.accent
    })
  }),
  clickDefaults: DARK_PRO_CLICK_DEFAULTS,
  surfaces: Object.freeze({
    onboarding: Object.freeze({
      color: metalColor,
      effect: createMetalEffect(metalColor),
      icons: Object.freeze({
        color: Object.freeze({
          chrome: metalColor.fg,
          keycap: "#1c1c1c",
          accent: metalColor.accent
        })
      })
    })
  })
});

// themes/gray-metal-pro/theme.js
init_schema();
var color2 = createMetalColor();
var GRAY_METAL_PRO_THEME = Object.freeze({
  id: "gray-metal-pro",
  meta: Object.freeze({ name: "Gray Metal Pro" }),
  type: createProTypeTokens({
    ui: "Helvetica, Arial, sans-serif"
  }),
  titlebar: createTitlebarChromeTokens(),
  keys: createKeyChromeTokens(),
  radius: createProRadiusTokens({ panel: "3px", btn: "2px" }),
  color: color2,
  effect: createMetalEffect(color2),
  shape: Object.freeze({ cornerMode: "radius", cutSize: "0px" }),
  icons: Object.freeze({
    pack: "gray-metal-pro",
    fallbackPack: "shared",
    overrides: Object.freeze({}),
    color: Object.freeze({
      chrome: color2.fg,
      keycap: "#1c1c1c",
      accent: color2.accent
    })
  }),
  clickDefaults: GRAY_METAL_CLICK_DEFAULTS
});

// themes/gx-er/theme.js
init_schema();
var color3 = createGxColor();
var type = createProTypeTokens({
  display: "'ROBOTECHGPRegular', 'TitilliumText', Helvetica, Arial, sans-serif",
  heading: "'Cubellan', 'TitilliumText', Helvetica, Arial, sans-serif",
  subhead: "'TitilliumText', Helvetica, Arial, sans-serif",
  body: "'Ezarion', 'Dosis', Helvetica, Arial, sans-serif",
  ui: "'TitilliumText', Helvetica, Arial, sans-serif",
  kbd: "'Dosis', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  mono: "'Dosis', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  caption: "'Ezarion', Helvetica, Arial, sans-serif"
});
type.letterSpacing = {
  display: "0.08em",
  titlebar: "0.06em",
  ui: "0.02em"
};
type.textTransform = {
  display: "uppercase",
  titlebar: "uppercase"
};
var GX_ER_THEME = Object.freeze({
  id: "gx-er",
  meta: Object.freeze({ name: "GX-er" }),
  type,
  titlebar: createTitlebarChromeTokens({
    titleWeight: "700",
    iconDisplay: "inline-flex",
    iconSize: "12px",
    kbdTransform: "uppercase",
    kbdTracking: "0.06em"
  }),
  keys: createKeyChromeTokens({
    shading: "flat",
    border: "1px solid rgba(0, 229, 255, 0.35)",
    cornerMode: "cut",
    cutSize: "4px"
  }),
  radius: createProRadiusTokens({
    panel: "0px",
    btn: "0px",
    field: "0px",
    xs: "0px",
    sm: "0px"
  }),
  color: color3,
  effect: createGxEffect(color3),
  shape: Object.freeze({ cornerMode: "cut", cutSize: "8px" }),
  icons: Object.freeze({
    pack: "gx-er",
    fallbackPack: "shared",
    overrides: Object.freeze({
      close: "chrome/close.svg",
      collapse: "chrome/collapse.svg"
    }),
    color: Object.freeze({
      chrome: color3.accent,
      keycap: "#001018",
      accent: color3.accent
    })
  }),
  clickDefaults: GX_ER_CLICK_DEFAULTS
});

// themes/icons.js
var THEME_ICON_FILES = Object.freeze({
  close: "chrome/close.svg",
  collapse: "chrome/collapse.svg",
  gear: "chrome/gear.svg",
  keyboard: "chrome/keyboard.svg",
  window: "chrome/window.svg"
});
var THEME_ICON_IDS = Object.freeze(Object.keys(THEME_ICON_FILES));
function getThemeIconUrl(semanticId, theme) {
  const id = typeof semanticId === "string" ? semanticId : "";
  const baseFile = THEME_ICON_FILES[id];
  if (!baseFile || !id) return "";
  const pack = theme?.icons?.pack || "shared";
  const fallback = theme?.icons?.fallbackPack || "shared";
  const override = theme?.icons?.overrides && theme.icons.overrides[id];
  const file = typeof override === "string" && override.trim() ? override.trim() : baseFile;
  const folder = override ? pack : fallback;
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(`themes/${folder}/icons/${file}`);
    }
  } catch {
  }
  return `themes/${folder}/icons/${file}`;
}

// themes/index.js
var PACKAGES = Object.freeze({
  "dark-pro": DARK_PRO_THEME,
  "gray-metal-pro": GRAY_METAL_PRO_THEME,
  "gx-er": GX_ER_THEME
});
function listThemes() {
  return THEME_IDS.map((id) => ({ id, name: THEME_META[id]?.name || id }));
}
function getTheme(id, overrides) {
  const key2 = normalizeThemeId(id);
  const base = PACKAGES[key2] || PACKAGES[DEFAULT_THEME_ID];
  return mergeTheme(base, overrides && typeof overrides === "object" ? overrides : {});
}
function getAllThemesCss() {
  const blocks = THEME_IDS.map((id) => {
    const vars = themeToCssVars(getTheme(id));
    return cssVarsToBlock(
      vars,
      `:host([data-kp-theme="${id}"]), [data-kp-theme="${id}"]`
    );
  });
  const onboarding = themeToCssVars(
    mergeTheme(DARK_PRO_THEME, DARK_PRO_THEME.surfaces?.onboarding || {})
  );
  blocks.push(cssVarsToBlock(
    onboarding,
    `[data-kp-theme="dark-pro"][data-kp-surface="onboarding"], [data-kp-theme="dark-pro"] [data-kp-surface="onboarding"]`
  ));
  return `${blocks.join("\n")}
${getCutCornerCss()}
${getTitlebarChromeCss()}
${getSelectMenuCss()}`;
}
function getThemeCss(theme) {
  const vars = themeToCssVars(theme);
  const id = theme?.id || DEFAULT_THEME_ID;
  return `${cssVarsToBlock(vars, `:host, :root, [data-kp-theme="${id}"]`)}
${getCutCornerCss()}
${getTitlebarChromeCss()}
${getSelectMenuCss()}`;
}

// themes/font-faces.js
function fontUrl(file) {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(`fonts/${file}`);
    }
  } catch {
  }
  return `../fonts/${file}`;
}
function getThemeFontFaceCss() {
  const robotech = fontUrl("ROBOTECHGPRegular.ttf");
  const titillium = fontUrl("TitilliumTextRegular.otf");
  const titilliumBold = fontUrl("TitilliumTextBold.ttf");
  const cubellan = fontUrl("CubellanRegular.ttf");
  const ezarion = fontUrl("EzarionRegular.ttf");
  const dosis = fontUrl("DosisBook.ttf");
  return `
@font-face {
  font-family: 'ROBOTECHGPRegular';
  src: url('${robotech}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'TitilliumText';
  src: url('${titillium}') format('opentype');
  font-weight: 100 500;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'TitilliumText';
  src: url('${titilliumBold}') format('truetype');
  font-weight: 600 900;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'Cubellan';
  src: url('${cubellan}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'Ezarion';
  src: url('${ezarion}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'Dosis';
  src: url('${dosis}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
`.trim();
}

// src/modules/theme-manager.js
var STYLE_ATTR = "data-kp-theme-vars";
var FONT_ATTR = "data-kp-theme-fonts";
var ALL_THEMES_ATTR = "data-kp-all-themes";
var _activeTheme = getTheme(DEFAULT_THEME_ID);
var _listeners = /* @__PURE__ */ new Set();
function notify() {
  for (const fn of _listeners) {
    try {
      fn(_activeTheme);
    } catch {
    }
  }
}
function injectStyle(root, css, attr) {
  if (!root) return;
  const doc = root.nodeType === 9 ? root : root.ownerDocument || document;
  const mount = root.nodeType === 9 ? root.head || root.documentElement : root.host ? root : root;
  if (!doc || !mount?.appendChild) return;
  let style = null;
  try {
    style = mount.querySelector?.(`style[${attr}]`);
  } catch {
  }
  if (!style) {
    try {
      style = doc.createElement("style");
      style.setAttribute(attr, "true");
      style.textContent = css;
      mount.appendChild(style);
    } catch {
    }
    return;
  }
  if (style.textContent !== css) {
    try {
      style.textContent = css;
    } catch {
    }
  }
}
function applyThemeDataset(el2, theme) {
  if (!el2?.setAttribute) return;
  const id = theme?.id || DEFAULT_THEME_ID;
  try {
    el2.setAttribute("data-kp-theme", id);
  } catch {
  }
  const cut = theme?.shape?.cornerMode === "cut";
  try {
    if (cut) el2.setAttribute("data-kp-corner", "cut");
    else el2.removeAttribute("data-kp-corner");
  } catch {
  }
}
function applyThemeCssVars(el2, theme) {
  if (!el2?.style?.setProperty) return;
  const vars = themeToCssVars(theme);
  for (const [k, v] of Object.entries(vars)) {
    try {
      el2.style.setProperty(k, v);
    } catch {
    }
  }
}
function injectAllThemeMaps(root = document) {
  injectStyle(root, getThemeFontFaceCss(), FONT_ATTR);
  injectStyle(root, `${getAllThemesCss()}
${getCutCornerCss()}`, ALL_THEMES_ATTR);
}
var CHROME_THEME_HOST_SEL = [
  ".kp-chrome-window",
  "[data-kp-ui-shadow]",
  "[data-kp-select]",
  ".kp-select-menu-host",
  ".kp-select-menu",
  ".kpv2-settings-host",
  ".kpv2-docs-host"
].join(", ");
function collectChromeThemeHosts(root, out = [], seen = /* @__PURE__ */ new Set()) {
  if (!root) return out;
  const addHost = (el2) => {
    if (!el2 || seen.has(el2)) return;
    seen.add(el2);
    out.push(el2);
    try {
      if (el2.shadowRoot) collectChromeThemeHosts(el2.shadowRoot, out, seen);
    } catch {
    }
  };
  try {
    if (root.querySelectorAll) {
      root.querySelectorAll(CHROME_THEME_HOST_SEL).forEach(addHost);
    }
  } catch {
  }
  return out;
}
function paintShadowTheme(shadow, theme) {
  if (!shadow) return;
  injectAllThemeMaps(shadow);
  injectStyle(shadow, getThemeCss(theme), STYLE_ATTR);
}
function syncThemedIconMasks(root, theme) {
  if (!root?.querySelectorAll) return;
  try {
    root.querySelectorAll("[data-kp-theme-icon]").forEach((el2) => {
      const id = el2.getAttribute("data-kp-theme-icon");
      const url = getThemeIconUrl(id, theme);
      if (!url || !el2.style) return;
      const img = `url("${String(url).replace(/"/g, '\\"')}")`;
      try {
        el2.style.webkitMaskImage = img;
      } catch {
      }
      try {
        el2.style.maskImage = img;
      } catch {
      }
    });
  } catch {
  }
}
function applyThemeToRoots(theme, opts = {}) {
  _activeTheme = theme || getTheme(DEFAULT_THEME_ID);
  const roots = opts.roots && opts.roots.length ? opts.roots : [document];
  const hostSet = /* @__PURE__ */ new Set();
  for (const host of opts.hosts || []) {
    if (host) hostSet.add(host);
  }
  try {
    collectChromeThemeHosts(document).forEach((el2) => hostSet.add(el2));
  } catch {
  }
  for (const root of roots) {
    collectChromeThemeHosts(root).forEach((el2) => hostSet.add(el2));
  }
  for (const root of roots) {
    if (!root) continue;
    injectAllThemeMaps(root);
    injectStyle(root, getThemeCss(_activeTheme), STYLE_ATTR);
    const el2 = root.nodeType === 9 ? root.documentElement : root.host || null;
    applyThemeDataset(el2, _activeTheme);
    if (el2) applyThemeCssVars(el2, _activeTheme);
  }
  for (const host of hostSet) {
    applyThemeDataset(host, _activeTheme);
    applyThemeCssVars(host, _activeTheme);
    if (host?.shadowRoot) {
      paintShadowTheme(host.shadowRoot, _activeTheme);
      applyThemeDataset(host.shadowRoot.host, _activeTheme);
      syncThemedIconMasks(host.shadowRoot, _activeTheme);
    }
    syncThemedIconMasks(host, _activeTheme);
  }
  for (const root of roots) {
    syncThemedIconMasks(root, _activeTheme);
  }
  try {
    applyThemeDataset(document.documentElement, _activeTheme);
    applyThemeCssVars(document.documentElement, _activeTheme);
    injectAllThemeMaps(document);
    injectStyle(document, getThemeCss(_activeTheme), STYLE_ATTR);
    syncThemedIconMasks(document, _activeTheme);
  } catch {
  }
  notify();
  try {
    const id = _activeTheme?.id;
    if (id) localStorage.setItem("kp_theme_id_v1", id);
  } catch {
  }
  try {
    const keys = _activeTheme?.keys || {};
    localStorage.setItem("kp_theme_overrides_v1", JSON.stringify({
      keys: {
        shading: keys.shading === "flat" ? "flat" : "bevel",
        cornerMode: keys.cornerMode === "cut" ? "cut" : "radius",
        cutSize: keys.cutSize || "4px",
        border: keys.border || "1px solid rgba(0, 0, 0, 0.4)"
      },
      titlebar: {
        iconDisplay: _activeTheme?.titlebar?.iconDisplay === "inline-flex" ? "inline-flex" : "none"
      }
    }));
  } catch {
  }
  return _activeTheme;
}
var THEME_PACK_LOCKED_TO_DEFAULT = true;
function resolveThemeFromSettings(settings) {
  if (THEME_PACK_LOCKED_TO_DEFAULT) {
    return getTheme(DEFAULT_THEME_ID);
  }
  const id = normalizeThemeId(settings?.themeId);
  const overrides = settings?.themeOverrides && typeof settings.themeOverrides === "object" ? settings.themeOverrides : {};
  return getTheme(id, overrides);
}
function getThemeClickDefaults(theme = _activeTheme) {
  const d = theme?.clickDefaults || getTheme(DEFAULT_THEME_ID).clickDefaults;
  return {
    cursorMode: d.cursorMode,
    clickMode: {
      ...d.clickMode || {},
      cursor: { ...d.clickMode?.cursor || {} }
    }
  };
}

// src/modules/settings-path.js
function cloneJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch {
    return fallback;
  }
}
function clampNumber(n, min, max) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}
function pathToPartial(path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length) return {};
  let out = value;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    out = { [parts[i]]: out };
  }
  return (
    /** @type {Record<string, any>} */
    out
  );
}
function setOverridePath(overrides, path, value) {
  const next = cloneJson(overrides && typeof overrides === "object" ? overrides : {}, {});
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length) return next;
  let cur = next;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key2 = parts[i];
    const child = cur[key2];
    if (!child || typeof child !== "object" || Array.isArray(child)) {
      cur[key2] = {};
    }
    cur = cur[key2];
  }
  cur[parts[parts.length - 1]] = value;
  return next;
}

// src/modules/settings-controller.js
var SettingsController = class {
  constructor() {
    this.state = /** @type {any} */
    { ...DEFAULT_SETTINGS };
    this._listeners = /* @__PURE__ */ new Set();
    this._disposed = false;
    this._storageAttached = false;
    this._pendingWrites = 0;
    this._writeChain = Promise.resolve();
    this._onStorageChanged = this._onStorageChanged.bind(this);
  }
  get disposed() {
    return this._disposed;
  }
  /**
   * @param {(state: any) => void} fn
   * @returns {() => void}
   */
  subscribe(fn) {
    if (typeof fn !== "function" || this._disposed) return () => {
    };
    this._listeners.add(fn);
    return () => {
      this._listeners.delete(fn);
    };
  }
  _emit() {
    if (this._disposed) return;
    for (const fn of this._listeners) {
      try {
        fn(this.state);
      } catch {
      }
    }
  }
  /**
   * @param {{ snapshot?: object|null }} [opts]
   */
  async load(opts = {}) {
    if (this._disposed) return this.state;
    const snap = opts.snapshot;
    if (snap && typeof snap === "object") {
      this.state = /** @type {any} */
      snap;
    } else {
      this.state = await getSettings();
    }
    this._attachStorage();
    this._emit();
    return this.state;
  }
  _attachStorage() {
    if (this._storageAttached || this._disposed) return;
    try {
      if (!chrome?.storage?.onChanged?.addListener) return;
      chrome.storage.onChanged.addListener(this._onStorageChanged);
      this._storageAttached = true;
    } catch {
    }
  }
  /**
   * @param {Record<string, chrome.storage.StorageChange>} changes
   * @param {string} area
   */
  async _onStorageChanged(changes, area) {
    if (this._disposed) return;
    if (this._pendingWrites > 0) return;
    if (area !== "sync" && area !== "local") return;
    const entry = changes?.[SETTINGS_STORAGE_KEY];
    if (!entry) return;
    const incomingAt = entry.newValue && typeof entry.newValue === "object" ? Number(entry.newValue._updatedAt) : NaN;
    if (Number.isFinite(incomingAt) && incomingAt === Number(this.state?._updatedAt)) {
      return;
    }
    try {
      this.state = await getSettings();
      this._emit();
    } catch {
      if (entry.newValue && typeof entry.newValue === "object") {
        this.state = /** @type {any} */
        entry.newValue;
        this._emit();
      }
    }
  }
  /**
   * @param {string} path
   * @param {any} value
   */
  async update(path, value) {
    if (this._disposed) return this.state;
    return this.updatePartial(pathToPartial(path, value));
  }
  /**
   * @param {Partial<import('./settings-manager.js').KeyPilotSettings>} partial
   */
  async updatePartial(partial) {
    if (this._disposed) return this.state;
    this.state = applySettingsPartial(this.state, partial);
    this._emit();
    this._pendingWrites += 1;
    const write = this._writeChain.then(async () => {
      if (this._disposed) return this.state;
      this.state = await setSettings(partial, { base: this.state });
      return this.state;
    }).finally(() => {
      this._pendingWrites = Math.max(0, this._pendingWrites - 1);
    });
    this._writeChain = write.then(() => {
    }, () => {
    });
    return write;
  }
  /**
   * @param {string} overridePath
   * @param {any} value
   */
  async updateThemeOverride(overridePath, value) {
    if (this._disposed) return this.state;
    const nextOverrides = setOverridePath(this.state?.themeOverrides, overridePath, value);
    return this.updatePartial({ themeOverrides: nextOverrides });
  }
  /**
   * @param {any} rawId
   */
  async applyThemePack(rawId) {
    if (this._disposed) return this.state;
    const themeId = normalizeThemeId(rawId);
    const theme = getTheme(themeId);
    const clickPatch = getThemeClickDefaults(theme);
    return this.updatePartial({
      themeId,
      themeOverrides: {},
      cursorMode: clickPatch.cursorMode,
      clickMode: clickPatch.clickMode,
      clickModeThemeId: themeId
    });
  }
  /**
   * @param {SettingsResetScope} scope
   */
  async reset(scope2) {
    if (this._disposed) return this.state;
    switch (scope2) {
      case "all":
        this.state = await resetAllSettings();
        this._emit();
        return this.state;
      case "appearance":
        return this.updatePartial({ themeOverrides: {} });
      case "click-cursor": {
        const defaults = getThemeClickDefaults(getTheme(this.state?.themeId));
        return this.updatePartial({
          clickMode: { cursor: { ...defaults.clickMode.cursor } }
        });
      }
      case "click-mode": {
        const defaults = getThemeClickDefaults(getTheme(this.state?.themeId));
        const { cursor: _cursor, ...clickModeDefaults } = defaults.clickMode;
        return this.updatePartial({ clickMode: { ...clickModeDefaults } });
      }
      case "text-cursor":
        return this.updatePartial({
          textMode: { cursorType: DEFAULT_SETTINGS.textMode.cursorType }
        });
      case "text-mode":
        return this.updatePartial({ textMode: { ...DEFAULT_SETTINGS.textMode } });
      case "scroll":
        return this.updatePartial({ scroll: { ...DEFAULT_SETTINGS.scroll } });
      default:
        return this.state;
    }
  }
  dispose() {
    this._disposed = true;
    this._listeners.clear();
    if (this._storageAttached) {
      try {
        chrome.storage.onChanged.removeListener(this._onStorageChanged);
      } catch {
      }
      this._storageAttached = false;
    }
  }
};
function createSettingsController() {
  return new SettingsController();
}

// src/modules/settings-binder.js
init_settings_manager();
var SETTINGS_CONTROLS = Object.freeze([
  { type: "radio", name: "engine", path: "searchEngine" },
  { type: "toggle", id: "keyboard-reference-key-feedback", path: "keyboardReferenceKeyFeedback" },
  { type: "toggle", id: "keyboard-reference-show-number-row", path: "keyboardReferenceShowNumberRow" },
  { type: "toggle", id: "deferred-silent-random", path: "deferredOpen.silentRandomScheduling" },
  { type: "toggle", id: "deferred-open-urls-enabled", path: "deferredOpen.openUrls.enabled" },
  { type: "rangePair", baseId: "deferred-open-urls-min", path: "deferredOpen.openUrls.minMinutes", min: 1, max: 2880 },
  { type: "rangePair", baseId: "deferred-open-urls-max", path: "deferredOpen.openUrls.maxMinutes", min: 1, max: 2880 },
  { type: "toggle", id: "deferred-random-bookmarks-enabled", path: "deferredOpen.randomBookmarks.enabled" },
  { type: "rangePair", baseId: "deferred-random-bookmarks-min", path: "deferredOpen.randomBookmarks.minMinutes", min: 1, max: 2880 },
  { type: "rangePair", baseId: "deferred-random-bookmarks-max", path: "deferredOpen.randomBookmarks.maxMinutes", min: 1, max: 2880 },
  { type: "toggle", id: "deferred-click-element-enabled", path: "deferredOpen.clickElement.enabled" },
  { type: "rangePair", baseId: "deferred-click-element-min", path: "deferredOpen.clickElement.minMinutes", min: 1, max: 2880 },
  { type: "rangePair", baseId: "deferred-click-element-max", path: "deferredOpen.clickElement.maxMinutes", min: 1, max: 2880 },
  { type: "toggle", id: "deferred-close-tab-enabled", path: "deferredOpen.closeTab.enabled" },
  { type: "rangePair", baseId: "deferred-close-tab-min", path: "deferredOpen.closeTab.minMinutes", min: 1, max: 2880 },
  { type: "rangePair", baseId: "deferred-close-tab-max", path: "deferredOpen.closeTab.maxMinutes", min: 1, max: 2880 },
  { type: "toggle", id: "deferred-close-window-enabled", path: "deferredOpen.closeWindow.enabled" },
  { type: "rangePair", baseId: "deferred-close-window-min", path: "deferredOpen.closeWindow.minMinutes", min: 1, max: 2880 },
  { type: "rangePair", baseId: "deferred-close-window-max", path: "deferredOpen.closeWindow.maxMinutes", min: 1, max: 2880 },
  {
    type: "select",
    id: "deferred-open-target",
    path: "deferredOpen.target",
    normalize: (v) => v === "originalWindow" ? "originalWindow" : "activeWindow"
  },
  { type: "toggle", id: "control-strip-visible", path: "controlStrip.visible" },
  { type: "toggle", id: "control-strip-collapsed", path: "controlStrip.collapsed" },
  { type: "select", id: "keyboard-layout-family", path: "keyboardLayoutFamilyId", viewTransition: true },
  {
    type: "toggle",
    id: "keyboard-left-handed",
    path: "keyboardHandedness",
    normalize: (checked) => checked ? "left" : "right",
    viewTransition: true
  },
  { type: "radio", name: "cursor-mode", path: "cursorMode", viewTransition: true },
  { type: "select", id: "click-cursor-type", path: "clickMode.cursor.type" },
  { type: "rangePair", baseId: "click-cursor-linewidth", path: "clickMode.cursor.lineWidth", min: 1, max: 12 },
  { type: "rangePair", baseId: "click-cursor-size", path: "clickMode.cursor.sizePixels", min: 5, max: 60 },
  { type: "rangePair", baseId: "click-cursor-gap", path: "clickMode.cursor.gap", min: 0, max: 20 },
  { type: "toggle", id: "click-overlay-fill", path: "clickMode.overlayFillEnabled" },
  {
    type: "rangePair",
    baseId: "click-overlay-fill-max-width",
    path: "clickMode.overlayFillMaxWidth",
    min: OVERLAY_FILL_MAX_SIZE_MIN,
    max: OVERLAY_FILL_MAX_SIZE_MAX
  },
  {
    type: "rangePair",
    baseId: "click-overlay-fill-max-height",
    path: "clickMode.overlayFillMaxHeight",
    min: OVERLAY_FILL_MAX_SIZE_MIN,
    max: OVERLAY_FILL_MAX_SIZE_MAX
  },
  { type: "toggle", id: "click-overlay-shadow", path: "clickMode.overlayShadowEnabled" },
  { type: "rangePair", baseId: "click-rect-thickness", path: "clickMode.rectangleThickness", min: 1, max: 16 },
  { type: "toggle", id: "click-keyboard-link-hints", path: "clickMode.keyboardLinkHoverHints" },
  { type: "select", id: "click-paint-strategy", path: "clickMode.paintStrategy" },
  { type: "toggle", id: "click-skip-for-parent", path: "clickMode.skipForParent" },
  { type: "toggle", id: "click-paint-backend-debug", path: "clickMode.paintBackendDebugDashes" },
  { type: "toggle", id: "debug-logging", path: "debugLogging" },
  { type: "rangePair", baseId: "click-focus-padding", path: "clickMode.focusPadding", min: 0, max: 16 },
  {
    type: "radio",
    name: "click-effect",
    path: "clickMode.clickEffect",
    normalize: (v) => CLICK_EFFECT_IDS.includes(
      /** @type {any} */
      v
    ) ? v : "flash"
  },
  { type: "select", id: "text-cursor-type", path: "textMode.cursorType" },
  { type: "toggle", id: "text-labels-enabled", path: "textMode.labelsEnabled" },
  { type: "radio", name: "text-focus-style", path: "textMode.focusStyle" },
  { type: "rangePair", baseId: "text-left-edge-width", path: "textMode.leftEdgeWidth", min: 1, max: 24 },
  { type: "rangePair", baseId: "text-stroke-thickness", path: "textMode.strokeThickness", min: 1, max: 16 },
  { type: "rangePair", baseId: "scroll-half-page", path: "scroll.halfPagePx", min: 50, max: 2e3 },
  {
    type: "select",
    id: "scroll-speed",
    path: "scroll.speed",
    normalize: (v) => v === "instant" ? "instant" : "smooth"
  },
  { type: "toggle", id: "scroll-middle-click-scroll-line", path: "scroll.middleClickScrollLine" },
  { type: "toggle", id: "scroll-line-prefer-portrait", path: "scroll.linePreferPortraitTargets" },
  { type: "appearanceRadio", name: "app-corner-mode", overridePath: "shape.cornerMode", normalize: (v) => v === "cut" ? "cut" : "radius" },
  { type: "appearanceRangePair", baseId: "app-cut-size", overridePath: "shape.cutSize", min: 0, max: 24 },
  { type: "appearanceRangePair", baseId: "app-panel-radius", overridePath: "radius.panel", min: 0, max: 24 },
  { type: "appearanceRadio", name: "app-title-transform", overridePath: "type.textTransform.titlebar", normalize: (v) => v === "uppercase" ? "uppercase" : "none" },
  {
    type: "appearanceControl",
    id: "app-title-tracking",
    event: "change",
    overridePath: "type.letterSpacing.titlebar",
    fromEl: (el2) => String(el2.value || "0.02em").trim() || "0.02em"
  },
  {
    type: "appearanceRadio",
    name: "app-title-weight",
    overridePath: "titlebar.titleWeight",
    normalize: (v) => v === "400" || v === "700" ? v : "600"
  },
  { type: "appearanceRadio", name: "app-title-icon", overridePath: "titlebar.iconDisplay", normalize: (v) => v === "inline-flex" ? "inline-flex" : "none" },
  { type: "appearanceRadio", name: "app-kbd-transform", overridePath: "titlebar.kbdTransform", normalize: (v) => v === "uppercase" ? "uppercase" : "none" },
  { type: "appearanceRadio", name: "app-key-shading", overridePath: "keys.shading", normalize: (v) => v === "flat" ? "flat" : "bevel" },
  { type: "appearanceRadio", name: "app-key-corner", overridePath: "keys.cornerMode", normalize: (v) => v === "cut" ? "cut" : "radius" },
  { type: "appearanceRangePair", baseId: "app-key-cut", overridePath: "keys.cutSize", min: 0, max: 16 },
  {
    type: "appearanceControl",
    id: "app-key-border",
    event: "change",
    overridePath: "keys.border",
    fromEl: (el2) => String(el2.value || "").trim() || "1px solid rgba(0, 0, 0, 0.4)"
  },
  { type: "appearanceControl", id: "app-color-accent", event: "input", overridePath: "color.accent", fromEl: (el2) => el2.value },
  { type: "appearanceControl", id: "app-color-fg", event: "input", overridePath: "color.fg", fromEl: (el2) => el2.value },
  { type: "appearanceControl", id: "app-color-fg-dim", event: "input", overridePath: "color.fgDim", fromEl: (el2) => el2.value },
  { type: "appearanceControl", id: "app-color-panel", event: "input", overridePath: "color.panel", fromEl: (el2) => el2.value },
  { type: "appearanceControl", id: "app-color-panel-edge", event: "input", overridePath: "color.panelEdge", fromEl: (el2) => el2.value },
  { type: "appearanceControl", id: "app-color-title-top", event: "input", overridePath: "color.titleTop", fromEl: (el2) => el2.value },
  { type: "appearanceControl", id: "app-color-title-mid", event: "input", overridePath: "color.titleMid", fromEl: (el2) => el2.value },
  { type: "appearanceControl", id: "app-color-title-bot", event: "input", overridePath: "color.titleBot", fromEl: (el2) => el2.value },
  { type: "appearanceControl", id: "app-color-kbd", event: "input", overridePath: "color.kbdColor", fromEl: (el2) => el2.value },
  { type: "appearanceRangePair", baseId: "app-type-ui", overridePath: "type.size.ui", min: 9, max: 18 },
  { type: "appearanceRangePair", baseId: "app-type-kbd", overridePath: "type.size.kbd", min: 8, max: 16 }
]);
var draggingSettingsRanges = /* @__PURE__ */ new Set();
function setSettingsRangeDragging(range, dragging) {
  if (!range) return;
  if (dragging) draggingSettingsRanges.add(range);
  else draggingSettingsRanges.delete(range);
}
function isSettingsRangeDragging(node) {
  if (!node) return false;
  if (draggingSettingsRanges.has(
    /** @type {HTMLInputElement} */
    node
  )) return true;
  try {
    if (typeof node.matches === "function" && node.matches("input[type=range]:active")) return true;
  } catch {
  }
  return false;
}
function pairedRangeForNumber(node) {
  const id = node && "id" in node ? String(node.id || "") : "";
  if (!id.endsWith("-number")) return null;
  try {
    const root = typeof node.getRootNode === "function" ? node.getRootNode() : node.ownerDocument;
    const range = root && typeof root.getElementById === "function" ? root.getElementById(id.slice(0, -"-number".length) + "-range") : null;
    return range || null;
  } catch {
    return null;
  }
}
function isLiveSettingsControl(node) {
  if (!node) return false;
  if (isSettingsRangeDragging(node)) return true;
  try {
    const root = typeof node.getRootNode === "function" ? node.getRootNode() : node.ownerDocument;
    return !!(root && "activeElement" in root && root.activeElement === node);
  } catch {
    return false;
  }
}
function writeSettingsInputValue(node, value) {
  if (!node) return;
  const s = String(value);
  try {
    if ("value" in node && node.value === s) return;
  } catch {
  }
  if (isSettingsRangeDragging(node)) return;
  const paired = pairedRangeForNumber(node);
  if (paired && isSettingsRangeDragging(paired)) {
    try {
      if ("value" in paired && String(paired.value) !== s) return;
    } catch {
    }
  }
  if (isLiveSettingsControl(node)) return;
  try {
    node.value = s;
  } catch {
  }
}
function syncRangePair(range, number, n, source, setInputValue3) {
  if (range && range !== source) setInputValue3(range, n);
  if (number && number !== source) setInputValue3(number, n);
}
function trackRangeDrag(range, signal) {
  if (!range) return;
  const doc = range.ownerDocument || (typeof document !== "undefined" ? document : null);
  const onDown = (event) => {
    if (event && "button" in event && event.button !== 0) return;
    setSettingsRangeDragging(range, true);
  };
  const onUp = () => setSettingsRangeDragging(range, false);
  const opts = { signal, capture: true };
  range.addEventListener("pointerdown", onDown, opts);
  range.addEventListener("lostpointercapture", onUp, opts);
  doc?.addEventListener("pointerup", onUp, opts);
  doc?.addEventListener("pointercancel", onUp, opts);
  if (signal) {
    signal.addEventListener("abort", () => setSettingsRangeDragging(range, false), { once: true });
  }
}
function coalesceNumericPersist(persist) {
  let inflight = false;
  let pending = (
    /** @type {number|null} */
    null
  );
  const flush = (n) => {
    pending = n;
    if (inflight) return;
    inflight = true;
    const send = pending;
    pending = null;
    void Promise.resolve(persist(send)).finally(() => {
      inflight = false;
      if (pending != null) flush(pending);
    });
  };
  return flush;
}
function bindNumericPair(opts) {
  const { range, number, min, max, persist, setInputValue: setInputValue3, signal } = opts;
  const listenOpts = { signal, capture: true };
  trackRangeDrag(range, signal);
  const flush = coalesceNumericPersist(persist);
  const commit = (raw, source) => {
    if (source === number && isSettingsRangeDragging(range)) return;
    const n = clampNumber(raw, min, max);
    syncRangePair(range, number, n, source, setInputValue3);
    flush(n);
  };
  range?.addEventListener("input", () => commit(range.value, range), listenOpts);
  number?.addEventListener("input", () => commit(number.value, number), listenOpts);
}
function bindSettingsControls(ctx) {
  const { controller: controller2, el: el2, all: all2, setInputValue: setInputValue3, signal } = ctx;
  const listenOpts = { signal, capture: true };
  const runUpdate = (spec, work) => {
    void Promise.resolve(work).then((s) => {
      if (spec.viewTransition && typeof ctx.withViewTransition === "function") {
        ctx.withViewTransition(() => ctx.applyState?.(s));
      }
    });
  };
  for (const spec of SETTINGS_CONTROLS) {
    if (spec.type === "toggle") {
      const node = (
        /** @type {HTMLInputElement|null} */
        el2(spec.id || "")
      );
      if (!node) continue;
      node.addEventListener("change", () => {
        const raw = spec.normalize ? spec.normalize(!!node.checked) : !!node.checked;
        runUpdate(spec, controller2.update(spec.path, raw));
      }, listenOpts);
      continue;
    }
    if (spec.type === "select") {
      const node = (
        /** @type {HTMLSelectElement|null} */
        el2(spec.id || "")
      );
      if (!node) continue;
      node.addEventListener("change", () => {
        const raw = spec.normalize ? spec.normalize(node.value) : node.value;
        runUpdate(spec, controller2.update(spec.path, raw));
      }, listenOpts);
      continue;
    }
    if (spec.type === "radio") {
      const radios = (
        /** @type {HTMLInputElement[]} */
        Array.from(all2(`input[name="${spec.name}"]`))
      );
      radios.forEach((radio) => {
        radio.addEventListener("change", () => {
          if (!radio.checked) return;
          const raw = spec.normalize ? spec.normalize(radio.value) : radio.value;
          runUpdate(spec, controller2.update(spec.path, raw));
        }, listenOpts);
      });
      continue;
    }
    if (spec.type === "rangePair") {
      bindNumericPair({
        range: (
          /** @type {HTMLInputElement|null} */
          el2(`${spec.baseId}-range`)
        ),
        number: (
          /** @type {HTMLInputElement|null} */
          el2(`${spec.baseId}-number`)
        ),
        min: spec.min ?? 0,
        max: spec.max ?? 0,
        persist: (n) => controller2.update(spec.path, n),
        setInputValue: setInputValue3,
        signal
      });
      continue;
    }
    if (spec.type === "appearanceControl") {
      const node = (
        /** @type {HTMLInputElement|null} */
        el2(spec.id || "")
      );
      if (!node) continue;
      const eventName = spec.event || "change";
      node.addEventListener(eventName, () => {
        const fromEl = spec.fromEl || ((e) => e.value);
        void controller2.updateThemeOverride(spec.overridePath, fromEl(node));
      }, listenOpts);
      continue;
    }
    if (spec.type === "appearanceRadio") {
      const radios = (
        /** @type {HTMLInputElement[]} */
        Array.from(all2(`input[name="${spec.name}"]`))
      );
      radios.forEach((radio) => {
        radio.addEventListener("change", () => {
          if (!radio.checked) return;
          const raw = spec.normalize ? spec.normalize(radio.value) : radio.value;
          void controller2.updateThemeOverride(spec.overridePath, raw);
        }, listenOpts);
      });
      continue;
    }
    if (spec.type === "appearanceRangePair") {
      const format = typeof spec.formatValue === "function" ? spec.formatValue : (n) => `${n}px`;
      bindNumericPair({
        range: (
          /** @type {HTMLInputElement|null} */
          el2(`${spec.baseId}-range`)
        ),
        number: (
          /** @type {HTMLInputElement|null} */
          el2(`${spec.baseId}-number`)
        ),
        min: spec.min ?? 0,
        max: spec.max ?? 0,
        persist: (n) => controller2.updateThemeOverride(spec.overridePath, format(n)),
        setInputValue: setInputValue3,
        signal
      });
    }
  }
}

// src/utils/debug.js
init_settings_manager();
var SOURCE_BUILD_ENABLE_DEBUG_SETTINGS = true;
var BUILD_ENABLE_DEBUG_SETTINGS = typeof __KP_BUILD_ENABLE_DEBUG_SETTINGS__ !== "undefined" ? !!__KP_BUILD_ENABLE_DEBUG_SETTINGS__ : SOURCE_BUILD_ENABLE_DEBUG_SETTINGS;
function applyDebugSetting(enabled) {
  try {
    globalThis.KEYPILOT_DEBUG = !!enabled;
  } catch {
  }
}

// pages/settings.js
init_i18n();
init_platform();

// src/ui/url-listing.js
var GENERIC_FAVICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="#ffffff" fill-opacity="0.78" d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2Zm0 2c-1.5 0-2.93.35-4.2.98.58.5 1.27 1.33 1.9 2.6.82-.28 1.74-.44 2.3-.48V4Zm2 0v3.1c.56.04 1.48.2 2.3.48.63-1.27 1.32-2.1 1.9-2.6A7.95 7.95 0 0 0 14 4Zm-6.72 2.2A7.99 7.99 0 0 0 4.07 11h3.21c.06-1.39.29-2.65.63-3.74-.24-.5-.45-.84-.63-1.06ZM19.93 11A7.99 7.99 0 0 0 16.72 6.2c-.18.22-.39.56-.63 1.06.34 1.09.57 2.35.63 3.74h3.21ZM9.3 8.73c-.24.8-.41 1.74-.46 2.77h3.16V9.15c-.9.05-1.85.22-2.7.58Zm5.4 0c-.85-.36-1.8-.53-2.7-.58v2.35h3.16c-.05-1.03-.22-1.97-.46-2.77ZM4.07 13a7.99 7.99 0 0 0 3.21 4.8c.18-.22.39-.56.63-1.06-.34-1.09-.57-2.35-.63-3.74H4.07Zm4.77 0c.05 1.03.22 1.97.46 2.77.85.36 1.8.53 2.7.58V13H8.84Zm3.16 3.85c-.56-.04-1.48-.2-2.3-.48-.63 1.27-1.32 2.1-1.9 2.6A7.95 7.95 0 0 0 12 20v-3.15Zm2 0V20c1.5 0 2.93-.35 4.2-.98-.58-.5-1.27-1.33-1.9-2.6-.82.28-1.74.44-2.3.48Zm1.16-3.85H12v3.35c.9-.05 1.85-.22 2.7-.58.24-.8.41-1.74.46-2.77Zm1.56 3.74c.24.5.45.84.63 1.06a7.99 7.99 0 0 0 3.21-4.8h-3.21c-.06 1.39-.29 2.65-.63 3.74Z"/>
</svg>
`.trim();
var GENERIC_FAVICON_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(GENERIC_FAVICON_SVG)}`;
function getChromeFavicon2Url(url, size = 32) {
  const u = String(url || "").trim();
  const s = Number(size) || 32;
  return `chrome://favicon2/?size=${encodeURIComponent(String(s))}&pageUrl=${encodeURIComponent(u)}`;
}
function getExtensionFaviconUrl(pageUrl, size = 32) {
  const u = String(pageUrl || "").trim();
  const s = Number(size) || 32;
  try {
    if (typeof chrome !== "undefined" && chrome?.runtime?.getURL) {
      const url = new URL(chrome.runtime.getURL("/_favicon/"));
      url.searchParams.set("pageUrl", u);
      url.searchParams.set("size", String(s));
      return url.toString();
    }
  } catch {
  }
  return getChromeFavicon2Url(u, s);
}

// src/modules/cursor.js
init_constants();
var CursorManager = class {
  constructor() {
    this.cursorEl = null;
    this.lastPosition = { x: 0, y: 0 };
    this.isStuck = false;
    this.stuckCheckInterval = null;
    this.forceUpdateCount = 0;
    this.currentMode = null;
    this.currentModeKey = null;
    this.lastOptions = {};
    this.uriCache = /* @__PURE__ */ new Map();
  }
  ensure() {
    if (this.cursorEl) return;
    try {
      const earlyApi = window.KEYPILOT_EARLY;
      if (earlyApi) {
        try {
          const earlyPosition = typeof earlyApi.getPosition === "function" ? earlyApi.getPosition() : null;
          if (earlyPosition && Number.isFinite(earlyPosition.x) && Number.isFinite(earlyPosition.y)) {
            this.lastPosition = earlyPosition;
          }
        } catch {
        }
      }
    } catch {
    }
    this.cursorEl = { style: {} };
  }
  setMode(mode, options = {}) {
    if (!this.cursorEl) return;
    const {
      cursorType = null,
      crossHairQuadrantWidth = 15,
      gap = 0,
      strokeLineCap = "round",
      strokeWidth = 4,
      crossHairScalingFactor = 1,
      hasClickableElement = false
    } = options || {};
    const nextModeKey = `${mode}|${cursorType || ""}|${crossHairQuadrantWidth}|${gap}|${strokeLineCap}|${strokeWidth}|${crossHairScalingFactor}|${hasClickableElement ? 1 : 0}`;
    if (this.currentModeKey === nextModeKey) {
      return;
    }
    this.currentMode = mode;
    this.currentModeKey = nextModeKey;
    this.lastOptions = options && typeof options === "object" ? { ...options } : {};
    if (cursorType === "native_arrow") {
      document.documentElement.style.setProperty("--kpv2-cursor", "default");
      if (document.documentElement.style.cursor) document.documentElement.style.cursor = "";
      if (document.body.style.cursor) document.body.style.cursor = "";
      return;
    }
    if (cursorType === "native_pointer") {
      document.documentElement.style.setProperty("--kpv2-cursor", "pointer");
      if (document.documentElement.style.cursor) document.documentElement.style.cursor = "";
      if (document.body.style.cursor) document.body.style.cursor = "";
      return;
    }
    const cursorUri = this.getCursorDataUri(mode, options);
    const cursorValue = `url("${cursorUri}") 30 30, auto`;
    document.documentElement.style.setProperty("--kpv2-cursor", cursorValue);
    if (document.documentElement.style.cursor) document.documentElement.style.cursor = "";
    if (document.body.style.cursor) document.body.style.cursor = "";
  }
  updatePosition(x, y) {
    if (!this.cursorEl) return;
    this.lastPosition = { x, y };
  }
  getCurrentMode() {
    return this.currentMode || "none";
  }
  /**
   * Generate SVG data URI for cursor mode
   */
  getCursorDataUri(mode, options = {}) {
    const {
      cursorType = null,
      crossHairQuadrantWidth = 15,
      gap = 0,
      strokeLineCap = "round",
      strokeWidth = 4,
      crossHairScalingFactor = 1,
      hasClickableElement = false
    } = options;
    const scaledGap = gap * crossHairScalingFactor;
    const scaledWidth = crossHairQuadrantWidth * crossHairScalingFactor;
    const centerX = 30;
    const centerY = 30;
    let segmentStart, segmentEnd, segmentStart2, segmentEnd2;
    if (scaledGap === 0) {
      segmentStart = centerY - scaledWidth;
      segmentEnd = centerY;
      segmentStart2 = centerY;
      segmentEnd2 = centerY + scaledWidth;
    } else {
      segmentStart = centerY - scaledGap - scaledWidth;
      segmentEnd = centerY - scaledGap;
      segmentStart2 = centerY + scaledGap;
      segmentEnd2 = centerY + scaledGap + scaledWidth;
    }
    const cacheKey = `${mode}-${cursorType || ""}-${crossHairQuadrantWidth}-${gap}-${strokeLineCap}-${strokeWidth}-${crossHairScalingFactor}-${hasClickableElement ? 1 : 0}`;
    if (this.uriCache.has(cacheKey)) {
      return this.uriCache.get(cacheKey);
    }
    let svgContent = "";
    if (mode === "text_focus" && cursorType === "t_square") {
      const color4 = hasClickableElement ? COLORS.FOCUS_GREEN_BRIGHT : COLORS.ORANGE;
      const scale = crossHairScalingFactor || 1;
      const half = 14 * scale;
      const x = 30 - half;
      const y = 30 - half;
      const w = 2 * half;
      const h = 2 * half;
      const tHalf = half * 0.6;
      const tTopY = 30 - half * 0.45;
      const tBottomY = 30 + half * 0.7;
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color4}" stroke-width="${strokeWidth}" />
        <line x1="${30 - tHalf}" y1="${tTopY}" x2="${30 + tHalf}" y2="${tTopY}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="30" y1="${tTopY}" x2="30" y2="${tBottomY}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
      </svg>`;
    } else if (mode === "text_focus") {
      const color4 = hasClickableElement ? COLORS.FOCUS_GREEN_BRIGHT : COLORS.ORANGE;
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <line x1="30" y1="${segmentStart}" x2="30" y2="${segmentEnd}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="30" y1="${segmentStart2}" x2="30" y2="${segmentEnd2}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart}" y1="30" x2="${segmentEnd}" y2="30" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart2}" y1="30" x2="${segmentEnd2}" y2="30" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
      </svg>`;
    } else if (mode === "delete") {
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <line x1="12" y1="12" x2="48" y2="48" stroke="${COLORS.DELETE_RED}" stroke-width="5" stroke-linecap="round"/>
        <line x1="48" y1="12" x2="12" y2="48" stroke="${COLORS.DELETE_RED}" stroke-width="5" stroke-linecap="round"/>
      </svg>`;
    } else if (mode === "cols") {
      const color4 = COLORS.COLS_PURPLE || "rgba(156,39,176,0.95)";
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <rect x="10" y="12" width="16" height="36" rx="1" fill="none" stroke="${color4}" stroke-width="3"/>
        <rect x="34" y="12" width="16" height="36" rx="1" fill="none" stroke="${color4}" stroke-width="3"/>
        <line x1="13" y1="20" x2="23" y2="20" stroke="${color4}" stroke-width="2" stroke-linecap="round"/>
        <line x1="13" y1="28" x2="23" y2="28" stroke="${color4}" stroke-width="2" stroke-linecap="round"/>
        <line x1="13" y1="36" x2="23" y2="36" stroke="${color4}" stroke-width="2" stroke-linecap="round"/>
        <line x1="37" y1="20" x2="47" y2="20" stroke="${color4}" stroke-width="2" stroke-linecap="round"/>
        <line x1="37" y1="28" x2="47" y2="28" stroke="${color4}" stroke-width="2" stroke-linecap="round"/>
        <line x1="37" y1="36" x2="47" y2="36" stroke="${color4}" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    } else if (mode === "highlight") {
      const color4 = COLORS.HIGHLIGHT_BLUE;
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <line x1="30" y1="${segmentStart}" x2="30" y2="${segmentEnd}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="30" y1="${segmentStart2}" x2="30" y2="${segmentEnd2}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart}" y1="30" x2="${segmentEnd}" y2="30" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart2}" y1="30" x2="${segmentEnd2}" y2="30" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
      </svg>`;
    } else {
      const color4 = COLORS.FOCUS_GREEN_BRIGHT;
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <line x1="30" y1="${segmentStart}" x2="30" y2="${segmentEnd}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="30" y1="${segmentStart2}" x2="30" y2="${segmentEnd2}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart}" y1="30" x2="${segmentEnd}" y2="30" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart2}" y1="30" x2="${segmentEnd2}" y2="30" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
      </svg>`;
    }
    const encoded = encodeURIComponent(svgContent);
    const uri = `data:image/svg+xml,${encoded}`;
    this.uriCache.set(cacheKey, uri);
    return uri;
  }
  hide() {
    if (this.cursorEl) {
      document.documentElement.style.setProperty("--kpv2-cursor", "default");
    }
  }
  show() {
    if (this.cursorEl) {
      const currentMode = this.getCurrentMode();
      this.currentMode = null;
      this.currentModeKey = null;
      this.setMode(currentMode, this.lastOptions || {});
    }
  }
  cleanup() {
    if (this.stuckCheckInterval) {
      clearInterval(this.stuckCheckInterval);
      this.stuckCheckInterval = null;
    }
    document.documentElement.style.cursor = "";
    document.body.style.cursor = "";
    document.documentElement.style.removeProperty("--kpv2-cursor");
    this.cursorEl = null;
    this.currentMode = null;
    this.currentModeKey = null;
  }
  createElement(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null) continue;
      if (k === "className") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }
};

// src/utils/kp-deep-link.js
var KP_SETTINGS_PANEL_IDS = Object.freeze([
  "overview",
  "appearance",
  "keyboard",
  "click-mode",
  "text-mode",
  "scrolling",
  "cursor",
  "control-strip",
  "search",
  "about",
  "debug"
]);
function buildKpDeepLink(opts) {
  const kind = opts?.kind === "settings" || opts?.kind === "docs" ? opts.kind : null;
  const id = String(opts?.id || "").trim();
  if (!kind || !id || !/^[a-z0-9][a-z0-9_-]*$/i.test(id)) return "";
  const hash = String(opts?.hash || "").replace(/^#/, "").trim();
  return hash ? `kp://${kind}/${id}#${hash}` : `kp://${kind}/${id}`;
}
function normalizeSettingsPanelId(panelId) {
  const id = String(panelId || "").trim();
  return KP_SETTINGS_PANEL_IDS.includes(id) ? id : null;
}

// src/config/function-library.js
init_keyboard_layouts();

// src/config/macro-keys.js
init_i18n();
init_platform();
var MACRO_KEY_KIND_DEFS = Object.freeze([
  Object.freeze({
    id: (
      /** @type {const} */
      "hotkey"
    ),
    labelKey: "mk_hotkey_label",
    descriptionKey: "mk_hotkey_description",
    detailsKey: "mk_hotkey_details",
    keyboardClass: "key-orange"
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "burst"
    ),
    labelKey: "mk_burst_label",
    descriptionKey: "mk_burst_description",
    detailsKey: "mk_burst_details",
    keyboardClass: "key-purple"
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "roundRobin"
    ),
    labelKey: "mk_roundRobin_label",
    descriptionKey: "mk_roundRobin_description",
    detailsKey: "mk_roundRobin_details",
    keyboardClass: "key-page-scroll"
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "continuous"
    ),
    labelKey: "mk_continuous_label",
    descriptionKey: "mk_continuous_description",
    detailsKey: "mk_continuous_details",
    keyboardClass: "key-highlight"
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "mouse"
    ),
    labelKey: "mk_mouse_label",
    descriptionKey: "mk_mouse_description",
    detailsKey: "mk_mouse_details",
    keyboardClass: "key-activate"
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "key"
    ),
    labelKey: "mk_key_label",
    descriptionKey: "mk_key_description",
    detailsKey: "mk_key_details",
    keyboardClass: "key-gray"
  })
]);
var KNOWN_KINDS = new Set(MACRO_KEY_KIND_DEFS.map((d) => d.id));
function normalizeKeyStroke(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const key2 = String(src.key || "").trim();
  const out = { key: key2 || "" };
  if (typeof src.code === "string" && src.code.trim()) out.code = src.code.trim();
  if (src.ctrl === true) out.ctrl = true;
  if (src.alt === true) out.alt = true;
  if (src.shift === true) out.shift = true;
  if (src.meta === true) out.meta = true;
  return out;
}
function defaultMacroKeyConfig(kind) {
  switch (kind) {
    case "hotkey":
      return { stroke: normalizeKeyStroke({ key: "c", ctrl: true }) };
    case "burst":
      return {
        steps: [
          normalizeKeyStroke({ key: "a" }),
          normalizeKeyStroke({ key: "b" }),
          normalizeKeyStroke({ key: "c" })
        ],
        gapMs: 40
      };
    case "roundRobin":
      return {
        items: [
          normalizeKeyStroke({ key: "a" }),
          normalizeKeyStroke({ key: "b" }),
          normalizeKeyStroke({ key: "c" })
        ]
      };
    case "continuous":
      return {
        stroke: normalizeKeyStroke({ key: "w" }),
        intervalMs: 50
      };
    case "mouse":
      return { button: "left" };
    case "key":
      return { stroke: normalizeKeyStroke({ key: "1" }) };
    default:
      return {};
  }
}
function normalizeMacroKeyConfig(kind, raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const base = defaultMacroKeyConfig(kind);
  switch (kind) {
    case "hotkey":
    case "key":
      return { stroke: normalizeKeyStroke(src.stroke || base.stroke) };
    case "burst": {
      const stepsRaw = Array.isArray(src.steps) ? src.steps : base.steps;
      const steps = stepsRaw.map((s) => normalizeKeyStroke(s)).filter((s) => s.key);
      const gap = Number(src.gapMs);
      return {
        steps: steps.length ? steps : base.steps,
        gapMs: Number.isFinite(gap) ? Math.max(0, Math.min(2e3, gap)) : 40
      };
    }
    case "roundRobin": {
      const itemsRaw = Array.isArray(src.items) ? src.items : base.items;
      const items = itemsRaw.map((s) => normalizeKeyStroke(s)).filter((s) => s.key);
      return { items: items.length ? items : base.items };
    }
    case "continuous": {
      const interval = Number(src.intervalMs);
      return {
        stroke: normalizeKeyStroke(src.stroke || base.stroke),
        intervalMs: Number.isFinite(interval) ? Math.max(10, Math.min(5e3, interval)) : 50
      };
    }
    case "mouse": {
      const button = String(src.button || "left").toLowerCase();
      return {
        button: button === "middle" || button === "right" || button === "left" ? button : "left"
      };
    }
    default:
      return { ...base };
  }
}
var MACRO_BUILDER_STEP_TYPES = Object.freeze([
  Object.freeze({ id: "function", labelKey: "mk_step_function_label", descriptionKey: "mk_step_function_description" }),
  Object.freeze({ id: "wait", labelKey: "mk_step_wait_label", descriptionKey: "mk_step_wait_description" }),
  Object.freeze({ id: "gate", labelKey: "mk_step_gate_label", descriptionKey: "mk_step_gate_description" }),
  Object.freeze({ id: "stop", labelKey: "mk_step_stop_label", descriptionKey: "mk_step_stop_description" }),
  Object.freeze({ id: "runMacro", labelKey: "mk_step_runMacro_label", descriptionKey: "mk_step_runMacro_description" })
]);

// src/utils/key-chord.js
init_platform();

// src/modules/action-result-delivery.js
init_constants();

// src/ui/procedure-result-popover.js
init_i18n();
init_constants();

// src/utils/panel-position.js
var PANEL_ANCHORS = Object.freeze([
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right"
]);

// src/ui/kp-chrome-shadow.js
init_i18n();

// src/ui/locale-fonts.js
function quoteFamily(name) {
  return `"${name}"`;
}
function uiStack(families) {
  return ["system-ui", "-apple-system", ...families.map(quoteFamily), "sans-serif"].join(", ");
}
var KP_CJK_UI_STACK_SC = uiStack([
  "PingFang SC",
  "Hiragino Sans GB",
  "Microsoft YaHei",
  "Noto Sans SC",
  "Noto Sans CJK SC"
]);
var KP_CJK_UI_STACK_TC = uiStack([
  "PingFang TC",
  "Hiragino Sans CNS",
  "Microsoft JhengHei",
  "Noto Sans TC",
  "Noto Sans CJK TC"
]);
var KP_CJK_UI_STACK_HK = uiStack([
  "PingFang HK",
  "PingFang TC",
  "Hiragino Sans CNS",
  "Microsoft JhengHei",
  "Noto Sans HK",
  "Noto Sans CJK HK",
  "Noto Sans TC",
  "Noto Sans CJK TC"
]);
var KP_CJK_UI_STACK_JP = uiStack([
  "Hiragino Sans",
  "Yu Gothic UI",
  "Yu Gothic",
  "Meiryo",
  "Noto Sans JP",
  "Noto Sans CJK JP"
]);
function isZhHk(tag) {
  return tag === "zh-hk" || tag.startsWith("zh-hk-") || tag === "zh-mo" || tag.startsWith("zh-mo-") || tag === "zh-hant-hk" || tag.startsWith("zh-hant-hk-") || tag === "zh-hant-mo" || tag.startsWith("zh-hant-mo-");
}
function isZhTw(tag) {
  if (isZhHk(tag)) return false;
  return tag === "zh-tw" || tag.startsWith("zh-tw-") || tag === "zh-hant" || tag.startsWith("zh-hant-");
}
function isZhHans(tag) {
  return tag === "zh" || tag === "zh-cn" || tag.startsWith("zh-cn-") || tag === "zh-sg" || tag.startsWith("zh-sg-") || tag === "zh-hans" || tag.startsWith("zh-hans-");
}
function isJapanese(tag) {
  return tag === "ja" || tag.startsWith("ja-");
}
var CJK_FONT_RULES = [
  {
    id: "jp",
    stack: () => KP_CJK_UI_STACK_JP,
    match: isJapanese,
    shadow: [
      ":host(:lang(ja))"
    ],
    page: [
      "html:lang(ja) body"
    ]
  },
  {
    id: "hk",
    stack: () => KP_CJK_UI_STACK_HK,
    match: isZhHk,
    shadow: [
      ":host(:lang(zh-HK))",
      ":host(:lang(zh-MO))",
      ":host(:lang(zh-Hant-HK))",
      ":host(:lang(zh-Hant-MO))"
    ],
    page: [
      "html:lang(zh-HK) body",
      "html:lang(zh-MO) body",
      "html:lang(zh-Hant-HK) body",
      "html:lang(zh-Hant-MO) body"
    ]
  },
  {
    id: "tc",
    stack: () => KP_CJK_UI_STACK_TC,
    match: isZhTw,
    shadow: [
      ":host(:lang(zh-TW))",
      ":host(:lang(zh-Hant):not(:lang(zh-Hant-HK)):not(:lang(zh-Hant-MO)))"
    ],
    page: [
      "html:lang(zh-TW) body",
      "html:lang(zh-Hant):not(:lang(zh-Hant-HK)):not(:lang(zh-Hant-MO)) body"
    ]
  },
  {
    id: "sc",
    stack: () => KP_CJK_UI_STACK_SC,
    match: isZhHans,
    shadow: [
      ":host(:lang(zh-CN))",
      ":host(:lang(zh-SG))",
      ":host(:lang(zh-Hans))",
      ':host([lang="zh" i])'
    ],
    page: [
      "html:lang(zh-CN) body",
      "html:lang(zh-SG) body",
      "html:lang(zh-Hans) body",
      'html[lang="zh" i] body'
    ]
  }
];
function fontFamilyRule(selectors, stack) {
  return `${selectors.join(",\n")} {
  font-family: ${stack};
}`;
}
var KP_CJK_SHADOW_CSS = CJK_FONT_RULES.map((rule) => fontFamilyRule(rule.shadow, rule.stack())).join("\n");

// src/ui/nct-dark-ui.js
var NCT_DARK_UI_COLORS = {
  bg: "#0f0f10",
  panel: "#232323",
  panelEdge: "#3a3a3a",
  panelEdgeDark: "#111",
  titleTop: "#4c4c4c",
  titleMid: "#353535",
  titleBot: "#252525",
  btnTop: "#4a4a4a",
  btnMid: "#343434",
  btnBot: "#2a2a2a",
  litTop: "#5a7a9a",
  litBot: "#3a5570",
  litEdge: "#2a4a66",
  accent: "#4a90c8",
  fg: "#ddd",
  fgDim: "#aaa",
  fgMute: "#777",
  fieldBg: "#141414",
  fieldEdge: "#0a0a0a",
  fieldInsetTop: "#333"
};
var NCT_DARK_UI_TITLEBAR_TEXT_MODE_BACKGROUND = `linear-gradient(180deg, rgba(255, 140, 0, 0.28) 0%, rgba(255, 140, 0, 0.14) 45%, rgba(255, 120, 0, 0.18) 100%), linear-gradient(180deg, ${NCT_DARK_UI_COLORS.titleTop} 0%, ${NCT_DARK_UI_COLORS.titleMid} 45%, ${NCT_DARK_UI_COLORS.titleBot} 100%)`;

// src/messaging/types.js
var MSG = Object.freeze({
  // --- Extension enable / status ---
  GET_STATE: "KP_GET_STATE",
  SET_STATE: "KP_SET_STATE",
  TOGGLE_STATE: "KP_TOGGLE_STATE",
  STATE_RESPONSE: "KP_STATE_RESPONSE",
  STATE_CHANGED: "KP_STATE_CHANGED",
  UPDATE_STATE: "KP_UPDATE_STATE",
  GET_STATUS: "KP_GET_STATUS",
  STATUS: "KP_STATUS",
  // --- Transient onboarding actions ---
  TRANSIENT_ACTION: "KP_TRANSIENT_ACTION",
  /** Service worker → active tab action selected from the Keyboard Reference context menu. */
  KEYBOARD_REFERENCE_CONTEXT_ACTION: "KP_KEYBOARD_REFERENCE_CONTEXT_ACTION",
  // --- Tab / history navigation ---
  TAB_LEFT: "KP_TAB_LEFT",
  TAB_RIGHT: "KP_TAB_RIGHT",
  /** Content → SW: every normal window and its tabs. */
  TABS_OVERVIEW_GET: "KP_TABS_OVERVIEW_GET",
  /** SW → content: payload for TABS_OVERVIEW_GET. */
  TABS_OVERVIEW_RESULT: "KP_TABS_OVERVIEW_RESULT",
  /** Content → SW: focus a browser window without changing its active tab. */
  FOCUS_WINDOW: "KP_FOCUS_WINDOW",
  /** Content → SW: activate a tab and focus its window. */
  ACTIVATE_TAB: "KP_ACTIVATE_TAB",
  NEW_TAB: "KP_NEW_TAB",
  CLOSE_TAB: "KP_CLOSE_TAB",
  CLOSE_WINDOW: "KP_CLOSE_WINDOW",
  GO_BACK: "KP_GO_BACK",
  GO_FORWARD: "KP_GO_FORWARD",
  OPEN_URL_BACKGROUND: "KP_OPEN_URL_BACKGROUND",
  OPEN_URL_FOREGROUND: "KP_OPEN_URL_FOREGROUND",
  /** Open several http(s) URLs as background tabs, in order, after the sender tab. */
  OPEN_URLS: "KP_OPEN_URLS",
  /** Content → SW: bookmark folders for the Open Bookmarks picker. */
  LIST_BOOKMARK_FOLDERS: "KP_LIST_BOOKMARK_FOLDERS",
  /** SW → content: `{ folders: [{ id, path }] }`. */
  BOOKMARK_FOLDERS: "KP_BOOKMARK_FOLDERS",
  /** Content → SW: open the first website bookmarks in a folder. */
  OPEN_BOOKMARK_FOLDER: "KP_OPEN_BOOKMARK_FOLDER",
  /** Content → SW: open `count` random bookmarks. Empty folderId means every bookmark. */
  OPEN_RANDOM_BOOKMARK: "KP_OPEN_RANDOM_BOOKMARK",
  /** Content → SW: persist an Open URLs or Random Bookmark action for a randomized later time. */
  SCHEDULE_DEFERRED_OPEN: "KP_SCHEDULE_DEFERRED_OPEN",
  /** SW → content: press the button or form control captured when a click was scheduled. */
  RUN_DEFERRED_CLICK: "KP_RUN_DEFERRED_CLICK",
  /** Same-tab navigate (chrome.tabs.update). Used when sandboxed iframes cannot top-navigate without a real user gesture. */
  NAVIGATE_SAME_TAB: "KP_NAVIGATE_SAME_TAB",
  /** Content → SW: step tab zoom in (+1) or out (-1). Response includes oldZoom/newZoom. */
  ZOOM_STEP: "KP_ZOOM_STEP",
  // --- UI open (content-script handlers; SW may forward) ---
  OPEN_SETTINGS_POPOVER: "KP_OPEN_SETTINGS_POPOVER",
  OPEN_GUIDE_POPOVER: "KP_OPEN_GUIDE_POPOVER",
  /** Open Docs popover; optional topicId / hash deep-link. */
  OPEN_DOCS_POPOVER: "KP_OPEN_DOCS_POPOVER",
  OPEN_ONBOARDING: "KP_OPEN_ONBOARDING",
  /** Reset walkthrough progress and open it (e.g. Guide "Launch Walkthrough"). */
  LAUNCH_WALKTHROUGH: "KP_LAUNCH_WALKTHROUGH",
  // --- History / bookmarks / top sites (SW APIs for content scripts) ---
  OMNIBOX_SUGGEST: "KP_OMNIBOX_SUGGEST",
  /** Response to OMNIBOX_SUGGEST */
  OMNIBOX_SUGGESTIONS: "KP_OMNIBOX_SUGGESTIONS",
  GET_BOOKMARKS: "KP_GET_BOOKMARKS",
  BOOKMARKS_RESPONSE: "KP_BOOKMARKS_RESPONSE",
  GET_RECENT_BOOKMARKS: "KP_GET_RECENT_BOOKMARKS",
  RECENT_BOOKMARKS_RESPONSE: "KP_RECENT_BOOKMARKS_RESPONSE",
  BROWSER_HISTORY_GET: "KP_BROWSER_HISTORY_GET",
  BROWSER_HISTORY_RESULT: "KP_BROWSER_HISTORY_RESULT",
  GET_TOP_SITES: "KP_GET_TOP_SITES",
  TOP_SITES_RESPONSE: "KP_TOP_SITES_RESPONSE",
  GET_MOST_VISITED: "KP_GET_MOST_VISITED",
  MOST_VISITED_RESPONSE: "KP_MOST_VISITED_RESPONSE",
  GET_HISTORY_FOR_DOMAINS: "KP_GET_HISTORY_FOR_DOMAINS",
  HISTORY_FOR_DOMAINS_RESPONSE: "KP_HISTORY_FOR_DOMAINS_RESPONSE",
  GET_RECENT_HISTORY: "KP_GET_RECENT_HISTORY",
  RECENT_HISTORY_RESPONSE: "KP_RECENT_HISTORY_RESPONSE",
  // --- Video thumbnails for card backgrounds (official oEmbed / sync URLs) ---
  GET_VIDEO_THUMB: "KP_GET_VIDEO_THUMB",
  VIDEO_THUMB_RESPONSE: "KP_VIDEO_THUMB_RESPONSE",
  // --- Media Library (IndexedDB at extension origin; SW owns Blobs) ---
  MEDIA_LIBRARY_ADD: "KP_MEDIA_LIBRARY_ADD",
  MEDIA_LIBRARY_LIST: "KP_MEDIA_LIBRARY_LIST",
  MEDIA_LIBRARY_GET: "KP_MEDIA_LIBRARY_GET",
  MEDIA_LIBRARY_DELETE: "KP_MEDIA_LIBRARY_DELETE",
  MEDIA_LIBRARY_ZIP: "KP_MEDIA_LIBRARY_ZIP",
  /** SW → tabs: library contents changed (add/delete). Overlay reloads if open. */
  MEDIA_LIBRARY_CHANGED: "KP_MEDIA_LIBRARY_CHANGED",
  // --- Dictionary lookup (localized Wiktionary parsed entry) ---
  WIKTIONARY_LOOKUP: "KP_WIKTIONARY_LOOKUP",
  // --- Per-tab navigation graph ---
  NAVGRAPH_GET: "KP_NAVGRAPH_GET",
  /** Response payload for NAVGRAPH_GET */
  NAVGRAPH_GRAPH: "KP_NAVGRAPH_GRAPH",
  NAVGRAPH_JUMP: "KP_NAVGRAPH_JUMP",
  NAVGRAPH_CLEAR: "KP_NAVGRAPH_CLEAR",
  // --- Generic ---
  SUCCESS: "KP_SUCCESS",
  ERROR: "KP_ERROR",
  /** Lightweight ack (e.g. STATUS notification received) */
  ACK: "KP_ACK",
  // --- Separate-window Link Preview / Open Popover (chrome.windows popup) ---
  OPEN_POPOVER_WINDOW: "KP_OPEN_POPOVER_WINDOW",
  CLOSE_POPOVER_WINDOW: "KP_CLOSE_POPOVER_WINDOW",
  /** SW → opener: popover window closed (OS ✕ or in-window close). */
  POPOVER_WINDOW_CLOSED: "KP_POPOVER_WINDOW_CLOSED",
  /** Popup tab → SW: am I a KeyPilot popover window? */
  AM_I_POPOVER_WINDOW: "KP_AM_I_POPOVER_WINDOW",
  // --- Parent ↔ popover iframe (window.postMessage) ---
  POPOVER_BRIDGE_INIT: "KP_POPOVER_BRIDGE_INIT",
  POPOVER_BRIDGE_READY: "KP_POPOVER_BRIDGE_READY",
  POPOVER_REQUEST_CLOSE: "KP_POPOVER_REQUEST_CLOSE",
  POPOVER_BRIDGE_KEYDOWN: "KP_POPOVER_BRIDGE_KEYDOWN",
  POPOVER_SCROLL: "KP_POPOVER_SCROLL",
  /** Guide iframe → parent: close guide and open walkthrough from a reset state. */
  POPOVER_LAUNCH_WALKTHROUGH: "KP_POPOVER_LAUNCH_WALKTHROUGH",
  // --- Parent → child frame activate (window.postMessage; third-party iframes) ---
  // Top-frame KeyPilot posts this when F/B/G lands on a cross-origin <iframe>.
  // Child frame-click-agent performs elementFromPoint + click in its own document.
  // Optional topOrigin: parent tab origin for link routing (no hardcoded domains).
  FRAME_ACTIVATE: "KP_FRAME_ACTIVATE",
  // --- Parent → child frame scroll (window.postMessage; layout scroll keys under an iframe) ---
  // Top-frame KeyPilot posts this when scroll keys land on an <iframe> shell. Child
  // frame-click-agent runs scroll-at-point (delta or edge) at local coordinates
  // (nested overflow first, then the frame document).
  FRAME_SCROLL: "KP_FRAME_SCROLL",
  // --- Child → parent pointer sync (window.postMessage) ---
  // Frame agent reports local client coords so top KeyPilot can keep lastMouse fresh
  // while the pointer is over a cross-origin (or any) iframe — parent documents do
  // not receive mousemove inside iframes. Nested agents re-bubble with translated coords.
  // Payload: { type, inside: boolean, clientX?: number, clientY?: number }
  FRAME_POINTER: "KP_FRAME_POINTER",
  // --- Child → parent: return keyboard focus to the top frame ---
  // Sent on Esc / pointer leave when the iframe had document focus (manual click).
  // Top blurs the focused <iframe> so KeyPilot keybinds work on the parent again.
  FRAME_FOCUS_RECLAIM: "KP_FRAME_FOCUS_RECLAIM",
  // --- Child → parent: typing focus inside a page iframe ---
  // Frame agent posts these on focusin/focusout of a text field in its document
  // (Gutenberg editor-canvas, etc.). Top FocusDetector peeks the same-origin
  // activeElement and enters/exits text_focus. No element is sent.
  // Payload: { type }
  FRAME_TYPING_FOCUS: "KP_FRAME_TYPING_FOCUS",
  FRAME_TYPING_BLUR: "KP_FRAME_TYPING_BLUR",
  // --- Parent → child: blur the typing field (Esc from top-frame text mode) ---
  FRAME_BLUR_TYPING: "KP_FRAME_BLUR_TYPING",
  // --- Child frame-agent → SW: inject full content-bundled.js into this frame ---
  // Used when a KeyPilot popover iframe needs full KeyPilot (cursor/overlays).
  // Thin frame-agent-bundled.js does not include the full app.
  INJECT_FULL_KEYPILOT_IN_FRAME: "KP_INJECT_FULL_KEYPILOT_IN_FRAME",
  // --- Content → SW: inject MAIN-world map.panBy bridge into the sender frame ---
  // Scroll Line uses this so isolated content can pan Leaflet/Mapbox/Google via
  // page globals. Idempotent; bridge listens for CustomEvent __kp_map_pan_v1.
  ENSURE_MAP_PAN_BRIDGE: "KP_ENSURE_MAP_PAN_BRIDGE",
  // --- Child frame-agent → SW: seek media in the page world ---
  // YouTube (and similar) ignore untrusted timeline clicks and overwrite
  // isolated-world video.currentTime from player state. MAIN-world seekTo
  // / currentTime in the sender frame commits the playhead.
  // Payload: { type, seconds: number }
  FRAME_MEDIA_SEEK: "KP_FRAME_MEDIA_SEEK",
  // --- Child frame-agent → SW: set media volume in the page world ---
  // YouTube volume popup ignores untrusted pointer on the knob. MAIN-world
  // setVolume(0–100) / unMute in the sender frame commits the level.
  // Payload: { type, volume: number } where volume is 0–1
  FRAME_MEDIA_VOLUME: "KP_FRAME_MEDIA_VOLUME"
});
var TAB_UI_FORWARD_TYPES = Object.freeze([
  MSG.OPEN_SETTINGS_POPOVER,
  MSG.OPEN_GUIDE_POPOVER,
  MSG.OPEN_DOCS_POPOVER,
  MSG.OPEN_ONBOARDING,
  MSG.LAUNCH_WALKTHROUGH
]);

// src/utils/video-url-utils.js
var MAX_INLINE_VIDEO_BYTES = 8 * 1024 * 1024;

// src/modules/action-result-delivery.js
init_i18n();
var ACTION_RESULT_DESTINATIONS = Object.freeze({
  CLIPBOARD: "clipboard",
  POPOVER: "popover",
  BOTH: "both",
  MODIFY_PAGE: "modifyPage",
  MEDIA_LIBRARY: "mediaLibrary",
  CLIPBOARD_AND_MEDIA_LIBRARY: "clipboardAndMediaLibrary",
  SCRAPBOOK: "scrapbook"
});
var DESTINATION_LABEL_KEYS = Object.freeze({
  [ACTION_RESULT_DESTINATIONS.CLIPBOARD]: "fn_dest_clipboard",
  [ACTION_RESULT_DESTINATIONS.POPOVER]: "fn_dest_popover",
  [ACTION_RESULT_DESTINATIONS.BOTH]: "fn_dest_both",
  [ACTION_RESULT_DESTINATIONS.MODIFY_PAGE]: "fn_dest_modify_page",
  [ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY]: "fn_dest_media_library",
  [ACTION_RESULT_DESTINATIONS.CLIPBOARD_AND_MEDIA_LIBRARY]: "fn_dest_clipboard_and_media_library",
  [ACTION_RESULT_DESTINATIONS.SCRAPBOOK]: "fn_dest_scrapbook"
});
function buildResultDestinationParameter(applicableDestinations) {
  const ids = Array.isArray(applicableDestinations) && applicableDestinations.length ? applicableDestinations : [ACTION_RESULT_DESTINATIONS.CLIPBOARD];
  return Object.freeze({
    id: "destination",
    labelKey: "fn_param_destination",
    type: "enum",
    defaultValue: ids[0],
    options: Object.freeze(ids.map((id) => Object.freeze({
      id,
      labelKey: DESTINATION_LABEL_KEYS[id] || "fn_dest_clipboard"
    })))
  });
}

// src/config/function-library.js
init_i18n();
init_platform();
init_open_url_list();

// src/utils/bookmark-folder.js
init_open_url_list();
var RANDOM_BOOKMARK_MAX = 30;
function normalizeBookmarkFolderId(raw) {
  const id = String(raw ?? "").trim();
  if (!id || id.length > 64 || /\s/.test(id)) return "";
  return id;
}

// src/config/function-library.js
var TEXT_ACTIVE_BUILTIN_FUNCTION_IDS = /* @__PURE__ */ new Set([
  "TYPE_CHARACTERS"
]);
var CLIPBOARD_OR_MEDIA_LIBRARY_DESTINATIONS = Object.freeze([
  ACTION_RESULT_DESTINATIONS.CLIPBOARD,
  ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY,
  ACTION_RESULT_DESTINATIONS.CLIPBOARD_AND_MEDIA_LIBRARY
]);
var VIDEO_COPY_DESTINATIONS = Object.freeze([
  ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY,
  ACTION_RESULT_DESTINATIONS.CLIPBOARD_AND_MEDIA_LIBRARY,
  ACTION_RESULT_DESTINATIONS.CLIPBOARD
]);
var BUILTIN_FUNCTION_DATA_TAGS = Object.freeze({
  COPY_HOVERED_IMAGE: Object.freeze({
    dataSource: "underCursor",
    dataKind: "media",
    destinations: CLIPBOARD_OR_MEDIA_LIBRARY_DESTINATIONS
  }),
  COPY_HOVERED_URL: Object.freeze({
    dataSource: "underCursor",
    dataKind: "text",
    destinations: CLIPBOARD_OR_MEDIA_LIBRARY_DESTINATIONS
  }),
  POI_WEBSITE: Object.freeze({
    dataSource: "underCursor",
    dataKind: "text"
  }),
  POI_ADDRESS: Object.freeze({
    dataSource: "underCursor",
    dataKind: "text",
    destinations: Object.freeze([
      ACTION_RESULT_DESTINATIONS.CLIPBOARD,
      ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY
    ])
  }),
  COPY_HOVERED_VIDEO: Object.freeze({
    dataSource: "underCursor",
    dataKind: "media",
    destinations: VIDEO_COPY_DESTINATIONS
  }),
  FONT_INFO: Object.freeze({
    dataSource: "underCursor",
    dataKind: "text",
    destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.POPOVER])
  }),
  // Whole-page scan (not under-cursor); opens a tabbed overlay rather than a sink.
  PAGE_MEDIA: Object.freeze({ dataSource: "none", dataKind: "media" }),
  READER_MODE: Object.freeze({ dataSource: "none", dataKind: "text" }),
  OPEN_MEDIA_LIBRARY: Object.freeze({ dataSource: "none" }),
  SEND_TEXT_TO_AI: Object.freeze({
    dataSource: "textRange",
    dataKind: "text",
    destinations: Object.freeze([
      ACTION_RESULT_DESTINATIONS.CLIPBOARD,
      ACTION_RESULT_DESTINATIONS.POPOVER,
      ACTION_RESULT_DESTINATIONS.BOTH
    ])
  }),
  CLIPBOARD_COPY: Object.freeze({ dataSource: "none" }),
  CLIPBOARD_CUT: Object.freeze({ dataSource: "none" }),
  CLIPBOARD_PASTE: Object.freeze({ dataSource: "none" }),
  CLIPBOARD_SELECT_ALL: Object.freeze({ dataSource: "none" }),
  SELECT_WORD: Object.freeze({ dataSource: "underCursor", dataKind: "text" }),
  SELECT_SENTENCE: Object.freeze({ dataSource: "underCursor", dataKind: "text" }),
  SELECT_PARAGRAPH: Object.freeze({ dataSource: "underCursor", dataKind: "text" }),
  SELECT_IMAGE: Object.freeze({ dataSource: "underCursor", dataKind: "media" })
});
var FIXED_KEY_FUNCTION_IDS = Object.freeze([
  "SEND_TEXT_TO_AI",
  "RECTANGLE_HIGHLIGHT",
  "HIGHLIGHT",
  "COPY_HOVERED_IMAGE",
  "COPY_HOVERED_URL",
  "COPY_HOVERED_VIDEO",
  "POI_ADDRESS",
  "PAGE_TOP",
  "PAGE_BOTTOM",
  "PREVIEW_LINK_POPOVER",
  "OPEN_POPOVER"
]);
var UNIT_SELECT_FUNCTION_IDS = Object.freeze([
  "SELECT_WORD",
  "SELECT_SENTENCE",
  "SELECT_PARAGRAPH",
  "SELECT_IMAGE"
]);
var EDGE_SCROLL_PARAMETERS = Object.freeze([
  Object.freeze({
    id: "mode",
    labelKey: "fn_param_jump_style",
    type: "enum",
    defaultValue: "fade",
    options: Object.freeze([
      Object.freeze({ id: "fade", labelKey: "fn_param_opt_fade" }),
      Object.freeze({ id: "smooth", labelKey: "fn_param_opt_scroll" })
    ])
  })
]);
var UNIT_SELECT_MODE_PARAMETERS = Object.freeze([
  Object.freeze({
    id: "mode",
    labelKey: "fn_param_selection_mode",
    type: "enum",
    defaultValue: "exclusive",
    options: Object.freeze([
      Object.freeze({ id: "exclusive", labelKey: "fn_param_opt_exclusive" }),
      Object.freeze({ id: "cumulative", labelKey: "fn_param_opt_cumulative" })
    ])
  })
]);
var BUILTIN_FUNCTION_PARAMETER_OVERRIDES = Object.freeze({
  PAGE_TOP: EDGE_SCROLL_PARAMETERS,
  PAGE_BOTTOM: EDGE_SCROLL_PARAMETERS,
  SELECT_WORD: UNIT_SELECT_MODE_PARAMETERS,
  SELECT_SENTENCE: UNIT_SELECT_MODE_PARAMETERS,
  SELECT_PARAGRAPH: UNIT_SELECT_MODE_PARAMETERS,
  SELECT_IMAGE: UNIT_SELECT_MODE_PARAMETERS,
  HIGHLIGHT: Object.freeze([
    Object.freeze({
      id: "mode",
      labelKey: "fn_param_copy_as",
      type: "enum",
      defaultValue: "rich",
      options: Object.freeze([
        Object.freeze({ id: "rich", labelKey: "fn_param_opt_rich_text" }),
        Object.freeze({ id: "plain", labelKey: "fn_param_opt_plain_text" })
      ])
    })
  ]),
  RECTANGLE_HIGHLIGHT: Object.freeze([
    Object.freeze({
      id: "mode",
      labelKey: "fn_param_selection_mode",
      type: "enum",
      defaultValue: "element",
      options: Object.freeze([
        Object.freeze({ id: "element", labelKey: "fn_param_opt_element_rectangle" }),
        Object.freeze({ id: "cumulative", labelKey: "fn_param_opt_pick_cumulative" })
      ])
    })
  ]),
  SEND_TEXT_TO_AI: Object.freeze([
    Object.freeze({
      id: "prompt",
      labelKey: "fn_param_instruction",
      type: "string",
      multiline: true,
      defaultValue: "Translate to English",
      placeholderKey: "fn_param_instruction_placeholder"
    }),
    buildResultDestinationParameter([
      ACTION_RESULT_DESTINATIONS.CLIPBOARD,
      ACTION_RESULT_DESTINATIONS.POPOVER,
      ACTION_RESULT_DESTINATIONS.BOTH
    ])
  ]),
  COPY_HOVERED_IMAGE: Object.freeze([
    buildResultDestinationParameter(CLIPBOARD_OR_MEDIA_LIBRARY_DESTINATIONS)
  ]),
  COPY_HOVERED_URL: Object.freeze([
    buildResultDestinationParameter(CLIPBOARD_OR_MEDIA_LIBRARY_DESTINATIONS)
  ]),
  COPY_HOVERED_VIDEO: Object.freeze([
    buildResultDestinationParameter(VIDEO_COPY_DESTINATIONS)
  ]),
  POI_ADDRESS: Object.freeze([
    Object.freeze({
      id: "action",
      labelKey: "fn_param_action",
      type: "enum",
      defaultValue: "copy",
      options: Object.freeze([
        Object.freeze({ id: "copy", labelKey: "fn_param_opt_copy_address" })
      ])
    }),
    Object.freeze({
      id: "format",
      labelKey: "fn_param_format",
      type: "enum",
      defaultValue: "txt",
      options: Object.freeze([
        Object.freeze({ id: "txt", labelKey: "fn_param_opt_txt" }),
        Object.freeze({ id: "vcard", labelKey: "fn_param_opt_vcard" })
      ])
    }),
    buildResultDestinationParameter([
      ACTION_RESULT_DESTINATIONS.CLIPBOARD,
      ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY
    ])
  ])
});
function docsUrl(topicId, hash) {
  return buildKpDeepLink({ kind: "docs", id: topicId, ...hash ? { hash } : {} });
}
var FUNCTION_DOCS_URL_BY_ID = Object.freeze({
  ACTIVATE: docsUrl("browsing-click"),
  ACTIVATE_DEFERRED_RANDOM: docsUrl("browsing-tabs"),
  ACTIVATE_DEFERRED_SCHEDULED: docsUrl("browsing-tabs"),
  SCHEDULE_LINK_MANUAL: docsUrl("browsing-tabs"),
  ACTIVATE_NEW_TAB: docsUrl("browsing-click"),
  ACTIVATE_NEW_TAB_BACKGROUND: docsUrl("browsing-click"),
  PREVIEW_LINK_POPOVER: docsUrl("tools-previews"),
  OPEN_POPOVER: docsUrl("tools-previews"),
  FORWARD: docsUrl("browsing-tabs"),
  BACK: docsUrl("browsing-tabs"),
  BACK2: docsUrl("browsing-tabs"),
  ROOT: docsUrl("browsing-tabs"),
  CLOSE_TAB: docsUrl("browsing-tabs"),
  CLOSE_WINDOW: docsUrl("browsing-tabs"),
  TAB_LEFT: docsUrl("browsing-tabs"),
  TAB_RIGHT: docsUrl("browsing-tabs"),
  NEW_TAB: docsUrl("browsing-tabs"),
  TAB_HISTORY: docsUrl("tools-tab-history"),
  TABS_OVERVIEW: docsUrl("browsing-tabs"),
  PAGE_UP_INSTANT: docsUrl("browsing-scroll"),
  PAGE_DOWN_INSTANT: docsUrl("browsing-scroll"),
  PAGE_TOP: docsUrl("browsing-scroll"),
  PAGE_BOTTOM: docsUrl("browsing-scroll"),
  SCROLL_LINE: docsUrl("browsing-scroll"),
  ZOOM_OUT: docsUrl("browsing-scroll"),
  ZOOM_IN: docsUrl("browsing-scroll"),
  HIGHLIGHT: docsUrl("browsing-select"),
  RECTANGLE_HIGHLIGHT: docsUrl("browsing-select"),
  COPY_HOVERED_IMAGE: docsUrl("media-copy"),
  COPY_HOVERED_URL: docsUrl("media-copy"),
  COPY_HOVERED_VIDEO: docsUrl("media-copy"),
  FONT_INFO: docsUrl("functions", "font-info"),
  PAGE_MEDIA: docsUrl("media-page"),
  READER_MODE: docsUrl("tools-reader"),
  DELETE: docsUrl("browsing-modes"),
  COLS_TOGGLE: docsUrl("browsing-modes"),
  OPEN_MEDIA_LIBRARY: docsUrl("media-library"),
  CLIPBOARD_COPY: docsUrl("browsing-select"),
  CLIPBOARD_CUT: docsUrl("browsing-select"),
  CLIPBOARD_PASTE: docsUrl("browsing-select"),
  CLIPBOARD_SELECT_ALL: docsUrl("browsing-select"),
  SELECT_WORD: docsUrl("browsing-select"),
  SELECT_SENTENCE: docsUrl("browsing-select"),
  SELECT_PARAGRAPH: docsUrl("browsing-select"),
  SELECT_IMAGE: docsUrl("browsing-select"),
  SEND_TEXT_TO_AI: docsUrl("functions", "send-text-to-ai"),
  LAUNCHER: docsUrl("tools-launcher"),
  TOP_SITES: docsUrl("tools-top-sites"),
  OMNIBOX: docsUrl("tools-omnibox"),
  TOGGLE_KEYBOARD_HELP: docsUrl("keyboard-reference"),
  OPEN_SETTINGS_POPOVER: docsUrl("settings"),
  CANCEL: docsUrl("browsing-modes"),
  POI_WEBSITE: docsUrl("functions", "poi"),
  POI_ADDRESS: docsUrl("functions", "poi"),
  TYPE_CHARACTERS: docsUrl("functions", "type-characters"),
  OPEN_URLS: docsUrl("browsing-tabs", "open-urls"),
  OPEN_BOOKMARKS: docsUrl("browsing-tabs", "open-bookmarks"),
  RANDOM_BOOKMARK: docsUrl("browsing-tabs", "random-bookmark"),
  EXECUTE_JS: docsUrl("execute-js"),
  GET_TEXT_AT_CURSOR: docsUrl("functions", "get-text-at-cursor"),
  GET_TEXT_RANGE: docsUrl("functions", "get-text-at-cursor"),
  GET_MEDIA_AT_CURSOR: docsUrl("functions", "get-text-at-cursor"),
  LOOKUP_WORD: docsUrl("functions", "lookup-word"),
  TRANSLATE: docsUrl("functions", "translate"),
  SHOW_POPOVER: docsUrl("functions", "show-popover"),
  ADD_URL_TO_MEDIA_LIBRARY: docsUrl("functions", "media-library-functions"),
  FETCH_URL_FOR_MEDIA_LIBRARY: docsUrl("functions", "media-library-functions"),
  SEND_HOTKEY: docsUrl("functions", "keystrokes"),
  SEND_BURST: docsUrl("functions", "keystrokes"),
  CYCLE_ROUND_ROBIN: docsUrl("functions", "keystrokes"),
  HOLD_CONTINUOUS: docsUrl("functions", "keystrokes"),
  CLICK_MOUSE_BUTTON: docsUrl("functions", "keystrokes"),
  REMAP_KEY: docsUrl("functions", "keystrokes")
});
var DEFAULT_FUNCTION_DOCS_URL = docsUrl("functions");
function getFunctionDocsUrl(functionId) {
  const id = String(functionId || "");
  return FUNCTION_DOCS_URL_BY_ID[id] || DEFAULT_FUNCTION_DOCS_URL;
}
function withDocsUrl(def) {
  if (!def || !def.id) return def;
  const url = getFunctionDocsUrl(def.id);
  return Object.freeze({ ...def, docsUrl: url });
}
var KEYSTROKE_FUNCTION_CATEGORY = "Keystrokes";
var TEXT_FUNCTION_CATEGORY = "Type";
var DATA_FUNCTION_CATEGORY = "Data";
var LOOKUP_FUNCTION_CATEGORY = "Lookup";
var TRANSLATE_FUNCTION_CATEGORY = "Translate";
var DISPLAY_FUNCTION_CATEGORY = "Display";
var SCRIPT_FUNCTION_CATEGORY = "Script";
var MEDIA_LIBRARY_FUNCTION_CATEGORY = "Media Library";
var FUNCTION_ID_BY_MACRO_KEY_KIND = Object.freeze({
  hotkey: "SEND_HOTKEY",
  burst: "SEND_BURST",
  roundRobin: "CYCLE_ROUND_ROBIN",
  continuous: "HOLD_CONTINUOUS",
  mouse: "CLICK_MOUSE_BUTTON",
  key: "REMAP_KEY"
});
var MACRO_KEY_KIND_BY_FUNCTION_ID = Object.freeze(
  Object.fromEntries(Object.entries(FUNCTION_ID_BY_MACRO_KEY_KIND).map(([k, v]) => [v, k]))
);
function buildKeystrokeFunctionDefs() {
  const out = {};
  for (const kindDef of MACRO_KEY_KIND_DEFS) {
    const functionId = FUNCTION_ID_BY_MACRO_KEY_KIND[kindDef.id];
    if (!functionId || isBuildExcludedKeyAction(functionId)) continue;
    out[functionId] = withDocsUrl(Object.freeze({
      id: functionId,
      labelKey: kindDef.labelKey,
      descriptionKey: kindDef.descriptionKey,
      ...kindDef.detailsKey ? { detailsKey: kindDef.detailsKey } : {},
      handler: "handleLegacyMacroKeyFunction",
      category: KEYSTROKE_FUNCTION_CATEGORY,
      keyboardClass: kindDef.keyboardClass,
      parameters: Object.freeze([
        Object.freeze({ id: "config", labelKey: "fn_param_config", type: "string" })
      ]),
      legacyMacroKeyKind: kindDef.id
    }));
  }
  return out;
}
var TYPE_CHARACTERS_FUNCTION_DEF = Object.freeze({
  id: "TYPE_CHARACTERS",
  labelKey: "fn_TYPE_CHARACTERS_label",
  descriptionKey: "fn_TYPE_CHARACTERS_description",
  detailsKey: "fn_TYPE_CHARACTERS_details",
  handler: "handleTypeCharactersKey",
  category: TEXT_FUNCTION_CATEGORY,
  keyboardClass: "key-purple",
  dataSource: "none",
  worksWhileTyping: TEXT_ACTIVE_BUILTIN_FUNCTION_IDS.has("TYPE_CHARACTERS"),
  parameters: Object.freeze([
    Object.freeze({
      id: "text",
      labelKey: "fn_param_text_to_type",
      type: "string",
      multiline: true,
      defaultValue: "",
      placeholderKey: "fn_param_text_to_type_placeholder"
    })
  ])
});
var OPEN_URLS_FUNCTION_DEF = Object.freeze({
  id: "OPEN_URLS",
  labelKey: "fn_OPEN_URLS_label",
  descriptionKey: "fn_OPEN_URLS_description",
  detailsKey: "fn_OPEN_URLS_details",
  handler: "handleOpenUrlsKey",
  category: "Tab Control",
  keyboardClass: "key-open-urls",
  dataSource: "none",
  parameters: Object.freeze([
    Object.freeze({
      id: "urls",
      labelKey: "fn_param_urls",
      type: "stringList",
      defaultValue: Object.freeze([]),
      maxItems: OPEN_URLS_MAX,
      presentation: "table",
      visibleRows: 5,
      placeholderKey: "fn_param_urls_placeholder",
      addLabelKey: "fn_param_urls_add",
      removeLabelKey: "fn_param_urls_remove"
    })
  ])
});
var OPEN_BOOKMARKS_FUNCTION_DEF = Object.freeze({
  id: "OPEN_BOOKMARKS",
  labelKey: "fn_OPEN_BOOKMARKS_label",
  descriptionKey: "fn_OPEN_BOOKMARKS_description",
  detailsKey: "fn_OPEN_BOOKMARKS_details",
  handler: "handleOpenBookmarksKey",
  category: "Tab Control",
  keyboardClass: "key-open-urls",
  dataSource: "none",
  parameters: Object.freeze([
    Object.freeze({
      id: "folderId",
      labelKey: "fn_param_bookmark_folder",
      type: "bookmarkFolder",
      defaultValue: "",
      placeholderKey: "fn_param_bookmark_folder_filter"
    })
  ])
});
var RANDOM_BOOKMARK_FUNCTION_DEF = Object.freeze({
  id: "RANDOM_BOOKMARK",
  labelKey: "fn_RANDOM_BOOKMARK_label",
  descriptionKey: "fn_RANDOM_BOOKMARK_description",
  detailsKey: "fn_RANDOM_BOOKMARK_details",
  handler: "handleRandomBookmarkKey",
  category: "Tab Control",
  keyboardClass: "key-open-urls",
  dataSource: "none",
  parameters: Object.freeze([
    Object.freeze({
      id: "folderId",
      labelKey: "fn_param_bookmark_folder",
      type: "bookmarkFolder",
      defaultValue: "",
      allowAll: true,
      placeholderKey: "fn_param_bookmark_folder_filter",
      hintKey: "fn_param_random_bookmark_hint"
    }),
    Object.freeze({
      id: "count",
      labelKey: "fn_param_random_bookmark_count",
      type: "number",
      defaultValue: 1,
      min: 1,
      max: RANDOM_BOOKMARK_MAX,
      step: 1
    })
  ])
});
var EXECUTE_JS_FUNCTION_DEF = Object.freeze({
  id: "EXECUTE_JS",
  labelKey: "fn_EXECUTE_JS_label",
  descriptionKey: "fn_EXECUTE_JS_description",
  detailsKey: "fn_EXECUTE_JS_details",
  handler: "handleExecuteJsKey",
  category: SCRIPT_FUNCTION_CATEGORY,
  keyboardClass: "key-purple",
  dataSource: "underCursor",
  parameters: Object.freeze([
    Object.freeze({
      id: "script",
      labelKey: "fn_param_script",
      type: "string",
      multiline: true,
      rows: 10,
      defaultValue: "",
      placeholderKey: "fn_param_script_placeholder"
    }),
    Object.freeze({
      id: "cbShowPopover",
      labelKey: "fn_param_cb_show_popover",
      type: "boolean",
      defaultValue: false,
      groupKey: "fn_param_group_callbacks"
    }),
    Object.freeze({
      id: "cbCopyToClipboard",
      labelKey: "fn_param_cb_copy",
      type: "boolean",
      defaultValue: false,
      groupKey: "fn_param_group_callbacks"
    }),
    Object.freeze({
      id: "cbNotify",
      labelKey: "fn_param_cb_notify",
      type: "boolean",
      defaultValue: false,
      groupKey: "fn_param_group_callbacks"
    })
  ])
});
function buildBuiltinActionFunctionDefs() {
  const out = {};
  for (const [id, def] of Object.entries(KEYBINDING_ACTION_DEFS)) {
    if (isBuildExcludedKeyAction(id)) continue;
    out[id] = withDocsUrl(Object.freeze({
      id,
      labelKey: `fn_${id}_label`,
      descriptionKey: `fn_${id}_description`,
      ...def.details ? { detailsKey: `fn_${id}_details` } : {},
      handler: def.handler,
      category: KEYBINDING_ACTION_CATEGORY_BY_ID[id] || "Other",
      keyboardClass: def.keyboardClass ?? null,
      // No `parameters` by default: most built-ins remain simple/non-instantiable Functions.
      // A few (SEND_TEXT_TO_AI, RECTANGLE_HIGHLIGHT, HIGHLIGHT, COPY_HOVERED_IMAGE,
      // COPY_HOVERED_URL, COPY_HOVERED_VIDEO, PREVIEW_LINK_POPOVER, OPEN_POPOVER)
      // get their schema below from
      // BUILTIN_FUNCTION_PARAMETER_OVERRIDES — see KEY_ACTION_ARCHITECTURE.md "Migration mapping".
      ...TEXT_ACTIVE_BUILTIN_FUNCTION_IDS.has(id) ? { worksWhileTyping: true } : {},
      ...def.mode ? { mode: def.mode } : {},
      ...def.cancelOnPointerDown ? { cancelOnPointerDown: true } : {},
      ...def.pointerBinding ? { pointerBinding: def.pointerBinding } : {},
      ...BUILTIN_FUNCTION_DATA_TAGS[id] || {},
      ...BUILTIN_FUNCTION_PARAMETER_OVERRIDES[id] ? { parameters: BUILTIN_FUNCTION_PARAMETER_OVERRIDES[id] } : {}
    }));
  }
  return out;
}
function buildDataAcquisitionFunctionDefs() {
  const GRANULARITY_OPTION_KEYS = Object.freeze({
    word: "fn_param_opt_word",
    sentence: "fn_param_opt_sentence",
    paragraph: "fn_param_opt_paragraph",
    hyperlink: "fn_param_opt_hyperlink"
  });
  const granularityOptions = (ids) => ({
    id: "granularity",
    labelKey: "fn_param_granularity",
    type: "enum",
    defaultValue: ids[0],
    options: ids.map((id) => ({
      id,
      labelKey: GRANULARITY_OPTION_KEYS[id] || "fn_param_opt_word"
    }))
  });
  return {
    GET_TEXT_AT_CURSOR: Object.freeze({
      id: "GET_TEXT_AT_CURSOR",
      labelKey: "fn_GET_TEXT_AT_CURSOR_label",
      descriptionKey: "fn_GET_TEXT_AT_CURSOR_description",
      detailsKey: "fn_GET_TEXT_AT_CURSOR_details",
      handler: "handleGetTextAtCursorKey",
      category: DATA_FUNCTION_CATEGORY,
      keyboardClass: "key-clipboard",
      dataSource: "underCursor",
      dataKind: "text",
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.CLIPBOARD]),
      parameters: Object.freeze([Object.freeze(granularityOptions(["word", "sentence", "paragraph", "hyperlink"]))])
    }),
    GET_TEXT_RANGE: Object.freeze({
      id: "GET_TEXT_RANGE",
      labelKey: "fn_GET_TEXT_RANGE_label",
      descriptionKey: "fn_GET_TEXT_RANGE_description",
      detailsKey: "fn_GET_TEXT_RANGE_details",
      handler: "handleGetTextRangeKey",
      category: DATA_FUNCTION_CATEGORY,
      keyboardClass: "key-clipboard",
      dataSource: "textRange",
      dataKind: "text",
      assignableToKey: false
    }),
    GET_MEDIA_AT_CURSOR: Object.freeze({
      id: "GET_MEDIA_AT_CURSOR",
      labelKey: "fn_GET_MEDIA_AT_CURSOR_label",
      descriptionKey: "fn_GET_MEDIA_AT_CURSOR_description",
      detailsKey: "fn_GET_MEDIA_AT_CURSOR_details",
      handler: "handleGetMediaAtCursorKey",
      category: DATA_FUNCTION_CATEGORY,
      keyboardClass: "key-page-media",
      dataSource: "underCursor",
      dataKind: "media",
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.CLIPBOARD]),
      parameters: Object.freeze([Object.freeze({
        id: "kind",
        labelKey: "fn_param_media_kind",
        type: "enum",
        defaultValue: "image",
        options: Object.freeze([
          Object.freeze({ id: "image", labelKey: "fn_param_opt_image" }),
          Object.freeze({ id: "video", labelKey: "fn_param_opt_video" }),
          Object.freeze({ id: "audio", labelKey: "fn_param_opt_audio" })
        ])
      })])
    }),
    LOOKUP_WORD: Object.freeze({
      id: "LOOKUP_WORD",
      labelKey: "fn_LOOKUP_WORD_label",
      descriptionKey: "fn_LOOKUP_WORD_description",
      detailsKey: "fn_LOOKUP_WORD_details",
      handler: "handleLookupWordKey",
      category: LOOKUP_FUNCTION_CATEGORY,
      keyboardClass: "key-page-media",
      dataSource: "underCursor",
      dataKind: "text",
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.POPOVER]),
      parameters: Object.freeze([
        Object.freeze({
          id: "source",
          labelKey: "fn_param_source",
          type: "enum",
          defaultValue: "dictionary",
          options: Object.freeze([
            Object.freeze({ id: "dictionary", labelKey: "fn_param_opt_dictionary" }),
            Object.freeze({ id: "ai", labelKey: "fn_param_opt_ask_ai" })
          ])
        })
      ])
    }),
    TRANSLATE: Object.freeze({
      id: "TRANSLATE",
      labelKey: "fn_TRANSLATE_label",
      descriptionKey: "fn_TRANSLATE_description",
      detailsKey: "fn_TRANSLATE_details",
      handler: "handleTranslateKey",
      category: TRANSLATE_FUNCTION_CATEGORY,
      keyboardClass: "key-page-media",
      dataSource: "underCursor",
      dataKind: "text",
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.MODIFY_PAGE, ACTION_RESULT_DESTINATIONS.POPOVER]),
      parameters: Object.freeze([
        Object.freeze(granularityOptions(["sentence", "word", "paragraph"])),
        Object.freeze({
          id: "targetLanguage",
          labelKey: "fn_param_target_language",
          type: "string",
          defaultValue: "English",
          placeholderKey: "fn_param_target_language_placeholder"
        }),
        buildResultDestinationParameter([
          ACTION_RESULT_DESTINATIONS.MODIFY_PAGE,
          ACTION_RESULT_DESTINATIONS.POPOVER
        ])
      ])
    }),
    SHOW_POPOVER: Object.freeze({
      id: "SHOW_POPOVER",
      labelKey: "fn_SHOW_POPOVER_label",
      descriptionKey: "fn_SHOW_POPOVER_description",
      detailsKey: "fn_SHOW_POPOVER_details",
      handler: "handleShowPopoverKey",
      category: DISPLAY_FUNCTION_CATEGORY,
      keyboardClass: "key-kp-ui",
      dataSource: "none",
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.POPOVER]),
      assignableToKey: false,
      parameters: Object.freeze([Object.freeze({
        id: "content",
        labelKey: "fn_param_content",
        type: "string",
        multiline: true,
        defaultValue: "",
        placeholderKey: "fn_param_content_placeholder"
      })])
    }),
    ADD_URL_TO_MEDIA_LIBRARY: Object.freeze({
      id: "ADD_URL_TO_MEDIA_LIBRARY",
      labelKey: "fn_ADD_URL_TO_MEDIA_LIBRARY_label",
      descriptionKey: "fn_ADD_URL_TO_MEDIA_LIBRARY_description",
      detailsKey: "fn_ADD_URL_TO_MEDIA_LIBRARY_details",
      handler: "handleAddUrlToMediaLibraryKey",
      category: MEDIA_LIBRARY_FUNCTION_CATEGORY,
      keyboardClass: "key-media-library",
      dataSource: "underCursor",
      dataKind: "text",
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY])
    }),
    FETCH_URL_FOR_MEDIA_LIBRARY: Object.freeze({
      id: "FETCH_URL_FOR_MEDIA_LIBRARY",
      labelKey: "fn_FETCH_URL_FOR_MEDIA_LIBRARY_label",
      descriptionKey: "fn_FETCH_URL_FOR_MEDIA_LIBRARY_description",
      detailsKey: "fn_FETCH_URL_FOR_MEDIA_LIBRARY_details",
      handler: "handleFetchUrlForMediaLibraryKey",
      category: MEDIA_LIBRARY_FUNCTION_CATEGORY,
      keyboardClass: "key-media-library",
      dataSource: "urlFetch",
      dataKind: "file",
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY])
    })
  };
}
function omitBuildExcludedFunctions(defs) {
  return Object.fromEntries(
    Object.entries(defs).filter(([id]) => !isBuildExcludedKeyAction(id))
  );
}
var FUNCTION_LIBRARY = Object.freeze(omitBuildExcludedFunctions({
  ...buildBuiltinActionFunctionDefs(),
  ...buildKeystrokeFunctionDefs(),
  [TYPE_CHARACTERS_FUNCTION_DEF.id]: withDocsUrl(TYPE_CHARACTERS_FUNCTION_DEF),
  [OPEN_URLS_FUNCTION_DEF.id]: withDocsUrl(OPEN_URLS_FUNCTION_DEF),
  [OPEN_BOOKMARKS_FUNCTION_DEF.id]: withDocsUrl(OPEN_BOOKMARKS_FUNCTION_DEF),
  [RANDOM_BOOKMARK_FUNCTION_DEF.id]: withDocsUrl(RANDOM_BOOKMARK_FUNCTION_DEF),
  [EXECUTE_JS_FUNCTION_DEF.id]: withDocsUrl(EXECUTE_JS_FUNCTION_DEF),
  ...Object.fromEntries(
    Object.entries(buildDataAcquisitionFunctionDefs()).map(([id, def]) => [id, withDocsUrl(def)])
  )
}));
var FUNCTION_CATEGORY_ORDER = Object.freeze([
  "Navigation",
  "Deferred Open URLs",
  "Tab Control",
  "Begin URL",
  "Get Page Data",
  "Maps",
  "Scroll",
  "Select",
  "Clipboard",
  TEXT_FUNCTION_CATEGORY,
  KEYSTROKE_FUNCTION_CATEGORY,
  DATA_FUNCTION_CATEGORY,
  LOOKUP_FUNCTION_CATEGORY,
  TRANSLATE_FUNCTION_CATEGORY,
  DISPLAY_FUNCTION_CATEGORY,
  SCRIPT_FUNCTION_CATEGORY,
  MEDIA_LIBRARY_FUNCTION_CATEGORY,
  "AI",
  "KeyPilot",
  "Tools",
  "System",
  "Other"
]);
var FUNCTION_CATEGORY_LABEL_KEYS = Object.freeze({
  Navigation: "fn_cat_navigation_label",
  "Deferred Open URLs": "fn_cat_deferred_open_urls_label",
  "Tab Control": "fn_cat_tab_control_label",
  "Begin URL": "fn_cat_begin_url_label",
  "Get Page Data": "fn_cat_get_page_data_label",
  Maps: "fn_cat_maps_label",
  Scroll: "fn_cat_scroll_label",
  Select: "fn_cat_select_label",
  Clipboard: "fn_cat_clipboard_label",
  [TEXT_FUNCTION_CATEGORY]: "fn_cat_type_label",
  [KEYSTROKE_FUNCTION_CATEGORY]: "fn_cat_keystrokes_label",
  [DATA_FUNCTION_CATEGORY]: "fn_cat_data_label",
  [LOOKUP_FUNCTION_CATEGORY]: "fn_cat_lookup_label",
  [TRANSLATE_FUNCTION_CATEGORY]: "fn_cat_translate_label",
  [DISPLAY_FUNCTION_CATEGORY]: "fn_cat_display_label",
  [SCRIPT_FUNCTION_CATEGORY]: "fn_cat_script_label",
  [MEDIA_LIBRARY_FUNCTION_CATEGORY]: "fn_cat_media_library_label",
  AI: "fn_cat_ai_label",
  KeyPilot: "fn_cat_keypilot_label",
  Tools: "fn_cat_tools_label",
  System: "fn_cat_system_label",
  Other: "fn_cat_other_label"
});
var FUNCTION_CATEGORY_DESCRIPTION_KEYS = Object.freeze({
  Navigation: "fn_cat_navigation_description",
  "Deferred Open URLs": "fn_cat_deferred_open_urls_description",
  "Tab Control": "fn_cat_tab_control_description",
  "Begin URL": "fn_cat_begin_url_description",
  "Get Page Data": "fn_cat_get_page_data_description",
  Maps: "fn_cat_maps_description",
  Scroll: "fn_cat_scroll_description",
  Select: "fn_cat_select_description",
  Clipboard: "fn_cat_clipboard_description",
  [TEXT_FUNCTION_CATEGORY]: "fn_cat_type_description",
  [KEYSTROKE_FUNCTION_CATEGORY]: "fn_cat_keystrokes_description",
  [DATA_FUNCTION_CATEGORY]: "fn_cat_data_description",
  [LOOKUP_FUNCTION_CATEGORY]: "fn_cat_lookup_description",
  [TRANSLATE_FUNCTION_CATEGORY]: "fn_cat_translate_description",
  [DISPLAY_FUNCTION_CATEGORY]: "fn_cat_display_description",
  [SCRIPT_FUNCTION_CATEGORY]: "fn_cat_script_description",
  [MEDIA_LIBRARY_FUNCTION_CATEGORY]: "fn_cat_media_library_description",
  AI: "fn_cat_ai_description",
  KeyPilot: "fn_cat_keypilot_description",
  Tools: "fn_cat_tools_description",
  System: "fn_cat_system_description",
  Other: "fn_cat_other_description"
});
var LIBRARY_SECTION_DESCRIPTIONS = Object.freeze({
  macros: "fn_section_macros_description",
  macroKeys: "fn_section_macro_keys_description"
});
var FUNCTION_LIBRARY_ITEM_ORDER = Object.freeze({
  // Navigation
  ACTIVATE: 10,
  ACTIVATE_DEFERRED_RANDOM: 12,
  ACTIVATE_DEFERRED_SCHEDULED: 14,
  SCHEDULE_LINK_MANUAL: 16,
  ACTIVATE_NEW_TAB: 20,
  ACTIVATE_NEW_TAB_BACKGROUND: 30,
  PREVIEW_LINK_POPOVER: 40,
  POI_WEBSITE: 45,
  POI_ADDRESS: 46,
  OPEN_POPOVER: 50,
  FORWARD: 60,
  BACK: 70,
  BACK2: 80,
  ROOT: 90,
  // Tab Control
  CLOSE_TAB: 110,
  CLOSE_WINDOW: 112,
  TAB_LEFT: 120,
  TAB_RIGHT: 130,
  NEW_TAB: 140,
  TAB_HISTORY: 150,
  TABS_OVERVIEW: 152,
  OPEN_BOOKMARKS: 153,
  RANDOM_BOOKMARK: 154,
  // Begin URL
  TOP_SITES: 155,
  LAUNCHER: 160,
  OMNIBOX: 170,
  // Get Page Data
  FONT_INFO: 200,
  PAGE_MEDIA: 205,
  READER_MODE: 206,
  RECTANGLE_HIGHLIGHT: 210,
  HIGHLIGHT: 220,
  // Clipboard
  CLIPBOARD_COPY: 230,
  CLIPBOARD_CUT: 231,
  CLIPBOARD_PASTE: 232,
  CLIPBOARD_SELECT_ALL: 233,
  COPY_HOVERED_IMAGE: 234,
  COPY_HOVERED_URL: 235,
  COPY_HOVERED_VIDEO: 236,
  SELECT_WORD: 237,
  SELECT_SENTENCE: 238,
  SELECT_PARAGRAPH: 239,
  SELECT_IMAGE: 240,
  // KeyPilot
  TOGGLE_KEYBOARD_HELP: 280,
  OPEN_SETTINGS_POPOVER: 290
});
function localizeFunctionParameter(param) {
  if (!param) return param;
  const out = { ...param };
  if (param.labelKey) out.label = getMessage(param.labelKey);
  if (param.placeholderKey) out.placeholder = getMessage(param.placeholderKey);
  if (param.hintKey) out.hint = getMessage(param.hintKey);
  if (param.groupKey) out.group = getMessage(param.groupKey);
  if (param.addLabelKey) out.addLabel = getMessage(param.addLabelKey);
  if (param.removeLabelKey) out.removeLabel = getMessage(param.removeLabelKey);
  if (Array.isArray(param.options)) {
    out.options = param.options.map((opt) => opt?.labelKey ? { ...opt, label: getMessage(opt.labelKey) } : opt);
  }
  return out;
}
function localizeFunctionDef(def) {
  if (!def) return null;
  const out = { ...def };
  if (def.labelKey) out.label = getMessage(def.labelKey);
  if (def.descriptionKey) out.description = getMessage(def.descriptionKey);
  if (def.detailsKey) out.details = getMessage(def.detailsKey);
  if (Array.isArray(def.parameters)) out.parameters = def.parameters.map(localizeFunctionParameter);
  return out;
}
function getFunctionDef(functionId) {
  const id = String(functionId || "");
  const raw = id && FUNCTION_LIBRARY[id];
  return raw ? localizeFunctionDef(raw) : null;
}
function defaultFunctionParameters(functionId) {
  const def = getFunctionDef(functionId);
  if (!def) return {};
  if (def.legacyMacroKeyKind) return { config: defaultMacroKeyConfig(def.legacyMacroKeyKind) };
  const out = {};
  for (const p of def.parameters || []) {
    out[p.id] = p.defaultValue;
  }
  return out;
}
function normalizeFunctionParameters(functionId, raw) {
  const def = getFunctionDef(functionId);
  if (!def) return {};
  const src = raw && typeof raw === "object" ? raw : {};
  if (def.legacyMacroKeyKind) {
    return { config: normalizeMacroKeyConfig(def.legacyMacroKeyKind, src.config) };
  }
  const defaults = defaultFunctionParameters(functionId);
  const out = {};
  for (const p of def.parameters || []) {
    const v = src[p.id];
    switch (p.type) {
      case "boolean":
        out[p.id] = typeof v === "boolean" ? v : !!defaults[p.id];
        break;
      case "number": {
        const n = Number(v);
        let value = Number.isFinite(n) ? n : defaults[p.id];
        if (typeof value === "number" && Number.isFinite(value)) {
          if (p.step != null && Number(p.step) >= 1) value = Math.round(value);
          if (p.min != null && value < p.min) value = p.min;
          if (p.max != null && value > p.max) value = p.max;
        }
        out[p.id] = value;
        break;
      }
      case "enum":
        out[p.id] = (p.options || []).some((o) => o.id === v) ? v : defaults[p.id];
        break;
      case "stringList":
        out[p.id] = normalizeOpenUrlList(
          v !== void 0 ? v : defaults[p.id],
          p.maxItems
        );
        break;
      case "bookmarkFolder":
        out[p.id] = normalizeBookmarkFolderId(v !== void 0 ? v : defaults[p.id]);
        break;
      default:
        out[p.id] = v !== void 0 ? String(v) : defaults[p.id] ?? "";
    }
  }
  return out;
}

// pages/deferred-open-settings.js
init_stock_actions();

// src/modules/keyboard-layout-store.js
init_keyboard_layouts();
init_stock_actions();

// src/config/stock-macros.js
var STOCK_MACRO_ID_PREFIX = "stock:";
var STOCK_MACROS = Object.freeze([
  Object.freeze({
    id: `${STOCK_MACRO_ID_PREFIX}ai-assist-flow`,
    label: "AI Assist Flow",
    icon: "placeholder",
    steps: Object.freeze([
      Object.freeze({ kind: "function", functionId: "HIGHLIGHT", parameters: {} }),
      Object.freeze({ kind: "wait", ms: 80 }),
      Object.freeze({ kind: "function", functionId: "CLIPBOARD_COPY", parameters: {} }),
      Object.freeze({ kind: "function", functionId: "OPEN_POPOVER", parameters: {} })
    ])
  }),
  Object.freeze({
    id: `${STOCK_MACRO_ID_PREFIX}quick-nav`,
    label: "Quick Nav",
    icon: "placeholder",
    steps: Object.freeze([
      Object.freeze({ kind: "function", functionId: "PAGE_DOWN_INSTANT", parameters: {}, delayMsBefore: 0 }),
      Object.freeze({ kind: "function", functionId: "TAB_RIGHT", parameters: {}, delayMsBefore: 50 })
    ])
  }),
  Object.freeze({
    id: `${STOCK_MACRO_ID_PREFIX}clip-search`,
    label: "Clip & Search",
    icon: "placeholder",
    steps: Object.freeze([
      Object.freeze({ kind: "function", functionId: "CLIPBOARD_COPY", parameters: {} }),
      Object.freeze({ kind: "gate", op: "truthy", left: "prior", thenSkip: 1 }),
      Object.freeze({ kind: "function", functionId: "OMNIBOX", parameters: {} })
    ])
  })
]);

// src/modules/keyboard-layout-store.js
init_i18n();
var KEYBOARD_LAYOUT_STORE_KEY = "kp_keyboard_layout_store_v1";
function getEmptyKeyboardLayoutStore() {
  return {
    version: 1,
    layouts: {},
    macros: {},
    actions: {}
  };
}
function nowMs() {
  return Date.now();
}
function genId(prefix) {
  try {
    const id = typeof crypto !== "undefined" && crypto && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${nowMs()}_${Math.random().toString(16).slice(2)}`;
    return `${prefix}${id}`;
  } catch {
    return `${prefix}${nowMs()}_${Math.random().toString(16).slice(2)}`;
  }
}
var HANDEDNESS_SLOT_PAIRS = Object.freeze([
  ["KeyQ", "KeyP"],
  ["KeyW", "KeyO"],
  ["KeyE", "KeyI"],
  ["KeyR", "KeyU"],
  ["KeyT", "KeyY"],
  ["KeyA", "Semicolon"],
  ["KeyS", "KeyL"],
  ["KeyD", "KeyK"],
  ["KeyF", "KeyJ"],
  ["KeyG", "KeyH"],
  ["KeyZ", "Slash"],
  ["KeyX", "Period"],
  ["KeyC", "Comma"],
  ["KeyV", "KeyM"],
  ["KeyB", "KeyN"]
]);
var MIRRORED_PHYSICAL_SLOT = Object.freeze(Object.fromEntries(
  HANDEDNESS_SLOT_PAIRS.flatMap(([a, b]) => [[a, b], [b, a]])
));
function normalizeMacroStep(step) {
  if (!step || typeof step !== "object") return null;
  const rawKind = String(step.kind || (step.functionId ? "function" : "")).trim();
  const kind = rawKind === "run_macro" ? "runMacro" : rawKind;
  if (kind === "wait") {
    const ms = Math.max(0, Math.floor(Number(step.ms) || 0));
    return { kind: "wait", ms };
  }
  if (kind === "stop") {
    return { kind: "stop" };
  }
  if (kind === "runMacro") {
    const macroId = String(step.macroId || "").trim();
    if (!macroId) return null;
    return { kind: "runMacro", macroId };
  }
  if (kind === "gate") {
    const thenSkip = Math.max(0, Math.floor(Number(step.thenSkip) || 0));
    const out = {
      kind: "gate",
      op: String(step.op || "truthy"),
      left: String(step.left || "prior")
    };
    if (step.leftKey != null && String(step.leftKey)) out.leftKey = String(step.leftKey);
    if (step.right !== void 0) out.right = step.right;
    if (thenSkip > 0) out.thenSkip = thenSkip;
    return out;
  }
  if (kind === "function" || step.functionId) {
    const functionId = String(step.functionId || "");
    const def = getFunctionDef(functionId);
    if (!def) return null;
    const out = {
      kind: "function",
      functionId: def.id,
      parameters: normalizeFunctionParameters(def.id, step?.parameters)
    };
    const delay = Number(step?.delayMsBefore);
    if (Number.isFinite(delay) && delay > 0) out.delayMsBefore = delay;
    return out;
  }
  return null;
}
function normalizeStoredMacros(rawMacros) {
  const src = rawMacros && typeof rawMacros === "object" ? rawMacros : {};
  const out = {};
  for (const [id, m] of Object.entries(src)) {
    if (!m || typeof m !== "object") continue;
    const rawSteps = Array.isArray(m.steps) ? m.steps : Array.isArray(m.actions) ? m.actions : [];
    const macro = {
      id: String(m.id || id),
      label: String(m.label || "Macro"),
      icon: m.icon,
      steps: rawSteps.map(normalizeMacroStep).filter(Boolean),
      createdAt: Number.isFinite(m.createdAt) ? m.createdAt : nowMs(),
      updatedAt: Number.isFinite(m.updatedAt) ? m.updatedAt : nowMs()
    };
    if (m.baseStockMacroId) macro.baseStockMacroId = String(m.baseStockMacroId);
    out[id] = macro;
  }
  return out;
}
async function getKeyboardLayoutStore() {
  try {
    const result = await chrome.storage.sync.get(KEYBOARD_LAYOUT_STORE_KEY);
    const stored = result && result[KEYBOARD_LAYOUT_STORE_KEY] ? result[KEYBOARD_LAYOUT_STORE_KEY] : null;
    if (stored && typeof stored === "object" && stored.version === 1) {
      return {
        version: 1,
        layouts: stored.layouts && typeof stored.layouts === "object" ? stored.layouts : {},
        macros: normalizeStoredMacros(stored.macros),
        actions: stored.actions && typeof stored.actions === "object" ? stored.actions : {}
      };
    }
  } catch {
  }
  return getEmptyKeyboardLayoutStore();
}
async function setKeyboardLayoutStore(next) {
  try {
    await chrome.storage.sync.set({ [KEYBOARD_LAYOUT_STORE_KEY]: next });
  } catch {
  }
}
async function getUserKeyboardLayoutById(id) {
  const st = await getKeyboardLayoutStore();
  const key2 = String(id || "");
  const v = st.layouts && typeof st.layouts === "object" ? st.layouts[key2] : null;
  return v && typeof v === "object" ? v : null;
}
async function getUserMacroById(id) {
  const st = await getKeyboardLayoutStore();
  const key2 = String(id || "");
  const m = st.macros && st.macros[key2] ? st.macros[key2] : null;
  return m || null;
}
async function getUserActionById(id) {
  const st = await getKeyboardLayoutStore();
  const key2 = String(id || "");
  const a = st.actions && st.actions[key2] ? st.actions[key2] : null;
  return a || null;
}
async function upsertUserKeyboardLayout(layout) {
  const st = await getKeyboardLayoutStore();
  const t = nowMs();
  const l = {
    ...layout,
    id: String(layout?.id || genId("layout:")),
    label: String(layout?.label || "Custom Layout"),
    builtIn: false,
    slots: layout && typeof layout.slots === "object" ? layout.slots : {},
    createdAt: Number.isFinite(layout?.createdAt) ? layout.createdAt : t,
    updatedAt: t
  };
  st.layouts[l.id] = l;
  await setKeyboardLayoutStore(st);
  return l;
}

// pages/deferred-open-settings.js
init_settings_manager();
init_i18n();

// src/utils/deferred-number-row.js
var DEFERRED_NUMBER_ROW_SLOTS = Object.freeze([
  Object.freeze({
    code: "Digit1",
    slot: "code:Digit1",
    actionId: "ACTIVATE_DEFERRED_RANDOM",
    label: "1"
  }),
  Object.freeze({
    code: "Digit2",
    slot: "code:Digit2",
    actionId: "ACTIVATE_DEFERRED_SCHEDULED",
    label: "2"
  }),
  Object.freeze({
    code: "Digit4",
    slot: "code:Digit4",
    actionId: "SCHEDULE_LINK_MANUAL",
    label: "4"
  })
]);
function slotHoldsAction(assigned, actionId) {
  return !!(assigned && assigned.type === "function" && String(assigned.id || "") === actionId);
}
function inspectDeferredNumberRowSlots(slots) {
  const map = slots && typeof slots === "object" ? slots : {};
  const conflicts = [];
  let needsWrite = false;
  for (const spec of DEFERRED_NUMBER_ROW_SLOTS) {
    const assigned = map[spec.slot];
    if (!assigned || !assigned.type || !assigned.id) {
      needsWrite = true;
      continue;
    }
    if (slotHoldsAction(assigned, spec.actionId)) continue;
    needsWrite = true;
    conflicts.push({
      code: spec.code,
      slot: spec.slot,
      actionId: spec.actionId,
      label: spec.label,
      current: { type: String(assigned.type), id: String(assigned.id) }
    });
  }
  return { conflicts, needsWrite };
}
function applyDeferredNumberRowSlots(slots) {
  const next = { ...slots && typeof slots === "object" ? slots : {} };
  for (const spec of DEFERRED_NUMBER_ROW_SLOTS) {
    next[spec.slot] = { type: "function", id: spec.actionId };
  }
  return next;
}
function clearDeferredNumberRowSlots(slots) {
  const next = { ...slots && typeof slots === "object" ? slots : {} };
  for (const spec of DEFERRED_NUMBER_ROW_SLOTS) {
    if (slotHoldsAction(next[spec.slot], spec.actionId)) next[spec.slot] = null;
  }
  return next;
}

// pages/deferred-open-settings.js
var scope = document;
var controller = null;
var unsubscribe = null;
var abort = null;
var conflictMode = null;
function el(id) {
  if (!scope || !id) return null;
  try {
    if (typeof scope.getElementById === "function") {
      const hit = scope.getElementById(id);
      if (hit) return hit;
    }
  } catch {
  }
  try {
    return scope.querySelector?.(`#${CSS.escape(id)}`) || null;
  } catch {
    return null;
  }
}
function all(sel) {
  try {
    return scope.querySelectorAll(sel);
  } catch {
    return [];
  }
}
function setInputValue(node, value) {
  writeSettingsInputValue(node, value);
}
async function labelForAssignment(assigned) {
  const id = String(assigned?.id || "");
  if (assigned?.type === "macro") {
    try {
      const macro = await getUserMacroById(id);
      if (macro?.label) return String(macro.label);
    } catch {
    }
    return id;
  }
  if (id.startsWith("action:")) {
    try {
      const action = await getUserActionById(id);
      if (action?.label) return String(action.label);
      const def = getFunctionDef(action?.functionId);
      if (def?.label) return String(def.label);
    } catch {
    }
  }
  if (id.startsWith("stock:")) {
    const stock = getStockActionById(id);
    if (stock?.label) return String(stock.label);
  }
  const named = getMessage(`fn_${id}_label`);
  return named || id;
}
function hideConflict() {
  conflictMode = null;
  const box = el("deferred-open-conflict");
  if (box) box.hidden = true;
  const list = el("deferred-open-conflict-list");
  if (list) list.replaceChildren();
}
async function showConflict(conflicts, mode) {
  conflictMode = mode;
  const box = el("deferred-open-conflict");
  const list = el("deferred-open-conflict-list");
  if (!box || !list) return;
  list.replaceChildren();
  for (const conflict of conflicts) {
    const item = document.createElement("li");
    const name = await labelForAssignment(conflict.current);
    item.textContent = getMessage("deferred_open_conflict_item", [conflict.label, name]) || `${conflict.label} is ${name}`;
    list.appendChild(item);
  }
  box.hidden = false;
}
async function activeUserLayout() {
  const sel = String(controller?.state?.currentKeyboardLayoutId || "");
  if (!sel.startsWith("user:")) return null;
  const id = sel.slice("user:".length);
  const layout = await getUserKeyboardLayoutById(id);
  return layout ? { id, layout } : null;
}
async function commitEnabled(patch) {
  const partial = {
    deferredOpen: {
      enabled: true,
      numberRowKeys: patch.numberRowKeys
    }
  };
  if (patch.showNumberRow) partial.keyboardReferenceShowNumberRow = true;
  await controller.updatePartial(partial);
}
async function writeLayoutSlots(layout, slots) {
  await upsertUserKeyboardLayout({ ...layout, slots });
}
async function turnOff() {
  hideConflict();
  const active = await activeUserLayout();
  if (active) {
    const next = clearDeferredNumberRowSlots(active.layout.slots);
    await writeLayoutSlots(active.layout, next);
  }
  await controller.updatePartial({
    deferredOpen: { enabled: false, numberRowKeys: "auto" }
  });
}
async function requestNumberRow(mode) {
  const active = await activeUserLayout();
  if (!active) {
    await commitEnabled({ numberRowKeys: "applied", showNumberRow: true });
    hideConflict();
    return;
  }
  const inspection = inspectDeferredNumberRowSlots(active.layout.slots);
  if (inspection.conflicts.length) {
    await showConflict(inspection.conflicts, mode);
    return;
  }
  if (inspection.needsWrite) {
    await writeLayoutSlots(active.layout, applyDeferredNumberRowSlots(active.layout.slots));
  }
  await commitEnabled({ numberRowKeys: "applied", showNumberRow: true });
  hideConflict();
}
async function replaceConflictKeys() {
  const mode = conflictMode;
  const active = await activeUserLayout();
  if (active) {
    await writeLayoutSlots(active.layout, applyDeferredNumberRowSlots(active.layout.slots));
  }
  hideConflict();
  if (mode === "assign" && controller?.state?.deferredOpen?.enabled === true) {
    await controller.updatePartial({
      deferredOpen: { numberRowKeys: "applied" },
      keyboardReferenceShowNumberRow: true
    });
    return;
  }
  await commitEnabled({ numberRowKeys: "applied", showNumberRow: true });
}
async function keepConflictKeys() {
  const mode = conflictMode;
  hideConflict();
  if (mode === "assign" && controller?.state?.deferredOpen?.enabled === true) {
    await controller.updatePartial({ deferredOpen: { numberRowKeys: "kept" } });
    return;
  }
  await commitEnabled({ numberRowKeys: "kept" });
}
function paintSwitch(inputId, textId, on) {
  const input = (
    /** @type {HTMLInputElement|null} */
    el(inputId)
  );
  if (input) input.checked = !!on;
  const text = el(textId);
  if (!text) return;
  text.textContent = getMessage(on ? "settings_state_on" : "settings_state_off");
  text.setAttribute("data-state", on ? "on" : "off");
}
function cancelConflict() {
  const mode = conflictMode;
  hideConflict();
  if (mode === "enable") paintSwitch("deferred-open-enabled", "deferred-open-enabled-text", false);
}
function applyDeferredOpen(deferredOpen) {
  const value = deferredOpen || DEFAULT_SETTINGS.deferredOpen;
  const openUrls = value.openUrls || DEFAULT_SETTINGS.deferredOpen.openUrls;
  const randomBookmarks = value.randomBookmarks || DEFAULT_SETTINGS.deferredOpen.randomBookmarks;
  const clickElement = value.clickElement || DEFAULT_SETTINGS.deferredOpen.clickElement;
  const closeTab = value.closeTab || DEFAULT_SETTINGS.deferredOpen.closeTab;
  const closeWindow = value.closeWindow || DEFAULT_SETTINGS.deferredOpen.closeWindow;
  if (!conflictMode) {
    paintSwitch("deferred-open-enabled", "deferred-open-enabled-text", value.enabled === true);
  }
  const urls = (
    /** @type {HTMLInputElement|null} */
    el("deferred-open-urls-enabled")
  );
  if (urls) urls.checked = openUrls.enabled !== false;
  setInputValue(el("deferred-open-urls-min-range"), openUrls.minMinutes);
  setInputValue(el("deferred-open-urls-min-number"), openUrls.minMinutes);
  setInputValue(el("deferred-open-urls-max-range"), openUrls.maxMinutes);
  setInputValue(el("deferred-open-urls-max-number"), openUrls.maxMinutes);
  const bookmarks = (
    /** @type {HTMLInputElement|null} */
    el("deferred-random-bookmarks-enabled")
  );
  if (bookmarks) bookmarks.checked = randomBookmarks.enabled !== false;
  setInputValue(el("deferred-random-bookmarks-min-range"), randomBookmarks.minMinutes);
  setInputValue(el("deferred-random-bookmarks-min-number"), randomBookmarks.minMinutes);
  setInputValue(el("deferred-random-bookmarks-max-range"), randomBookmarks.maxMinutes);
  setInputValue(el("deferred-random-bookmarks-max-number"), randomBookmarks.maxMinutes);
  const click = (
    /** @type {HTMLInputElement|null} */
    el("deferred-click-element-enabled")
  );
  if (click) click.checked = clickElement.enabled !== false;
  setInputValue(el("deferred-click-element-min-range"), clickElement.minMinutes);
  setInputValue(el("deferred-click-element-min-number"), clickElement.minMinutes);
  setInputValue(el("deferred-click-element-max-range"), clickElement.maxMinutes);
  setInputValue(el("deferred-click-element-max-number"), clickElement.maxMinutes);
  const closeTabToggle = (
    /** @type {HTMLInputElement|null} */
    el("deferred-close-tab-enabled")
  );
  if (closeTabToggle) closeTabToggle.checked = closeTab.enabled !== false;
  setInputValue(el("deferred-close-tab-min-range"), closeTab.minMinutes);
  setInputValue(el("deferred-close-tab-min-number"), closeTab.minMinutes);
  setInputValue(el("deferred-close-tab-max-range"), closeTab.maxMinutes);
  setInputValue(el("deferred-close-tab-max-number"), closeTab.maxMinutes);
  const closeWindowToggle = (
    /** @type {HTMLInputElement|null} */
    el("deferred-close-window-enabled")
  );
  if (closeWindowToggle) closeWindowToggle.checked = closeWindow.enabled !== false;
  setInputValue(el("deferred-close-window-min-range"), closeWindow.minMinutes);
  setInputValue(el("deferred-close-window-min-number"), closeWindow.minMinutes);
  setInputValue(el("deferred-close-window-max-range"), closeWindow.maxMinutes);
  setInputValue(el("deferred-close-window-max-number"), closeWindow.maxMinutes);
  setInputValue(el("deferred-open-target"), value.target === "originalWindow" ? "originalWindow" : "activeWindow");
  paintSwitch("deferred-silent-random", "deferred-silent-random-text", value.silentRandomScheduling === true);
}
async function injectDom(root) {
  if (root.querySelector?.(".deferred-open-app")) return;
  const url = chrome.runtime.getURL("pages/settings.html");
  const stylesheetHrefs = ["pages/ui-standards.css", "pages/settings.css"];
  const [html, ...cssTexts] = await Promise.all([
    fetch(url).then((res) => res.text()),
    ...stylesheetHrefs.map((href) => fetch(chrome.runtime.getURL(href)).then((res) => res.text()))
  ]);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  for (const cssText of cssTexts) {
    const style = document.createElement("style");
    style.textContent = cssText;
    root.appendChild(style);
  }
  const template = parsed.querySelector("#deferred-open-template");
  const fragment = template?.content?.cloneNode(true);
  if (fragment) root.appendChild(fragment);
}
async function mountDeferredOpenApp(root) {
  scope = root && root.nodeType !== 9 ? root : document;
  if (scope !== document) await injectDom(scope);
  localizeElements(scope);
  abort?.abort();
  abort = new AbortController();
  const signal = abort.signal;
  controller = createSettingsController();
  unsubscribe = controller.subscribe((settings) => applyDeferredOpen(settings?.deferredOpen));
  let live = null;
  try {
    const kp = window.__KeyPilotInstance || window.keyPilot;
    if (kp?._settings) live = kp._settings;
  } catch {
  }
  await controller.load({ snapshot: live });
  bindSettingsControls({
    controller,
    el,
    all,
    setInputValue,
    signal
  });
  const listen = { signal, capture: true };
  el("deferred-open-enabled")?.addEventListener("change", () => {
    const toggle = (
      /** @type {HTMLInputElement|null} */
      el("deferred-open-enabled")
    );
    if (!toggle) return;
    paintSwitch("deferred-open-enabled", "deferred-open-enabled-text", toggle.checked);
    if (toggle.checked) {
      void requestNumberRow("enable");
      return;
    }
    void turnOff();
  }, listen);
  el("deferred-silent-random")?.addEventListener("change", () => {
    const input = (
      /** @type {HTMLInputElement|null} */
      el("deferred-silent-random")
    );
    paintSwitch("deferred-silent-random", "deferred-silent-random-text", !!input?.checked);
  }, listen);
  el("deferred-open-assign-keys")?.addEventListener("click", () => {
    const enabled = controller?.state?.deferredOpen?.enabled === true;
    if (!enabled) {
      paintSwitch("deferred-open-enabled", "deferred-open-enabled-text", true);
    }
    void requestNumberRow(enabled ? "assign" : "enable");
  }, listen);
  el("deferred-open-conflict-replace")?.addEventListener("click", () => {
    void replaceConflictKeys();
  }, listen);
  el("deferred-open-conflict-keep")?.addEventListener("click", () => {
    void keepConflictKeys();
  }, listen);
  el("deferred-open-conflict-cancel")?.addEventListener("click", () => {
    cancelConflict();
  }, listen);
  return () => {
    try {
      abort?.abort();
    } catch {
    }
    abort = null;
    try {
      unsubscribe?.();
    } catch {
    }
    unsubscribe = null;
    try {
      controller?.dispose();
    } catch {
    }
    controller = null;
    scope = document;
    conflictMode = null;
  };
}

// pages/settings.js
var settingsScope = document;
var settingsHandlersInstalled = false;
var lastUiSettings = null;
var settingsDomBoundApp = null;
var pendingInitialPanel = null;
var settingsController = null;
var settingsUiAbort = null;
var settingsControllerUnsub = null;
function getLiveSettingsSnapshot() {
  try {
    const kp = window.keyPilot || window.__KeyPilotInstance;
    const s = kp && kp._settings;
    if (s && typeof s === "object") return s;
  } catch {
  }
  return null;
}
function settingsEl(id) {
  const scope2 = settingsScope || document;
  if (!scope2 || !id) return null;
  try {
    if (typeof scope2.getElementById === "function") {
      const hit = scope2.getElementById(id);
      if (hit) return hit;
    }
  } catch {
  }
  try {
    const escaped = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(id) : id;
    const hit = scope2.querySelector?.(`#${escaped}`);
    if (hit) return hit;
  } catch {
  }
  try {
    return scope2.querySelector?.(`[id="${id}"]`) || null;
  } catch {
    return null;
  }
}
function settingsOne(sel) {
  try {
    return settingsScope?.querySelector?.(sel) || null;
  } catch {
    return null;
  }
}
function settingsAll(sel) {
  try {
    return settingsScope?.querySelectorAll?.(sel) || [];
  } catch {
    return [];
  }
}
function applySearchEngineIcons() {
  const icons = settingsAll("img.radio-icon[data-favicon-for]");
  icons.forEach((img) => {
    const id = img.getAttribute("data-favicon-for");
    const meta = id && SEARCH_ENGINE_META[id] ? SEARCH_ENGINE_META[id] : null;
    const pageUrl = meta?.homeUrl || "";
    if (!pageUrl) {
      img.src = GENERIC_FAVICON_DATA_URL;
      return;
    }
    img.src = getExtensionFaviconUrl(pageUrl, 32);
    img.addEventListener("error", () => {
      img.src = GENERIC_FAVICON_DATA_URL;
    }, { once: true });
  });
}
function adaptHeaderForPopoverEmbed(embedded = false) {
  try {
    if (!embedded) {
      try {
        embedded = !!(window.parent && window.parent !== window);
      } catch {
        embedded = false;
      }
    }
    if (!embedded) return;
    const app = settingsOne(".settings-app");
    app?.classList?.add("kp-popover-embed");
    const header = settingsOne(".settings-app > .header");
    if (header) {
      header.hidden = true;
      header.setAttribute("aria-hidden", "true");
    }
  } catch {
  }
}
var SETTINGS_TAB_STORAGE_KEY = "kp_settings_active_tab";
var KEYBOARD_HELP_STORAGE_KEY = "keypilot_keyboard_help_visible";
async function queryKeyboardHelpVisible() {
  try {
    const kp = window.keyPilot || window.__KeyPilotInstance;
    if (kp && typeof kp.getKeyboardHelpVisibleFromStorage === "function") {
      return Boolean(await kp.getKeyboardHelpVisibleFromStorage());
    }
  } catch {
  }
  try {
    const syncResult = await chrome.storage.sync.get([KEYBOARD_HELP_STORAGE_KEY]);
    if (typeof syncResult?.[KEYBOARD_HELP_STORAGE_KEY] === "boolean") {
      return syncResult[KEYBOARD_HELP_STORAGE_KEY];
    }
  } catch {
  }
  try {
    const localResult = await chrome.storage.local.get([KEYBOARD_HELP_STORAGE_KEY]);
    if (typeof localResult?.[KEYBOARD_HELP_STORAGE_KEY] === "boolean") {
      return localResult[KEYBOARD_HELP_STORAGE_KEY];
    }
  } catch {
  }
  return false;
}
async function setKeyboardHelpVisible(visible) {
  const desired = Boolean(visible);
  const payload = { [KEYBOARD_HELP_STORAGE_KEY]: desired, timestamp: Date.now() };
  try {
    await chrome.storage.sync.set(payload);
  } catch {
  }
  try {
    await chrome.storage.local.set(payload);
  } catch {
  }
  try {
    const kp = window.keyPilot || window.__KeyPilotInstance;
    const inPopover = !!(kp?._isPopoverOsWindow || window.__KP_POPOVER_WINDOW);
    if (!inPopover && kp && typeof kp.applyKeyboardHelpVisibility === "function") {
      kp.applyKeyboardHelpVisibility(desired, { persist: false });
    }
  } catch {
  }
  return desired;
}
var SETTINGS_DEFAULT_PANEL_ID = "overview";
var SETTINGS_PANEL_IDS = Object.freeze([
  "overview",
  "appearance",
  "keyboard",
  "click-mode",
  "text-mode",
  "scrolling",
  "cursor",
  "control-strip",
  "search",
  "about",
  "debug"
]);
var SETTINGS_SUSPENDED_PANEL_IDS = Object.freeze([
  "appearance",
  "text-mode"
]);
function isDebugSettingsUiPresent() {
  return !!settingsEl("tab-debug");
}
function isSettingsPanelAvailable(panelId) {
  if (!SETTINGS_PANEL_IDS.includes(panelId) || SETTINGS_SUSPENDED_PANEL_IDS.includes(panelId)) {
    return false;
  }
  if (panelId === "debug") return BUILD_ENABLE_DEBUG_SETTINGS && isDebugSettingsUiPresent();
  return true;
}
function stripDebugSettingsSurface() {
  if (BUILD_ENABLE_DEBUG_SETTINGS) return;
  settingsAll("[data-kp-debug-settings]").forEach((el2) => {
    try {
      el2.remove();
    } catch {
    }
  });
}
function resolveAvailableSettingsPanelId(panelId) {
  return isSettingsPanelAvailable(panelId) ? panelId : SETTINGS_DEFAULT_PANEL_ID;
}
function settingsNavTabs() {
  return Array.from(settingsAll(".settings-tab[data-panel]")).filter((tab) => isSettingsPanelAvailable(tab.getAttribute("data-panel")));
}
function activateSettingsPanel(panelId, opts = {}) {
  const id = resolveAvailableSettingsPanelId(panelId);
  const tabs = settingsNavTabs();
  const panels = Array.from(settingsAll(".settings-panel[data-panel]"));
  tabs.forEach((tab) => {
    const selected = tab.getAttribute("data-panel") === id;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.tabIndex = selected ? 0 : -1;
    if (selected && opts.focusTab) {
      try {
        tab.focus();
      } catch {
      }
    }
  });
  panels.forEach((panel) => {
    const selected = panel.getAttribute("data-panel") === id;
    panel.classList.toggle("is-active", selected);
    if (selected) {
      panel.hidden = false;
      panel.removeAttribute("hidden");
    } else {
      panel.hidden = true;
    }
  });
  if (id === "appearance") {
    try {
      applyAppearanceControls(lastUiSettings);
    } catch {
    }
  }
  if (opts.persist !== false) {
    try {
      sessionStorage.setItem(SETTINGS_TAB_STORAGE_KEY, id);
    } catch {
    }
  }
  try {
    const detail = settingsOne(".settings-detail");
    if (detail) detail.scrollTop = 0;
  } catch {
  }
}
function installSettingsMasterDetailNav() {
  const nav = settingsOne(".settings-nav");
  const tabs = settingsNavTabs();
  if (!nav || tabs.length === 0) return;
  let initial = SETTINGS_DEFAULT_PANEL_ID;
  const fromMount = normalizeSettingsPanelId(pendingInitialPanel);
  pendingInitialPanel = null;
  if (fromMount) {
    initial = resolveAvailableSettingsPanelId(fromMount);
  } else {
    try {
      const hash = (location.hash || "").replace(/^#/, "");
      if (isSettingsPanelAvailable(hash)) {
        initial = hash;
      } else {
        const stored = sessionStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
        if (stored && isSettingsPanelAvailable(stored)) initial = stored;
      }
    } catch {
    }
  }
  activateSettingsPanel(initial, { persist: false });
  const signal = settingsUiAbort?.signal;
  const listenOpts = signal ? { signal } : {};
  tabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const panelId = tab.getAttribute("data-panel");
      withOptionalViewTransition(() => activateSettingsPanel(panelId));
    }, listenOpts);
  });
  settingsAll(".settings-hub-tile[data-goto]").forEach((tile) => {
    tile.addEventListener("click", (e) => {
      e.preventDefault();
      const panelId = tile.getAttribute("data-goto");
      if (!panelId || !isSettingsPanelAvailable(panelId)) return;
      withOptionalViewTransition(() => activateSettingsPanel(panelId, { focusTab: true }));
    }, listenOpts);
  });
  nav.addEventListener("keydown", (e) => {
    if (!e) return;
    const key2 = e.key;
    if (key2 !== "ArrowDown" && key2 !== "ArrowUp" && key2 !== "Home" && key2 !== "End") return;
    const currentIndex = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    if (currentIndex < 0) return;
    let nextIndex = currentIndex;
    if (key2 === "ArrowDown") nextIndex = Math.min(tabs.length - 1, currentIndex + 1);
    if (key2 === "ArrowUp") nextIndex = Math.max(0, currentIndex - 1);
    if (key2 === "Home") nextIndex = 0;
    if (key2 === "End") nextIndex = tabs.length - 1;
    if (nextIndex === currentIndex) return;
    e.preventDefault();
    const panelId = tabs[nextIndex].getAttribute("data-panel");
    withOptionalViewTransition(() => activateSettingsPanel(panelId, { focusTab: true }));
  }, listenOpts);
}
function parsePxNumber(raw, fallback = 0) {
  const n = parseFloat(String(raw ?? "").replace(/px$/i, "").trim());
  return Number.isFinite(n) ? n : fallback;
}
function toHexColor(raw, fallback = "#888888") {
  const s = String(raw || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const h = (n) => Number(n).toString(16).padStart(2, "0");
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
  }
  return fallback;
}
var THEME_NAME_KEYS = Object.freeze({
  "dark-pro": "settings_static_018",
  "gray-metal-pro": "settings_static_019",
  "gx-er": "settings_static_020"
});
function themeDisplayName(themeId, customized) {
  const name = getMessage(THEME_NAME_KEYS[themeId] || "") || THEME_META[themeId]?.name || themeId;
  return customized ? getMessage("settings_theme_custom_name", name) : name;
}
function localizeSettingsMixedCopy() {
  const clickHint = settingsEl("settings-click-effect-hint");
  if (clickHint) clickHint.textContent = getMessage("settings_click_effect_hint", "F");
  const paintHint = settingsEl("settings-paint-mode-hint");
  if (paintHint) paintHint.textContent = getMessage("settings_paint_mode_hint", formatAltShortcut("D"));
  const stripLead = settingsEl("settings-control-strip-lead");
  if (stripLead) stripLead.textContent = getMessage("settings_control_strip_lead", formatAltShortcut("J"));
  const omnibox = formatAltShortcut("L");
  const stripToggle = formatAltShortcut("J");
  for (const el2 of settingsScope.querySelectorAll('[data-i18n="settings_static_038"]')) {
    el2.textContent = getMessage("settings_static_038", omnibox);
  }
  for (const el2 of settingsScope.querySelectorAll('[data-i18n="settings_static_104"]')) {
    el2.textContent = getMessage("settings_static_104", omnibox);
  }
  for (const el2 of settingsScope.querySelectorAll('[data-i18n="settings_static_218"]')) {
    el2.textContent = getMessage("settings_static_218", stripToggle);
  }
}
function setRadioGroupValue(radios, value) {
  const v = String(value);
  radios.forEach((r) => {
    r.checked = r.value === v;
  });
}
function setInputValue2(el2, value) {
  writeSettingsInputValue(el2, value);
}
function applyAppearanceControls(settings) {
  const s = settings || lastUiSettings || getLiveSettingsSnapshot() || DEFAULT_SETTINGS;
  lastUiSettings = s;
  const theme = resolveThemeFromSettings(s);
  const shape = theme.shape || {};
  const radius = theme.radius || {};
  const type2 = theme.type || {};
  const titlebar = theme.titlebar || {};
  const keys = theme.keys || {};
  const color4 = theme.color || {};
  const cutSize = parsePxNumber(shape.cutSize, 8);
  const panelRadius = parsePxNumber(radius.panel, 3);
  const keyCut = parsePxNumber(keys.cutSize, 4);
  const typeUi = parsePxNumber(type2.size?.ui, 12);
  const typeKbd = parsePxNumber(type2.size?.kbd, 10);
  const titleWeight = String(titlebar.titleWeight || "600");
  const normalizedTitleWeight = titleWeight === "400" || titleWeight === "700" ? titleWeight : "600";
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="app-corner-mode"]')),
    shape.cornerMode === "cut" ? "cut" : "radius"
  );
  setInputValue2(settingsEl("app-cut-size-range"), cutSize);
  setInputValue2(settingsEl("app-cut-size-number"), cutSize);
  setInputValue2(settingsEl("app-panel-radius-range"), panelRadius);
  setInputValue2(settingsEl("app-panel-radius-number"), panelRadius);
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="app-title-transform"]')),
    type2.textTransform?.titlebar === "uppercase" ? "uppercase" : "none"
  );
  setInputValue2(settingsEl("app-title-tracking"), type2.letterSpacing?.titlebar || "0.02em");
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="app-title-weight"]')),
    normalizedTitleWeight
  );
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="app-title-icon"]')),
    titlebar.iconDisplay === "inline-flex" ? "inline-flex" : "none"
  );
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="app-kbd-transform"]')),
    titlebar.kbdTransform === "uppercase" ? "uppercase" : "none"
  );
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="app-key-shading"]')),
    keys.shading === "flat" ? "flat" : "bevel"
  );
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="app-key-corner"]')),
    keys.cornerMode === "cut" ? "cut" : "radius"
  );
  setInputValue2(settingsEl("app-key-cut-range"), keyCut);
  setInputValue2(settingsEl("app-key-cut-number"), keyCut);
  setInputValue2(settingsEl("app-key-border"), keys.border || "1px solid rgba(0, 0, 0, 0.4)");
  const colorEl = (id, value, fallback) => {
    const el2 = (
      /** @type {HTMLInputElement|null} */
      settingsEl(id)
    );
    if (el2) el2.value = toHexColor(value, fallback);
  };
  colorEl("app-color-accent", color4.accent, "#4a90c8");
  colorEl("app-color-fg", color4.fg, "#dddddd");
  colorEl("app-color-fg-dim", color4.fgDim, "#aaaaaa");
  colorEl("app-color-panel", color4.panel, "#232323");
  colorEl("app-color-panel-edge", color4.panelEdge, "#3a3a3a");
  colorEl("app-color-title-top", color4.titleTop, "#4c4c4c");
  colorEl("app-color-title-mid", color4.titleMid, "#353535");
  colorEl("app-color-title-bot", color4.titleBot, "#252525");
  colorEl("app-color-kbd", color4.kbdColor || color4.fg, "#dddddd");
  setInputValue2(settingsEl("app-type-ui-range"), typeUi);
  setInputValue2(settingsEl("app-type-ui-number"), typeUi);
  setInputValue2(settingsEl("app-type-kbd-range"), typeKbd);
  setInputValue2(settingsEl("app-type-kbd-number"), typeKbd);
}
function applyAppearanceFromCache() {
  let overrides = {};
  try {
    const raw = localStorage.getItem("kp_theme_overrides_v1");
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) overrides = parsed;
  } catch {
    overrides = {};
  }
  let themeId = "dark-pro";
  try {
    const cached = localStorage.getItem("kp_theme_id_v1");
    if (cached) themeId = cached;
  } catch {
  }
  applyAppearanceControls({ themeId, themeOverrides: overrides });
}
function renderCursorPreview({ container, kind, uri }) {
  if (!container) return;
  container.style.cursor = "";
  container.innerHTML = "";
  if (kind === "native_arrow") {
    container.style.cursor = "default";
    container.textContent = getMessage("settings_cursor_preview_native_arrow");
    return;
  }
  if (kind === "native_pointer") {
    container.style.cursor = "pointer";
    container.textContent = getMessage("settings_cursor_preview_native_pointer");
    return;
  }
  if (!uri) {
    container.textContent = getMessage("settings_cursor_preview_unavailable");
    return;
  }
  const img = document.createElement("img");
  img.alt = getMessage("settings_cursor_preview_alt");
  img.src = uri;
  container.appendChild(img);
}
function applyVisibility(el2, visible) {
  if (!el2) return;
  el2.hidden = !visible;
  el2.style.display = visible ? "" : "none";
}
function withOptionalViewTransition(fn) {
  try {
    if (typeof document.startViewTransition === "function") {
      document.startViewTransition(() => {
        try {
          fn();
        } catch {
        }
      });
      return;
    }
  } catch {
  }
  fn();
}
async function render() {
  stripDebugSettingsSurface();
  applySearchEngineIcons();
  const appRoot = settingsOne(".settings-app");
  const bindDom = !!(appRoot && appRoot !== settingsDomBoundApp);
  if (bindDom) settingsDomBoundApp = appRoot;
  const bindGlobal = !settingsHandlersInstalled;
  if (bindGlobal) settingsHandlersInstalled = true;
  if (bindDom || bindGlobal) {
    settingsUiAbort?.abort();
    settingsUiAbort = new AbortController();
  }
  const uiSignal = settingsUiAbort?.signal;
  if (bindDom) {
    installSettingsMasterDetailNav();
  }
  const radios = Array.from(settingsAll('input[type="radio"][name="engine"]'));
  const keyFeedbackToggle = (
    /** @type {HTMLInputElement|null} */
    settingsEl("keyboard-reference-key-feedback")
  );
  const showNumberRowToggle = (
    /** @type {HTMLInputElement|null} */
    settingsEl("keyboard-reference-show-number-row")
  );
  const keyboardHelpToggle = (
    /** @type {HTMLInputElement|null} */
    settingsEl("settings-keyboard-help-toggle")
  );
  const keyboardHelpStateText = settingsEl("settings-keyboard-help-text");
  const keyboardLayoutFamilySelect = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("keyboard-layout-family")
  );
  const keyboardLeftHandedToggle = (
    /** @type {HTMLInputElement|null} */
    settingsEl("keyboard-left-handed")
  );
  const controlStripVisible = (
    /** @type {HTMLInputElement|null} */
    settingsEl("control-strip-visible")
  );
  const controlStripCollapsed = (
    /** @type {HTMLInputElement|null} */
    settingsEl("control-strip-collapsed")
  );
  const cursorModeRadios = (
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="cursor-mode"]'))
  );
  const cursorSettingsClick = settingsEl("cursor-settings-click");
  const cursorSettingsText = settingsEl("cursor-settings-text");
  const clickCursorType = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("click-cursor-type")
  );
  const clickCursorLineWidthRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-cursor-linewidth-range")
  );
  const clickCursorLineWidthNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-cursor-linewidth-number")
  );
  const clickCursorSizeRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-cursor-size-range")
  );
  const clickCursorSizeNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-cursor-size-number")
  );
  const clickCursorGapRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-cursor-gap-range")
  );
  const clickCursorGapNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-cursor-gap-number")
  );
  const clickCursorPreview = settingsEl("click-cursor-preview");
  const clickFocusColorRadios = (
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="click-focus-color"]'))
  );
  const clickFocusColorCustom = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-focus-color-custom")
  );
  const clickOverlayFill = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-overlay-fill")
  );
  const clickOverlayFillMaxWidthRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-overlay-fill-max-width-range")
  );
  const clickOverlayFillMaxWidthNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-overlay-fill-max-width-number")
  );
  const clickOverlayFillMaxHeightRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-overlay-fill-max-height-range")
  );
  const clickOverlayFillMaxHeightNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-overlay-fill-max-height-number")
  );
  const clickOverlayShadow = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-overlay-shadow")
  );
  const clickRectThicknessRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-rect-thickness-range")
  );
  const clickRectThicknessNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-rect-thickness-number")
  );
  const clickEffectRadios = (
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="click-effect"]'))
  );
  const clickKeyboardLinkHints = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-keyboard-link-hints")
  );
  const clickPaintStrategy = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("click-paint-strategy")
  );
  const clickPaintBackendDebug = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-paint-backend-debug")
  );
  const clickSkipForParent = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-skip-for-parent")
  );
  const clickFocusPaddingRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-focus-padding-range")
  );
  const clickFocusPaddingNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-focus-padding-number")
  );
  const clickCursorResetBtn = settingsEl("click-cursor-reset");
  const clickModeResetBtn = settingsEl("click-mode-reset");
  const uiThemeSelect = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("ui-theme-select")
  );
  const uiThemeSelectAppearance = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("ui-theme-select-appearance")
  );
  const settingsResetAllBtn = settingsEl("settings-reset-all");
  const settingsResetAppearanceBtn = settingsEl("settings-reset-appearance");
  const debugLoggingToggle = (
    /** @type {HTMLInputElement|null} */
    settingsEl("debug-logging")
  );
  const deferredOpenUrlsEnabled = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-open-urls-enabled")
  );
  const deferredOpenUrlsMinRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-open-urls-min-range")
  );
  const deferredOpenUrlsMinNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-open-urls-min-number")
  );
  const deferredOpenUrlsMaxRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-open-urls-max-range")
  );
  const deferredOpenUrlsMaxNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-open-urls-max-number")
  );
  const deferredRandomBookmarksEnabled = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-random-bookmarks-enabled")
  );
  const deferredRandomBookmarksMinRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-random-bookmarks-min-range")
  );
  const deferredRandomBookmarksMinNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-random-bookmarks-min-number")
  );
  const deferredRandomBookmarksMaxRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-random-bookmarks-max-range")
  );
  const deferredRandomBookmarksMaxNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-random-bookmarks-max-number")
  );
  const deferredClickElementEnabled = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-click-element-enabled")
  );
  const deferredClickElementMinRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-click-element-min-range")
  );
  const deferredClickElementMinNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-click-element-min-number")
  );
  const deferredClickElementMaxRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-click-element-max-range")
  );
  const deferredClickElementMaxNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-click-element-max-number")
  );
  const deferredCloseTabEnabled = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-close-tab-enabled")
  );
  const deferredCloseTabMinRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-close-tab-min-range")
  );
  const deferredCloseTabMinNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-close-tab-min-number")
  );
  const deferredCloseTabMaxRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-close-tab-max-range")
  );
  const deferredCloseTabMaxNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-close-tab-max-number")
  );
  const deferredCloseWindowEnabled = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-close-window-enabled")
  );
  const deferredCloseWindowMinRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-close-window-min-range")
  );
  const deferredCloseWindowMinNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-close-window-min-number")
  );
  const deferredCloseWindowMaxRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-close-window-max-range")
  );
  const deferredCloseWindowMaxNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-close-window-max-number")
  );
  const deferredOpenTarget = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("deferred-open-target")
  );
  const deferredSilentRandom = (
    /** @type {HTMLInputElement|null} */
    settingsEl("deferred-silent-random")
  );
  const textCursorType = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("text-cursor-type")
  );
  const textCursorPreview = settingsEl("text-cursor-preview");
  const textCursorResetBtn = settingsEl("text-cursor-reset");
  const textFocusStyleRadios = (
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="text-focus-style"]'))
  );
  const textLeftEdgeWidthField = settingsEl("text-left-edge-width-field");
  const textLeftEdgeWidthRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("text-left-edge-width-range")
  );
  const textLeftEdgeWidthNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("text-left-edge-width-number")
  );
  const textLabelsEnabled = (
    /** @type {HTMLInputElement|null} */
    settingsEl("text-labels-enabled")
  );
  const textStrokeThicknessRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("text-stroke-thickness-range")
  );
  const textStrokeThicknessNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("text-stroke-thickness-number")
  );
  const textModeResetBtn = settingsEl("text-mode-reset");
  const scrollHalfPageRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("scroll-half-page-range")
  );
  const scrollHalfPageNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("scroll-half-page-number")
  );
  const scrollSpeedSelect = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("scroll-speed")
  );
  const scrollMiddleClickScrollLine = (
    /** @type {HTMLInputElement|null} */
    settingsEl("scroll-middle-click-scroll-line")
  );
  const scrollLinePreferPortrait = (
    /** @type {HTMLInputElement|null} */
    settingsEl("scroll-line-prefer-portrait")
  );
  const scrollResetBtn = settingsEl("scroll-reset");
  const previewCursor = new CursorManager();
  const isTextEntry = (target) => {
    if (!target) return false;
    const tag = target.tagName?.toLowerCase?.();
    if (tag === "textarea") return true;
    if (tag === "input") {
      const type2 = String(target.getAttribute?.("type") || target.type || "text").toLowerCase();
      return type2 === "text" || type2 === "search" || type2 === "url" || type2 === "email" || type2 === "tel" || type2 === "password" || type2 === "number";
    }
    return !!target.isContentEditable;
  };
  if (bindGlobal) {
    document.addEventListener("keydown", (e) => {
      if (!e) return;
      if (e.key !== "f" && e.key !== "F") return;
      if (isTextEntry(e.target)) return;
      if (e.defaultPrevented) return;
      if (e.cancelBubble) return;
      const kp = window.__KeyPilotInstance;
      if (!kp || typeof kp.handleActivateKey !== "function") return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      try {
        kp.handleActivateKey();
      } catch {
      }
    }, { capture: false, signal: uiSignal });
  }
  const applyEngine = (engine) => {
    const normalized = normalizeSearchEngine(engine);
    radios.forEach((r) => {
      r.checked = r.value === normalized;
    });
  };
  const applyKeyFeedbackToggle = (enabled) => {
    if (!keyFeedbackToggle) return;
    keyFeedbackToggle.checked = !!enabled;
  };
  const applyShowNumberRowToggle = (enabled) => {
    if (!showNumberRowToggle) return;
    showNumberRowToggle.checked = !!enabled;
  };
  const applyKeyboardHelpVisible = (visible) => {
    const on = Boolean(visible);
    if (keyboardHelpToggle) keyboardHelpToggle.checked = on;
    if (keyboardHelpStateText) {
      keyboardHelpStateText.textContent = getMessage(on ? "settings_state_on" : "settings_state_off");
      keyboardHelpStateText.setAttribute("data-state", on ? "on" : "off");
    }
  };
  const ensureLayoutFamilyOptions = () => {
    if (!keyboardLayoutFamilySelect) return;
    keyboardLayoutFamilySelect.innerHTML = "";
    const items = Array.isArray(BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META) ? BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META : [];
    for (const m of items) {
      if (!m || !m.id || !m.labelKey) continue;
      const opt = document.createElement("option");
      opt.value = String(m.id);
      opt.textContent = getMessage(m.labelKey);
      keyboardLayoutFamilySelect.appendChild(opt);
    }
  };
  const applyKeyboardLayoutFamily = (familyId) => {
    if (!keyboardLayoutFamilySelect) return;
    const v = normalizeKeyboardLayoutFamilyId(familyId);
    setInputValue2(keyboardLayoutFamilySelect, v);
  };
  const applyKeyboardHandedness = (handedness) => {
    if (!keyboardLeftHandedToggle) return;
    const h = normalizeKeyboardHandedness(handedness);
    keyboardLeftHandedToggle.checked = h === "left";
  };
  const applyControlStrip = (controlStrip) => {
    const cs = controlStrip || DEFAULT_SETTINGS.controlStrip;
    if (controlStripVisible) controlStripVisible.checked = !!cs?.visible;
    if (controlStripCollapsed) controlStripCollapsed.checked = !!cs?.collapsed;
  };
  const applyCursorMode = (cursorMode) => {
    const mode = normalizeCursorMode(cursorMode);
    cursorModeRadios.forEach((r) => {
      r.checked = r.value === mode;
    });
    const showCursorSettings = mode === CURSOR_MODE.CUSTOM_CURSORS;
    applyVisibility(cursorSettingsClick, showCursorSettings);
    applyVisibility(cursorSettingsText, showCursorSettings);
  };
  const applyClickMode = (clickMode) => {
    const cm = clickMode || DEFAULT_SETTINGS.clickMode;
    setInputValue2(clickCursorType, cm?.cursor?.type ?? DEFAULT_SETTINGS.clickMode.cursor.type);
    setInputValue2(clickCursorLineWidthRange, cm?.cursor?.lineWidth ?? DEFAULT_SETTINGS.clickMode.cursor.lineWidth);
    setInputValue2(clickCursorLineWidthNumber, cm?.cursor?.lineWidth ?? DEFAULT_SETTINGS.clickMode.cursor.lineWidth);
    setInputValue2(clickCursorSizeRange, cm?.cursor?.sizePixels ?? DEFAULT_SETTINGS.clickMode.cursor.sizePixels);
    setInputValue2(clickCursorSizeNumber, cm?.cursor?.sizePixels ?? DEFAULT_SETTINGS.clickMode.cursor.sizePixels);
    setInputValue2(clickCursorGapRange, cm?.cursor?.gap ?? DEFAULT_SETTINGS.clickMode.cursor.gap);
    setInputValue2(clickCursorGapNumber, cm?.cursor?.gap ?? DEFAULT_SETTINGS.clickMode.cursor.gap);
    const color4 = normalizeFocusColor2(cm?.focusColor ?? DEFAULT_SETTINGS.clickMode.focusColor);
    const preset = isFocusColorPreset(color4);
    clickFocusColorRadios.forEach((r) => {
      r.checked = preset ? r.value === color4 : r.value === "custom";
    });
    if (clickFocusColorCustom) clickFocusColorCustom.value = hexForFocusColor(color4);
    if (clickOverlayFill) {
      clickOverlayFill.checked = cm?.overlayFillEnabled === true;
    }
    const overlayFillOn = cm?.overlayFillEnabled === true;
    const overlayFillMaxWidth = cm?.overlayFillMaxWidth ?? DEFAULT_SETTINGS.clickMode.overlayFillMaxWidth;
    const overlayFillMaxHeight = cm?.overlayFillMaxHeight ?? DEFAULT_SETTINGS.clickMode.overlayFillMaxHeight;
    setInputValue2(clickOverlayFillMaxWidthRange, overlayFillMaxWidth);
    setInputValue2(clickOverlayFillMaxWidthNumber, overlayFillMaxWidth);
    setInputValue2(clickOverlayFillMaxHeightRange, overlayFillMaxHeight);
    setInputValue2(clickOverlayFillMaxHeightNumber, overlayFillMaxHeight);
    for (const el2 of [
      clickOverlayFillMaxWidthRange,
      clickOverlayFillMaxWidthNumber,
      clickOverlayFillMaxHeightRange,
      clickOverlayFillMaxHeightNumber
    ]) {
      if (el2) el2.disabled = !overlayFillOn;
    }
    if (clickOverlayShadow) {
      clickOverlayShadow.checked = cm?.overlayShadowEnabled === true;
    }
    setInputValue2(clickRectThicknessRange, cm?.rectangleThickness ?? DEFAULT_SETTINGS.clickMode.rectangleThickness);
    setInputValue2(clickRectThicknessNumber, cm?.rectangleThickness ?? DEFAULT_SETTINGS.clickMode.rectangleThickness);
    if (clickPaintStrategy) {
      clickPaintStrategy.value = normalizePaintStrategy(
        cm?.paintStrategy ?? DEFAULT_SETTINGS.clickMode.paintStrategy
      );
    }
    if (clickPaintBackendDebug) {
      clickPaintBackendDebug.checked = cm?.paintBackendDebugDashes === true;
    }
    if (clickSkipForParent) {
      clickSkipForParent.checked = cm?.skipForParent !== false;
    }
    setInputValue2(clickFocusPaddingRange, cm?.focusPadding ?? DEFAULT_SETTINGS.clickMode.focusPadding);
    setInputValue2(clickFocusPaddingNumber, cm?.focusPadding ?? DEFAULT_SETTINGS.clickMode.focusPadding);
    const effect = cm?.clickEffect ?? DEFAULT_SETTINGS.clickMode.clickEffect ?? "flash";
    clickEffectRadios.forEach((r) => {
      r.checked = r.value === effect;
    });
    if (clickKeyboardLinkHints) {
      clickKeyboardLinkHints.checked = cm?.keyboardLinkHoverHints === true;
    }
    const type2 = cm?.cursor?.type ?? DEFAULT_SETTINGS.clickMode.cursor.type;
    if (type2 === "native_arrow" || type2 === "native_pointer") {
      renderCursorPreview({ container: clickCursorPreview, kind: type2 });
    } else {
      const strokeWidth = cm?.cursor?.lineWidth ?? DEFAULT_SETTINGS.clickMode.cursor.lineWidth;
      const sizePixels = cm?.cursor?.sizePixels ?? DEFAULT_SETTINGS.clickMode.cursor.sizePixels;
      const gap = cm?.cursor?.gap ?? DEFAULT_SETTINGS.clickMode.cursor.gap;
      const uri = previewCursor.getCursorDataUri("none", {
        strokeWidth,
        crossHairQuadrantWidth: sizePixels,
        gap
      });
      renderCursorPreview({ container: clickCursorPreview, kind: "crosshair", uri });
    }
  };
  const applyTextMode = (textMode) => {
    const tm = textMode || DEFAULT_SETTINGS.textMode;
    setInputValue2(textCursorType, tm?.cursorType ?? DEFAULT_SETTINGS.textMode.cursorType);
    if (textLabelsEnabled) textLabelsEnabled.checked = !!tm?.labelsEnabled;
    setInputValue2(textStrokeThicknessRange, tm?.strokeThickness ?? DEFAULT_SETTINGS.textMode.strokeThickness);
    setInputValue2(textStrokeThicknessNumber, tm?.strokeThickness ?? DEFAULT_SETTINGS.textMode.strokeThickness);
    setInputValue2(textLeftEdgeWidthRange, tm?.leftEdgeWidth ?? DEFAULT_SETTINGS.textMode.leftEdgeWidth);
    setInputValue2(textLeftEdgeWidthNumber, tm?.leftEdgeWidth ?? DEFAULT_SETTINGS.textMode.leftEdgeWidth);
    const focusStyle = normalizeTextFocusStyle(tm?.focusStyle ?? DEFAULT_SETTINGS.textMode.focusStyle);
    textFocusStyleRadios.forEach((r) => {
      r.checked = r.value === focusStyle;
    });
    applyVisibility(textLeftEdgeWidthField, focusStyle === "left_edge");
    const type2 = tm?.cursorType ?? DEFAULT_SETTINGS.textMode.cursorType;
    if (type2 === "crosshair") {
      const uri = previewCursor.getCursorDataUri("text_focus", { hasClickableElement: false });
      renderCursorPreview({ container: textCursorPreview, kind: "crosshair", uri });
    } else {
      const uri = previewCursor.getCursorDataUri("text_focus", { cursorType: "t_square", hasClickableElement: false });
      renderCursorPreview({ container: textCursorPreview, kind: "t_square", uri });
    }
  };
  const applyThemeSelect = (settings) => {
    const themeId = normalizeThemeId(settings?.themeId);
    const customized = hasThemeOverrides(settings?.themeOverrides);
    const labelFor = (id) => themeDisplayName(id, customized && id === themeId);
    const fillSelect = (el2) => {
      if (!el2) return;
      const items = listThemes();
      if (el2.options.length !== items.length) {
        el2.innerHTML = "";
        for (const item of items) {
          const opt = document.createElement("option");
          opt.value = item.id;
          opt.textContent = labelFor(item.id);
          el2.appendChild(opt);
        }
      } else {
        Array.from(el2.options).forEach((opt) => {
          opt.textContent = labelFor(opt.value);
        });
      }
      el2.value = themeId;
    };
    fillSelect(uiThemeSelect);
    fillSelect(uiThemeSelectAppearance);
    const badges = [
      settingsEl("ui-theme-custom-badge"),
      settingsEl("ui-theme-custom-badge-appearance")
    ];
    badges.forEach((badge) => {
      if (!badge) return;
      badge.hidden = !customized;
    });
  };
  const paintPageTheme = (settings) => {
    try {
      const theme = resolveThemeFromSettings(settings);
      const roots = [document];
      if (settingsScope && settingsScope !== document) roots.push(settingsScope);
      applyThemeToRoots(theme, {
        roots,
        hosts: [document.documentElement, settingsScope?.host].filter(Boolean)
      });
    } catch {
    }
  };
  const applyScroll = (scroll) => {
    const sc = scroll || DEFAULT_SETTINGS.scroll;
    const half = sc?.halfPagePx ?? DEFAULT_SETTINGS.scroll.halfPagePx;
    const speed = sc?.speed === "instant" ? "instant" : "smooth";
    setInputValue2(scrollHalfPageRange, half);
    setInputValue2(scrollHalfPageNumber, half);
    setInputValue2(scrollSpeedSelect, speed);
    if (scrollMiddleClickScrollLine) {
      scrollMiddleClickScrollLine.checked = !!sc?.middleClickScrollLine;
    }
    if (scrollLinePreferPortrait) {
      scrollLinePreferPortrait.checked = sc?.linePreferPortraitTargets !== false;
    }
  };
  const applyDebugLogging = (enabled) => {
    const on = !!enabled;
    if (debugLoggingToggle) debugLoggingToggle.checked = on;
    applyDebugSetting(on);
  };
  const applyDeferredOpen2 = (deferredOpen) => {
    const value = deferredOpen || DEFAULT_SETTINGS.deferredOpen;
    const openUrls = value.openUrls || DEFAULT_SETTINGS.deferredOpen.openUrls;
    const randomBookmarks = value.randomBookmarks || DEFAULT_SETTINGS.deferredOpen.randomBookmarks;
    const clickElement = value.clickElement || DEFAULT_SETTINGS.deferredOpen.clickElement;
    const closeTab = value.closeTab || DEFAULT_SETTINGS.deferredOpen.closeTab;
    const closeWindow = value.closeWindow || DEFAULT_SETTINGS.deferredOpen.closeWindow;
    if (deferredOpenUrlsEnabled) deferredOpenUrlsEnabled.checked = openUrls.enabled !== false;
    setInputValue2(deferredOpenUrlsMinRange, openUrls.minMinutes);
    setInputValue2(deferredOpenUrlsMinNumber, openUrls.minMinutes);
    setInputValue2(deferredOpenUrlsMaxRange, openUrls.maxMinutes);
    setInputValue2(deferredOpenUrlsMaxNumber, openUrls.maxMinutes);
    if (deferredRandomBookmarksEnabled) deferredRandomBookmarksEnabled.checked = randomBookmarks.enabled !== false;
    setInputValue2(deferredRandomBookmarksMinRange, randomBookmarks.minMinutes);
    setInputValue2(deferredRandomBookmarksMinNumber, randomBookmarks.minMinutes);
    setInputValue2(deferredRandomBookmarksMaxRange, randomBookmarks.maxMinutes);
    setInputValue2(deferredRandomBookmarksMaxNumber, randomBookmarks.maxMinutes);
    if (deferredClickElementEnabled) deferredClickElementEnabled.checked = clickElement.enabled !== false;
    setInputValue2(deferredClickElementMinRange, clickElement.minMinutes);
    setInputValue2(deferredClickElementMinNumber, clickElement.minMinutes);
    setInputValue2(deferredClickElementMaxRange, clickElement.maxMinutes);
    setInputValue2(deferredClickElementMaxNumber, clickElement.maxMinutes);
    if (deferredCloseTabEnabled) deferredCloseTabEnabled.checked = closeTab.enabled !== false;
    setInputValue2(deferredCloseTabMinRange, closeTab.minMinutes);
    setInputValue2(deferredCloseTabMinNumber, closeTab.minMinutes);
    setInputValue2(deferredCloseTabMaxRange, closeTab.maxMinutes);
    setInputValue2(deferredCloseTabMaxNumber, closeTab.maxMinutes);
    if (deferredCloseWindowEnabled) deferredCloseWindowEnabled.checked = closeWindow.enabled !== false;
    setInputValue2(deferredCloseWindowMinRange, closeWindow.minMinutes);
    setInputValue2(deferredCloseWindowMinNumber, closeWindow.minMinutes);
    setInputValue2(deferredCloseWindowMaxRange, closeWindow.maxMinutes);
    setInputValue2(deferredCloseWindowMaxNumber, closeWindow.maxMinutes);
    setInputValue2(deferredOpenTarget, value.target === "originalWindow" ? "originalWindow" : "activeWindow");
    if (deferredSilentRandom) deferredSilentRandom.checked = value.silentRandomScheduling === true;
  };
  const applyAllSettings = (settings) => {
    const s = settings || DEFAULT_SETTINGS;
    lastUiSettings = s;
    applyThemeSelect(s);
    applyAppearanceControls(s);
    paintPageTheme(s);
    applyEngine(s.searchEngine);
    applyCursorMode(s.cursorMode);
    applyKeyboardLayoutFamily(s.keyboardLayoutFamilyId);
    applyKeyboardHandedness(s.keyboardHandedness);
    applyKeyFeedbackToggle(s.keyboardReferenceKeyFeedback);
    applyShowNumberRowToggle(s.keyboardReferenceShowNumberRow);
    applyControlStrip(s.controlStrip);
    applyClickMode(s.clickMode);
    applyTextMode(s.textMode);
    applyScroll(s.scroll);
    applyDeferredOpen2(s.deferredOpen);
    applyDebugLogging(s.debugLogging);
  };
  try {
    if (uiThemeSelect) {
      uiThemeSelect.replaceChildren();
      for (const t of listThemes()) {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = themeDisplayName(t.id, false);
        uiThemeSelect.appendChild(opt);
      }
    }
    ensureLayoutFamilyOptions();
    if (!settingsController || settingsController.disposed) {
      settingsController = createSettingsController();
    }
    if (settingsControllerUnsub) {
      try {
        settingsControllerUnsub();
      } catch {
      }
      settingsControllerUnsub = null;
    }
    settingsControllerUnsub = settingsController.subscribe((s) => applyAllSettings(s));
    const live = getLiveSettingsSnapshot();
    await settingsController.load({ snapshot: live });
  } catch {
    ensureLayoutFamilyOptions();
    applyAllSettings(DEFAULT_SETTINGS);
  }
  queryKeyboardHelpVisible().then(applyKeyboardHelpVisible).catch(() => applyKeyboardHelpVisible(false));
  if (!bindDom && !bindGlobal) return;
  if (!settingsController) return;
  const signal = settingsUiAbort?.signal;
  if (!signal) return;
  const listenOpts = { signal, capture: true };
  bindSettingsControls({
    controller: settingsController,
    el: settingsEl,
    all: settingsAll,
    setInputValue: setInputValue2,
    signal,
    withViewTransition: withOptionalViewTransition,
    applyState: applyAllSettings
  });
  settingsEl("open-deferred-opening")?.addEventListener("click", () => {
    try {
      const kp = window.__KeyPilotInstance || window.keyPilot;
      kp?.handleOpenDeferredOpenPopover?.();
    } catch {
    }
  }, listenOpts);
  const commitFocusColor = (raw) => {
    void settingsController.update("clickMode.focusColor", normalizeFocusColor2(raw));
  };
  clickFocusColorRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      if (radio.value === "custom") {
        commitFocusColor(clickFocusColorCustom?.value || hexForFocusColor("blue"));
        return;
      }
      commitFocusColor(radio.value);
    }, listenOpts);
  });
  const onCustomFocusColor = () => {
    const customRadio = clickFocusColorRadios.find((r) => r.value === "custom");
    if (customRadio) customRadio.checked = true;
    commitFocusColor(clickFocusColorCustom.value);
  };
  clickFocusColorCustom?.addEventListener("input", onCustomFocusColor, listenOpts);
  clickFocusColorCustom?.addEventListener("change", onCustomFocusColor, listenOpts);
  uiThemeSelect?.addEventListener("change", () => {
    void settingsController.applyThemePack(uiThemeSelect.value);
  }, listenOpts);
  uiThemeSelectAppearance?.addEventListener("change", () => {
    void settingsController.applyThemePack(uiThemeSelectAppearance.value);
  }, listenOpts);
  settingsResetAppearanceBtn?.addEventListener("click", () => {
    void settingsController.reset("appearance");
  }, listenOpts);
  settingsResetAllBtn?.addEventListener("click", async () => {
    const ok = typeof window.confirm === "function" ? window.confirm(getMessage("settings_reset_all_confirm")) : true;
    if (!ok) return;
    await settingsController.reset("all");
  }, listenOpts);
  keyboardHelpToggle?.addEventListener("change", async () => {
    const desired = !!keyboardHelpToggle.checked;
    keyboardHelpToggle.disabled = true;
    try {
      const actual = await setKeyboardHelpVisible(desired);
      applyKeyboardHelpVisible(actual);
    } catch {
      applyKeyboardHelpVisible(await queryKeyboardHelpVisible());
    } finally {
      keyboardHelpToggle.disabled = false;
    }
  }, listenOpts);
  clickCursorResetBtn?.addEventListener("click", () => {
    void settingsController.reset("click-cursor");
  }, listenOpts);
  clickModeResetBtn?.addEventListener("click", () => {
    void settingsController.reset("click-mode");
  }, listenOpts);
  textCursorResetBtn?.addEventListener("click", () => {
    void settingsController.reset("text-cursor");
  }, listenOpts);
  textModeResetBtn?.addEventListener("click", () => {
    void settingsController.reset("text-mode");
  }, listenOpts);
  scrollResetBtn?.addEventListener("click", () => {
    void settingsController.reset("scroll");
  }, listenOpts);
  try {
    const onHelpStorage = (changes, area) => {
      if (signal.aborted) return;
      if (area !== "sync" && area !== "local") return;
      const helpChange = changes?.[KEYBOARD_HELP_STORAGE_KEY];
      if (helpChange && typeof helpChange.newValue === "boolean") {
        applyKeyboardHelpVisible(helpChange.newValue);
      }
    };
    chrome.storage.onChanged.addListener(onHelpStorage);
    signal.addEventListener("abort", () => {
      try {
        chrome.storage.onChanged.removeListener(onHelpStorage);
      } catch {
      }
    }, { once: true });
  } catch {
  }
}
async function injectSettingsDom(root) {
  if (root.querySelector?.(".settings-app")) return;
  const url = chrome.runtime.getURL("pages/settings.html");
  const stylesheetHrefs = ["pages/ui-standards.css", "pages/settings.css"];
  const [html, ...cssTexts] = await Promise.all([
    fetch(url).then((res) => res.text()),
    ...stylesheetHrefs.map(
      (href) => fetch(chrome.runtime.getURL(href)).then((res) => res.text())
    )
  ]);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  for (const cssText of cssTexts) {
    const style = document.createElement("style");
    style.textContent = cssText;
    root.appendChild(style);
  }
  const sprite = parsed.querySelector(".settings-icon-sprite");
  const app = parsed.querySelector(".settings-app");
  if (sprite) root.appendChild(document.importNode(sprite, true));
  if (app) root.appendChild(document.importNode(app, true));
}
function setActiveSettingsPanel(panelId) {
  const id = normalizeSettingsPanelId(panelId);
  if (!id || !settingsDomBoundApp) return false;
  activateSettingsPanel(resolveAvailableSettingsPanelId(id), { focusTab: true });
  return true;
}
async function mountSettingsApp(root, options = {}) {
  const embedded = options.embedded === true;
  pendingInitialPanel = normalizeSettingsPanelId(options.initialPanel) || null;
  if (root && root.nodeType !== 9) {
    await injectSettingsDom(root);
    settingsScope = root;
  } else {
    settingsScope = document;
  }
  localizeElements(settingsScope);
  localizeSettingsMixedCopy();
  adaptHeaderForPopoverEmbed(embedded);
  try {
    applyAppearanceFromCache();
  } catch {
  }
  await render();
  return () => {
    try {
      settingsUiAbort?.abort();
    } catch {
    }
    settingsUiAbort = null;
    if (settingsControllerUnsub) {
      try {
        settingsControllerUnsub();
      } catch {
      }
      settingsControllerUnsub = null;
    }
    try {
      settingsController?.dispose();
    } catch {
    }
    settingsController = null;
    settingsHandlersInstalled = false;
    settingsScope = document;
    settingsDomBoundApp = null;
    pendingInitialPanel = null;
  };
}
export {
  applyAppearanceControls,
  mountDeferredOpenApp,
  mountSettingsApp,
  setActiveSettingsPanel
};
