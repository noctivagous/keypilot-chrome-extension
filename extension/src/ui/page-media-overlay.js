/**
 * Page Media overlay — tabbed Image / Video / Text gallery for the O key.
 * DOM-only (TrustedHTML-safe). Prefixes: kpv2-page-media-*.
 */

import {
  NCT_DARK_UI_COLORS,
  NCT_DARK_UI_FONT,
  NCT_DARK_UI_BTN_GRADIENT,
  NCT_DARK_UI_BTN_BORDER,
  NCT_DARK_UI_BTN_RADIUS,
  NCT_DARK_UI_BTN_LIT_GRADIENT,
  NCT_DARK_UI_BTN_LIT_BORDER,
  NCT_DARK_UI_TITLEBAR_GRADIENT,
  NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM
} from './nct-dark-ui.js';
import {
  groupPageMediaByCategory,
  groupImagesByDimensionSize,
  partitionImageItems,
  enrichImageItems,
  resolveVideoThumbnail,
  formatImageFileType,
  formatImageDpi,
  formatImageDimensions,
  formatFileSize,
  domainFromUrl,
  urlPathDisplay,
  urlPathRelativeToPrefix,
  groupUrlItemsByPathPrefix
} from '../utils/page-media-utils.js';
import { Z_INDEX } from '../config/constants.js';
import { storageGetValue, storageSetValue } from '../utils/storage.js';
import { createSegmentedControl } from './segmented-control.js';
import { ensureOpenChromeShadow, injectChromeStyles } from './kp-chrome-shadow.js';

const OVERLAY_ID = 'kpv2-page-media-overlay';
/** Slider 1–2.5; default 1.5×. Persisted as the CSS scale factor. */
const IMAGE_SCALE_STORAGE_KEY = 'kp_page_media_image_scale';
const IMAGE_SCALE_SLIDER_MIN = 1;
const IMAGE_SCALE_SLIDER_MAX = 2.5;
const IMAGE_SCALE_SLIDER_STEP = 0.25;
const IMAGE_SCALE_DEFAULT = 1.5;
/** Image-tab card frame: square crop vs natural aspect. */
const IMAGE_ASPECT_STORAGE_KEY = 'kp_page_media_image_aspect';
/** @typedef {'square'|'original'} ImageAspectMode */
const IMAGE_ASPECT_DEFAULT = /** @type {ImageAspectMode} */ ('square');

/** @type {HTMLElement|null} */
let _overlay = null;
/** @type {(() => void)|null} */
let _onClose = null;
/** @type {((e: KeyboardEvent) => void)|null} */
let _keyHandler = null;
/** @type {string} */
let _activeTab = 'image';
/** @type {import('../utils/page-media-utils.js').PageMediaItem[]} */
let _items = [];
/** @type {number} */
let _fullViewIndex = 0;
/** @type {string|null} */
let _prevOverflow = null;
/** @type {number} */
let _enrichGen = 0;
/** @type {WeakMap<object, HTMLElement>} */
let _cardByItem = new WeakMap();
/** @type {import('../utils/page-media-utils.js').PageMediaItem[]} */
let _imageFlatList = [];
/** @type {(msg: string, type?: string) => void} */
let _notify = () => {};
/** @type {(item: import('../utils/page-media-utils.js').PageMediaItem) => void|Promise<void>} */
let _onSendToMediaLibrary = async () => {};
/** Slider position 1…2.5 (default 1.5×). */
let _imageScaleSlider = IMAGE_SCALE_DEFAULT;
/** @type {ImageAspectMode} */
let _imageAspectMode = IMAGE_ASPECT_DEFAULT;
/** @type {ReturnType<typeof createSegmentedControl>|null} */
let _aspectControl = null;

function getOverlayRoot() {
  return _overlay?.shadowRoot || _overlay;
}

/**
 * @returns {boolean}
 */
export function isPageMediaOverlayOpen() {
  return !!_overlay && !!document.getElementById(OVERLAY_ID);
}

/**
 * Close full-view if open, else the whole overlay.
 * @returns {boolean} true if something was closed
 */
export function requestClosePageMediaOverlay() {
  if (!isPageMediaOverlayOpen()) return false;
  const modal = getOverlayRoot()?.querySelector('.kpv2-page-media-fullview');
  if (modal && modal.classList.contains('is-open')) {
    closeFullView();
    return true;
  }
  closePageMediaOverlay();
  return true;
}

export function closePageMediaOverlay() {
  if (_keyHandler) {
    try { document.removeEventListener('keydown', _keyHandler, true); } catch { /* ignore */ }
    _keyHandler = null;
  }
  if (_regroupTimer != null) {
    try { clearTimeout(_regroupTimer); } catch { /* ignore */ }
    _regroupTimer = null;
  }
  if (_overlay) {
    try { _overlay.remove(); } catch { /* ignore */ }
    _overlay = null;
  }
  if (_prevOverflow != null) {
    try { document.body.style.overflow = _prevOverflow; } catch { /* ignore */ }
    _prevOverflow = null;
  }
  const cb = _onClose;
  _onClose = null;
  _items = [];
  _imageFlatList = [];
  _cardByItem = new WeakMap();
  _enrichGen += 1;
  _notify = () => {};
  _onSendToMediaLibrary = async () => {};
  _imageScaleSlider = IMAGE_SCALE_DEFAULT;
  _imageAspectMode = IMAGE_ASPECT_DEFAULT;
  _aspectControl = null;
  if (typeof cb === 'function') {
    try { cb(); } catch { /* ignore */ }
  }
}

/**
 * Normalize stored / input slider to a discrete step in [1, 2.5].
 * Migrates the previous 0…2.5 “offset” preference to a real scale factor.
 * @param {unknown} raw
 * @returns {number}
 */
function normalizeImageScaleSlider(raw) {
  let n = Number(raw);
  if (!Number.isFinite(n)) return IMAGE_SCALE_DEFAULT;
  // Legacy: 0…2.5 slider mapped to CSS 1…2.5 via lerp.
  if (n >= 0 && n < IMAGE_SCALE_SLIDER_MIN) {
    n = 1 + (n / IMAGE_SCALE_SLIDER_MAX) * (IMAGE_SCALE_SLIDER_MAX - 1);
  }
  const clamped = Math.min(IMAGE_SCALE_SLIDER_MAX, Math.max(IMAGE_SCALE_SLIDER_MIN, n));
  const steps = Math.round((clamped - IMAGE_SCALE_SLIDER_MIN) / IMAGE_SCALE_SLIDER_STEP);
  return Math.round((IMAGE_SCALE_SLIDER_MIN + steps * IMAGE_SCALE_SLIDER_STEP) * 100) / 100;
}

/**
 * @param {number} slider
 * @returns {string}
 */
