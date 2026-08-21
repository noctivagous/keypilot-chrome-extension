/**
 * Media Library overlay — personal scrapbook gallery (M key).
 * Left column: media types + domain children under Images, Videos, Documents, and URLs.
 * DOM-only (TrustedHTML-safe). Prefixes: kpv2-media-lib-*.
 */

import {
  NCT_DARK_UI_COLORS,
  NCT_DARK_UI_FONT,
  NCT_DARK_UI_BTN_GRADIENT,
  NCT_DARK_UI_BTN_BORDER,
  NCT_DARK_UI_BTN_RADIUS,
  NCT_DARK_UI_BTN_LIT_GRADIENT,
  NCT_DARK_UI_BTN_LIT_BORDER,
  NCT_DARK_UI_PANEL_BORDER,
  NCT_DARK_UI_PANEL_RADIUS,
  NCT_DARK_UI_PANEL_BOX_SHADOW,
  NCT_DARK_UI_BACKDROP_CLASS,
  NCT_DARK_UI_SCROLLBAR_CLASS,
  NCT_DARK_UI_TITLEBAR_GRADIENT,
  NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM,
  getNctDarkUiBackdropCss,
  getNctDarkUiScrollbarCss
} from './nct-dark-ui.js';
import { formatFileSize } from '../utils/page-media-utils.js';
import { Z_INDEX } from '../config/constants.js';
import { MSG } from '../messaging/types.js';
import {
  installContentRuntimeRouter,
  registerContentRuntimeHandler
} from '../messaging/content-runtime-router.js';
import { ensureOpenChromeShadow, injectChromeStyles } from './kp-chrome-shadow.js';
import {
  listMediaLibrary,
  getMediaLibraryOriginal,
  deleteMediaLibraryItems,
  zipMediaLibrary,
  downloadBlob
} from '../modules/media-library-client.js';

const OVERLAY_ID = 'kpv2-media-lib-overlay';

/** @type {HTMLElement|null} */
let _overlay = null;
/** @type {(() => void)|null} */
let _onClose = null;
/** @type {((e: KeyboardEvent) => void)|null} */
let _keyHandler = null;
/** @type {(msg: string, type?: string) => void} */
let _notify = () => {};
/** @type {'image'|'video'|'document'|'url'} */
let _kind = 'image';
/** @type {string} */
let _domain = '';
/** @type {{ image: boolean, video: boolean, document: boolean, url: boolean }} */
let _navExpanded = { image: true, video: true, document: true, url: true };
/** @type {import('../utils/media-library-service.js').MediaLibraryItemMeta[]} */
let _items = [];
/** @type {Array<{ domain: string, count: number }>} */
let _domains = [];
/** @type {{ image: number, video: number, document: number, url: number }} */
let _counts = { image: 0, video: 0, document: 0, url: 0 };
/** @type {Set<string>} */
let _selected = new Set();
/** @type {string|null} */
let _anchorId = null;
/** @type {string|null} */
let _fullViewId = null;
/** @type {string|null} */
let _fullObjectUrl = null;
/** @type {string|null} */
let _prevOverflow = null;
/** @type {number} */
let _loadGen = 0;
/** @type {ReturnType<typeof setTimeout>|0} */
let _remoteReloadTimer = 0;

function emptyCounts() {
  return { image: 0, video: 0, document: 0, url: 0 };
}

function kindHasGallery(kind) {
  return kind === 'image' || kind === 'url' || kind === 'video' || kind === 'document';
}

function getOverlayRoot() {
  return _overlay?.shadowRoot || _overlay;
}

/**
 * @returns {boolean}
 */
export function isMediaLibraryOverlayOpen() {
  return !!_overlay && !!document.getElementById(OVERLAY_ID);
}

/**
 * Close full-view if open, else the whole overlay.
 * @returns {boolean}
 */
export function requestCloseMediaLibraryOverlay() {
  if (!isMediaLibraryOverlayOpen()) return false;
  const modal = getOverlayRoot()?.querySelector('.kpv2-media-lib-fullview');
  if (modal && modal.classList.contains('is-open')) {
    closeFullView();
    return true;
  }
  closeMediaLibraryOverlay();
  return true;
}

export function closeMediaLibraryOverlay() {
  if (_remoteReloadTimer) {
    try { clearTimeout(_remoteReloadTimer); } catch { /* ignore */ }
    _remoteReloadTimer = 0;
  }
  if (_keyHandler) {
    try { document.removeEventListener('keydown', _keyHandler, true); } catch { /* ignore */ }
    _keyHandler = null;
  }
  revokeFullObjectUrl();
  if (_overlay) {
    try { _overlay.remove(); } catch { /* ignore */ }
    _overlay = null;
  }
  if (_prevOverflow != null) {
    try { document.body.style.overflow = _prevOverflow; } catch { /* ignore */ }
    _prevOverflow = null;
  }
  _items = [];
  _domains = [];
  _selected = new Set();
  _anchorId = null;
  _fullViewId = null;
  const cb = _onClose;
  _onClose = null;
  if (typeof cb === 'function') {
    try { cb(); } catch { /* ignore */ }
  }
}

function revokeFullObjectUrl() {
  if (_fullObjectUrl) {
    try { URL.revokeObjectURL(_fullObjectUrl); } catch { /* ignore */ }
    _fullObjectUrl = null;
  }
}

/**
 * @param {{
 *   onClose?: () => void,
 *   onNotify?: (message: string, type?: string) => void
 * }} [opts]
 */
