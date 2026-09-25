(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };

  // extension/src/utils/i18n.js
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
  function localizeKeycapLabel(text) {
    const raw = String(text || "");
    const key2 = KEYCAP_MESSAGE_KEYS[raw];
    if (!key2) return raw;
    return getMessage(key2) || raw;
  }
  function normalizeLocaleTag(value) {
    const tag = String(value ?? "").trim().replace(/_/g, "-");
    return LOCALE_TAG_PATTERN.test(tag) ? tag : "";
  }
  function getUILocaleTag() {
    try {
      const fromCatalog = normalizeLocaleTag(chrome?.i18n?.getMessage?.("locale_tag"));
      if (fromCatalog) return fromCatalog;
    } catch {
    }
    try {
      const fromUi = normalizeLocaleTag(chrome?.i18n?.getUILanguage?.());
      if (fromUi) return fromUi;
    } catch {
    }
    return DEFAULT_LOCALE;
  }
  function getMessage(key2, substitutions) {
    const messageKey = typeof key2 === "string" ? key2.trim() : "";
    if (!messageKey) return missingMessage(String(key2 || "(empty key)"));
    try {
      const message = chrome?.i18n?.getMessage?.(messageKey, substitutions);
      return typeof message === "string" && message ? message : missingMessage(messageKey);
    } catch {
      return missingMessage(messageKey);
    }
  }
  var DEFAULT_LOCALE, KEYCAP_MESSAGE_KEYS, LOCALE_TAG_PATTERN, ATTRIBUTE_BINDINGS;
  var init_i18n = __esm({
    "extension/src/utils/i18n.js"() {
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

  // extension/src/config/keyboard-hardware-layouts.js
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
  function buildKeyboardReferenceUiLayout({
    hardwareLayoutId = DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID,
    keybindings = {},
    includeNumberRow = false
  } = {}) {
    const layout = getKeyboardHardwareLayout(hardwareLayoutId);
    const physicalKeysByCode = /* @__PURE__ */ new Map();
    for (const physicalRow of layout.rows) {
      for (const physicalKey of physicalRow.keys) {
        physicalKeysByCode.set(physicalKey.code, physicalKey);
      }
    }
    const actionIdByCode = /* @__PURE__ */ new Map();
    for (const [actionId, binding] of Object.entries(keybindings || {})) {
      if (binding?.bindingType !== "physical" || !Array.isArray(binding.keys)) continue;
      for (const code of binding.keys) {
        if (physicalKeysByCode.has(code)) actionIdByCode.set(code, actionId);
      }
    }
    const itemForCode = (code) => {
      const physicalKey = physicalKeysByCode.get(code);
      if (!physicalKey) return null;
      const className = KEYBOARD_REFERENCE_SPECIAL_CLASS_BY_CODE[code] || "key";
      const actionId = actionIdByCode.get(code);
      if (actionId) {
        return Object.freeze({
          type: "action",
          code,
          legend: physicalKey.legends.base,
          id: actionId,
          fallbackText: actionId,
          ...className !== "key" ? { className } : {}
        });
      }
      if (KEYBOARD_REFERENCE_SPECIAL_CLASS_BY_CODE[code]) {
        return Object.freeze({ type: "special", code, text: physicalKey.legends.base, className });
      }
      return Object.freeze({ type: "key", code, text: physicalKey.legends.base });
    };
    const rows = [];
    if (includeNumberRow) {
      rows.push(Object.freeze(
        layout.keyboardReference.numberRowCodes.map(itemForCode).filter(Boolean)
      ));
    }
    for (const referenceRowDef of layout.keyboardReference.rows) {
      rows.push(Object.freeze(
        referenceRowDef.codes.map(itemForCode).filter(Boolean)
      ));
    }
    return Object.freeze(rows);
  }
  function getKeyboardHardwareLayout(rawId) {
    const id = normalizeKeyboardHardwareLayoutId(rawId);
    return KEYBOARD_HARDWARE_LAYOUTS[id] || KEYBOARD_HARDWARE_LAYOUTS[DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID];
  }
  var DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID, US_ANSI_QWERTY_ROWS, US_ANSI_QWERTY_KEYBOARD_REFERENCE, ISO_INTL_BACKSLASH, GERMAN_ISO_QWERTZ_ROWS, SPAIN_ISO_QWERTY_ROWS, SLOVAK_ISO_QWERTZ_ROWS, JIS_INTL_YEN, JIS_INTL_RO, JIS_NON_CONVERT, JIS_CONVERT, JIS_KANA_MODE, JAPANESE_JIS_ROWS, JAPANESE_JIS_KEYBOARD_REFERENCE, KEYBOARD_HARDWARE_LAYOUTS, KEYBOARD_REFERENCE_SPECIAL_CLASS_BY_CODE;
  var init_keyboard_hardware_layouts = __esm({
    "extension/src/config/keyboard-hardware-layouts.js"() {
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

  // extension/src/utils/open-url-list.js
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
    "extension/src/utils/open-url-list.js"() {
      OPEN_URLS_MAX = 20;
    }
  });

  // extension/src/config/stock-actions.js
  function isStockActionId(id) {
    return String(id || "").startsWith(STOCK_ACTION_ID_PREFIX);
  }
  function getStockActionById(id) {
    const key2 = String(id || "");
    const found = STOCK_ACTIONS.find((action) => action && action.id === key2);
    if (!found) return null;
    return {
      ...found,
      label: getMessage(found.labelKey) || found.label || found.id,
      description: found.descriptionKey && getMessage(found.descriptionKey) || found.description || ""
    };
  }
  var STOCK_ACTION_ID_PREFIX, STOCK_SOCIAL_MEDIA_ACTION_ID, STOCK_RANDOM_BOOKMARK_ACTION_ID, STOCK_ACTIONS;
  var init_stock_actions = __esm({
    "extension/src/config/stock-actions.js"() {
      init_i18n();
      init_open_url_list();
      STOCK_ACTION_ID_PREFIX = "stock:";
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
          description: "Open Facebook, Instagram, YouTube, and X",
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

  // extension/src/config/keyboard-layouts.js
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
  function nextUserCopyLayoutLabel(baseLabel, existingLayouts = []) {
    const fallbackBase = getMessage("layout_editor_layout_noun") || "Layout";
    const copyWord = getMessage("layout_editor_copy_suffix") || "Copy";
    const base = String(baseLabel || fallbackBase).trim() || fallbackBase;
    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const copyAlts = [.../* @__PURE__ */ new Set(["Copy", copyWord])].map((word) => String(word || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean).join("|");
    const re = new RegExp(`^${escaped} (?:${copyAlts || "Copy"}) (\\d+)$`, "i");
    let maxN = 0;
    for (const l of existingLayouts || []) {
      const m = String(l?.label || "").trim().match(re);
      if (!m) continue;
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > maxN) maxN = n;
    }
    return `${base} ${copyWord} ${maxN + 1}`;
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
  function buildKeybindingsForLayout(layoutId) {
    const id = normalizeKeyboardLayoutId(layoutId);
    const layout = BUILTIN_KEYBOARD_LAYOUTS[id];
    const out = {};
    for (const [actionId, def] of Object.entries(KEYBINDING_ACTION_DEFS)) {
      if (isBuildExcludedKeyAction(actionId)) continue;
      const assign = layout?.assignments?.[actionId];
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
      const assign = layout?.assignments?.[stock.id];
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
        parameters: stock.parameters,
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
  function resolveKeybinding(actionId, keybindings) {
    const id = String(actionId || "");
    if (!id) return null;
    if (keybindings && keybindings[id]) return keybindings[id];
    const catalog = CATALOG_KEYBINDINGS[id];
    if (!catalog) return null;
    return { ...catalog, ...localizedActionCopy(id, KEYBINDING_ACTION_DEFS[id]) };
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
  function buildEffectiveKeybindings(layoutId, handedness = DEFAULT_KEYBOARD_HANDEDNESS) {
    return {
      ...buildKeybindingsForLayout(layoutId),
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
  function getKeyboardUiLayoutForLayout(layoutId, opts = {}) {
    const id = normalizeKeyboardLayoutId(layoutId);
    const inferred = inferFamilyAndHandednessFromLayoutId(id);
    return buildKeyboardReferenceUiLayout({
      hardwareLayoutId: opts?.hardwareLayoutId,
      keybindings: buildEffectiveKeybindings(id, inferred.handedness),
      includeNumberRow: !!opts?.includeNumberRow
    });
  }
  var DEFAULT_KEYBOARD_LAYOUT_ID, DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID, DEFAULT_KEYBOARD_HANDEDNESS, SOURCE_BUILD_ENABLE_MACRO_BUILDER, BUILD_ENABLE_MACRO_BUILDER, BUILD_EXCLUDED_KEY_ACTIONS, BUILD_EXCLUDED_KEY_ACTION_SET, BUILTIN_KEYBOARD_LAYOUT_META, BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META, LEGACY_KEYBOARD_LAYOUT_FAMILY_VARIANTS, KNOWN_BUILTIN_LAYOUT_IDS, KEYBINDING_ACTION_DEFS, KEYBINDING_ACTION_CATEGORY_BY_ID, KEYBINDING_ACTION_CATEGORY_ORDER, CATALOG_KEYBINDINGS, ASSIGNMENTS_BROWSING_RIGHT, ASSIGNMENTS_BROWSING_LEFT, SYSTEM_LAYER_ACTION_IDS, SYSTEM_LAYER_ASSIGNMENTS_RIGHT, SYSTEM_LAYER_ASSIGNMENTS_LEFT, BASIC_NAVIGATION_ACTION_IDS, CLICK_HISTORY_ACTION_IDS, BASIC_NAVIGATION_UI_ACTION_IDS, CLICK_HISTORY_UI_ACTION_IDS, ASSIGNMENTS_BASIC_NAVIGATION_RIGHT, ASSIGNMENTS_BASIC_NAVIGATION_LEFT, ASSIGNMENTS_CLICK_HISTORY_RIGHT, ASSIGNMENTS_CLICK_HISTORY_LEFT, KEYBOARD_UI_LAYOUT_RIGHT, KEYBOARD_UI_LAYOUT_LEFT, BUILTIN_KEYBOARD_LAYOUTS;
  var init_keyboard_layouts = __esm({
    "extension/src/config/keyboard-layouts.js"() {
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
        // Rectangle region select (Y on right-handed; R free on left-handed).
        RECTANGLE_HIGHLIGHT: Object.freeze({
          handler: "handleRectangleHighlightKey",
          label: "Element Select",
          description: "Rectangle or cumulative element pick",
          details: "Selects HTML elements that intersect a dragged rectangle, or pick elements cumulatively. Useful for grabbing structure (not just plain text) from a page region.",
          keyboardClass: "key-rect-highlight",
          row: 1
        }),
        // Copy image under cursor (I on right-handed; E on left-handed — I is READER_MODE there).
        COPY_HOVERED_IMAGE: Object.freeze({
          handler: "handleCopyHoveredImageKey",
          label: "Copy Image",
          description: "Copy hovered image",
          details: "Copies the image under the cursor to the clipboard, Media Library, or both \u2014 configure the destination on the action. Prefer this when you want the image bytes or a saved library entry, not just a URL.",
          keyboardClass: "key-page-media",
          row: 1
        }),
        // Copy hyperlink under cursor (U on right-handed; no default on left — U is FORWARD there).
        COPY_HOVERED_URL: Object.freeze({
          handler: "handleCopyHoveredUrlKey",
          label: "Copy URL",
          description: "Copy hovered link URL",
          details: "Copies the URL under the cursor to the clipboard, Media Library, or both. Use this when you need the href itself rather than fetching or opening the resource.",
          keyboardClass: "key-page-media",
          row: 1
        }),
        // Copy video under cursor — Actions Library only (no built-in layout key).
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
        COPY_HOVERED_IMAGE: "Get Page Data",
        COPY_HOVERED_URL: "Get Page Data",
        COPY_HOVERED_VIDEO: "Get Page Data",
        FONT_INFO: "Get Page Data",
        PAGE_MEDIA: "Get Page Data",
        READER_MODE: "Get Page Data",
        DELETE: "Select",
        COLS_TOGGLE: "Select",
        OPEN_MEDIA_LIBRARY: "Media Library",
        CLIPBOARD_COPY: "Clipboard",
        CLIPBOARD_CUT: "Clipboard",
        CLIPBOARD_PASTE: "Clipboard",
        CLIPBOARD_SELECT_ALL: "Clipboard",
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
        "Tab Control",
        "Begin URL",
        "Get Page Data",
        "Maps",
        "Scroll",
        "Select",
        "Media Library",
        "Clipboard",
        "AI",
        "KeyPilot",
        "Tools",
        "System",
        "Other"
      ]);
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
        COPY_HOVERED_URL: physicalAssignment("KeyU", "U"),
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
        // H is background-tab open on left; G/R free for selection.
        HIGHLIGHT: physicalAssignment("KeyG", "G"),
        RECTANGLE_HIGHLIGHT: physicalAssignment("KeyR", "R"),
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
          { type: "action", id: "COPY_HOVERED_URL", fallbackText: "Copy URL" },
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
          { type: "key", text: "Q" },
          { type: "action", id: "PREVIEW_LINK_POPOVER", fallbackText: "Preview Link" },
          // W
          { type: "action", id: "COPY_HOVERED_IMAGE", fallbackText: "Copy Image" },
          // E
          { type: "action", id: "RECTANGLE_HIGHLIGHT", fallbackText: "Rectangle Select" },
          // R
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

  // extension/src/config/constants.js
  var KEYBINDINGS, Z_INDEX, SCROLL, INSPECTOR_KIND, ELEMENT_SELECT_AGGREGATES, ELEMENT_SELECT_LANDMARKS, ELEMENT_SELECT_ATOMS, ELEMENT_SELECT_FRAGMENTS, ELEMENT_SELECT_TAGS, CURSOR_MODE, KP_UI_FONT;
  var init_constants = __esm({
    "extension/src/config/constants.js"() {
      init_keyboard_layouts();
      KEYBINDINGS = buildEffectiveKeybindings(DEFAULT_KEYBOARD_LAYOUT_ID, DEFAULT_KEYBOARD_HANDEDNESS);
      Z_INDEX = {
        // Utility layers (occasionally used for measurement elements)
        PAGE_BEHIND: -1,
        DEFAULT: 1,
        // Keep all KeyPilot UI comfortably above typical site z-index values.
        // Note: Many browsers effectively clamp very large z-index values; using a
        // high-but-safe base avoids accidental collisions and keeps ordering clear.
        _BASE: 2147483e3,
        // Low-ish KeyPilot overlays
        /** Covers page content during fade edge-jumps; below chrome + cursor */
        EDGE_JUMP_FADE: 2147483010,
        VIEWPORT_MODAL_FRAME: 2147483010,
        HIGHLIGHT_SELECTION: 2147483015,
        // PopupManager layers (kept BELOW click overlays so the green click rectangle can sit above popups)
        POPUP_BACKDROP: 2147483009,
        POPUP_PANEL_BASE: 2147483012,
        POPUP_PANEL_MAX: 2147483017,
        // Focus/delete/highlight overlays
        OVERLAYS_BELOW_2: 2147483018,
        OVERLAYS_BELOW: 2147483019,
        OVERLAYS: 2147483020,
        OVERLAYS_ABOVE: 2147483021,
        // macOS-style control strip (upper-left; stays at top; below walkthrough in z-order)
        CONTROL_STRIP: 2147483025,
        // Onboarding walkthrough (top-left, stacked below the control strip on screen).
        // z-index above the strip so if they ever overlap the panel wins; still below
        // green hover/click overlays and floating keyboard help.
        ONBOARDING_PANEL: 2147483026,
        // Cols Toggle slip-edit bar (bottom of viewport; below keyboard help / cursor)
        COLS_SLIP_BAR: 2147483030,
        // Sized OS popup for Open Popover (http(s)); extension Guide still uses iframe overlay
        POPOVER_IFRAME_MODAL: 2147483035,
        // Notifications / message overlays
        MESSAGE_BOX: 2147483040,
        DEBUG_HUD: 2147483041,
        NOTIFICATION: 2147483040,
        // Omnibox overlay (should sit above most UI, but below keyboard help + cursor)
        OMNIBOX: 2147483042,
        // Floating keyboard reference + key-click tooltip (above page UI, below cursor)
        FLOATING_KEYBOARD_HELP: 2147483045,
        KEYBINDINGS_POPOVER: 2147483046,
        // Per-key floating config panel (above sticky key popover, below cursor)
        KEY_ACTION_CONFIG: 2147483047,
        // Compact Keyboard Layout Config palette (beside Reference while editing)
        KEYBOARD_LAYOUT_CONFIG: 2147483048,
        // Custom select lists: above Keyboard Ref / layout chrome, below click ripple
        SELECT_MENU: 2147483049,
        // Click-to-place arrow (fallback when Popover API unavailable)
        LAYOUT_PLACE_ARROW: 2147483052,
        // Cursor sits above chrome; click ripple is above even that so the
        // expanding circles always remain visible.
        CURSOR: 2147483050,
        RIPPLE: 2147483051
      };
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
      KP_UI_FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
    }
  });

  // extension/themes/schema.js
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
  var DEFAULT_THEME_ID, THEME_IDS, THEME_META, PRO_SANS, PRO_MONO, TYPE_ROLES, KEY_CLIP_NONE, KEY_SHADE_BEVEL;
  var init_schema = __esm({
    "extension/themes/schema.js"() {
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

  // extension/src/utils/platform.js
  var init_platform = __esm({
    "extension/src/utils/platform.js"() {
    }
  });

  // promo/web/keyboard-demo/chrome-stub.js
  var messages = { current: {} };
  function substitute(entry, substitutions) {
    if (!entry || typeof entry.message !== "string") return "";
    let message = entry.message;
    const subs = substitutions == null ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
    const placeholders = entry.placeholders && typeof entry.placeholders === "object" ? entry.placeholders : {};
    for (const [name, placeholder] of Object.entries(placeholders)) {
      const content = placeholder && typeof placeholder.content === "string" ? placeholder.content : "";
      const index = /^\$(\d+)$/.exec(content);
      const value = index ? subs[Number(index[1]) - 1] ?? "" : content;
      message = message.split(`$${name}$`).join(String(value));
    }
    subs.forEach((value, index) => {
      message = message.split(`$${index + 1}`).join(value == null ? "" : String(value));
    });
    return message;
  }
  function assetPrefix() {
    const locale = document.documentElement.getAttribute("data-locale") || "en";
    return locale === "en" ? "" : "../";
  }
  var chromeApi = globalThis.chrome && typeof globalThis.chrome === "object" ? globalThis.chrome : {};
  chromeApi.i18n = {
    getMessage(key2, substitutions) {
      const entry = messages.current[key2];
      if (!entry) return "";
      return substitute(entry, substitutions);
    },
    getUILanguage() {
      return document.documentElement.lang || "en";
    }
  };
  chromeApi.runtime = {
    getURL(relativePath) {
      const clean = String(relativePath || "").replace(/^\//, "");
      return `${assetPrefix()}assets/${clean}`;
    }
  };
  globalThis.chrome = chromeApi;
  async function loadMessages() {
    const locale = document.documentElement.getAttribute("data-locale") || "en";
    const response = await fetch(`${assetPrefix()}messages/${locale}.json`);
    if (!response.ok) {
      throw new Error(`Missing keyboard messages for ${locale}`);
    }
    messages.current = await response.json();
  }

  // promo/web/keyboard-demo/entry.js
  init_keyboard_layouts();
  init_keyboard_hardware_layouts();

  // extension/src/ui/keybindings-ui.js
  init_constants();

  // extension/src/ui/keybindings-ui-shared.js
  init_keyboard_layouts();
  init_stock_actions();
  var KEYBINDINGS_UI_STYLE_ATTR = "data-kp-keybindings-ui-style";
  var KEYBINDINGS_UI_ROOT_CLASS = "kp-keybindings-ui";
  var KEYBINDINGS_UI_FONT_STYLE_ATTR = "data-kp-keybindings-fonts";
  var KEYBINDINGS_UI_FONT_PRELOAD_ATTR = "data-kp-keybindings-font-preload";
  var KEYBINDINGS_UI_FONT_PLACEHOLDERS = {
    ROBOTECH: "__KP_FONT_ROBOTECH_URL__",
    TITILLIUM: "__KP_FONT_TITILLIUM_URL__",
    TITILLIUM_BOLD: "__KP_FONT_TITILLIUM_BOLD_URL__",
    CUBELLAN: "__KP_FONT_CUBELLAN_URL__",
    EZARION: "__KP_FONT_EZARION_URL__",
    DOSIS: "__KP_FONT_DOSIS_URL__"
  };
  var KEYBINDINGS_KEYBOARD_LAYOUT = getKeyboardUiLayoutForLayout(DEFAULT_KEYBOARD_LAYOUT_ID);
  var FA_SOLID_PATHS = Object.freeze({
    // Navigation / history
    "arrow-left": "M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 288 480 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-370.7 0 137.4-137.4c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z",
    "arrow-right": "M502.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-192-192c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L402.7 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l370.7 0-137.4 137.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l192-192z",
    "arrow-up": "M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 173.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z",
    "arrow-down": "M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z",
    "angles-up": "M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 173.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192zm0 160c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 333.3 86.6 502.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z",
    "angles-down": "M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192zm0-160c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 178.7 86.6 9.4C74.1-3.1 53.8-3.1 41.3 9.4s-12.5 32.8 0 45.3l192 192z",
    "chevron-left": "M41.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 256 246.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z",
    "chevron-right": "M470.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L402.7 256 265.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z",
    // Clicks / tabs / windows (Font Awesome Free solid-style glyphs)
    "hand-pointer": "M320 0c17.7 0 32 14.3 32 32V176h16c17.7 0 32 14.3 32 32s-14.3 32-32 32H352v16c0 17.7-14.3 32-32 32s-32-14.3-32-32V240H272v16c0 17.7-14.3 32-32 32s-32-14.3-32-32V240H192v80c0 53 43 96 96 96h32c53 0 96-43 96-96V224h32c17.7 0 32-14.3 32-32s-14.3-32-32-32H416V32c0-17.7-14.3-32-32-32H320zM192 96c0-17.7-14.3-32-32-32H128C57.3 64 0 121.3 0 192v96c0 53 43 96 96 96h32c17.7 0 32-14.3 32-32s-14.3-32-32-32H96c-17.7 0-32-14.3-32-32V192c0-35.3 28.7-64 64-64h32c17.7 0 32-14.3 32-32z",
    "arrow-up-right-from-square": "M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32h82.7L201.4 265.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3V192c0 17.7 14.3 32 32 32s32-14.3 32-32V32c0-17.7-14.3-32-32-32H320zM80 32C35.8 32 0 67.8 0 112V432c0 44.2 35.8 80 80 80H400c44.2 0 80-35.8 80-80V320c0-17.7-14.3-32-32-32s-32 14.3-32 32V432c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V112c0-8.8 7.2-16 16-16H192c17.7 0 32-14.3 32-32s-14.3-32-32-32H80z",
    "clone": "M64 464H288c8.8 0 16-7.2 16-16V384h48v64c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64h64v48H64c-8.8 0-16 7.2-16 16V448c0 8.8 7.2 16 16 16zM224 0c-35.3 0-64 28.7-64 64V288c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64H224zm0 48H448c8.8 0 16 7.2 16 16V288c0 8.8-7.2 16-16 16H224c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16z",
    "window-maximize": "M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm32 96H416c17.7 0 32 14.3 32 32v32H64V160c0-17.7 14.3-32 32-32z",
    "eye": "M256 96c-89.6 0-168.5 48.8-212.7 122.3c-7.3 12.1-7.3 27.3 0 39.4C87.5 331.2 166.4 380 256 380s168.5-48.8 212.7-122.3c7.3-12.1 7.3-27.3 0-39.4C424.5 144.8 345.6 96 256 96zm0 224a96 96 0 1 1 0-192 96 96 0 1 1 0 192zm0-144a48 48 0 1 0 0 96 48 48 0 1 0 0-96z",
    "plus": "M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z",
    "folder-plus": "M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H298.5c-17 0-33.3-6.7-45.3-18.7L226.7 50.7C214.7 38.7 198.5 32 181.5 32H64zM232 248v-48c0-13.3 10.7-24 24-24s24 10.7 24 24v48h48c13.3 0 24 10.7 24 24s-10.7 24-24 24H280v48c0 13.3-10.7 24-24 24s-24-10.7-24-24V296H184c-13.3 0-24-10.7-24-24s10.7-24 24-24h48z",
    "xmark": "M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z",
    "trash": "M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H384l-7.2-14.3C372.4 6.8 361.3 0 349.2 0H162.8c-12.1 0-23.2 6.8-28.6 17.7zM32 128V448c0 35.3 28.7 64 64 64H416c35.3 0 64-28.7 64-64V128H32zm112 64c8.8 0 16 7.2 16 16V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V208c0-8.8 7.2-16 16-16zm96 0c8.8 0 16 7.2 16 16V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V208c0-8.8 7.2-16 16-16zm96 0c8.8 0 16 7.2 16 16V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V208c0-8.8 7.2-16 16-16z",
    "delete-left": "M576 128c0-35.3-28.7-64-64-64H205.3c-17 0-33.3 6.7-45.3 18.7L9.4 233.4c-6 6-9.4 14.1-9.4 22.6s3.4 16.6 9.4 22.6L160 429.3c12 12 28.3 18.7 45.3 18.7H512c35.3 0 64-28.7 64-64V128zM271 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z",
    // UI / utility
    // Font Awesome Free solid "gear" (512 viewBox)
    "gear": "M495.9 166.1c3.3 12.7 .9 26.3-7.1 36.1l-37.3 45.7c2.1 11.1 3.2 22.6 3.2 34.3s-1.1 23.2-3.2 34.3l37.3 45.7c8 9.8 10.4 23.4 7.1 36.1c-6.3 24.2-17.7 46.6-33.1 66.3c-8.1 10.3-21.2 14.9-33.9 12.1l-57.5-12.7c-17.9 15.3-38.4 27.3-60.7 35.4l-13.7 57.5c-2.9 12.1-12.9 21.1-25.4 22.4c-24.2 2.6-49.1 2.6-73.3 0c-12.5-1.3-22.5-10.3-25.4-22.4l-13.7-57.5c-22.3-8.1-42.8-20.1-60.7-35.4L71.6 436.6c-12.7 2.8-25.8-1.8-33.9-12.1C22.3 404.8 10.9 382.4 4.6 358.2c-3.3-12.7-.9-26.3 7.1-36.1l37.3-45.7c-2.1-11.1-3.2-22.6-3.2-34.3s1.1-23.2 3.2-34.3L11.7 161.9c-8-9.8-10.4-23.4-7.1-36.1C10.9 101.6 22.3 79.2 37.7 59.5c8.1-10.3 21.2-14.9 33.9-12.1l57.5 12.7c17.9-15.3 38.4-27.3 60.7-35.4L203.5 17.2c2.9-12.1 12.9-21.1 25.4-22.4c24.2-2.6 49.1-2.6 73.3 0c12.5 1.3 22.5 10.3 25.4 22.4l13.7 57.5c22.3 8.1 42.8 20.1 60.7 35.4l57.5-12.7c12.7-2.8 25.8 1.8 33.9 12.1c15.4 19.7 26.8 42.1 33.1 66.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z",
    "magnifying-glass": "M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z",
    // FA Free solid "magnifying-glass-plus/minus" — tab zoom
    "magnifying-glass-plus": "M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM184 296c0 13.3 10.7 24 24 24s24-10.7 24-24V232h64c13.3 0 24-10.7 24-24s-10.7-24-24-24H232V120c0-13.3-10.7-24-24-24s-24 10.7-24 24v64H120c-13.3 0-24 10.7-24 24s10.7 24 24 24h64v64z",
    "magnifying-glass-minus": "M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM136 184c-13.3 0-24 10.7-24 24s10.7 24 24 24H280c13.3 0 24-10.7 24-24s-10.7-24-24-24H136z",
    "keyboard": "M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zm128 64v32h32V160H128zm64 0v32h32V160H192zm64 0v32h32V160H256zm64 0v32h32V160H320zm64 0v32h32V160H384zM96 256v32h64V256H96zm96 0v32h32V256H192zm64 0v32h32V256H256zm64 0v32h32V256H320zm64 0v32h32V256H384zm64 0v32h32V256H448zM128 352v32H384V352H128z",
    "clock-rotate-left": "M256 0C114.6 0 0 114.6 0 256S114.6 512 256 512c53 0 102-16.2 142.7-43.9c10.8-7.4 13.6-22.3 6.2-33.1s-22.3-13.6-33.1-6.2C340.8 449.1 299.6 464 256 464C141.1 464 48 370.9 48 256S141.1 48 256 48c60.7 0 115.5 26.1 153.4 67.7l-33.5 33.5c-9.4 9.4-2.7 25.5 10.5 25.5H456c13.3 0 24-10.7 24-24V56c0-13.2-16.1-19.9-25.5-10.5L418.7 81.3C368.5 31.4 315.1 0 256 0zM232 120c0-13.3-10.7-24-24-24s-24 10.7-24 24V256c0 6.4 2.5 12.5 7 17l72 72c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-65-65V120z",
    "rocket": "M156.6 384.9L125.7 354c-8.5-8.5-11.5-20.8-7.7-32.2c3-8.9 7-20.5 11.8-33.8L24 288c-8.6 0-16.6-4.6-20.9-12.1s-4.2-16.7 .2-24.1l52.5-88.5c13-21.9 36.5-35.3 61.9-35.3h82.3c2.4-4 4.8-7.7 7.2-11.3C289.1-4.1 411.1-8.1 483.9 5.3c11.6 2.1 20.6 11.2 22.8 22.8c13.4 72.9 9.3 194.8-111.4 276.7c-3.5 2.4-7.3 4.8-11.3 7.2v82.3c0 25.4-13.4 49-35.3 61.9l-88.5 52.5c-7.4 4.4-16.6 4.5-24.1 .2s-12.1-12.2-12.1-20.9V384.9c-13.3 4.8-24.9 8.8-33.8 11.8c-11.4 3.7-23.7 .7-32.2-7.8zM215.3 237.3c28.3-28.3 73.1-31.3 105.4-8.5L200.5 348.5c-22.8-32.3-19.8-77.1 8.5-105.4l6.3-5.8z",
    "house": "M575.8 255.5c0 18-15 32.1-32 32.1h-32l.7 160.2c.2 35.5-28.5 64.3-64 64.3H392c-22.1 0-40-17.9-40-40V448 384c0-17.7-14.3-32-32-32H256c-17.7 0-32 14.3-32 32v64 24c0 22.1-17.9 40-40 40H128.1c-35.3 0-64-28.7-64-64V287.6H32c-18 0-32-14-32-32.1c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z",
    "ban": "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0L368 334.1c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0L175 208.9c-9.4-9.4-9.4-24.6 0-33.9z",
    // Special keys
    "arrow-right-to-bracket": "M512 256c0 17.7-14.3 32-32 32H178.7l73.4 73.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3l128-128c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3L178.7 224H480c17.7 0 32 14.3 32 32zM0 128C0 92.7 28.7 64 64 64H192c17.7 0 32 14.3 32 32s-14.3 32-32 32H64V384H192c17.7 0 32 14.3 32 32s-14.3 32-32 32H64c-35.3 0-64-28.7-64-64V128z",
    "turn-down": "M54.6 310.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L128 293.3V64c0-17.7 14.3-32 32-32H352c17.7 0 32 14.3 32 32s-14.3 32-32 32H192V293.3l28.1-28.1c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3l-80 80c-12.5 12.5-32.8 12.5-45.3 0l-80-80z",
    "up-long": "M278.6 9.4c-12.5-12.5-32.8-12.5-45.3 0l-128 128c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L224 109.3V480c0 17.7 14.3 32 32 32s32-14.3 32-32V109.3l73.4 73.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-128-128z",
    "arrow-up-from-line": "M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l96 96c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 205.3V384c0 17.7-14.3 32-32 32s-32-14.3-32-32V205.3l-41.4 41.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l96-96zM64 448c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H96c-17.7 0-32-14.3-32-32z",
    "arrow-down-to-line": "M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l96-96c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 306.7V128c0-17.7-14.3-32-32-32s-32 14.3-32 32V306.7l-41.4-41.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l96 96zM64 64c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H96C78.3 96 64 81.7 64 64z",
    "circle": "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512z",
    // FA Free solid "code" — Execute JS
    "code": "M318.4 73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L402.7 248 273.1 377.6c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l152-152c12.5-12.5 12.5-32.8 0-45.3l-152-152zm-124.8 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-152 152c-12.5 12.5-12.5 32.8 0 45.3l152 152c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 248 193.6 163.7c12.5-12.5 12.5-32.8 0-45.3z",
    // Text / rectangle selection
    // FA Free solid "font" (A glyph) — text select
    "font": "M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c6.1 10.4 6.1 23.3 0 33.7s-17.4 16.5-29.9 16.5H35.4c-12.5 0-23.8-6.6-29.9-16.5s-6.1-23.3 0-33.7l216-368C228.7 39.5 241.8 32 256 32zm0 88.4L96.7 392h318.6L256 120.4z",
    // FA Free solid "i-cursor" — caret / character select
    "i-cursor": "M128 64c0-17.7 14.3-32 32-32H352c17.7 0 32 14.3 32 32s-14.3 32-32 32H288v128h64c17.7 0 32 14.3 32 32s-14.3 32-32 32H288v128h64c17.7 0 32 14.3 32 32s-14.3 32-32 32H160c-17.7 0-32-14.3-32-32s14.3-32 32-32h64V288H160c-17.7 0-32-14.3-32-32s14.3-32 32-32h64V96H160c-17.7 0-32-14.3-32-32z",
    // FA Free solid "vector-square" — rectangle marquee corners
    "vector-square": "M32 32C14.3 32 0 46.3 0 64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM32 320c-17.7 0-32 14.3-32 32v64c0 17.7 14.3 32 32 32h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352c0-17.7-14.3-32-32-32zM320 64c0 17.7 14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H352c-17.7 0-32 14.3-32 32zM480 320c-17.7 0-32 14.3-32 32v64H384c-17.7 0-32 14.3-32 32s14.3 32 32 32h64c17.7 0 32-14.3 32-32V352c0-17.7-14.3-32-32-32z",
    // FA Free solid "image" — copy hovered image
    "image": "M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM323.8 202.5c-4.5-6.6-11.9-10.5-19.8-10.5s-15.4 3.9-19.8 10.5l-87 127.6L170.7 297c-4.6-5.7-11.5-9-18.7-9s-14.2 3.3-18.7 9l-64 80c-5.8 7.2-6.9 17.1-2.9 25.4s12.4 13.6 21.6 13.6h96 32H424c8.9 0 17.1-4.9 21.2-12.8s3.6-17.4-1.4-24.7l-120-176zM112 192a48 48 0 1 0 0-96 48 48 0 1 0 0 96z",
    // FA Free solid "video"
    "video": "M0 128C0 92.7 28.7 64 64 64H320c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128zM559.1 99.8c10.4 5.6 16.9 16.4 16.9 28.2V384c0 11.8-6.5 22.6-16.9 28.2s-23 6-32.9 1.3L384 337.1V174.9l142.2-76.4c9.8-4.7 22.4-4.3 32.9 1.3z",
    // FA Free solid "link" — copy hovered URL
    "link": "M326.612 185.391c59.747 59.809 58.927 155.698.36 214.59-.11.12-.24.25-.36.37l-67.2 67.2c-59.27 59.27-155.699 59.262-214.96 0-59.27-59.26-59.27-155.7 0-214.96l37.106-37.106c9.84-9.84 26.786-3.3 27.294 10.606.648 17.722 3.826 35.527 9.69 52.721 1.986 5.822.567 12.262-3.783 16.612l-13.087 13.087c-28.026 28.026-28.026 73.66 0 101.682 28.026 28.026 73.66 28.026 101.682 0l67.2-67.2c28.026-28.026 28.026-73.66 0-101.682-3.794-3.808-7.368-5.703-10.954-6.817-10.756-3.356-22.666 1.983-27.085 12.227-5.575 12.941-17.35 20.326-30.978 20.326-12.802 0-22.414-11.312-19.101-23.541 6.027-22.318 9.025-49.922 2.753-73.389-13.415-49.971.392-102.811 37.393-139.813 59.17-59.117 154.849-59.262 214.096-.31zM213.388 326.609c-59.747-59.809-58.927-155.698-.36-214.59.11-.12.24-.25.36-.37l67.2-67.2c59.27-59.27 155.699-59.262 214.96 0 59.27 59.26 59.27 155.7 0 214.96l-37.106 37.106c-9.84 9.84-26.786 3.3-27.294-10.606-.648-17.722-3.826-35.527-9.69-52.721-1.986-5.822-.567-12.262 3.783-16.612l13.087-13.087c28.026-28.026 28.026-73.66 0-101.682-28.026-28.026-73.66-28.026-101.682 0l-67.2 67.2c-28.026 28.026-28.026 73.66 0 101.682 3.794 3.808 7.368 5.703 10.954 6.817 10.756 3.356 22.666-1.983 27.085-12.227 5.575-12.941 17.35-20.326 30.978-20.326 12.802 0 22.414 11.312 19.101 23.541-6.027 22.318-9.025 49.922-2.753 73.389 13.415 49.971-.392 102.811-37.393 139.813-59.17 59.117-154.849 59.262-214.096.31z",
    // FA Free solid "table-columns" — Cols Toggle multicol layout
    "table-columns": "M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zm64 64V416H224V160H64zm320 0H288V416H448V160z",
    // FA Free solid "table-list" — Tabs Overview (windows with tab lists)
    "table-list": "M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zm64 64V416h80V160H64zm128 0v64H448V160H192zm0 96v64H448V256H192zm0 96v64H448V352H192z",
    // Library / macro / clipboard / AI (Config card keycaps + Reference parity)
    "clipboard": "M192 0c35.3 0 64 28.7 64 64l0 32 112 0c35.3 0 64 28.7 64 64l0 288c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 160c0-35.3 28.7-64 64-64l112 0 0-32c0-35.3 28.7-64 64-64zm0 64l0 32 64 0 0-32c0-17.7-14.3-32-32-32s-32 14.3-32 32zM64 160l0 288c0 17.7 14.3 32 32 32l256 0c17.7 0 32-14.3 32-32l0-288c0-17.7-14.3-32-32-32L64 128c-17.7 0-32 14.3-32 32z",
    "scissors": "M44.6 66.2l117.5 117.5c-4.7 8-7.1 17-7.1 26.3c0 26.5 21.5 48 48 48s48-21.5 48-48s-21.5-48-48-48c-4.8 0-9.4 .7-13.7 2L44.6 66.2C39.3 60.9 30.7 60.9 25.4 66.2S20.1 80.1 25.4 85.4L44.6 66.2zM203.2 237.8L85.4 355.6c-5.3 5.3-5.3 13.9 0 19.2s13.9 5.3 19.2 0l117.8-117.8c4.3 1.3 8.9 2 13.7 2c26.5 0 48-21.5 48-48s-21.5-48-48-48c-9.3 0-18.3 2.4-26.3 7.1zM432 144c26.5 0 48-21.5 48-48s-21.5-48-48-48s-48 21.5-48 48s21.5 48 48 48zm0 256c26.5 0 48-21.5 48-48s-21.5-48-48-48s-48 21.5-48 48s21.5 48 48 48zM162.6 466.2c5.3 5.3 13.9 5.3 19.2 0L467.4 180.6c5.3-5.3 5.3-13.9 0-19.2s-13.9-5.3-19.2 0L162.6 447c-5.3 5.3-5.3 13.9 0 19.2z",
    "robot": "M32 160c0-35.3 28.7-64 64-64l32 0 0-32c0-17.7 14.3-32 32-32s32 14.3 32 32l0 32 128 0 0-32c0-17.7 14.3-32 32-32s32 14.3 32 32l0 32 32 0c35.3 0 64 28.7 64 64l0 32 32 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-32 0 0 128c0 35.3-28.7 64-64 64l-16 0 0 48c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-48-128 0 0 48c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-48-16 0c-35.3 0-64-28.7-64-64l0-128-32 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l32 0 0-32zm96 64a32 32 0 1 0 0 64 32 32 0 1 0 0-64zm128 32a32 32 0 1 0 64 0 32 32 0 1 0-64 0z",
    "book": "M96 0C43 0 0 43 0 96L0 416c0 53 43 96 96 96l288 0 32 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l0-64c17.7 0 32-14.3 32-32l0-320c0-17.7-14.3-32-32-32L384 0 96 0zM384 416l0 32L96 448c-17.7 0-32-14.3-32-32s14.3-32 32-32l288 0zM112 64l160 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-160 0c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 96l160 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-160 0c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 96l96 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-96 0c-8.8 0-16-7.2-16-16s7.2-16 16-16z",
    "language": "M478.3 73.8c-5.7-10.7-16.8-17.3-28.7-17.3l-51.1 0c-12.5 0-24.7 4.9-33.7 13.7L192 242.7 96 146.7c-9-8.8-21.2-13.7-33.7-13.7L11.2 133C-.7 133-11.8 139.6-17.5 150.3S-24 174.1-18.5 185.3L73.1 352 18.5 454.7C13 465.9 16.1 478.9 24.9 486.6S47.1 496 58.5 490.5L160 432.9 261.5 490.5c11.4 5.5 24.9 2.6 33.7-5.1s11.9-20.7 6.4-32.1L246.9 352 338.5 185.3c5.5-11.2 2.4-24.2-6.4-31.9zM192 309.3L128 192l64 117.3zm192-245.3L480 192 384 64z",
    "bolt": "M234.5 5.7c13.9-5 29.1-.6 38.2 10.9l144 176c9.2 11.2 11.2 27.1 5.1 40.3s-19.2 21.1-33.3 21.1L320 254V432c0 26.5-21.5 48-48 48H176c-26.5 0-48-21.5-48-48V254H53.5c-14.1 0-27.1-7.9-33.3-21.1s-4.1-29 5.1-40.3l144-176c9.2-11.5 24.3-15.9 38.2-10.9z",
    "arrows-rotate": "M105.1 202.6c7.7-21.8 20.2-42.3 37.8-59.1c62.5-62.5 163.8-62.5 226.3 0L417.3 192 384 192c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0 16 0c17.7 0 32-14.3 32-32l0-96c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 36.7L425.4 89.9C332.4-3.1 181.2-3.1 88.2 89.9c-29.1 29.1-48.5 64.9-56.5 103.5c-3.8 18.5 10.1 36.9 29.1 36.9c14.2 0 26.8-9.9 30.3-23.7zM406.9 309.4c-7.7 21.8-20.2 42.3-37.8 59.1c-62.5 62.5-163.8 62.5-226.3 0L94.7 320l33.3 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 256l-16 0C-1.7 256-16 270.3-16 288l0 96c0 17.7 14.3 32 32 32s32-14.3 32-32l0-36.7 33.9 33.9C186.8 515.1 338 515.1 431 422.1c29.1-29.1 48.5-64.9 56.5-103.5c3.8-18.5-10.1-36.9-29.1-36.9c-14.2 0-26.8 9.9-30.3 23.7z",
    "layer-group": "M32 96l224-80 224 80L256 176 32 96zM32 192l224 80 224-80 0 32L256 304 32 224l0-32zm0 96l224 80 224-80 0 32L256 400 32 320l0-32z",
    "globe": "M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-196.8 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-144 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z",
    // FA Free solid "list" — Open URLs
    "list": "M40 48C26.7 48 16 58.7 16 72s10.7 24 24 24l80 0c13.3 0 24-10.7 24-24s-10.7-24-24-24L40 48zm0 160c-13.3 0-24 10.7-24 24s10.7 24 24 24l80 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-80 0zm0 160c-13.3 0-24 10.7-24 24s10.7 24 24 24l80 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-80 0zM176 72c0 13.3 10.7 24 24 24l272 0c13.3 0 24-10.7 24-24s-10.7-24-24-24L200 48c-13.3 0-24 10.7-24 24zm0 160c0 13.3 10.7 24 24 24l272 0c13.3 0 24-10.7 24-24s-10.7-24-24-24L200 208c-13.3 0-24 10.7-24 24zm0 160c0 13.3 10.7 24 24 24l272 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-272 0c-13.3 0-24 10.7-24 24z",
    // FA Free solid-style bookmark (512 viewBox)
    "bookmark": "M96 0C60.7 0 32 28.7 32 64V480c0 11.5 6.2 22.1 16.2 27.8s22.3 5.6 32.2-.4L256 405.3 431.6 507.4c9.9 6 22.2 5.9 32.2 .4s16.2-16.3 16.2-27.8V64c0-35.3-28.7-64-64-64H96z",
    "location-dot": "M256 64c-70.7 0-128 57.3-128 128c0 82.4 92.3 197.6 118.7 227.5c4.8 5.4 13.8 5.4 18.6 0C291.7 389.6 384 274.4 384 192c0-70.7-57.3-128-128-128zm0 176a48 48 0 1 1 0-96 48 48 0 1 1 0 96z"
  });
  var KEYBOARD_ACTION_ICON_IDS = Object.freeze({
    ACTIVATE: "hand-pointer",
    ACTIVATE_NEW_TAB: "arrow-up-right-from-square",
    ACTIVATE_NEW_TAB_BACKGROUND: "clone",
    BACK: "arrow-left",
    BACK2: "arrow-left",
    FORWARD: "arrow-right",
    DELETE: "trash",
    COLS_TOGGLE: "table-columns",
    TAB_LEFT: "chevron-left",
    TAB_RIGHT: "chevron-right",
    ROOT: "house",
    LAUNCHER: "rocket",
    TOP_SITES: "layer-group",
    CLOSE_TAB: "xmark",
    CANCEL: "ban",
    PAGE_UP_INSTANT: "arrow-up",
    PAGE_DOWN_INSTANT: "arrow-down",
    PAGE_TOP: "arrow-up-from-line",
    PAGE_BOTTOM: "arrow-down-to-line",
    SCROLL_LINE: "circle",
    ZOOM_OUT: "magnifying-glass-minus",
    ZOOM_IN: "magnifying-glass-plus",
    NEW_TAB: "folder-plus",
    OPEN_URLS: "list",
    OPEN_BOOKMARKS: "bookmark",
    RANDOM_BOOKMARK: "arrows-rotate",
    OPEN_POPOVER: "window-maximize",
    PREVIEW_LINK_POPOVER: "eye",
    POI_WEBSITE: "globe",
    POI_ADDRESS: "location-dot",
    OPEN_SETTINGS_POPOVER: "gear",
    OMNIBOX: "magnifying-glass",
    TAB_HISTORY: "clock-rotate-left",
    TABS_OVERVIEW: "table-list",
    TOGGLE_KEYBOARD_HELP: "keyboard",
    // Selection tools (recently re-enabled; were missing from the icon map)
    HIGHLIGHT: "i-cursor",
    RECTANGLE_HIGHLIGHT: "vector-square",
    COPY_HOVERED_IMAGE: "image",
    COPY_HOVERED_URL: "link",
    COPY_HOVERED_VIDEO: "video",
    FONT_INFO: "font",
    PAGE_MEDIA: "image",
    READER_MODE: "book",
    OPEN_MEDIA_LIBRARY: "image",
    // Function Library (Config cards + placeable Actions)
    CLIPBOARD_COPY: "clipboard",
    CLIPBOARD_CUT: "scissors",
    CLIPBOARD_PASTE: "clipboard",
    CLIPBOARD_SELECT_ALL: "font",
    SELECT_WORD: "font",
    SELECT_SENTENCE: "font",
    SELECT_PARAGRAPH: "font",
    SELECT_IMAGE: "image",
    SEND_TEXT_TO_AI: "robot",
    SEND_HOTKEY: "keyboard",
    SEND_BURST: "bolt",
    CYCLE_ROUND_ROBIN: "arrows-rotate",
    HOLD_CONTINUOUS: "circle",
    CLICK_MOUSE_BUTTON: "hand-pointer",
    REMAP_KEY: "keyboard",
    TYPE_CHARACTERS: "font",
    EXECUTE_JS: "code",
    GET_TEXT_AT_CURSOR: "i-cursor",
    GET_TEXT_RANGE: "font",
    GET_MEDIA_AT_CURSOR: "image",
    LOOKUP_WORD: "book",
    TRANSLATE: "language",
    SHOW_POPOVER: "window-maximize",
    ADD_URL_TO_MEDIA_LIBRARY: "plus",
    FETCH_URL_FOR_MEDIA_LIBRARY: "arrow-down"
  });
  var ACCURATE_GEAR_PATH_16 = "M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.275.819l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.82 2.275l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .82 2.275l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.275.82l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.275-.82l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .82-2.275l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.82-2.275l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.275-.82zM8 10.93a2.93 2.93 0 1 1 0-5.86 2.93 2.93 0 0 1 0 5.86z";
  function faIconDataUri(pathD, fill = "black", viewBox = "0 0 512 512") {
    const safeFill = String(fill || "black").replace(/"/g, "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="${safeFill}"><path d="${pathD}"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  function getActionIconDataUri(actionId, opts = {}) {
    const iconName = KEYBOARD_ACTION_ICON_IDS[actionId];
    const pathD = iconName === "gear" ? ACCURATE_GEAR_PATH_16 : iconName ? FA_SOLID_PATHS[iconName] : null;
    if (!pathD) return "";
    return faIconDataUri(
      pathD,
      opts.fill || "white",
      iconName === "gear" ? "0 0 16 16" : void 0
    );
  }
  function keycapMaterial(t) {
    return `
  --kp-key-face: ${t.face};
  --kp-key-mid: ${t.mid};
  --kp-key-deep: ${t.deep};
  --kp-key-icon: ${t.icon};
  --kp-key-glow: ${t.glow || "transparent"};
`;
  }
  function getKeyboardKeyIconCss() {
    const iconUris = {};
    for (const [name, pathD] of Object.entries(FA_SOLID_PATHS)) {
      iconUris[name] = name === "gear" ? faIconDataUri(ACCURATE_GEAR_PATH_16, "black", "0 0 16 16") : faIconDataUri(pathD);
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
 * a transitioned opacity:0 rule animates from the UA default (1\u21920) and every key
 * briefly looks pressed \u2014 most noticeable on colored caps like K (KB Reference).
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
    const iconIdsByGlyph = /* @__PURE__ */ new Map();
    for (const [actionId, iconName] of Object.entries(KEYBOARD_ACTION_ICON_IDS)) {
      if (!iconUris[iconName]) continue;
      const ids = iconIdsByGlyph.get(iconName) || [];
      ids.push(actionId);
      iconIdsByGlyph.set(iconName, ids);
    }
    for (const stock of STOCK_ACTIONS) {
      const iconName = KEYBOARD_ACTION_ICON_IDS[stock.functionId];
      if (!iconName || !iconUris[iconName]) continue;
      const ids = iconIdsByGlyph.get(iconName) || [];
      if (!ids.includes(stock.id)) ids.push(stock.id);
      iconIdsByGlyph.set(iconName, ids);
    }
    for (const [iconName, actionIds] of iconIdsByGlyph) {
      const uri = iconUris[iconName];
      const selectors = actionIds.map((actionId) => `.${KEYBINDINGS_UI_ROOT_CLASS} .key[data-kp-action-id="${actionId}"] > .key-bg-icon`).join(",\n");
      lines.push(
        `${selectors} { -webkit-mask-image: ${uri}; mask-image: ${uri}; background-color: var(--kp-key-icon, #0c1018); }`
      );
    }
    if (iconUris["layer-group"]) {
      lines.push(
        `.${KEYBINDINGS_UI_ROOT_CLASS} .key[data-kp-macro-id] > .key-bg-icon { -webkit-mask-image: ${iconUris["layer-group"]}; mask-image: ${iconUris["layer-group"]}; background-color: var(--kp-key-icon, #0c1018); }`
      );
    }
    return lines.join("\n");
  }
  function ensureKeyBackgroundIcon(doc, keyEl) {
    if (!doc || !keyEl) return;
    try {
      if (keyEl.querySelector(":scope > .key-bg-icon")) return;
    } catch {
      if (keyEl.querySelector(".key-bg-icon")) return;
    }
    const icon = doc.createElement("span");
    icon.className = "key-bg-icon";
    icon.setAttribute("aria-hidden", "true");
    keyEl.insertBefore(icon, keyEl.firstChild);
  }
  function ensureKeyPressOverlay(doc, keyEl) {
    if (!doc || !keyEl) return null;
    let overlay = null;
    try {
      overlay = keyEl.querySelector(":scope > .key-press-overlay");
    } catch {
      overlay = keyEl.querySelector(".key-press-overlay");
    }
    if (overlay) return overlay;
    overlay = doc.createElement("span");
    overlay.className = "key-press-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.opacity = "0";
    overlay.style.transition = "none";
    keyEl.appendChild(overlay);
    return overlay;
  }
  function getKeybindingsUiFontFaceCss(fontUrls = {}) {
    const urlRobotech = fontUrls.robotech || KEYBINDINGS_UI_FONT_PLACEHOLDERS.ROBOTECH;
    const urlTitillium = fontUrls.titillium || KEYBINDINGS_UI_FONT_PLACEHOLDERS.TITILLIUM;
    const urlTitilliumBold = fontUrls.titilliumBold || KEYBINDINGS_UI_FONT_PLACEHOLDERS.TITILLIUM_BOLD;
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
  font-weight: 100 500;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: "TitilliumText";
  src: url("${urlTitilliumBold}") format("truetype");
  font-weight: 600 900;
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
  function preloadKeybindingsUiFonts(doc, fontUrls) {
    if (!doc || !fontUrls) return;
    const head = doc.head || doc.documentElement;
    if (!head?.appendChild) return;
    const entries = [
      { id: "dosis", href: fontUrls.dosis, type: "font/ttf" },
      { id: "robotech", href: fontUrls.robotech, type: "font/ttf" },
      { id: "titillium", href: fontUrls.titillium, type: "font/otf" },
      { id: "titilliumBold", href: fontUrls.titilliumBold, type: "font/ttf" },
      { id: "cubellan", href: fontUrls.cubellan, type: "font/ttf" },
      { id: "ezarion", href: fontUrls.ezarion, type: "font/ttf" }
    ];
    for (const { id, href, type: type2 } of entries) {
      if (!href || String(href).includes("__KP_FONT_")) continue;
      try {
        if (head.querySelector(`link[${KEYBINDINGS_UI_FONT_PRELOAD_ATTR}="${id}"]`)) continue;
      } catch {
      }
      try {
        const link = doc.createElement("link");
        link.rel = "preload";
        link.as = "font";
        link.type = type2;
        link.href = href;
        link.crossOrigin = "anonymous";
        link.setAttribute(KEYBINDINGS_UI_FONT_PRELOAD_ATTR, id);
        head.appendChild(link);
      } catch {
      }
    }
    try {
      if (fontUrls.dosis && !String(fontUrls.dosis).includes("__KP_FONT_") && doc.fonts?.load) {
        void doc.fonts.load('10px "Dosis"');
      }
    } catch {
    }
  }
  function getKeybindingsUiCss({ zKeybindingsPopover, fontUrls } = {}) {
    const z = Number.isFinite(zKeybindingsPopover) ? zKeybindingsPopover : Number(zKeybindingsPopover);
    const zIndex = Number.isFinite(z) ? z : 2147483046;
    const urlRobotech = fontUrls && fontUrls.robotech || KEYBINDINGS_UI_FONT_PLACEHOLDERS.ROBOTECH;
    const urlTitillium = fontUrls && fontUrls.titillium || KEYBINDINGS_UI_FONT_PLACEHOLDERS.TITILLIUM;
    const urlTitilliumBold = fontUrls && fontUrls.titilliumBold || KEYBINDINGS_UI_FONT_PLACEHOLDERS.TITILLIUM_BOLD;
    const urlCubellan = fontUrls && fontUrls.cubellan || KEYBINDINGS_UI_FONT_PLACEHOLDERS.CUBELLAN;
    const urlEzarion = fontUrls && fontUrls.ezarion || KEYBINDINGS_UI_FONT_PLACEHOLDERS.EZARION;
    const urlDosis = fontUrls && fontUrls.dosis || KEYBINDINGS_UI_FONT_PLACEHOLDERS.DOSIS;
    const keyIconCss = getKeyboardKeyIconCss();
    const fontFaceCss = getKeybindingsUiFontFaceCss({
      robotech: urlRobotech,
      titillium: urlTitillium,
      titilliumBold: urlTitilliumBold,
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

/* \u2500\u2500 Keyboard plate (pro app tray) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

/* \u2500\u2500 Base keycap: low-profile chiclet (flat + lightly realistic) \u2500 */
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
   * can briefly win during the early-shell \u2192 bundled-style handoff.
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
  border-radius: var(--kp-key-effective-radius, var(--kp-radius-key, 7px));
  clip-path: var(--kp-key-clip, none);

  /*
   * Low-profile key: nearly flat face, thin rim, soft ground shadow.
   * Reads more like a real chiclet key than a heavy 3D bevel.
   */
  border: var(--kp-key-border, 1px solid rgba(0, 0, 0, 0.4));
  border-top-color: rgba(255, 255, 255, 0.1);
  border-bottom-color: rgba(0, 0, 0, 0.5);

  background:
    var(--kp-key-shade-layer, linear-gradient(180deg,
      rgba(255, 255, 255, 0.07) 0%,
      rgba(255, 255, 255, 0.02) 18%,
      transparent 42%)),
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

/* Upgrade: corner-shape so key borders follow cut corners (clip-path baseline above).
 * Cut themes force --kp-key-effective-radius: 0px for the clip-path path; the
 * upgrade must win so bevel length comes from --kp-key-shape-radius. */
@supports (corner-shape: bevel) {
  .${KEYBINDINGS_UI_ROOT_CLASS} .key {
    clip-path: none !important;
    border-radius: var(--kp-key-shape-radius, var(--kp-key-effective-radius, var(--kp-radius-key, 7px))) !important;
    corner-shape: var(--kp-key-corner-shape, round);
  }
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
  opacity: var(--kp-key-sheen-opacity, 1);
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
 * - .key-main  = action name \u2014 upper band only
 * - .key-label = physical key letter \u2014 always pinned bottom-center
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

/* Edit-mode slot delete: fixed overlay on the keycap, independent of .key-main. */
.${KEYBINDINGS_UI_ROOT_CLASS} .key > .kp-key-delete-overlay {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
}
.${KEYBINDINGS_UI_ROOT_CLASS} .key > .kp-key-delete-overlay > .kp-key-delete {
  position: absolute;
  top: 1px;
  right: 1px;
  left: auto;
  bottom: auto;
  width: 14px;
  height: 14px;
  min-width: 14px;
  min-height: 14px;
  margin: 0;
  padding: 0;
  border: none;
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
  pointer-events: auto;
}
.${KEYBINDINGS_UI_ROOT_CLASS} .key:hover > .kp-key-delete-overlay > .kp-key-delete,
.${KEYBINDINGS_UI_ROOT_CLASS} .key:focus-within > .kp-key-delete-overlay > .kp-key-delete {
  display: flex;
}
.${KEYBINDINGS_UI_ROOT_CLASS} .key > .kp-key-delete-overlay > .kp-key-delete:hover {
  background: rgba(255, 70, 70, 1);
}

/* Edit-mode plate hatch (same steel lines as Keyboard Layout Config). */
.keyboard-visual.${KEYBINDINGS_UI_ROOT_CLASS}.kp-kb-edit-hatch {
  background:
    var(--kp-hatch-edit, repeating-linear-gradient(-45deg, rgba(180, 200, 220, 0.08) 0px, rgba(180, 200, 220, 0.08) 1px, transparent 1px, transparent 7px)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, transparent 28%),
    radial-gradient(120% 80% at 50% 0%, rgba(91, 226, 241, 0.07) 0%, transparent 55%),
    linear-gradient(180deg, #222833 0%, #1a1f28 45%, #13161e 100%) !important;
}

/* Special chrome labels (Tab/Caps/\u2026) */
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

/* Must beat .key flex !important or modifiers stay letter-key width. */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-tab { flex: 1.5 1 0 !important; }
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-caps { flex: 1.75 1 0 !important; }
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-enter { flex: 2 1 0 !important; }
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-shift { flex: 2.15 1 0 !important; }
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-backspace { flex: 1.55 1 0 !important; }

/* \u2500\u2500 Color families (muted pro tints + darker icon color) \u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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
      face: "#2f8f5b",
      mid: "#247a4c",
      deep: "#17633a",
      icon: "#0d3a22",
      glow: "rgba(34, 197, 94, 0.18)"
    })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-back,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-forward,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-scroll-top,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-scroll-bottom {
  ${keycapMaterial({
      face: "#2f7ea8",
      mid: "#256b92",
      deep: "#1a5475",
      icon: "#0d3044",
      glow: "rgba(56, 189, 248, 0.16)"
    })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-delete,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-close-tab {
  ${keycapMaterial({
      face: "#b84a4a",
      mid: "#9e3b3b",
      deep: "#7a2b2b",
      icon: "#401616",
      glow: "rgba(248, 113, 113, 0.16)"
    })}
}

/* Selection tools: indigo family (distinct from green activate / blue nav) */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-highlight,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-rect-highlight,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-cols {
  ${keycapMaterial({
      face: "#5b6fd4",
      mid: "#4a5cbb",
      deep: "#3949a0",
      icon: "#1a2258",
      glow: "rgba(99, 102, 241, 0.18)"
    })}
}

/* Browser chrome (tabs, zoom, new tab) */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-browser-chrome {
  ${keycapMaterial({
      face: "#7a5638",
      mid: "#63452c",
      deep: "#4a3320",
      icon: "#26180f",
      glow: "rgba(180, 120, 70, 0.12)"
    })}
}

/* Page scrolling. key-scroll is retained for macro round-robin. */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-page-scroll,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-scroll {
  ${keycapMaterial({
      face: "#5f6b3c",
      mid: "#4d572f",
      deep: "#3a4223",
      icon: "#1c2110",
      glow: "rgba(164, 180, 80, 0.12)"
    })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-purple {
  ${keycapMaterial({
      face: "#7a4ab8",
      mid: "#663d9e",
      deep: "#4e2e7a",
      icon: "#281646",
      glow: "rgba(167, 139, 250, 0.14)"
    })}
}

/* KeyPilot chrome overlays (Omnibox, Launcher, Top Sites). key-orange is retained for macro hotkeys. */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-kp-ui,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-orange {
  ${keycapMaterial({
      face: "#c97a28",
      mid: "#a8641e",
      deep: "#834f16",
      icon: "#3f250a",
      glow: "rgba(255, 165, 0, 0.14)"
    })}
}

/* Reader Mode \u2014 same orange family as KeyPilot UI, darker but still orange */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-reader-mode {
  ${keycapMaterial({
      face: "#b36e2c",
      mid: "#93581f",
      deep: "#734316",
      icon: "#3a210a",
      glow: "rgba(201, 122, 40, 0.16)"
    })}
}

/* Inspect / collect media on the current page \u2014 muted yellow */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-page-media {
  ${keycapMaterial({
      face: "#b5a45c",
      mid: "#948546",
      deep: "#6f6434",
      icon: "#363018",
      glow: "rgba(200, 180, 80, 0.16)"
    })}
}

/* Same hue as page media, lower saturation (saved library) */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-media-library {
  ${keycapMaterial({
      face: "#a39a70",
      mid: "#897f57",
      deep: "#6a6244",
      icon: "#2e2b1e",
      glow: "rgba(163, 154, 112, 0.12)"
    })}
}

/* Open saved destinations (Open URLs, bookmarks, Site Root) \u2014 plum, not rose/red */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-open-urls {
  ${keycapMaterial({
      face: "#6b4a8c",
      mid: "#573b73",
      deep: "#412c56",
      icon: "#1f152b",
      glow: "rgba(140, 100, 180, 0.12)"
    })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-settings-dark {
  ${keycapMaterial({
      face: "#3a4250",
      mid: "#2a313c",
      deep: "#1a1f28",
      icon: "#0c0f14",
      glow: "rgba(148, 163, 184, 0.1)"
    })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-gray {
  ${keycapMaterial({
      face: "#5a6270",
      mid: "#484f5c",
      deep: "#343a45",
      icon: "#1a1e26",
      glow: "rgba(148, 163, 184, 0.1)"
    })}
}

/* Clipboard commands (copy / cut / paste / select all) */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-clipboard {
  ${keycapMaterial({
      face: "#4e5d73",
      mid: "#3e4a5c",
      deep: "#2d3644",
      icon: "#151a22",
      glow: "rgba(148, 163, 184, 0.14)"
    })}
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-launcher {
  ${keycapMaterial({
      face: "#2a8fa3",
      mid: "#22788a",
      deep: "#185e6d",
      icon: "#0c343c",
      glow: "rgba(34, 211, 238, 0.14)"
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
 * on the key itself \u2014 those were hard to see on colored keycaps.
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
  /* Crisp orange outline \u2014 no soft glow bloom. */
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
/* Pattern overlays (hatch / checkerboard / \u2026) \u2014 plain face only while typing. */
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

/* Popover (tooltip) \u2014 matches the hovered key material via CSS vars.
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
  align-items: flex-start;
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
  flex: 0 1 auto;
  max-width: 11em;
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.82);
  letter-spacing: 0.02em;
  white-space: normal;
  overflow-wrap: break-word;
  text-align: center;
  line-height: 1.25;
  padding: 2px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.32);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
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
  background:
    linear-gradient(180deg,
      rgba(0, 0, 0, 0.4) 0%,
      rgba(0, 0, 0, 0.55) 100%),
    linear-gradient(180deg,
      rgba(255, 255, 255, 0.06) 0%,
      rgba(255, 255, 255, 0.01) 18%,
      transparent 42%),
    linear-gradient(180deg,
      var(--kp-key-face) 0%,
      var(--kp-key-mid) 70%,
      var(--kp-key-deep) 100%);
  outline: 1.5px solid color-mix(in srgb, var(--kp-key-face) 45%, white);
  outline-offset: 0;
  border-color: color-mix(in srgb, var(--kp-key-face) 35%, black);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.55),
    0 10px 24px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -1px 0 rgba(0, 0, 0, 0.28);
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

.kp-keybindings-popover[data-kp-popover-pinned="true"].kp-popover-has-instance-settings {
  width: min(340px, calc(100vw - 20px));
}

.kp-string-table {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  --kp-string-table-row: 30px;
}

.kp-string-table-scroll {
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.18);
}

.kp-string-table table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.kp-string-table td {
  height: var(--kp-string-table-row, 30px);
  padding: 2px 4px;
  box-sizing: border-box;
  vertical-align: middle;
}

.kp-string-table td:last-child {
  width: 28px;
  padding-right: 2px;
}

.kp-string-table input,
.kp-keybindings-popover .kp-popover-field {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  height: 24px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.28);
  color: rgba(248, 250, 252, 0.95);
  font: inherit;
  font-size: 11px;
}

.kp-string-table-remove,
.kp-string-table-add {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(248, 250, 252, 0.9);
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
}

.kp-string-table-remove {
  width: 22px;
  height: 22px;
  padding: 0;
  line-height: 20px;
}

.kp-string-table-add {
  align-self: flex-start;
  padding: 3px 8px;
  font-size: 11px;
}

.kp-string-table-add:disabled {
  opacity: 0.45;
  cursor: default;
}

.kp-bookmark-folder-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.kp-bookmark-folder-scroll {
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.18);
}

.kp-bookmark-folder-btn {
  appearance: none;
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-height: var(--kp-string-table-row, 30px);
  padding: 4px 8px;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
  color: rgba(248, 250, 252, 0.92);
  font: inherit;
  font-size: 11px;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
}

.kp-bookmark-folder-btn[aria-selected="true"] {
  background: rgba(255, 255, 255, 0.14);
}

.kp-bookmark-folder-status,
.kp-bookmark-folder-hint {
  font-size: 10px;
  line-height: 1.35;
  color: rgba(248, 250, 252, 0.62);
}

.kp-bookmark-folder-status {
  padding: 6px 8px;
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

.kp-keybindings-popover[data-kp-popover-pinned="true"][data-placement="top"]::after {
  border-top-color: color-mix(in srgb, var(--kp-key-deep) 45%, black);
}

.kp-keybindings-popover[data-kp-popover-pinned="true"][data-placement="top"]::before {
  border-top-color: color-mix(in srgb, var(--kp-key-face) 45%, white);
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

.kp-keybindings-popover[data-kp-popover-pinned="true"][data-placement="bottom"]::after {
  border-bottom-color: color-mix(in srgb, var(--kp-key-face) 45%, black);
}

.kp-keybindings-popover[data-kp-popover-pinned="true"][data-placement="bottom"]::before {
  border-bottom-color: color-mix(in srgb, var(--kp-key-face) 45%, white);
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

  // extension/src/ui/key-action-settings.js
  init_constants();

  // extension/src/utils/panel-position.js
  var PANEL_POSITION_MARGIN_PX = 8;
  var PANEL_SNAP_THRESHOLD_PX = 56;
  var PANEL_DRAG_MOVE_THRESHOLD_PX = 3;
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
  function normalizePanelAnchor(raw) {
    if (typeof raw !== "string") return null;
    const a = raw.trim();
    return PANEL_ANCHORS.includes(
      /** @type {PanelAnchor} */
      a
    ) ? (
      /** @type {PanelAnchor} */
      a
    ) : null;
  }
  function normalizePanelPositionState(raw, fallback = null) {
    const fb = fallback && typeof fallback === "object" ? fallback : null;
    if (!raw || typeof raw !== "object") {
      return fb ? {
        left: Number.isFinite(fb.left) ? fb.left : void 0,
        top: Number.isFinite(fb.top) ? fb.top : void 0,
        anchor: normalizePanelAnchor(fb.anchor)
      } : null;
    }
    const left = Number(raw.left);
    const top = Number(raw.top);
    const anchor = normalizePanelAnchor(raw.anchor);
    const hasLeft = Number.isFinite(left);
    const hasTop = Number.isFinite(top);
    if (!anchor && !hasLeft && !hasTop) {
      return fb ? {
        left: Number.isFinite(fb.left) ? fb.left : void 0,
        top: Number.isFinite(fb.top) ? fb.top : void 0,
        anchor: normalizePanelAnchor(fb.anchor)
      } : null;
    }
    const out = {};
    if (hasLeft) out.left = left;
    if (hasTop) out.top = top;
    if (anchor) out.anchor = anchor;
    else if (raw.anchor === null) out.anchor = null;
    return out;
  }
  function getViewportSize(opts = null) {
    let fallbackW = 0;
    let fallbackH = 0;
    if (typeof window !== "undefined") {
      try {
        const de = document.documentElement;
        fallbackW = Math.max(de?.clientWidth || 0, window.innerWidth || 0);
        fallbackH = Math.max(de?.clientHeight || 0, window.innerHeight || 0);
      } catch {
        fallbackW = window.innerWidth || 0;
        fallbackH = window.innerHeight || 0;
      }
    }
    const w = opts && Number.isFinite(opts.width) ? opts.width : fallbackW;
    const h = opts && Number.isFinite(opts.height) ? opts.height : fallbackH;
    return {
      width: Math.max(0, Math.round(w) || 0),
      height: Math.max(0, Math.round(h) || 0)
    };
  }
  function clampPanelPosition(args) {
    const margin = Math.max(0, Number(args.margin));
    const m = Number.isFinite(margin) ? margin : PANEL_POSITION_MARGIN_PX;
    const vp = getViewportSize({
      width: args.viewportWidth,
      height: args.viewportHeight
    });
    const w = Math.max(0, Number(args.width) || 0);
    const h = Math.max(0, Number(args.height) || 0);
    const maxLeft = Math.max(m, vp.width - w - m);
    const maxTop = Math.max(m, vp.height - h - m);
    const left = Number(args.left);
    const top = Number(args.top);
    return {
      left: Math.max(m, Math.min(Number.isFinite(left) ? left : m, maxLeft)),
      top: Math.max(m, Math.min(Number.isFinite(top) ? top : m, maxTop))
    };
  }
  function positionForAnchor(anchor, size) {
    const a = normalizePanelAnchor(anchor);
    const margin = Math.max(0, Number.isFinite(Number(size.margin)) ? Number(size.margin) : PANEL_POSITION_MARGIN_PX);
    const vp = getViewportSize({
      width: size.viewportWidth,
      height: size.viewportHeight
    });
    const w = Math.max(0, Number(size.width) || 0);
    const h = Math.max(0, Number(size.height) || 0);
    const leftMin = margin;
    const topMin = margin;
    const leftMax = Math.max(margin, vp.width - w - margin);
    const topMax = Math.max(margin, vp.height - h - margin);
    const leftCenter = Math.round((vp.width - w) / 2);
    const topCenter = Math.round((vp.height - h) / 2);
    let left = leftMin;
    let top = topMin;
    switch (a) {
      case "top-left":
        left = leftMin;
        top = topMin;
        break;
      case "top-center":
        left = leftCenter;
        top = topMin;
        break;
      case "top-right":
        left = leftMax;
        top = topMin;
        break;
      case "middle-left":
        left = leftMin;
        top = topCenter;
        break;
      case "middle-right":
        left = leftMax;
        top = topCenter;
        break;
      case "bottom-left":
        left = leftMin;
        top = topMax;
        break;
      case "bottom-center":
        left = leftCenter;
        top = topMax;
        break;
      case "bottom-right":
        left = leftMax;
        top = topMax;
        break;
      default:
        left = leftMin;
        top = topMin;
        return { left, top, anchor: null };
    }
    const clamped = clampPanelPosition({
      left,
      top,
      width: w,
      height: h,
      margin,
      viewportWidth: vp.width,
      viewportHeight: vp.height
    });
    return { left: clamped.left, top: clamped.top, anchor: a };
  }
  function getPanelSnapTargets(size) {
    const out = [];
    for (const anchor of PANEL_ANCHORS) {
      const p = positionForAnchor(anchor, size);
      if (p.anchor) {
        out.push({ anchor: p.anchor, left: p.left, top: p.top });
      }
    }
    return out;
  }
  function findNearestPanelSnap(args) {
    const threshold = Math.max(
      0,
      Number.isFinite(Number(args.threshold)) ? Number(args.threshold) : PANEL_SNAP_THRESHOLD_PX
    );
    const targets = getPanelSnapTargets(args);
    let best = null;
    for (const t of targets) {
      const dx = t.left - args.left;
      const dy = t.top - args.top;
      const d = Math.hypot(dx, dy);
      if (d <= threshold && (!best || d < best.distance)) {
        best = { ...t, distance: d };
      }
    }
    return best;
  }
  function resolvePanelPosition(stored, size) {
    const margin = Math.max(0, Number.isFinite(Number(size.margin)) ? Number(size.margin) : PANEL_POSITION_MARGIN_PX);
    const w = Math.max(0, Number(size.width) || 0);
    const h = Math.max(0, Number(size.height) || 0);
    const state = normalizePanelPositionState(stored);
    const defaultAnchor = normalizePanelAnchor(size.defaultAnchor);
    if (state?.anchor) {
      return positionForAnchor(state.anchor, {
        width: w,
        height: h,
        margin,
        viewportWidth: size.viewportWidth,
        viewportHeight: size.viewportHeight
      });
    }
    if (state && Number.isFinite(state.left) && Number.isFinite(state.top)) {
      const clamped2 = clampPanelPosition({
        left: (
          /** @type {number} */
          state.left
        ),
        top: (
          /** @type {number} */
          state.top
        ),
        width: w,
        height: h,
        margin,
        viewportWidth: size.viewportWidth,
        viewportHeight: size.viewportHeight
      });
      return { left: clamped2.left, top: clamped2.top, anchor: null };
    }
    if (defaultAnchor) {
      return positionForAnchor(defaultAnchor, {
        width: w,
        height: h,
        margin,
        viewportWidth: size.viewportWidth,
        viewportHeight: size.viewportHeight
      });
    }
    const clamped = clampPanelPosition({
      left: margin,
      top: margin,
      width: w,
      height: h,
      margin,
      viewportWidth: size.viewportWidth,
      viewportHeight: size.viewportHeight
    });
    return { left: clamped.left, top: clamped.top, anchor: null };
  }
  function pinPanelGeometry(panel, opts = {}) {
    const pinWidth = opts.pinWidth !== false;
    const pinHeight = opts.pinHeight === true;
    const rect = panel.getBoundingClientRect();
    const s = panel.style;
    s.position = "fixed";
    s.transform = "none";
    try {
      s.webkitTransform = "none";
    } catch {
    }
    s.right = "auto";
    s.bottom = "auto";
    s.left = `${rect.left}px`;
    s.top = `${rect.top}px`;
    if (pinWidth) {
      s.width = `${rect.width}px`;
    }
    if (pinHeight) {
      s.height = `${rect.height}px`;
    }
    s.margin = "0";
    s.boxSizing = "border-box";
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };
  }
  function measurePanelSize(panel) {
    let width = 0;
    let height = 0;
    try {
      width = panel.offsetWidth || 0;
      height = panel.offsetHeight || 0;
    } catch {
    }
    if (width <= 0 || height <= 0) {
      try {
        const rect = panel.getBoundingClientRect();
        if (width <= 0) width = rect.width || 0;
        if (height <= 0) height = rect.height || 0;
      } catch {
      }
    }
    if (width <= 0) {
      try {
        width = panel.scrollWidth || 0;
      } catch {
      }
    }
    if (height <= 0) {
      try {
        height = panel.scrollHeight || 0;
      } catch {
      }
    }
    return { width: Math.max(0, width), height: Math.max(0, height) };
  }
  function writePanelPosition(panel, resolved, opts = {}) {
    const s = panel.style;
    s.position = "fixed";
    s.transform = "none";
    try {
      s.webkitTransform = "none";
    } catch {
    }
    s.right = "auto";
    s.bottom = "auto";
    s.left = `${Math.round(resolved.left)}px`;
    s.top = `${Math.round(resolved.top)}px`;
    s.margin = "0";
    if (opts.pinSize) {
      if (opts.width > 0) s.width = `${Math.round(opts.width)}px`;
      if (opts.height > 0) s.height = `${Math.round(opts.height)}px`;
      s.maxWidth = "none";
      s.maxHeight = "none";
    }
    try {
      if (resolved.anchor) panel.setAttribute("data-kp-panel-anchor", resolved.anchor);
      else panel.removeAttribute("data-kp-panel-anchor");
    } catch {
    }
  }
  function applyPanelPosition(panel, position, options = {}) {
    if (!panel || !panel.style) {
      return { left: 0, top: 0, anchor: null };
    }
    const measured = measurePanelSize(panel);
    let width = Number.isFinite(options.width) ? (
      /** @type {number} */
      options.width
    ) : measured.width;
    let height = Number.isFinite(options.height) ? (
      /** @type {number} */
      options.height
    ) : measured.height;
    const margin = Math.max(0, Number.isFinite(Number(options.margin)) ? Number(options.margin) : PANEL_POSITION_MARGIN_PX);
    const fallbackW = Number.isFinite(options.fallbackWidth) ? options.fallbackWidth : 0;
    const fallbackH = Number.isFinite(options.fallbackHeight) ? options.fallbackHeight : 0;
    if (width < 32) width = fallbackW > 0 ? fallbackW : 320;
    if (height < 32) height = fallbackH > 0 ? fallbackH : 160;
    let resolved = resolvePanelPosition(position, {
      width,
      height,
      margin,
      defaultAnchor: options.defaultAnchor
    });
    writePanelPosition(panel, resolved, {
      pinSize: options.pinSize,
      width,
      height
    });
    try {
      const live = measurePanelSize(panel);
      const liveW = live.width || width;
      const liveH = live.height || height;
      if (liveW > 0 && liveH > 0) {
        const state = normalizePanelPositionState(position);
        const anchor = normalizePanelAnchor(state?.anchor) || normalizePanelAnchor(resolved.anchor);
        if (anchor) {
          resolved = positionForAnchor(anchor, {
            width: liveW,
            height: liveH,
            margin
          });
        } else {
          const left = Number.isFinite(resolved.left) ? resolved.left : margin;
          const top = Number.isFinite(resolved.top) ? resolved.top : margin;
          const clamped = clampPanelPosition({
            left,
            top,
            width: liveW,
            height: liveH,
            margin
          });
          resolved = { left: clamped.left, top: clamped.top, anchor: null };
        }
        writePanelPosition(panel, resolved, {
          pinSize: options.pinSize,
          width: liveW,
          height: liveH
        });
        const painted = panel.getBoundingClientRect();
        const vp = getViewportSize();
        const spills = painted.bottom > vp.height - margin + 1 || painted.right > vp.width - margin + 1 || painted.top < margin - 1 || painted.left < margin - 1;
        if (spills && painted.width > 0 && painted.height > 0) {
          const fixed = clampPanelPosition({
            left: painted.left,
            top: painted.top,
            width: painted.width,
            height: painted.height,
            margin
          });
          resolved = {
            left: fixed.left,
            top: fixed.top,
            anchor: anchor || null
          };
          if (!anchor) resolved.anchor = null;
          writePanelPosition(panel, resolved);
        }
      }
    } catch {
    }
    return resolved;
  }
  function finalizePanelDragPosition(args) {
    const margin = Math.max(0, Number.isFinite(Number(args.margin)) ? Number(args.margin) : PANEL_POSITION_MARGIN_PX);
    const snapEnabled = args.snap !== false;
    const clamped = clampPanelPosition({
      left: args.left,
      top: args.top,
      width: args.width,
      height: args.height,
      margin
    });
    if (snapEnabled) {
      const snap = findNearestPanelSnap({
        left: clamped.left,
        top: clamped.top,
        width: args.width,
        height: args.height,
        margin,
        threshold: args.snapThreshold
      });
      if (snap) {
        return {
          left: Math.round(snap.left),
          top: Math.round(snap.top),
          anchor: snap.anchor
        };
      }
    }
    return {
      left: Math.round(clamped.left),
      top: Math.round(clamped.top),
      anchor: null
    };
  }
  function makePanelDraggable(panel, handle, options = {}) {
    if (!panel || !(panel instanceof Element) || !handle || !(handle instanceof Element)) {
      return null;
    }
    try {
      if (handle.dataset && handle.dataset.kpPanelDraggable === "1") {
        return handle.__kpPanelDragApi || null;
      }
    } catch {
    }
    const margin = Math.max(0, Number.isFinite(Number(options.margin)) ? Number(options.margin) : PANEL_POSITION_MARGIN_PX);
    const snapThreshold = Math.max(
      0,
      Number.isFinite(Number(options.snapThreshold)) ? Number(options.snapThreshold) : PANEL_SNAP_THRESHOLD_PX
    );
    const moveThreshold = Math.max(
      0,
      Number.isFinite(Number(options.moveThresholdPx)) ? Number(options.moveThresholdPx) : PANEL_DRAG_MOVE_THRESHOLD_PX
    );
    const snapEnabled = options.snap !== false;
    const pinWidth = options.pinWidth !== false;
    const pinHeight = options.pinHeight === true;
    const excludeSelector = typeof options.excludeSelector === "string" && options.excludeSelector ? options.excludeSelector : "";
    const cursorGrab = options.cursorGrab || "grab";
    const cursorGrabbing = options.cursorGrabbing || "grabbing";
    let dragState = null;
    const measure = () => {
      const rect = panel.getBoundingClientRect();
      return {
        width: panel.offsetWidth || rect.width || 0,
        height: panel.offsetHeight || rect.height || 0
      };
    };
    const onPointerMove = (e) => {
      if (!dragState || !panel.isConnected) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (!dragState.moved) {
        if (Math.abs(dx) < moveThreshold && Math.abs(dy) < moveThreshold) return;
        dragState.moved = true;
        try {
          handle.style.cursor = cursorGrabbing;
        } catch {
        }
        try {
          options.onMoveStart?.();
        } catch {
        }
      }
      const size = measure();
      const next = clampPanelPosition({
        left: dragState.originLeft + dx,
        top: dragState.originTop + dy,
        width: size.width,
        height: size.height,
        margin
      });
      panel.style.left = `${next.left}px`;
      panel.style.top = `${next.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      try {
        panel.removeAttribute("data-kp-panel-anchor");
      } catch {
      }
      try {
        options.onMove?.(next);
      } catch {
      }
    };
    const endDrag = (e) => {
      if (!dragState) return;
      const state = dragState;
      const pointerId = state.pointerId;
      dragState = null;
      try {
        handle.style.cursor = cursorGrab;
      } catch {
      }
      try {
        if (e && typeof e.pointerId === "number") handle.releasePointerCapture(e.pointerId);
        else if (typeof pointerId === "number") handle.releasePointerCapture(pointerId);
      } catch {
      }
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", endDrag, true);
      document.removeEventListener("pointercancel", endDrag, true);
      if (!panel.isConnected) {
        try {
          options.onMoveEnd?.({ left: state.originLeft, top: state.originTop, anchor: null, moved: false });
        } catch {
        }
        return;
      }
      const size = measure();
      const rect = panel.getBoundingClientRect();
      const finalPos = state.moved ? finalizePanelDragPosition({
        left: rect.left,
        top: rect.top,
        width: size.width,
        height: size.height,
        margin,
        snapThreshold,
        snap: snapEnabled
      }) : {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        anchor: normalizePanelAnchor(panel.getAttribute?.("data-kp-panel-anchor"))
      };
      if (state.moved) {
        applyPanelPosition(panel, finalPos, { margin, pinSize: false });
      }
      try {
        options.onMoveEnd?.({
          left: finalPos.left,
          top: finalPos.top,
          anchor: finalPos.anchor ?? null,
          moved: !!state.moved
        });
      } catch {
      }
    };
    const onPointerDown = (e) => {
      if (!panel.isConnected) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (excludeSelector) {
        try {
          const t = (
            /** @type {Element|null} */
            e.target instanceof Element ? e.target : e.target?.parentElement
          );
          if (t?.closest?.(excludeSelector)) return;
        } catch {
        }
      }
      e.preventDefault();
      e.stopPropagation();
      const origin = pinPanelGeometry(panel, { pinWidth, pinHeight });
      dragState = {
        startX: e.clientX,
        startY: e.clientY,
        originLeft: origin.left,
        originTop: origin.top,
        pointerId: e.pointerId,
        moved: false
      };
      try {
        handle.setPointerCapture(e.pointerId);
      } catch {
      }
      document.addEventListener("pointermove", onPointerMove, true);
      document.addEventListener("pointerup", endDrag, true);
      document.addEventListener("pointercancel", endDrag, true);
    };
    try {
      handle.style.cursor = handle.style.cursor || cursorGrab;
      handle.style.touchAction = handle.style.touchAction || "none";
      handle.style.userSelect = handle.style.userSelect || "none";
    } catch {
    }
    handle.addEventListener("pointerdown", onPointerDown);
    const api = {
      dispose: () => {
        endDrag();
        try {
          handle.removeEventListener("pointerdown", onPointerDown);
        } catch {
        }
        try {
          if (handle.dataset) delete handle.dataset.kpPanelDraggable;
        } catch {
        }
        try {
          delete handle.__kpPanelDragApi;
        } catch {
        }
      }
    };
    try {
      handle.dataset.kpPanelDraggable = "1";
      handle.__kpPanelDragApi = api;
    } catch {
    }
    return api;
  }

  // extension/themes/index.js
  init_schema();

  // extension/themes/dark-pro/theme.js
  init_schema();

  // extension/themes/chrome-recipes.js
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

  // extension/themes/click-defaults.js
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
      overlayFillEnabled: false,
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
      overlayFillEnabled: false,
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
      overlayShadowEnabled: true,
      rectangleThickness: 3,
      clickEffect: "flash",
      keyboardLinkHoverHints: false,
      paintStrategy: "BC",
      focusPadding: 2,
      skipForParent: true
    })
  });

  // extension/themes/dark-pro/theme.js
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

  // extension/themes/gray-metal-pro/theme.js
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

  // extension/themes/gx-er/theme.js
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

  // extension/themes/icons.js
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

  // extension/themes/index.js
  var PACKAGES = Object.freeze({
    "dark-pro": DARK_PRO_THEME,
    "gray-metal-pro": GRAY_METAL_PRO_THEME,
    "gx-er": GX_ER_THEME
  });
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

  // extension/themes/font-faces.js
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

  // extension/src/modules/theme-manager.js
  var FONT_ATTR = "data-kp-theme-fonts";
  var ALL_THEMES_ATTR = "data-kp-all-themes";
  var _activeTheme = getTheme(DEFAULT_THEME_ID);
  function getActiveTheme() {
    return _activeTheme;
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

  // extension/src/ui/kp-chrome-shadow.js
  init_i18n();

  // extension/src/ui/locale-fonts.js
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

  // extension/src/ui/kp-chrome-shadow.js
  function markChromeWindow(el2) {
    if (!el2) return el2;
    try {
      el2.classList?.add("kp-chrome-window");
    } catch {
    }
    try {
      const theme = getActiveTheme();
      applyThemeDataset(el2, theme);
      applyThemeCssVars(el2, theme);
    } catch {
    }
    return el2;
  }
  function ensureOpenChromeShadow(host, opts = {}) {
    if (!host) return null;
    try {
      host.setAttribute("data-kp-ui-shadow", String(opts.id || "chrome"));
    } catch {
    }
    try {
      host.setAttribute("lang", getUILocaleTag());
    } catch {
    }
    if (opts.chromeWindow) markChromeWindow(host);
    let shadow = null;
    try {
      shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    } catch {
      shadow = host.shadowRoot || null;
    }
    try {
      const theme = getActiveTheme();
      applyThemeDataset(host, theme);
      applyThemeCssVars(host, theme);
      if (shadow) injectAllThemeMaps(shadow);
      if (shadow) injectChromeStyles(shadow, { attr: "data-kp-cjk-fonts", css: KP_CJK_SHADOW_CSS });
    } catch {
    }
    return shadow;
  }
  function injectChromeStyles(root, { attr, css } = {}) {
    if (!root || !attr) return null;
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    const mount = root.nodeType === 9 ? root.head : root;
    if (!doc || !mount?.appendChild) return null;
    let style = null;
    try {
      style = mount.querySelector(`style[${attr}]`);
    } catch {
    }
    if (!style) {
      try {
        style = doc.createElement("style");
        style.setAttribute(attr, "true");
        style.textContent = String(css || "");
        mount.appendChild(style);
        return style;
      } catch {
        return null;
      }
    }
    if (style.textContent !== String(css || "")) {
      try {
        style.textContent = String(css || "");
      } catch {
      }
    }
    return style;
  }
  function getComposedEventElement(event, selector) {
    if (!event || !selector) return null;
    try {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      for (const node of path || []) {
        if (node?.nodeType === 1 && node.matches?.(selector)) return node;
      }
    } catch {
    }
    try {
      const target = event.target;
      return target?.nodeType === 1 && target.matches?.(selector) ? target : null;
    } catch {
      return null;
    }
  }
  function closestComposed(element, selector) {
    let node = element;
    let depth = 0;
    while (node && depth++ < 32) {
      try {
        if (node.matches?.(selector)) return node;
        if (node.parentElement) {
          node = node.parentElement;
          continue;
        }
        const root = node.getRootNode?.();
        node = root && typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot ? root.host : null;
      } catch {
        return null;
      }
    }
    return null;
  }
  function containsComposed(host, node) {
    if (!host || !node) return false;
    if (host === node) return true;
    try {
      if (host.contains(node)) return true;
    } catch {
    }
    let current = node;
    let depth = 0;
    while (current && depth++ < 32) {
      if (current === host) return true;
      const parent = current.parentElement;
      if (parent) {
        current = parent;
        continue;
      }
      const root = current.getRootNode?.();
      current = root && typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot ? root.host : null;
    }
    return false;
  }

  // extension/src/config/function-library.js
  init_keyboard_layouts();

  // extension/src/config/macro-keys.js
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

  // extension/src/utils/key-chord.js
  init_platform();

  // extension/src/modules/action-result-delivery.js
  init_constants();

  // extension/src/ui/procedure-result-popover.js
  init_i18n();
  init_constants();

  // extension/src/ui/nct-dark-ui.js
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
  var NCT_DARK_UI_PANEL_BACKGROUND = "var(--kp-panel-bg, var(--kp-color-panel, #232323))";
  var NCT_DARK_UI_PANEL_BORDER = "var(--kp-panel-border, 1px solid #111)";
  var NCT_DARK_UI_PANEL_BOX_SHADOW = "var(--kp-panel-shadow)";
  var NCT_DARK_UI_PANEL_RADIUS = "var(--kp-radius-panel, 3px)";
  var NCT_DARK_UI_TITLEBAR_GRADIENT = "var(--kp-titlebar-bg)";
  var NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM = "var(--kp-titlebar-border, 1px solid #111)";
  var NCT_DARK_UI_TITLEBAR_BOX_SHADOW = "var(--kp-titlebar-shadow)";
  var NCT_DARK_UI_TITLEBAR_TEXT_MODE_BACKGROUND = `linear-gradient(180deg, rgba(255, 140, 0, 0.28) 0%, rgba(255, 140, 0, 0.14) 45%, rgba(255, 120, 0, 0.18) 100%), linear-gradient(180deg, ${NCT_DARK_UI_COLORS.titleTop} 0%, ${NCT_DARK_UI_COLORS.titleMid} 45%, ${NCT_DARK_UI_COLORS.titleBot} 100%)`;
  var NCT_DARK_UI_BTN_GRADIENT = "var(--kp-btn-bg)";
  var NCT_DARK_UI_BTN_BORDER = "var(--kp-btn-border, 1px solid #111)";
  var NCT_DARK_UI_BTN_RADIUS = "var(--kp-radius-btn, 2px)";
  var NCT_DARK_UI_ICON_BUTTON_OUTLINE = "inset 0 0 0 1px var(--kp-color-panel-edge, #3a3a3a)";
  var NCT_DARK_UI_FIELD_BACKGROUND = "var(--kp-field-bg, #141414)";
  var NCT_DARK_UI_FIELD_BORDER = "var(--kp-field-border, 1px solid #0a0a0a)";
  var NCT_DARK_UI_FIELD_BOX_SHADOW = "var(--kp-field-shadow)";
  var NCT_DARK_UI_FIELD_FOCUS_BORDER = "var(--kp-color-accent, #4a90c8)";
  var NCT_DARK_UI_FIELD_FOCUS_BOX_SHADOW = "inset 0 0 0 1px color-mix(in srgb, var(--kp-color-accent, #4a90c8) 35%, transparent)";

  // extension/src/messaging/types.js
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
    // --- Dictionary lookup (Free Dictionary API via SW; LOOKUP_WORD) ---
    DICTIONARY_LOOKUP: "KP_DICTIONARY_LOOKUP",
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

  // extension/src/utils/video-url-utils.js
  var MAX_INLINE_VIDEO_BYTES = 8 * 1024 * 1024;

  // extension/src/modules/action-result-delivery.js
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

  // extension/src/modules/ai-text-service.js
  function isWordLookupAiAvailable() {
    return false;
  }
  function filterFunctionParameterOptions(functionId, param) {
    const options = Array.isArray(param?.options) ? param.options : [];
    if (functionId === "LOOKUP_WORD" && param?.id === "source" && !isWordLookupAiAvailable()) {
      return options.filter((o) => o && o.id !== "ai");
    }
    return options;
  }
  function shouldShowFunctionParameter(functionId, param) {
    if (!param) return false;
    if (functionId === "LOOKUP_WORD" && param.id === "source" && !isWordLookupAiAvailable()) {
      return false;
    }
    return true;
  }

  // extension/src/utils/kp-deep-link.js
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

  // extension/src/config/function-library.js
  init_i18n();
  init_platform();
  init_open_url_list();

  // extension/src/utils/bookmark-folder.js
  init_open_url_list();
  var RANDOM_BOOKMARK_MAX = 30;
  function normalizeBookmarkFolderId(raw) {
    const id = String(raw ?? "").trim();
    if (!id || id.length > 64 || /\s/.test(id)) return "";
    return id;
  }

  // extension/src/config/function-library.js
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
    ACTIVATE_NEW_TAB: docsUrl("browsing-click"),
    ACTIVATE_NEW_TAB_BACKGROUND: docsUrl("browsing-click"),
    PREVIEW_LINK_POPOVER: docsUrl("tools-previews"),
    OPEN_POPOVER: docsUrl("tools-previews"),
    FORWARD: docsUrl("browsing-tabs"),
    BACK: docsUrl("browsing-tabs"),
    BACK2: docsUrl("browsing-tabs"),
    ROOT: docsUrl("browsing-tabs"),
    CLOSE_TAB: docsUrl("browsing-tabs"),
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
    COPY_HOVERED_IMAGE: 200,
    COPY_HOVERED_VIDEO: 201,
    COPY_HOVERED_URL: 202,
    FONT_INFO: 203,
    PAGE_MEDIA: 205,
    READER_MODE: 206,
    RECTANGLE_HIGHLIGHT: 210,
    HIGHLIGHT: 220,
    // Clipboard
    CLIPBOARD_COPY: 230,
    CLIPBOARD_CUT: 231,
    CLIPBOARD_PASTE: 232,
    CLIPBOARD_SELECT_ALL: 233,
    SELECT_WORD: 234,
    SELECT_SENTENCE: 235,
    SELECT_PARAGRAPH: 236,
    SELECT_IMAGE: 237,
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
  function functionWorksWhileTyping(functionId) {
    return !!getFunctionDef(functionId)?.worksWhileTyping;
  }

  // extension/src/modules/keyboard-layout-store.js
  init_keyboard_layouts();
  init_stock_actions();

  // extension/src/config/stock-macros.js
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

  // extension/src/modules/keyboard-layout-store.js
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
  var PHYSICAL_SLOT_PREFIX = "code:";
  function physicalSlotKeyForCode(code) {
    const value = String(code || "").trim();
    return value ? `${PHYSICAL_SLOT_PREFIX}${value}` : "";
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
  function slotKeyFromBinding(binding) {
    if (binding?.bindingType !== "physical" || !Array.isArray(binding.keys)) return "";
    return physicalSlotKeyForCode(binding.keys[0]);
  }
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
  async function listUserKeyboardLayouts() {
    const st = await getKeyboardLayoutStore();
    return Object.values(st.layouts || {});
  }
  async function listUserActions() {
    const st = await getKeyboardLayoutStore();
    return Object.values(st.actions || {}).filter(Boolean);
  }
  async function getUserActionById(id) {
    const st = await getKeyboardLayoutStore();
    const key2 = String(id || "");
    const a = st.actions && st.actions[key2] ? st.actions[key2] : null;
    return a || null;
  }
  async function createUserAction({ functionId, label, parameters } = {}) {
    const def = getFunctionDef(functionId);
    if (!def) return null;
    const st = await getKeyboardLayoutStore();
    const id = genId("action:");
    const t = nowMs();
    const action = {
      id,
      functionId: def.id,
      label: String(label || def.label),
      parameters: normalizeFunctionParameters(def.id, parameters || defaultFunctionParameters(def.id)),
      createdAt: t,
      updatedAt: t
    };
    if (!st.actions || typeof st.actions !== "object") st.actions = {};
    st.actions[id] = action;
    await setKeyboardLayoutStore(st);
    return action;
  }
  async function upsertUserAction(action) {
    const def = getFunctionDef(action?.functionId);
    if (!def || !action?.id) return null;
    const st = await getKeyboardLayoutStore();
    const t = nowMs();
    const prev = st.actions && st.actions[action.id] ? st.actions[action.id] : null;
    const a = {
      id: String(action.id),
      functionId: def.id,
      label: String(action.label || prev?.label || def.label),
      parameters: normalizeFunctionParameters(def.id, action.parameters),
      createdAt: Number.isFinite(prev?.createdAt) ? prev.createdAt : Number.isFinite(action.createdAt) ? action.createdAt : t,
      updatedAt: t
    };
    if (!st.actions || typeof st.actions !== "object") st.actions = {};
    st.actions[a.id] = a;
    await setKeyboardLayoutStore(st);
    return a;
  }
  var BUILTIN_FUNCTION_ACTION_ID_PREFIX = "action:builtin:";
  function builtinFunctionUserActionId(functionId) {
    return `${BUILTIN_FUNCTION_ACTION_ID_PREFIX}${String(functionId || "")}`;
  }
  async function getOrCreateBuiltinFunctionUserAction(functionId) {
    const def = getFunctionDef(functionId);
    if (!def) return null;
    const id = builtinFunctionUserActionId(def.id);
    const st = await getKeyboardLayoutStore();
    const existing = st.actions && st.actions[id] ? st.actions[id] : null;
    if (existing) return existing;
    const t = nowMs();
    const action = {
      id,
      functionId: def.id,
      label: def.label,
      parameters: defaultFunctionParameters(def.id),
      createdAt: t,
      updatedAt: t
    };
    if (!st.actions || typeof st.actions !== "object") st.actions = {};
    st.actions[id] = action;
    await setKeyboardLayoutStore(st);
    return action;
  }
  async function setBuiltinFunctionUserActionParameter(functionId, paramId, value) {
    const current = await getOrCreateBuiltinFunctionUserAction(functionId);
    if (!current) return null;
    return await upsertUserAction({
      ...current,
      parameters: { ...current.parameters, [paramId]: value }
    });
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
  async function duplicateBuiltinLayoutToUserLayout({ builtinLayoutId, label } = {}) {
    const baseId = String(builtinLayoutId || "");
    const { handedness } = inferFamilyAndHandednessFromLayoutId(baseId);
    const kb = buildEffectiveKeybindings(baseId, handedness);
    const uiLayout = getKeyboardUiLayoutForLayout(baseId, { includeNumberRow: true });
    const slots = {};
    for (const row2 of uiLayout || []) {
      for (const item of row2 || []) {
        if (!item) continue;
        if (item.type === "special") continue;
        if (item.type === "key" && item.code) {
          const slotKey = physicalSlotKeyForCode(item.code);
          if (slotKey) slots[slotKey] = slots[slotKey] ?? null;
          continue;
        }
        if (item.type === "action") {
          const binding = kb && kb[item.id];
          const slot = slotKeyFromBinding(binding);
          if (!slot) continue;
          const functionId = String(item.id);
          if (functionWorksWhileTyping(functionId)) continue;
          slots[slot] = { type: "function", id: functionId };
        }
      }
    }
    const t = nowMs();
    const layout = {
      id: genId("layout:"),
      label: String(label || "Custom Layout"),
      builtIn: false,
      baseBuiltinLayoutId: baseId,
      slots,
      createdAt: t,
      updatedAt: t
    };
    return await upsertUserKeyboardLayout(layout);
  }

  // extension/src/modules/settings-path.js
  function clampNumber(n, min, max) {
    const v = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(v)) return min;
    return Math.min(max, Math.max(min, v));
  }

  // extension/src/modules/action-config-schema.js
  init_open_url_list();
  var ACTION_RADIO_PARAMETER_IDS = Object.freeze(["mode", "action", "format", "destination"]);
  function controlTypeForParameter(param, opts = {}) {
    if (!param) return "text";
    if (param.type === "boolean") return "toggle";
    if (param.type === "number") return "range";
    if (param.type === "stringList") return "stringList";
    if (param.type === "bookmarkFolder") return "bookmarkFolder";
    if (param.type === "enum") {
      const radioIds = opts.radioParamIds || [];
      return radioIds.includes(param.id) ? "radio" : "enum";
    }
    if (param.multiline) return "textarea";
    return "text";
  }
  function parameterToControlSpec(param, opts = {}) {
    if (!param || !param.id) return null;
    const type2 = controlTypeForParameter(param, opts);
    const spec = {
      type: type2,
      path: param.id,
      label: param.label || param.id,
      group: String(param.group || ""),
      defaultValue: param.defaultValue
    };
    if (type2 === "enum" || type2 === "radio" || type2 === "select") {
      spec.widget = type2 === "radio" ? "radio" : "select";
      spec.options = Array.isArray(param.options) ? param.options : [];
    }
    if (type2 === "range") {
      if (param.min != null) spec.min = param.min;
      if (param.max != null) spec.max = param.max;
      if (param.step != null) spec.step = param.step;
    }
    if (param.placeholder) spec.placeholder = String(param.placeholder);
    if (param.multiline) spec.multiline = true;
    if (param.rows != null) spec.rows = param.rows;
    if (type2 === "bookmarkFolder") {
      if (param.allowAll) spec.allowAll = true;
      if (param.hint) spec.hint = String(param.hint);
    }
    if (type2 === "stringList") {
      if (param.maxItems != null) spec.maxItems = param.maxItems;
      if (param.addLabel) spec.addLabel = String(param.addLabel);
      if (param.removeLabel) spec.removeLabel = String(param.removeLabel);
      if (param.presentation === "table") spec.presentation = "table";
      if (param.visibleRows != null) spec.visibleRows = param.visibleRows;
    }
    return spec;
  }
  function buildActionControlSchema(parameters, opts = {}) {
    const shouldShow = opts.shouldShow || (() => true);
    const filterOptions = opts.filterOptions;
    const specs = [];
    for (const param of parameters || []) {
      if (!param || !shouldShow(param)) continue;
      const spec = parameterToControlSpec(param, opts);
      if (!spec) continue;
      if ((spec.type === "enum" || spec.type === "radio" || spec.type === "select") && filterOptions) {
        spec.options = filterOptions(param);
      }
      specs.push(spec);
    }
    return specs;
  }
  function groupActionControlSpecs(specs) {
    const groups = [];
    for (const spec of specs || []) {
      if (!spec) continue;
      const group = String(spec.group || "");
      const last = groups[groups.length - 1];
      if (last && last.group === group) last.specs.push(spec);
      else groups.push({ group, specs: [spec] });
    }
    return groups;
  }
  function normalizeControlValue(spec, raw) {
    if (!spec) return raw;
    switch (spec.type) {
      case "toggle":
        return !!raw;
      case "range": {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(n)) return spec.defaultValue;
        if (spec.min != null && spec.max != null) return clampNumber(n, spec.min, spec.max);
        return n;
      }
      case "enum":
      case "select":
      case "radio": {
        const options = spec.options || [];
        return options.some((o) => o && o.id === raw) ? raw : spec.defaultValue;
      }
      case "stringList":
        return normalizeOpenUrlList(raw, spec.maxItems);
      case "bookmarkFolder":
        return normalizeBookmarkFolderId(raw);
      default:
        return raw !== void 0 && raw !== null ? String(raw) : spec.defaultValue ?? "";
    }
  }
  function normalizeActionParametersFromSchema(specs, raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const out = {};
    for (const spec of specs || []) {
      const has = Object.prototype.hasOwnProperty.call(src, spec.path);
      out[spec.path] = normalizeControlValue(spec, has ? src[spec.path] : spec.defaultValue);
    }
    return out;
  }

  // extension/src/modules/action-config-controller.js
  var ActionConfigController = class {
    constructor() {
      this.state = { functionId: "", parameters: {} };
      this._listeners = /* @__PURE__ */ new Set();
      this._disposed = false;
      this._specs = [];
      this._persist = null;
    }
    get disposed() {
      return this._disposed;
    }
    /**
     * @param {(state: ActionConfigState) => void} fn
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
     * @returns {import('./action-config-schema.js').ActionControlSpec[]}
     */
    schema() {
      return this._specs;
    }
    /**
     * @param {{
     *   functionId?: string,
     *   snapshot?: Record<string, any>|null,
     *   parameters?: Array<import('../config/function-library.js').FunctionParameterDef>|null,
     *   radioParamIds?: readonly string[],
     *   persist?: (functionId: string, paramId: string, value: any) => any
     * }} [opts]
     */
    load(opts = {}) {
      if (this._disposed) return this.state;
      const functionId = String(opts.functionId || "");
      const def = functionId ? getFunctionDef(functionId) : null;
      const parameterDefs = opts.parameters || def?.parameters || [];
      this._specs = buildActionControlSchema(parameterDefs, {
        radioParamIds: opts.radioParamIds,
        shouldShow: (param) => shouldShowFunctionParameter(functionId, param),
        filterOptions: (param) => filterFunctionParameterOptions(functionId, param)
      });
      this._persist = typeof opts.persist === "function" ? opts.persist : null;
      const snapshot = opts.snapshot && typeof opts.snapshot === "object" ? opts.snapshot : {};
      let parameters;
      if (def) {
        parameters = normalizeFunctionParameters(functionId, {
          ...defaultFunctionParameters(functionId),
          ...snapshot
        });
      } else {
        parameters = normalizeActionParametersFromSchema(this._specs, snapshot);
      }
      this.state = { functionId, parameters };
      this._emit();
      return this.state;
    }
    /**
     * @param {string} path parameter id
     * @param {any} value
     */
    async update(path, value) {
      if (this._disposed) return this.state;
      const spec = this._specs.find((s) => s.path === path);
      const fieldValue = spec ? normalizeControlValue(spec, value) : value;
      const functionId = this.state.functionId;
      const merged = { ...this.state.parameters, [path]: fieldValue };
      const def = functionId ? getFunctionDef(functionId) : null;
      const parameters = def ? normalizeFunctionParameters(functionId, merged) : normalizeActionParametersFromSchema(this._specs, merged);
      this.state = { functionId, parameters };
      if (this._persist) {
        try {
          await this._persist(functionId, path, parameters[path]);
        } catch {
        }
      }
      this._emit();
      return this.state;
    }
    dispose() {
      this._disposed = true;
      this._listeners.clear();
      this._persist = null;
      this._specs = [];
    }
  };
  function createActionConfigController() {
    return new ActionConfigController();
  }

  // extension/src/ui/select-menu.js
  init_constants();

  // extension/src/ui/popover-titlebar.js
  init_i18n();
  init_constants();

  // extension/src/ui/preview-open-actions.js
  init_constants();
  init_i18n();
  var TITLEBAR_BTN_STYLE = `
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  box-sizing: border-box;
  background: ${NCT_DARK_UI_BTN_GRADIENT};
  border: ${NCT_DARK_UI_BTN_BORDER};
  color: ${NCT_DARK_UI_COLORS.fg};
  font-size: 11px;
  font-weight: 500;
  font-family: ${KP_UI_FONT};
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  text-shadow: none;
  box-shadow: none;
  padding: 4px 8px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;
  min-width: 0;
  min-height: 0;
  height: auto;
  width: auto;
  position: relative;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
`;

  // extension/src/ui/popover-titlebar.js
  var VARIANT_STYLES = {
    modal: {
      titlebar: `
      padding: 10px 14px;
      background: ${NCT_DARK_UI_TITLEBAR_GRADIENT};
      border-bottom: ${NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM};
      box-shadow: ${NCT_DARK_UI_TITLEBAR_BOX_SHADOW};
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
      min-height: 40px;
      box-sizing: border-box;
      font-family: var(--kp-font-heading, ${KP_UI_FONT});
      font-size: 14px;
      font-weight: 400;
      font-style: normal;
      line-height: 1.3;
      letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
      text-transform: var(--kp-type-transform-titlebar, none);
      -webkit-font-smoothing: antialiased;
    `,
      title: `
      font-family: inherit;
      font-size: 14px;
      font-weight: var(--kp-titlebar-title-weight, 600);
      letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
      text-transform: var(--kp-type-transform-titlebar, none);
      color: var(--kp-color-fg, #e8e8e8);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex: 0 1 auto;
    `,
      hint: `
      font-family: inherit;
      color: #999;
      font-weight: normal;
      font-size: 12px;
      margin-left: 10px;
      flex-shrink: 0;
    `,
      close: `
      /* Host pages often style bare \`button\` (e.g. Slashdot margin-bottom:40px). */
      margin: 0;
      appearance: none;
      -webkit-appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      font-family: inherit;
      background: ${NCT_DARK_UI_BTN_GRADIENT};
      border: ${NCT_DARK_UI_BTN_BORDER};
      font-size: 18px;
      font-weight: 400;
      cursor: pointer;
      color: ${NCT_DARK_UI_COLORS.fg};
      padding: 2px 8px;
      line-height: 1;
      border-radius: ${NCT_DARK_UI_BTN_RADIUS};
      flex-shrink: 0;
      min-width: 0;
      min-height: 0;
      height: auto;
      width: auto;
      text-align: center;
      text-shadow: none;
      box-shadow: ${NCT_DARK_UI_ICON_BUTTON_OUTLINE};
      position: relative;
    `
    },
    preview: {
      titlebar: `
      padding: 6px 10px;
      background: ${NCT_DARK_UI_TITLEBAR_GRADIENT};
      border-bottom: ${NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM};
      box-shadow: ${NCT_DARK_UI_TITLEBAR_BOX_SHADOW};
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      min-height: 34px;
      box-sizing: border-box;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      font-family: var(--kp-font-heading, ${KP_UI_FONT});
      font-size: 12px;
      font-weight: 400;
      font-style: normal;
      line-height: 1.3;
      letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
      text-transform: var(--kp-type-transform-titlebar, none);
      -webkit-font-smoothing: antialiased;
    `,
      title: `
      font-family: inherit;
      font-size: 12px;
      font-weight: var(--kp-titlebar-title-weight, 600);
      letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
      text-transform: var(--kp-type-transform-titlebar, none);
      color: var(--kp-color-fg, #e8e8e8);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex: 0 1 auto;
    `,
      hint: `
      font-family: inherit;
      color: #999;
      font-weight: normal;
      font-size: 12px;
      margin-left: 8px;
      flex-shrink: 0;
    `,
      close: `
      /* Host pages often style bare \`button\` (e.g. Slashdot margin-bottom:40px). */
      margin: 0;
      appearance: none;
      -webkit-appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      font-family: inherit;
      background: ${NCT_DARK_UI_BTN_GRADIENT};
      border: ${NCT_DARK_UI_BTN_BORDER};
      font-size: 16px;
      font-weight: 400;
      cursor: pointer;
      color: ${NCT_DARK_UI_COLORS.fg};
      padding: 2px 6px;
      line-height: 1;
      border-radius: ${NCT_DARK_UI_BTN_RADIUS};
      flex-shrink: 0;
      min-width: 0;
      min-height: 0;
      height: auto;
      width: auto;
      text-align: center;
      text-shadow: none;
      box-shadow: ${NCT_DARK_UI_ICON_BUTTON_OUTLINE};
      position: relative;
    `
    },
    panel: {
      titlebar: `
      padding: 0 6px 0 10px;
      background: ${NCT_DARK_UI_TITLEBAR_GRADIENT};
      border-bottom: ${NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM};
      box-shadow: ${NCT_DARK_UI_TITLEBAR_BOX_SHADOW};
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      height: 28px;
      min-height: 28px;
      max-height: 28px;
      box-sizing: border-box;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      cursor: grab;
      font-family: var(--kp-font-heading, ${KP_UI_FONT});
      font-size: 11px;
      font-weight: 400;
      font-style: normal;
      line-height: 1.3;
      letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
      text-transform: var(--kp-type-transform-titlebar, none);
      -webkit-font-smoothing: antialiased;
    `,
      title: `
      font-family: inherit;
      font-size: 11px;
      font-weight: var(--kp-titlebar-title-weight, 600);
      letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
      text-transform: var(--kp-type-transform-titlebar, none);
      color: var(--kp-color-fg, ${NCT_DARK_UI_COLORS.fg});
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex: 0 1 auto;
      line-height: 28px;
    `,
      hint: `
      font-family: inherit;
      color: rgba(140, 145, 155, 0.95);
      font-weight: 500;
      font-size: 10px;
      margin-left: 8px;
      flex-shrink: 0;
      line-height: 28px;
    `,
      close: `
      margin: 0;
      appearance: none;
      -webkit-appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      font-family: inherit;
      background: transparent;
      border: none;
      font-size: 15px;
      font-weight: 400;
      cursor: pointer;
      color: rgba(200, 200, 205, 0.9);
      padding: 0;
      line-height: 20px;
      border-radius: 4px;
      flex-shrink: 0;
      min-width: 22px;
      min-height: 22px;
      height: 22px;
      width: 22px;
      text-align: center;
      text-shadow: none;
      box-shadow: ${NCT_DARK_UI_ICON_BUTTON_OUTLINE};
      position: relative;
    `
    }
  };
  var KBD_STYLE = `
  font-family: var(--kp-font-kbd, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
  font-size: var(--kp-type-kbd-size, 10px);
  padding: 1px 6px;
  border: var(--kp-kbd-border, ${NCT_DARK_UI_BTN_BORDER});
  border-radius: var(--kp-radius-btn, ${NCT_DARK_UI_BTN_RADIUS});
  background: var(--kp-kbd-bg, ${NCT_DARK_UI_BTN_GRADIENT});
  color: var(--kp-color-kbd-fg, ${NCT_DARK_UI_COLORS.fg});
  box-shadow: var(--kp-kbd-shadow, none);
  text-transform: var(--kp-kbd-transform, none);
  letter-spacing: var(--kp-kbd-tracking, 0.02em);
`;
  var SHORTCUT_KBD_STYLE = `
  ${KBD_STYLE}
  font-weight: 400;
  font-size: 10px;
  line-height: 1.2;
  margin-left: 6px;
  flex-shrink: 0;
  vertical-align: middle;
  box-sizing: border-box;
`;
  function createTitlebarKbd(doc = document, label = "") {
    const kbd = doc.createElement("kbd");
    kbd.className = "kp-titlebar-kbd";
    kbd.style.cssText = KBD_STYLE;
    kbd.textContent = String(label || "");
    return kbd;
  }
  function createTitlebarLeadingIcon(doc = document, iconId = "window") {
    const el2 = doc.createElement("span");
    el2.className = "kp-titlebar-icon";
    el2.setAttribute("aria-hidden", "true");
    const id = typeof iconId === "string" && iconId.trim() ? iconId.trim() : "window";
    el2.setAttribute("data-kp-titlebar-icon", id);
    el2.setAttribute("data-kp-theme-icon", id);
    try {
      const url = getThemeIconUrl(id, getActiveTheme());
      if (url) {
        const img = `url("${String(url).replace(/"/g, '\\"')}")`;
        el2.style.webkitMaskImage = img;
        el2.style.maskImage = img;
      }
    } catch {
    }
    return el2;
  }
  function normalizeTitlebarShortcutLabel(raw) {
    let label = raw != null ? String(raw).trim() : "";
    while (label.length >= 2 && label.startsWith("(") && label.endsWith(")") || label.length >= 2 && label.startsWith("[") && label.endsWith("]")) {
      label = label.slice(1, -1).trim();
    }
    return label;
  }
  function createTitlebarShortcut(doc = document, shortcut = "") {
    const kbd = doc.createElement("kbd");
    kbd.className = "kpv2-popover-titlebar-shortcut";
    kbd.setAttribute("data-kp-titlebar-shortcut", "true");
    kbd.style.cssText = SHORTCUT_KBD_STYLE;
    const label = normalizeTitlebarShortcutLabel(shortcut);
    kbd.textContent = label;
    if (!label) kbd.style.display = "none";
    return kbd;
  }

  // extension/src/ui/select-menu.js
  var STYLE_ATTR = "data-kp-select-menu-style";
  var SELECT_LIST_HOST_CSS = `
:host {
  all: initial;
  display: block !important;
  position: fixed !important;
  z-index: ${Z_INDEX.SELECT_MENU} !important;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  overflow: visible !important;
  clip-path: none !important;
  pointer-events: none;
}
:host([hidden]) {
  display: none !important;
}
.kp-select-menu {
  pointer-events: auto;
}
`.trim();
  var _idSeq = 0;
  function readComposedSurface(el2) {
    let node = el2;
    try {
      while (node) {
        const surface = node.getAttribute?.("data-kp-surface");
        if (surface) return String(surface);
        const next = node.parentElement;
        if (next) {
          node = next;
          continue;
        }
        const root = node.getRootNode?.();
        node = root && root !== node && root.host ? root.host : null;
      }
    } catch {
    }
    return "";
  }
  function getBodyMount(doc) {
    try {
      const d = doc?.defaultView?.document || doc || document;
      return d.body || d.documentElement || null;
    } catch {
      return document.body || document.documentElement || null;
    }
  }
  function ensureSelectMenuStyles(root) {
    if (!root) return;
    injectChromeStyles(root, {
      attr: STYLE_ATTR,
      css: `${getTitlebarChromeCss()}
${getSelectMenuCss()}`
    });
  }
  function createSelectIcon(doc, iconId, className) {
    const id = typeof iconId === "string" && iconId.trim() ? iconId.trim() : "";
    if (!id) return null;
    const el2 = doc.createElement("span");
    el2.className = className;
    el2.setAttribute("aria-hidden", "true");
    el2.setAttribute("data-kp-theme-icon", id);
    try {
      const url = getThemeIconUrl(id, getActiveTheme());
      if (url) {
        const img = `url("${String(url).replace(/"/g, '\\"')}")`;
        el2.style.webkitMaskImage = img;
        el2.style.maskImage = img;
      }
    } catch {
    }
    return el2;
  }
  function themeListHost(list) {
    try {
      const theme = getActiveTheme();
      applyThemeDataset(list, theme);
      applyThemeCssVars(list, theme);
    } catch {
    }
  }
  function createSelectMenu(config = {}) {
    const doc = config.doc || document;
    const variant = config.variant === "field" ? "field" : "titlebar";
    const listId = `kp-select-list-${++_idSeq}`;
    let options = Array.isArray(config.options) ? config.options.slice() : [];
    let currentValue = config.value != null ? String(config.value) : null;
    let disabled = false;
    let fallbackOpen = false;
    let listHost = null;
    const root = doc.createElement("div");
    root.className = `kp-select kp-select--${variant}${config.className ? ` ${config.className}` : ""}`;
    root.setAttribute("data-kp-select", "true");
    const trigger = doc.createElement("button");
    trigger.type = "button";
    trigger.className = "kp-select-trigger";
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", listId);
    if (config.ariaLabel) trigger.setAttribute("aria-label", config.ariaLabel);
    const triggerIcon = doc.createElement("span");
    triggerIcon.className = "kp-select-trigger-icon";
    triggerIcon.setAttribute("aria-hidden", "true");
    triggerIcon.hidden = true;
    const triggerLabel = doc.createElement("span");
    triggerLabel.className = "kp-select-trigger-label";
    const chevron = doc.createElement("span");
    chevron.className = "kp-select-chevron";
    chevron.setAttribute("aria-hidden", "true");
    trigger.appendChild(triggerIcon);
    trigger.appendChild(triggerLabel);
    trigger.appendChild(chevron);
    root.appendChild(trigger);
    const list = doc.createElement("div");
    list.id = listId;
    list.className = "kp-select-menu";
    list.setAttribute("role", "listbox");
    if (config.ariaLabel) list.setAttribute("aria-label", config.ariaLabel);
    try {
      list.style.setProperty("position", "fixed", "important");
    } catch {
    }
    try {
      list.style.setProperty("z-index", String(Z_INDEX.SELECT_MENU), "important");
    } catch {
      list.style.zIndex = String(Z_INDEX.SELECT_MENU);
    }
    list.setAttribute("data-kp-select-fallback", "true");
    list.hidden = true;
    try {
      list.style.setProperty("display", "none", "important");
    } catch {
    }
    const stopDrag = (e) => {
      try {
        e.stopPropagation();
      } catch {
      }
    };
    trigger.addEventListener("pointerdown", stopDrag, true);
    trigger.addEventListener("mousedown", stopDrag, true);
    list.addEventListener("pointerdown", stopDrag, true);
    list.addEventListener("mousedown", stopDrag, true);
    const choiceOptions = () => options.filter((o) => o && o.type !== "group" && o.type !== "separator" && o.value != null);
    const findChoice = (value) => choiceOptions().find((o) => String(o.value) === String(value)) || null;
    const syncTrigger = () => {
      const choice = findChoice(currentValue);
      const label = choice?.label != null ? String(choice.label) : currentValue ? String(currentValue) : "";
      triggerLabel.textContent = label;
      const iconId = choice?.icon;
      let showIcon = false;
      if (iconId) {
        try {
          triggerIcon.setAttribute("data-kp-theme-icon", iconId);
          const url = getThemeIconUrl(iconId, getActiveTheme());
          if (url) {
            const img = `url("${String(url).replace(/"/g, '\\"')}")`;
            triggerIcon.style.webkitMaskImage = img;
            triggerIcon.style.maskImage = img;
            showIcon = true;
          }
        } catch {
        }
      }
      if (!showIcon) {
        triggerIcon.removeAttribute("data-kp-theme-icon");
        triggerIcon.style.webkitMaskImage = "";
        triggerIcon.style.maskImage = "";
      }
      triggerIcon.hidden = !showIcon;
    };
    const isListOpen = () => fallbackOpen;
    const setExpanded = (open) => {
      try {
        trigger.setAttribute("aria-expanded", open ? "true" : "false");
      } catch {
      }
      try {
        root.classList.toggle("is-open", !!open);
      } catch {
      }
    };
    const positionList = () => {
      let tr;
      try {
        tr = trigger.getBoundingClientRect();
      } catch {
        return;
      }
      if (!tr) return;
      const minW = Math.max(tr.width, variant === "titlebar" ? 190 : 160);
      list.style.minWidth = `${Math.round(minW)}px`;
      list.style.left = `${Math.round(tr.left)}px`;
      list.style.top = `${Math.round(tr.bottom + 4)}px`;
      let lr;
      try {
        lr = list.getBoundingClientRect();
      } catch {
        return;
      }
      const spaceBelow = window.innerHeight - tr.bottom;
      const openUp = lr.height + 8 > spaceBelow && tr.top > spaceBelow;
      if (openUp) {
        list.style.top = `${Math.max(8, Math.round(tr.top - lr.height - 4))}px`;
      }
      try {
        lr = list.getBoundingClientRect();
      } catch {
        return;
      }
      if (lr.right > window.innerWidth - 8) {
        list.style.left = `${Math.max(8, Math.round(window.innerWidth - lr.width - 8))}px`;
      }
      if (lr.left < 8) list.style.left = "8px";
    };
    const setHostOpen = (open) => {
      if (!listHost) return;
      listHost.hidden = !open;
      try {
        if (open) listHost.style.removeProperty("display");
        else listHost.style.setProperty("display", "none", "important");
      } catch {
      }
    };
    const closeFallback = () => {
      fallbackOpen = false;
      list.hidden = true;
      try {
        list.style.setProperty("display", "none", "important");
      } catch {
      }
      setHostOpen(false);
      setExpanded(false);
      try {
        doc.removeEventListener("pointerdown", onDocPointerDown, true);
      } catch {
      }
    };
    const onDocPointerDown = (e) => {
      const path = typeof e.composedPath === "function" ? e.composedPath() : [];
      if (path.includes(list) || path.includes(trigger) || path.includes(root)) return;
      closeFallback();
    };
    const syncListSurface = () => {
      const surface = readComposedSurface(trigger) || readComposedSurface(root);
      try {
        if (surface) {
          list.setAttribute("data-kp-surface", surface);
          listHost?.setAttribute("data-kp-surface", surface);
        } else {
          list.removeAttribute("data-kp-surface");
          listHost?.removeAttribute("data-kp-surface");
        }
      } catch {
      }
    };
    const openList = () => {
      if (disabled) return;
      mountList();
      syncListSurface();
      if (listHost) themeListHost(listHost);
      themeListHost(list);
      fallbackOpen = true;
      setHostOpen(true);
      list.hidden = false;
      try {
        list.style.setProperty("display", "block", "important");
      } catch {
      }
      setExpanded(true);
      positionList();
      try {
        doc.addEventListener("pointerdown", onDocPointerDown, true);
      } catch {
      }
    };
    const closeList = () => {
      closeFallback();
    };
    const toggleList = () => {
      if (isListOpen()) closeList();
      else openList();
    };
    const pickValue = (value) => {
      const next = String(value);
      const prev = currentValue;
      currentValue = next;
      paintSelection();
      syncTrigger();
      closeList();
      if (typeof config.onChange === "function" && next !== prev) {
        try {
          config.onChange(next, prev);
        } catch {
        }
      }
    };
    const paintSelection = () => {
      const items = list.querySelectorAll(".kp-select-item");
      for (const btn of items) {
        const selected = btn.getAttribute("data-kp-select-value") === String(currentValue);
        try {
          btn.setAttribute("aria-selected", selected ? "true" : "false");
        } catch {
        }
        try {
          btn.classList.toggle("is-active", false);
        } catch {
        }
      }
    };
    const rebuildList = () => {
      while (list.firstChild) list.removeChild(list.firstChild);
      for (const opt of options) {
        if (!opt) continue;
        if (opt.type === "separator") {
          const hr = doc.createElement("div");
          hr.className = "kp-select-separator";
          hr.setAttribute("role", "separator");
          list.appendChild(hr);
          continue;
        }
        if (opt.type === "group") {
          const g = doc.createElement("div");
          g.className = "kp-select-group";
          g.textContent = String(opt.label || "");
          list.appendChild(g);
          continue;
        }
        if (opt.value == null) continue;
        const value = String(opt.value);
        const btn = doc.createElement("button");
        btn.type = "button";
        btn.className = "kp-select-item";
        btn.setAttribute("role", "option");
        btn.setAttribute("data-kp-select-value", value);
        btn.setAttribute("aria-selected", value === String(currentValue) ? "true" : "false");
        if (opt.disabled) btn.disabled = true;
        const icon = createSelectIcon(doc, opt.icon, "kp-select-item-icon");
        if (icon) btn.appendChild(icon);
        const lab = doc.createElement("span");
        lab.className = "kp-select-item-label";
        lab.textContent = String(opt.label || value);
        btn.appendChild(lab);
        if (opt.shortcut) {
          const kbd = createTitlebarKbd(doc, opt.shortcut);
          btn.appendChild(kbd);
        }
        btn.addEventListener("click", (e) => {
          try {
            e.preventDefault();
            e.stopPropagation();
          } catch {
          }
          if (btn.disabled) return;
          pickValue(value);
        });
        btn.addEventListener("pointerdown", stopDrag, true);
        list.appendChild(btn);
      }
      paintSelection();
      syncTrigger();
    };
    trigger.addEventListener("click", (e) => {
      try {
        e.stopPropagation();
      } catch {
      }
      try {
        e.preventDefault();
      } catch {
      }
      if (disabled) return;
      toggleList();
    });
    trigger.addEventListener("keydown", (e) => {
      const key2 = e?.key;
      if (key2 === "ArrowDown" || key2 === "Enter" || key2 === " ") {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch {
        }
        if (!isListOpen()) openList();
      } else if (key2 === "Escape" && isListOpen()) {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch {
        }
        closeList();
      }
    });
    list.addEventListener("keydown", (e) => {
      if (e?.key === "Escape") {
        try {
          e.preventDefault();
        } catch {
        }
        closeList();
        try {
          trigger.focus();
        } catch {
        }
      }
    });
    const ensureListHost = () => {
      if (listHost) return listHost;
      listHost = doc.createElement("div");
      listHost.className = "kp-select-menu-host";
      listHost.setAttribute("data-kp-select", "true");
      listHost.hidden = true;
      try {
        listHost.style.setProperty("display", "none", "important");
      } catch {
      }
      const shadow = ensureOpenChromeShadow(listHost, { id: "select-menu" });
      try {
        listHost.removeAttribute("data-kp-corner");
      } catch {
      }
      try {
        listHost.classList.remove("kp-chrome-window");
      } catch {
      }
      if (shadow) {
        injectChromeStyles(shadow, {
          attr: STYLE_ATTR,
          css: `${SELECT_LIST_HOST_CSS}
${getTitlebarChromeCss()}
${getSelectMenuCss()}`
        });
        try {
          shadow.appendChild(list);
        } catch {
        }
      } else {
        try {
          listHost.appendChild(list);
        } catch {
        }
      }
      themeListHost(listHost);
      themeListHost(list);
      syncListSurface();
      return listHost;
    };
    const mountList = () => {
      const host = ensureListHost();
      const parent = getBodyMount(doc);
      if (parent && host.parentNode !== parent) {
        try {
          parent.appendChild(host);
        } catch {
        }
      }
    };
    const triggerRoot = () => {
      try {
        return trigger.getRootNode?.() || null;
      } catch {
        return null;
      }
    };
    rebuildList();
    mountList();
    try {
      const rn = triggerRoot();
      if (rn && rn !== doc) ensureSelectMenuStyles(rn);
    } catch {
    }
    return {
      root,
      list,
      trigger,
      getValue() {
        return currentValue;
      },
      setValue(value, opts = {}) {
        currentValue = value != null ? String(value) : null;
        paintSelection();
        syncTrigger();
        if (!opts.silent && typeof config.onChange === "function") {
          try {
            config.onChange(currentValue, null);
          } catch {
          }
        }
      },
      setOptions(next) {
        options = Array.isArray(next) ? next.slice() : [];
        rebuildList();
      },
      setDisabled(next) {
        disabled = !!next;
        trigger.disabled = disabled;
        if (disabled) closeList();
      },
      open: openList,
      close: closeList,
      destroy() {
        closeList();
        try {
          doc.removeEventListener("pointerdown", onDocPointerDown, true);
        } catch {
        }
        try {
          listHost?.remove();
        } catch {
          try {
            listHost?.parentNode?.removeChild(listHost);
          } catch {
          }
        }
        listHost = null;
        try {
          list.remove();
        } catch {
          try {
            list.parentNode?.removeChild(list);
          } catch {
          }
        }
        try {
          root.remove();
        } catch {
        }
      }
    };
  }
  function enhanceNativeSelect(select, opts = {}) {
    if (!select || select.dataset?.kpSelectEnhanced === "true") return null;
    const doc = select.ownerDocument || document;
    const options = Array.from(select.options || []).map((option) => ({
      value: String(option.value),
      label: String(option.textContent || option.label || option.value),
      disabled: !!option.disabled
    }));
    const menu = createSelectMenu({
      doc,
      ariaLabel: select.getAttribute("aria-label") || void 0,
      value: select.value,
      variant: opts.variant === "titlebar" ? "titlebar" : "field",
      className: opts.className || select.className || "",
      options,
      onChange: (value) => {
        select.value = value;
        try {
          select.dispatchEvent(new Event("change", { bubbles: true }));
        } catch {
          try {
            select.dispatchEvent(new doc.defaultView.Event("change", { bubbles: true }));
          } catch {
          }
        }
      }
    });
    select.dataset.kpSelectEnhanced = "true";
    select.setAttribute("aria-hidden", "true");
    try {
      select.style.setProperty("display", "none", "important");
    } catch {
    }
    try {
      select.parentNode?.insertBefore(menu.root, select.nextSibling);
    } catch {
    }
    menu.setDisabled(!!select.disabled);
    let observer = null;
    const api = {
      ...menu,
      syncFromNative() {
        menu.setOptions(Array.from(select.options || []).map((option) => ({
          value: String(option.value),
          label: String(option.textContent || option.label || option.value),
          disabled: !!option.disabled
        })));
        menu.setValue(select.value, { silent: true });
        menu.setDisabled(!!select.disabled);
      },
      destroy() {
        try {
          observer?.disconnect?.();
        } catch {
        }
        observer = null;
        menu.destroy();
      }
    };
    try {
      const target = doc.documentElement || doc.body;
      if (target && typeof MutationObserver !== "undefined") {
        observer = new MutationObserver(() => {
          if (!select.isConnected) api.destroy();
        });
        observer.observe(target, { childList: true, subtree: true });
      }
    } catch {
    }
    select._kpSelectMenu = api;
    return api;
  }

  // extension/src/modules/action-config-binder.js
  init_i18n();
  function appendActionConfigFields(host, ctx) {
    if (!host || !ctx?.controller) return;
    const { controller } = ctx;
    const live = ctx.live !== false;
    const classes = ctx.classes || {};
    const listenOpts = ctx.signal ? { signal: ctx.signal, capture: true } : { capture: true };
    const values = controller.state?.parameters || {};
    for (const { group, specs } of groupActionControlSpecs(controller.schema())) {
      if (group) {
        const heading = host.ownerDocument.createElement("div");
        if (classes.group) heading.className = classes.group;
        heading.textContent = group;
        heading.style.marginTop = "8px";
        heading.style.fontWeight = "600";
        host.appendChild(heading);
      }
      for (const spec of specs) {
        host.appendChild(renderField(host.ownerDocument, spec, values[spec.path], {
          controller,
          live,
          classes,
          listenOpts
        }));
      }
    }
  }
  function renderField(doc, spec, current, ctx) {
    const { controller, live, classes, listenOpts } = ctx;
    const row2 = doc.createElement("div");
    if (classes.row) row2.className = classes.row;
    else row2.style.cssText = "display:flex;flex-direction:column;gap:4px;";
    const label = doc.createElement(spec.type === "toggle" ? "div" : "label");
    if (classes.label) label.className = classes.label;
    label.textContent = spec.label || spec.path;
    row2.appendChild(label);
    const applyControlClass = spec.type !== "toggle" || classes.applyControlClassToToggle;
    let control;
    const widget = spec.widget || (spec.type === "radio" ? "radio" : spec.type === "select" ? "select" : null);
    if (spec.type === "toggle") {
      const input = doc.createElement("input");
      input.type = "checkbox";
      input.checked = !!current;
      input.addEventListener("change", () => {
        void controller.update(spec.path, !!input.checked);
      }, listenOpts);
      control = input;
    } else if (spec.type === "radio" || widget === "radio") {
      const wrap = doc.createElement("div");
      wrap.setAttribute("role", "radiogroup");
      wrap.setAttribute("aria-label", spec.label || spec.path);
      const name = `kp-action-${spec.path}`;
      for (const optionDef of spec.options || []) {
        const optLabel = doc.createElement("label");
        const radio = doc.createElement("input");
        radio.type = "radio";
        radio.name = name;
        radio.value = optionDef.id;
        radio.checked = optionDef.id === current;
        radio.addEventListener("change", () => {
          if (!radio.checked) return;
          void controller.update(spec.path, radio.value);
        }, listenOpts);
        optLabel.appendChild(radio);
        optLabel.appendChild(doc.createTextNode(optionDef.label));
        wrap.appendChild(optLabel);
      }
      control = wrap;
    } else if (spec.type === "enum" || spec.type === "select" || widget === "select") {
      const select = doc.createElement("select");
      for (const optionDef of spec.options || []) {
        const option = doc.createElement("option");
        option.value = optionDef.id;
        option.textContent = optionDef.label;
        option.selected = optionDef.id === current;
        select.appendChild(option);
      }
      select.addEventListener("change", () => {
        void controller.update(spec.path, select.value);
      }, listenOpts);
      control = select;
    } else if (spec.type === "range") {
      const input = doc.createElement("input");
      input.type = "number";
      if (spec.min != null) input.min = String(spec.min);
      if (spec.max != null) input.max = String(spec.max);
      if (spec.step != null) input.step = String(spec.step);
      input.value = current != null ? String(current) : "";
      const commit = () => {
        const n = Number(input.value);
        void controller.update(spec.path, Number.isFinite(n) ? n : spec.defaultValue);
      };
      input.addEventListener("change", commit, listenOpts);
      if (live) input.addEventListener("input", commit, listenOpts);
      control = input;
    } else if (spec.type === "stringList") {
      control = renderStringList(doc, spec, current, ctx);
    } else if (spec.type === "bookmarkFolder") {
      control = renderBookmarkFolderPicker(doc, spec, current, ctx);
    } else if (spec.type === "textarea" || spec.multiline) {
      const textarea = doc.createElement("textarea");
      textarea.setAttribute("data-multiline", "true");
      const rows = Number(spec.rows);
      textarea.rows = Number.isFinite(rows) && rows > 0 ? rows : 3;
      textarea.value = current == null ? "" : String(current);
      const commit = () => {
        void controller.update(spec.path, textarea.value);
      };
      textarea.addEventListener("change", commit, listenOpts);
      if (live) textarea.addEventListener("input", commit, listenOpts);
      control = textarea;
    } else {
      const input = doc.createElement("input");
      input.type = "text";
      input.value = current == null ? "" : String(current);
      const commit = () => {
        void controller.update(spec.path, input.value);
      };
      input.addEventListener("change", commit, listenOpts);
      if (live) input.addEventListener("input", commit, listenOpts);
      control = input;
    }
    if (spec.type !== "stringList" && spec.type !== "bookmarkFolder" && applyControlClass && classes.control && "className" in control) {
      control.className = classes.control;
    }
    if (spec.placeholder && "placeholder" in control) {
      control.placeholder = String(spec.placeholder);
    }
    row2.appendChild(control);
    if (control?.tagName === "SELECT") {
      enhanceNativeSelect(
        /** @type {HTMLSelectElement} */
        control
      );
    }
    return row2;
  }
  function renderStringList(doc, spec, current, ctx) {
    if (spec.presentation === "table") return renderStringListTable(doc, spec, current, ctx);
    const { controller, live, classes, listenOpts } = ctx;
    const maxItems = Number.isFinite(spec.maxItems) && spec.maxItems > 0 ? spec.maxItems : 20;
    const wrap = doc.createElement("div");
    wrap.className = "kp-cfg-url-list";
    wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;";
    const rows = doc.createElement("div");
    rows.style.cssText = "display:flex;flex-direction:column;gap:4px;";
    wrap.appendChild(rows);
    const addBtn = doc.createElement("button");
    addBtn.type = "button";
    addBtn.className = "kp-cfg-btn";
    addBtn.textContent = spec.addLabel || "Add URL";
    const commit = () => {
      const values = [...rows.querySelectorAll("input")].map((input) => input.value);
      void controller.update(spec.path, values);
    };
    const syncAddEnabled = () => {
      addBtn.disabled = rows.childElementCount >= maxItems;
    };
    const addRow = (value) => {
      if (rows.childElementCount >= maxItems) return;
      const line = doc.createElement("div");
      line.style.cssText = "display:flex;gap:4px;align-items:center;";
      const input = doc.createElement("input");
      input.type = "text";
      input.inputMode = "url";
      input.spellcheck = false;
      input.autocomplete = "off";
      input.value = value == null ? "" : String(value);
      if (classes.control) input.className = classes.control;
      input.style.flex = "1";
      input.style.minWidth = "0";
      input.style.width = "auto";
      if (spec.placeholder) input.placeholder = String(spec.placeholder);
      input.addEventListener("change", commit, listenOpts);
      if (live) input.addEventListener("input", commit, listenOpts);
      const remove = doc.createElement("button");
      remove.type = "button";
      remove.className = "kp-cfg-btn";
      remove.textContent = "\xD7";
      remove.setAttribute("aria-label", spec.removeLabel || "Remove URL");
      remove.title = spec.removeLabel || "Remove URL";
      remove.addEventListener("click", () => {
        line.remove();
        if (!rows.childElementCount) addRow("");
        syncAddEnabled();
        commit();
      }, listenOpts);
      line.appendChild(input);
      line.appendChild(remove);
      rows.appendChild(line);
      syncAddEnabled();
    };
    const initial = Array.isArray(current) ? current.filter((item) => String(item || "").trim()) : [];
    if (initial.length) {
      for (const value of initial) addRow(value);
    } else {
      addRow("");
    }
    addBtn.addEventListener("click", () => {
      addRow("");
      const inputs = rows.querySelectorAll("input");
      const last = inputs[inputs.length - 1];
      if (last) last.focus();
    }, listenOpts);
    wrap.appendChild(addBtn);
    syncAddEnabled();
    return wrap;
  }
  function renderStringListTable(doc, spec, current, ctx) {
    const { controller, live, classes, listenOpts } = ctx;
    const maxItems = Number.isFinite(spec.maxItems) && spec.maxItems > 0 ? spec.maxItems : 20;
    const visibleRows = Number.isFinite(spec.visibleRows) && spec.visibleRows > 0 ? spec.visibleRows : 5;
    const wrap = doc.createElement("div");
    wrap.className = "kp-string-table";
    const scroller = doc.createElement("div");
    scroller.className = "kp-string-table-scroll";
    scroller.style.maxHeight = `calc(${visibleRows} * var(--kp-string-table-row, 30px))`;
    scroller.style.overflowY = "auto";
    const table = doc.createElement("table");
    const tbody = doc.createElement("tbody");
    table.appendChild(tbody);
    scroller.appendChild(table);
    wrap.appendChild(scroller);
    const addBtn = doc.createElement("button");
    addBtn.type = "button";
    addBtn.className = "kp-cfg-btn kp-string-table-add";
    addBtn.textContent = spec.addLabel || "Add URL";
    const commit = () => {
      const values = [...tbody.querySelectorAll("input")].map((input) => input.value);
      void controller.update(spec.path, values);
    };
    const syncAddEnabled = () => {
      addBtn.disabled = tbody.childElementCount >= maxItems;
    };
    const addRow = (value) => {
      if (tbody.childElementCount >= maxItems) return;
      const tr = doc.createElement("tr");
      const valueCell = doc.createElement("td");
      const input = doc.createElement("input");
      input.type = "text";
      input.inputMode = "url";
      input.spellcheck = false;
      input.autocomplete = "off";
      input.value = value == null ? "" : String(value);
      if (classes.control) input.className = classes.control;
      if (spec.placeholder) input.placeholder = String(spec.placeholder);
      input.addEventListener("change", commit, listenOpts);
      if (live) input.addEventListener("input", commit, listenOpts);
      valueCell.appendChild(input);
      const removeCell = doc.createElement("td");
      const remove = doc.createElement("button");
      remove.type = "button";
      remove.className = "kp-cfg-btn kp-string-table-remove";
      remove.textContent = "\xD7";
      remove.setAttribute("aria-label", spec.removeLabel || "Remove URL");
      remove.title = spec.removeLabel || "Remove URL";
      remove.addEventListener("click", () => {
        tr.remove();
        if (!tbody.childElementCount) addRow("");
        syncAddEnabled();
        commit();
      }, listenOpts);
      removeCell.appendChild(remove);
      tr.appendChild(valueCell);
      tr.appendChild(removeCell);
      tbody.appendChild(tr);
      syncAddEnabled();
    };
    const initial = Array.isArray(current) ? current.filter((item) => String(item || "").trim()) : [];
    if (initial.length) {
      for (const value of initial) addRow(value);
    } else {
      addRow("");
    }
    addBtn.addEventListener("click", () => {
      addRow("");
      const inputs = tbody.querySelectorAll("input");
      const last = inputs[inputs.length - 1];
      if (last) last.focus();
      if (tbody.childElementCount > visibleRows) {
        try {
          scroller.scrollTop = scroller.scrollHeight;
        } catch {
        }
      }
    }, listenOpts);
    wrap.appendChild(addBtn);
    syncAddEnabled();
    return wrap;
  }
  async function fetchBookmarkFolders() {
    try {
      const response = await chrome.runtime.sendMessage({ type: MSG.LIST_BOOKMARK_FOLDERS });
      if (response && response.type === MSG.BOOKMARK_FOLDERS && Array.isArray(response.folders)) {
        return response.folders.filter((folder) => folder && folder.id && folder.path);
      }
    } catch {
    }
    return [];
  }
  function renderBookmarkFolderPicker(doc, spec, current, ctx) {
    const { controller, classes, listenOpts } = ctx;
    let selectedId = current == null ? "" : String(current);
    const wrap = doc.createElement("div");
    wrap.className = "kp-bookmark-folder-list";
    const filter = doc.createElement("input");
    filter.type = "text";
    filter.autocomplete = "off";
    filter.spellcheck = false;
    filter.placeholder = spec.placeholder || getMessage("fn_param_bookmark_folder_filter") || "Filter folders";
    filter.setAttribute("aria-label", filter.placeholder);
    if (classes.control) filter.className = classes.control;
    const scroller = doc.createElement("div");
    scroller.className = "kp-bookmark-folder-scroll";
    scroller.style.maxHeight = "calc(5 * var(--kp-string-table-row, 30px))";
    scroller.style.overflowY = "auto";
    scroller.setAttribute("role", "listbox");
    scroller.setAttribute("aria-label", spec.label || "Folder");
    const hint = doc.createElement("div");
    hint.className = "kp-bookmark-folder-hint";
    hint.textContent = spec.hint || getMessage("fn_param_bookmark_folder_hint") || "Opens the first 30 website bookmarks in this folder.";
    let folders = [];
    const allLabel = getMessage("fn_param_bookmark_folder_all") || "All bookmarks";
    const appendAll = (needle) => {
      if (!spec.allowAll) return false;
      if (needle && !allLabel.toLowerCase().includes(needle)) return false;
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "kp-bookmark-folder-btn";
      btn.dataset.folderId = "";
      btn.textContent = allLabel;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", selectedId === "" ? "true" : "false");
      btn.addEventListener("click", () => {
        selectedId = "";
        scroller.querySelectorAll(".kp-bookmark-folder-btn").forEach((el2) => {
          el2.setAttribute("aria-selected", el2 === btn ? "true" : "false");
        });
        void controller.update(spec.path, "");
      }, listenOpts);
      scroller.appendChild(btn);
      return true;
    };
    const paint = (query) => {
      const needle = String(query || "").trim().toLowerCase();
      scroller.replaceChildren();
      const matches = folders.filter((folder) => !needle || folder.path.toLowerCase().includes(needle));
      const showedAll = appendAll(needle);
      if (!folders.length) {
        if (showedAll) return;
        const empty = doc.createElement("div");
        empty.className = "kp-bookmark-folder-status";
        empty.textContent = getMessage("fn_param_bookmark_folder_empty") || "No bookmark folders";
        scroller.appendChild(empty);
        return;
      }
      if (selectedId && !folders.some((folder) => folder.id === selectedId) && !needle) {
        const missing = doc.createElement("button");
        missing.type = "button";
        missing.className = "kp-bookmark-folder-btn";
        missing.setAttribute("aria-pressed", "true");
        missing.textContent = getMessage("fn_param_bookmark_folder_missing") || "Folder not found";
        scroller.appendChild(missing);
      }
      if (!matches.length) {
        const empty = doc.createElement("div");
        empty.className = "kp-bookmark-folder-status";
        empty.textContent = getMessage("fn_param_bookmark_folder_empty") || "No bookmark folders";
        scroller.appendChild(empty);
        return;
      }
      for (const folder of matches) {
        const btn = doc.createElement("button");
        btn.type = "button";
        btn.className = "kp-bookmark-folder-btn";
        btn.dataset.folderId = folder.id;
        btn.textContent = folder.path;
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-selected", folder.id === selectedId ? "true" : "false");
        btn.addEventListener("click", () => {
          selectedId = folder.id;
          scroller.querySelectorAll(".kp-bookmark-folder-btn").forEach((el2) => {
            el2.setAttribute("aria-selected", el2 === btn ? "true" : "false");
          });
          void controller.update(spec.path, folder.id);
        }, listenOpts);
        scroller.appendChild(btn);
      }
    };
    filter.addEventListener("input", () => paint(filter.value), listenOpts);
    const loading = doc.createElement("div");
    loading.className = "kp-bookmark-folder-status";
    loading.textContent = getMessage("fn_param_bookmark_folder_loading") || "Loading folders\u2026";
    scroller.appendChild(loading);
    wrap.appendChild(filter);
    wrap.appendChild(scroller);
    wrap.appendChild(hint);
    void fetchBookmarkFolders().then((next) => {
      if (!wrap.isConnected) return;
      folders = next;
      paint(filter.value);
    });
    return wrap;
  }

  // extension/src/ui/key-action-settings.js
  var MODE_PARAMETER_ID = "mode";
  var DESTINATION_PARAMETER_ID = "destination";
  var INLINE_ENUM_PARAMETER_IDS = Object.freeze(["mode", "action", "format", "destination"]);
  function getActionSettingsDef(actionId) {
    const def = getFunctionDef(actionId);
    if (!def || !def.parameters || def.parameters.length === 0) return null;
    const modeParam = def.parameters.find((p) => p && p.id === MODE_PARAMETER_ID && p.type === "enum");
    return {
      modes: modeParam ? modeParam.options : void 0,
      defaultMode: modeParam ? modeParam.defaultValue : void 0,
      parameters: def.parameters
    };
  }
  function actionHasModes(actionId) {
    const def = getActionSettingsDef(actionId);
    return !!(def?.modes && def.modes.length > 0);
  }
  function nonModeParameters(actionId) {
    const def = getActionSettingsDef(actionId);
    return (def?.parameters || []).filter((p) => p && p.id !== MODE_PARAMETER_ID);
  }
  function configPanelParameters(actionId) {
    return nonModeParameters(actionId).filter(
      (p) => p && !INLINE_ENUM_PARAMETER_IDS.includes(p.id) && shouldShowFunctionParameter(actionId, p)
    );
  }
  function getActionInlineEnumDefs(actionId) {
    const def = getActionSettingsDef(actionId);
    return (def?.parameters || []).filter(
      (p) => p && p.type === "enum" && INLINE_ENUM_PARAMETER_IDS.includes(p.id)
    );
  }
  function getActionDestinationDef(actionId) {
    const def = getActionSettingsDef(actionId);
    const param = def?.parameters?.find((p) => p && p.id === DESTINATION_PARAMETER_ID && p.type === "enum");
    return param || null;
  }
  function actionHasParameters(actionId) {
    return configPanelParameters(actionId).length > 0;
  }
  function actionHasDestination(actionId) {
    return !!getActionDestinationDef(actionId);
  }
  function getActionMode(parameters, actionId) {
    const def = getActionSettingsDef(actionId);
    const fallback = def?.defaultMode || def?.modes?.[0]?.id || "element";
    const stored = parameters?.[MODE_PARAMETER_ID];
    if (typeof stored === "string" && def?.modes?.some((m) => m.id === stored)) {
      return stored;
    }
    return fallback;
  }
  function getActionParameter(parameters, actionId, paramId) {
    const def = getActionSettingsDef(actionId);
    const paramDef = def?.parameters?.find((p) => p && p.id === paramId) || null;
    const stored = parameters?.[paramId];
    if (stored !== void 0) return stored;
    return paramDef ? paramDef.defaultValue : void 0;
  }
  async function setActionMode(actionId, modeId) {
    const def = getActionSettingsDef(actionId);
    if (!def?.modes?.some((m) => m.id === modeId)) {
      throw new Error(`Unknown mode ${modeId} for action ${actionId}`);
    }
    const action = await setBuiltinFunctionUserActionParameter(actionId, MODE_PARAMETER_ID, modeId);
    notifyActionSettingsChanged(actionId, action);
    return action;
  }
  async function setActionParameter(actionId, paramId, value) {
    const action = await setBuiltinFunctionUserActionParameter(actionId, paramId, value);
    notifyActionSettingsChanged(actionId, action);
    return action;
  }
  function notifyActionSettingsChanged(actionId, action) {
    try {
      document.dispatchEvent(new CustomEvent("keypilot:action-settings-changed", {
        detail: { actionId, action }
      }));
    } catch {
    }
  }
  var CONFIG_PANEL_STYLE_ATTR = "data-kp-action-config-style";
  function ensureConfigPanelStyles(root) {
    injectChromeStyles(root, { attr: CONFIG_PANEL_STYLE_ATTR, css: `
:host {
  position: fixed;
  z-index: ${Z_INDEX.KEY_ACTION_CONFIG || Z_INDEX.KEYBINDINGS_POPOVER + 1};
  min-width: 240px;
  max-width: min(360px, calc(100vw - 24px));
  color: ${NCT_DARK_UI_COLORS.fg};
  font-family: ${KP_UI_FONT};
  font-size: 12px;
  line-height: 1.4;
  border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
  border: ${NCT_DARK_UI_PANEL_BORDER};
  background: ${NCT_DARK_UI_PANEL_BACKGROUND};
  box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
  box-sizing: border-box;
}
:host([hidden]) { display: none !important; }
.kp-action-config-panel__titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  cursor: grab;
  user-select: none;
  background: ${NCT_DARK_UI_TITLEBAR_GRADIENT};
  border-bottom: ${NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM};
  letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
  text-transform: var(--kp-type-transform-titlebar, none);
}
.kp-action-config-panel__title {
  font-weight: var(--kp-titlebar-title-weight, 600);
  font-size: 12px;
  letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
  text-transform: var(--kp-type-transform-titlebar, none);
  color: var(--kp-color-fg, inherit);
}
.kp-action-config-panel__close {
  appearance: none;
  background: ${NCT_DARK_UI_BTN_GRADIENT};
  border: ${NCT_DARK_UI_BTN_BORDER};
  color: inherit;
  width: 22px;
  height: 22px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.kp-action-config-panel__body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.kp-action-config-panel__row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kp-action-config-panel__label {
  opacity: 0.85;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.kp-action-config-panel__control {
  appearance: none;
  width: 100%;
  box-sizing: border-box;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  border: ${NCT_DARK_UI_FIELD_BORDER};
  background: ${NCT_DARK_UI_FIELD_BACKGROUND};
  box-shadow: ${NCT_DARK_UI_FIELD_BOX_SHADOW};
  color: inherit;
  padding: 6px 8px;
  font: inherit;
}
.kp-action-config-panel__control:focus {
  outline: none;
  border-color: ${NCT_DARK_UI_FIELD_FOCUS_BORDER};
  box-shadow: ${NCT_DARK_UI_FIELD_FOCUS_BOX_SHADOW};
}
.kp-action-config-panel__control[data-multiline="true"] {
  min-height: 64px;
  resize: vertical;
  line-height: 1.35;
}
.kp-action-config-panel__empty {
  opacity: 0.7;
  font-style: italic;
}
` });
  }
  var KeyActionConfigPanel = class {
    constructor() {
      this.root = null;
      this.shadowRoot = null;
      this.actionId = null;
      this._dragApi = null;
      this.onSettingsChanged = null;
    }
    /**
     * @param {string} actionId
     * @param {{ title?: string, anchorRect?: DOMRect|null }} [opts]
     */
    async open(actionId, opts = {}) {
      const def = getActionSettingsDef(actionId);
      if (!def) return;
      const doc = document;
      this.actionId = actionId;
      if (!this.root) {
        this.root = doc.createElement("div");
        this.root.className = "kp-action-config-panel";
        this.root.setAttribute("role", "dialog");
        this.shadowRoot = ensureOpenChromeShadow(this.root, { id: "action-config", chromeWindow: true });
        const panelRoot2 = this.shadowRoot || this.root;
        ensureConfigPanelStyles(panelRoot2);
        panelRoot2.innerHTML = `
        <div class="kp-action-config-panel__titlebar" data-kp-config-drag="true">
          <div class="kp-action-config-panel__title"></div>
          <button type="button" class="kp-action-config-panel__close" aria-label="Close">\xD7</button>
        </div>
        <div class="kp-action-config-panel__body"></div>
      `;
        doc.body.appendChild(this.root);
        const closeBtn = panelRoot2.querySelector(".kp-action-config-panel__close");
        closeBtn?.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.close();
        });
        const handle = panelRoot2.querySelector('[data-kp-config-drag="true"]');
        this._dragApi = makePanelDraggable(this.root, handle, {
          excludeSelector: ".kp-action-config-panel__close"
        });
      }
      const panelRoot = this.shadowRoot || this.root.shadowRoot || this.root;
      ensureConfigPanelStyles(panelRoot);
      const titleEl = panelRoot.querySelector(".kp-action-config-panel__title");
      if (titleEl) titleEl.textContent = opts.title || `${actionId} settings`;
      await this._renderBody(actionId, def);
      this.root.hidden = false;
      const margin = 12;
      const vw = window.innerWidth || 800;
      const vh = window.innerHeight || 600;
      const rect = opts.anchorRect;
      let left = rect ? rect.right + 10 : Math.round(vw * 0.5 - 120);
      let top = rect ? rect.top : Math.round(vh * 0.25);
      left = Math.max(margin, Math.min(left, vw - margin - 240));
      top = Math.max(margin, Math.min(top, vh - margin - 80));
      this.root.style.left = `${Math.round(left)}px`;
      this.root.style.top = `${Math.round(top)}px`;
      this.root.style.right = "auto";
      this.root.style.bottom = "auto";
    }
    close() {
      if (this.root) this.root.hidden = true;
      this.actionId = null;
    }
    isOpen() {
      return !!(this.root && !this.root.hidden);
    }
    /**
     * @param {string} actionId
     * @param {ActionSettingsDef} def
     */
    async _renderBody(actionId, def) {
      const panelRoot = this.shadowRoot || this.root?.shadowRoot || this.root;
      const body = panelRoot?.querySelector(".kp-action-config-panel__body");
      if (!body) return;
      body.replaceChildren();
      const action = await getOrCreateBuiltinFunctionUserAction(actionId);
      const storedParams = action?.parameters || {};
      const params = configPanelParameters(actionId);
      if (params.length === 0) {
        const empty = document.createElement("div");
        empty.className = "kp-action-config-panel__empty";
        empty.textContent = "No configurable parameters for this key.";
        body.appendChild(empty);
        return;
      }
      if (actionId === "EXECUTE_JS") {
        const hint = document.createElement("div");
        hint.className = "kp-action-config-panel__empty";
        hint.textContent = "Bindings: kpHoveredClickable, kpHoverLeaf, kpFocusedTextField, kpMode, kpPageUrl, kpSelection, kpPriorResult. Callbacks are functions only when checked. See Keyboard Layout Editor Inspector \u2192 docs icon, or Execute JS in KeyPilot Docs.";
        body.appendChild(hint);
      }
      const controller = createActionConfigController();
      controller.load({
        functionId: actionId,
        snapshot: storedParams,
        parameters: params,
        persist: async (functionId, paramId, value) => {
          const next = await setActionParameter(functionId, paramId, value);
          try {
            this.onSettingsChanged?.(next);
          } catch {
          }
          return next;
        }
      });
      appendActionConfigFields(body, {
        controller,
        live: false,
        classes: {
          row: "kp-action-config-panel__row",
          label: "kp-action-config-panel__label",
          control: "kp-action-config-panel__control",
          group: "kp-action-config-panel__label",
          applyControlClassToToggle: true
        }
      });
    }
    dispose() {
      try {
        this._dragApi?.dispose?.();
      } catch {
      }
      this._dragApi = null;
      try {
        this.root?.remove();
      } catch {
      }
      this.root = null;
      this.shadowRoot = null;
      this.actionId = null;
    }
  };
  var _sharedConfigPanel = null;
  function getSharedKeyActionConfigPanel() {
    if (!_sharedConfigPanel) {
      _sharedConfigPanel = new KeyActionConfigPanel();
    }
    return _sharedConfigPanel;
  }

  // extension/src/ui/keybindings-ui.js
  init_stock_actions();
  init_keyboard_layouts();

  // extension/src/ui/instance-settings.js
  init_keyboard_layouts();
  init_stock_actions();
  init_i18n();
  function renderInstanceSettingsForm(host, { functionDef, instance, onDraft }) {
    if (!host || !functionDef) return;
    const doc = host.ownerDocument || document;
    host.replaceChildren();
    const parameters = { ...instance?.parameters || {} };
    if (Array.isArray(parameters.urls)) parameters.urls = parameters.urls.slice();
    const draft = {
      label: String(instance?.label || ""),
      parameters
    };
    const emit = () => {
      onDraft?.({
        label: draft.label,
        parameters: { ...draft.parameters }
      });
    };
    const nameRow = doc.createElement("div");
    nameRow.className = "kp-popover-setting-row";
    const nameLabel = doc.createElement("div");
    nameLabel.className = "kp-popover-setting-label";
    nameLabel.textContent = getMessage("fn_instance_name_label") || "Name";
    const nameInput = doc.createElement("input");
    nameInput.type = "text";
    nameInput.className = "kp-popover-field";
    nameInput.value = draft.label;
    nameInput.autocomplete = "off";
    nameInput.spellcheck = false;
    nameInput.setAttribute("aria-label", nameLabel.textContent);
    nameInput.addEventListener("input", () => {
      draft.label = nameInput.value;
      emit();
    });
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(nameInput);
    host.appendChild(nameRow);
    const controller = createActionConfigController();
    controller.load({
      functionId: functionDef.id,
      snapshot: draft.parameters,
      parameters: functionDef.parameters,
      persist: (_functionId, paramId, value) => {
        draft.parameters = { ...draft.parameters, [paramId]: value };
        emit();
      }
    });
    appendActionConfigFields(host, {
      controller,
      live: true,
      classes: {
        row: "kp-popover-setting-row",
        label: "kp-popover-setting-label",
        control: "kp-popover-field"
      }
    });
  }
  function familyBaseLabel(builtinLayoutId) {
    try {
      const inferred = inferFamilyAndHandednessFromLayoutId(builtinLayoutId);
      const familyId = normalizeKeyboardLayoutFamilyId(inferred.familyId || "browsing");
      const meta = (BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META || []).find((m) => m && m.id === familyId);
      return getMessage(
        familyId === "basic-navigation" ? "layout_family_basic_navigation_label" : meta?.labelKey || "layout_family_browsing_label"
      ) || "Browsing";
    } catch {
      return getMessage("layout_family_browsing_label") || "Browsing";
    }
  }
  async function retargetInstanceSlot(kp, keyEl, toId, fromId) {
    if (!kp || !toId) return false;
    const code = keyEl?.dataset?.kpPhysicalCode || "";
    const slotKey = keyEl?.dataset?.kpSlot || (code ? physicalSlotKeyForCode(code) : "");
    const sel = String(kp._currentKeyboardLayoutId || "");
    let layout = null;
    if (sel.startsWith("user:") && kp._currentUserLayout && `user:${kp._currentUserLayout.id}` === sel) {
      layout = kp._currentUserLayout;
    } else {
      const builtinLayoutId = kp._keyboardLayoutId || "browsing-right";
      const layouts = await listUserKeyboardLayouts();
      const label = nextUserCopyLayoutLabel(familyBaseLabel(builtinLayoutId), layouts);
      layout = await duplicateBuiltinLayoutToUserLayout({ builtinLayoutId, label });
    }
    if (!layout) return false;
    const slots = { ...layout.slots || {} };
    if (slotKey) {
      slots[slotKey] = { type: "function", id: toId };
    } else {
      let found = false;
      for (const [key2, value] of Object.entries(slots)) {
        if (value && value.type === "function" && value.id === fromId) {
          slots[key2] = { type: "function", id: toId };
          found = true;
        }
      }
      if (!found) return false;
    }
    const savedLayout = await upsertUserKeyboardLayout({ ...layout, slots });
    const actions = await listUserActions();
    if (typeof kp.applyLiveUserLayout === "function") {
      await kp.applyLiveUserLayout(savedLayout, {
        setAsCurrent: true,
        actions,
        macros: kp._currentUserMacros,
        rerender: false
      });
    }
    try {
      await kp.floatingKeyboardHelp?._refreshLayoutSelectOptions?.();
    } catch {
    }
    return true;
  }
  async function commitInstanceSettings({
    getKeyPilot,
    instanceId,
    functionId,
    label,
    parameters,
    keyEl
  }) {
    const kp = typeof getKeyPilot === "function" ? getKeyPilot() : null;
    if (isStockActionId(instanceId)) {
      const stock = getStockActionById(instanceId);
      if (!stock || !kp) return null;
      const created = await createUserAction({
        functionId: stock.functionId,
        label: label || stock.label,
        parameters
      });
      if (!created) return null;
      const rebound = await retargetInstanceSlot(kp, keyEl || null, created.id, stock.id);
      if (!rebound) return null;
      return created;
    }
    const saved = await upsertUserAction({
      id: instanceId,
      functionId,
      label,
      parameters
    });
    if (saved && kp) {
      try {
        const actions = await listUserActions();
        kp._currentUserActions = actions;
        if (kp.floatingKeyboardHelp) kp.floatingKeyboardHelp._currentUserActions = actions;
      } catch {
      }
    }
    return saved;
  }
  function instanceIdForKey(keyEl, actionId) {
    const fromData = keyEl?.dataset?.kpInstanceId || "";
    if (fromData) return fromData;
    const id = String(actionId || "");
    if (isStockActionId(id) || id.startsWith("action:")) return id;
    return "";
  }

  // extension/src/ui/keybindings-ui.js
  init_i18n();
  var _activePopoverContext = null;
  var _pinnedActionId = null;
  var _pinnedKeyEl = null;
  var _settingsRenderGen = 0;
  var KEY_INFO_POPOVER_INNER_HTML = `
      <div class="kp-popover-head">
        <div class="kp-popover-icon" aria-hidden="true"></div>
        <div class="kp-popover-title-wrap">
          <div class="kp-popover-title-row">
            <div class="kp-popover-title"></div>
            <div class="kp-popover-settings-hint" hidden></div>
          </div>
          <div class="kp-popover-keys"></div>
        </div>
      </div>
      <p class="kp-popover-desc"></p>
      <div class="kp-popover-settings" hidden></div>
    `;
  function settingsFunctionId(actionId) {
    const stock = getStockActionById(actionId);
    return stock?.functionId || actionId;
  }
  function actionHasSettings(actionId) {
    const id = settingsFunctionId(actionId);
    return actionHasModes(id) || actionHasDestination(id) || getActionInlineEnumDefs(id).length > 0 || actionHasParameters(id);
  }
  function getRuntimeFontUrls() {
    try {
      const getURL = typeof chrome !== "undefined" && chrome && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL.bind(chrome.runtime) : null;
      if (!getURL) return null;
      return {
        robotech: getURL("fonts/ROBOTECHGPRegular.ttf"),
        titillium: getURL("fonts/TitilliumTextRegular.otf"),
        titilliumBold: getURL("fonts/TitilliumTextBold.ttf"),
        cubellan: getURL("fonts/CubellanRegular.ttf"),
        ezarion: getURL("fonts/EzarionRegular.ttf"),
        dosis: getURL("fonts/DosisBook.ttf")
      };
    } catch {
      return null;
    }
  }
  function getStyleCss() {
    return getKeybindingsUiCss({
      zKeybindingsPopover: Z_INDEX.KEYBINDINGS_POPOVER,
      fontUrls: getRuntimeFontUrls()
    });
  }
  function ensureStylesInjected(root = document) {
    const fontUrls = getRuntimeFontUrls();
    const css = getStyleCss();
    const attrName = typeof KEYBINDINGS_UI_STYLE_ATTR === "string" && KEYBINDINGS_UI_STYLE_ATTR ? KEYBINDINGS_UI_STYLE_ATTR : "data-kp-keybindings-ui-style";
    injectChromeStyles(root, { attr: attrName, css });
    try {
      const doc = root && root.nodeType === 9 ? root : root?.ownerDocument || document;
      preloadKeybindingsUiFonts(doc, fontUrls);
      if (doc && fontUrls) {
        injectChromeStyles(doc, {
          attr: KEYBINDINGS_UI_FONT_STYLE_ATTR,
          css: getKeybindingsUiFontFaceCss(fontUrls)
        });
      }
    } catch {
    }
  }
  function clearElement(el2) {
    while (el2 && el2.firstChild) el2.removeChild(el2.firstChild);
  }
  function el(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function updateExistingKeyboardDOM({ container, keybindings }) {
    const doc = container.ownerDocument || document;
    try {
      container.querySelectorAll(".key:not([data-kp-action-id]) > .key-bg-icon").forEach((el2) => {
        try {
          el2.remove();
        } catch {
        }
      });
    } catch {
    }
    try {
      container.querySelectorAll(".key").forEach((keyEl) => {
        ensureKeyPressOverlay(doc, keyEl);
      });
    } catch {
    }
    const actionEls = container.querySelectorAll("[data-kp-action-id]");
    if (!actionEls || actionEls.length === 0) return false;
    for (const keyEl of actionEls) {
      const actionId = keyEl.dataset.kpActionId;
      const binding = keybindings && keybindings[actionId];
      const baseClass = keyEl.dataset.kpBaseClass || "key";
      const keyboardClass = binding && binding.keyboardClass ? String(binding.keyboardClass) : "";
      keyEl.className = `${baseClass}${keyboardClass ? " " + keyboardClass : ""}`;
      ensureKeyBackgroundIcon(doc, keyEl);
      ensureKeyPressOverlay(doc, keyEl);
      const title = binding && (binding.description || binding.label) || actionId;
      try {
        keyEl.removeAttribute("title");
      } catch {
      }
      keyEl.setAttribute("aria-label", title);
      const main = keyEl.querySelector(".key-main");
      if (main) main.textContent = binding && binding.label || actionId;
      const labelText = localizeKeycapLabel(binding && (binding.displayKey || binding.keyLabel) || "");
      const existingLabel = keyEl.querySelector(".key-label");
      if (labelText) {
        if (existingLabel) existingLabel.textContent = labelText;
        else keyEl.appendChild(el(doc, "div", "key-label", labelText));
      } else if (existingLabel) {
        existingLabel.remove();
      }
    }
    return true;
  }
  function renderKeybindingsKeyboard({
    container,
    keybindings,
    keyboardLayout,
    layoutId,
    hardwareLayoutId,
    attachPopovers = true,
    pinOnClick = true,
    getKeyPilot
  } = {}) {
    if (!container) return;
    const doc = container.ownerDocument || document;
    ensureStylesInjected(container.getRootNode?.() || doc);
    const layout = keyboardLayout && Array.isArray(keyboardLayout) ? keyboardLayout : KEYBINDINGS_KEYBOARD_LAYOUT;
    const layoutKey = [
      typeof layoutId === "string" ? layoutId : "",
      typeof hardwareLayoutId === "string" ? hardwareLayoutId : ""
    ].filter(Boolean).join(":");
    let existingVisual = null;
    try {
      existingVisual = container.querySelector(":scope > .keyboard-visual");
    } catch {
      try {
        existingVisual = container.querySelector(".keyboard-visual");
      } catch {
      }
    }
    if (existingVisual && existingVisual.dataset && existingVisual.dataset.kpKeyboardBuilt === "true") {
      const existingLayoutKey = String(existingVisual.dataset.kpLayoutId || "");
      const canReuse = !!layoutKey && existingLayoutKey === layoutKey;
      if (canReuse) {
        if (updateExistingKeyboardDOM({ container, keybindings })) {
          if (attachPopovers) {
            attachKeyPopoverBehavior({ root: container, keybindings, getKeyPilot, pinOnClick });
          } else {
            detachKeyPopoverBehavior(container);
          }
          return;
        }
      }
    }
    clearElement(container);
    const visual = el(doc, "div", `keyboard-visual ${KEYBINDINGS_UI_ROOT_CLASS}`);
    visual.dataset.kpKeyboardBuilt = "true";
    if (layoutKey) visual.dataset.kpLayoutId = layoutKey;
    container.appendChild(visual);
    for (const row2 of layout) {
      const rowEl = el(doc, "div", "keyboard-row");
      visual.appendChild(rowEl);
      for (const item of row2) {
        if (item.type === "special") {
          const keyEl2 = el(doc, "div", item.className || "key");
          if (item.code) keyEl2.dataset.kpPhysicalCode = String(item.code);
          keyEl2.appendChild(el(doc, "span", "key-text", localizeKeycapLabel(item.text)));
          ensureKeyPressOverlay(doc, keyEl2);
          rowEl.appendChild(keyEl2);
          continue;
        }
        if (item.type === "key") {
          const keyEl2 = el(doc, "div", item.className || "key");
          if (item.code) keyEl2.dataset.kpPhysicalCode = String(item.code);
          keyEl2.appendChild(el(doc, "span", "key-text", item.text));
          ensureKeyPressOverlay(doc, keyEl2);
          rowEl.appendChild(keyEl2);
          continue;
        }
        const binding = keybindings && keybindings[item.id];
        const baseClass = item.className || "key";
        const className = `${baseClass}${binding && binding.keyboardClass ? " " + binding.keyboardClass : ""}`;
        const keyEl = el(doc, "button", className);
        keyEl.dataset.kpActionId = item.id;
        if (instanceIdForKey(null, item.id)) keyEl.dataset.kpInstanceId = item.id;
        keyEl.dataset.kpBaseClass = baseClass;
        if (item.code) keyEl.dataset.kpPhysicalCode = String(item.code);
        keyEl.type = "button";
        keyEl.tabIndex = -1;
        try {
          keyEl.removeAttribute("title");
        } catch {
        }
        keyEl.setAttribute(
          "aria-label",
          binding && (binding.description || binding.label) || item.fallbackText || item.id
        );
        ensureKeyBackgroundIcon(doc, keyEl);
        const main = el(
          doc,
          "div",
          "key-main",
          binding && binding.label || item.fallbackText || item.id
        );
        keyEl.appendChild(main);
        const labelText = localizeKeycapLabel(
          item.legend || binding && binding.displayKey || binding && binding.keyLabel || ""
        );
        if (labelText) {
          keyEl.appendChild(el(doc, "div", "key-label", labelText));
        }
        ensureKeyPressOverlay(doc, keyEl);
        rowEl.appendChild(keyEl);
      }
    }
    if (attachPopovers) {
      attachKeyPopoverBehavior({
        root: container,
        keybindings,
        getKeyPilot,
        pinOnClick
      });
    } else {
      detachKeyPopoverBehavior(container);
    }
  }
  function detachKeyPopoverBehavior(root) {
    if (!root || !root._kpKeyHandlers) return;
    try {
      unpinKeyPopover();
    } catch {
    }
    const keyElements = root.querySelectorAll("[data-kp-action-id]");
    const h = root._kpKeyHandlers;
    keyElements.forEach((keyEl) => {
      try {
        if (h.enter) keyEl.removeEventListener("pointerenter", h.enter);
        if (h.leave) keyEl.removeEventListener("pointerleave", h.leave);
        if (h.focusin) keyEl.removeEventListener("focusin", h.focusin);
        if (h.focusout) keyEl.removeEventListener("focusout", h.focusout);
        if (h.click) keyEl.removeEventListener("click", h.click);
      } catch {
      }
    });
    try {
      if (h.docKeydown) document.removeEventListener("keydown", h.docKeydown, true);
      if (h.docPointerDown) document.removeEventListener("pointerdown", h.docPointerDown, true);
      if (h.resize) window.removeEventListener("resize", h.resize, true);
    } catch {
    }
    root._kpKeyHandlers = null;
    try {
      if (_activePopoverContext && _activePopoverContext.root === root) {
        _activePopoverContext = null;
      }
    } catch {
    }
  }
  function supportsPopoverApi(el2) {
    try {
      return !!(el2 && typeof el2.showPopover === "function" && typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype);
    } catch {
      return false;
    }
  }
  function ensurePopover(doc, _container) {
    ensureStylesInjected(doc);
    if (!doc || !doc.body) return null;
    let pop = doc.body.querySelector('.kp-keybindings-popover[data-kp-key-info-popover="true"]') || doc.body.querySelector(".kp-keybindings-popover");
    if (!pop) {
      try {
        const legacy = doc.querySelector(".kp-floating-keyboard-help .kp-keybindings-popover");
        if (legacy) {
          pop = legacy;
          doc.body.appendChild(pop);
        }
      } catch {
      }
    }
    if (!pop) {
      pop = doc.createElement("div");
      pop.className = "kp-keybindings-popover";
      pop.setAttribute("data-kp-key-info-popover", "true");
      pop.setAttribute("data-placement", "top");
      pop.setAttribute("role", "tooltip");
      pop.innerHTML = KEY_INFO_POPOVER_INNER_HTML;
      doc.body.appendChild(pop);
      try {
        pop.hidden = true;
      } catch {
      }
      try {
        pop.removeAttribute("data-kp-popover-open");
      } catch {
      }
    } else {
      try {
        pop.setAttribute("data-kp-key-info-popover", "true");
      } catch {
      }
      if (pop.parentElement !== doc.body) {
        try {
          doc.body.appendChild(pop);
        } catch {
        }
      }
      if (!pop.querySelector(".kp-popover-icon")) {
        try {
          pop.setAttribute("role", "tooltip");
          pop.innerHTML = KEY_INFO_POPOVER_INNER_HTML;
        } catch {
        }
      }
      if (!pop.querySelector(".kp-popover-settings")) {
        try {
          const settingsHost = doc.createElement("div");
          settingsHost.className = "kp-popover-settings";
          settingsHost.hidden = true;
          pop.appendChild(settingsHost);
        } catch {
        }
      }
      if (!pop.querySelector(".kp-popover-settings-hint")) {
        try {
          const titleEl = pop.querySelector(".kp-popover-title");
          const wrap = pop.querySelector(".kp-popover-title-wrap") || titleEl?.parentElement;
          if (wrap && titleEl) {
            let row2 = wrap.querySelector(".kp-popover-title-row");
            if (!row2) {
              row2 = doc.createElement("div");
              row2.className = "kp-popover-title-row";
              wrap.insertBefore(row2, titleEl);
              row2.appendChild(titleEl);
            }
            const hint = doc.createElement("div");
            hint.className = "kp-popover-settings-hint";
            hint.hidden = true;
            hint.textContent = getMessage("key_info_settings_hint");
            row2.appendChild(hint);
          }
        } catch {
        }
      }
    }
    try {
      if (supportsPopoverApi(pop) && pop.popover !== "manual") {
        pop.popover = "manual";
      }
    } catch {
      try {
        if (!pop.hasAttribute("popover")) pop.setAttribute("popover", "manual");
      } catch {
      }
    }
    return pop;
  }
  function hidePopover(pop, opts = {}) {
    if (!pop) return;
    try {
      pop._kpFlushInstanceSettings?.();
    } catch {
    }
    try {
      pop._kpFlushInstanceSettings = null;
    } catch {
    }
    try {
      pop.classList.remove("kp-popover-has-instance-settings");
    } catch {
    }
    if (opts.clearPinned !== false) {
      _pinnedActionId = null;
      _pinnedKeyEl = null;
      _settingsRenderGen += 1;
      try {
        pop.removeAttribute("data-kp-popover-pinned");
      } catch {
      }
      try {
        pop.style.pointerEvents = "";
      } catch {
      }
    }
    try {
      if (supportsPopoverApi(pop) && typeof pop.hidePopover === "function") {
        try {
          if (pop.matches?.(":popover-open")) pop.hidePopover();
        } catch {
          try {
            pop.hidePopover();
          } catch {
          }
        }
      }
    } catch {
    }
    try {
      pop.hidden = true;
    } catch {
    }
    try {
      pop.removeAttribute("data-kp-popover-open");
    } catch {
    }
    try {
      const iconEl = pop.querySelector(".kp-popover-icon");
      if (iconEl) {
        iconEl.style.backgroundImage = "";
        iconEl.style.webkitMaskImage = "";
        iconEl.style.maskImage = "";
        iconEl.style.backgroundColor = "";
        iconEl.hidden = true;
      }
      ["--kp-key-face", "--kp-key-mid", "--kp-key-deep", "--kp-key-icon"].forEach((prop) => {
        try {
          pop.style.removeProperty(prop);
        } catch {
        }
      });
      const settingsHost = pop.querySelector(".kp-popover-settings");
      if (settingsHost) {
        settingsHost.hidden = true;
        settingsHost.replaceChildren();
      }
    } catch {
    }
  }
  function openPopoverElement(pop) {
    if (!pop) return;
    try {
      pop.hidden = false;
    } catch {
    }
    try {
      pop.setAttribute("data-kp-popover-open", "true");
    } catch {
    }
    if (supportsPopoverApi(pop) && typeof pop.showPopover === "function") {
      try {
        if (!pop.matches?.(":popover-open")) pop.showPopover();
      } catch {
        try {
          pop.showPopover();
        } catch {
        }
      }
    }
  }
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
  function applyKeyMaterialToPopover(pop, targetEl) {
    if (!pop || !targetEl) return;
    try {
      const cs = (targetEl.ownerDocument || document).defaultView?.getComputedStyle?.(targetEl);
      if (!cs) return;
      const face = (cs.getPropertyValue("--kp-key-face") || "").trim();
      const mid = (cs.getPropertyValue("--kp-key-mid") || "").trim();
      const deep = (cs.getPropertyValue("--kp-key-deep") || "").trim();
      const icon = (cs.getPropertyValue("--kp-key-icon") || "").trim();
      if (face) pop.style.setProperty("--kp-key-face", face);
      if (mid) pop.style.setProperty("--kp-key-mid", mid);
      if (deep) pop.style.setProperty("--kp-key-deep", deep);
      if (icon) pop.style.setProperty("--kp-key-icon", icon);
    } catch {
    }
  }
  function instancePopoverTitle(targetEl, actionId, binding) {
    const keycapLabel = (targetEl.querySelector(".key-main")?.textContent || "").trim();
    const plain = keycapLabel || binding && binding.label || actionId;
    const instanceId = instanceIdForKey(targetEl, actionId);
    if (!instanceId) return plain;
    const stock = getStockActionById(instanceId);
    const functionId = stock?.functionId || (getFunctionDef(actionId) ? actionId : settingsFunctionId(actionId));
    const typeLabel = String(getFunctionDef(functionId)?.label || "").trim();
    const name = keycapLabel || String(stock?.label || "").trim();
    if (!name || !typeLabel || name === typeLabel) return plain;
    return getMessage("key_info_instance_title", [name, typeLabel]) || `${name} : ${typeLabel}`;
  }
  function showPopoverForTarget({ doc, pop, targetEl, binding, actionId, pinned = false, settingsHint = true }) {
    if (!doc || !pop || !targetEl) return;
    const titleEl = pop.querySelector(".kp-popover-title");
    const keysEl = pop.querySelector(".kp-popover-keys");
    const descEl = pop.querySelector(".kp-popover-desc");
    const iconEl = pop.querySelector(".kp-popover-icon");
    const hintEl = pop.querySelector(".kp-popover-settings-hint");
    const keycapLabel = (targetEl.querySelector(".key-main")?.textContent || "").trim();
    const title = pinned ? keycapLabel || binding && binding.label || actionId : instancePopoverTitle(targetEl, actionId, binding);
    const keys = binding && (binding.displayKey || binding.keyLabel) || "";
    const desc = binding && (binding.description || binding.label) || "";
    const iconMaskUri = getActionIconDataUri(settingsFunctionId(actionId), { fill: "black" });
    applyKeyMaterialToPopover(pop, targetEl);
    if (titleEl) titleEl.textContent = title;
    if (keysEl) keysEl.textContent = keys ? getMessage("key_info_key", localizeKeycapLabel(keys)) : "";
    if (descEl) descEl.textContent = desc;
    if (hintEl) {
      hintEl.textContent = getMessage("key_info_settings_hint");
      const showHint = settingsHint && !pinned && actionHasSettings(actionId);
      hintEl.hidden = !showHint;
    }
    if (iconEl) {
      if (iconMaskUri) {
        iconEl.hidden = false;
        iconEl.style.backgroundImage = "none";
        iconEl.style.backgroundColor = "var(--kp-key-icon)";
        iconEl.style.webkitMaskImage = iconMaskUri;
        iconEl.style.maskImage = iconMaskUri;
        iconEl.style.webkitMaskRepeat = "no-repeat";
        iconEl.style.maskRepeat = "no-repeat";
        iconEl.style.webkitMaskPosition = "center";
        iconEl.style.maskPosition = "center";
        iconEl.style.webkitMaskSize = "62% 62%";
        iconEl.style.maskSize = "62% 62%";
      } else {
        iconEl.hidden = true;
        iconEl.style.backgroundImage = "";
        iconEl.style.webkitMaskImage = "";
        iconEl.style.maskImage = "";
        iconEl.style.backgroundColor = "";
      }
    }
    try {
      if (pinned) {
        pop.setAttribute("data-kp-popover-pinned", "true");
        pop.style.pointerEvents = "auto";
        void renderPopoverSettings({ doc, pop, targetEl, binding, actionId });
      } else {
        _settingsRenderGen += 1;
        pop.removeAttribute("data-kp-popover-pinned");
        pop.classList.remove("kp-popover-has-instance-settings");
        pop.style.pointerEvents = "";
        try {
          pop._kpFlushInstanceSettings?.();
        } catch {
        }
        try {
          pop._kpFlushInstanceSettings = null;
        } catch {
        }
        const settingsHost = pop.querySelector(".kp-popover-settings");
        if (settingsHost) {
          settingsHost.hidden = true;
          settingsHost.replaceChildren();
        }
      }
    } catch {
    }
    positionKeyInfoPopover(doc, pop, targetEl);
  }
  function positionKeyInfoPopover(doc, pop, targetEl) {
    if (!doc || !pop || !targetEl) return;
    const targetRect = targetEl.getBoundingClientRect();
    openPopoverElement(pop);
    const placeAt = (leftPx, topPx) => {
      try {
        try {
          pop.style.removeProperty("inset");
        } catch {
        }
        pop.style.setProperty("position", "fixed", "important");
        pop.style.setProperty("margin", "0", "important");
        pop.style.setProperty("right", "auto", "important");
        pop.style.setProperty("bottom", "auto", "important");
        pop.style.setProperty("left", `${Math.round(leftPx)}px`, "important");
        pop.style.setProperty("top", `${Math.round(topPx)}px`, "important");
      } catch {
        try {
          pop.style.removeProperty("inset");
        } catch {
        }
        pop.style.position = "fixed";
        pop.style.margin = "0";
        pop.style.right = "auto";
        pop.style.bottom = "auto";
        pop.style.left = `${Math.round(leftPx)}px`;
        pop.style.top = `${Math.round(topPx)}px`;
      }
    };
    const margin = 10;
    const gap = 10;
    placeAt(-9999, -9999);
    const popRect = pop.getBoundingClientRect();
    const popW = popRect.width || pop.offsetWidth || 160;
    const popH = popRect.height || pop.offsetHeight || 80;
    const vw = Math.max(
      doc.documentElement?.clientWidth || 0,
      (typeof window !== "undefined" ? window.innerWidth : 0) || 0
    );
    const vh = Math.max(
      doc.documentElement?.clientHeight || 0,
      (typeof window !== "undefined" ? window.innerHeight : 0) || 0
    );
    const spaceAbove = targetRect.top;
    const spaceBelow = vh - targetRect.bottom;
    const needs = popH + gap + margin;
    const placeAbove = spaceAbove >= needs || spaceAbove >= spaceBelow && spaceAbove >= gap + 24;
    const placement = placeAbove ? "top" : "bottom";
    pop.setAttribute("data-placement", placement);
    const targetCenterX = targetRect.left + targetRect.width / 2;
    let left = targetCenterX - popW / 2;
    const maxLeft = Math.max(margin, vw - margin - popW);
    left = clamp(left, margin, maxLeft);
    let top;
    if (placement === "top") {
      top = targetRect.top - gap - popH;
      if (top < margin) top = margin;
    } else {
      top = targetRect.bottom + gap;
      const maxTop = Math.max(margin, vh - margin - popH);
      if (top > maxTop) top = maxTop;
    }
    placeAt(left, top);
    const arrowLeft = clamp(targetCenterX - left - 9, 12, Math.max(12, popW - 24));
    pop.style.setProperty("--kp-arrow-left", `${Math.round(arrowLeft)}px`);
  }
  function paintPopoverSettings({ doc, pop, targetEl, binding, actionId, parameters }) {
    const host = pop.querySelector(".kp-popover-settings");
    if (!host) return;
    const inlineEnums = getActionInlineEnumDefs(actionId);
    const hasModes = actionHasModes(actionId);
    const hasDestination = actionHasDestination(actionId);
    const hasParams = actionHasParameters(actionId);
    if (!inlineEnums.length && !hasModes && !hasDestination && !hasParams) {
      host.hidden = true;
      host.replaceChildren();
      return;
    }
    host.hidden = false;
    host.replaceChildren();
    const enums = inlineEnums.length ? inlineEnums : [
      ...hasModes ? [{ id: "mode", ...getActionSettingsDef(actionId) || {} }] : [],
      ...hasDestination ? [getActionDestinationDef(actionId)].filter(Boolean) : []
    ];
    for (const param of enums) {
      if (!param || !param.id) continue;
      const options = param.options || (param.id === "mode" ? getActionSettingsDef(actionId)?.modes : null) || [];
      if (!options.length) continue;
      const current = param.id === "mode" ? getActionMode(parameters, actionId) : getActionParameter(parameters, actionId, param.id);
      const row2 = doc.createElement("div");
      row2.className = "kp-popover-setting-row";
      const label = doc.createElement("div");
      label.className = "kp-popover-setting-label";
      label.textContent = param.label || param.id;
      row2.appendChild(label);
      const wrap = doc.createElement("div");
      wrap.className = "kp-popover-mode-switch";
      wrap.setAttribute("role", "group");
      wrap.setAttribute("aria-label", param.label || param.id);
      wrap.dataset.paramId = param.id;
      for (const opt of options) {
        const btn = doc.createElement("button");
        btn.type = "button";
        btn.className = "kp-popover-mode-btn";
        btn.dataset.optionId = opt.id;
        btn.textContent = opt.label;
        btn.setAttribute("aria-pressed", opt.id === current ? "true" : "false");
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            if (param.id === "mode") await setActionMode(actionId, opt.id);
            else await setActionParameter(actionId, param.id, opt.id);
            wrap.querySelectorAll(".kp-popover-mode-btn").forEach((el2) => {
              el2.setAttribute("aria-pressed", el2.dataset.optionId === opt.id ? "true" : "false");
            });
          } catch (err) {
            console.warn("[KeyPilot] Failed to set action parameter:", param.id, err);
          }
        });
        wrap.appendChild(btn);
      }
      row2.appendChild(wrap);
      host.appendChild(row2);
    }
    if (hasParams) {
      const configBtn = doc.createElement("button");
      configBtn.type = "button";
      configBtn.className = "kp-popover-config-btn";
      configBtn.textContent = getMessage("key_info_config");
      configBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const panel = getSharedKeyActionConfigPanel();
        await panel.open(actionId, {
          title: binding && binding.label || actionId,
          anchorRect: targetEl.getBoundingClientRect()
        });
      });
      host.appendChild(configBtn);
    }
  }
  function paintInstanceSettings({ doc, pop, targetEl, actionId, instance }) {
    const host = pop.querySelector(".kp-popover-settings");
    const functionDef = getFunctionDef(instance?.functionId);
    if (!host || !functionDef || !instance) return;
    host.hidden = false;
    pop.classList.add("kp-popover-has-instance-settings");
    let currentId = instance.id;
    let functionId = instance.functionId || functionDef.id;
    let pending = null;
    let running = false;
    let timer = 0;
    const applyLabel = (label) => {
      const text = String(label || "").trim() || functionDef.label || functionId;
      const titleEl = pop.querySelector(".kp-popover-title");
      if (titleEl) titleEl.textContent = text;
      const main = targetEl.querySelector(".key-main");
      if (main) main.textContent = text;
      try {
        targetEl.setAttribute("aria-label", text);
      } catch {
      }
    };
    const step = async () => {
      running = true;
      try {
        while (pending) {
          const draft = pending;
          pending = null;
          const saved = await commitInstanceSettings({
            getKeyPilot: _activePopoverContext?.getKeyPilot,
            instanceId: currentId,
            functionId,
            label: String(draft.label || "").trim() || functionDef.label || functionId,
            parameters: draft.parameters || {},
            keyEl: targetEl
          });
          if (saved?.id) {
            currentId = saved.id;
            functionId = saved.functionId || functionId;
            try {
              targetEl.dataset.kpInstanceId = saved.id;
            } catch {
            }
          }
        }
      } catch (err) {
        console.warn("[KeyPilot] Instance settings save failed:", err);
      } finally {
        running = false;
        if (pending) void step();
      }
    };
    const flush = () => {
      if (timer) {
        clearTimeout(timer);
        timer = 0;
      }
      if (!pending || running) return;
      void step();
    };
    pop._kpFlushInstanceSettings = flush;
    applyLabel(instance.label);
    renderInstanceSettingsForm(host, {
      functionDef,
      instance,
      onDraft: (draft) => {
        applyLabel(draft.label);
        pending = draft;
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, 280);
      }
    });
  }
  async function renderPopoverSettings({ doc, pop, targetEl, binding, actionId }) {
    const host = pop.querySelector(".kp-popover-settings");
    if (!host) return;
    const gen = ++_settingsRenderGen;
    const instanceId = instanceIdForKey(targetEl, actionId);
    if (instanceId) {
      const stock = getStockActionById(instanceId);
      if (stock) {
        paintInstanceSettings({
          doc,
          pop,
          targetEl,
          actionId,
          instance: {
            id: stock.id,
            functionId: stock.functionId,
            label: stock.label,
            parameters: { ...stock.parameters || {} }
          }
        });
        return;
      }
      if (String(instanceId).startsWith("action:")) {
        let action = null;
        try {
          action = await getUserActionById(instanceId);
        } catch {
          action = null;
        }
        if (gen !== _settingsRenderGen) return;
        if (!action) return;
        paintInstanceSettings({
          doc,
          pop,
          targetEl,
          actionId,
          instance: {
            id: action.id,
            functionId: action.functionId,
            label: action.label,
            parameters: action.parameters || {}
          }
        });
        positionKeyInfoPopover(doc, pop, targetEl);
        return;
      }
    }
    pop.classList.remove("kp-popover-has-instance-settings");
    paintPopoverSettings({ doc, pop, targetEl, binding, actionId, parameters: null });
    if (gen !== _settingsRenderGen) return;
    let builtinAction = null;
    try {
      builtinAction = await getOrCreateBuiltinFunctionUserAction(actionId);
    } catch {
      builtinAction = null;
    }
    if (gen !== _settingsRenderGen) return;
    paintPopoverSettings({
      doc,
      pop,
      targetEl,
      binding,
      actionId,
      parameters: builtinAction?.parameters
    });
  }
  function emitKeyboardHelpKeyHover(detail = {}) {
    try {
      const now = Date.now();
      if (emitKeyboardHelpKeyHover._lastAt && now - emitKeyboardHelpKeyHover._lastAt < 120) return;
      emitKeyboardHelpKeyHover._lastAt = now;
      document.dispatchEvent(new CustomEvent("keypilot:action", {
        detail: {
          action: "hover",
          isKeyboardHelpKey: true,
          actionId: detail.actionId ? String(detail.actionId) : null,
          timestamp: now
        }
      }));
    } catch {
    }
  }
  function unpinKeyPopover() {
    const doc = document;
    const pop = doc.body?.querySelector?.('.kp-keybindings-popover[data-kp-key-info-popover="true"]') || doc.body?.querySelector?.(".kp-keybindings-popover");
    hidePopover(pop);
  }
  function attachKeyPopoverBehavior({ root, keybindings, getKeyPilot, pinOnClick = true } = {}) {
    if (!root) return;
    const doc = root.ownerDocument || document;
    const pop = ensurePopover(doc, null);
    if (!pop) return;
    _activePopoverContext = { root, keybindings, getKeyPilot: typeof getKeyPilot === "function" ? getKeyPilot : null };
    if (!root._kpKeyHandlers) {
      root._kpKeyHandlers = {
        enter: null,
        leave: null,
        focusin: null,
        focusout: null,
        click: null,
        docKeydown: null,
        docPointerDown: null,
        resize: null,
        hideTimer: null
      };
    }
    const clearHideTimer = () => {
      if (root._kpKeyHandlers.hideTimer != null) {
        try {
          clearTimeout(root._kpKeyHandlers.hideTimer);
        } catch {
        }
        root._kpKeyHandlers.hideTimer = null;
      }
    };
    const scheduleHide = () => {
      if (_pinnedActionId) return;
      clearHideTimer();
      root._kpKeyHandlers.hideTimer = setTimeout(() => {
        if (_pinnedActionId) return;
        hidePopover(pop);
        root._kpKeyHandlers.hideTimer = null;
      }, 60);
    };
    const showForKeyEl = (keyEl, { pinned = false } = {}) => {
      if (!keyEl || !keyEl.dataset?.kpActionId) return;
      try {
        if (keyEl.classList?.contains("kp-key-text-mode-disabled")) return;
      } catch {
      }
      const actionId = keyEl.dataset.kpActionId;
      const binding = resolveKeybinding(actionId, keybindings);
      if (!binding) return;
      clearHideTimer();
      if (pinned) {
        _pinnedActionId = actionId;
        _pinnedKeyEl = keyEl;
      }
      showPopoverForTarget({
        doc,
        pop,
        targetEl: keyEl,
        binding,
        actionId,
        pinned: pinned || _pinnedActionId === actionId,
        settingsHint: !!pinOnClick
      });
      emitKeyboardHelpKeyHover({ actionId, keyEl });
    };
    const keyElements = root.querySelectorAll("[data-kp-action-id]");
    if (root._kpKeyHandlers.enter) {
      keyElements.forEach((keyEl) => {
        try {
          if (root._kpKeyHandlers.enter) keyEl.removeEventListener("pointerenter", root._kpKeyHandlers.enter);
          if (root._kpKeyHandlers.leave) keyEl.removeEventListener("pointerleave", root._kpKeyHandlers.leave);
          if (root._kpKeyHandlers.focusin) keyEl.removeEventListener("focusin", root._kpKeyHandlers.focusin);
          if (root._kpKeyHandlers.focusout) keyEl.removeEventListener("focusout", root._kpKeyHandlers.focusout);
          if (root._kpKeyHandlers.click) keyEl.removeEventListener("click", root._kpKeyHandlers.click);
        } catch {
        }
      });
    }
    function handleKeyEnter(e) {
      const keyEl = e.currentTarget;
      if (_pinnedActionId && keyEl?.dataset?.kpActionId !== _pinnedActionId) return;
      showForKeyEl(keyEl, { pinned: false });
    }
    function handleKeyLeave() {
      scheduleHide();
    }
    function handleKeyFocusIn(e) {
      showForKeyEl(e.currentTarget, { pinned: false });
    }
    function handleKeyFocusOut() {
      scheduleHide();
    }
    function handleKeyClick(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e && e.isTrusted === false) return;
      const keyEl = e.currentTarget;
      const actionId = keyEl?.dataset?.kpActionId;
      if (_pinnedActionId && _pinnedKeyEl === keyEl && actionId === _pinnedActionId) {
        _pinnedActionId = null;
        _pinnedKeyEl = null;
        showForKeyEl(keyEl, { pinned: false });
        return;
      }
      showForKeyEl(keyEl, { pinned: true });
    }
    root._kpKeyHandlers.enter = handleKeyEnter;
    root._kpKeyHandlers.leave = handleKeyLeave;
    root._kpKeyHandlers.focusin = handleKeyFocusIn;
    root._kpKeyHandlers.focusout = handleKeyFocusOut;
    root._kpKeyHandlers.click = handleKeyClick;
    keyElements.forEach((keyEl) => {
      keyEl.addEventListener("pointerenter", handleKeyEnter);
      keyEl.addEventListener("pointerleave", handleKeyLeave);
      keyEl.addEventListener("focusin", handleKeyFocusIn);
      keyEl.addEventListener("focusout", handleKeyFocusOut);
      if (pinOnClick) keyEl.addEventListener("click", handleKeyClick);
    });
    if (!root._kpKeyHandlers.docKeydown) {
      let handleDocKeydown = function(e) {
        if (e.key === "Escape") hidePopover(pop);
      }, handleDocPointerDown = function(e) {
        if (!_pinnedActionId) return;
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (containsComposed(pop, t) || getComposedEventElement(e, ".kp-keybindings-popover")) return;
        const keyInPath = getComposedEventElement(e, ".key");
        if (_pinnedKeyEl && (containsComposed(_pinnedKeyEl, t) || containsComposed(_pinnedKeyEl, keyInPath))) return;
        try {
          if (closestComposed(keyInPath || t, ".kp-action-config-panel")) return;
        } catch {
        }
        hidePopover(pop);
      }, handleResize = function() {
        hidePopover(pop);
      };
      root._kpKeyHandlers.docKeydown = handleDocKeydown;
      root._kpKeyHandlers.docPointerDown = handleDocPointerDown;
      root._kpKeyHandlers.resize = handleResize;
      doc.addEventListener("keydown", handleDocKeydown, true);
      doc.addEventListener("pointerdown", handleDocPointerDown, true);
      window.addEventListener("resize", handleResize);
    }
  }

  // promo/web/keyboard-demo/entry.js
  init_i18n();
  function paintPanelChrome(root) {
    const theme = getActiveTheme();
    applyThemeDataset(root, theme);
    applyThemeCssVars(root, theme);
    Object.assign(root.style, {
      position: "relative",
      display: "flex",
      width: "820px",
      maxWidth: "100%",
      flexDirection: "column",
      overflow: "hidden",
      boxSizing: "border-box",
      background: "var(--kp-panel-bg, var(--kp-color-panel, #232323))",
      color: "var(--kp-color-fg, #ddd)",
      border: "var(--kp-panel-border, 1px solid #111)",
      borderRadius: "var(--kp-radius-panel, 3px)",
      boxShadow: "var(--kp-panel-shadow)",
      fontFamily: "var(--kp-font-ui, Helvetica, Arial, sans-serif)"
    });
  }
  function paintTitlebar(header) {
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: "8px",
      height: "28px",
      minHeight: "28px",
      maxHeight: "28px",
      boxSizing: "border-box",
      padding: "0 6px 0 10px",
      margin: "0",
      borderBottom: "var(--kp-titlebar-border, 1px solid #111)",
      background: "var(--kp-titlebar-bg)",
      flex: "0 0 auto",
      userSelect: "none"
    });
  }
  function paintIconButton(button) {
    Object.assign(button.style, {
      width: "22px",
      height: "22px",
      minWidth: "22px",
      minHeight: "22px",
      borderRadius: "4px",
      border: "none",
      background: "transparent",
      color: "rgba(200, 200, 205, 0.9)",
      cursor: "pointer",
      fontSize: "14px",
      lineHeight: "20px",
      padding: "0",
      margin: "0",
      flex: "0 0 auto",
      boxShadow: "var(--kp-icon-button-outline, inset 0 0 0 1px rgba(255,255,255,0.08))"
    });
  }
  function mountKeyboard(host) {
    const hardwareLayoutId = host.getAttribute("data-hardware") || "us-ansi-qwerty";
    const keybindings = buildEffectiveKeybindings(DEFAULT_KEYBOARD_LAYOUT_ID);
    const keyboardLayout = buildKeyboardReferenceUiLayout({
      hardwareLayoutId,
      keybindings
    });
    const root = document.createElement("div");
    root.className = "kp-floating-keyboard-help kp-chrome-window";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", getMessage("keyboard_help_aria_label") || "KeyPilot keyboard reference");
    paintPanelChrome(root);
    const header = document.createElement("div");
    header.setAttribute("data-kp-floating-keyboard-titlebar", "true");
    paintTitlebar(header);
    const title = document.createElement("div");
    title.setAttribute("data-kp-floating-keyboard-title", "true");
    title.textContent = getMessage("keyboard_help_title") || "Keyboard Reference";
    Object.assign(title.style, {
      fontSize: "11px",
      fontWeight: "var(--kp-titlebar-title-weight, 600)",
      letterSpacing: "0.02em",
      color: "var(--kp-color-fg, #ddd)",
      lineHeight: "28px",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      margin: "0",
      minWidth: "0"
    });
    const shortcut = createTitlebarShortcut(document, "K");
    shortcut.title = getMessage("keyboard_help_toggle_title") || "";
    const layoutLabel = getMessage("layout_family_browsing_label") || "Browsing";
    const layoutSelect = createSelectMenu({
      ariaLabel: getMessage("keyboard_help_layout_aria") || layoutLabel,
      variant: "titlebar",
      value: "browsing",
      options: [{ value: "browsing", label: layoutLabel }]
    });
    layoutSelect.root.setAttribute("data-kp-floating-keyboard-layout-select", "true");
    layoutSelect.root.style.pointerEvents = "none";
    const collapse = document.createElement("button");
    collapse.type = "button";
    collapse.textContent = "\u25BE";
    collapse.setAttribute("data-kp-floating-keyboard-collapse", "true");
    collapse.setAttribute("aria-label", getMessage("keyboard_help_collapse_aria") || "Collapse");
    paintIconButton(collapse);
    collapse.style.marginLeft = "auto";
    collapse.style.fontSize = "14px";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "\xD7";
    closeBtn.setAttribute("data-kp-floating-keyboard-close", "true");
    closeBtn.setAttribute("aria-label", getMessage("keyboard_help_close_aria") || "Close");
    paintIconButton(closeBtn);
    closeBtn.style.fontSize = "15px";
    closeBtn.addEventListener("click", (event) => {
      event.preventDefault();
    });
    header.append(
      createTitlebarLeadingIcon(document, "keyboard"),
      title,
      shortcut,
      layoutSelect.root,
      collapse,
      closeBtn
    );
    const body = document.createElement("div");
    body.setAttribute("data-kp-floating-keyboard-body", "true");
    Object.assign(body.style, {
      padding: "0",
      margin: "0",
      flex: "1 1 auto",
      minHeight: "0",
      overflow: "auto"
    });
    const keyboard = document.createElement("div");
    keyboard.className = "kp-floating-keyboard-help__keyboard";
    body.appendChild(keyboard);
    root.append(header, body);
    host.replaceChildren(root);
    collapse.addEventListener("click", () => {
      const collapsed = body.style.display === "none";
      body.style.display = collapsed ? "" : "none";
      root.setAttribute("data-kp-collapsed", collapsed ? "false" : "true");
      collapse.textContent = collapsed ? "\u25BE" : "\u25B8";
      collapse.setAttribute(
        "aria-label",
        getMessage(collapsed ? "keyboard_help_collapse_aria" : "keyboard_help_expand_aria") || ""
      );
    });
    renderKeybindingsKeyboard({
      container: keyboard,
      keybindings,
      keyboardLayout,
      layoutId: DEFAULT_KEYBOARD_LAYOUT_ID,
      hardwareLayoutId,
      attachPopovers: true,
      pinOnClick: false
    });
  }
  async function start() {
    const host = document.querySelector("[data-kp-site-keyboard]");
    if (!host) return;
    try {
      await loadMessages();
    } catch (err) {
      console.warn("[KeyPilot site]", err);
    }
    mountKeyboard(host);
  }
  start();
})();
