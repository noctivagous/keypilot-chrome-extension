/**
 * LauncherPopover
 *
 * A popover that provides quick access to websites organized in categories.
 * Features a tab list on the left for categories (social media, news, etc.)
 * and a grid of website items on the right. Supports V/C key scrolling through
 * sheets of grid items.
 */

import { PopupManager } from './popup-manager.js';
import {
  createFaviconImg,
  extractDomain,
  extractPath
} from '../ui/url-listing.js';
import { applyCardBackground } from '../ui/page-thumb-ui.js';
import {
  LAUNCHER_CATALOG_CATEGORY_KEYS,
  LAUNCHER_SITE_CATALOG
} from '../config/launcher-sites.js';
import { createOutlineIcon } from '../ui/preview-open-actions.js';
import {
  addToLaunchDeck,
  composeLaunchDeck,
  getAddableCatalogSites,
  loadLaunchDeckState,
  normalizeLaunchDeckUrl,
  persistLaunchDeckState,
  removeFromLaunchDeck,
  setLaunchDeckOrder
} from '../utils/launch-deck.js';
import { preferHttpsForPreview } from '../utils/preview-url.js';
import {
  NCT_DARK_UI_PANEL_BACKGROUND,
  NCT_DARK_UI_PANEL_BORDER,
  NCT_DARK_UI_PANEL_RADIUS,
  NCT_DARK_UI_PANEL_BOX_SHADOW,
  NCT_DARK_UI_TITLEBAR_GRADIENT,
  NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM
} from '../ui/nct-dark-ui.js';
import { ensureOpenChromeShadow, injectChromeStyles } from '../ui/kp-chrome-shadow.js';
import { storageGetValue, storageSetValue } from '../utils/storage.js';
import { MSG } from '../messaging/types.js';

const LAUNCHER_NAV_STATE_KEY = 'kpLauncherNavState_v1';

