/**
 * TopSitesPopover
 * Overlay of common sites: Toolbar, Most Visited, Recent Bookmarks.
 * Default host is a transient PopupManager modal; optional persistent mode
 * remounts across pages like Keyboard Reference.
 */
import { MSG } from '../messaging/types.js';
import { Z_INDEX } from '../config/constants.js';
import {
  createUrlListingContainer,
  parseUrlForThreeLineDisplay,
  renderUrlListing
} from '../ui/url-listing.js';
import { applyCardBackground } from '../ui/page-thumb-ui.js';
import { createPopoverTitlebar } from '../ui/popover-titlebar.js';
import { getActionIconDataUri } from '../ui/keybindings-ui-shared.js';
import {
  NCT_DARK_UI_BTN_GRADIENT,
  NCT_DARK_UI_BTN_RADIUS,
  NCT_DARK_UI_COLORS,
  NCT_DARK_UI_FONT,
  NCT_DARK_UI_PANEL_BACKGROUND,
  NCT_DARK_UI_PANEL_BORDER,
  NCT_DARK_UI_PANEL_BOX_SHADOW,
  NCT_DARK_UI_PANEL_RADIUS,
  NCT_DARK_UI_SCROLLBAR_CLASS,
  getNctDarkUiScrollbarCss
} from '../ui/nct-dark-ui.js';
import {
  ensureChromeHostMounted,
  ensureOpenChromeShadow,
  injectChromeStyles
} from '../ui/kp-chrome-shadow.js';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  getSettings,
  setSettings
} from './settings-manager.js';
import {
  applyPanelPosition,
  getViewportSize,
  makePanelDraggable,
  makePanelResizable,
  normalizePanelPositionState,
  PANEL_POSITION_MARGIN_PX
} from '../utils/panel-position.js';
import { storageGetValue, storageSetValue } from '../utils/storage.js';

const TAB_STATE_KEY = 'kpTopSitesSelectedTab_v1';
const POPUP_ID = 'kpv2-top-sites-popover';
const DEFAULT_WIDTH_PX = 600;
const DEFAULT_HEIGHT_PX = 338;
const MIN_WIDTH_PX = 480;
const MIN_HEIGHT_PX = 270;
const POSITION_MARGIN_PX = PANEL_POSITION_MARGIN_PX;

/** @typedef {'toolbar'|'mostVisited'|'recentBookmarks'} TopSitesTabId */

const TABS = Object.freeze([
  Object.freeze({ id: 'toolbar', label: 'Toolbar' }),
  Object.freeze({ id: 'mostVisited', label: 'Most Visited' }),
  Object.freeze({ id: 'recentBookmarks', label: 'Recent Bookmarks' })
]);

const EMPTY_COPY = Object.freeze({
  toolbar: 'No bookmarks on the Bookmarks bar.',
  mostVisited: 'No frequently visited sites yet.',
  recentBookmarks: 'No recent bookmarks.'
});

const CARD_CLASS_NAMES = {
  row: 'kp-url-row',
  rowSelected: 'kp-url-row--selected',
  content: 'kp-url-content',
  text: 'kp-url-text',
  title: 'kp-url-domain',
  meta: 'kp-url-title',
  url: 'kp-url-path',
  favicon: 'kp-url-favicon'
};

const GEAR_PATH = 'M495.9 166.1c3.3 12.7 .9 26.3-7.1 36.1l-37.3 45.7c2.1 11.1 3.2 22.6 3.2 34.3s-1.1 23.2-3.2 34.3l37.3 45.7c8 9.8 10.4 23.4 7.1 36.1c-6.3 24.2-17.7 46.6-33.1 66.3c-8.1 10.3-21.2 14.9-33.9 12.1l-57.5-12.7c-17.9 15.3-38.4 27.3-60.7 35.4l-13.7 57.5c-2.9 12.1-12.9 21.1-25.4 22.4c-24.2 2.6-49.1 2.6-73.3 0c-12.5-1.3-22.5-10.3-25.4-22.4l-13.7-57.5c-22.3-8.1-42.8-20.1-60.7-35.4L71.6 436.6c-12.7 2.8-25.8-1.8-33.9-12.1C22.3 404.8 10.9 382.4 4.6 358.2c-3.3-12.7-.9-26.3 7.1-36.1l37.3-45.7C46.9 265.2 45.8 253.7 45.8 242s1.1-23.2-3.2-34.3L11.7 161.9c-8-9.8-10.4-23.4-7.1-36.1C10.9 101.6 22.3 79.2 37.7 59.5c8.1-10.3 21.2-14.9 33.9-12.1l57.5 12.7c17.9-15.3 38.4-27.3 60.7-35.4L203.5-32.8c2.9-12.1 12.9-21.1-25.4-22.4c24.2-2.6 49.1-2.6 73.3 0c12.5 1.3 22.5 10.3 25.4 22.4l13.7 57.5c22.3 8.1 42.8 20.1 60.7 35.4l57.5-12.7c12.7-2.8 25.8 1.8 33.9 12.1c15.4 19.7 26.8 42.1 33.1 66.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z';

/**
 * @param {{ url?: string, title?: string }} item
 * @param {{ titleEl: HTMLElement, metaEl: HTMLElement, urlEl: HTMLElement }} parts
 */
