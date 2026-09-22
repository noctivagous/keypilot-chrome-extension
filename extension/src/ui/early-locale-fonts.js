/**
 * Minimal locale runtime stamped into early-inject.js.
 *
 * Keep this self-contained and small: it runs at document_start on every
 * matching page. The full `i18n.js` and `locale-fonts.js` modules serve the
 * bundled UI; early chrome only needs a catalog language tag and its shadow
 * font rules.
 */

const EARLY_LOCALE_TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]+)*$/;

/**
 * @returns {string}
 */
export function getUILocaleTag() {
  try {
    const raw = String(
      chrome?.i18n?.getMessage?.('locale_tag')
      || chrome?.i18n?.getUILanguage?.()
      || 'en'
    ).trim().replace(/_/g, '-');
    return EARLY_LOCALE_TAG.test(raw) ? raw : 'en';
  } catch {
    return 'en';
  }
}

const EARLY_CJK_SC =
  'system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", sans-serif';
const EARLY_CJK_TC =
  'system-ui, -apple-system, "PingFang TC", "Hiragino Sans CNS", "Microsoft JhengHei", "Noto Sans TC", "Noto Sans CJK TC", sans-serif';
const EARLY_CJK_HK =
  'system-ui, -apple-system, "PingFang HK", "PingFang TC", "Hiragino Sans CNS", "Microsoft JhengHei", "Noto Sans HK", "Noto Sans CJK HK", "Noto Sans TC", "Noto Sans CJK TC", sans-serif';

/**
 * @param {string} tag
 * @returns {string}
 */
export function cjkUiFallbackStack(tag = '') {
  const t = String(tag).trim().replace(/_/g, '-').toLowerCase();
  if (t === 'zh-hk' || t === 'zh-mo' || t.startsWith('zh-hant-hk') || t.startsWith('zh-hant-mo')) return EARLY_CJK_HK;
  if (t === 'zh-tw' || t.startsWith('zh-tw-') || (t.startsWith('zh-hant') && !t.startsWith('zh-hant-hk') && !t.startsWith('zh-hant-mo'))) return EARLY_CJK_TC;
  if (t === 'zh' || t === 'zh-cn' || t.startsWith('zh-cn-') || t === 'zh-sg' || t.startsWith('zh-sg-') || t.startsWith('zh-hans')) return EARLY_CJK_SC;
  return '';
}

export const KP_CJK_SHADOW_CSS = [
  `:host(:lang(zh-HK)), :host(:lang(zh-MO)), :host(:lang(zh-Hant-HK)), :host(:lang(zh-Hant-MO)) { font-family: ${EARLY_CJK_HK}; }`,
  `:host(:lang(zh-TW)), :host(:lang(zh-Hant):not(:lang(zh-Hant-HK)):not(:lang(zh-Hant-MO))) { font-family: ${EARLY_CJK_TC}; }`,
  `:host(:lang(zh-CN)), :host(:lang(zh-SG)), :host(:lang(zh-Hans)), :host([lang="zh" i]) { font-family: ${EARLY_CJK_SC}; }`
].join('\n');
