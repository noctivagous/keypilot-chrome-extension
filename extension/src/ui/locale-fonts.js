/**
 * Locale-specific, system-font-first CJK stacks for KeyPilot chrome.
 *
 * These are font *names* only — never bundle CJK webfont families here.
 * Complete CJK families cost megabytes that every installation would pay;
 * instead the stacks resolve to fonts already on the user's OS.
 *
 * `extension/pages/kp-locale-fonts.css` is generated from this module by
 * `extension/build.js`. Onboarding reads `cjkUiFallbackStack()` from here;
 * early-inject stamps this file so that call stays in scope without an import.
 *
 * Do not append these families onto a shared Latin stack such as `KP_UI_FONT`.
 * The first named CJK face that contains a Han glyph wins, so a Simplified
 * face listed before a Traditional one paints Traditional text with
 * Simplified shapes. Elements that keep a Latin stack pick the right face
 * through the browser's lang-aware fallback.
 */

function quoteFamily(name) {
  return `"${name}"`;
}

function uiStack(families) {
  return ['system-ui', '-apple-system', ...families.map(quoteFamily), 'sans-serif'].join(', ');
}

/** Simplified Chinese: PingFang SC on macOS, YaHei on Windows, Noto on Linux. */
export const KP_CJK_UI_STACK_SC = uiStack([
  'PingFang SC',
  'Hiragino Sans GB',
  'Microsoft YaHei',
  'Noto Sans SC',
  'Noto Sans CJK SC'
]);

/** Traditional Chinese (Taiwan): PingFang TC, JhengHei, Noto TC / CJK TC. */
export const KP_CJK_UI_STACK_TC = uiStack([
  'PingFang TC',
  'Hiragino Sans CNS',
  'Microsoft JhengHei',
  'Noto Sans TC',
  'Noto Sans CJK TC'
]);

/**
 * Traditional Chinese (Hong Kong and Macau). PingFang HK before PingFang TC
 * so Hong Kong glyph variants win when both faces are installed.
 */
export const KP_CJK_UI_STACK_HK = uiStack([
  'PingFang HK',
  'PingFang TC',
  'Hiragino Sans CNS',
  'Microsoft JhengHei',
  'Noto Sans HK',
  'Noto Sans CJK HK',
  'Noto Sans TC',
  'Noto Sans CJK TC'
]);

/** Japanese: Hiragino on macOS, Yu Gothic / Meiryo on Windows, Noto on Linux. */
export const KP_CJK_UI_STACK_JP = uiStack([
  'Hiragino Sans',
  'Yu Gothic UI',
  'Yu Gothic',
  'Meiryo',
  'Noto Sans JP',
  'Noto Sans CJK JP'
]);

/**
 * @param {string} tag
 * @returns {string}
 */
function normalizeTag(tag) {
  return String(tag || '').trim().replace(/_/g, '-').toLowerCase();
}

/**
 * Hong Kong and Macau, including script-tagged forms (`zh-Hant-HK`).
 * Kept in step with the HK selectors in `CJK_FONT_RULES`.
 * @param {string} tag
 * @returns {boolean}
 */
function isZhHk(tag) {
  return (
    tag === 'zh-hk' || tag.startsWith('zh-hk-')
    || tag === 'zh-mo' || tag.startsWith('zh-mo-')
    || tag === 'zh-hant-hk' || tag.startsWith('zh-hant-hk-')
    || tag === 'zh-hant-mo' || tag.startsWith('zh-hant-mo-')
  );
}

/**
 * Taiwan and generic Traditional (`zh-Hant`, `zh-Hant-TW`).
 * Hong Kong/Macau tags also start with `zh-Hant-` and are excluded here.
 * @param {string} tag
 * @returns {boolean}
 */
function isZhTw(tag) {
  if (isZhHk(tag)) return false;
  return tag === 'zh-tw' || tag.startsWith('zh-tw-') || tag === 'zh-hant' || tag.startsWith('zh-hant-');
}

/**
 * Simplified, including bare `zh`. Unknown Chinese subtags are not forced
 * onto this group.
 * @param {string} tag
 * @returns {boolean}
 */
function isZhHans(tag) {
  return (
    tag === 'zh'
    || tag === 'zh-cn' || tag.startsWith('zh-cn-')
    || tag === 'zh-sg' || tag.startsWith('zh-sg-')
    || tag === 'zh-hans' || tag.startsWith('zh-hans-')
  );
}

/**
 * Japanese, including regional BCP-47 variants such as `ja-JP`.
 * @param {string} tag
 * @returns {boolean}
 */
