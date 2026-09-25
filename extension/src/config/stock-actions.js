/**
 * Bundled Action Instances shipped with the extension.
 * Stable ids (`stock:…`) so built-in layouts and user-layout copies can reference
 * them without a per-install uuid.
 */

import { getMessage } from '../utils/i18n.js';
import { normalizeOpenUrlList } from '../utils/open-url-list.js';

export const STOCK_ACTION_ID_PREFIX = 'stock:';

/** Open URLs instance: Facebook, Instagram, YouTube, and X. */
export const STOCK_SOCIAL_MEDIA_ACTION_ID = 'stock:social-media';

/** Random Bookmark instance: one bookmark from every folder, then switch to it. */
export const STOCK_RANDOM_BOOKMARK_ACTION_ID = 'stock:random-bookmark';

/**
 * @typedef {{
 *   id: string,
 *   functionId: string,
 *   handler: string,
 *   keyboardClass: string,
 *   labelKey: string,
 *   descriptionKey: string,
 *   label: string,
 *   description: string,
 *   parameters: Readonly<Record<string, unknown>>
 * }} StockActionDef
 */

/** @type {readonly StockActionDef[]} */
export const STOCK_ACTIONS = Object.freeze([
  Object.freeze({
    id: STOCK_SOCIAL_MEDIA_ACTION_ID,
    functionId: 'OPEN_URLS',
    handler: 'handleOpenUrlsKey',
    keyboardClass: 'key-open-urls',
    labelKey: 'fn_stock_social_media_label',
    descriptionKey: 'fn_stock_social_media_description',
    label: 'Social media',
    description: 'Open Facebook, Instagram, YouTube, and X',
    parameters: Object.freeze({
      urls: Object.freeze(normalizeOpenUrlList([
        'facebook.com',
        'instagram.com',
        'youtube.com',
        'x.com'
      ]))
    })
  }),
  Object.freeze({
    id: STOCK_RANDOM_BOOKMARK_ACTION_ID,
    functionId: 'RANDOM_BOOKMARK',
    handler: 'handleRandomBookmarkKey',
    keyboardClass: 'key-open-urls',
    labelKey: 'fn_stock_random_bookmark_label',
    descriptionKey: 'fn_stock_random_bookmark_description',
    label: 'Random Bookmark',
    description: 'Open one random bookmark',
    parameters: Object.freeze({
      folderId: '',
      count: 1
    })
  })
]);

/**
 * @param {unknown} id
 * @returns {boolean}
 */
export function isStockActionId(id) {
  return String(id || '').startsWith(STOCK_ACTION_ID_PREFIX);
}

/**
 * @param {string} id
 * @returns {(StockActionDef & { label: string, description: string })|null}
 */
export function getStockActionById(id) {
  const key = String(id || '');
  const found = STOCK_ACTIONS.find((action) => action && action.id === key);
  if (!found) return null;
  return {
    ...found,
    label: getMessage(found.labelKey) || found.label || found.id,
    description: (found.descriptionKey && getMessage(found.descriptionKey)) || found.description || ''
  };
}

/**
 * @param {string} [functionId] When set, only instances of that Function.
 * @returns {Array<StockActionDef & { label: string, description: string }>}
 */
export function listStockActions(functionId) {
  const want = functionId ? String(functionId) : '';
  return STOCK_ACTIONS
    .filter((action) => action && (!want || action.functionId === want))
    .map((action) => getStockActionById(action.id))
    .filter(Boolean);
}