export async function openMediaLibraryOverlay(opts = {}) {
  closeMediaLibraryOverlay();

  _onClose = typeof opts.onClose === 'function' ? opts.onClose : null;
  _notify = typeof opts.onNotify === 'function' ? opts.onNotify : () => {};
  _kind = 'image';
  _domain = '';
  _navExpanded = { image: true, video: true, url: true };
  _selected = new Set();
  _anchorId = null;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'kpv2-media-lib-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Media Library');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: ${Z_INDEX.POPUP_PANEL_MAX + 20};
    pointer-events: auto;
  `;
  const shadowRoot = ensureOpenChromeShadow(overlay, { id: 'media-lib' });
  const mount = shadowRoot || overlay;
  ensureStyles(mount);

  const backdrop = document.createElement('div');
  backdrop.className = NCT_DARK_UI_BACKDROP_CLASS;
  backdrop.setAttribute('aria-hidden', 'true');

  const shell = document.createElement('div');
  shell.className = 'kpv2-media-lib-shell';

  const header = document.createElement('div');
  header.className = 'kpv2-media-lib-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'kpv2-media-lib-title-wrap';
  const title = document.createElement('h2');
  title.className = 'kpv2-media-lib-title';
  title.textContent = 'Media Library';
  const subtitle = document.createElement('span');
  subtitle.className = 'kpv2-media-lib-subtitle';
  subtitle.textContent = 'Personal scrapbook';
  titleWrap.appendChild(title);
  titleWrap.appendChild(subtitle);

  const toolbar = document.createElement('div');
  toolbar.className = 'kpv2-media-lib-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Library actions');

  const zipCatBtn = makeHeaderBtn('Download zip', 'Download this category as a zip', () => zipCurrentView());
  zipCatBtn.dataset.role = 'zip-category';
  const zipSelBtn = makeHeaderBtn('Download selected', 'Download selected items as a zip', () => zipSelection());
  zipSelBtn.dataset.role = 'zip-selected';
  zipSelBtn.disabled = true;
  const delBtn = makeHeaderBtn('Delete selected', 'Remove selected items from the library', () => deleteSelection());
  delBtn.dataset.role = 'delete-selected';
  delBtn.disabled = true;

  toolbar.appendChild(zipCatBtn);
  toolbar.appendChild(zipSelBtn);
  toolbar.appendChild(delBtn);

  const closeBtn = makeHeaderBtn('Close', 'Close Media Library', () => closeMediaLibraryOverlay());
  closeBtn.classList.add('kpv2-media-lib-close');

  header.appendChild(titleWrap);
  header.appendChild(toolbar);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'kpv2-media-lib-body';

  const sidebar = document.createElement('nav');
  sidebar.className = `kpv2-media-lib-sidebar ${NCT_DARK_UI_SCROLLBAR_CLASS}`;
  sidebar.setAttribute('aria-label', 'Media types');

  const content = document.createElement('div');
  content.className = `kpv2-media-lib-content ${NCT_DARK_UI_SCROLLBAR_CLASS}`;
  content.id = 'kpv2-media-lib-grid';

  const fullView = document.createElement('div');
  fullView.className = 'kpv2-media-lib-fullview';
  fullView.setAttribute('aria-hidden', 'true');

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'kpv2-media-lib-nav kpv2-media-lib-nav-prev';
  prevBtn.textContent = '‹';
  prevBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigateFullView(-1);
  }, true);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'kpv2-media-lib-nav kpv2-media-lib-nav-next';
  nextBtn.textContent = '›';
  nextBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigateFullView(1);
  }, true);

  const fullMediaHost = document.createElement('div');
  fullMediaHost.className = 'kpv2-media-lib-fullmedia';
  fullMediaHost.addEventListener('click', (e) => e.stopPropagation(), true);

  const counter = document.createElement('div');
  counter.className = 'kpv2-media-lib-fullcounter';

  fullView.appendChild(prevBtn);
  fullView.appendChild(fullMediaHost);
  fullView.appendChild(nextBtn);
  fullView.appendChild(counter);
  fullView.addEventListener('click', () => closeFullView(), true);

  body.appendChild(sidebar);
  body.appendChild(content);

  shell.appendChild(header);
  shell.appendChild(body);
  shell.appendChild(fullView);
  mount.appendChild(backdrop);
  mount.appendChild(shell);

  /** @type {any} */ (overlay)._sidebar = sidebar;
  /** @type {any} */ (overlay)._content = content;
  /** @type {any} */ (overlay)._fullView = fullView;
  /** @type {any} */ (overlay)._fullMediaHost = fullMediaHost;
  /** @type {any} */ (overlay)._fullCounter = counter;
  /** @type {any} */ (overlay)._zipSelBtn = zipSelBtn;
  /** @type {any} */ (overlay)._delBtn = delBtn;

  document.body.appendChild(overlay);
  _overlay = overlay;

  try {
    _prevOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
  } catch { /* ignore */ }

  _keyHandler = (e) => {
    if (e.key === 'Escape' || e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      try { e.stopImmediatePropagation(); } catch { /* ignore */ }
      requestCloseMediaLibraryOverlay();
      return;
    }
    if (e.key === 'ArrowLeft' && _fullViewId) {
      e.preventDefault();
      navigateFullView(-1);
    } else if (e.key === 'ArrowRight' && _fullViewId) {
      e.preventDefault();
      navigateFullView(1);
    }
  };
  document.addEventListener('keydown', _keyHandler, true);

  await reload();
}

/**
 * @param {string} label
 * @param {string} title
 * @param {() => void|Promise<void>} handler
 * @returns {HTMLButtonElement}
 */
function makeHeaderBtn(label, title, handler) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kpv2-media-lib-btn';
  btn.textContent = label;
  btn.title = title;
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.disabled) return;
    try {
      await handler();
    } catch (err) {
      console.warn('[KeyPilot] Media Library action failed:', err);
      _notify('Action failed', 'error');
    }
  }, true);
  return btn;
}

function updateSelectionButtons() {
  const n = _selected.size;
  const zipSel = /** @type {any} */ (_overlay)?._zipSelBtn;
  const delBtn = /** @type {any} */ (_overlay)?._delBtn;
  if (zipSel) {
    zipSel.disabled = n === 0;
    zipSel.textContent = n > 0 ? `Download selected (${n})` : 'Download selected';
  }
  if (delBtn) {
    delBtn.disabled = n === 0;
    delBtn.textContent = n > 0 ? `Delete selected (${n})` : 'Delete selected';
  }
}

async function reload() {
  if (!isMediaLibraryOverlayOpen()) return;
  const gen = ++_loadGen;
  try {
    const result = await listMediaLibrary({
      kind: _kind,
      domain: kindHasGallery(_kind) ? _domain : '',
      includeThumbs: _kind === 'image' || _kind === 'video'
    });
    if (gen !== _loadGen || !isMediaLibraryOverlayOpen()) return;
    if (!result?.success) {
      _notify(result?.error || 'Could not load Media Library', 'error');
      _items = [];
      _domains = [];
      _counts = emptyCounts();
    } else {
      _items = Array.isArray(result.items) ? result.items : [];
      _domains = Array.isArray(result.domains) ? result.domains : [];
      _counts = result.counts || emptyCounts();
    }
    const keep = new Set(_items.map((it) => it.id));
    for (const id of Array.from(_selected)) {
      if (!keep.has(id)) _selected.delete(id);
    }
    if (_fullViewId && !keep.has(_fullViewId)) {
      closeFullView();
    }
    renderSidebar();
    renderGrid();
    updateSelectionButtons();
  } catch (err) {
    if (gen !== _loadGen) return;
    console.warn('[KeyPilot] Media Library list failed:', err);
    _notify('Could not load Media Library', 'error');
  }
}

function scheduleRemoteReload() {
  if (!isMediaLibraryOverlayOpen()) return;
  if (_remoteReloadTimer) {
    try { clearTimeout(_remoteReloadTimer); } catch { /* ignore */ }
  }
  _remoteReloadTimer = setTimeout(() => {
    _remoteReloadTimer = 0;
    void reload();
  }, 50);
}

try {
  installContentRuntimeRouter();
  registerContentRuntimeHandler(MSG.MEDIA_LIBRARY_CHANGED, (msg) => {
    if (msg?.type !== MSG.MEDIA_LIBRARY_CHANGED) return;
    if (typeof window !== 'undefined' && window !== window.top) return;
    scheduleRemoteReload();
  });
} catch { /* ignore */ }

function renderSidebar() {
  const sidebar = /** @type {HTMLElement|null} */ (/** @type {any} */ (_overlay)?._sidebar);
  if (!sidebar) return;
  sidebar.replaceChildren();

  sidebar.appendChild(buildKindTab({
    kind: 'image',
    label: 'Images',
    count: _counts.image,
    enabled: true,
    expandable: true,
    expanded: !!_navExpanded.image
  }));

  if (_navExpanded.image && _kind === 'image') {
    for (const { domain, count } of _domains) {
      sidebar.appendChild(buildDomainRow(domain, count));
    }
  }

  sidebar.appendChild(buildKindTab({
    kind: 'url',
    label: 'URLs',
    count: _counts.url || 0,
    enabled: true,
    expandable: true,
    expanded: !!_navExpanded.url
  }));

  if (_navExpanded.url && _kind === 'url') {
    for (const { domain, count } of _domains) {
      sidebar.appendChild(buildDomainRow(domain, count));
    }
  }

  sidebar.appendChild(buildKindTab({
    kind: 'video',
    label: 'Videos',
    count: _counts.video || 0,
    enabled: true,
    expandable: true,
    expanded: !!_navExpanded.video
  }));

  if (_navExpanded.video && _kind === 'video') {
    for (const { domain, count } of _domains) {
      sidebar.appendChild(buildDomainRow(domain, count));
    }
  }

  sidebar.appendChild(buildKindTab({
    kind: 'document',
    label: 'Documents',
    count: _counts.document || 0,
    enabled: true,
    expandable: true,
    expanded: !!_navExpanded.document
  }));

  if (_navExpanded.document && _kind === 'document') {
    for (const { domain, count } of _domains) {
      sidebar.appendChild(buildDomainRow(domain, count));
    }
  }
}

/**
 * @param {{
 *   kind: 'image'|'video'|'document'|'url',
 *   label: string,
 *   count: number,
 *   enabled: boolean,
 *   expandable?: boolean,
 *   expanded?: boolean
 * }} def
 */
function buildKindTab(def) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kpv2-media-lib-tab';
  if (def.enabled && _kind === def.kind && !_domain) btn.classList.add('is-active');
  if (!def.enabled) {
    btn.classList.add('is-disabled');
    btn.disabled = true;
    btn.title = 'Coming soon';
  }
  btn.setAttribute('role', 'tab');
  btn.setAttribute('aria-selected', def.enabled && _kind === def.kind && !_domain ? 'true' : 'false');

  const label = document.createElement('span');
  label.className = 'kpv2-media-lib-tab-label';
  if (def.expandable) {
    const chev = document.createElement('span');
    chev.className = 'kpv2-media-lib-chev';
    chev.textContent = def.expanded ? '▾' : '▸';
    label.appendChild(chev);
  }
  const name = document.createElement('span');
  name.textContent = def.label;
  label.appendChild(name);

  const badge = document.createElement('span');
  badge.className = 'kpv2-media-lib-tab-count';
  badge.textContent = def.enabled ? String(def.count) : 'soon';

  btn.appendChild(label);
  btn.appendChild(badge);

  if (def.enabled) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const clickingSame = _kind === def.kind && !_domain;
      if (def.expandable && clickingSame) {
        _navExpanded[def.kind] = !_navExpanded[def.kind];
        renderSidebar();
        return;
      }
      _kind = def.kind;
      _domain = '';
      if (def.expandable) _navExpanded[def.kind] = true;
      _selected = new Set();
      void reload();
    }, true);
  }

  return btn;
}

/**
 * @param {string} domain
 * @param {number} count
 */
function buildDomainRow(domain, count) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kpv2-media-lib-tab kpv2-media-lib-tab-domain';
  if (_domain === domain) btn.classList.add('is-active');
  btn.setAttribute('role', 'tab');

  const label = document.createElement('span');
  label.className = 'kpv2-media-lib-tab-label';
  label.textContent = domain;

  const badge = document.createElement('span');
  badge.className = 'kpv2-media-lib-tab-count';
  badge.textContent = String(count);

  btn.appendChild(label);
  btn.appendChild(badge);
  btn.title = domain;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    _domain = domain;
    _selected = new Set();
    void reload();
  }, true);
  return btn;
}

function renderGrid() {
  const content = /** @type {HTMLElement|null} */ (/** @type {any} */ (_overlay)?._content);
  if (!content) return;
  content.replaceChildren();

  if (!kindHasGallery(_kind)) {
    const empty = document.createElement('div');
    empty.className = 'kpv2-media-lib-empty';
    empty.textContent = 'Coming soon';
    content.appendChild(empty);
    return;
  }

  if (!_items.length) {
    const empty = document.createElement('div');
    empty.className = 'kpv2-media-lib-empty';
    empty.textContent = _kind === 'url'
      ? (_domain
        ? `No URLs from ${_domain}`
        : 'No URLs yet. Set Copy URL destination to Media Library or Both.')
      : _kind === 'video'
        ? (_domain
          ? `No videos from ${_domain}`
          : 'No videos yet. Set Copy Video destination to Media Library or Both.')
      : _kind === 'document'
        ? (_domain
          ? `No documents from ${_domain}`
          : 'No documents yet. Use Fetch URL for Media Library or send from Page Media.')
      : (_domain
        ? `No images from ${_domain}`
        : 'No images yet. Send from Page Media (O) or set Copy Image destination to Media Library.');
    content.appendChild(empty);
    return;
  }

  if (!_domain) {
    /** @type {Map<string, typeof _items>} */
    const groups = new Map();
    for (const item of _items) {
      const d = item.sourceDomain || item.domain || '(unknown)';
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d).push(item);
    }
    const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
    for (const domain of keys) {
      const section = document.createElement('section');
      section.className = 'kpv2-media-lib-section';
      const heading = document.createElement('h3');
      heading.className = 'kpv2-media-lib-section-title';
      heading.textContent = domain;
      const count = document.createElement('span');
      count.className = 'kpv2-media-lib-section-count';
      count.textContent = String(groups.get(domain).length);
      heading.appendChild(count);
      const grid = document.createElement('div');
      grid.className = 'kpv2-media-lib-grid';
      for (const item of groups.get(domain)) {
        grid.appendChild(buildCard(item));
      }
      section.appendChild(heading);
      section.appendChild(grid);
      content.appendChild(section);
    }
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'kpv2-media-lib-grid';
  for (const item of _items) {
    grid.appendChild(buildCard(item));
  }
  content.appendChild(grid);
}

/**
 * @param {string} itemId
 * @param {MouseEvent} e
 */
function handleCardSelectClick(itemId, e) {
  e.preventDefault();
  e.stopPropagation();
  // Second click of a double-click must not toggle back; dblclick opens.
  if (e.detail > 1) return;
  if (e.shiftKey && _anchorId) {
    selectRange(_anchorId, itemId);
    return;
  }
  toggleSelected(itemId);
}

/**
 * @param {import('../utils/media-library-service.js').MediaLibraryItemMeta} item
 */
function buildCard(item) {
  const selected = _selected.has(item.id);
  const card = document.createElement('article');
  card.className = 'kpv2-media-lib-card';
  card.dataset.id = item.id;
  if (selected) card.classList.add('is-selected');

  const isUrl = item.kind === 'url';
  const isVideo = item.kind === 'video';
  const isDoc = item.kind === 'document';
  const wrap = document.createElement('div');
  wrap.className = 'kpv2-media-lib-thumb-wrap';
  if (isUrl) wrap.classList.add('is-url');
  if (isVideo) wrap.classList.add('is-video');
  if (isDoc) wrap.classList.add('is-document');
  const img = document.createElement('img');
  img.className = 'kpv2-media-lib-thumb';
  img.alt = '';
  img.draggable = false;
  if (item.thumbDataUrl) {
    img.src = item.thumbDataUrl;
    wrap.appendChild(img);
  } else {
    const ph = document.createElement('span');
    ph.className = 'kpv2-media-lib-placeholder';
    ph.textContent = isUrl ? 'URL' : (isVideo ? 'VID' : String(item.ext || (isDoc ? 'DOC' : 'IMG')));
    wrap.appendChild(ph);
  }

  const sourceHost = String(item.sourceDomain || item.domain || '').trim();
  const selectLabel = `Select ${sourceHost || (isUrl ? 'URL' : isVideo ? 'video' : isDoc ? 'document' : 'image')}`;

  const selectBtn = document.createElement('button');
  selectBtn.type = 'button';
  selectBtn.className = 'kpv2-media-lib-select';
  selectBtn.setAttribute('aria-label', selectLabel);
  selectBtn.setAttribute('aria-pressed', selected ? 'true' : 'false');
  const check = document.createElement('span');
  check.className = 'kpv2-media-lib-check';
  check.setAttribute('aria-hidden', 'true');
  selectBtn.appendChild(check);
  wrap.appendChild(selectBtn);

  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'kpv2-media-lib-open';
  openBtn.setAttribute('aria-label', isUrl
    ? `Open ${sourceHost || 'URL'}`
    : isVideo
      ? `Play ${sourceHost || 'video'}`
      : isDoc
        ? `Open ${sourceHost || 'document'}`
        : `Open ${sourceHost || 'image'}`);
  wrap.appendChild(openBtn);
  wrap.appendChild(buildHoverActions(item));

  const metaSelect = document.createElement('button');
  metaSelect.type = 'button';
  metaSelect.className = 'kpv2-media-lib-meta-select';
  metaSelect.setAttribute('aria-label', selectLabel);
  metaSelect.setAttribute('aria-pressed', selected ? 'true' : 'false');

  const metaRow = document.createElement('div');
  metaRow.className = 'kpv2-media-lib-meta-row';
  const typeBadge = document.createElement('span');
  typeBadge.className = 'kpv2-media-lib-badge';
  typeBadge.textContent = String(item.ext || (isUrl ? 'URL' : isVideo ? 'VID' : isDoc ? 'DOC' : 'IMG'));
  const dimBadge = document.createElement('span');
  dimBadge.className = 'kpv2-media-lib-badge kpv2-media-lib-badge-dims';
  const w = Number(item.width) || 0;
  const h = Number(item.height) || 0;
  dimBadge.textContent = isUrl ? 'LINK' : (isDoc ? 'FILE' : (w > 0 && h > 0 ? `${w}×${h}` : '—'));
  metaRow.appendChild(typeBadge);
  metaRow.appendChild(dimBadge);

  const info = document.createElement('div');
  info.className = 'kpv2-media-lib-info';

  const pageHost = String(item.pageDomain || '').trim();
  const name = document.createElement('div');
  name.className = 'kpv2-media-lib-name';
  name.textContent = isUrl ? urlCardTitle(item) : (sourceHost || '(unknown)');
  name.title = item.sourceUrl || '';
  info.appendChild(name);
  if (pageHost && pageHost !== sourceHost) {
    const page = document.createElement('div');
    page.className = 'kpv2-media-lib-page';
    page.textContent = pageHost;
    page.title = item.pageUrl || '';
    info.appendChild(page);
  }

  const sizeRow = document.createElement('div');
  sizeRow.className = 'kpv2-media-lib-size-row';
  const size = document.createElement('span');
  size.className = 'kpv2-media-lib-size';
  size.textContent = librarySizeLabel(item);
  const dpi = document.createElement('span');
  dpi.className = 'kpv2-media-lib-dpi';
  const dpiVal = Number(item.dpi) || 0;
  dpi.textContent = isUrl || isVideo || isDoc ? '' : (dpiVal > 0 ? `${Math.round(dpiVal)} dpi` : '—');
  sizeRow.appendChild(size);
  sizeRow.appendChild(dpi);
  info.appendChild(sizeRow);

  if (isVideo) {
    void resolveVideoCardFileSize(item, size);
  }

  metaSelect.appendChild(metaRow);
  metaSelect.appendChild(info);

  card.appendChild(wrap);
  card.appendChild(metaSelect);

  const onSelect = (e) => handleCardSelectClick(item.id, e);
  const onOpen = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.kind === 'url') openStoredUrl(item);
    else void openFullView(item.id);
  };
  selectBtn.addEventListener('click', onSelect, true);
  metaSelect.addEventListener('click', onSelect, true);
  openBtn.addEventListener('click', onOpen, true);
  metaSelect.addEventListener('dblclick', onOpen, true);

  return card;
}

/**
 * Hover toolbar: Copy · Download (same pattern as Page Media).
 * @param {import('../utils/media-library-service.js').MediaLibraryItemMeta} item
 */
function buildHoverActions(item) {
  const bar = document.createElement('div');
  bar.className = 'kpv2-media-lib-actions';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Item actions');

  const mk = (label, title, handler) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kpv2-media-lib-action';
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await handler();
      } catch (err) {
        console.warn('[KeyPilot] Media Library action failed:', err);
        _notify('Action failed', 'error');
      }
    }, true);
    return btn;
  };

  bar.appendChild(mk('Copy', isUrlItem(item)
    ? 'Copy URL'
    : isVideoItem(item)
      ? (item.thumbDataUrl ? 'Copy frame' : 'Copy video URL')
      : isDocumentItem(item)
        ? (item.sourceUrl ? 'Copy URL' : 'Copy file name')
        : 'Copy to pasteboard', () => copyLibraryItem(item)));
  if (isUrlItem(item) || (isVideoItem(item) && isHttpUrl(item.sourceUrl))
    || (isDocumentItem(item) && isHttpUrl(item.sourceUrl))) {
    bar.appendChild(mk('Open', 'Open in a new tab', async () => openStoredUrl(item)));
  }
  bar.appendChild(mk('Download', (isUrlItem(item) || isVideoShortcut(item))
    ? 'Download shortcut'
    : 'Download file', () => downloadLibraryItem(item)));
  return bar;
}

function isUrlItem(item) {
  return item?.kind === 'url';
}

function isVideoItem(item) {
  return item?.kind === 'video';
}

function isDocumentItem(item) {
  return item?.kind === 'document';
}

function isVideoShortcut(item) {
  return isVideoItem(item)
    && (String(item?.ext || '') === 'URL' || /^text\/uri-list/i.test(String(item?.mime || '')));
}

/**
 * Size line for gallery cards — same format as Images; link-only rows stay labeled.
 * @param {import('../utils/media-library-service.js').MediaLibraryItemMeta} item
 * @returns {string}
 */
function librarySizeLabel(item) {
  if (item?.kind === 'url' || isVideoShortcut(item)) return 'Saved link';
  return formatFileSize(item?.byteSize);
}

/**
 * For Videos, prefer stored byteSize; for http(s) link-only rows, probe Content-Length.
 * @param {import('../utils/media-library-service.js').MediaLibraryItemMeta} item
 * @param {HTMLElement} sizeEl
 */
async function resolveVideoCardFileSize(item, sizeEl) {
  if (!item || !sizeEl) return;

  const stored = Number(item.byteSize) || 0;
  if (!isVideoShortcut(item) && stored > 0) {
    sizeEl.textContent = formatFileSize(stored);
    return;
  }

  const href = String(item.sourceUrl || '').trim();
  if (!isHttpUrl(href)) return;

  try {
    const bytes = await probeRemoteFileSize(href);
    if (!(bytes > 0) || !sizeEl.isConnected) return;
    item.byteSize = bytes;
    sizeEl.textContent = formatFileSize(bytes);
  } catch { /* keep Saved link / — */ }
}

/**
 * @param {string} url
 * @returns {Promise<number>}
 */
async function probeRemoteFileSize(url) {
  try {
    const head = await fetch(url, { method: 'HEAD', credentials: 'omit', cache: 'force-cache' });
    if (head.ok) {
      const len = head.headers.get('content-length');
      if (len && /^\d+$/.test(len)) return Number(len);
    }
  } catch { /* try range GET */ }

  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'force-cache',
      headers: { Range: 'bytes=0-0' }
    });
    if (res.ok || res.status === 206) {
      const cr = res.headers.get('content-range');
      const m = cr && cr.match(/\/(\d+)\s*$/);
      if (m) return Number(m[1]);
      const len = res.headers.get('content-length');
      if (len && /^\d+$/.test(len) && res.status !== 206) return Number(len);
    }
  } catch { /* ignore */ }

  return 0;
}

/**
 * @param {string|null|undefined} href
 * @returns {boolean}
 */
function isHttpUrl(href) {
  return /^https?:\/\//i.test(String(href || '').trim());
}

/**
 * @param {import('../utils/media-library-service.js').MediaLibraryItemMeta} item
 */
function urlCardTitle(item) {
  const href = String(item?.sourceUrl || '');
  try {
    const u = new URL(href);
    const path = `${u.pathname || '/'}${u.search || ''}`;
    if (path === '/' || path === '') return u.hostname || href;
    return path.length > 48 ? `${path.slice(0, 45)}…` : path;
  } catch {
    return href || String(item?.domain || 'URL');
  }
}

/**
 * @param {import('../utils/media-library-service.js').MediaLibraryItemMeta} item
 */
function openStoredUrl(item) {
  const href = String(item?.sourceUrl || '').trim();
  if (!href) {
    _notify('No URL', 'error');
    return;
  }
  if (!isHttpUrl(href)) {
    _notify('This link cannot be opened in a new tab', 'error');
    return;
  }
  try {
    window.open(href, '_blank', 'noopener,noreferrer');
  } catch {
    _notify('Could not open URL', 'error');
  }
}

/**
 * @param {import('../utils/media-library-service.js').MediaLibraryItemMeta} item
 */
async function copyLibraryItem(item) {
  if (item?.kind === 'url' && item.sourceUrl) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.sourceUrl);
        _notify('URL copied', 'success');
        return;
      }
    } catch { /* ignore */ }
    _notify('Could not copy URL', 'error');
    return;
  }
  if (item?.kind === 'video') {
    if (item.thumbDataUrl && /^data:image\//i.test(item.thumbDataUrl)) {
      try {
        const res = await fetch(item.thumbDataUrl);
        const blob = await res.blob();
        if (blob && blob.size > 0) {
          const ok = await writeImageBlobToClipboard(blob, blob.type || 'image/png');
          if (ok) {
            _notify('Copied to pasteboard', 'success');
            return;
          }
        }
      } catch { /* fall through to URL */ }
    }
    if (item.sourceUrl && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(item.sourceUrl);
        _notify('Video URL copied', 'success');
        return;
      } catch { /* ignore */ }
    }
    _notify('Could not copy video', 'error');
    return;
  }
  if (item?.kind === 'document') {
    if (item.sourceUrl && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(item.sourceUrl);
        _notify('Document URL copied', 'success');
        return;
      } catch { /* ignore */ }
    }
    _notify('Could not copy document', 'error');
    return;
  }
  const result = await getMediaLibraryOriginal(item.id);
  const blob = result?.blob;
  if (!(blob instanceof Blob) || blob.size <= 0) {
    _notify('Could not copy image', 'error');
    return;
  }
  const mime = result?.item?.mime || blob.type || 'image/png';
  const ok = await writeImageBlobToClipboard(blob, mime);
  if (ok) {
    _notify('Copied to pasteboard', 'success');
    return;
  }
  try {
    if (item.sourceUrl && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(item.sourceUrl);
      _notify('Image URL copied', 'success');
      return;
    }
  } catch { /* ignore */ }
  _notify('Could not copy to pasteboard', 'error');
}

/**
 * @param {import('../utils/media-library-service.js').MediaLibraryItemMeta} item
 */
async function downloadLibraryItem(item) {
  if ((item?.kind === 'url' || isVideoShortcut(item)) && item.sourceUrl) {
    const body = `[InternetShortcut]\r\nURL=${item.sourceUrl}\r\n`;
    downloadBlob(new Blob([body], { type: 'application/internet-shortcut' }), libraryDownloadFilename(item));
    _notify('Download started', 'success');
    return;
  }
  const result = await getMediaLibraryOriginal(item.id);
  const blob = result?.blob;
  if (!(blob instanceof Blob) || blob.size <= 0) {
    _notify('Could not download', 'error');
    return;
  }
  downloadBlob(blob, libraryDownloadFilename(item));
  _notify('Download started', 'success');
}

/**
 * @param {import('../utils/media-library-service.js').MediaLibraryItemMeta} item
 */
function libraryDownloadFilename(item) {
  if (item?.kind === 'url' || isVideoShortcut(item)) {
    let host = String(item.sourceDomain || item.domain || '').trim() || (item?.kind === 'video' ? 'video' : 'link');
    host = host.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
    return `${host}.url`;
  }
  const ext = String(item.ext || (
    item?.kind === 'video' ? 'mp4' : item?.kind === 'document' ? 'bin' : 'img'
  )).toLowerCase();
  let base = '';
  try {
    const u = new URL(String(item.sourceUrl || ''));
    base = decodeURIComponent((u.pathname || '').split('/').pop() || '');
  } catch { /* ignore */ }
  if (!base) {
    base = String(item.id || (
      item?.kind === 'video' ? 'video' : item?.kind === 'document' ? 'document' : 'image'
    )).replace(/^ml_/, '');
  }
  base = base.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || (
    item?.kind === 'video' ? 'video' : item?.kind === 'document' ? 'document' : 'image'
  );
  if (ext && !new RegExp(`\\.${ext}$`, 'i').test(base)) base += `.${ext}`;
  return base;
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
    await navigator.clipboard.write([new ClipboardItem({ [outType]: Promise.resolve(outBlob) })]);
    return true;
  } catch {
    try {
      await navigator.clipboard.write([new ClipboardItem({ [outType]: outBlob })]);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * @param {string} id
 */
function toggleSelected(id) {
  if (_selected.has(id)) _selected.delete(id);
  else _selected.add(id);
  _anchorId = id;
  syncCardSelection();
  updateSelectionButtons();
}

/**
 * @param {string} fromId
 * @param {string} toId
 */
function selectRange(fromId, toId) {
  const ids = _items.map((it) => it.id);
  const a = ids.indexOf(fromId);
  const b = ids.indexOf(toId);
  if (a < 0 || b < 0) {
    toggleSelected(toId);
    return;
  }
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  for (let i = lo; i <= hi; i++) _selected.add(ids[i]);
  syncCardSelection();
  updateSelectionButtons();
}

function syncCardSelection() {
  const root = getOverlayRoot();
  if (!root) return;
  const cards = root.querySelectorAll('.kpv2-media-lib-card');
  cards.forEach((el) => {
    const node = /** @type {HTMLElement} */ (el);
    const id = node.dataset.id;
    const on = !!(id && _selected.has(id));
    node.classList.toggle('is-selected', on);
    node.querySelectorAll('.kpv2-media-lib-select, .kpv2-media-lib-meta-select').forEach((btn) => {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  });
}

async function zipCurrentView() {
  if (!kindHasGallery(_kind)) {
    _notify('Nothing to download', 'info');
    return;
  }
  const result = await zipMediaLibrary({
    kind: _kind,
    domain: _domain || ''
  });
  if (result?.empty || !result?.blob) {
    _notify(result?.error || 'Nothing to download', 'info');
    return;
  }
  if (!result.success) {
    _notify(result.error || 'Could not build zip', 'error');
    return;
  }
  downloadBlob(result.blob, result.filename || (
    _kind === 'url' ? 'URLs.zip'
      : _kind === 'video' ? 'Videos.zip'
        : _kind === 'document' ? 'Documents.zip'
          : 'Images.zip'
  ));
  _notify('Download started', 'success');
}

async function zipSelection() {
  const ids = Array.from(_selected);
  if (!ids.length) {
    _notify('Nothing to download', 'info');
    return;
  }
  const result = await zipMediaLibrary({ ids, kind: _kind });
  if (result?.empty || !result?.blob) {
    _notify(result?.error || 'Nothing to download', 'info');
    return;
  }
  if (!result.success) {
    _notify(result.error || 'Could not build zip', 'error');
    return;
  }
  downloadBlob(result.blob, result.filename || 'Media-selection.zip');
  _notify('Download started', 'success');
}

async function deleteSelection() {
  const ids = Array.from(_selected);
  if (!ids.length) return;
  const result = await deleteMediaLibraryItems(ids);
  if (!result?.success) {
    _notify(result?.error || 'Could not delete', 'error');
    return;
  }
  _selected = new Set();
  _notify(ids.length === 1 ? 'Removed from Media Library' : `Removed ${ids.length} items`, 'success');
  await reload();
}

/**
 * @param {string} id
 */
async function openFullView(id) {
  const overlay = _overlay;
  if (!overlay) return;
  const fullView = /** @type {HTMLElement} */ (/** @type {any} */ (overlay)._fullView);
  const host = /** @type {HTMLElement} */ (/** @type {any} */ (overlay)._fullMediaHost);
  const counter = /** @type {HTMLElement} */ (/** @type {any} */ (overlay)._fullCounter);
  if (!fullView || !host) return;

  const listed = _items.find((it) => it.id === id) || null;
  const isVideo = listed?.kind === 'video' || _kind === 'video';
  const isDoc = listed?.kind === 'document' || _kind === 'document';

  revokeFullObjectUrl();
  host.replaceChildren();
  _fullViewId = id;

  if (isVideo) {
    const ok = await mountFullVideo(host, id, listed);
    if (!ok) {
      _fullViewId = null;
      return;
    }
  } else if (isDoc) {
    const ok = await mountFullDocument(host, id, listed);
    if (!ok) {
      _fullViewId = null;
      return;
    }
  } else {
    const result = await getMediaLibraryOriginal(id);
    if (!result?.success || !result.blob) {
      _notify(result?.error || 'Could not open image', 'error');
      _fullViewId = null;
      return;
    }
    _fullObjectUrl = URL.createObjectURL(result.blob);
    const img = document.createElement('img');
    img.className = 'kpv2-media-lib-fullimage';
    img.alt = result.item?.domain || listed?.domain || '';
    img.src = _fullObjectUrl;
    host.appendChild(img);
  }

  const idx = _items.findIndex((it) => it.id === id);
  if (counter) {
    counter.textContent = idx >= 0 ? `${idx + 1} / ${_items.length}` : '';
  }

  fullView.classList.add('is-open');
  fullView.setAttribute('aria-hidden', 'false');
}

/**
 * Mount an in-overlay video player for a Media Library item.
 * Uses stored file bytes when available; otherwise an http(s) source URL.
 * @param {HTMLElement} host
 * @param {string} id
 * @param {import('../utils/media-library-service.js').MediaLibraryItemMeta|null} listed
 * @returns {Promise<boolean>}
 */
async function mountFullVideo(host, id, listed) {
  const item = listed || { id, kind: 'video' };
  let src = '';

  if (isVideoShortcut(item)) {
    const href = String(item.sourceUrl || '').trim();
    if (!isHttpUrl(href)) {
      _notify('This video link is not playable', 'error');
      return false;
    }
    src = href;
  } else {
    const result = await getMediaLibraryOriginal(id);
    const blob = result?.blob;
    const meta = result?.item || item;
    if (isVideoShortcut(meta)) {
      const href = String(meta.sourceUrl || item.sourceUrl || '').trim();
      if (!isHttpUrl(href)) {
        _notify('This video link is not playable', 'error');
        return false;
      }
      src = href;
    } else if (result?.success && blob instanceof Blob && blob.size > 0
      && !/^text\/uri-list/i.test(blob.type || meta?.mime || '')) {
      _fullObjectUrl = URL.createObjectURL(blob);
      src = _fullObjectUrl;
    } else {
      const href = String(meta?.sourceUrl || item.sourceUrl || '').trim();
      if (isHttpUrl(href)) {
        src = href;
      } else {
        _notify(result?.error || 'Could not open video', 'error');
        return false;
      }
    }
  }

  const video = document.createElement('video');
  video.className = 'kpv2-media-lib-fullvideo';
  video.controls = true;
  video.autoplay = true;
  video.playsInline = true;
  video.src = src;
  host.appendChild(video);

  const href = String((listed || item).sourceUrl || '').trim();
  if (isHttpUrl(href)) {
    const openLink = document.createElement('a');
    openLink.className = 'kpv2-media-lib-openlink';
    openLink.href = href;
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    openLink.textContent = 'Open in new tab';
    openLink.addEventListener('click', (e) => e.stopPropagation(), true);
    host.appendChild(openLink);
  }

  return true;
}

/**
 * Preview a stored document (PDF / text) or start a download for other types.
 * @param {HTMLElement} host
 * @param {string} id
 * @param {import('../utils/media-library-service.js').MediaLibraryItemMeta|null} listed
 * @returns {Promise<boolean>}
 */
async function mountFullDocument(host, id, listed) {
  const result = await getMediaLibraryOriginal(id);
  const blob = result?.blob;
  const meta = result?.item || listed;
  if (!result?.success || !(blob instanceof Blob) || blob.size <= 0) {
    _notify(result?.error || 'Could not open document', 'error');
    return false;
  }
  const mime = String(meta?.mime || blob.type || '').toLowerCase().split(';')[0].trim();
  const previewable = mime === 'application/pdf' || mime.startsWith('text/');
  if (!previewable) {
    downloadBlob(blob, libraryDownloadFilename(meta || listed || { id, kind: 'document' }));
    _notify('Download started', 'success');
    return false;
  }
  _fullObjectUrl = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.className = 'kpv2-media-lib-fullframe';
  frame.title = meta?.ext || 'Document';
  frame.src = _fullObjectUrl;
  host.appendChild(frame);
  return true;
}

function closeFullView() {
  const overlay = _overlay;
  if (!overlay) return;
  const fullView = /** @type {HTMLElement} */ (/** @type {any} */ (overlay)._fullView);
  const host = /** @type {HTMLElement} */ (/** @type {any} */ (overlay)._fullMediaHost);
  if (host) {
    try {
      const v = host.querySelector('video');
      if (v) v.pause();
    } catch { /* ignore */ }
    host.replaceChildren();
  }
  if (fullView) {
    fullView.classList.remove('is-open');
    fullView.setAttribute('aria-hidden', 'true');
  }
  revokeFullObjectUrl();
  _fullViewId = null;
}

/**
 * @param {number} delta
 */
async function navigateFullView(delta) {
  if (!_fullViewId || !_items.length) return;
  const idx = _items.findIndex((it) => it.id === _fullViewId);
  if (idx < 0) return;
  const next = (idx + delta + _items.length) % _items.length;
  await openFullView(_items[next].id);
}

/**
 * @param {Document|ShadowRoot} root
 */
function ensureStyles(root) {
  if (!root) return;
  const c = NCT_DARK_UI_COLORS;
  const css = `