function formatImageScaleReadout(slider) {
  const v = normalizeImageScaleSlider(slider);
  const rounded = Math.round(v * 100) / 100;
  const text = rounded % 1 === 0
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${text}×`;
}

async function loadImageScalePreference() {
  try {
    const stored = await storageGetValue(IMAGE_SCALE_STORAGE_KEY, IMAGE_SCALE_DEFAULT);
    _imageScaleSlider = normalizeImageScaleSlider(
      stored === undefined || stored === null ? IMAGE_SCALE_DEFAULT : stored
    );
  } catch {
    _imageScaleSlider = IMAGE_SCALE_DEFAULT;
  }
}

/**
 * @param {unknown} raw
 * @returns {ImageAspectMode}
 */
function normalizeImageAspectMode(raw) {
  return raw === 'original' ? 'original' : 'square';
}

async function loadImageAspectPreference() {
  try {
    const stored = await storageGetValue(IMAGE_ASPECT_STORAGE_KEY, IMAGE_ASPECT_DEFAULT);
    _imageAspectMode = normalizeImageAspectMode(stored);
  } catch {
    _imageAspectMode = IMAGE_ASPECT_DEFAULT;
  }
}

/**
 * @param {ImageAspectMode} mode
 */
function persistImageAspectPreference(mode) {
  _imageAspectMode = normalizeImageAspectMode(mode);
  try {
    void storageSetValue(IMAGE_ASPECT_STORAGE_KEY, _imageAspectMode);
  } catch { /* ignore */ }
}

/**
 * Apply aspect mode class + refresh all image thumbs.
 * @param {ImageAspectMode} [mode]
 */
function applyImageAspectMode(mode = _imageAspectMode) {
  _imageAspectMode = normalizeImageAspectMode(mode);
  if (!_overlay) return;
  const content = getOverlayRoot()?.querySelector('.kpv2-page-media-content');
  if (content instanceof HTMLElement) {
    content.classList.toggle('is-aspect-square', _imageAspectMode === 'square');
    content.classList.toggle('is-aspect-original', _imageAspectMode === 'original');
  }
  if (_aspectControl) {
    _aspectControl.setValue(_imageAspectMode, { silent: true });
  }
  requestAnimationFrame(() => {
    if (!_overlay) return;
    const thumbs = getOverlayRoot()?.querySelectorAll('.kpv2-page-media-card-image .kpv2-page-media-thumb') || [];
    for (const thumb of thumbs) {
      if (!(thumb instanceof HTMLImageElement)) continue;
      const wrap = thumb.closest('.kpv2-page-media-thumb-wrap');
      if (wrap instanceof HTMLElement) applyThumbFitMode(thumb, wrap);
    }
  });
}

function updateAspectToolbarVisibility() {
  if (!_overlay) return;
  const bar = getOverlayRoot()?.querySelector('.kpv2-page-media-aspect-bar');
  if (!(bar instanceof HTMLElement)) return;
  const show = _activeTab === 'image';
  bar.hidden = !show;
  bar.setAttribute('aria-hidden', show ? 'false' : 'true');
}

/**
 * @returns {HTMLElement}
 */
function buildImageAspectToolbar() {
  const bar = document.createElement('div');
  bar.className = 'kpv2-page-media-aspect-bar';
  bar.hidden = _activeTab !== 'image';
  bar.setAttribute('aria-hidden', _activeTab === 'image' ? 'false' : 'true');

  const label = document.createElement('span');
  label.className = 'kpv2-page-media-aspect-label';
  label.textContent = 'Card Aspect Ratio:';

  _aspectControl = createSegmentedControl({
    className: 'kpv2-page-media-aspect-seg',
    ariaLabel: 'Card aspect ratio',
    value: _imageAspectMode,
    options: [
      { value: 'square', label: 'Square Crop', title: 'Square crop thumbnails' },
      { value: 'original', label: 'Img Original', title: 'Keep each image’s original aspect ratio' }
    ],
    onChange: (value) => {
      const mode = normalizeImageAspectMode(value);
      persistImageAspectPreference(mode);
      applyImageAspectMode(mode);
    }
  });

  bar.appendChild(label);
  bar.appendChild(_aspectControl.root);
  return bar;
}

/**
 * @param {number} slider
 */
function persistImageScalePreference(slider) {
  const v = normalizeImageScaleSlider(slider);
  _imageScaleSlider = v;
  try {
    void storageSetValue(IMAGE_SCALE_STORAGE_KEY, v);
  } catch { /* ignore */ }
}

/**
 * Apply --kpv2-pm-image-scale on overlay content (all tabs) and refresh thumb fit.
 * @param {number} [slider]
 */
function applyImageScale(slider = _imageScaleSlider) {
  _imageScaleSlider = normalizeImageScaleSlider(slider);
  if (!_overlay) return;
  const content = getOverlayRoot()?.querySelector('.kpv2-page-media-content');
  if (content instanceof HTMLElement) {
    content.style.setProperty('--kpv2-pm-image-scale', String(_imageScaleSlider));
  }
  const readout = getOverlayRoot()?.querySelector('.kpv2-page-media-scale-value');
  if (readout) readout.textContent = formatImageScaleReadout(_imageScaleSlider);
  const range = getOverlayRoot()?.querySelector('.kpv2-page-media-scale-range');
  if (range instanceof HTMLInputElement) {
    range.value = String(_imageScaleSlider);
  }
  // Re-measure native/cover fit after cell size changes.
  requestAnimationFrame(() => {
    if (!_overlay) return;
    const thumbs = getOverlayRoot()?.querySelectorAll('.kpv2-page-media-thumb') || [];
    for (const thumb of thumbs) {
      if (!(thumb instanceof HTMLImageElement)) continue;
      const wrap = thumb.closest('.kpv2-page-media-thumb-wrap');
      if (wrap instanceof HTMLElement) applyThumbFitMode(thumb, wrap);
    }
  });
}

/**
 * @returns {HTMLElement}
 */
function buildImageScaleControl() {
  const wrap = document.createElement('div');
  wrap.className = 'kpv2-page-media-scale';
  wrap.title = 'Overlay content scale (1×–2.5×, all tabs)';

  const label = document.createElement('span');
  label.className = 'kpv2-page-media-scale-label';
  label.textContent = 'Scale';

  const minTag = document.createElement('span');
  minTag.className = 'kpv2-page-media-scale-edge';
  minTag.textContent = '1×';

  const range = document.createElement('input');
  range.type = 'range';
  range.className = 'kpv2-page-media-scale-range';
  range.min = String(IMAGE_SCALE_SLIDER_MIN);
  range.max = String(IMAGE_SCALE_SLIDER_MAX);
  range.step = String(IMAGE_SCALE_SLIDER_STEP);
  range.value = String(_imageScaleSlider);
  range.setAttribute('aria-label', 'Page Media content scale');

  const maxTag = document.createElement('span');
  maxTag.className = 'kpv2-page-media-scale-edge';
  maxTag.textContent = '2.5×';

  const value = document.createElement('span');
  value.className = 'kpv2-page-media-scale-value';
  value.textContent = formatImageScaleReadout(_imageScaleSlider);

  const onSlide = () => {
    const next = normalizeImageScaleSlider(range.value);
    applyImageScale(next);
    persistImageScalePreference(next);
  };
  range.addEventListener('input', onSlide, true);
  range.addEventListener('change', onSlide, true);

  wrap.appendChild(label);
  wrap.appendChild(minTag);
  wrap.appendChild(range);
  wrap.appendChild(maxTag);
  wrap.appendChild(value);
  return wrap;
}

/**
 * @param {{
 *   items: import('../utils/page-media-utils.js').PageMediaItem[],
 *   onClose?: () => void,
 *   onNotify?: (message: string, type?: string) => void,
 *   onSendToMediaLibrary?: (item: import('../utils/page-media-utils.js').PageMediaItem) => void|Promise<void>
 * }} opts
 * @returns {Promise<void>}
 */
export async function openPageMediaOverlay({ items, onClose, onNotify, onSendToMediaLibrary } = /** @type {any} */ ({})) {
  closePageMediaOverlay();

  _items = Array.isArray(items) ? items.slice() : [];
  _onClose = typeof onClose === 'function' ? onClose : null;
  _notify = typeof onNotify === 'function' ? onNotify : () => {};
  _onSendToMediaLibrary = typeof onSendToMediaLibrary === 'function'
    ? onSendToMediaLibrary
    : async () => { _notify('Media Library is not built yet — coming soon', 'info'); };

  await loadImageScalePreference();
  await loadImageAspectPreference();

  const groups = groupPageMediaByCategory(_items);
  if (groups.image.length) _activeTab = 'image';
  else if (groups.video.length) _activeTab = 'video';
  else if (groups.pageText.length) _activeTab = 'pageText';
  else if (groups.text.length) _activeTab = 'text';
  else if (groups.url.length) _activeTab = 'url';
  else _activeTab = 'image';

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'kpv2-page-media-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Page Media');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: ${Z_INDEX.POPUP_PANEL_MAX + 20};
  `;
  const shadowRoot = ensureOpenChromeShadow(overlay, { id: 'page-media' });
  const mount = shadowRoot || overlay;
  ensureStyles(mount);
  const shell = document.createElement('div');
  shell.className = 'kpv2-page-media-shell';

  const header = document.createElement('div');
  header.className = 'kpv2-page-media-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'kpv2-page-media-title-wrap';
  const title = document.createElement('h2');
  title.className = 'kpv2-page-media-title';
  title.textContent = 'Page Media';
  const total = document.createElement('span');
  total.className = 'kpv2-page-media-count';
  const mediaCount =
    groups.image.length + groups.video.length + groups.text.length + groups.pageText.length;
  total.textContent = String(mediaCount || groups.url.length);
  total.title = groups.url.length
    ? `${mediaCount} media · ${groups.url.length} unique URLs`
    : `${mediaCount} media`;
  titleWrap.appendChild(title);
  titleWrap.appendChild(total);

  const tabs = document.createElement('div');
  tabs.className = 'kpv2-page-media-tabs';
  tabs.setAttribute('role', 'tablist');

  /** @type {Record<string, HTMLButtonElement>} */
  const tabButtons = {};
  const tabDefs = /** @type {const} */ ([
    { id: 'image', label: 'Image' },
    { id: 'video', label: 'Video' },
    { id: 'pageText', label: 'Text' },
    { id: 'text', label: 'Docs' },
    { id: 'url', label: 'URLs' }
  ]);
  for (const { id, label } of tabDefs) {
    const count = groups[id].length;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kpv2-page-media-tab';
    btn.setAttribute('role', 'tab');
    btn.dataset.tab = id;
    btn.disabled = count === 0;
    btn.setAttribute('aria-selected', id === _activeTab ? 'true' : 'false');
    if (id === _activeTab) btn.classList.add('is-active');
    const name = document.createElement('span');
    name.textContent = label;
    const badge = document.createElement('span');
    badge.className = 'kpv2-page-media-tab-badge';
    badge.textContent = String(count);
    btn.appendChild(name);
    btn.appendChild(badge);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.disabled) return;
      setActiveTab(id);
    }, true);
    tabs.appendChild(btn);
    tabButtons[id] = btn;
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'kpv2-page-media-close';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closePageMediaOverlay();
  }, true);

  header.appendChild(titleWrap);
  header.appendChild(buildImageScaleControl());
  header.appendChild(tabs);
  header.appendChild(closeBtn);

  const content = document.createElement('div');
  content.className = 'kpv2-page-media-content';
  content.id = 'kpv2-page-media-grid';

  const fullView = document.createElement('div');
  fullView.className = 'kpv2-page-media-fullview';
  fullView.setAttribute('aria-hidden', 'true');

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'kpv2-page-media-nav kpv2-page-media-nav-prev';
  prevBtn.textContent = '‹';
  prevBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigateFullView(-1);
  }, true);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'kpv2-page-media-nav kpv2-page-media-nav-next';
  nextBtn.textContent = '›';
  nextBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigateFullView(1);
  }, true);

  const fullMediaHost = document.createElement('div');
  fullMediaHost.className = 'kpv2-page-media-fullmedia';
  fullMediaHost.addEventListener('click', (e) => e.stopPropagation(), true);

  const counter = document.createElement('div');
  counter.className = 'kpv2-page-media-fullcounter';

  fullView.appendChild(prevBtn);
  fullView.appendChild(fullMediaHost);
  fullView.appendChild(nextBtn);
  fullView.appendChild(counter);
  fullView.addEventListener('click', () => closeFullView(), true);

  shell.appendChild(header);
  shell.appendChild(buildImageAspectToolbar());
  shell.appendChild(content);
  shell.appendChild(fullView);
  mount.appendChild(shell);

  // Store tab button refs for setActiveTab
  /** @type {any} */ (overlay)._tabButtons = tabButtons;
  /** @type {any} */ (overlay)._content = content;
  /** @type {any} */ (overlay)._fullView = fullView;
  /** @type {any} */ (overlay)._fullMediaHost = fullMediaHost;
  /** @type {any} */ (overlay)._fullCounter = counter;

  document.body.appendChild(overlay);
  _overlay = overlay;
  applyImageScale(_imageScaleSlider);
  applyImageAspectMode(_imageAspectMode);
  updateAspectToolbarVisibility();

  try {
    _prevOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
  } catch { /* ignore */ }

  _keyHandler = (e) => {
    if (!isPageMediaOverlayOpen()) return;
    const isEsc = e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape';
    const modal = _overlay && /** @type {any} */ (_overlay)._fullView;
    const fullOpen = !!(modal && modal.classList.contains('is-open'));

    if (fullOpen) {
      if (isEsc) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeFullView();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        navigateFullView(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        navigateFullView(1);
        return;
      }
    } else if (isEsc) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closePageMediaOverlay();
    }
  };
  document.addEventListener('keydown', _keyHandler, true);

  renderGrid();
  if (_activeTab === 'image') startImageEnrichment();
  applyImageAspectMode(_imageAspectMode);
  updateAspectToolbarVisibility();
}