function renderCardText({ item, parts }) {
  const url = String(item?.url || '').trim();
  const title = String(item?.title || '').trim();
  const { domain, path } = parseUrlForThreeLineDisplay(url);
  parts.titleEl.textContent = domain || url || '';
  parts.metaEl.textContent = title && title !== domain ? title : '';
  parts.urlEl.textContent = path === '/' ? '' : path;
}

/**
 * @param {HTMLElement} row
 * @param {string} url
 */
function attachPageThumb(row, url) {
  const pageUrl = String(url || '').trim();
  if (!row || !pageUrl) return;
  applyCardBackground(row, pageUrl, {
    fallbackSolid: '',
    hoverSolid: '',
    manageHover: false,
    youtubePrefer: true,
    useCssVar: true,
    cssVarName: '--kp-page-thumb',
    readyClass: 'kp-has-page-thumb'
  });
}

function hasStoredPosition(pos) {
  if (!pos || typeof pos !== 'object') return false;
  return Number.isFinite(Number(pos.left))
    || Number.isFinite(Number(pos.top))
    || (typeof pos.anchor === 'string' && pos.anchor);
}

export class TopSitesPopover {
  /**
   * @param {object} opts
   * @param {import('./popup-manager.js').PopupManager} opts.popupManager
   * @param {(visible: boolean) => void} [opts.onVisibilityChange]
   */
  constructor({ popupManager, onVisibilityChange } = {}) {
    this.popupManager = popupManager || null;
    this._onVisibilityChange = typeof onVisibilityChange === 'function' ? onVisibilityChange : null;
    /** @type {HTMLElement|null} */
    this._panel = null;
    /** @type {HTMLElement|null} */
    this._titlebar = null;
    /** @type {HTMLElement|null} */
    this._tabList = null;
    /** @type {HTMLElement|null} */
    this._grid = null;
    /** @type {HTMLElement|null} */
    this._status = null;
    /** @type {HTMLButtonElement|null} */
    this._gearBtn = null;
    /** @type {HTMLElement|null} */
    this._menu = null;
    this._open = false;
    this._openGen = 0;
    this._persistent = false;
    this._hostedInPopupManager = false;
    this._suppressPositionPersist = false;
    /** @type {import('./settings-manager.js').PanelPositionSettings} */
    this._panelPosition = { ...DEFAULT_SETTINGS.panelPositions.topSites };
    /** @type {(() => void)|null} */
    this._dragDispose = null;
    /** @type {(() => void)|null} */
    this._resizeDispose = null;
    this._docClickBound = false;
    this._storageBound = false;
    this._onDocClick = this._onDocClick.bind(this);
    this._onStorageChanged = this._onStorageChanged.bind(this);
    this._onWinResize = this._onWinResize.bind(this);
    /** @type {TopSitesTabId} */
    this._tab = 'toolbar';
    /** @type {number} */
    this._selectedIndex = 0;
    /** @type {Array<{title?: string, url?: string}>} */
    this._items = [];
    this._bindSettingsSync();
  }

  isOpen() {
    return this._open;
  }

  isPersistent() {
    return !!this._persistent;
  }

  toggle() {
    if (this._open) this.hide();
    else void this.show();
  }

  /**
   * @param {{ persistClosed?: boolean }} [opts]
   */
  async show() {
    if (this._open) return;
    this._open = true;
    const gen = ++this._openGen;

    await this._loadTabState();
    await this._hydrateFromSettings();
    if (!this._stillOpen(gen)) return;

    this._ensureDom();
    this._injectStyles();
    this._syncTabButtons();
    this._syncPersistMenu();
    this._applySizeAndPosition();
    this._applyHost();
    this._attachMoveResize();

    try {
      this._panel?.focus?.({ preventScroll: true });
    } catch { /* ignore */ }

    await this._loadAndRender(gen);
  }

  /**
   * @param {{ persistClosed?: boolean }} [opts]
   */
  hide(opts = {}) {
    if (!this._open && !this._panel) return;
    const persistClosed = opts.persistClosed !== false;
    this._open = false;
    this._openGen += 1;
    void this._persistTabState();
    this._disposeChrome();
    this._closeMenu();

    try {
      this.popupManager?.hideModal?.(POPUP_ID);
    } catch { /* ignore */ }
    this._hostedInPopupManager = false;

    try { this._panel?.remove?.(); } catch { /* ignore */ }
    this._panel = null;
    this._titlebar = null;
    this._tabList = null;
    this._grid = null;
    this._status = null;
    this._gearBtn = null;
    this._menu = null;
    this._items = [];
    this._selectedIndex = 0;

    if (persistClosed && this._persistent) {
      try { this._onVisibilityChange?.(false); } catch { /* ignore */ }
    }
  }