/** 24×24 outline paths for left-rail category tabs (stroke via createOutlineIcon). */
const LAUNCHER_TAB_ICONS = {
  launchDeck: [
    { attrs: { d: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z' } },
    { attrs: { d: 'M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z' } },
    { attrs: { d: 'M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0' } },
    { attrs: { d: 'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5' } }
  ],
  bookmarks: [
    { attrs: { d: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' } }
  ],
  history: [
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '10' } },
    { attrs: { d: 'M12 6v6l4 2' } }
  ],
  social: [
    { attrs: { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' } },
    { tag: 'circle', attrs: { cx: '9', cy: '7', r: '4' } },
    { attrs: { d: 'M22 21v-2a4 4 0 0 0-3-3.87' } },
    { attrs: { d: 'M16 3.13a4 4 0 0 1 0 7.75' } }
  ],
  news: [
    { attrs: { d: 'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2' } },
    { attrs: { d: 'M18 14h-8' } },
    { attrs: { d: 'M15 18h-5' } },
    { attrs: { d: 'M10 6h8v4h-8V6z' } }
  ],
  productivity: [
    { attrs: { d: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' } }
  ],
  videos: [
    { tag: 'rect', attrs: { x: '2', y: '6', width: '14', height: '12', rx: '2' } },
    { attrs: { d: 'm16 10 6-3v10l-6-3z' } }
  ],
  entertainment: [
    { attrs: { d: 'M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z' } },
    { attrs: { d: 'm6.2 5.3 3.1 3.9' } },
    { attrs: { d: 'm12.4 3.4 3.1 4' } },
    { attrs: { d: 'M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z' } }
  ],
  shopping: [
    { attrs: { d: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z' } },
    { attrs: { d: 'M3 6h18' } },
    { attrs: { d: 'M16 10a4 4 0 0 1-8 0' } }
  ],
  ai: [
    { attrs: { d: 'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z' } },
    { attrs: { d: 'M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z' } }
  ],
  archive: [
    { tag: 'rect', attrs: { x: '2', y: '3', width: '20', height: '5', rx: '1' } },
    { attrs: { d: 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8' } },
    { attrs: { d: 'M10 12h4' } }
  ],
  searches: [
    { tag: 'circle', attrs: { cx: '11', cy: '11', r: '7' } },
    { attrs: { d: 'm20 20-3.5-3.5' } }
  ]
};

export class LauncherPopover {
  constructor(keypilot) {
    this._keypilot = keypilot;
    this._container = null;
    this._shadowRoot = null;
    this._shell = null;
    this._tabListContainer = null;
    this._gridContainer = null;
    this._searchInput = null;
    this._currentCategory = 'launchDeck';
    this._categorySubTabs = {}; // Store per-category sub-tab selection
    /** @type {Record<string, string|null>} Selected Sites URL filter under Favorites/History. */
    this._categorySiteFilters = Object.create(null);
    this._currentSheet = 0;
    this._itemsPerSheet = 60; // Increased from 12 to 60 items per page
    this._categories = null;
    this._isOpen = false;
    /** Bumps on every show/hide so in-flight async loads can abort cleanly. */
    this._openGen = 0;
    this._searchQuery = '';
    this._categoryOrder = ['launchDeck', 'bookmarks', 'history', 'social', 'news', 'productivity', 'videos', 'entertainment', 'shopping', 'ai', 'archive', 'searches'];
    this._showDefaultSites = true; // Checkbox: show Launch Deck
    /** @type {import('../utils/launch-deck.js').LaunchDeckState} */
    this._launchDeckState = Object.create(null);
    /** Edit mode for Launch Deck (remove / reorder / add). */
    this._launchDeckEditMode = false;
    /** @type {HTMLElement|null} */
    this._launchDeckEditBar = null;
    /** @type {HTMLElement|null} */
    this._addSitePicker = null;
    /** Catalog used for domain history + site filters (full lists, not composed deck). */
    this._defaultSites = Object.fromEntries(
      Object.entries(LAUNCHER_SITE_CATALOG).map(([key, list]) => [
        key,
        list.map((s) => ({
          title: s.title,
          url: s.url,
          isDefault: !!s.seed,
          seed: !!s.seed,
          searchUrlPrefix: s.searchUrlPrefix
        }))
      ])
    );
    /** Categories whose domain history has been fetched this open session. */
    this._historyLoaded = Object.create(null);
    /** Shared recent history rows (top sites + search extraction). */
    this._cachedTopSites = null;
    /** @type {Array<{title?: string, url?: string, dateAdded?: number, id?: string}>|null} */
    this._cachedBookmarks = null;
    /** @type {Array<{title?: string, url?: string, lastVisitTime?: number, visitCount?: number}>|null} */
    this._cachedRecentHistory = null;
    this._boundContainerKeyDown = null;
    /** @type {HTMLInputElement|null} Category-page search input (e.g. Archive / Videos). */
    this._categorySearchInput = null;
    /** Draft text for header page-search bars, keyed by category. */
    this._headerSearchDrafts = Object.create(null);
    /** Selected Videos site home URL for the header search dropdown. */
    this._videosSearchSiteUrl = 'https://youtube.com';

    // Define available sub-tabs for each category (extensible for future types)
    // Order matters: Launch Deck / Favorites → History → Search (virtual results tab).
    this._categorySubTabConfig = {
      launchDeck: ['favorites', 'history', 'search'],
      bookmarks: ['favorites', 'history', 'search'],
      history: ['favorites', 'history', 'search'],
      social: ['sites', 'favorites', 'history', 'search'],
      news: ['sites', 'favorites', 'history', 'search'],
      productivity: ['sites', 'favorites', 'history', 'search'],
      videos: ['sites', 'favorites', 'history', 'search'],
      entertainment: ['sites', 'favorites', 'history', 'search'],
      shopping: ['sites', 'favorites', 'history', 'search'],
      ai: ['sites', 'favorites', 'history', 'search'],
      archive: ['sites', 'favorites', 'history', 'search'],
      searches: ['sites', 'favorites', 'history', 'search']
    };

    /**
     * Optional per-category page templates for non-card chrome.
     * @type {Record<string, {
     *   renderHeaderSearch?: (doc: Document) => (HTMLElement|null),
     *   renderBeforeCards?: (doc: Document) => (HTMLElement|null)
     * }>}
     */
    this._categoryPageTemplates = {
      archive: {
        renderHeaderSearch: (doc) => this._createArchiveSearchBar(doc)
      },
      videos: {
        renderHeaderSearch: (doc) => this._createVideosSearchBar(doc)
      }
    };
    /** Last URL opened via KeyPilot OS preview popup (for Launch Deck hide sync). */
    this._currentPreviewUrl = null;
  }

  /**
   * Show the launcher popover immediately, then enrich data in the background.
   * Blocking on bookmarks/history before paint made open feel very slow and
   * allowed Escape-during-load to race with a late UI mount.
   */
  async show() {
    if (this._isOpen) return;
    this._isOpen = true;
    const gen = ++this._openGen;
    this._historyLoaded = Object.create(null);
    this._cachedTopSites = null;
    this._cachedBookmarks = null;
    this._cachedRecentHistory = null;
    this._launchDeckEditMode = false;

    // Load Launch Deck state (migrates legacy hide list) and last tab/subtab.
    await this._loadLaunchDeckState();
    if (!this._stillOpen(gen)) return;
    await this._loadNavState();
    if (!this._stillOpen(gen)) return;
    this._initCategoriesWithDefaults();
    this._buildUI();
    if (!this._stillOpen(gen)) return;

    this._keypilot.overlayManager?.popupManager?.showModal({
      id: 'launcher-popover',
      panel: this._container,
      onRequestClose: () => this.hide()
    });

    this._renderCategory(this._currentCategory);

    // Progressive load: shared data first, then history for the active category.
    await this._loadSharedData(gen);
    if (!this._stillOpen(gen)) return;
    await this._ensureCategoryHistory(this._currentCategory, gen);
  }

  /**
   * Show the launcher popover with the Search tab focused
   */
  async showWithSearchFocus() {
    await this.show();
    const gen = this._openGen;

    // Focus after paint so PopupManager mount settles; abort if closed meanwhile.
    setTimeout(() => {
      if (!this._stillOpen(gen)) return;
      this._activateSearchTab({ focus: true });
    }, 0);
  }

  /**
   * Hide the launcher popover
   */
  hide() {
    if (!this._isOpen && !this._container) return;
    this._isOpen = false;
    // Invalidate any in-flight show() / history loads.
    this._openGen++;
    void this._persistNavState();
    this._launchDeckEditMode = false;
    this._closeAddSitePicker();

    // Leave text-focus mode that the search field may have entered.
    try { this._searchInput?.blur?.(); } catch { /* ignore */ }
    try { this._categorySearchInput?.blur?.(); } catch { /* ignore */ }
    try { this._keypilot?.focusDetector?.clearTextFocus?.(); } catch { /* ignore */ }

    if (this._container && this._boundContainerKeyDown) {
      try { this._container.removeEventListener('keydown', this._boundContainerKeyDown, true); } catch { /* ignore */ }
    }
    this._boundContainerKeyDown = null;

    this._keypilot.overlayManager?.popupManager?.hideModal('launcher-popover');

    if (this._container && this._container.parentNode) {
      try { this._container.parentNode.removeChild(this._container); } catch { /* ignore */ }
    }

    this._container = null;
    this._shadowRoot = null;
    this._shell = null;
    this._tabListContainer = null;
    this._gridContainer = null;
    this._searchInput = null;
    this._categorySearchInput = null;
    this._headerSearchSlot = null;
    this._headerTitle = null;
    this._headerDescription = null;
    this._primarySubTabRow = null;
    this._siteFilterRow = null;
    this._clearBtn = null;
    this._previewArea = null;
    this._currentPreviewUrl = null;
    this._currentSheet = 0;
    this._searchQuery = '';
    this._headerSearchDrafts = Object.create(null);
    this._videosSearchSiteUrl = 'https://youtube.com';
    this._categorySiteFilters = Object.create(null);
    this._historyLoaded = Object.create(null);
    this._cachedTopSites = null;
    this._cachedBookmarks = null;
    this._cachedRecentHistory = null;
  }

  /** @param {number} gen */
  _stillOpen(gen) {
    return this._isOpen && this._openGen === gen;
  }

  /**
   * Check if launcher is open
   */
  isOpen() {
    return this._isOpen;
  }

  /**
   * Extract unique domains from default site list for a category
   */
  _getDefaultDomains(categoryKey) {
    if (!this._defaultSites[categoryKey]) return [];
    const seen = new Set();
    const domains = [];
    for (const site of this._defaultSites[categoryKey]) {
      const domain = extractDomain(site.url);
      if (!domain || seen.has(domain)) continue;
      seen.add(domain);
      domains.push(domain);
    }
    return domains;
  }

  /**
   * Pathname without trailing slash (empty for `/`).
   * @param {string} url
   * @returns {string}
   */
  _sitePathPrefix(url) {
    try {
      const path = new URL(String(url || '').trim()).pathname || '';
      if (!path || path === '/') return '';
      return path.replace(/\/+$/, '');
    } catch {
      return '';
    }
  }

  /**
   * Extra history search strings for Sites that include a path
   * (e.g. archive.org/details/texts) so collection visits aren't missed.
   * @param {string} categoryKey
   * @returns {string[]}
   */
  _getHistorySearchQueries(categoryKey) {
    const sites = this._defaultSites[categoryKey];
    if (!Array.isArray(sites)) return [];
    const queries = [];
    const seen = new Set();
    for (const site of sites) {
      const path = this._sitePathPrefix(site?.url);
      if (!path) continue;
      const domain = extractDomain(site.url);
      if (!domain) continue;
      const q = `${domain}${path}`;
      if (seen.has(q)) continue;
      seen.add(q);
      queries.push(q);
      queries.push(`https://${q}`);
    }
    return queries;
  }

  /**
   * Immediate category shell using composed Launch Decks (seeds only until history loads).
   * Domain-history tabs start empty and fill in when first selected.
   * `sites` = Launch Deck; `favorites` = bookmarks; `history` = visits.
   */
  _initCategoriesWithDefaults() {
    const emptyLists = () => ({ sites: [], history: [], favorites: [] });

    this._categories = {
      launchDeck: {
        label: 'Launch Deck',
        description: 'Toolbar bookmarks and your most visited sites',
        ...emptyLists()
      },
      bookmarks: {
        label: 'Bookmarks',
        description: 'Your saved bookmarks and frequently visited sites',
        ...emptyLists()
      },
      history: {
        label: 'Recent',
        description: 'Sites you have visited most recently',
        ...emptyLists()
      },
      social: {
        label: 'Social Media',
        description: 'Stay connected across social networks',
        sites: [],
        history: [],
        favorites: []
      },
      news: {
        label: 'News',
        description: 'Headlines and reporting from major outlets',
        sites: [],
        history: [],
        favorites: []
      },
      productivity: {
        label: 'Productivity',
        description: 'Mail, docs, calendars, and work tools',
        sites: [],
        history: [],
        favorites: []
      },
      videos: {
        label: 'Videos',
        description: 'Watch and search video sites',
        sites: [],
        history: [],
        favorites: []
      },
      entertainment: {
        label: 'Entertainment',
        description: 'Streaming and entertainment destinations',
        sites: [],
        history: [],
        favorites: []
      },
      shopping: {
        label: 'Shopping',
        description: 'Stores and marketplaces',
        sites: [],
        history: [],
        favorites: []
      },
      ai: {
        label: 'AI',
        description: 'Chatbots and AI assistants',
        sites: [],
        history: [],
        favorites: []
      },
      archive: {
        label: 'Internet Archive',
        description: 'Search and browse the Internet Archive library',
        sites: [],
        history: [],
        favorites: []
      },
      searches: {
        label: 'Searches',
        description: 'Search engines and recent web searches',
        sites: [],
        history: [],
        favorites: []
      }
    };

    this._recomposeCatalogDecks();
    this._initDefaultSubTabs();
  }

  /**
   * Rebuild composed Launch Decks for all catalog categories.
   * @param {string[]} [onlyKeys]
   */
  _recomposeCatalogDecks(onlyKeys = null) {
    if (!this._categories) return;
    const keys = onlyKeys || LAUNCHER_CATALOG_CATEGORY_KEYS;
    for (const key of keys) {
      if (!this._categories[key]) continue;
      if (!LAUNCHER_CATALOG_CATEGORY_KEYS.includes(key)) continue;
      const history = this._categories[key].history || [];
      this._categories[key].sites = composeLaunchDeck(key, {
        state: this._launchDeckState,
        history,
        showDeck: this._showDefaultSites
      });
    }
  }

  /**
   * @returns {boolean}
   */
  _isCatalogCategory(categoryKey = this._currentCategory) {
    return LAUNCHER_CATALOG_CATEGORY_KEYS.includes(categoryKey);
  }

  /**
   * Pick default sub-tab per category from current item counts.
   * Prefers Sites → Favorites → History when present.
   * @param {{ force?: boolean, onlyKeys?: string[] }} [opts]
   */
  _initDefaultSubTabs(opts = {}) {
    const force = !!opts.force;
    const onlyKeys = Array.isArray(opts.onlyKeys) ? new Set(opts.onlyKeys) : null;

    for (const categoryKey in this._categories) {
      if (onlyKeys && !onlyKeys.has(categoryKey)) continue;

      const subTabConfig = this._categorySubTabConfig[categoryKey] || ['favorites', 'history'];
      const current = this._categorySubTabs[categoryKey];
      if (!force && subTabConfig.includes(current)) continue;

      const sitesCount = this._categories[categoryKey].sites?.length || 0;
      const historyCount = this._categories[categoryKey].history?.length || 0;
      const favoritesCount = this._categories[categoryKey].favorites?.length || 0;

      if (categoryKey === 'launchDeck' && subTabConfig.includes('favorites')) {
        this._categorySubTabs[categoryKey] = 'favorites';
      } else if (sitesCount > 0 && subTabConfig.includes('sites')) {
        this._categorySubTabs[categoryKey] = 'sites';
      } else if (favoritesCount > 0 && subTabConfig.includes('favorites')) {
        this._categorySubTabs[categoryKey] = 'favorites';
      } else if (historyCount > 0 && subTabConfig.includes('history')) {
        this._categorySubTabs[categoryKey] = 'history';
      } else {
        // Prefer history for data-backed tabs while empty so progressive load
        // lands on the list that is about to fill (bookmarks/top sites).
        // Never default to the virtual Search tab.
        this._categorySubTabs[categoryKey] = subTabConfig.includes('history')
          ? 'history'
          : (subTabConfig.find((t) => t !== 'search') || subTabConfig[0]);
      }
    }
  }

  /**
   * Keep the stored sub-tab valid for a category's current config.
   * @param {string} categoryKey
   */
  _ensureValidSubTab(categoryKey) {
    const cfg = this._categorySubTabConfig[categoryKey] || ['favorites', 'history', 'search'];
    const current = this._categorySubTabs[categoryKey];
    if (cfg.includes(current)) return;
    if (categoryKey === 'launchDeck' && cfg.includes('favorites')) {
      this._categorySubTabs[categoryKey] = 'favorites';
      return;
    }
    this._categorySubTabs[categoryKey] = cfg.find((t) => t !== 'search') || cfg[0];
  }

  /**
   * Restore last selected category + sub-tabs. Launch Deck is the default
   * until the user has chosen another tab.
   */
  async _loadNavState() {
    try {
      const raw = await storageGetValue(LAUNCHER_NAV_STATE_KEY, null);
      const category =
        raw && typeof raw.category === 'string' && this._categoryOrder.includes(raw.category)
          ? raw.category
          : 'launchDeck';
      this._currentCategory = category;

      if (raw && raw.subTabs && typeof raw.subTabs === 'object') {
        for (const [key, value] of Object.entries(raw.subTabs)) {
          const cfg = this._categorySubTabConfig[key];
          if (cfg && cfg.includes(value)) {
            this._categorySubTabs[key] = value;
          }
        }
      }
      this._ensureValidSubTab(this._currentCategory);
    } catch (err) {
      console.warn('[LauncherPopover] Failed to load launcher nav state:', err);
      this._currentCategory = 'launchDeck';
    }
  }

  /**
   * Persist the active category and per-category sub-tab so the next open
   * returns to the same place.
   */
  _persistNavState() {
    const payload = {
      category: this._currentCategory,
      subTabs: { ...this._categorySubTabs }
    };
    void storageSetValue(LAUNCHER_NAV_STATE_KEY, payload).catch((err) => {
      console.warn('[LauncherPopover] Failed to persist launcher nav state:', err);
    });
  }

  /**
   * Load bookmarks + top sites + recent history once (parallel).
   * Domain history is lazy per category.
   * @param {number} gen
   */
  async _loadSharedData(gen) {
    try {
      const [bookmarks, topSites, recentHistory] = await Promise.all([
        this._getBookmarks(),
        this._getTopSites(),
        this._getRecentHistory()
      ]);
      if (!this._stillOpen(gen) || !this._categories) return;

      this._cachedBookmarks = bookmarks;
      this._cachedTopSites = topSites;
      this._cachedRecentHistory = recentHistory;

      // Launch Deck: toolbar bookmarks + most visited sites.
      this._categories.launchDeck.sites = [];
      this._categories.launchDeck.favorites = this._filterToolbarBookmarks(bookmarks);
      this._categories.launchDeck.history = topSites;

      // Bookmarks: Favorites = all; History = top sites / recent visits.
      this._categories.bookmarks.sites = [];
      this._categories.bookmarks.favorites = bookmarks;
      this._categories.bookmarks.history = topSites;

      // Recent: top visited domains.
      this._categories.history.sites = [];
      this._categories.history.favorites = [];
      this._categories.history.history = topSites;

      // Searches: launcher engines stay in Sites; bookmarked engines in Favorites.
      // History is filled via domain visits in `_ensureCategoryHistory` (Sites domains).
      const searchDomains = this._getDefaultDomains('searches');
      this._categories.searches.favorites = this._filterByDomains(bookmarks, searchDomains);
      this._categories.searches.history = [];

      // Theme categories: bookmarks matching curated domains → Favorites.
      const themeKeys = [
        'social', 'news', 'productivity', 'videos',
        'entertainment', 'shopping', 'ai', 'archive'
      ];
      for (const key of themeKeys) {
        if (!this._categories[key]) continue;
        const domains = this._getDefaultDomains(key);
        this._categories[key].favorites = this._filterByDomains(bookmarks, domains);
      }

      // Shared lists that don't need Sites-domain history fetches.
      this._historyLoaded.launchDeck = true;
      this._historyLoaded.bookmarks = true;
      this._historyLoaded.history = true;
      // searches + theme categories: history loaded lazily via `_ensureCategoryHistory`

      // Fill missing sub-tab defaults now that shared lists exist.
      // Do not force — restored / user-chosen tab+subtab must stick.
      this._initDefaultSubTabs({
        onlyKeys: ['launchDeck', 'bookmarks', 'history', 'searches']
      });
      try { this._updateSubTabsUI?.(); } catch { /* ignore */ }
      try { this._updateSubTabStyles?.(); } catch { /* ignore */ }
      try { this._updateTabCounts?.(); } catch { /* ignore */ }

      if (this._gridContainer) {
        this._renderCategory(this._currentCategory);
      }
    } catch (error) {
      console.error('[LauncherPopover] Error loading shared data:', error);
    }
  }

  /**
   * Fetch Sites-domain history for a category the first time it's viewed.
   * History consistently tracks visits to pages under that category's Sites list.
   * @param {string} categoryKey
   * @param {number} [gen]
   */
  async _ensureCategoryHistory(categoryKey, gen = this._openGen) {
    if (!categoryKey || !this._categories?.[categoryKey]) return;
    if (this._historyLoaded[categoryKey]) return;

    // Only categories with curated Sites lists use per-domain history.
    const domains = this._getDefaultDomains(categoryKey);
    if (!domains.length) {
      this._historyLoaded[categoryKey] = true;
      return;
    }

    // Mark in-flight so rapid tab switches don't double-fetch.
    this._historyLoaded[categoryKey] = 'pending';
    try {
      const history = await this._getHistoryForDomains(domains, {
        queries: this._getHistorySearchQueries(categoryKey),
        maxResults: 300,
        days: 30
      });

      if (!this._stillOpen(gen) || !this._categories?.[categoryKey]) return;

      this._categories[categoryKey].history = history;
      // Keep Favorites = matching bookmarks (may already be set in shared load).
      if (Array.isArray(this._cachedBookmarks)) {
        this._categories[categoryKey].favorites = this._filterByDomains(
          this._cachedBookmarks,
          domains
        );
      }
      // Recompose Launch Deck now that visit data is available (auto-add).
      if (this._isCatalogCategory(categoryKey)) {
        this._recomposeCatalogDecks([categoryKey]);
      }
      this._historyLoaded[categoryKey] = true;
      this._ensureValidSiteFilter(categoryKey);

      const sitesCount = this._categories[categoryKey].sites?.length || 0;
      const favoritesCount = this._categories[categoryKey].favorites?.length || 0;
      if (history.length > 0 && sitesCount === 0 && favoritesCount === 0) {
        const subTabConfig = this._categorySubTabConfig[categoryKey] || ['favorites', 'history'];
        this._categorySubTabs[categoryKey] = subTabConfig.includes('history')
          ? 'history'
          : subTabConfig[0];
      }
      try { this._updateSubTabsUI?.(); } catch { /* ignore */ }
      try { this._updateSubTabStyles?.(); } catch { /* ignore */ }
      try { this._updateTabCounts?.(); } catch { /* ignore */ }

      if (this._currentCategory === categoryKey && this._gridContainer) {
        this._renderCategory(categoryKey);
      }
    } catch (error) {
      console.error('[LauncherPopover] Error loading category history:', categoryKey, error);
      this._historyLoaded[categoryKey] = true;
    }
  }

  /**
   * Apply "Show Launch Deck" checkbox: recompose or clear catalog decks.
   */
  _applyDefaultSitesVisibility() {
    if (!this._categories) return;
    if (!this._showDefaultSites) {
      this._launchDeckEditMode = false;
      this._closeAddSitePicker();
    }
    this._recomposeCatalogDecks();
  }

  /**
   * @returns {Promise<void>}
   */
  async _loadLaunchDeckState() {
    try {
      this._launchDeckState = await loadLaunchDeckState();
    } catch (err) {
      console.warn('[LauncherPopover] Failed to load Launch Deck state:', err);
      this._launchDeckState = Object.create(null);
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async _persistLaunchDeckState() {
    try {
      await persistLaunchDeckState(this._launchDeckState);
    } catch (err) {
      console.warn('[LauncherPopover] Failed to persist Launch Deck state:', err);
    }
  }

  /**
   * Remove a Launch Deck card for the active catalog category.
   * @param {string} url
   */
  async _hideLaunchDeckItem(url) {
    const categoryKey = this._currentCategory;
    if (!this._isCatalogCategory(categoryKey)) return;

    this._launchDeckState = removeFromLaunchDeck(
      this._launchDeckState,
      categoryKey,
      url
    );
    void this._persistLaunchDeckState();
    this._recomposeCatalogDecks([categoryKey]);

    const key = normalizeLaunchDeckUrl(url);
    if (this._currentPreviewUrl && normalizeLaunchDeckUrl(this._currentPreviewUrl) === key) {
      try { this._hidePreview(); } catch { /* ignore */ }
    }

    try { this._updateTabCounts?.(); } catch { /* ignore */ }
    try { this._updateSubTabsUI?.(); } catch { /* ignore */ }
    try { this._updateLaunchDeckEditBar?.(); } catch { /* ignore */ }
    if (this._gridContainer) {
      this._renderCategory(this._currentCategory);
    }
  }

  /**
   * Persist current composed deck order for a category.
   * @param {string} categoryKey
   */
  async _persistCurrentDeckOrder(categoryKey) {
    if (!this._isCatalogCategory(categoryKey)) return;
    const urls = (this._categories?.[categoryKey]?.sites || [])
      .map((s) => s?.url)
      .filter(Boolean);
    this._launchDeckState = setLaunchDeckOrder(
      this._launchDeckState,
      categoryKey,
      urls
    );
    await this._persistLaunchDeckState();
  }

  /**
   * Move a Launch Deck card up/down while editing.
   * @param {string} url
   * @param {-1|1} delta
   */
  async _moveLaunchDeckItem(url, delta) {
    const categoryKey = this._currentCategory;
    if (!this._isCatalogCategory(categoryKey) || !this._launchDeckEditMode) return;
    const sites = this._categories?.[categoryKey]?.sites;
    if (!Array.isArray(sites) || !sites.length) return;

    const key = normalizeLaunchDeckUrl(url);
    const idx = sites.findIndex((s) => normalizeLaunchDeckUrl(s.url) === key);
    if (idx < 0) return;
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= sites.length) return;

    const next = sites.slice();
    const [item] = next.splice(idx, 1);
    next.splice(nextIdx, 0, item);
    this._categories[categoryKey].sites = next;
    await this._persistCurrentDeckOrder(categoryKey);
    this._renderCategory(categoryKey);
  }

  /**
   * Add a site to the current Launch Deck (from picker or custom URL).
   * @param {{ title: string, url: string, fromCatalog?: boolean }} site
   */
  async _addLaunchDeckSite(site) {
    const categoryKey = this._currentCategory;
    if (!this._isCatalogCategory(categoryKey)) return;

    // If the user has never reordered, lock in the current composed order first
    // so Add appends instead of collapsing order to the new URL only.
    const catBefore = this._launchDeckState?.[categoryKey];
    if (!catBefore?.order?.length) {
      const existing = (this._categories?.[categoryKey]?.sites || [])
        .map((s) => s.url)
        .filter(Boolean);
      if (existing.length) {
        this._launchDeckState = setLaunchDeckOrder(
          this._launchDeckState,
          categoryKey,
          existing
        );
      }
    }

    this._launchDeckState = addToLaunchDeck(
      this._launchDeckState,
      categoryKey,
      site
    );
    await this._persistLaunchDeckState();
    this._recomposeCatalogDecks([categoryKey]);
    this._closeAddSitePicker();
    try { this._updateTabCounts?.(); } catch { /* ignore */ }
    try { this._updateSubTabsUI?.(); } catch { /* ignore */ }
    this._renderCategory(categoryKey);
  }

  /**
   * @param {boolean} enabled
   */
  _setLaunchDeckEditMode(enabled) {
    if (!this._isCatalogCategory()) {
      this._launchDeckEditMode = false;
    } else {
      this._launchDeckEditMode = !!enabled;
    }
    if (!this._launchDeckEditMode) this._closeAddSitePicker();
    this._updateLaunchDeckEditBar();
    this._renderCategory(this._currentCategory);
  }

  _closeAddSitePicker() {
    if (this._addSitePicker?.parentNode) {
      try { this._addSitePicker.remove(); } catch { /* ignore */ }
    }
    this._addSitePicker = null;
  }

  /**
   * Bookmarks that live on Chrome's bookmarks bar (toolbar), including
   * URLs nested in folders on the bar.
   * @param {Array<{url?: string, isToolbar?: boolean, parentId?: string}>} bookmarks
   * @returns {Array}
   */
  _filterToolbarBookmarks(bookmarks) {
    if (!Array.isArray(bookmarks) || !bookmarks.length) return [];
    return bookmarks.filter((b) =>
      !!(b?.url && (b.isToolbar === true || b.parentId === '1'))
    );
  }

  /**
   * Get bookmarks via message passing to background script
   */
  async _getBookmarks() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MSG.GET_BOOKMARKS
      });

      if (response && response.success && response.bookmarks) {
        return response.bookmarks;
      }
      console.warn('[LauncherPopover] Failed to get bookmarks:', response?.error);
      return [];
    } catch (error) {
      console.warn('[LauncherPopover] Bookmarks message failed:', error);
      return [];
    }
  }

  /**
   * Get top visited sites from history via message passing
   */
  async _getTopSites() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MSG.GET_TOP_SITES,
        // Background already aggregates to top 100 domains; 250 raw hits is enough.
        maxResults: 250,
        days: 30
      });

      if (response && response.success && response.topSites) {
        return response.topSites;
      }
      console.warn('[LauncherPopover] Failed to get top sites:', response?.error);
      return [];
    } catch (error) {
      console.error('[LauncherPopover] Error getting top sites:', error);
      return [];
    }
  }

  /**
   * Recent browser history rows (for bookmark ↔ visit intersection).
   */
  async _getRecentHistory() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MSG.GET_RECENT_HISTORY,
        maxResults: 1000,
        days: 30
      });

      if (response && response.success && Array.isArray(response.items)) {
        return response.items;
      }
      console.warn('[LauncherPopover] Failed to get recent history:', response?.error);
      return [];
    } catch (error) {
      console.error('[LauncherPopover] Error getting recent history:', error);
      return [];
    }
  }

  /**
   * Normalize a URL for bookmark ↔ history matching.
   * @param {string} url
   * @returns {string}
   */
  _normalizeVisitUrl(url) {
    return normalizeLaunchDeckUrl(url);
  }

  /**
   * Bookmarks Launch Deck: up to `limit` bookmarked URLs ranked by visit frequency.
   * Exact history URL match preferred; otherwise host-level visit totals.
   * @param {Array<{title?: string, url?: string, dateAdded?: number}>} bookmarks
   * @param {Array<{url?: string, visitCount?: number, lastVisitTime?: number}>} historyItems
   * @param {number} [limit]
   * @returns {Array<{title: string, url: string, dateAdded?: number, visitCount: number, lastVisitTime: number, isDefault: boolean}>}
   */
  _buildMostVisitedBookmarkedSites(bookmarks, historyItems, limit = 50) {
    if (!Array.isArray(bookmarks) || !bookmarks.length) return [];
    const history = Array.isArray(historyItems) ? historyItems : [];
    const cap = Math.max(1, Math.min(100, Number(limit) || 50));

    /** @type {Map<string, number>} */
    const visitsByUrl = new Map();
    /** @type {Map<string, number>} */
    const lastByUrl = new Map();
    /** @type {Map<string, number>} */
    const visitsByHost = new Map();
    /** @type {Map<string, number>} */
    const lastByHost = new Map();

    for (const item of history) {
      if (!item?.url) continue;
      const key = this._normalizeVisitUrl(item.url);
      const vc = Number(item.visitCount) || 0;
      const lt = Number(item.lastVisitTime) || 0;
      if (vc > 0) {
        visitsByUrl.set(key, Math.max(visitsByUrl.get(key) || 0, vc));
      }
      if (lt > 0) {
        lastByUrl.set(key, Math.max(lastByUrl.get(key) || 0, lt));
      }
      try {
        const host = new URL(item.url).hostname.toLowerCase().replace(/^www\./, '');
        if (!host) continue;
        visitsByHost.set(host, (visitsByHost.get(host) || 0) + Math.max(vc, 0));
        lastByHost.set(host, Math.max(lastByHost.get(host) || 0, lt));
      } catch {
        /* ignore */
      }
    }

    /** @type {Map<string, {title: string, url: string, dateAdded?: number, visitCount: number, lastVisitTime: number, isDefault: boolean}>} */
    const bestByUrl = new Map();

    for (const bm of bookmarks) {
      if (!bm?.url) continue;
      const key = this._normalizeVisitUrl(bm.url);
      let visitCount = visitsByUrl.get(key) || 0;
      let lastVisitTime = lastByUrl.get(key) || 0;

      if (visitCount <= 0) {
        try {
          const host = new URL(bm.url).hostname.toLowerCase().replace(/^www\./, '');
          visitCount = visitsByHost.get(host) || 0;
          lastVisitTime = lastByHost.get(host) || 0;
        } catch {
          /* ignore */
        }
      }
      if (visitCount <= 0) continue;

      const prev = bestByUrl.get(key);
      if (
        !prev ||
        visitCount > prev.visitCount ||
        (visitCount === prev.visitCount && lastVisitTime > prev.lastVisitTime)
      ) {
        bestByUrl.set(key, {
          title: bm.title || extractDomain(bm.url) || 'Untitled',
          url: bm.url,
          dateAdded: bm.dateAdded,
          visitCount,
          lastVisitTime,
          isDefault: true
        });
      }
    }

    return Array.from(bestByUrl.values())
      .sort((a, b) => {
        const scoreDiff = b.visitCount - a.visitCount;
        if (scoreDiff !== 0) return scoreDiff;
        return (b.lastVisitTime || 0) - (a.lastVisitTime || 0);
      })
      .slice(0, cap);
  }

  /**
   * Get history for specific domains via message passing
   * @param {string[]} domains
   * @param {{ queries?: string[], maxResults?: number, days?: number }} [opts]
   */
  async _getHistoryForDomains(domains, opts = {}) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MSG.GET_HISTORY_FOR_DOMAINS,
        domains: domains,
        queries: Array.isArray(opts.queries) ? opts.queries : [],
        days: opts.days || 30,
        maxResults: opts.maxResults || 300
      });

      if (response && response.success && response.history) {
        return response.history;
      }
      console.warn('[LauncherPopover] Failed to get history for domains:', response?.error);
      return [];
    } catch (error) {
      console.error('[LauncherPopover] Error getting history for domains:', error);
      return [];
    }
  }

  /**
   * Extract recent search queries from already-fetched top-site rows (no extra API call).
   * @param {Array<{title?: string, url?: string}>} topSites
   */
  _extractRecentSearches(topSites) {
    if (!Array.isArray(topSites)) return [];

    const searches = [];
    const seenQueries = new Set();

    for (const item of topSites) {
      if (!item?.url) continue;
      try {
        const url = new URL(item.url);
        let query = null;

        if (url.hostname.includes('google.com') && url.pathname === '/search') {
          query = url.searchParams.get('q');
        } else if (url.hostname.includes('bing.com') && url.pathname === '/search') {
          query = url.searchParams.get('q');
        } else if (url.hostname.includes('duckduckgo.com')) {
          query = url.searchParams.get('q');
        } else if (url.hostname.includes('yahoo.com') && url.pathname === '/search') {
          query = url.searchParams.get('p');
        }

        if (query && !seenQueries.has(query)) {
          seenQueries.add(query);
          searches.push({
            title: query,
            url: item.url
          });
        }
      } catch {
        // Skip invalid URLs
      }
    }

    return searches.slice(0, 50);
  }

  /**
   * Filter items by matching domains
   */
  _filterByDomains(items, domains) {
    return items.filter((item) => {
      const itemDomain = extractDomain(item.url);
      if (!itemDomain) return false;
      return domains.some((domain) => itemDomain === domain || itemDomain.endsWith('.' + domain));
    });
  }

  /**
   * Whether an item URL belongs to a Sites entry.
   * Path-aware: `/details/texts` only matches that collection prefix.
   * Host-aware: `web.archive.org` is not claimed by parent `archive.org`.
   * Root sites exclude URLs claimed by more-specific sibling path sites.
   * @param {string} itemUrl
   * @param {{ url?: string, title?: string }} site
   * @param {Array<{ url?: string, title?: string }>} [siblings]
   */
  _itemMatchesSite(itemUrl, site, siblings = null) {
    const siteDomain = extractDomain(site?.url);
    const itemDomain = extractDomain(itemUrl);
    if (!siteDomain || !itemDomain) return false;

    const sibs = Array.isArray(siblings)
      ? siblings
      : [];

    // Prefer an exact-host sibling over a parent-domain match
    // (web.archive.org vs archive.org).
    if (itemDomain !== siteDomain) {
      const exactHostSibling = sibs.find((s) => {
        if (!s?.url || s.url === site.url) return false;
        return extractDomain(s.url) === itemDomain;
      });
      if (exactHostSibling) return false;
      if (!itemDomain.endsWith('.' + siteDomain)) return false;
    }

    const sitePath = this._sitePathPrefix(site.url);
    let itemPath = '';
    try {
      itemPath = (new URL(String(itemUrl || '').trim()).pathname || '').replace(/\/+$/, '');
      if (itemPath === '/') itemPath = '';
    } catch {
      return false;
    }

    if (sitePath) {
      return itemPath === sitePath || itemPath.startsWith(`${sitePath}/`);
    }

    // Domain-root site: exclude URLs that belong to a path-specific sibling
    // on the same host (or a matching host).
    for (const sib of sibs) {
      if (!sib?.url || sib.url === site.url) continue;
      const sibDomain = extractDomain(sib.url);
      const sibPath = this._sitePathPrefix(sib.url);
      if (!sibPath || !sibDomain) continue;
      const hostOk =
        itemDomain === sibDomain || itemDomain.endsWith('.' + sibDomain);
      if (!hostOk) continue;
      if (itemPath === sibPath || itemPath.startsWith(`${sibPath}/`)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Sum of Chrome history visitCounts for URLs belonging to a Launch Deck site.
   * @param {{ url?: string }} site
   * @param {Array<{url?: string, visitCount?: number}>} history
   * @param {Array<{url?: string}>} siblings
   * @returns {number}
   */
  _siteVisitScore(site, history, siblings) {
    if (!Array.isArray(history) || !history.length) return 0;
    let score = 0;
    for (const item of history) {
      if (!this._itemMatchesSite(item?.url, site, siblings)) continue;
      const n = Number(item.visitCount);
      score += Number.isFinite(n) && n > 0 ? n : 1;
    }
    return score;
  }

  /**
   * Most recent lastVisitTime among history rows for a Launch Deck site.
   * @param {{ url?: string }} site
   * @param {Array<{url?: string, lastVisitTime?: number}>} history
   * @param {Array<{url?: string}>} siblings
   * @returns {number}
   */
  _siteLastVisitTime(site, history, siblings) {
    if (!Array.isArray(history) || !history.length) return 0;
    let latest = 0;
    for (const item of history) {
      if (!this._itemMatchesSite(item?.url, site, siblings)) continue;
      const t = Number(item.lastVisitTime) || 0;
      if (t > latest) latest = t;
    }
    return latest;
  }

  /**
   * Curated Sites with ≥1 matching item in the given list (favorites or history).
   * Site-filter subtabs never show a 0-count entry.
   * @param {string} categoryKey
   * @param {'favorites'|'history'} listKey
   * @returns {Array<{title: string, url: string}>}
   */
  _getSitesWithPrimaryItems(categoryKey, listKey) {
    const sites = this._defaultSites[categoryKey];
    const items = this._categories?.[categoryKey]?.[listKey];
    if (!Array.isArray(sites) || !sites.length || !Array.isArray(items) || !items.length) {
      return [];
    }
    return sites.filter((site) =>
      items.some((item) => this._itemMatchesSite(item?.url, site, sites))
    );
  }

  /**
   * Keep the category's site filter valid for Favorites/History.
   * Filter set depends on the active primary sub-tab (bookmarks vs visits).
   * @param {string} categoryKey
   */
  _ensureValidSiteFilter(categoryKey) {
    const primary = this._categorySubTabs[categoryKey] || 'history';
    if (primary !== 'favorites' && primary !== 'history') {
      this._categorySiteFilters[categoryKey] = null;
      return;
    }
    const sitesWithItems = this._getSitesWithPrimaryItems(categoryKey, primary);
    const current = this._categorySiteFilters[categoryKey];
    if (!sitesWithItems.length) {
      this._categorySiteFilters[categoryKey] = null;
      return;
    }
    const stillValid = sitesWithItems.some((s) => s.url === current);
    if (!stillValid) {
      this._categorySiteFilters[categoryKey] = sitesWithItems[0].url;
    }
  }

  /**
   * Items for the active primary sub-tab, optionally filtered by Sites domain/path.
   * Launch Deck is sorted by visit frequency (most visited first).
   * @param {string} categoryKey
   * @returns {Array}
   */
  _getActiveSubTabItems(categoryKey) {
    const category = this._categories?.[categoryKey];
    if (!category) return [];
    const currentSubTab = this._categorySubTabs[categoryKey] || 'history';
    if (currentSubTab === 'search') {
      return this._getCategorySearchResults(categoryKey);
    }

    let items = category[currentSubTab] || [];

    if (currentSubTab === 'sites') {
      // Catalog decks are already composed (order + visits + removed).
      if (this._isCatalogCategory(categoryKey)) {
        return items;
      }
      // Bookmarks Launch Deck: enrich visit timestamps for card footers.
      const sites = this._defaultSites[categoryKey] || [];
      const history = category.history || [];
      return [...items].map((item) => {
        const lastVisitTime =
          Number(item?.lastVisitTime) > 0
            ? Number(item.lastVisitTime)
            : this._siteLastVisitTime(item, history, sites);
        return lastVisitTime > 0 ? { ...item, lastVisitTime } : item;
      });
    }

    if (currentSubTab === 'favorites' || currentSubTab === 'history') {
      const siteUrl = this._categorySiteFilters[categoryKey];
      if (siteUrl) {
        const sites = this._defaultSites[categoryKey] || [];
        const site = sites.find((s) => s.url === siteUrl);
        if (site) {
          items = items.filter((item) => this._itemMatchesSite(item?.url, site, sites));
        }
      }
    }
    return items;
  }

  /**
   * @param {number|string|null|undefined} timestamp
   * @returns {string|null}
   */
  _formatCardDate(timestamp) {
    const n = Number(timestamp);
    if (!Number.isFinite(n) || n <= 0) return null;
    try {
      return new Date(n).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return null;
    }
  }

  /**
   * @param {number|string|null|undefined} dateAdded
   * @returns {string|null}
   */
  _formatBookmarkAddedDate(dateAdded) {
    return this._formatCardDate(dateAdded);
  }

  /**
   * Absolute bottom date strip used on Launch Deck / URL listing cards.
   * @param {Document} doc
   * @param {string} text
   * @param {string} [className]
   * @returns {HTMLElement}
   */
  _createCardDateOverlay(doc, text, className = 'kp-launcher-card-visited-on') {
    const overlay = doc.createElement('div');
    overlay.className = className;
    overlay.textContent = text;
    overlay.style.cssText = `
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 6px 12px;
      background: rgba(0, 0, 0, 0.72);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      color: #c8c8c8;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
      z-index: 2;
    `;
    return overlay;
  }

  /**
   * Filter items by keywords in URL or title
   */
  _filterByKeywords(items, keywords) {
    return items.filter(item => {
      const searchText = `${item.title} ${item.url}`.toLowerCase();
      return keywords.some(keyword => searchText.includes(keyword));
    });
  }

  /**
   * Reset launcher controls inside its isolated shadow tree.
   *
   * @param {ShadowRoot|null} shadowRoot
   */
  _injectScopedStyles(shadowRoot) {
    if (!shadowRoot) return;
    injectChromeStyles(shadowRoot, {
      attr: 'data-kp-launcher-scope',
      css: `
      .kp-launcher-shell button,
      .kp-launcher-shell [role="button"],
      .kp-launcher-shell input,
      .kp-launcher-shell select,
      .kp-launcher-shell textarea {
        border-radius: 0;
      }
      `
    });
  }

  /**
   * Build the launcher UI
   */
  _buildUI() {
    const doc = document;

    // Main container
    this._container = doc.createElement('div');
    this._container.className = 'kp-launcher-container';
    this._container.setAttribute('role', 'dialog');
    this._container.setAttribute('aria-label', 'Launcher');
    // Allow Escape to close even when the search field has focus and page handlers interfere.
    this._container.tabIndex = -1;
    this._container.style.cssText = `
      position: fixed;
      inset: 60px;
      transform: translateZ(0);
      width: auto;
      height: auto;
      isolation: isolate;
      contain: layout style paint;
      will-change: transform;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      -webkit-transform: translateZ(0);
    `;

    this._shadowRoot = ensureOpenChromeShadow(this._container, { id: 'launcher', chromeWindow: true });
    const mount = this._shadowRoot || this._container;
    this._injectScopedStyles(this._shadowRoot);
    this._shell = doc.createElement('div');
    this._shell.className = 'kp-launcher-shell';
    this._shell.style.cssText = `
      width: 100%;
      height: 100%;
      background: ${NCT_DARK_UI_PANEL_BACKGROUND};
      border: ${NCT_DARK_UI_PANEL_BORDER};
      border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
      display: flex;
      overflow: hidden;
      box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
      box-sizing: border-box;
    `;
    mount.appendChild(this._shell);

    this._boundContainerKeyDown = (e) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        try { e.stopImmediatePropagation(); } catch { /* ignore */ }
        if (this._launchDeckEditMode) {
          this._setLaunchDeckEditMode(false);
          return;
        }
        this.hide();
      }
    };
    this._container.addEventListener('keydown', this._boundContainerKeyDown, true);

    // Left sidebar (brand + tab list)
    const sidebar = doc.createElement('div');
    sidebar.className = 'kp-launcher-sidebar';
    sidebar.style.cssText = `
      width: 220px;
      background: #0f0f0f;
      border-right: 1px solid #333;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    `;

    const brand = doc.createElement('div');
    brand.className = 'kp-launcher-brand';
    brand.style.cssText = `
      box-sizing: border-box;
      height: 48px;
      min-height: 48px;
      max-height: 48px;
      padding: 6px 16px;
      background: ${NCT_DARK_UI_TITLEBAR_GRADIENT};
      border-bottom: ${NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM};
      display: flex;
      flex-direction: column;
      justify-content: center;
      flex-shrink: 0;
    `;

    const brandTitle = doc.createElement('h2');
    brandTitle.className = 'kp-launcher-title';
    brandTitle.textContent = 'Launcher';
    brandTitle.style.cssText = `
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.2;
      color: #fff;
    `;

    const brandSubtitle = doc.createElement('p');
    brandSubtitle.className = 'kp-launcher-subtitle';
    brandSubtitle.textContent = 'Quick access to your favorite sites';
    brandSubtitle.style.cssText = `
      margin: 2px 0 0 0;
      font-size: 11px;
      line-height: 1.2;
      color: #888;
    `;

    brand.appendChild(brandTitle);
    brand.appendChild(brandSubtitle);
    sidebar.appendChild(brand);

    // Tab list
    this._tabListContainer = doc.createElement('div');
    this._tabListContainer.className = 'kp-launcher-tabs';
    this._tabListContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      padding: 12px 0;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    `;

    // Render tabs with dividers between each entry
    if (this._categories) {
      const categoryKeys = Object.keys(this._categories);
      categoryKeys.forEach((categoryKey, index) => {
        const category = this._categories[categoryKey];
        const tab = this._createTab(categoryKey, category);
        this._tabListContainer.appendChild(tab);

        if (index < categoryKeys.length - 1) {
          const divider = doc.createElement('div');
          divider.className = 'kp-launcher-tab-divider';
          divider.setAttribute('aria-hidden', 'true');
          divider.style.cssText = `
            height: 1px;
            margin: 2px 16px;
            background: #2a2a2a;
            flex-shrink: 0;
            pointer-events: none;
          `;
          this._tabListContainer.appendChild(divider);
        }
      });
    }

    sidebar.appendChild(this._tabListContainer);

    // Checkbox for showing default sites
    const checkboxContainer = doc.createElement('div');
    checkboxContainer.style.cssText = `
      padding: 12px 16px;
      border-top: 1px solid #333;
      margin-top: auto;
    `;

    const checkboxLabel = doc.createElement('label');
    checkboxLabel.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      color: #888;
      font-size: 12px;
      cursor: pointer;
    `;

    const checkbox = doc.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this._showDefaultSites;
    checkbox.style.cssText = `
      cursor: pointer;
    `;

    checkbox.addEventListener('change', (e) => {
      this._showDefaultSites = e.target.checked;
      this._applyDefaultSitesVisibility();
      // If Sites was selected but is now empty, fall back to Favorites/History.
      const cat = this._currentCategory;
      const active = this._categorySubTabs[cat];
      if (active === 'sites' && (this._categories?.[cat]?.sites?.length || 0) === 0) {
        const cfg = this._categorySubTabConfig[cat] || ['favorites', 'history', 'search'];
        const fav = this._categories?.[cat]?.favorites?.length || 0;
        const hist = this._categories?.[cat]?.history?.length || 0;
        if (fav > 0 && cfg.includes('favorites')) this._categorySubTabs[cat] = 'favorites';
        else if (hist > 0 && cfg.includes('history')) this._categorySubTabs[cat] = 'history';
        else this._categorySubTabs[cat] = cfg.find((t) => t !== 'sites' && t !== 'search') || 'history';
      }
      this._persistNavState();
      this._updateTabCounts();
      this._updateSubTabsUI();
      this._updateSubTabStyles();
      this._renderCategory(this._currentCategory);
    });

    const checkboxText = doc.createElement('span');
    checkboxText.textContent = 'Show Launch Deck';

    checkboxLabel.appendChild(checkbox);
    checkboxLabel.appendChild(checkboxText);
    checkboxContainer.appendChild(checkboxLabel);

    sidebar.appendChild(checkboxContainer);

    // Right content area
    const contentArea = doc.createElement('div');
    contentArea.className = 'kp-launcher-content';
    contentArea.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // Header: active tab name/description on the left, optional page search on the right
    const header = doc.createElement('div');
    header.className = 'kp-launcher-header';
    header.style.cssText = `
      box-sizing: border-box;
      height: 48px;
      min-height: 48px;
      max-height: 48px;
      padding: 6px 16px;
      border-bottom: ${NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM};
      background: ${NCT_DARK_UI_TITLEBAR_GRADIENT};
      display: flex;
      align-items: center;
      gap: 16px;
      flex-shrink: 0;
    `;

    const titleBlock = doc.createElement('div');
    titleBlock.className = 'kp-launcher-title-block';
    titleBlock.style.cssText = `
      flex: 0 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
    `;

    this._headerTitle = doc.createElement('h2');
    this._headerTitle.className = 'kp-launcher-category-title';
    this._headerTitle.style.cssText = `
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.2;
      color: #fff;
    `;

    this._headerDescription = doc.createElement('p');
    this._headerDescription.className = 'kp-launcher-category-description';
    this._headerDescription.style.cssText = `
      margin: 2px 0 0 0;
      font-size: 11px;
      line-height: 1.2;
      color: #888;
    `;

    titleBlock.appendChild(this._headerTitle);
    titleBlock.appendChild(this._headerDescription);

    // Page-level search slot (e.g. Archive) — filled per category template
    this._headerSearchSlot = doc.createElement('div');
    this._headerSearchSlot.className = 'kp-launcher-header-search';
    this._headerSearchSlot.style.cssText = `
      flex: 1 1 280px;
      display: none;
      justify-content: flex-end;
      min-width: 220px;
      max-width: 580px;
      margin-left: auto;
    `;

    header.appendChild(titleBlock);
    header.appendChild(this._headerSearchSlot);

    // Sub-tabs: primary row (Launch Deck/Favorites/History/Search) + optional site-filter row
    this._subTabContainer = doc.createElement('div');
    this._subTabContainer.className = 'kp-launcher-subtabs';
    this._subTabContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 0;
      border-bottom: 1px solid #333;
      background: #0f0f0f;
    `;

    this._primarySubTabRow = doc.createElement('div');
    this._primarySubTabRow.className = 'kp-launcher-subtabs-primary';
    this._primarySubTabRow.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: stretch;
      padding: 16px 24px 0;
      flex-wrap: wrap;
    `;

    this._siteFilterRow = doc.createElement('div');
    this._siteFilterRow.className = 'kp-launcher-subtabs-sites';
    this._siteFilterRow.style.cssText = `
      display: none;
      flex-wrap: wrap;
      gap: 6px 8px;
      align-items: center;
      padding: 10px 24px 12px;
      border-top: 1px solid #2a2a2a;
    `;

    this._subTabContainer.appendChild(this._primarySubTabRow);
    this._subTabContainer.appendChild(this._siteFilterRow);

    // Sub-tabs + content header + page search for the initial category
    this._updateContentHeader(this._currentCategory);
    this._updateSubTabsUI();
    this._updateHeaderPageSearch(this._currentCategory);

    // Grid container
    this._gridContainer = doc.createElement('div');
    this._gridContainer.className = 'kp-launcher-grid-container';
    this._gridContainer.style.cssText = `
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      overflow-x: hidden;
      min-height: 0;
    `;

    // Footer with keyboard hints, Launch Deck edit controls, and sheet nav
    const footer = doc.createElement('div');
    footer.className = 'kp-launcher-footer';
    footer.style.cssText = `
      padding: 16px 24px;
      border-top: 1px solid #333;
      background: #0f0f0f;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    `;

    const footerLeft = doc.createElement('div');
    footerLeft.className = 'kp-launcher-footer-left';
    footerLeft.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      min-width: 0;
      flex: 1 1 auto;
    `;

    const hint = doc.createElement('div');
    hint.className = 'kp-launcher-footer-hint';
    hint.style.cssText = 'color: #888; font-size: 13px;';
    hint.innerHTML = 'Press <strong>↑↓</strong> for tabs • <strong>/</strong> to search • <strong>F</strong> to open • <strong>Esc</strong> to close';

    this._launchDeckEditBar = doc.createElement('div');
    this._launchDeckEditBar.className = 'kp-launcher-edit-bar';
    this._launchDeckEditBar.style.cssText = `
      display: none;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    `;

    footerLeft.appendChild(hint);
    footerLeft.appendChild(this._launchDeckEditBar);

    const navControls = doc.createElement('div');
    navControls.className = 'kp-launcher-nav-controls';
    navControls.style.cssText = `
      display: flex;
      gap: 12px;
      align-items: center;
      flex-shrink: 0;
    `;

    // Up button
    const upBtn = this._createNavButton('↑', 'C', () => this._scrollUp());
    navControls.appendChild(upBtn);

    // Down button
    const downBtn = this._createNavButton('↓', 'V', () => this._scrollDown());
    navControls.appendChild(downBtn);

    footer.appendChild(footerLeft);
    footer.appendChild(navControls);
    this._updateLaunchDeckEditBar();

    // Assemble content area
    contentArea.appendChild(header);
    contentArea.appendChild(this._subTabContainer);
    contentArea.appendChild(this._gridContainer);
    contentArea.appendChild(footer);

    // Collapsed preview slot — previews open in KeyPilot OS popup; pane stays unused.
    const previewArea = doc.createElement('div');
    previewArea.className = 'kp-launcher-preview-area';
    previewArea.style.cssText = `
      width: 0;
      overflow: hidden;
      flex-shrink: 0;
    `;
    this._previewArea = previewArea;

    // Assemble container
    this._shell.appendChild(sidebar);
    this._shell.appendChild(contentArea);
    this._shell.appendChild(previewArea);

    doc.body.appendChild(this._container);
  }

  /**
   * Count items across a category's configured sub-tabs.
   * Skips the virtual Search tab (derived from other lists).
   * @param {string} categoryKey
   * @returns {number}
   */
  _categoryItemCount(categoryKey) {
    const category = this._categories?.[categoryKey];
    if (!category) return 0;
    const subTabConfig = this._categorySubTabConfig[categoryKey] || ['favorites', 'history', 'search'];
    let total = 0;
    for (const key of subTabConfig) {
      if (key === 'search') continue;
      total += Array.isArray(category[key]) ? category[key].length : 0;
    }
    return total;
  }

  /**
   * Count for a single sub-tab list.
   * @param {string} categoryKey
   * @param {string} subTabType
   * @returns {number}
   */
  _subTabItemCount(categoryKey, subTabType) {
    if (subTabType === 'search') {
      return this._getCategorySearchResults(categoryKey).length;
    }
    const list = this._categories?.[categoryKey]?.[subTabType];
    return Array.isArray(list) ? list.length : 0;
  }

  /**
   * Deduped Sites/Favorites/History matches for the current search query.
   * @param {string} categoryKey
   * @param {string} [query]
   * @returns {Array<{title?: string, url?: string, isDefault?: boolean}>}
   */
  _getCategorySearchResults(categoryKey, query = this._searchQuery) {
    const category = this._categories?.[categoryKey];
    const q = String(query || '').toLowerCase().trim();
    if (!category || !q) return [];

    const sources = ['sites', 'favorites', 'history'];
    const seen = new Set();
    const results = [];
    for (const key of sources) {
      const list = category[key];
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        const url = item?.url || '';
        if (!url || seen.has(url)) continue;
        const title = (item.title || '').toLowerCase();
        if (title.includes(q) || url.toLowerCase().includes(q)) {
          seen.add(url);
          results.push(item);
        }
      }
    }
    return results;
  }

  /**
   * Switch to the Search sub-tab and optionally focus the search field.
   * @param {{ focus?: boolean }} [opts]
   */
  _activateSearchTab(opts = {}) {
    const focus = opts.focus !== false;
    this._categorySubTabs[this._currentCategory] = 'search';
    this._currentSheet = 0;
    this._updateSiteFilterTabsUI();
    this._updateSubTabStyles();
    this._renderCategory(this._currentCategory);
    this._updateTabCounts();
    this._persistNavState();
    if (focus && this._searchInput) {
      try { this._searchInput.focus(); } catch { /* ignore */ }
    }
  }

  /**
   * Create a right-aligned count badge for tab labels.
   * @param {Document} doc
   * @param {number} count
   * @param {{ muted?: boolean }} [opts]
   */
  _createCountBadge(doc, count, opts = {}) {
    const badge = doc.createElement('span');
    badge.className = 'kp-launcher-tab-count';
    badge.textContent = String(count);
    badge.style.cssText = `
      margin-left: auto;
      flex-shrink: 0;
      font-size: 12px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: ${opts.muted ? '#666' : '#888'};
      min-width: 1.25em;
      text-align: right;
    `;
    return badge;
  }

  /**
   * Create a tab button
   */
  _createTab(categoryKey, category) {
    const doc = document;
    const tab = doc.createElement('button');
    tab.className = 'kp-launcher-tab';
    tab.dataset.category = categoryKey;

    const isActive = categoryKey === this._currentCategory;
    tab.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      margin: 4px 8px;
      background: ${isActive ? '#2a2a2a' : 'transparent'};
      border: 1px solid ${isActive ? '#444' : 'transparent'};
      border-radius: 8px;
      color: ${isActive ? '#fff' : '#888'};
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
      width: calc(100% - 16px);
      box-sizing: border-box;
    `;

    const icon = this._createTabIcon(doc, categoryKey);

    const label = doc.createElement('span');
    label.className = 'kp-launcher-tab-label';
    label.textContent = category.label;
    label.style.cssText = `
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    const count = this._createCountBadge(doc, this._categoryItemCount(categoryKey));
    count.dataset.role = 'count';

    tab.appendChild(icon);
    tab.appendChild(label);
    tab.appendChild(count);

    tab.addEventListener('click', () => {
      this._selectCategory(categoryKey);
    });

    tab.addEventListener('mouseenter', () => {
      if (categoryKey !== this._currentCategory) {
        tab.style.background = '#1f1f1f';
        tab.style.borderColor = '#333';
      }
    });

    tab.addEventListener('mouseleave', () => {
      if (categoryKey !== this._currentCategory) {
        tab.style.background = 'transparent';
        tab.style.borderColor = 'transparent';
      }
    });

    return tab;
  }

  /**
   * Outline SVG for a left-rail category tab.
   * @param {Document} doc
   * @param {string} categoryKey
   * @returns {SVGElement}
   */
  _createTabIcon(doc, categoryKey) {
    const paths = LAUNCHER_TAB_ICONS[categoryKey] || LAUNCHER_TAB_ICONS.searches;
    const svg = createOutlineIcon(doc, paths);
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.classList.add('kp-launcher-tab-icon');
    svg.style.cssText = 'flex-shrink: 0; display: block; color: inherit;';
    return svg;
  }

  /**
   * Switch the primary category tab and remember it for the next open.
   * @param {string} categoryKey
   */
  _selectCategory(categoryKey) {
    if (!categoryKey || !this._categories?.[categoryKey]) return;
    this._currentCategory = categoryKey;
    this._currentSheet = 0;
    this._ensureValidSubTab(categoryKey);
    this._updateContentHeader(categoryKey);
    this._updateSubTabsUI();
    this._updateHeaderPageSearch(categoryKey);
    this._renderCategory(categoryKey);
    this._updateTabStyles();
    this._updateSubTabStyles();
    this._persistNavState();
    void this._ensureCategoryHistory(categoryKey);
  }

  /**
   * Create a sub-tab button for sites/favorites/history
   */
  _createSubTab(type, label) {
    const doc = document;
    const subTab = doc.createElement('button');
    subTab.className = 'kp-launcher-subtab';
    subTab.dataset.type = type;

    const currentSubTab = this._categorySubTabs[this._currentCategory] || 'history';
    const isActive = type === currentSubTab;
    const count = this._subTabItemCount(this._currentCategory, type);
    subTab.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 20px;
      background: ${isActive ? '#2a2a2a' : 'transparent'};
      border: none;
      border-bottom: 2px solid ${isActive ? '#4CAF50' : 'transparent'};
      color: ${isActive ? '#fff' : '#888'};
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 120px;
    `;

    const labelEl = doc.createElement('span');
    labelEl.className = 'kp-launcher-subtab-label';
    labelEl.textContent = label;
    labelEl.style.cssText = 'flex: 1; text-align: left;';

    const countEl = this._createCountBadge(doc, count, { muted: !isActive });
    countEl.dataset.role = 'count';

    subTab.appendChild(labelEl);
    subTab.appendChild(countEl);

    subTab.addEventListener('click', () => {
      this._categorySubTabs[this._currentCategory] = type;
      this._currentSheet = 0;
      if (type !== 'sites' && this._launchDeckEditMode) {
        this._launchDeckEditMode = false;
        this._closeAddSitePicker();
      }
      if (type === 'favorites' || type === 'history') {
        this._ensureValidSiteFilter(this._currentCategory);
      }
      this._updateSiteFilterTabsUI();
      this._updateLaunchDeckEditBar();
      this._renderCategory(this._currentCategory);
      this._updateSubTabStyles();
      this._persistNavState();
    });

    subTab.addEventListener('mouseenter', () => {
      const active = this._categorySubTabs[this._currentCategory] || 'history';
      if (type !== active) {
        subTab.style.color = '#fff';
      }
    });

    subTab.addEventListener('mouseleave', () => {
      const active = this._categorySubTabs[this._currentCategory] || 'history';
      if (type !== active) {
        subTab.style.color = '#888';
      }
    });

    return subTab;
  }

  /**
   * Update sub-tab styles to reflect active sub-tab
   */
  _updateSubTabStyles() {
    if (!this._subTabContainer) return;
    const subTabs = this._subTabContainer.querySelectorAll('.kp-launcher-subtab');
    const currentSubTab = this._categorySubTabs[this._currentCategory] || 'favorites';
    subTabs.forEach((subTab) => {
      const isActive = subTab.dataset.type === currentSubTab;
      subTab.style.background = isActive ? '#2a2a2a' : 'transparent';
      subTab.style.borderBottomColor = isActive ? '#4CAF50' : 'transparent';
      if (subTab.dataset.type !== 'search') {
        subTab.style.color = isActive ? '#fff' : '#888';
      } else {
        subTab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        const input = subTab.querySelector('.kp-launcher-search-input');
        if (input) {
          input.style.borderColor = isActive ? '#666' : '#444';
          input.style.background = isActive ? '#333' : '#2a2a2a';
        }
      }
      const countEl = subTab.querySelector('[data-role="count"]');
      if (countEl) {
        countEl.style.color = isActive ? '#888' : '#666';
      }
    });
  }

  /**
   * Refresh count badges on sidebar tabs and current sub-tabs.
   */
  _updateTabCounts() {
    if (this._tabListContainer) {
      const tabs = this._tabListContainer.querySelectorAll('.kp-launcher-tab');
      tabs.forEach((tab) => {
        const key = tab.dataset.category;
        const countEl = tab.querySelector('[data-role="count"]');
        if (countEl && key) {
          countEl.textContent = String(this._categoryItemCount(key));
        }
      });
    }
    if (this._subTabContainer) {
      const subTabs = this._subTabContainer.querySelectorAll('.kp-launcher-subtab');
      subTabs.forEach((subTab) => {
        const type = subTab.dataset.type;
        const countEl = subTab.querySelector('[data-role="count"]');
        if (countEl && type) {
          countEl.textContent = String(this._subTabItemCount(this._currentCategory, type));
        }
      });
    }
  }

  /**
   * Update sub-tabs UI based on current category configuration
   */
  _updateSubTabsUI() {
    if (!this._subTabContainer) return;
    const primaryRow = this._primarySubTabRow || this._subTabContainer;

    const hadSearchFocus =
      !!this._searchInput && document.activeElement === this._searchInput;
    const searchCaret = hadSearchFocus
      ? (this._searchInput.selectionStart ?? this._searchInput.value.length)
      : null;

    // Clear existing primary sub-tabs
    primaryRow.innerHTML = '';
    this._searchInput = null;
    this._clearBtn = null;

    // Get sub-tab configuration for current category
    const subTabConfig = this._categorySubTabConfig[this._currentCategory] || ['favorites', 'history', 'search'];

    // Create sub-tabs based on configuration
    const subTabLabels = {
      sites: 'Launch Deck',
      favorites: this._currentCategory === 'launchDeck' ? 'Toolbar Bookmarks' : 'Favorites',
      history: this._currentCategory === 'launchDeck' ? 'Top Visited' : 'History',
      search: 'Search'
    };

    subTabConfig.forEach((subTabType) => {
      if (subTabType === 'search') {
        primaryRow.appendChild(this._createSearchSubTab());
        return;
      }
      const label = subTabLabels[subTabType] || subTabType;
      const subTab = this._createSubTab(subTabType, label);
      primaryRow.appendChild(subTab);
    });

    this._ensureValidSiteFilter(this._currentCategory);
    this._updateSiteFilterTabsUI();
    this._updateLaunchDeckEditBar();

    if (hadSearchFocus && this._searchInput) {
      try {
        this._searchInput.focus();
        const pos = searchCaret ?? this._searchInput.value.length;
        this._searchInput.setSelectionRange(pos, pos);
      } catch { /* ignore */ }
    }
  }

  /**
   * Edit / Done / Add controls in the footer (next to the keyboard hint).
   */
  _updateLaunchDeckEditBar() {
    const bar = this._launchDeckEditBar;
    if (!bar) return;

    const onSites =
      (this._categorySubTabs[this._currentCategory] || 'history') === 'sites';
    const canEdit =
      this._isCatalogCategory() && this._showDefaultSites && onSites;

    if (!canEdit) {
      if (this._launchDeckEditMode) this._launchDeckEditMode = false;
      this._closeAddSitePicker();
      bar.style.display = 'none';
      bar.innerHTML = '';
      return;
    }

    const doc = document;
    bar.style.display = 'inline-flex';
    bar.innerHTML = '';

    const editing = !!this._launchDeckEditMode;

    const toggleBtn = doc.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.textContent = editing ? 'Done' : 'Edit Launch Deck';
    toggleBtn.style.cssText = `
      padding: 5px 10px;
      border-radius: 6px;
      border: 1px solid ${editing ? '#5a9e6f' : '#444'};
      background: ${editing ? '#1e3a28' : '#1a1a1a'};
      color: ${editing ? '#9fd4ae' : '#ccc'};
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    `;
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._setLaunchDeckEditMode(!this._launchDeckEditMode);
    });
    bar.appendChild(toggleBtn);

    if (!editing) return;

    const editHint = doc.createElement('span');
    editHint.textContent = 'Reorder, remove, or add • Esc exits edit';
    editHint.style.cssText = 'color: #777; font-size: 12px; white-space: nowrap;';
    bar.appendChild(editHint);

    const addBtn = doc.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Add site…';
    addBtn.style.cssText = `
      padding: 5px 10px;
      border-radius: 6px;
      border: 1px solid #444;
      background: #1a1a1a;
      color: #ccc;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    `;
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._openAddSitePicker();
    });
    bar.appendChild(addBtn);
  }

  /**
   * Filterable catalog picker + custom URL field.
   */
  _openAddSitePicker() {
    this._closeAddSitePicker();
    if (!this._isCatalogCategory() || !this._launchDeckEditMode) return;

    const doc = document;
    const categoryKey = this._currentCategory;
    const currentDeck = this._categories?.[categoryKey]?.sites || [];
    const addable = getAddableCatalogSites(categoryKey, currentDeck);

    const overlay = doc.createElement('div');
    overlay.className = 'kp-launcher-add-picker';
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 40;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 48px 24px;
    `;

    const panel = doc.createElement('div');
    panel.style.cssText = `
      width: min(480px, 100%);
      max-height: min(70vh, 560px);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #1a1a1a;
      border: 1px solid #444;
      border-radius: 10px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
    `;

    const header = doc.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      border-bottom: 1px solid #333;
    `;
    const title = doc.createElement('div');
    title.textContent = 'Add to Launch Deck';
    title.style.cssText = 'flex: 1; color: #fff; font-weight: 600; font-size: 14px;';
    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      border: none; background: transparent; color: #888; cursor: pointer; font-size: 16px;
    `;
    closeBtn.addEventListener('click', () => this._closeAddSitePicker());
    header.appendChild(title);
    header.appendChild(closeBtn);

    const filter = doc.createElement('input');
    filter.type = 'text';
    filter.placeholder = 'Filter catalog…';
    filter.style.cssText = `
      margin: 10px 14px 0;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid #444;
      background: #111;
      color: #eee;
      font-size: 13px;
    `;

    const list = doc.createElement('div');
    list.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-height: 120px;
    `;

    const renderList = (q = '') => {
      list.innerHTML = '';
      const needle = String(q || '').toLowerCase().trim();
      const rows = addable.filter((s) => {
        if (!needle) return true;
        return (
          s.title.toLowerCase().includes(needle) ||
          s.url.toLowerCase().includes(needle)
        );
      });
      if (!rows.length) {
        const empty = doc.createElement('div');
        empty.textContent = needle ? 'No matching sites' : 'All catalog sites are already on your deck';
        empty.style.cssText = 'color: #666; font-size: 13px; padding: 16px 8px;';
        list.appendChild(empty);
        return;
      }
      for (const site of rows) {
        const row = doc.createElement('button');
        row.type = 'button';
        row.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          padding: 8px 10px;
          border: 1px solid #333;
          border-radius: 6px;
          background: #222;
          color: #eee;
          cursor: pointer;
          text-align: left;
        `;
        const t = doc.createElement('div');
        t.textContent = site.title;
        t.style.cssText = 'font-size: 13px; font-weight: 600;';
        const u = doc.createElement('div');
        u.textContent = site.url;
        u.style.cssText = 'font-size: 11px; color: #888;';
        row.appendChild(t);
        row.appendChild(u);
        row.addEventListener('click', () => {
          void this._addLaunchDeckSite({
            title: site.title,
            url: site.url,
            fromCatalog: true
          });
        });
        list.appendChild(row);
      }
    };

    filter.addEventListener('input', () => renderList(filter.value));

    const customRow = doc.createElement('div');
    customRow.style.cssText = `
      display: flex;
      gap: 8px;
      padding: 10px 14px 14px;
      border-top: 1px solid #333;
    `;
    const customInput = doc.createElement('input');
    customInput.type = 'url';
    customInput.placeholder = 'https://example.com';
    customInput.style.cssText = `
      flex: 1;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid #444;
      background: #111;
      color: #eee;
      font-size: 13px;
    `;
    const customBtn = doc.createElement('button');
    customBtn.type = 'button';
    customBtn.textContent = 'Add URL';
    customBtn.style.cssText = `
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #5a9e6f;
      background: #1e3a28;
      color: #9fd4ae;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    `;
    const submitCustom = () => {
      let raw = String(customInput.value || '').trim();
      if (!raw) return;
      if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
      try {
        const u = new URL(raw);
        void this._addLaunchDeckSite({
          title: u.hostname.replace(/^www\./, ''),
          url: u.href,
          fromCatalog: false
        });
      } catch {
        customInput.style.borderColor = '#c44';
      }
    };
    customBtn.addEventListener('click', submitCustom);
    customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitCustom();
      }
    });
    customRow.appendChild(customInput);
    customRow.appendChild(customBtn);

    panel.appendChild(header);
    panel.appendChild(filter);
    panel.appendChild(list);
    panel.appendChild(customRow);
    overlay.appendChild(panel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._closeAddSitePicker();
    });

    const host = this._shell || this._container || doc.body;
    host.appendChild(overlay);
    this._addSitePicker = overlay;
    renderList();
    try { filter.focus(); } catch { /* ignore */ }
  }

  /**
   * Second-row site filters under Favorites / History.
   * Favorites: only Sites with ≥1 bookmark. History: only Sites with ≥1 visit.
   * Never renders a 0-count site pill.
   */
  _updateSiteFilterTabsUI() {
    if (!this._siteFilterRow) return;

    const categoryKey = this._currentCategory;
    const primary = this._categorySubTabs[categoryKey] || 'history';
    const showFilters = primary === 'favorites' || primary === 'history';
    const allSites = this._defaultSites[categoryKey] || [];
    const sitesWithItems = showFilters
      ? this._getSitesWithPrimaryItems(categoryKey, primary)
      : [];

    this._siteFilterRow.innerHTML = '';

    if (!showFilters || !sitesWithItems.length) {
      this._siteFilterRow.style.display = 'none';
      return;
    }

    this._ensureValidSiteFilter(categoryKey);
    const activeSiteUrl = this._categorySiteFilters[categoryKey];
    this._siteFilterRow.style.display = 'flex';
    const primaryItems = this._categories?.[categoryKey]?.[primary] || [];

    for (const site of sitesWithItems) {
      const count = primaryItems.filter((item) =>
        this._itemMatchesSite(item?.url, site, allSites)
      ).length;
      if (count <= 0) continue;

      const isActive = site.url === activeSiteUrl;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kp-launcher-site-filter-tab';
      btn.dataset.siteUrl = site.url;
      btn.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: ${isActive ? '#2a2a2a' : 'transparent'};
        border: 1px solid ${isActive ? '#555' : '#333'};
        border-radius: 999px;
        color: ${isActive ? '#fff' : '#888'};
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        max-width: 100%;
      `;

      const labelEl = document.createElement('span');
      labelEl.textContent = site.title;
      labelEl.style.cssText = `
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;

      const countEl = this._createCountBadge(document, count, { muted: !isActive });
      countEl.dataset.role = 'site-count';

      btn.appendChild(labelEl);
      btn.appendChild(countEl);

      btn.addEventListener('click', () => {
        this._categorySiteFilters[categoryKey] = site.url;
        this._currentSheet = 0;
        this._updateSiteFilterTabsUI();
        this._renderCategory(categoryKey);
      });

      btn.addEventListener('mouseenter', () => {
        if (site.url !== this._categorySiteFilters[categoryKey]) {
          btn.style.color = '#fff';
          btn.style.borderColor = '#444';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (site.url !== this._categorySiteFilters[categoryKey]) {
          btn.style.color = '#888';
          btn.style.borderColor = '#333';
        }
      });

      this._siteFilterRow.appendChild(btn);
    }
  }

  /**
   * Search sites tab — lives in the sub-tab bar after History.
   * Typing here activates the Search tab and shows matches in the grid.
   * @returns {HTMLElement}
   */
  _createSearchSubTab() {
    const doc = document;
    const currentSubTab = this._categorySubTabs[this._currentCategory] || 'history';
    const isActive = currentSubTab === 'search';
    const count = this._subTabItemCount(this._currentCategory, 'search');

    const subTab = doc.createElement('div');
    subTab.className = 'kp-launcher-subtab kp-launcher-search-subtab';
    subTab.dataset.type = 'search';
    subTab.setAttribute('role', 'tab');
    subTab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    subTab.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px 8px;
      margin-left: auto;
      background: ${isActive ? '#2a2a2a' : 'transparent'};
      border: none;
      border-bottom: 2px solid ${isActive ? '#4CAF50' : 'transparent'};
      color: ${isActive ? '#fff' : '#888'};
      font-size: 14px;
      font-weight: 500;
      min-width: 220px;
      max-width: 320px;
      flex: 1 1 240px;
      box-sizing: border-box;
      cursor: text;
      transition: all 0.2s;
    `;

    const fieldWrap = doc.createElement('div');
    fieldWrap.className = 'kp-launcher-search-container';
    fieldWrap.style.cssText = `
      position: relative;
      flex: 1;
      min-width: 0;
    `;

    const input = doc.createElement('input');
    input.type = 'search';
    input.placeholder = 'Filter results...';
    input.className = 'kp-launcher-search-input';
    input.setAttribute('aria-label', 'Filter results');
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = this._searchQuery || '';
    input.style.cssText = `
      width: 100%;
      padding: 6px 28px 6px 10px;
      background: ${isActive ? '#333' : '#2a2a2a'};
      border: 1px solid ${isActive ? '#666' : '#444'};
      border-radius: 6px;
      color: #fff;
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
      transition: all 0.2s;
    `;

    const clearBtn = doc.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = '×';
    clearBtn.className = 'kp-launcher-search-clear';
    clearBtn.setAttribute('aria-label', 'Clear search');
    clearBtn.style.cssText = `
      position: absolute;
      right: 4px;
      top: 50%;
      transform: translateY(-50%);
      margin: 0;
      appearance: none;
      -webkit-appearance: none;
      background: transparent;
      border: none;
      box-shadow: none;
      color: #888;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      padding: 2px 6px;
      display: ${this._searchQuery.trim() ? 'block' : 'none'};
      transition: color 0.2s;
    `;

    const countEl = this._createCountBadge(doc, count, { muted: !isActive });
    countEl.dataset.role = 'count';

    const applyQuery = (raw) => {
      this._searchQuery = String(raw || '');
      this._currentSheet = 0;
      const hasQuery = !!this._searchQuery.trim();
      clearBtn.style.display = hasQuery ? 'block' : 'none';
      if (this._categorySubTabs[this._currentCategory] !== 'search') {
        this._categorySubTabs[this._currentCategory] = 'search';
        this._persistNavState();
      }
      this._updateSubTabStyles();
      this._renderCategory(this._currentCategory);
      this._updateTabCounts();
    };

    input.addEventListener('input', (e) => {
      applyQuery(e.target.value);
    });

    input.addEventListener('focus', () => {
      input.style.borderColor = '#666';
      input.style.background = '#333';
      if (this._categorySubTabs[this._currentCategory] !== 'search') {
        this._categorySubTabs[this._currentCategory] = 'search';
        this._currentSheet = 0;
        this._updateSubTabStyles();
        this._renderCategory(this._currentCategory);
        this._updateTabCounts();
        this._persistNavState();
      }
    });

    input.addEventListener('blur', () => {
      const active = this._categorySubTabs[this._currentCategory] === 'search';
      input.style.borderColor = active ? '#666' : '#444';
      input.style.background = active ? '#333' : '#2a2a2a';
    });

    // Escape must close while typing (typing context often swallows global shortcuts).
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        try { e.stopImmediatePropagation(); } catch { /* ignore */ }
        this.hide();
      }
    });

    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.value = '';
      applyQuery('');
      try { input.focus(); } catch { /* ignore */ }
    });

    clearBtn.addEventListener('mouseenter', () => {
      clearBtn.style.color = '#fff';
    });
    clearBtn.addEventListener('mouseleave', () => {
      clearBtn.style.color = '#888';
    });

    subTab.addEventListener('click', (e) => {
      if (e.target === clearBtn || clearBtn.contains(e.target)) return;
      this._activateSearchTab({ focus: true });
    });

    fieldWrap.appendChild(input);
    fieldWrap.appendChild(clearBtn);
    subTab.appendChild(fieldWrap);
    subTab.appendChild(countEl);

    this._searchInput = input;
    this._clearBtn = clearBtn;
    return subTab;
  }

  /**
   * Create navigation button (up/down)
   */
  _createNavButton(arrow, keyLabel, onClick) {
    const doc = document;
    const btn = doc.createElement('button');
    btn.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 6px;
      color: #fff;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    `;

    const arrowSpan = doc.createElement('span');
    arrowSpan.textContent = arrow;
    arrowSpan.style.fontSize = '16px';

    const keySpan = doc.createElement('kbd');
    keySpan.textContent = keyLabel;
    keySpan.style.cssText = `
      padding: 2px 6px;
      background: #1a1a1a;
      border: 1px solid #555;
      border-radius: 3px;
      font-size: 12px;
      font-family: monospace;
    `;

    btn.appendChild(arrowSpan);
    btn.appendChild(keySpan);

    btn.addEventListener('click', onClick);
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#333';
      btn.style.borderColor = '#555';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#2a2a2a';
      btn.style.borderColor = '#444';
    });

    return btn;
  }

  /**
   * Update tab styles to reflect active category
   */
  _updateTabStyles() {
    const tabs = this._tabListContainer.querySelectorAll('.kp-launcher-tab');
    tabs.forEach(tab => {
      const isActive = tab.dataset.category === this._currentCategory;
      tab.style.background = isActive ? '#2a2a2a' : 'transparent';
      tab.style.borderColor = isActive ? '#444' : 'transparent';
      tab.style.color = isActive ? '#fff' : '#888';
    });
  }

  /**
   * Render a category's page template + card grid.
   * Header page search is managed separately via `_updateHeaderPageSearch`.
   */
  _renderCategory(categoryKey) {
    if (!this._categories || !this._categories[categoryKey]) return;

    this._gridContainer.innerHTML = '';

    const currentSubTab = this._categorySubTabs[categoryKey] || 'history';
    const items = this._getActiveSubTabItems(categoryKey);

    const page = document.createElement('div');
    page.className = 'kp-launcher-page';
    page.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 100%;
    `;

    // Optional category template blocks above the card grid
    const template = this._categoryPageTemplates[categoryKey];
    if (template?.renderBeforeCards) {
      try {
        const before = template.renderBeforeCards(document);
        if (before) page.appendChild(before);
      } catch (err) {
        console.warn('[LauncherPopover] Category page template failed:', categoryKey, err);
      }
    }

    // Calculate sheet range
    const startIdx = this._currentSheet * this._itemsPerSheet;
    const endIdx = startIdx + this._itemsPerSheet;
    const sheetItems = items.slice(startIdx, endIdx);

    // Create grid
    const grid = document.createElement('div');
    grid.className = 'kp-launcher-grid';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
      align-content: start;
      flex: 1;
    `;

    // Launch Deck cards use a distinct tile style vs Favorites / History listings.
    const cardVariant = currentSubTab === 'sites' ? 'launch' : 'listing';
    sheetItems.forEach((item) => {
      const card = this._createGridCard(item, {
        variant: cardVariant,
        showAddedOn: currentSubTab === 'favorites'
      });
      grid.appendChild(card);
    });

    // Show empty state if no items
    if (sheetItems.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `
        grid-column: 1 / -1;
        text-align: center;
        padding: 40px;
        color: #666;
        font-size: 14px;
      `;
      if (currentSubTab === 'search') {
        empty.textContent = this._searchQuery.trim()
          ? 'No sites match your search'
          : 'Type to search sites in this category';
      } else if (categoryKey === 'launchDeck' && currentSubTab === 'favorites') {
        empty.textContent = 'No toolbar bookmarks';
      } else if (categoryKey === 'launchDeck' && currentSubTab === 'history') {
        empty.textContent = 'No top visited sites';
      } else {
        empty.textContent = 'No items in this category';
      }
      grid.appendChild(empty);
    }

    page.appendChild(grid);
    this._gridContainer.appendChild(page);

    try { this._updateTabCounts?.(); } catch { /* ignore */ }
  }

  /**
   * Update the content-area header to the active category name + description.
   * @param {string} [categoryKey]
   */
  _updateContentHeader(categoryKey = this._currentCategory) {
    const category = this._categories?.[categoryKey];
    if (this._headerTitle) {
      this._headerTitle.textContent = category?.label || categoryKey || 'Launcher';
    }
    if (this._headerDescription) {
      this._headerDescription.textContent =
        category?.description || 'Quick access to sites in this category';
    }
  }

  /**
   * Fill/clear the header page-search slot for the active category template.
   * Convention: categories may expose `renderHeaderSearch` to place a search
   * box to the right of the active tab title/description.
   * @param {string} [categoryKey]
   */
  _updateHeaderPageSearch(categoryKey = this._currentCategory) {
    if (!this._headerSearchSlot) return;

    const template = this._categoryPageTemplates[categoryKey];
    const render = template?.renderHeaderSearch;
    const mountedKey = this._headerSearchSlot.dataset.categoryKey || '';

    if (typeof render !== 'function') {
      this._headerSearchSlot.innerHTML = '';
      delete this._headerSearchSlot.dataset.categoryKey;
      this._headerSearchSlot.style.display = 'none';
      this._categorySearchInput = null;
      return;
    }

    // Keep the existing control when staying on the same category (preserve focus/draft).
    if (mountedKey === categoryKey && this._headerSearchSlot.firstChild) {
      this._headerSearchSlot.style.display = 'flex';
      return;
    }

    const hadFocus =
      !!this._categorySearchInput && document.activeElement === this._categorySearchInput;
    const caret = hadFocus
      ? (this._categorySearchInput.selectionStart ?? this._categorySearchInput.value.length)
      : null;

    this._headerSearchSlot.innerHTML = '';
    this._categorySearchInput = null;

    try {
      const el = render(document);
      if (el) {
        this._headerSearchSlot.appendChild(el);
        this._headerSearchSlot.dataset.categoryKey = categoryKey;
        this._headerSearchSlot.style.display = 'flex';
      } else {
        delete this._headerSearchSlot.dataset.categoryKey;
        this._headerSearchSlot.style.display = 'none';
      }
    } catch (err) {
      console.warn('[LauncherPopover] Header page search failed:', categoryKey, err);
      delete this._headerSearchSlot.dataset.categoryKey;
      this._headerSearchSlot.style.display = 'none';
    }

    if (hadFocus && this._categorySearchInput) {
      try {
        this._categorySearchInput.focus();
        const pos = caret ?? this._categorySearchInput.value.length;
        this._categorySearchInput.setSelectionRange(pos, pos);
      } catch { /* ignore */ }
    }
  }

  /**
   * Open category header-search results in the KeyPilot OS preview popup.
   * @param {string} categoryKey
   * @param {string} url
   * @param {string} [title]
   */
  _showCategoryPageResults(categoryKey, url, title = 'Search results') {
    if (!categoryKey || !url) return;
    void this._openPreviewWindow(url);
  }

  /**
   * Build search URL from a Sites listing that carries `searchUrlPrefix`.
   * @param {{ searchUrlPrefix?: string, title?: string, url?: string }} site
   * @param {string} query
   * @returns {string|null}
   */
  _buildSiteSearchUrl(site, query) {
    const q = String(query || '').trim();
    const prefix = site?.searchUrlPrefix;
    if (!q || !prefix) return null;
    return `${prefix}${encodeURIComponent(q)}`;
  }

  /**
   * Video Sites that expose a search URL prefix.
   * @returns {Array<{title: string, url: string, searchUrlPrefix: string, isDefault?: boolean}>}
   */
  _getVideoSearchSites() {
    return (this._defaultSites.videos || []).filter((s) => !!s.searchUrlPrefix);
  }

  /**
   * Shared chrome for header page-search bars (Archive, Videos, …).
   * @param {Document} doc
   * @param {{
   *   className: string,
   *   label: string,
   *   inputId: string,
   *   placeholder: string,
   *   ariaLabel: string,
   *   draftKey: string,
   *   leadingControl?: HTMLElement|null,
   *   maxWidth?: string,
   *   buildUrl: (query: string) => (string|null),
   *   resultsTitle: (query: string) => string
   * }} opts
   * @returns {HTMLElement}
   */
  _createHeaderPageSearchBar(doc, opts) {
    const {
      className,
      label: labelText,
      inputId,
      placeholder,
      ariaLabel,
      draftKey,
      leadingControl = null,
      maxWidth = '420px',
      buildUrl,
      resultsTitle
    } = opts;

    const wrap = doc.createElement('div');
    wrap.className = `kp-launcher-page-header-search ${className || ''}`.trim();
    wrap.style.cssText = `
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      width: 100%;
      max-width: ${maxWidth};
    `;

    const label = doc.createElement('label');
    label.textContent = labelText;
    label.htmlFor = inputId;
    label.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
    `;

    const row = doc.createElement('div');
    row.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: stretch;
      width: 100%;
    `;

    if (leadingControl) {
      row.appendChild(leadingControl);
    }

    const input = doc.createElement('input');
    input.type = 'search';
    input.id = inputId;
    input.className = 'kp-launcher-page-search-input';
    input.placeholder = placeholder;
    input.setAttribute('aria-label', ariaLabel);
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = this._headerSearchDrafts[draftKey] || '';
    input.style.cssText = `
      flex: 1;
      min-width: 0;
      padding: 4px 10px;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 6px;
      color: #fff;
      font-size: 12px;
      outline: none;
      box-sizing: border-box;
    `;

    const submitBtn = doc.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'kp-launcher-page-search-submit';
    submitBtn.textContent = 'Search';
    submitBtn.style.cssText = `
      padding: 4px 10px;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 6px;
      color: #fff;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, border-color 0.15s;
    `;

    const submit = () => {
      const q = (input.value || '').trim();
      this._headerSearchDrafts[draftKey] = input.value || '';
      if (!q) {
        input.focus();
        return;
      }
      const url = buildUrl(q);
      if (!url) {
        input.focus();
        return;
      }
      this._showCategoryPageResults(draftKey, url, resultsTitle(q));
    };

    input.addEventListener('input', () => {
      this._headerSearchDrafts[draftKey] = input.value;
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        submit();
        return;
      }
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        try { e.stopImmediatePropagation(); } catch { /* ignore */ }
        this.hide();
      }
    });

    input.addEventListener('focus', () => {
      input.style.borderColor = '#666';
      input.style.background = '#333';
    });
    input.addEventListener('blur', () => {
      input.style.borderColor = '#444';
      input.style.background = '#2a2a2a';
    });

    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      submit();
    });
    submitBtn.addEventListener('mouseenter', () => {
      submitBtn.style.background = '#333';
      submitBtn.style.borderColor = '#555';
    });
    submitBtn.addEventListener('mouseleave', () => {
      submitBtn.style.background = '#2a2a2a';
      submitBtn.style.borderColor = '#444';
    });

    row.appendChild(input);
    row.appendChild(submitBtn);
    wrap.appendChild(label);
    wrap.appendChild(row);

    this._categorySearchInput = input;
    return wrap;
  }

  /**
   * Internet Archive header search — same destination as archive.org's main library
   * search ("Search the Archive"): /search?query=…
   * @param {Document} doc
   * @returns {HTMLElement}
   */
  _createArchiveSearchBar(doc) {
    return this._createHeaderPageSearchBar(doc, {
      className: 'kp-launcher-archive-search',
      label: 'Search the Archive',
      inputId: 'kp-launcher-archive-search-input',
      placeholder: 'Texts, movies, software, music, websites…',
      ariaLabel: 'Search the Internet Archive',
      draftKey: 'archive',
      maxWidth: '420px',
      buildUrl: (q) => `https://archive.org/search?query=${encodeURIComponent(q)}`,
      resultsTitle: (q) => `Archive · ${q}`
    });
  }

  /**
   * Videos header search with a Sites dropdown (uses each site's searchUrlPrefix).
   * @param {Document} doc
   * @returns {HTMLElement}
   */
  _createVideosSearchBar(doc) {
    const sites = this._getVideoSearchSites();
    if (!sites.length) return null;

    const selected =
      sites.find((s) => s.url === this._videosSearchSiteUrl) || sites[0];
    this._videosSearchSiteUrl = selected.url;

    const select = doc.createElement('select');
    select.className = 'kp-launcher-videos-search-site';
    select.setAttribute('aria-label', 'Video site to search');
    select.style.cssText = `
      flex: 0 0 auto;
      max-width: 140px;
      padding: 10px 8px;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 8px;
      color: #fff;
      font-size: 13px;
      outline: none;
      cursor: pointer;
      box-sizing: border-box;
    `;

    for (const site of sites) {
      const opt = doc.createElement('option');
      opt.value = site.url;
      opt.textContent = site.title;
      if (site.url === this._videosSearchSiteUrl) opt.selected = true;
      select.appendChild(opt);
    }

    select.addEventListener('change', () => {
      this._videosSearchSiteUrl = select.value;
    });
    select.addEventListener('focus', () => {
      select.style.borderColor = '#666';
      select.style.background = '#333';
    });
    select.addEventListener('blur', () => {
      select.style.borderColor = '#444';
      select.style.background = '#2a2a2a';
    });

    return this._createHeaderPageSearchBar(doc, {
      className: 'kp-launcher-videos-search',
      label: 'Search Videos',
      inputId: 'kp-launcher-videos-search-input',
      placeholder: 'Search videos…',
      ariaLabel: 'Search videos',
      draftKey: 'videos',
      leadingControl: select,
      maxWidth: '560px',
      buildUrl: (q) => {
        const site =
          this._getVideoSearchSites().find((s) => s.url === this._videosSearchSiteUrl) ||
          this._getVideoSearchSites()[0];
        return this._buildSiteSearchUrl(site, q);
      },
      resultsTitle: (q) => {
        const site =
          this._getVideoSearchSites().find((s) => s.url === this._videosSearchSiteUrl) ||
          this._getVideoSearchSites()[0];
        return `${site?.title || 'Videos'} · ${q}`;
      }
    });
  }

  /**
   * Create a grid card for a website
   */
  /**
   * @param {{ title?: string, url?: string, isDefault?: boolean, dateAdded?: number }} item
   * @param {{ variant?: 'launch' | 'listing', showAddedOn?: boolean }} [opts]
   */
  _createGridCard(item, opts = {}) {
    const isLaunch = opts.variant === 'launch';
    return isLaunch
      ? this._createLaunchDeckCard(item)
      : this._createListingCard(item, { showAddedOn: !!opts.showAddedOn });
  }

  /**
   * Launch Deck tiles — destination launchers, not history/bookmark listings.
   * @param {{ title?: string, url?: string, lastVisitTime?: number }} item
   */
  _createLaunchDeckCard(item) {
    const doc = document;
    const domain = extractDomain(item.url) || String(item.url || '');
    const visitedLabel = this._formatCardDate(item.lastVisitTime);

    const container = doc.createElement('div');
    container.className = 'kp-launcher-card-container kp-launcher-launch-card';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      background: linear-gradient(165deg, #2c3238 0%, #1a1e22 100%);
      border: 1px solid #3d4a55;
      border-radius: 12px;
      overflow: hidden;
      min-height: 148px;
      transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
      position: relative;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    `;

    const accent = doc.createElement('div');
    accent.setAttribute('aria-hidden', 'true');
    accent.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #5a9e6f 0%, #3d7a52 55%, transparent 100%);
      z-index: 2;
      pointer-events: none;
    `;

    applyCardBackground(container, item.url, {
      fallbackSolid: '#1a1e22',
      hoverSolid: '#242a30',
      manageHover: true,
      videoPrefer: true,
      youtubePrefer: true,
      lazy: true,
      lazyRoot: this._gridContainer,
      lazyRootMargin: '100% 100% 100% 100%',
      priority: 1
    });

    const mainLink = doc.createElement('a');
    mainLink.href = item.url;
    mainLink.target = '_blank';
    mainLink.rel = 'noopener noreferrer';
    mainLink.className = 'kp-launcher-card-main';
    mainLink.style.cssText = `
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 28px 20px ${visitedLabel ? '36px' : '18px'};
      text-decoration: none;
      color: inherit;
      cursor: pointer;
      overflow: hidden;
      position: relative;
      z-index: 1;
      gap: 10px;
    `;

    const iconWell = doc.createElement('div');
    iconWell.style.cssText = `
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    `;

    const favicon = createFaviconImg(doc, item.url, { size: 36 });
    favicon.style.cssText = `
      width: 36px;
      height: 36px;
      border-radius: 8px;
      flex-shrink: 0;
    `;
    iconWell.appendChild(favicon);

    const title = doc.createElement('div');
    title.textContent = item.title || domain;
    title.style.cssText = `
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.01em;
      color: #f2f2f2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    `;

    const domainEl = doc.createElement('div');
    domainEl.textContent = domain;
    domainEl.style.cssText = `
      font-size: 11px;
      color: #8a939c;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    `;

    const launchHint = doc.createElement('div');
    launchHint.textContent = 'Launch →';
    launchHint.style.cssText = `
      margin-top: 4px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #7cbc8e;
      opacity: 0.85;
    `;

    const editing =
      this._launchDeckEditMode && this._isCatalogCategory(this._currentCategory);

    if (editing) {
      launchHint.textContent = 'Editing';
      launchHint.style.color = '#c9a86c';
      mainLink.href = '#';
      mainLink.removeAttribute('target');
      mainLink.style.cursor = 'default';
      mainLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }

    mainLink.appendChild(iconWell);
    mainLink.appendChild(title);
    mainLink.appendChild(domainEl);
    mainLink.appendChild(launchHint);

    if (visitedLabel) {
      mainLink.appendChild(
        this._createCardDateOverlay(doc, `Visited on ${visitedLabel}`)
      );
    }

    const footer = doc.createElement('div');
    footer.style.cssText = `
      display: flex;
      align-items: stretch;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      position: relative;
      z-index: 1;
      flex-shrink: 0;
    `;

    if (editing) {
      const mkEditBtn = (label, titleText, onClick) => {
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.title = titleText;
        btn.style.cssText = `
          flex: 1;
          padding: 10px 8px;
          background: rgba(0, 0, 0, 0.25);
          border: none;
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          color: #9aa3ab;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: background 0.15s, color 0.15s;
        `;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        });
        btn.addEventListener('mouseenter', () => {
          btn.style.background = 'rgba(0, 0, 0, 0.4)';
          btn.style.color = '#fff';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'rgba(0, 0, 0, 0.25)';
          btn.style.color = '#9aa3ab';
        });
        return btn;
      };

      const upBtn = mkEditBtn('↑', 'Move up', () => {
        void this._moveLaunchDeckItem(item.url, -1);
      });
      upBtn.style.borderLeft = 'none';
      const downBtn = mkEditBtn('↓', 'Move down', () => {
        void this._moveLaunchDeckItem(item.url, 1);
      });
      const removeBtn = mkEditBtn('✕', 'Remove from Launch Deck', () => {
        void this._hideLaunchDeckItem(item.url);
      });
      removeBtn.addEventListener('mouseenter', () => {
        removeBtn.style.color = '#ffb4b4';
      });

      // Simple HTML5 drag reorder
      container.draggable = true;
      container.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', item.url || '');
        container.style.opacity = '0.6';
      });
      container.addEventListener('dragend', () => {
        container.style.opacity = '1';
      });
      container.addEventListener('dragover', (e) => {
        e.preventDefault();
      });
      container.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fromUrl = e.dataTransfer?.getData('text/plain');
        const toUrl = item.url;
        if (!fromUrl || !toUrl || fromUrl === toUrl) return;
        const sites = this._categories?.[this._currentCategory]?.sites;
        if (!Array.isArray(sites)) return;
        const fromKey = normalizeLaunchDeckUrl(fromUrl);
        const toKey = normalizeLaunchDeckUrl(toUrl);
        const fromIdx = sites.findIndex(
          (s) => normalizeLaunchDeckUrl(s.url) === fromKey
        );
        const toIdx = sites.findIndex(
          (s) => normalizeLaunchDeckUrl(s.url) === toKey
        );
        if (fromIdx < 0 || toIdx < 0) return;
        const next = sites.slice();
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        this._categories[this._currentCategory].sites = next;
        void this._persistCurrentDeckOrder(this._currentCategory).then(() => {
          this._renderCategory(this._currentCategory);
        });
      });

      footer.appendChild(upBtn);
      footer.appendChild(downBtn);
      footer.appendChild(removeBtn);
      container.appendChild(accent);
      container.appendChild(mainLink);
      container.appendChild(footer);
      return container;
    }

    const previewBtn = doc.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'kp-launcher-card-preview';
    previewBtn.style.cssText = `
      flex: 1;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.25);
      border: none;
      color: #9aa3ab;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      font-size: 16px;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
    `;
    const launchEye = doc.createElement('span');
    launchEye.setAttribute('aria-hidden', 'true');
    launchEye.textContent = '👁';
    const launchPreviewLabel = doc.createElement('span');
    launchPreviewLabel.textContent = 'Preview';
    launchPreviewLabel.style.cssText = `
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.02em;
      line-height: 1;
    `;
    previewBtn.appendChild(launchEye);
    previewBtn.appendChild(launchPreviewLabel);
    previewBtn.title = 'Preview / close preview';

    previewBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._showPreview(item.url);
    });
    previewBtn.addEventListener('mouseenter', () => {
      previewBtn.style.background = 'rgba(0, 0, 0, 0.4)';
      previewBtn.style.color = '#fff';
    });
    previewBtn.addEventListener('mouseleave', () => {
      previewBtn.style.background = 'rgba(0, 0, 0, 0.25)';
      previewBtn.style.color = '#9aa3ab';
    });

    footer.appendChild(previewBtn);
    container.appendChild(accent);
    container.appendChild(mainLink);
    container.appendChild(footer);

    container.addEventListener('mouseenter', () => {
      container.style.borderColor = '#5a7a68';
      container.style.transform = 'translateY(-3px)';
      container.style.boxShadow =
        'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 10px 28px rgba(0, 0, 0, 0.35)';
      launchHint.style.opacity = '1';
      launchHint.style.color = '#9fd4ae';
    });
    container.addEventListener('mouseleave', () => {
      container.style.borderColor = '#3d4a55';
      container.style.transform = 'translateY(0)';
      container.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.06)';
      launchHint.style.opacity = '0.85';
      launchHint.style.color = '#7cbc8e';
    });

    mainLink.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });

    return container;
  }

  /**
   * Favorites / History / Search listing cards.
   * @param {{ title?: string, url?: string, isDefault?: boolean, dateAdded?: number, lastVisitTime?: number }} item
   * @param {{ showAddedOn?: boolean }} [opts]
   */
  _createListingCard(item, opts = {}) {
    const doc = document;
    const domain = extractDomain(item.url) || String(item.url || '');
    const path = extractPath(item.url);
    const visitedLabel = this._formatCardDate(item.lastVisitTime);
    const addedLabel = !visitedLabel && opts.showAddedOn
      ? this._formatBookmarkAddedDate(item.dateAdded)
      : null;
    const dateOverlayText = visitedLabel
      ? `Visited on ${visitedLabel}`
      : (addedLabel ? `Added on ${addedLabel}` : null);

    const container = doc.createElement('div');
    container.className = 'kp-launcher-card-container kp-launcher-listing-card';
    container.style.cssText = `
      display: flex;
      background: #2a2a2a;
      border: 1px solid #333;
      border-radius: 8px;
      overflow: hidden;
      min-height: 100px;
      transition: all 0.2s;
      position: relative;
    `;

    applyCardBackground(container, item.url, {
      fallbackSolid: '#2a2a2a',
      hoverSolid: '#333',
      manageHover: true,
      videoPrefer: true,
      youtubePrefer: true,
      lazy: true,
      lazyRoot: this._gridContainer,
      lazyRootMargin: '100% 100% 100% 100%',
      priority: 1
    });

    const mainLink = doc.createElement('a');
    mainLink.href = item.url;
    mainLink.target = '_blank';
    mainLink.rel = 'noopener noreferrer';
    mainLink.className = 'kp-launcher-card-main';
    mainLink.style.cssText = `
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      padding: 20px;
      padding-bottom: ${dateOverlayText ? '36px' : '20px'};
      text-decoration: none;
      color: inherit;
      cursor: pointer;
      overflow: hidden;
      position: relative;
      z-index: 1;
    `;

    const favicon = createFaviconImg(doc, item.url, { size: 32 });
    favicon.style.cssText = `
      width: 32px;
      height: 32px;
      margin-bottom: 12px;
      border-radius: 6px;
      flex-shrink: 0;
    `;

    const title = doc.createElement('div');
    title.textContent = item.title || domain;
    title.style.cssText = `
      font-size: 14px;
      font-weight: 500;
      color: #fff;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    const domainEl = doc.createElement('div');
    domainEl.textContent = domain;
    domainEl.style.cssText = `
      font-size: 12px;
      color: #888;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    const pathEl = doc.createElement('div');
    pathEl.textContent = path;
    pathEl.style.cssText = `
      font-size: 11px;
      color: #666;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-top: 2px;
      ${path ? '' : 'display: none;'}
    `;

    mainLink.appendChild(favicon);
    mainLink.appendChild(title);
    mainLink.appendChild(domainEl);
    mainLink.appendChild(pathEl);

    if (dateOverlayText) {
      mainLink.appendChild(
        this._createCardDateOverlay(
          doc,
          dateOverlayText,
          visitedLabel ? 'kp-launcher-card-visited-on' : 'kp-launcher-card-added-on'
        )
      );
    }

    const previewBtn = doc.createElement('button');
    previewBtn.className = 'kp-launcher-card-preview';
    previewBtn.style.cssText = `
      width: 80px;
      flex-shrink: 0;
      background: #1f1f1f;
      border: none;
      border-left: 1px solid #333;
      color: #888;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-size: 22px;
      transition: all 0.2s;
    `;
    const listingEye = doc.createElement('span');
    listingEye.setAttribute('aria-hidden', 'true');
    listingEye.textContent = '👁';
    const listingPreviewLabel = doc.createElement('span');
    listingPreviewLabel.textContent = 'Preview';
    listingPreviewLabel.style.cssText = `
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.02em;
      line-height: 1;
    `;
    previewBtn.appendChild(listingEye);
    previewBtn.appendChild(listingPreviewLabel);
    previewBtn.title = 'Preview / close preview';

    previewBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._showPreview(item.url);
    });
    previewBtn.addEventListener('mouseenter', () => {
      previewBtn.style.background = '#2a2a2a';
      previewBtn.style.color = '#fff';
    });
    previewBtn.addEventListener('mouseleave', () => {
      previewBtn.style.background = '#1f1f1f';
      previewBtn.style.color = '#888';
    });

    container.appendChild(mainLink);
    container.appendChild(previewBtn);

    container.addEventListener('mouseenter', () => {
      container.style.borderColor = '#444';
      container.style.transform = 'translateY(-2px)';
    });
    container.addEventListener('mouseleave', () => {
      container.style.borderColor = '#333';
      container.style.transform = 'translateY(0)';
    });

    mainLink.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });

    return container;
  }

  /**
   * Open a URL in the same KeyPilot OS popup used by Link Preview.
   * @param {string} url
   * @param {{ closeKeys?: string[] }} [opts]
   * @returns {Promise<boolean>}
   */
  async _openPreviewWindow(url, opts = {}) {
    const href = preferHttpsForPreview(String(url || '').trim());
    if (!href || href.startsWith('file://')) return false;
    const om = window.__KeyPilotInstance?.overlayManager;
    if (!om || typeof om._openPopoverWindow !== 'function') return false;
    return om._openPopoverWindow({
      url: href,
      kind: 'preview',
      closeKeys: opts.closeKeys || ['Escape', 'e', 'E']
    });
  }

  /**
   * Close any KeyPilot OS preview popup opened from the launcher.
   */
  _hidePreview() {
    this._currentPreviewUrl = null;
    try {
      window.__KeyPilotInstance?.overlayManager?.hidePopover?.();
    } catch { /* ignore */ }
    if (this._previewArea) {
      this._previewArea.style.width = '0';
    }
  }

  /**
   * Open Link Preview OS popup for a launcher card URL.
   * Clicking preview again for the same URL closes the popup.
   */
  _showPreview(url) {
    if (url && String(url).startsWith('file://')) {
      console.warn('[LauncherPopover] Cannot preview file:// URLs due to CSP restrictions');
      return;
    }

    const href = preferHttpsForPreview(String(url || '').trim());
    const om = window.__KeyPilotInstance?.overlayManager;
    if (
      href &&
      this._currentPreviewUrl &&
      preferHttpsForPreview(this._currentPreviewUrl) === href &&
      om?.isPopoverOpen?.() &&
      preferHttpsForPreview(String(om._popoverWindowUrl || '')) === href
    ) {
      this._hidePreview();
      return;
    }

    this._currentPreviewUrl = href || null;
    void this._openPreviewWindow(url);
  }

  /**
   * Scroll to previous sheet
   */
  _scrollUp() {
    if (this._currentSheet > 0) {
      this._currentSheet--;
      this._renderCategory(this._currentCategory);
    }
  }

  /**
   * Scroll to next sheet
   */
  _scrollDown() {
    if (!this._categories || !this._categories[this._currentCategory]) return;

    const items = this._getActiveSubTabItems(this._currentCategory);
    const maxSheets = Math.ceil(items.length / this._itemsPerSheet);

    if (this._currentSheet < maxSheets - 1) {
      this._currentSheet++;
      this._renderCategory(this._currentCategory);
    }
  }

  /**
   * Navigate to previous category tab
   */
  _navigateToPreviousTab() {
    const currentIndex = this._categoryOrder.indexOf(this._currentCategory);
    if (currentIndex > 0) {
      this._selectCategory(this._categoryOrder[currentIndex - 1]);
    }
  }

  /**
   * Navigate to next category tab
   */
  _navigateToNextTab() {
    const currentIndex = this._categoryOrder.indexOf(this._currentCategory);
    if (currentIndex < this._categoryOrder.length - 1) {
      this._selectCategory(this._categoryOrder[currentIndex + 1]);
    }
  }

  /**
   * Handle keyboard events (C/V for scrolling, Arrow keys for tab navigation, Esc to close)
   */
  handleKeyDown(e) {
    if (!this._isOpen) return false;

    const key = e.key.toLowerCase();

    // Always allow Escape to close (or exit Launch Deck edit mode first)
    if (key === 'escape') {
      e.preventDefault();
      e.stopPropagation();
      if (this._launchDeckEditMode) {
        this._setLaunchDeckEditMode(false);
        return true;
      }
      this.hide();
      return true;
    }

    // If any launcher search field is focused, don't intercept most keys (let user type)
    const active = document.activeElement;
    const isSearchFocused =
      (this._searchInput && active === this._searchInput) ||
      (this._categorySearchInput && active === this._categorySearchInput);
    if (isSearchFocused && key !== 'escape') {
      return false;
    }

    // Forward slash activates the Search tab
    if (key === '/' && !isSearchFocused) {
      e.preventDefault();
      e.stopPropagation();
      this._activateSearchTab({ focus: true });
      return true;
    }

    // Arrow keys for tab navigation
    if (key === 'arrowup') {
      e.preventDefault();
      e.stopPropagation();
      this._navigateToPreviousTab();
      return true;
    }

    if (key === 'arrowdown') {
      e.preventDefault();
      e.stopPropagation();
      this._navigateToNextTab();
      return true;
    }

    // C/V keys for scrolling through grid sheets
    if (key === 'c') {
      e.preventDefault();
      e.stopPropagation();
      this._scrollUp();
      return true;
    }

    if (key === 'v') {
      e.preventDefault();
      e.stopPropagation();
      this._scrollDown();
      return true;
    }

    return false;
  }
}