/**
 * @param {'image'|'video'|'text'|'url'|'pageText'} tab
 */
function setActiveTab(tab) {
  _activeTab = tab;
  if (!_overlay) return;
  const buttons = /** @type {any} */ (_overlay)._tabButtons || {};
  for (const id of Object.keys(buttons)) {
    const btn = buttons[id];
    if (!btn) continue;
    const on = id === tab;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  }
  renderGrid();
  if (tab === 'image') startImageEnrichment();
  applyImageScale(_imageScaleSlider);
  applyImageAspectMode(_imageAspectMode);
  updateAspectToolbarVisibility();
}

function startImageEnrichment() {
  const gen = ++_enrichGen;
  const images = groupPageMediaByCategory(_items).image;
  if (!images.length) return;

  enrichImageItems(images, {
    concurrency: 4,
    onProgress: () => {
      if (gen !== _enrichGen || !isPageMediaOverlayOpen()) return;
      if (_activeTab !== 'image') return;
      // Re-group as dimensions arrive (items may move between size bands).
      renderImageGrid({ preserveScroll: true });
    }
  }).catch(() => { /* ignore */ });
}

function renderGrid() {
  if (!_overlay) return;
  const content = /** @type {HTMLElement} */ (/** @type {any} */ (_overlay)._content);
  if (!content) return;

  if (_activeTab === 'image') {
    renderImageGrid({ preserveScroll: false });
    return;
  }

  while (content.firstChild) content.removeChild(content.firstChild);
  content.classList.remove('is-image-tab', 'is-video-tab', 'is-url-tab', 'is-page-text-tab');

  const groups = groupPageMediaByCategory(_items);
  const list = groups[/** @type {'video'|'text'|'url'|'pageText'} */ (_activeTab)] || [];

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'kpv2-page-media-empty';
    empty.textContent =
      _activeTab === 'url' ? 'No URLs found on this page.'
        : _activeTab === 'pageText' ? 'No article or main text found on this page.'
          : `No ${_activeTab === 'text' ? 'document' : _activeTab} files found on this page.`;
    content.appendChild(empty);
    return;
  }

  if (_activeTab === 'video') {
    content.classList.add('is-video-tab');
    const grid = document.createElement('div');
    grid.className = 'kpv2-page-media-size-grid';
    list.forEach((item, index) => {
      grid.appendChild(buildVideoCard(item, () => onItemActivate(list, index)));
    });
    content.appendChild(grid);
    return;
  }

  if (_activeTab === 'url') {
    content.classList.add('is-url-tab');
    const listEl = document.createElement('div');
    listEl.className = 'kpv2-page-media-url-list';

    /** @type {Map<string, import('../utils/page-media-utils.js').PageMediaItem[]>} */
    const byDomain = new Map();
    for (const item of list) {
      const domain = domainFromUrl(item.url);
      if (!byDomain.has(domain)) byDomain.set(domain, []);
      byDomain.get(domain).push(item);
    }

    let pageHost = '';
    try { pageHost = String(location.hostname || ''); } catch { pageHost = ''; }

    const domains = Array.from(byDomain.keys()).sort((a, b) => {
      if (pageHost) {
        if (a === pageHost && b !== pageHost) return -1;
        if (b === pageHost && a !== pageHost) return 1;
      }
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });

    /** @type {import('../utils/page-media-utils.js').PageMediaItem[]} */
    const flat = [];
    for (const domain of domains) {
      const items = byDomain.get(domain) || [];
      items.sort((a, b) => String(a.url || '').localeCompare(String(b.url || '')));

      const section = document.createElement('section');
      section.className = 'kpv2-page-media-url-group';
      if (pageHost && domain === pageHost) section.classList.add('is-current-domain');

      const heading = document.createElement('h3');
      heading.className = 'kpv2-page-media-size-heading kpv2-page-media-url-domain';
      const title = document.createElement('span');
      title.textContent = domain;
      const count = document.createElement('span');
      count.className = 'kpv2-page-media-size-count';
      count.textContent = String(items.length);
      heading.appendChild(title);
      heading.appendChild(count);
      section.appendChild(heading);

      const rows = document.createElement('div');
      rows.className = 'kpv2-page-media-url-group-rows';

      const pathGroups = groupUrlItemsByPathPrefix(items, 2);
      for (const { prefix, items: pathItems } of pathGroups) {
        /** @type {HTMLElement} */
        let host = rows;
        if (prefix) {
          const sub = document.createElement('div');
          sub.className = 'kpv2-page-media-url-subpath';
          const subHeading = document.createElement('h4');
          subHeading.className = 'kpv2-page-media-url-subpath-heading';
          const subTitle = document.createElement('span');
          subTitle.textContent = prefix;
          const subCount = document.createElement('span');
          subCount.className = 'kpv2-page-media-size-count';
          subCount.textContent = String(pathItems.length);
          subHeading.appendChild(subTitle);
          subHeading.appendChild(subCount);
          sub.appendChild(subHeading);
          const subRows = document.createElement('div');
          subRows.className = 'kpv2-page-media-url-subpath-rows';
          sub.appendChild(subRows);
          rows.appendChild(sub);
          host = subRows;
        }

        for (const item of pathItems) {
          const flatIndex = flat.length;
          flat.push(item);
          host.appendChild(buildUrlRow(item, () => onItemActivate(flat, flatIndex), {
            displayUrl: prefix
              ? urlPathRelativeToPrefix(item.url, prefix)
              : urlPathDisplay(item.url)
          }));
        }
      }
      section.appendChild(rows);
      listEl.appendChild(section);
    }

    content.appendChild(listEl);
    return;
  }

  if (_activeTab === 'pageText') {
    content.classList.add('is-page-text-tab');
    const listEl = document.createElement('div');
    listEl.className = 'kpv2-page-media-text-list';
    list.forEach((item, index) => {
      listEl.appendChild(buildPageTextRow(item, () => onItemActivate(list, index)));
    });
    content.appendChild(listEl);
    return;
  }

  list.forEach((item, index) => {
    content.appendChild(buildFileCard(item, () => onItemActivate(list, index)));
  });
}

/**
 * @param {{ preserveScroll?: boolean }} [opts]
 */