.kpv2-media-lib-shell {
  position: absolute;
  inset: 10pt;
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: ${c.bg};
  border: ${NCT_DARK_UI_PANEL_BORDER};
  border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
  box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
  font-family: ${NCT_DARK_UI_FONT};
  color: ${c.fg};
}
${getNctDarkUiBackdropCss()}
${getNctDarkUiScrollbarCss()}
.kpv2-media-lib-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  background: ${NCT_DARK_UI_TITLEBAR_GRADIENT};
  border-bottom: ${NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM};
  flex-shrink: 0;
}
.kpv2-media-lib-title-wrap {
  display: flex;
  flex-direction: column;
  min-width: 140px;
  flex-shrink: 0;
}
.kpv2-media-lib-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${c.fg};
  line-height: 1.2;
}
.kpv2-media-lib-subtitle {
  font-size: 11px;
  color: ${c.fgMute};
  line-height: 1.2;
}
.kpv2-media-lib-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  justify-content: flex-end;
  min-width: 0;
}
.kpv2-media-lib-btn {
  padding: 5px 12px;
  border: ${NCT_DARK_UI_BTN_BORDER};
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  background: ${NCT_DARK_UI_BTN_GRADIENT};
  color: ${c.fg};
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.kpv2-media-lib-btn:hover:not(:disabled) {
  color: #fff;
}
.kpv2-media-lib-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.kpv2-media-lib-close {
  flex-shrink: 0;
}
.kpv2-media-lib-body {
  flex: 1;
  min-height: 0;
  display: flex;
}
.kpv2-media-lib-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #0f0f0f;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 8px 0;
}
.kpv2-media-lib-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  margin: 2px 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: ${c.fgDim};
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  width: calc(100% - 16px);
  box-sizing: border-box;
}
.kpv2-media-lib-tab:hover:not(:disabled) {
  background: #1f1f1f;
  border-color: #333;
}
.kpv2-media-lib-tab.is-active {
  background: #2a2a2a;
  border-color: #444;
  color: #fff;
}
.kpv2-media-lib-tab.is-disabled {
  opacity: 0.45;
  cursor: default;
}
.kpv2-media-lib-tab-domain {
  padding: 7px 16px 7px 32px;
  font-size: 12px;
  color: ${c.fgMute};
}
.kpv2-media-lib-tab-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.kpv2-media-lib-chev {
  width: 0.9em;
  flex-shrink: 0;
  color: ${c.fgMute};
  font-size: 10px;
}
.kpv2-media-lib-tab-count {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #888;
}
.kpv2-media-lib-content {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 16px 18px 24px;
}
.kpv2-media-lib-empty {
  padding: 64px 24px;
  text-align: center;
  color: ${c.fgMute};
  font-size: 13px;
  line-height: 1.5;
}
.kpv2-media-lib-section {
  margin-bottom: 22px;
}
.kpv2-media-lib-section-title {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: ${c.fgDim};
  display: flex;
  align-items: center;
  gap: 8px;
}
.kpv2-media-lib-section-count {
  font-size: 11px;
  font-weight: 600;
  color: ${c.fgMute};
  font-variant-numeric: tabular-nums;
}
.kpv2-media-lib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  align-content: flex-start;
}
.kpv2-media-lib-card {
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
  text-align: left;
  color: inherit;
  font: inherit;
}
.kpv2-media-lib-card:hover:not(.is-selected) {
  border-color: ${c.accent};
}
.kpv2-media-lib-card.is-selected {
  border-color: #f0f0f0;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.9) inset,
    0 0 14px 3px rgba(255, 255, 255, 0.45);
}
.kpv2-media-lib-card:hover .kpv2-media-lib-actions,
.kpv2-media-lib-card:focus-within .kpv2-media-lib-actions {
  opacity: 1;
  pointer-events: auto;
}
.kpv2-media-lib-thumb-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
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
.kpv2-media-lib-thumb {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
  width: 100%;
  height: 100%;
}
.kpv2-media-lib-placeholder {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: ${c.fgMute};
}
.kpv2-media-lib-thumb-wrap.is-url,
.kpv2-media-lib-thumb-wrap.is-video,
.kpv2-media-lib-thumb-wrap.is-document {
  background: #161616;
}
.kpv2-media-lib-select {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  margin: 0;
  border: 0;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.55);
  cursor: pointer;
  z-index: 2;
  appearance: none;
}
.kpv2-media-lib-select:hover {
  background: rgba(0, 0, 0, 0.72);
}
.kpv2-media-lib-open {
  position: absolute;
  top: 28px;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
  z-index: 1;
  appearance: none;
}
.kpv2-media-lib-meta-select {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: inherit;
  font: inherit;
  appearance: none;
}
.kpv2-media-lib-check {
  position: relative;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: rgba(0, 0, 0, 0.35);
  pointer-events: none;
}
.kpv2-media-lib-card.is-selected .kpv2-media-lib-check {
  background: #f2f2f2;
  border-color: #fff;
}
.kpv2-media-lib-card.is-selected .kpv2-media-lib-check::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid #222;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.kpv2-media-lib-actions {
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
  z-index: 3;
}
.kpv2-media-lib-action {
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
.kpv2-media-lib-action:hover {
  background: ${NCT_DARK_UI_BTN_LIT_GRADIENT};
  border: ${NCT_DARK_UI_BTN_LIT_BORDER};
  color: #e8f0f8;
}
.kpv2-media-lib-meta-row {
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
.kpv2-media-lib-badge {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: ${c.fgDim};
  white-space: nowrap;
}
.kpv2-media-lib-info {
  padding: 8px 10px;
}
.kpv2-media-lib-name {
  font-size: 11px;
  color: ${c.fg};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kpv2-media-lib-page {
  margin-top: 2px;
  font-size: 10px;
  color: ${c.fgMute};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kpv2-media-lib-size-row {
  margin-top: 4px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.kpv2-media-lib-size {
  font-size: 10px;
  color: ${c.fgMute};
}
.kpv2-media-lib-dpi {
  font-size: 10px;
  font-weight: 600;
  color: ${c.fgDim};
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
.kpv2-media-lib-fullview {
  display: none;
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(0, 0, 0, 0.92);
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}
.kpv2-media-lib-fullview.is-open {
  display: flex;
}
.kpv2-media-lib-fullmedia {
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  cursor: default;
}
.kpv2-media-lib-fullimage {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 3px;
}
.kpv2-media-lib-fullvideo {
  max-width: 90vw;
  max-height: 80vh;
  background: #000;
}
.kpv2-media-lib-fullframe {
  width: 90vw;
  height: 85vh;
  border: 0;
  background: #111;
  border-radius: 3px;
}
.kpv2-media-lib-openlink {
  color: ${c.accent};
  font-size: 12px;
}
.kpv2-media-lib-nav {
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
.kpv2-media-lib-nav-prev { left: 20px; }
.kpv2-media-lib-nav-next { right: 20px; }
.kpv2-media-lib-fullcounter {
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
`;
  injectChromeStyles(root, {
    attr: 'data-kp-media-lib-styles',
    css
  });
}