  /**
   * @param {KeyboardEvent} e
   * @returns {boolean}
   */
  handleKeyDown(e) {
    if (!this._open) return false;
    const key = e.key;
    const code = e.code;

    if (key === 'Escape' || code === 'Escape') {
      if (this._menu && !this._menu.hidden) {
        e.preventDefault();
        e.stopPropagation();
        try { e.stopImmediatePropagation(); } catch { /* ignore */ }
        this._closeMenu();
        return true;
      }
      e.preventDefault();
      e.stopPropagation();
      try { e.stopImmediatePropagation(); } catch { /* ignore */ }
      this.hide();
      return true;
    }

    if (key === '1' || key === '2' || key === '3') {
      const idx = Number(key) - 1;
      const tab = TABS[idx];
      if (tab) {
        e.preventDefault();
        e.stopPropagation();
        void this._selectTab(tab.id);
        return true;
      }
    }

    if (key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      this._cycleTab(e.shiftKey ? -1 : 1);
      return true;
    }

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const atTablist = this._eventInTabList(e);
      if (atTablist || e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        this._cycleTab(key === 'ArrowLeft' ? -1 : 1);
        return true;
      }
      e.preventDefault();
      e.stopPropagation();
      this._moveSelection(key === 'ArrowLeft' ? -1 : 1);
      return true;
    }

    if (key === 'ArrowUp' || key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      const cols = this._gridColumnCount();
      this._moveSelection(key === 'ArrowUp' ? -cols : cols);
      return true;
    }

    if (key === 'Home') {
      e.preventDefault();
      e.stopPropagation();
      this._setSelectedIndex(0);
      return true;
    }
    if (key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      this._setSelectedIndex(this._items.length - 1);
      return true;
    }

    if (key === 'Enter' || key === ' ') {
      const item = this._items[this._selectedIndex];
      if (item?.url) {
        e.preventDefault();
        e.stopPropagation();
        void this._openUrl(item.url);
        return true;
      }
    }

    if (key === 'PageUp' || key === 'PageDown') {
      e.preventDefault();
      e.stopPropagation();
      try {
        const grid = this._grid;
        if (grid) {
          const delta = key === 'PageUp' ? -grid.clientHeight : grid.clientHeight;
          grid.scrollBy({ top: delta, behavior: 'smooth' });
        }
      } catch { /* ignore */ }
      return true;
    }