function renderImageGrid(opts = {}) {
  if (!_overlay) return;
  const content = /** @type {HTMLElement} */ (/** @type {any} */ (_overlay)._content);
  if (!content) return;

  const scrollTop = opts.preserveScroll ? content.scrollTop : 0;
  while (content.firstChild) content.removeChild(content.firstChild);
  content.classList.add('is-image-tab');
  _cardByItem = new WeakMap();

  const images = groupPageMediaByCategory(_items).image;
  if (!images.length) {
    _imageFlatList = [];
    const empty = document.createElement('div');
    empty.className = 'kpv2-page-media-empty';
    empty.textContent = 'No image files found on this page.';
    content.appendChild(empty);
    return;
  }

  const { photos, posters } = partitionImageItems(images);
  const sizeGroups = groupImagesByDimensionSize(photos);
  /** @type {import('../utils/page-media-utils.js').PageMediaItem[]} */
  const flat = [];

  // One continuous grid for dimension-sorted photos (no section line breaks).
  const photoItems = sizeGroups.flatMap((g) => g.items);
  if (photoItems.length) {
    const grid = document.createElement('div');
    grid.className = 'kpv2-page-media-size-grid';
    for (const item of photoItems) {
      const flatIndex = flat.length;
      flat.push(item);
      const card = buildImageCard(item, () => onItemActivate(flat, flatIndex));
      _cardByItem.set(item, card);
      grid.appendChild(card);
    }
    content.appendChild(grid);
  }

  // Video posters stay in their own section below.
  if (posters.length) {
    const section = document.createElement('section');
    section.className = 'kpv2-page-media-size-group';
    section.dataset.sizeGroup = 'video-posters';

    const heading = document.createElement('h3');
    heading.className = 'kpv2-page-media-size-heading';
    const title = document.createElement('span');
    title.textContent = 'Video posters';
    const count = document.createElement('span');
    count.className = 'kpv2-page-media-size-count';
    count.textContent = String(posters.length);
    heading.appendChild(title);
    heading.appendChild(count);
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'kpv2-page-media-size-grid';
    for (const item of posters) {
      const flatIndex = flat.length;
      flat.push(item);
      const card = buildImageCard(item, () => onItemActivate(flat, flatIndex));
      _cardByItem.set(item, card);
      grid.appendChild(card);
    }
    section.appendChild(grid);
    content.appendChild(section);
  }

  if (!flat.length) {
    const empty = document.createElement('div');
    empty.className = 'kpv2-page-media-empty';
    empty.textContent = 'No image files found on this page.';
    content.appendChild(empty);
  }

  _imageFlatList = flat;
  if (opts.preserveScroll) {
    try { content.scrollTop = scrollTop; } catch { /* ignore */ }
  }
  applyImageAspectMode(_imageAspectMode);
}

/**
 * @param {import('../utils/page-media-utils.js').PageMediaItem} item
 * @param {() => void} onActivate
 * @returns {HTMLElement}
 */
function buildImageCard(item, onActivate) {
  const card = document.createElement('div');
  card.className = 'kpv2-page-media-card kpv2-page-media-card-image';
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  card.title = item.url;

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'kpv2-page-media-thumb-wrap';

  if (item.url) {
    const thumb = document.createElement('img');
    thumb.className = 'kpv2-page-media-thumb';
    thumb.loading = 'lazy';
    thumb.alt = item.label || '';
    thumb.draggable = false;
    thumb.src = item.url;
    thumb.addEventListener('error', () => {
      thumb.remove();
      const ph = document.createElement('div');
      ph.className = 'kpv2-page-media-glyph';
      ph.textContent = (item.ext || 'IMG').toUpperCase();
      thumbWrap.appendChild(ph);
    }, { once: true });
    thumb.addEventListener('load', () => {
      applyThumbFitMode(thumb, thumbWrap);
      const w = Number(thumb.naturalWidth) || 0;
      const h = Number(thumb.naturalHeight) || 0;
      if (w > 0 && h > 0) {
        const had = Number(item.width) > 0 && Number(item.height) > 0;
        item.width = w;
        item.height = h;
        updateImageCardMeta(card, item);
        if (!had && _activeTab === 'image') {
          scheduleImageRegroup();
        }
      }
    }, { once: true });
    // If already cached/complete, apply fit immediately.
    if (thumb.complete && thumb.naturalWidth > 0) {
      applyThumbFitMode(thumb, thumbWrap);
    }
    thumbWrap.appendChild(thumb);
  } else {
    const ph = document.createElement('div');
    ph.className = 'kpv2-page-media-glyph';
    ph.textContent = (item.ext || 'IMG').toUpperCase();
    thumbWrap.appendChild(ph);
  }
  thumbWrap.appendChild(buildHoverActions(item));
  card.appendChild(buildMetaRow(item));
  card.appendChild(thumbWrap);

  const info = document.createElement('div');
  info.className = 'kpv2-page-media-info';
  const name = document.createElement('div');
  name.className = 'kpv2-page-media-name';
  name.textContent = truncate(item.label || item.url, 36);
  const meta = document.createElement('div');
  meta.className = 'kpv2-page-media-meta';
  meta.textContent = formatImageFooterMeta(item);
  info.appendChild(name);
  info.appendChild(meta);
  card.appendChild(info);

  const activate = (e) => {
    if (e.target && /** @type {Element} */ (e.target).closest?.('.kpv2-page-media-actions')) return;
    e.preventDefault();
    e.stopPropagation();
    onActivate();
  };
  card.addEventListener('click', activate, true);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') activate(e);
  }, true);

  return card;
}

/**
 * @param {import('../utils/page-media-utils.js').PageMediaItem} item
 * @param {() => void} onActivate
 * @returns {HTMLElement}
 */
function buildVideoCard(item, onActivate) {
  const card = document.createElement('div');
  card.className = 'kpv2-page-media-card kpv2-page-media-card-video';
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  card.title = item.url;

  card.appendChild(buildMetaRow(item));

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'kpv2-page-media-thumb-wrap';

  const glyph = document.createElement('div');
  glyph.className = 'kpv2-page-media-glyph';
  glyph.textContent = (item.ext || 'VID').toUpperCase();
  thumbWrap.appendChild(glyph);

  const thumb = document.createElement('img');
  thumb.className = 'kpv2-page-media-thumb';
  thumb.alt = item.label || 'Video';
  thumb.draggable = false;
  thumb.hidden = true;
  thumbWrap.appendChild(thumb);
  thumbWrap.appendChild(buildHoverActions(item));
  card.appendChild(thumbWrap);

  const info = document.createElement('div');
  info.className = 'kpv2-page-media-info';
  const name = document.createElement('div');
  name.className = 'kpv2-page-media-name';
  name.textContent = truncate(item.label || item.url, 36);
  const meta = document.createElement('div');
  meta.className = 'kpv2-page-media-meta';
  meta.textContent = item.ext ? `.${item.ext}` : 'video';
  info.appendChild(name);
  info.appendChild(meta);
  card.appendChild(info);

  const activate = (e) => {
    if (e.target && /** @type {Element} */ (e.target).closest?.('.kpv2-page-media-actions')) return;
    e.preventDefault();
    e.stopPropagation();
    onActivate();
  };
  card.addEventListener('click', activate, true);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') activate(e);
  }, true);

  // Resolve poster / captured still asynchronously.
  resolveVideoThumbnail(item).then((thumbUrl) => {
    if (!thumbUrl || !card.isConnected) return;
    thumb.onload = () => {
      glyph.remove();
      thumb.hidden = false;
      applyThumbFitMode(thumb, thumbWrap);
      const w = Number(thumb.naturalWidth) || 0;
      const h = Number(thumb.naturalHeight) || 0;
      if (w > 0 && h > 0) {
        item.width = w;
        item.height = h;
        updateMetaRow(card, item);
      }
    };
    thumb.onerror = () => {
      thumb.remove();
    };
    thumb.src = thumbUrl;
  }).catch(() => { /* keep glyph */ });

  return card;
}

/**
 * @param {import('../utils/page-media-utils.js').PageMediaItem} item
 * @param {() => void} onActivate
 * @returns {HTMLElement}
 */
function buildPageTextRow(item, onActivate) {
  const row = document.createElement('div');
  row.className = 'kpv2-page-media-text-row';
  if (item.kind === 'article' || item.kind === 'main' || item.kind === 'full-page') {
    row.classList.add('is-full-page');
  }
  row.setAttribute('role', 'button');
  row.tabIndex = 0;
  row.title = 'Click to copy';

  const main = document.createElement('div');
  main.className = 'kpv2-page-media-text-main';

  const kind = document.createElement('div');
  kind.className = 'kpv2-page-media-text-kind';
  kind.textContent = formatPageTextKind(item);

  const body = document.createElement('div');
  body.className = 'kpv2-page-media-text-body';
  body.textContent = item.text || item.label || '';

  const meta = document.createElement('div');
  meta.className = 'kpv2-page-media-text-meta';
  const chars = String(item.text || '').length;
  meta.textContent = `${chars.toLocaleString()} chars · ${formatFileSize(item.fileSizeBytes)}`;

  main.appendChild(kind);
  main.appendChild(body);
  main.appendChild(meta);

  const actions = buildHoverActions(item);
  actions.classList.add('kpv2-page-media-text-actions');

  row.appendChild(main);
  row.appendChild(actions);

  const activate = (e) => {
    if (e.target && /** @type {Element} */ (e.target).closest?.('.kpv2-page-media-actions')) return;
    e.preventDefault();
    e.stopPropagation();
    onActivate();
  };
  row.addEventListener('click', activate, true);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') activate(e);
  }, true);

  return row;
}