function isJapanese(tag) {
  return tag === 'ja' || tag.startsWith('ja-');
}

/**
 * Shadow and page selectors are mutually exclusive. `:lang(zh)` is not used:
 * it also matches `zh-TW`, `zh-HK`, and `zh-Hant`.
 * `:lang(zh-Hant)` matches `zh-Hant-HK`, so the Traditional rule excludes it.
 */
const CJK_FONT_RULES = [
  {
    id: 'jp',
    stack: () => KP_CJK_UI_STACK_JP,
    match: isJapanese,
    shadow: [
      ':host(:lang(ja))'
    ],
    page: [
      'html:lang(ja) body'
    ]
  },
  {
    id: 'hk',
    stack: () => KP_CJK_UI_STACK_HK,
    match: isZhHk,
    shadow: [
      ':host(:lang(zh-HK))',
      ':host(:lang(zh-MO))',
      ':host(:lang(zh-Hant-HK))',
      ':host(:lang(zh-Hant-MO))'
    ],
    page: [
      'html:lang(zh-HK) body',
      'html:lang(zh-MO) body',
      'html:lang(zh-Hant-HK) body',
      'html:lang(zh-Hant-MO) body'
    ]
  },
  {
    id: 'tc',
    stack: () => KP_CJK_UI_STACK_TC,
    match: isZhTw,
    shadow: [
      ':host(:lang(zh-TW))',
      ':host(:lang(zh-Hant):not(:lang(zh-Hant-HK)):not(:lang(zh-Hant-MO)))'
    ],
    page: [
      'html:lang(zh-TW) body',
      'html:lang(zh-Hant):not(:lang(zh-Hant-HK)):not(:lang(zh-Hant-MO)) body'
    ]
  },
  {
    id: 'sc',
    stack: () => KP_CJK_UI_STACK_SC,
    match: isZhHans,
    shadow: [
      ':host(:lang(zh-CN))',
      ':host(:lang(zh-SG))',
      ':host(:lang(zh-Hans))',
      ':host([lang="zh" i])'
    ],
    page: [
      'html:lang(zh-CN) body',
      'html:lang(zh-SG) body',
      'html:lang(zh-Hans) body',
      'html[lang="zh" i] body'
    ]
  }
];

/**
 * `jp`, `hk`, `tc`, `sc`, or `''` when the tag has no locale-specific stack.
 * @param {string} [tag]
 * @returns {'jp'|'hk'|'tc'|'sc'|''}
 */
export function cjkScriptGroup(tag = '') {
  const norm = normalizeTag(tag);
  const hit = CJK_FONT_RULES.find((rule) => rule.match(norm));
  return hit ? hit.id : '';
}

/**
 * System-font stack for a supported CJK UI locale, or `''` for other tags.
 * @param {string} [tag]
 * @returns {string}
 */
export function cjkUiFallbackStack(tag = '') {
  const norm = normalizeTag(tag);
  const hit = CJK_FONT_RULES.find((rule) => rule.match(norm));
  return hit ? hit.stack() : '';
}

function fontFamilyRule(selectors, stack) {
  return `${selectors.join(',\n')} {\n  font-family: ${stack};\n}`;
}

/**
 * Shadow-DOM locale rules. `:lang()` inside a shadow tree matches the host's
 * `lang` attribute. Descendants that set their own Latin `font-family` keep
 * it and still resolve Han glyphs from that `lang`.
 */
export const KP_CJK_SHADOW_CSS = CJK_FONT_RULES
  .map((rule) => fontFamilyRule(rule.shadow, rule.stack()))
  .join('\n');

/**
 * Extension-page stylesheet. Loaded after each page's own styles so these
 * `body` rules win for inherited text. Descendants with an explicit Latin
 * `font-family` keep that stack.
 * @returns {string}
 */
export function renderLocaleFontStylesheet() {
  const rules = CJK_FONT_RULES
    .map((rule) => fontFamilyRule(rule.page, rule.stack()))
    .join('\n\n');
  return `/**
 * Generated from extension/src/ui/locale-fonts.js. Do not edit by hand.
 *
 * Locale-specific, system-font-first CJK typography for extension pages.
 * Font names only: never add embedded CJK font faces here.
 *
 * The lang attribute is set by applyDocumentLocale() (src/utils/i18n.js)
 * from the catalog that supplied the strings (locale_tag), so English
 * fallback copy is not labeled as Chinese.
 */

${rules}
`;
}