    return false;
  }

  /** @param {number} gen */
  _stillOpen(gen) {
    return this._open && this._openGen === gen;
  }

  async _loadTabState() {
    try {
      const raw = await storageGetValue(TAB_STATE_KEY, 'toolbar');
      const id = String(raw || '');
      this._tab = TABS.some((t) => t.id === id) ? /** @type {TopSitesTabId} */ (id) : 'toolbar';
    } catch {
      this._tab = 'toolbar';
    }
  }

  _persistTabState() {
    return storageSetValue(TAB_STATE_KEY, this._tab).catch(() => {});
  }

  async _hydrateFromSettings() {
    try {
      const settings = await getSettings();
      this._persistent = !!settings?.topSitesPersistent;
      const stored = settings?.panelPositions?.topSites;
      const normalized = normalizePanelPositionState(
        stored,
        DEFAULT_SETTINGS.panelPositions.topSites
      );
      this._panelPosition = {
        ...(normalized || {}),
        ...(Number.isFinite(Number(stored?.width)) && Number(stored.width) > 0
          ? { width: Number(stored.width) }
          : {}),
        ...(Number.isFinite(Number(stored?.height)) && Number(stored.height) > 0
          ? { height: Number(stored.height) }
          : {})
      };
    } catch {
      this._persistent = false;
    }
  }

  _bindSettingsSync() {
    if (this._storageBound) return;
    try {
      if (chrome?.storage?.onChanged?.addListener) {
        chrome.storage.onChanged.addListener(this._onStorageChanged);
        this._storageBound = true;
      }
    } catch { /* ignore */ }
  }

  _onStorageChanged(changes, area) {
    try {
      if (area !== 'sync' && area !== 'local') return;
      const entry = changes && changes[SETTINGS_STORAGE_KEY];
      if (!entry || !entry.newValue) return;
      const next = entry.newValue;
      if (Object.prototype.hasOwnProperty.call(next, 'topSitesPersistent')) {
        const persistent = !!next.topSitesPersistent;
        if (persistent !== this._persistent) {
          this._persistent = persistent;
          this._syncPersistMenu();
          if (this._open) this._applyHost();
        }
      }
      const nextPos = next.panelPositions?.topSites;
      if (nextPos && typeof nextPos === 'object' && this._open && this._panel) {
        this._suppressPositionPersist = true;
        const normalized = normalizePanelPositionState(
          nextPos,
          DEFAULT_SETTINGS.panelPositions.topSites
        );
        this._panelPosition = {
          ...(normalized || this._panelPosition),
          ...(Number.isFinite(Number(nextPos.width)) && Number(nextPos.width) > 0
            ? { width: Number(nextPos.width) }
            : {}),
          ...(Number.isFinite(Number(nextPos.height)) && Number(nextPos.height) > 0
            ? { height: Number(nextPos.height) }
            : {})
        };
        this._applySizeAndPosition();
        this._suppressPositionPersist = false;
      }
    } catch {
      this._suppressPositionPersist = false;
    }
  }

  _applyHost() {
    if (!this._panel) return;
    if (this._persistent) {
      if (this._hostedInPopupManager) {
        try { this.popupManager?.hideModal?.(POPUP_ID); } catch { /* ignore */ }
        this._hostedInPopupManager = false;
      }
      try { this._panel.style.zIndex = String(Z_INDEX.POPUP_PANEL_BASE); } catch { /* ignore */ }
      try { ensureChromeHostMounted(this._panel); } catch { /* ignore */ }
      return;
    }
    if (!this.popupManager) {
      try { ensureChromeHostMounted(this._panel); } catch { /* ignore */ }
      return;
    }
    this.popupManager.showModal({
      id: POPUP_ID,
      panel: this._panel,
      onRequestClose: () => this.hide(),
      resizable: false,
      blur: false
    });
    this._hostedInPopupManager = true;
  }

  _panelSize() {
    const w = Number(this._panelPosition?.width);
    const h = Number(this._panelPosition?.height);
    return {
      width: Number.isFinite(w) && w > 0 ? w : DEFAULT_WIDTH_PX,
      height: Number.isFinite(h) && h > 0 ? h : DEFAULT_HEIGHT_PX
    };
  }

  _applySizeAndPosition() {
    const panel = this._panel;
    if (!panel) return;
    const size = this._panelSize();
    try {
      panel.style.width = `${size.width}px`;
      panel.style.height = `${size.height}px`;
      panel.style.maxWidth = '';
      panel.style.maxHeight = '';
      panel.style.transform = 'none';
    } catch { /* ignore */ }

    const pos = this._panelPosition;
    if (hasStoredPosition(pos)) {
      try {
        const resolved = applyPanelPosition(panel, pos, {
          margin: POSITION_MARGIN_PX,
          fallbackWidth: size.width,
          fallbackHeight: size.height,
          width: size.width,
          height: size.height,
          pinSize: true
        });
        if (resolved) {
          this._panelPosition = {
            ...this._panelPosition,
            left: resolved.left,
            top: resolved.top,
            anchor: resolved.anchor === undefined ? null : resolved.anchor
          };
        }
      } catch { /* ignore */ }
      return;
    }

    const vp = getViewportSize();
    const left = Math.round(Math.max(POSITION_MARGIN_PX, (vp.width - size.width) / 2));
    const top = Math.round(Math.max(POSITION_MARGIN_PX, (vp.height - size.height) / 2));
    try {
      applyPanelPosition(panel, { left, top, anchor: null }, {
        margin: POSITION_MARGIN_PX,
        fallbackWidth: size.width,
        fallbackHeight: size.height,
        width: size.width,
        height: size.height,
        pinSize: true
      });
    } catch { /* ignore */ }
    this._panelPosition = { ...this._panelPosition, left, top, anchor: null };
  }

  _attachMoveResize() {
    this._disposeChrome();
    const panel = this._panel;
    const handle = this._titlebar;
    if (!panel || !handle) return;
    const shadowRoot = panel.shadowRoot || panel;

    try {
      const api = makePanelDraggable(panel, handle, {
        margin: POSITION_MARGIN_PX,
        excludeSelector: 'button, .kpv2-ts-menu, .kpv2-popover-titlebar-actions, .kpv2-popover-titlebar-close',
        onMoveEnd: (state) => {
          if (!state?.moved) return;
          void this._persistPosition({
            left: state.left,
            top: state.top,
            anchor: state.anchor,
            width: this._panelPosition.width,
            height: this._panelPosition.height
          });
        }
      });
      this._dragDispose = api?.dispose || null;
    } catch { /* ignore */ }

    try {
      this._resizeDispose = makePanelResizable(panel, {
        mount: shadowRoot,
        minWidth: MIN_WIDTH_PX,
        minHeight: MIN_HEIGHT_PX,
        margin: POSITION_MARGIN_PX,
        onResizeEnd: (size) => {
          void this._persistPosition({
            ...this._panelPosition,
            width: size.width,
            height: size.height
          });
        }
      });
    } catch { /* ignore */ }

    try {
      window.addEventListener('resize', this._onWinResize);
    } catch { /* ignore */ }
  }

  _disposeChrome() {
    try { this._dragDispose?.(); } catch { /* ignore */ }
    try { this._resizeDispose?.(); } catch { /* ignore */ }
    this._dragDispose = null;
    this._resizeDispose = null;
    try { window.removeEventListener('resize', this._onWinResize); } catch { /* ignore */ }
  }

  _onWinResize() {
    if (!this._open || !this._panel) return;
    this._applySizeAndPosition();
  }

  async _persistPosition(next) {
    if (this._suppressPositionPersist) return;
    const normalized = normalizePanelPositionState(
      next,
      DEFAULT_SETTINGS.panelPositions.topSites
    ) || {};
    this._panelPosition = {
      ...this._panelPosition,
      left: normalized.left,
      top: normalized.top,
      anchor: normalized.anchor === undefined ? null : normalized.anchor,
      ...(Number.isFinite(Number(next?.width)) && Number(next.width) > 0
        ? { width: Number(next.width) }
        : {}),
      ...(Number.isFinite(Number(next?.height)) && Number(next.height) > 0
        ? { height: Number(next.height) }
        : {})
    };
    try {
      await setSettings({ panelPositions: { topSites: { ...this._panelPosition } } });
    } catch { /* ignore */ }
  }

  async _setPersistent(next) {
    const persistent = !!next;
    this._persistent = persistent;
    this._syncPersistMenu();
    try {
      await setSettings({ topSitesPersistent: persistent });
    } catch { /* ignore */ }
    if (this._open) this._applyHost();
    try {
      // Persist visibility without toggling this tab's UI (host already switched).
      this._onVisibilityChange?.(persistent && this._open, { applyUi: false });
    } catch { /* ignore */ }
  }

  _syncPersistMenu() {
    const item = this._menu?.querySelector?.('[data-kp-ts-persist]');
    if (!item) return;
    item.setAttribute('aria-checked', this._persistent ? 'true' : 'false');
  }

  _toggleMenu() {
    if (!this._menu) return;
    const open = this._menu.hidden;
    if (open) this._openMenu();
    else this._closeMenu();
  }

  _openMenu() {
    if (!this._menu) return;
    this._menu.hidden = false;
    this._gearBtn?.setAttribute('aria-expanded', 'true');
    if (!this._docClickBound) {
      try {
        document.addEventListener('pointerdown', this._onDocClick, true);
        this._docClickBound = true;
      } catch { /* ignore */ }
    }
  }

  _closeMenu() {
    if (this._menu) this._menu.hidden = true;
    this._gearBtn?.setAttribute('aria-expanded', 'false');
    if (this._docClickBound) {
      try { document.removeEventListener('pointerdown', this._onDocClick, true); } catch { /* ignore */ }
      this._docClickBound = false;
    }
  }

  _onDocClick(e) {
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (this._gearBtn?.contains?.(t) || this._menu?.contains?.(t)) return;
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    if (path.includes(this._gearBtn) || path.includes(this._menu)) return;
    this._closeMenu();
  }

  _createGearButton(doc) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'kpv2-ts-gear';
    btn.title = 'Top Sites options';
    btn.setAttribute('aria-label', 'Top Sites options');
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');

    const img = doc.createElement('img');
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    const cssUri = getActionIconDataUri('OPEN_SETTINGS_POPOVER', { fill: 'rgba(200,200,205,0.95)' });
    const match = String(cssUri || '').match(/^url\("(.+)"\)$/);
    if (match) {
      img.src = match[1];
    } else {
      img.src = `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="rgba(200,200,205,0.95)"><path d="${GEAR_PATH}"/></svg>`
      )}`;
    }
    btn.appendChild(img);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._toggleMenu();
    }, true);
    return btn;
  }

  _createPersistMenu(doc) {
    const menu = doc.createElement('div');
    menu.className = 'kpv2-ts-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    const item = doc.createElement('button');
    item.type = 'button';
    item.className = 'kpv2-ts-menu-item';
    item.setAttribute('role', 'menuitemcheckbox');
    item.dataset.kpTsPersist = 'true';
    item.setAttribute('aria-checked', 'false');
    item.textContent = 'Keep open across pages';
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void this._setPersistent(!this._persistent);
      this._closeMenu();
    }, true);

    menu.appendChild(item);
    return menu;
  }

  _injectStyles() {
    const c = NCT_DARK_UI_COLORS;
    const css = `
      .kpv2-top-sites-panel {
        box-sizing: border-box;
        position: fixed;
        left: 50%;
        top: 50%;
        width: ${DEFAULT_WIDTH_PX}px;
        height: ${DEFAULT_HEIGHT_PX}px;
        display: flex;
        flex-direction: column;
        border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
        border: ${NCT_DARK_UI_PANEL_BORDER};
        background: ${NCT_DARK_UI_PANEL_BACKGROUND};
        box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
        overflow: hidden;
        outline: none;
        font-family: ${NCT_DARK_UI_FONT};
        color: ${c.fg};
        z-index: ${Z_INDEX.POPUP_PANEL_BASE};
      }

      .kpv2-top-sites-panel .kpv2-ts-gear {
        margin: 0;
        appearance: none;
        -webkit-appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 22px;
        height: 22px;
        min-width: 22px;
        min-height: 22px;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: rgba(200, 200, 205, 0.9);
        cursor: pointer;
      }

      .kpv2-top-sites-panel .kpv2-ts-gear img {
        width: 13px;
        height: 13px;
        display: block;
        pointer-events: none;
        opacity: 0.92;
      }

      .kpv2-top-sites-panel .kpv2-ts-gear:hover,
      .kpv2-top-sites-panel .kpv2-ts-gear[aria-expanded="true"] {
        background: rgba(255, 255, 255, 0.08);
      }

      .kpv2-top-sites-panel .kpv2-ts-menu {
        position: absolute;
        top: 28px;
        right: 28px;
        z-index: 8;
        min-width: 220px;
        padding: 4px;
        border-radius: ${NCT_DARK_UI_BTN_RADIUS};
        border: ${NCT_DARK_UI_BTN_BORDER};
        background: ${NCT_DARK_UI_PANEL_BACKGROUND};
        box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
      }

      .kpv2-top-sites-panel .kpv2-ts-menu[hidden] {
        display: none !important;
      }

      .kpv2-top-sites-panel .kpv2-ts-menu-item {
        appearance: none;
        -webkit-appearance: none;
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        margin: 0;
        padding: 8px 10px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: ${c.fg};
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
      }

      .kpv2-top-sites-panel .kpv2-ts-menu-item::before {
        content: "";
        width: 12px;
        height: 12px;
        flex: 0 0 auto;
        border-radius: 3px;
        border: 1px solid ${c.panelEdgeDark};
        background: transparent;
        box-sizing: border-box;
      }

      .kpv2-top-sites-panel .kpv2-ts-menu-item[aria-checked="true"]::before {
        background: ${c.litEdge};
        border-color: ${c.litEdge};
      }

      .kpv2-top-sites-panel .kpv2-ts-menu-item:hover {
        background: rgba(255, 255, 255, 0.08);
      }

      .kpv2-top-sites-panel .kpv2-ts-tabstrip {
        display: flex;
        align-items: flex-end;
        gap: 4px;
        padding: 8px 12px 0;
        min-height: 36px;
        flex: 0 0 auto;
        background: ${NCT_DARK_UI_PANEL_BACKGROUND};
        border-bottom: 1px solid ${c.panelEdgeDark};
      }

      .kpv2-top-sites-panel .kpv2-ts-tab {
        appearance: none;
        -webkit-appearance: none;
        position: relative;
        margin: 0 0 -1px;
        padding: 8px 14px 10px;
        border: 1px solid ${c.panelEdgeDark};
        border-bottom: none;
        border-radius: 9px 9px 0 0;
        background: ${NCT_DARK_UI_BTN_GRADIENT};
        color: ${c.fgDim};
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.01em;
        line-height: 1.15;
        cursor: pointer;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.14);
        z-index: 0;
      }

      .kpv2-top-sites-panel .kpv2-ts-tab:hover {
        color: ${c.fg};
        background: linear-gradient(180deg, #555 0%, ${c.btnMid} 55%, ${c.btnBot} 100%);
      }

      .kpv2-top-sites-panel .kpv2-ts-tab[aria-selected="true"] {
        color: ${c.fg};
        background: ${NCT_DARK_UI_PANEL_BACKGROUND};
        z-index: 1;
        padding-top: 10px;
        padding-bottom: 12px;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.16),
          0 0 0 1px ${c.litEdge};
      }

      .kpv2-top-sites-panel .kpv2-ts-tab:focus-visible {
        outline: none;
        box-shadow: inset 0 0 0 1px rgba(74,144,200,0.65);
      }

      .kpv2-top-sites-panel .kpv2-ts-body {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 0;
        background: ${NCT_DARK_UI_PANEL_BACKGROUND};
      }

      .kpv2-top-sites-panel .kpv2-ts-status {
        padding: 6px 14px 0;
        font-size: 11px;
        font-weight: 600;
        color: ${c.fgMute};
        flex: 0 0 auto;
      }

      .kpv2-top-sites-panel .kpv2-ts-grid {
        display: grid !important;
        grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
        grid-auto-rows: 80px;
        gap: 12px;
        padding: 10px 14px 14px;
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        align-items: start;
        align-content: start;
      }

      .kpv2-top-sites-panel .kpv2-ts-empty {
        grid-column: 1 / -1;
        padding: 28px 12px;
        text-align: center;
        font-size: 13px;
        font-weight: 600;
        color: ${c.fgMute};
      }

      .kpv2-top-sites-panel .kp-url-row {
        box-sizing: border-box;
        display: block;
        position: relative;
        align-self: start;
        width: 100%;
        height: 80px;
        min-height: 80px;
        max-height: 80px;
        padding: 8px 9px;
        border-radius: 10px;
        cursor: pointer;
        text-decoration: none;
        color: inherit;
        user-select: none;
        overflow: hidden;
        margin: 0;
        min-width: 0;
        background: linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 48%, ${c.btnBot} 100%);
        border: 1px solid ${c.panelEdgeDark};
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.18),
          inset 0 -1px 0 rgba(0,0,0,0.45),
          0 4px 10px rgba(0,0,0,0.38);
      }

      .kpv2-top-sites-panel .kp-url-row:hover {
        transform: translateY(-1px);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.22),
          inset 0 -1px 0 rgba(0,0,0,0.5),
          0 8px 16px rgba(0,0,0,0.45);
      }

      .kpv2-top-sites-panel .kp-url-row:focus-visible,
      .kpv2-top-sites-panel .kp-url-row--selected {
        outline: none;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.18),
          0 0 0 2px ${c.litEdge},
          0 6px 14px rgba(0,0,0,0.4);
      }

      .kpv2-top-sites-panel .kp-url-content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        gap: 4px;
      }

      .kpv2-top-sites-panel .kp-url-favicon {
        width: 22px;
        height: 22px;
        border-radius: 4px;
        flex: 0 0 auto;
        background: rgba(0,0,0,0.28);
      }

      .kpv2-top-sites-panel .kp-url-text {
        min-width: 0;
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: 2px;
        justify-content: flex-end;
      }

      .kpv2-top-sites-panel .kp-url-domain,
      .kpv2-top-sites-panel .kp-url-title,
      .kpv2-top-sites-panel .kp-url-path {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .kpv2-top-sites-panel .kp-url-domain {
        font-size: 12px;
        font-weight: 800;
        color: rgba(255,255,255,0.94);
      }

      .kpv2-top-sites-panel .kp-url-title {
        font-size: 11px;
        font-weight: 600;
        color: rgba(255,255,255,0.78);
      }

      .kpv2-top-sites-panel .kp-url-path {
        font-size: 10px;
        color: rgba(255,255,255,0.55);
      }

      .kpv2-top-sites-panel .kp-url-row.kp-has-page-thumb {
        background-color: #0a0a0a;
        background-image: none;
        isolation: isolate;
      }

      .kpv2-top-sites-panel .kp-url-row.kp-has-page-thumb::before {
        content: "";
        position: absolute;
        inset: -1px;
        z-index: 0;
        pointer-events: none;
        border-radius: inherit;
        background-color: #0a0a0a;
        background-image:
          linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.78) 100%),
          var(--kp-page-thumb);
        background-size: 100% 100%, cover;
        background-position: center, center;
        background-repeat: no-repeat, no-repeat;
      }

      .kpv2-top-sites-panel .kp-url-row.kp-has-page-thumb > * {
        position: relative;
        z-index: 1;
      }

      .kpv2-top-sites-panel .kp-url-row.kp-has-page-thumb .kp-url-domain,
      .kpv2-top-sites-panel .kp-url-row.kp-has-page-thumb .kp-url-title,
      .kpv2-top-sites-panel .kp-url-row.kp-has-page-thumb .kp-url-path {
        text-shadow: 0 1px 2px rgba(0,0,0,0.85);
      }

      ${getNctDarkUiScrollbarCss({ scopeSelector: '.kpv2-top-sites-panel' })}
    `;
    const shadowRoot = this._panel?.shadowRoot || null;
    const localCss = shadowRoot
      ? css
        .replace('.kpv2-top-sites-panel {', ':host {')
        .replaceAll('.kpv2-top-sites-panel ', '')
      : css;
    injectChromeStyles(shadowRoot || document, {
      attr: 'data-kp-top-sites-styles',
      css: localCss
    });
  }

  _ensureDom() {
    if (this._panel && this._tabList && this._grid) return;

    const doc = document;
    const panel = doc.createElement('div');
    panel.className = 'kpv2-top-sites-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Top Sites');
    panel.tabIndex = -1;
    const shadowRoot = ensureOpenChromeShadow(panel, { id: 'top-sites' });
    const shell = shadowRoot || panel;

    this._gearBtn = this._createGearButton(doc);
    this._menu = this._createPersistMenu(doc);

    const titlebarApi = createPopoverTitlebar({
      doc,
      title: 'Top Sites',
      variant: 'panel',
      draggable: true,
      closeTitle: 'Close',
      onClose: () => this.hide(),
      actions: [this._gearBtn],
      className: 'kpv2-popover-titlebar kpv2-ts-titlebar'
    });
    this._titlebar = titlebarApi.titlebar;

    const tabstrip = doc.createElement('div');
    tabstrip.className = 'kpv2-ts-tabstrip';
    tabstrip.setAttribute('role', 'tablist');
    tabstrip.setAttribute('aria-label', 'Top Sites lists');

    for (const tab of TABS) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'kpv2-ts-tab';
      btn.id = `kp-ts-tab-${tab.id}`;
      btn.setAttribute('role', 'tab');
      btn.dataset.tabId = tab.id;
      btn.textContent = tab.label;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void this._selectTab(tab.id);
      }, true);
      tabstrip.appendChild(btn);
    }

    const body = doc.createElement('div');
    body.className = 'kpv2-ts-body';

    const status = doc.createElement('div');
    status.className = 'kpv2-ts-status';
    status.textContent = '';

    const grid = createUrlListingContainer({
      doc,
      view: 'grid',
      useInlineStyles: false,
      className: `kpv2-ts-grid ${NCT_DARK_UI_SCROLLBAR_CLASS}`,
      scrollY: true
    });
    grid.setAttribute('role', 'tabpanel');
    grid.id = 'kp-ts-panel';

    body.appendChild(status);
    body.appendChild(grid);
    shell.appendChild(this._titlebar);
    shell.appendChild(this._menu);
    shell.appendChild(tabstrip);
    shell.appendChild(body);

    this._panel = panel;
    this._tabList = tabstrip;
    this._grid = grid;
    this._status = status;
  }

  _syncTabButtons() {
    if (!this._tabList) return;
    const buttons = this._tabList.querySelectorAll('.kpv2-ts-tab');
    buttons.forEach((btn) => {
      const selected = btn.dataset.tabId === this._tab;
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
      btn.tabIndex = selected ? 0 : -1;
    });
    if (this._grid) {
      this._grid.setAttribute('aria-labelledby', `kp-ts-tab-${this._tab}`);
    }
  }

  /**
   * @param {TopSitesTabId} tabId
   */
  async _selectTab(tabId) {
    if (!TABS.some((t) => t.id === tabId)) return;
    this._tab = tabId;
    this._selectedIndex = 0;
    this._syncTabButtons();
    void this._persistTabState();
    await this._loadAndRender(this._openGen);
  }

  /** @param {number} dir */
  _cycleTab(dir) {
    const idx = TABS.findIndex((t) => t.id === this._tab);
    const next = TABS[(idx + dir + TABS.length) % TABS.length];
    if (next) void this._selectTab(next.id);
  }

  /**
   * @param {KeyboardEvent} e
   */
  _eventInTabList(e) {
    const t = e.target;
    if (!(t instanceof Element) || !this._tabList) return false;
    return this._tabList.contains(t) || t.classList?.contains?.('kpv2-ts-tab');
  }

  _gridColumnCount() {
    const grid = this._grid;
    if (!grid) return 4;
    try {
      const style = getComputedStyle(grid);
      const cols = style.gridTemplateColumns;
      if (cols && cols !== 'none') return Math.max(1, cols.split(' ').length);
    } catch { /* ignore */ }
    return 4;
  }

  /** @param {number} delta */
  _moveSelection(delta) {
    if (!this._items.length) return;
    this._setSelectedIndex(this._selectedIndex + delta);
  }

  /** @param {number} index */
  _setSelectedIndex(index) {
    if (!this._items.length) {
      this._selectedIndex = 0;
      return;
    }
    const max = this._items.length - 1;
    this._selectedIndex = Math.max(0, Math.min(max, index));
    this._paintSelection();
    const row = this._grid?.querySelector?.(
      `.kp-url-row[data-kp-url-listing-index="${this._selectedIndex}"]`
    );
    try { row?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); } catch { /* ignore */ }
  }

  _paintSelection() {
    if (!this._grid) return;
    const rows = this._grid.querySelectorAll('.kp-url-row');
    rows.forEach((row) => {
      const idx = Number(row.dataset.kpUrlListingIndex);
      row.classList.toggle('kp-url-row--selected', idx === this._selectedIndex);
    });
  }

  async _loadAndRender(gen) {
    if (!this._stillOpen(gen) || !this._grid || !this._status) return;
    this._status.textContent = 'Loading…';
    this._grid.textContent = '';
    this._items = [];

    let items = [];
    try {
      items = await this._fetchItems(this._tab);
    } catch {
      items = [];
    }
    if (!this._stillOpen(gen)) return;

    this._items = items;
    this._selectedIndex = 0;
    this._status.textContent = items.length
      ? `${items.length} site${items.length === 1 ? '' : 's'}`
      : '';
    this._renderGrid(items);
  }

  /**
   * @param {TopSitesTabId} tabId
   * @returns {Promise<Array<{title?: string, url?: string}>>}
   */
  async _fetchItems(tabId) {
    if (tabId === 'toolbar') {
      const response = await chrome.runtime.sendMessage({ type: MSG.GET_BOOKMARKS });
      const bookmarks = Array.isArray(response?.bookmarks) ? response.bookmarks : [];
      return this._usableSites(bookmarks.filter((b) =>
        !!(b?.url && (b.isToolbar === true || b.parentId === '1'))
      ));
    }
    if (tabId === 'mostVisited') {
      const response = await chrome.runtime.sendMessage({ type: MSG.GET_MOST_VISITED });
      return this._usableSites(Array.isArray(response?.sites) ? response.sites : []);
    }
    const response = await chrome.runtime.sendMessage({
      type: MSG.GET_RECENT_BOOKMARKS,
      maxResults: 24
    });
    return this._usableSites(Array.isArray(response?.bookmarks) ? response.bookmarks : []);
  }

  /**
   * @param {Array<{title?: string, url?: string}>} items
   * @returns {Array<{title?: string, url?: string}>}
   */
  _usableSites(items) {
    return (Array.isArray(items) ? items : []).filter((item) =>
      /^https?:/i.test(String(item?.url || ''))
    );
  }

  /**
   * @param {Array<{title?: string, url?: string}>} items
   */
  _renderGrid(items) {
    if (!this._grid) return;
    const emptyText = EMPTY_COPY[this._tab] || 'Nothing to show.';
    if (!items.length) {
      this._grid.textContent = '';
      const empty = (this._grid.ownerDocument || document).createElement('div');
      empty.className = 'kpv2-ts-empty';
      empty.textContent = emptyText;
      this._grid.appendChild(empty);
      return;
    }

    renderUrlListing({
      container: this._grid,
      items,
      view: 'grid',
      useInlineStyles: false,
      classNames: CARD_CLASS_NAMES,
      rowTag: 'a',
      getTitle: (it) => it.title || it.url,
      getUrl: (it) => String(it.url || ''),
      showFavicon: true,
      showMetaLine: true,
      showUrlLine: true,
      selectedIndex: this._selectedIndex,
      onRowClick: ({ item, event }) => {
        event.preventDefault();
        event.stopPropagation();
        void this._openUrl(item.url);
      },
      decorateRow: ({ row, item, idx, parts }) => {
        row.setAttribute('role', 'link');
        renderCardText({ item, parts });
        attachPageThumb(row, item.url);
        if (idx === this._selectedIndex) {
          row.classList.add('kp-url-row--selected');
        }
      }
    });
  }

  /**
   * @param {string} url
   */
  async _openUrl(url) {
    const href = String(url || '').trim();
    if (!href) return;
    // Persistent: leave visibility true so the panel remounts on the next page.
    this.hide({ persistClosed: !this._persistent });
    try {
      await chrome.runtime.sendMessage({ type: MSG.NAVIGATE_SAME_TAB, url: href });
    } catch {
      try { window.location.assign(href); } catch { /* ignore */ }
    }
  }
}