/**
 * @param {import('../utils/page-media-utils.js').PageMediaItem} item
 * @returns {string}
 */
function formatPageTextKind(item) {
  const k = String(item?.kind || '');
  if (k === 'article') return 'Article';
  if (k === 'main') return 'Main';
  if (k === 'full-page') return 'Full page';
  return k || 'Text';
}

/**
 * @param {import('../utils/page-media-utils.js').PageMediaItem} item
 * @param {() => void} onActivate
 * @param {{ displayUrl?: string }} [opts]
 * @returns {HTMLElement}
 */
function buildUrlRow(item, onActivate, opts = {}) {
  const row = document.createElement('div');
  row.className = 'kpv2-page-media-url-row';
  row.setAttribute('role', 'button');
  row.tabIndex = 0;
  row.title = item.url;

  const main = document.createElement('div');
  main.className = 'kpv2-page-media-url-main';

  const displayUrl = opts.displayUrl || item.url;
  const linkTitle = String(item.label || '').trim();
  const showTitle = !!(
    linkTitle &&
    linkTitle !== item.url &&
    linkTitle !== displayUrl
  );

  if (showTitle) {
    const titleEl = document.createElement('div');
    titleEl.className = 'kpv2-page-media-url-title';
    titleEl.textContent = linkTitle;
    main.appendChild(titleEl);
  }

  const urlEl = document.createElement('div');
  urlEl.className = 'kpv2-page-media-url-text';
  urlEl.textContent = displayUrl;

  const meta = document.createElement('div');
  meta.className = 'kpv2-page-media-url-meta';
  const bits = [];
  if (item.ext) bits.push(`.${item.ext}`);
  if (item.kind && item.kind !== 'url') bits.push(item.kind);
  meta.textContent = bits.join(' · ') || 'link';

  main.appendChild(urlEl);
  main.appendChild(meta);

  const actions = buildHoverActions(item);
  actions.classList.add('kpv2-page-media-url-actions');

  row.appendChild(main);
  row.appendChild(actions);

  const activate = (e) => {
    if (e.target && /** @type {Element} */ (e.target).closest?.('.kpv2-page-media-actions')) return;
    e.preventDefault();
    e.stopPropagation();
    onActivate();
  };
  row.addEventListener('click', activate, true);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') activate(e);
  }, true);

  return row;
}

/**
 * @param {import('../utils/page-media-utils.js').PageMediaItem} item
 * @param {() => void} onActivate
 * @returns {HTMLElement}
 */
function buildFileCard(item, onActivate) {
  const card = document.createElement('div');
  card.className = 'kpv2-page-media-card';
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  card.title = item.url;

  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'kpv2-page-media-thumb-wrap';
  const glyph = document.createElement('div');
  glyph.className = 'kpv2-page-media-glyph';
  glyph.textContent = (item.ext || (_activeTab === 'video' ? 'VID' : 'DOC')).toUpperCase();
  mediaWrap.appendChild(glyph);
  mediaWrap.appendChild(buildHoverActions(item));
  card.appendChild(buildMetaRow(item));
  card.appendChild(mediaWrap);

  const info = document.createElement('div');
  info.className = 'kpv2-page-media-info';
  const name = document.createElement('div');
  name.className = 'kpv2-page-media-name';
  name.textContent = truncate(item.label || item.url, 42);
  const meta = document.createElement('div');
  meta.className = 'kpv2-page-media-meta';
  meta.textContent = item.ext ? `.${item.ext}` : item.kind;
  info.appendChild(name);
  info.appendChild(meta);
  card.appendChild(info);

  const activate = (e) => {
    if (e.target && /** @type {Element} */ (e.target).closest?.('.kpv2-page-media-actions')) return;
    e.preventDefault();
    e.stopPropagation();
    onActivate();
  };
  card.addEventListener('click', activate, true);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') activate(e);
  }, true);

  return card;
}

/**
 * Hover toolbar: Copy · Media Library · Download
 * @param {import('../utils/page-media-utils.js').PageMediaItem} item
 * @returns {HTMLElement}
 */
function buildHoverActions(item) {
  const bar = document.createElement('div');
  bar.className = 'kpv2-page-media-actions';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Item actions');

  const mk = (label, title, handler) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kpv2-page-media-action';
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await handler();
      } catch (err) {
        console.warn('[KeyPilot] Page Media action failed:', err);
        _notify('Action failed', 'error');
      }
    }, true);
    return btn;
  };

  bar.appendChild(mk('Copy', 'Copy to pasteboard', () => copyItemToPasteboard(item)));
  bar.appendChild(mk('Send', 'Send to Media Library', () => sendItemToMediaLibrary(item)));
  bar.appendChild(mk('Download', 'Download file', () => downloadItem(item)));
  return bar;
}

/**
 * @param {import('../utils/page-media-utils.js').PageMediaItem} item
 */
async function copyItemToPasteboard(item) {
  const pageText = item?.category === 'pageText' ? String(item.text || '') : '';
  if (pageText) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pageText);
        _notify('Text copied to pasteboard', 'success');
        return;
      }
    } catch { /* ignore */ }
    _notify('Could not copy to pasteboard', 'error');
    return;
  }

  if (!item?.url) {
    _notify('Nothing to copy', 'info');
    return;
  }

  if (item.category === 'image') {
    try {
      const blob = await fetchItemBlob(item.url);
      if (blob && blob.size > 0) {
        const mime = (blob.type && blob.type.startsWith('image/'))
          ? blob.type
          : (item.mimeType && String(item.mimeType).startsWith('image/') ? String(item.mimeType) : 'image/png');
        const ok = await writeImageBlobToClipboard(blob, mime);
        if (ok) {
          _notify('Copied to pasteboard', 'success');
          return;
        }
      }
    } catch (err) {
      console.warn('[KeyPilot] image copy failed, falling back to URL:', err);
    }
  }

  // Video / docs / image fallback: copy URL as text
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(item.url);
      _notify(
        item.category === 'image' ? 'Image URL copied' : 'URL copied to pasteboard',
        'success'
      );
      return;
    }
  } catch { /* ignore */ }

  _notify('Could not copy to pasteboard', 'error');
}

/**
 * @param {import('../utils/page-media-utils.js').PageMediaItem} item
 */
async function sendItemToMediaLibrary(item) {
  try {
    await _onSendToMediaLibrary(item);
  } catch (err) {
    console.warn('[KeyPilot] send to Media Library failed:', err);
    _notify('Could not send to Media Library', 'error');
  }
}

/**
 * @param {import('../utils/page-media-utils.js').PageMediaItem} item
 */
async function downloadItem(item) {
  if (item?.category === 'pageText' && item.text) {
    try {
      const blob = new Blob([String(item.text)], { type: 'text/plain;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const name = item.kind === 'article'
        ? 'article.txt'
        : item.kind === 'main'
          ? 'main.txt'
          : item.kind === 'full-page'
            ? 'page-text.txt'
            : `page-text-${item.kind || 'block'}.txt`;
      triggerDownload(objectUrl, name);
      setTimeout(() => {
        try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
      }, 2000);
      _notify('Download started', 'success');
      return;
    } catch {
      _notify('Could not download', 'error');
      return;
    }
  }

  if (!item?.url) {
    _notify('Nothing to download', 'info');
    return;
  }

  const filename = safeDownloadFilename(item);
  try {
    // Prefer blob download so cross-origin still works when CORS allows fetch.
    const blob = await fetchItemBlob(item.url);
    if (blob && blob.size > 0) {
      const objectUrl = URL.createObjectURL(blob);
      triggerDownload(objectUrl, filename);
      setTimeout(() => {
        try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
      }, 2000);
      _notify('Download started', 'success');
      return;
    }
  } catch { /* fall through */ }

  try {
    triggerDownload(item.url, filename);
    _notify('Download started', 'success');
  } catch {
    _notify('Could not download', 'error');
  }
}

/**
 * @param {string} url
 * @returns {Promise<Blob|null>}
 */
async function fetchItemBlob(url) {
  if (!url) return null;
  if (/^data:/i.test(url)) {
    const res = await fetch(url);
    return await res.blob();
  }
  const res = await fetch(url, { credentials: 'omit', cache: 'force-cache' });
  if (!res.ok) return null;
  return await res.blob();
}

/**
 * @param {Blob} blob
 * @param {string} mimeType
 * @returns {Promise<boolean>}
 */
async function writeImageBlobToClipboard(blob, mimeType) {
  if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function') return false;
  const type = (mimeType && String(mimeType).startsWith('image/'))
    ? String(mimeType)
    : (blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png');

  // Prefer PNG for ClipboardItem compatibility when possible.
  let outBlob = blob;
  let outType = type;
  if (type !== 'image/png' && typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bmp, 0, 0);
        const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (png && png.size > 0) {
          outBlob = png;
          outType = 'image/png';
        }
      }
      try { bmp.close(); } catch { /* ignore */ }
    } catch { /* keep original */ }
  }

  try {
    const item = new ClipboardItem({
      [outType]: Promise.resolve(outBlob)
    });
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    try {
      const item = new ClipboardItem({ [outType]: outBlob });
      await navigator.clipboard.write([item]);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * @param {string} url
 * @param {string} filename
 */
function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  a.rel = 'noopener';
  a.style.display = 'none';
  document.documentElement.appendChild(a);
  a.click();
  a.remove();
}

/**
 * @param {import('../utils/page-media-utils.js').PageMediaItem} item
 * @returns {string}
 */
function safeDownloadFilename(item) {
  let name = String(item.label || '').trim();
  if (!name || /^https?:/i.test(name)) {
    try {
      const u = new URL(item.url, document.baseURI);
      name = decodeURIComponent((u.pathname || '').split('/').pop() || '') || 'download';
    } catch {
      name = 'download';
    }
  }
  name = name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || 'download';
  const ext = String(item.ext || '').toLowerCase();
  if (ext && !new RegExp(`\\.${ext}$`, 'i').test(name)) {
    name += `.${ext}`;
  }
  return name;
}

/** @type {number|null} */
let _regroupTimer = null;
function scheduleImageRegroup() {
  if (_regroupTimer != null) return;
  _regroupTimer = window.setTimeout(() => {
    _regroupTimer = null;
    if (!isPageMediaOverlayOpen() || _activeTab !== 'image') return;
    renderImageGrid({ preserveScroll: true });
  }, 250);
}

/**
 * Cover-crop in square mode when larger than the frame; otherwise keep native
 * size centered (never scale up). In original mode, preserve image aspect.
 * @param {HTMLImageElement} thumb
 * @param {HTMLElement} wrap
 */
function applyThumbFitMode(thumb, wrap) {
  if (!thumb || !wrap) return;
  const nw = Number(thumb.naturalWidth) || 0;
  const nh = Number(thumb.naturalHeight) || 0;
  if (!(nw > 0 && nh > 0)) return;

  if (_imageAspectMode === 'original') {
    wrap.style.aspectRatio = `${nw} / ${nh}`;
    thumb.classList.remove('is-cover');
    thumb.classList.add('is-native', 'is-original');
    return;
  }

  wrap.style.aspectRatio = '';
  thumb.classList.remove('is-original');

  let cw = Number(wrap.clientWidth) || 0;
  let ch = Number(wrap.clientHeight) || 0;
  // Before layout, fall back to the square grid cell size from CSS (~140px min).
  if (!(cw > 0 && ch > 0)) {
    try {
      const rect = wrap.getBoundingClientRect();
      cw = Number(rect.width) || cw;
      ch = Number(rect.height) || ch;
    } catch { /* ignore */ }
  }
  if (!(cw > 0 && ch > 0)) {
    // Defer until the card is in layout.
    requestAnimationFrame(() => applyThumbFitMode(thumb, wrap));
    return;
  }

  const largerThanFrame = nw > cw || nh > ch;
  thumb.classList.toggle('is-cover', largerThanFrame);
  thumb.classList.toggle('is-native', !largerThanFrame);
}

/**
 * @param {HTMLElement} card
 * @param {import('../utils/page-media-utils.js').PageMediaItem} item
 */
function updateImageCardMeta(card, item) {
  const meta = card.querySelector('.kpv2-page-media-meta');
  if (meta) meta.textContent = formatImageFooterMeta(item);
  updateMetaRow(card, item);
}

/**
 * Dimensions (left) + file size (right) on a row above the thumbnail.
 * @param {import('../utils/page-media-utils.js').PageMediaItem} item
 * @returns {HTMLElement}
 */
function buildMetaRow(item) {
  const row = document.createElement('div');
  row.className = 'kpv2-page-media-meta-row';

  const dims = document.createElement('span');
  dims.className = 'kpv2-page-media-badge kpv2-page-media-badge-dims';
  dims.textContent = formatImageDimensions(item);

  const size = document.createElement('span');
  size.className = 'kpv2-page-media-badge kpv2-page-media-badge-size';
  size.textContent = formatFileSize(item?.fileSizeBytes);

  row.appendChild(dims);
  row.appendChild(size);
  return row;
}

/**
 * @param {HTMLElement} card
 * @param {import('../utils/page-media-utils.js').PageMediaItem} item
 */
function updateMetaRow(card, item) {
  const dims = card.querySelector('.kpv2-page-media-badge-dims');
  if (dims) dims.textContent = formatImageDimensions(item);
  const size = card.querySelector('.kpv2-page-media-badge-size');
  if (size) size.textContent = formatFileSize(item?.fileSizeBytes);
}

/**
 * Footer meta under the filename (type + dpi; dims/size live in the meta row).
 * @param {import('../utils/page-media-utils.js').PageMediaItem} item
 * @returns {string}
 */
function formatImageFooterMeta(item) {
  return [formatImageFileType(item), formatImageDpi(item)].join(' · ');
}

/**
 * @param {import('../utils/page-media-utils.js').PageMediaItem[]} list
 * @param {number} index
 */
function onItemActivate(list, index) {
  const item = list[index];
  if (!item) return;

  if (_activeTab === 'pageText') {
    copyItemToPasteboard(item);
    return;
  }

  if (_activeTab === 'text' || _activeTab === 'url') {
    openUrl(item.url);
    return;
  }

  if (_activeTab === 'video') {
    openFullView(list, index, 'video');
    return;
  }

  openFullView(list, index, 'image');
}

/**
 * @param {import('../utils/page-media-utils.js').PageMediaItem[]} list
 * @param {number} index
 * @param {'image'|'video'} mode
 */
function openFullView(list, index, mode) {
  if (!_overlay) return;
  _fullViewIndex = index;
  /** @type {any} */ (_overlay)._fullList = list;
  /** @type {any} */ (_overlay)._fullMode = mode;

  const modal = /** @type {HTMLElement} */ (/** @type {any} */ (_overlay)._fullView);
  const host = /** @type {HTMLElement} */ (/** @type {any} */ (_overlay)._fullMediaHost);
  const counter = /** @type {HTMLElement} */ (/** @type {any} */ (_overlay)._fullCounter);
  if (!modal || !host) return;

  while (host.firstChild) host.removeChild(host.firstChild);
  const item = list[index];
  if (!item) return;

  if (mode === 'video') {
    const video = document.createElement('video');
    video.className = 'kpv2-page-media-fullvideo';
    video.controls = true;
    video.autoplay = true;
    video.src = item.url;
    host.appendChild(video);

    const openLink = document.createElement('a');
    openLink.className = 'kpv2-page-media-openlink';
    openLink.href = item.url;
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    openLink.textContent = 'Open in new tab';
    openLink.addEventListener('click', (e) => e.stopPropagation(), true);
    host.appendChild(openLink);
  } else {
    const img = document.createElement('img');
    img.className = 'kpv2-page-media-fullimage';
    img.src = item.url;
    img.alt = item.label || '';
    host.appendChild(img);
  }

  if (counter) counter.textContent = `${index + 1} / ${list.length}`;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeFullView() {
  if (!_overlay) return;
  const modal = /** @type {HTMLElement} */ (/** @type {any} */ (_overlay)._fullView);
  const host = /** @type {HTMLElement} */ (/** @type {any} */ (_overlay)._fullMediaHost);
  if (host) {
    // Pause any playing video
    try {
      const v = host.querySelector('video');
      if (v) v.pause();
    } catch { /* ignore */ }
    while (host.firstChild) host.removeChild(host.firstChild);
  }
  if (modal) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

/**
 * @param {number} direction
 */
function navigateFullView(direction) {
  if (!_overlay) return;
  const list = /** @type {any} */ (_overlay)._fullList;
  const mode = /** @type {any} */ (_overlay)._fullMode || 'image';
  if (!Array.isArray(list) || !list.length) return;
  _fullViewIndex = (_fullViewIndex + direction + list.length) % list.length;
  openFullView(list, _fullViewIndex, mode);
}

/**
 * @param {string} url
 */
function openUrl(url) {
  if (!url) return;
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    } catch { /* ignore */ }
  }
}

/**
 * @param {string} s
 * @param {number} n
 */
function truncate(s, n) {
  const t = String(s || '');
  if (t.length <= n) return t;
  return t.slice(0, Math.max(0, n - 1)) + '…';
}

function ensureStyles(root) {
  if (!root) return;
  const c = NCT_DARK_UI_COLORS;
  const css = `
.kpv2-page-media-shell {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(15, 15, 16, 0.92);
  font-family: ${NCT_DARK_UI_FONT};
  color: ${c.fg};
}
.kpv2-page-media-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  background: ${NCT_DARK_UI_TITLEBAR_GRADIENT};
  border-bottom: ${NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM};
  flex-shrink: 0;
}
.kpv2-page-media-aspect-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  padding: 8px 14px;
  background: ${c.panel};
  border-bottom: 1px solid ${c.panelEdgeDark};
  box-shadow: 0 1px 0 ${c.panelEdge} inset;
}
.kpv2-page-media-aspect-bar[hidden] {
  display: none !important;
}
.kpv2-page-media-aspect-label {
  font-size: 11px;
  font-weight: 600;
  color: ${c.fgDim};
  letter-spacing: 0.02em;
  user-select: none;
  white-space: nowrap;
}
.kpv2-page-media-aspect-seg {
  font-size: 11px;
}
.kpv2-page-media-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
  flex-shrink: 0;
}
.kpv2-page-media-scale {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 3px 8px;
  border: 1px solid ${c.panelEdgeDark};
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  background: ${c.fieldBg};
  box-shadow: 0 0 0 1px ${c.panelEdge} inset;
}
.kpv2-page-media-scale-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${c.fgMute};
  user-select: none;
}
.kpv2-page-media-scale-edge {
  font-size: 10px;
  color: ${c.fgDim};
  font-variant-numeric: tabular-nums;
  user-select: none;
}
.kpv2-page-media-scale-value {
  min-width: 2.6em;
  font-size: 11px;
  font-weight: 600;
  color: ${c.fg};
  font-variant-numeric: tabular-nums;
  text-align: right;
  user-select: none;
}
.kpv2-page-media-scale-range {
  -webkit-appearance: none;
  appearance: none;
  width: 88px;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(90deg, ${c.panelEdgeDark} 0%, ${c.accent} 100%);
  outline: none;
  cursor: pointer;
  margin: 0;
  vertical-align: middle;
}
.kpv2-page-media-scale-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: ${NCT_DARK_UI_BTN_LIT_GRADIENT};
  border: ${NCT_DARK_UI_BTN_LIT_BORDER};
  box-shadow: 0 1px 3px rgba(0,0,0,0.55);
  cursor: pointer;
}
.kpv2-page-media-scale-range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: #3a5f7a;
  border: ${NCT_DARK_UI_BTN_LIT_BORDER};
  box-shadow: 0 1px 3px rgba(0,0,0,0.55);
  cursor: pointer;
}
.kpv2-page-media-scale-range::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(90deg, ${c.panelEdgeDark} 0%, ${c.accent} 100%);
}
.kpv2-page-media-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${c.fg};
}
.kpv2-page-media-count {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 2px;
  background: ${c.fieldBg};
  border: 1px solid ${c.panelEdgeDark};
  color: ${c.fgDim};
}
.kpv2-page-media-tabs {
  display: flex;
  gap: 4px;
  flex: 1;
  justify-content: center;
  min-width: 0;
}
.kpv2-page-media-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: ${NCT_DARK_UI_BTN_BORDER};
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  background: ${NCT_DARK_UI_BTN_GRADIENT};
  color: ${c.fgDim};
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.kpv2-page-media-tab:disabled {
  opacity: 0.35;
  cursor: default;
}
.kpv2-page-media-tab.is-active {
  background: ${NCT_DARK_UI_BTN_LIT_GRADIENT};
  border: ${NCT_DARK_UI_BTN_LIT_BORDER};
  color: #e8f0f8;
}
.kpv2-page-media-tab-badge {
  font-size: 10px;
  opacity: 0.85;
}
.kpv2-page-media-close {
  padding: 5px 12px;
  border: ${NCT_DARK_UI_BTN_BORDER};
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  background: ${NCT_DARK_UI_BTN_GRADIENT};
  color: ${c.fg};
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.kpv2-page-media-close:hover {
  color: #fff;
}
.kpv2-page-media-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
  display: grid;
  --kpv2-pm-image-scale: 1.5;
  grid-template-columns: repeat(auto-fill, minmax(calc(180px * var(--kpv2-pm-image-scale, 1.5)), 1fr));
  gap: calc(12px * var(--kpv2-pm-image-scale, 1.5));
  align-content: flex-start;
}
.kpv2-page-media-content.is-image-tab,
.kpv2-page-media-content.is-video-tab {
  display: block;
  padding: 12px 16px 24px;
}
.kpv2-page-media-content .kpv2-page-media-size-grid {
  grid-template-columns: repeat(auto-fill, minmax(calc(140px * var(--kpv2-pm-image-scale, 1.5)), 1fr));
  gap: calc(12px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-meta-row {
  min-height: calc(22px * var(--kpv2-pm-image-scale, 1.5));
  padding: calc(5px * var(--kpv2-pm-image-scale, 1.5)) calc(8px * var(--kpv2-pm-image-scale, 1.5));
  gap: calc(8px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-badge {
  font-size: calc(10px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-info {
  padding: calc(8px * var(--kpv2-pm-image-scale, 1.5)) calc(10px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-name {
  font-size: calc(11px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-meta {
  margin-top: calc(4px * var(--kpv2-pm-image-scale, 1.5));
  font-size: calc(10px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-size-heading {
  font-size: calc(12px * var(--kpv2-pm-image-scale, 1.5));
  margin-bottom: calc(10px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-size-count {
  font-size: calc(11px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-action {
  font-size: calc(10px * var(--kpv2-pm-image-scale, 1.5));
  padding: calc(5px * var(--kpv2-pm-image-scale, 1.5)) calc(4px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-glyph {
  font-size: calc(18px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-empty {
  font-size: calc(13px * var(--kpv2-pm-image-scale, 1.5));
  padding: calc(48px * var(--kpv2-pm-image-scale, 1.5)) calc(16px * var(--kpv2-pm-image-scale, 1.5));
}
/* Text tab */
.kpv2-page-media-content .kpv2-page-media-text-list {
  gap: calc(6px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-text-row {
  gap: calc(10px * var(--kpv2-pm-image-scale, 1.5));
  padding: calc(10px * var(--kpv2-pm-image-scale, 1.5)) calc(12px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-text-kind {
  font-size: calc(10px * var(--kpv2-pm-image-scale, 1.5));
  margin-bottom: calc(4px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-text-body {
  font-size: calc(12px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-text-meta {
  margin-top: calc(6px * var(--kpv2-pm-image-scale, 1.5));
  font-size: calc(10px * var(--kpv2-pm-image-scale, 1.5));
}
/* URLs tab */
.kpv2-page-media-content .kpv2-page-media-url-list {
  gap: calc(14px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-url-group {
  padding: calc(10px * var(--kpv2-pm-image-scale, 1.5)) calc(12px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-url-domain {
  font-size: calc(12px * var(--kpv2-pm-image-scale, 1.5));
  margin-bottom: calc(10px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-url-group-rows {
  gap: calc(8px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-url-subpath {
  gap: calc(6px * var(--kpv2-pm-image-scale, 1.5));
  padding: calc(8px * var(--kpv2-pm-image-scale, 1.5));
  flex-basis: calc(280px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-url-subpath-heading {
  font-size: calc(11px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-url-subpath-rows {
  gap: calc(6px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-url-row {
  flex-basis: calc(180px * var(--kpv2-pm-image-scale, 1.5));
  max-width: calc(320px * var(--kpv2-pm-image-scale, 1.5));
  min-width: calc(140px * var(--kpv2-pm-image-scale, 1.5));
  gap: calc(6px * var(--kpv2-pm-image-scale, 1.5));
  padding: calc(8px * var(--kpv2-pm-image-scale, 1.5)) calc(10px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-url-title {
  font-size: calc(12px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-url-text {
  font-size: calc(11px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content .kpv2-page-media-url-meta {
  font-size: calc(10px * var(--kpv2-pm-image-scale, 1.5));
}
.kpv2-page-media-content.is-url-tab {
  display: block;
  padding: 8px 12px 24px;
}
.kpv2-page-media-url-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: stretch;
}
.kpv2-page-media-url-group {
  margin-bottom: 0;
  padding: 10px 12px 10px;
  border: 1px solid ${c.panelEdgeDark};
  border-radius: 3px;
  background: ${c.panel};
  box-shadow: 0 0 0 1px ${c.panelEdge} inset;
  min-width: 0;
}
.kpv2-page-media-url-group.is-current-domain {
  border-color: ${c.accent};
  background: linear-gradient(180deg, rgba(74,144,200,0.10) 0%, ${c.panel} 36%);
}
.kpv2-page-media-url-domain {
  margin: 0 0 10px;
  padding: 0 2px;
  color: ${c.accent};
  text-transform: none;
  letter-spacing: 0;
  font-size: 12px;
  font-weight: 700;
  word-break: break-all;
}
.kpv2-page-media-url-group-rows {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
  align-items: stretch;
}
.kpv2-page-media-url-subpath {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid ${c.panelEdgeDark};
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.18);
  min-width: min(100%, 220px);
  flex: 1 1 280px;
  max-width: 100%;
}
.kpv2-page-media-url-subpath-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  padding: 0 2px;
  font-size: 11px;
  font-weight: 600;
  color: ${c.fgDim};
  word-break: break-all;
}
.kpv2-page-media-url-subpath-rows {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 6px;
  align-items: stretch;
}
.kpv2-page-media-url-group .kpv2-page-media-url-row {
  margin-bottom: 0;
  flex: 1 1 180px;
  max-width: 320px;
  min-width: 140px;
}
.kpv2-page-media-content.is-page-text-tab {
  display: block;
  padding: 8px 12px 24px;
}
.kpv2-page-media-text-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.kpv2-page-media-text-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid ${c.panelEdgeDark};
  border-radius: 3px;
  background: ${c.panel};
  box-shadow: 0 0 0 1px ${c.panelEdge} inset;
  cursor: pointer;
  color: inherit;
}
.kpv2-page-media-text-row.is-full-page {
  border-color: ${c.accent};
  background: linear-gradient(180deg, rgba(74,144,200,0.12) 0%, ${c.panel} 40%);
}
.kpv2-page-media-text-row:hover {
  border-color: ${c.accent};
}
.kpv2-page-media-text-row:hover .kpv2-page-media-text-actions,
.kpv2-page-media-text-row:focus-within .kpv2-page-media-text-actions {
  opacity: 1;
  pointer-events: auto;
}
.kpv2-page-media-text-main {
  flex: 1;
  min-width: 0;
}
.kpv2-page-media-text-kind {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${c.accent};
  margin-bottom: 4px;
}
.kpv2-page-media-text-body {
  font-size: 12px;
  color: ${c.fg};
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 9.5em;
  overflow: hidden;
}
.kpv2-page-media-text-row.is-full-page .kpv2-page-media-text-body {
  max-height: 14em;
}
.kpv2-page-media-text-meta {
  margin-top: 6px;
  font-size: 10px;
  color: ${c.fgMute};
}
.kpv2-page-media-text-actions.kpv2-page-media-actions {
  position: static;
  left: auto;
  right: auto;
  bottom: auto;
  flex: 0 0 auto;
  width: auto;
  max-width: 220px;
  opacity: 0;
  pointer-events: none;
  margin-top: 2px;
}
.kpv2-page-media-url-row {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid ${c.panelEdgeDark};
  border-radius: 3px;
  background: ${c.fieldBg};
  box-shadow: none;
  cursor: pointer;
  color: inherit;
}
.kpv2-page-media-url-row:hover {
  border-color: ${c.accent};
}
.kpv2-page-media-url-row:hover .kpv2-page-media-url-actions,
.kpv2-page-media-url-row:focus-within .kpv2-page-media-url-actions {
  opacity: 1;
  pointer-events: auto;
}
.kpv2-page-media-url-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.kpv2-page-media-url-title {
  font-size: 12px;
  font-weight: 600;
  color: ${c.fg};
  line-height: 1.35;
  word-break: break-word;
}
.kpv2-page-media-url-text {
  font-size: 11px;
  color: ${c.fgDim};
  word-break: break-all;
  line-height: 1.35;
}
.kpv2-page-media-url-meta {
  margin-top: 2px;
  font-size: 10px;
  color: ${c.fgMute};
  text-transform: lowercase;
}
.kpv2-page-media-url-actions.kpv2-page-media-actions {
  position: static;
  left: auto;
  right: auto;
  bottom: auto;
  flex: 0 0 auto;
  width: auto;
  max-width: 220px;
  opacity: 0;
  pointer-events: none;
}
.kpv2-page-media-size-group {
  margin-bottom: 18px;
}
.kpv2-page-media-size-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 10px;
  padding: 0 2px;
  font-size: 12px;
  font-weight: 600;
  color: ${c.fgDim};
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.kpv2-page-media-size-count {
  font-size: 11px;
  font-weight: 500;
  color: ${c.fgMute};
  text-transform: none;
  letter-spacing: 0;
}
.kpv2-page-media-size-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  align-content: flex-start;
}
.kpv2-page-media-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 48px 16px;
  color: ${c.fgMute};
  font-size: 13px;
}
.kpv2-page-media-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 0;
  margin: 0;
  border: 1px solid ${c.panelEdgeDark};
  border-radius: 3px;
  background: ${c.panel};
  box-shadow: 0 0 0 1px ${c.panelEdge} inset;
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  color: inherit;
  font: inherit;
}
.kpv2-page-media-card:hover {
  border-color: ${c.accent};
}
.kpv2-page-media-card:hover .kpv2-page-media-actions,
.kpv2-page-media-card:focus-within .kpv2-page-media-actions {
  opacity: 1;
  pointer-events: auto;
}
.kpv2-page-media-thumb-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  /* Checkerboard so transparent PNGs / WebPs read clearly */
  background-color: #1a1a1a;
  background-image:
    linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
    linear-gradient(-45deg, transparent 75%, #2a2a2a 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.kpv2-page-media-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 8px;
  background: ${c.fieldBg};
  border-bottom: 1px solid ${c.panelEdgeDark};
  min-height: 22px;
  box-sizing: border-box;
}
.kpv2-page-media-badge {
  max-width: 50%;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: 0.01em;
  color: ${c.fgDim};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kpv2-page-media-badge-dims {
  text-align: left;
}
.kpv2-page-media-badge-size {
  text-align: right;
  margin-left: auto;
}
.kpv2-page-media-actions {
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 6px;
  display: flex;
  gap: 4px;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
  z-index: 2;
}
.kpv2-page-media-action {
  flex: 1;
  min-width: 0;
  padding: 5px 4px;
  border: ${NCT_DARK_UI_BTN_BORDER};
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  background: ${NCT_DARK_UI_BTN_GRADIENT};
  color: ${c.fg};
  font: inherit;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kpv2-page-media-action:hover {
  background: ${NCT_DARK_UI_BTN_LIT_GRADIENT};
  border: ${NCT_DARK_UI_BTN_LIT_BORDER};
  color: #e8f0f8;
}
.kpv2-page-media-thumb {
  display: block;
  background: transparent;
}
.kpv2-page-media-thumb.is-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
.kpv2-page-media-thumb.is-native {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: none;
  object-position: center;
}
.kpv2-page-media-content.is-aspect-original .kpv2-page-media-card-image .kpv2-page-media-thumb-wrap {
  aspect-ratio: auto;
  min-height: 72px;
}
.kpv2-page-media-content.is-aspect-original .kpv2-page-media-card-image .kpv2-page-media-thumb.is-original {
  width: 100%;
  height: auto;
  max-width: 100%;
  max-height: none;
  object-fit: contain;
  object-position: center;
}
.kpv2-page-media-glyph {
  width: 100%;
  aspect-ratio: 1 / 1;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${c.fieldBg};
  color: ${c.accent};
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.kpv2-page-media-thumb-wrap .kpv2-page-media-glyph {
  position: absolute;
  inset: 0;
  min-height: 0;
  aspect-ratio: auto;
}
.kpv2-page-media-info {
  padding: 8px 10px;
  border-top: 1px solid ${c.panelEdgeDark};
}
.kpv2-page-media-name {
  font-size: 11px;
  color: ${c.fg};
  word-break: break-all;
  line-height: 1.3;
}
.kpv2-page-media-meta {
  margin-top: 4px;
  font-size: 10px;
  color: ${c.fgMute};
  line-height: 1.35;
  letter-spacing: 0.01em;
  text-transform: none;
}
.kpv2-page-media-fullview {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 1;
  background: rgba(0, 0, 0, 0.92);
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}
.kpv2-page-media-fullview.is-open {
  display: flex;
}
.kpv2-page-media-fullmedia {
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  cursor: default;
}
.kpv2-page-media-fullimage {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 3px;
}
.kpv2-page-media-fullvideo {
  max-width: 90vw;
  max-height: 80vh;
  background: #000;
}
.kpv2-page-media-openlink {
  color: ${c.accent};
  font-size: 12px;
}
.kpv2-page-media-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border: ${NCT_DARK_UI_BTN_BORDER};
  border-radius: 50%;
  background: rgba(0,0,0,0.55);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
}
.kpv2-page-media-nav-prev { left: 20px; }
.kpv2-page-media-nav-next { right: 20px; }
.kpv2-page-media-fullcounter {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 14px;
  border-radius: 2px;
  background: rgba(0,0,0,0.7);
  font-size: 12px;
  color: ${c.fg};
}
@media (max-width: 640px) {
  .kpv2-page-media-content {
    grid-template-columns: repeat(auto-fill, minmax(calc(140px * var(--kpv2-pm-image-scale, 1.5)), 1fr));
    padding: 10px;
    gap: calc(8px * var(--kpv2-pm-image-scale, 1.5));
  }
  .kpv2-page-media-size-grid {
    grid-template-columns: repeat(auto-fill, minmax(calc(110px * var(--kpv2-pm-image-scale, 1.5)), 1fr));
    gap: calc(8px * var(--kpv2-pm-image-scale, 1.5));
  }
  .kpv2-page-media-header {
    flex-wrap: wrap;
  }
  .kpv2-page-media-scale-range {
    width: 72px;
  }
}
`;
  injectChromeStyles(root, {
    attr: 'data-kp-page-media-styles',
    css
  });
}
