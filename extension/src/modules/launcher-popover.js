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
import { LAUNCHER_SEARCH_SITES } from '../config/search-engines.js';
import { createPreviewOpenActionButtons } from '../ui/preview-open-actions.js';

export class LauncherPopover {
  constructor(keypilot) {
    this._keypilot = keypilot;
    this._container = null;
    this._tabListContainer = null;
    this._gridContainer = null;
    this._searchInput = null;
    this._currentCategory = 'bookmarks';
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
    this._categoryOrder = ['bookmarks', 'history', 'social', 'news', 'productivity', 'videos', 'entertainment', 'shopping', 'ai', 'archive', 'searches'];
    this._showDefaultSites = true; // Checkbox: show curated launcher Sites (not Favorites)
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
    /**
     * In-pane search results (iframe replaces the card grid).
     * @type {Record<string, { url: string, title: string }>}
     */
    this._pageResults = Object.create(null);
    /** @type {HTMLIFrameElement|null} */
    this._pageResultsIframe = null;
    this._pageResultsBridgeTimer = null;
    /** @type {ReturnType<typeof setTimeout>|null} */
    this._pageResultsLoadTimeout = null;

    // Define available sub-tabs for each category (extensible for future types)
    // Order matters: Sites → Favorites → History → Search (virtual results tab).
    this._categorySubTabConfig = {
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
     * - renderHeaderSearch: search box to the right of the active tab title/description
     * - renderBeforeCards: extra chrome above the card grid
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
    // Preview-related properties
    this._previewError = null;
    this._errorTitle = null;
    this._errorMessage = null;
    this._currentPreviewUrl = null;
    this._previewBridgeTimer = null;
    // Default sites per category
    this._defaultSites = {
      social: [
        { title: 'Instagram', url: 'https://instagram.com', isDefault: true },
        { title: 'Facebook', url: 'https://facebook.com', isDefault: true },
        { title: 'X (Twitter)', url: 'https://x.com', isDefault: true },
        { title: 'Reddit', url: 'https://reddit.com', isDefault: true },
        { title: 'Bluesky', url: 'https://bsky.app', isDefault: true },
        { title: 'LinkedIn', url: 'https://linkedin.com', isDefault: true },
        { title: 'Threads', url: 'https://threads.net', isDefault: true },
        { title: 'Mastodon', url: 'https://mastodon.social', isDefault: true }
      ],
      videos: [
        {
          title: 'YouTube',
          url: 'https://youtube.com',
          searchUrlPrefix: 'https://www.youtube.com/results?search_query=',
          isDefault: true
        },
        {
          title: 'Rumble',
          url: 'https://rumble.com',
          searchUrlPrefix: 'https://rumble.com/search/all?q=',
          isDefault: true
        },
        {
          title: 'Twitch',
          url: 'https://twitch.tv',
          searchUrlPrefix: 'https://www.twitch.tv/search?term=',
          isDefault: true
        },
        {
          title: 'Vimeo',
          url: 'https://vimeo.com',
          searchUrlPrefix: 'https://vimeo.com/search?q=',
          isDefault: true
        },
        {
          title: 'Dailymotion',
          url: 'https://dailymotion.com',
          searchUrlPrefix: 'https://www.dailymotion.com/search/',
          isDefault: true
        },
        {
          title: 'Odysee',
          url: 'https://odysee.com',
          searchUrlPrefix: 'https://odysee.com/$/search?q=',
          isDefault: true
        }
      ],
      entertainment: [
        { title: 'Netflix', url: 'https://netflix.com', isDefault: true },
        { title: 'Disney+', url: 'https://disneyplus.com', isDefault: true },
        { title: 'Hulu', url: 'https://hulu.com', isDefault: true },
        { title: 'YouTube', url: 'https://youtube.com', isDefault: true },
        { title: 'HBO Max', url: 'https://max.com', isDefault: true },
        { title: 'Prime Video', url: 'https://primevideo.com', isDefault: true },
        { title: 'Paramount+', url: 'https://paramountplus.com', isDefault: true },
        { title: 'Peacock', url: 'https://peacocktv.com', isDefault: true }
      ],
      news: [
        { title: 'CNN', url: 'https://cnn.com', isDefault: true },
        { title: 'BBC News', url: 'https://bbc.com/news', isDefault: true },
        { title: 'NY Times', url: 'https://nytimes.com', isDefault: true },
        { title: 'Reuters', url: 'https://reuters.com', isDefault: true },
        { title: 'The Guardian', url: 'https://theguardian.com', isDefault: true },
        { title: 'AP News', url: 'https://apnews.com', isDefault: true }
      ],
      productivity: [
        { title: 'Gmail', url: 'https://gmail.com', isDefault: true },
        { title: 'Google Calendar', url: 'https://calendar.google.com', isDefault: true },
        { title: 'Google Drive', url: 'https://drive.google.com', isDefault: true },
        { title: 'Google Docs', url: 'https://docs.google.com', isDefault: true },
        { title: 'Notion', url: 'https://notion.so', isDefault: true },
        { title: 'Slack', url: 'https://slack.com', isDefault: true },
        { title: 'Trello', url: 'https://trello.com', isDefault: true }
      ],
      shopping: [
        { title: 'Amazon', url: 'https://amazon.com', isDefault: true },
        { title: 'eBay', url: 'https://ebay.com', isDefault: true },
        { title: 'Walmart', url: 'https://walmart.com', isDefault: true },
        { title: 'Target', url: 'https://target.com', isDefault: true },
        { title: 'Etsy', url: 'https://etsy.com', isDefault: true }
      ],
      archive: [
        { title: 'Internet Archive', url: 'https://archive.org', isDefault: true },
        { title: 'Web', url: 'https://web.archive.org', isDefault: true },
        { title: 'Texts', url: 'https://archive.org/details/texts', isDefault: true },
        { title: 'Video', url: 'https://archive.org/details/movies', isDefault: true },
        { title: 'Audio', url: 'https://archive.org/details/audio', isDefault: true },
        { title: 'Software', url: 'https://archive.org/details/software', isDefault: true },
        { title: 'Images', url: 'https://archive.org/details/image', isDefault: true }
      ],
      ai: [
        { title: 'ChatGPT', url: 'https://chat.openai.com', isDefault: true },
        { title: 'Claude', url: 'https://claude.ai', isDefault: true },
        { title: 'Grok', url: 'https://grok.com', isDefault: true },
        { title: 'Gemini', url: 'https://gemini.google.com', isDefault: true },
        { title: 'Copilot', url: 'https://copilot.microsoft.com', isDefault: true },
        { title: 'Perplexity', url: 'https://perplexity.ai', isDefault: true },
        { title: 'Poe', url: 'https://poe.com', isDefault: true },
        { title: 'Character.AI', url: 'https://character.ai', isDefault: true },
        { title: 'Hugging Face', url: 'https://huggingface.co/chat', isDefault: true }
      ],
      // SSOT: search-engines.js (shared with settings default-engine catalog)
      searches: LAUNCHER_SEARCH_SITES.map((s) => ({ ...s }))
    };
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

    // Paint shell with default sites first (no network / history APIs).
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

    // Clear any pending bridge initialization
    if (this._previewBridgeTimer) {
      clearInterval(this._previewBridgeTimer);
      this._previewBridgeTimer = null;
    }

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
    this._previewIframe = null;
    this._pageResultsIframe = null;
    this._teardownPageResultsBridge();
    this._currentSheet = 0;
    this._searchQuery = '';
    this._headerSearchDrafts = Object.create(null);
    this._videosSearchSiteUrl = 'https://youtube.com';
    this._pageResults = Object.create(null);
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
   * Extract domains from default site list for a category
   */
  _getDefaultDomains(categoryKey) {
    if (!this._defaultSites[categoryKey]) return [];
    return this._defaultSites[categoryKey]
      .map((site) => extractDomain(site.url))
      .filter((domain) => domain !== '');
  }

  /**
   * Immediate category shell using default sites only (no Chrome history APIs).
   * Domain-history tabs start empty and fill in when first selected.
   * `sites` = launcher-only curated defaults; `favorites` = bookmarks; `history` = visits.
   */
  _initCategoriesWithDefaults() {
    const defaults = (key) => (this._showDefaultSites && this._defaultSites[key]
      ? [...this._defaultSites[key]]
      : []);

    const emptyLists = () => ({ sites: [], history: [], favorites: [] });

    this._categories = {
      bookmarks: {
        label: 'Bookmarks',
        description: 'Your saved bookmarks and frequently visited sites',
        icon: '📑',
        ...emptyLists()
      },
      history: {
        label: 'Recent',
        description: 'Sites you have visited most recently',
        icon: '🕐',
        ...emptyLists()
      },
      social: {
        label: 'Social Media',
        description: 'Stay connected across social networks',
        icon: '💬',
        sites: defaults('social'),
        history: [],
        favorites: []
      },
      news: {
        label: 'News',
        description: 'Headlines and reporting from major outlets',
        icon: '📰',
        sites: defaults('news'),
        history: [],
        favorites: []
      },
      productivity: {
        label: 'Productivity',
        description: 'Mail, docs, calendars, and work tools',
        icon: '⚡',
        sites: defaults('productivity'),
        history: [],
        favorites: []
      },
      videos: {
        label: 'Videos',
        description: 'Watch and search video sites',
        icon: '📹',
        sites: defaults('videos'),
        history: [],
        favorites: []
      },
      entertainment: {
        label: 'Entertainment',
        description: 'Streaming and entertainment destinations',
        icon: '🎬',
        sites: defaults('entertainment'),
        history: [],
        favorites: []
      },
      shopping: {
        label: 'Shopping',
        description: 'Stores and marketplaces',
        icon: '🛒',
        sites: defaults('shopping'),
        history: [],
        favorites: []
      },
      ai: {
        label: 'AI',
        description: 'Chatbots and AI assistants',
        icon: '🤖',
        sites: defaults('ai'),
        history: [],
        favorites: []
      },
      archive: {
        label: 'Internet Archive',
        description: 'Search and browse the Internet Archive library',
        icon: '📚',
        sites: defaults('archive'),
        history: [],
        favorites: []
      },
      searches: {
        label: 'Searches',
        description: 'Search engines and recent web searches',
        icon: '🔍',
        sites: defaults('searches'),
        history: [],
        favorites: []
      }
    };

    this._initDefaultSubTabs();
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
      if (!force && this._categorySubTabs[categoryKey]) continue;

      const subTabConfig = this._categorySubTabConfig[categoryKey] || ['favorites', 'history'];
      const sitesCount = this._categories[categoryKey].sites?.length || 0;
      const historyCount = this._categories[categoryKey].history?.length || 0;
      const favoritesCount = this._categories[categoryKey].favorites?.length || 0;

      if (sitesCount > 0 && subTabConfig.includes('sites')) {
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

      // Bookmarks (former Favorites query): all bookmarks + top sites / recent visits.
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
      this._historyLoaded.bookmarks = true;
      this._historyLoaded.history = true;
      // searches + theme categories: history loaded lazily via `_ensureCategoryHistory`

      // Re-pick defaults for shared categories now that history rows exist.
      // Theme categories keep Sites as default when present; only refresh favorites lists.
      this._initDefaultSubTabs({
        force: true,
        onlyKeys: ['bookmarks', 'history', 'searches']
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
      const history = await this._getHistoryForDomains(domains);

      if (!this._stillOpen(gen) || !this._categories?.[categoryKey]) return;

      this._categories[categoryKey].history = history;
      // Keep Favorites = matching bookmarks (may already be set in shared load).
      if (Array.isArray(this._cachedBookmarks)) {
        this._categories[categoryKey].favorites = this._filterByDomains(
          this._cachedBookmarks,
          domains
        );
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
   * Reload Sites lists when "Show default sites" toggles (no full history re-fetch).
   */
  _applyDefaultSitesVisibility() {
    if (!this._categories) return;
    const keys = ['social', 'news', 'productivity', 'videos', 'entertainment', 'shopping', 'ai', 'archive', 'searches'];
    for (const key of keys) {
      if (!this._categories[key]) continue;
      this._categories[key].sites = this._showDefaultSites && this._defaultSites[key]
        ? [...this._defaultSites[key]]
        : [];
    }
  }

  /**
   * Get bookmarks via message passing to background script
   */
  async _getBookmarks() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'KP_GET_BOOKMARKS'
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
        type: 'KP_GET_TOP_SITES',
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
        type: 'KP_GET_RECENT_HISTORY',
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
   * Get history for specific domains via message passing
   */
  async _getHistoryForDomains(domains) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'KP_GET_HISTORY_FOR_DOMAINS',
        domains: domains,
        days: 30
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
   * @param {string} itemUrl
   * @param {{ url?: string }} site
   */
  _itemMatchesSite(itemUrl, site) {
    const siteDomain = extractDomain(site?.url);
    const itemDomain = extractDomain(itemUrl);
    if (!siteDomain || !itemDomain) return false;
    return itemDomain === siteDomain || itemDomain.endsWith('.' + siteDomain);
  }

  /**
   * Curated Sites entries that have at least one History visit in this category.
   * Used for the Favorites/History site-filter subtabs.
   * @param {string} categoryKey
   * @returns {Array<{title: string, url: string}>}
   */
  _getSitesWithHistoryVisits(categoryKey) {
    const sites = this._defaultSites[categoryKey];
    const history = this._categories?.[categoryKey]?.history;
    if (!Array.isArray(sites) || !sites.length || !Array.isArray(history) || !history.length) {
      return [];
    }
    return sites.filter((site) =>
      history.some((item) => this._itemMatchesSite(item?.url, site))
    );
  }

  /**
   * Keep the category's site filter valid for Favorites/History.
   * @param {string} categoryKey
   */
  _ensureValidSiteFilter(categoryKey) {
    const sitesWithVisits = this._getSitesWithHistoryVisits(categoryKey);
    const current = this._categorySiteFilters[categoryKey];
    if (!sitesWithVisits.length) {
      this._categorySiteFilters[categoryKey] = null;
      return;
    }
    const stillValid = sitesWithVisits.some((s) => s.url === current);
    if (!stillValid) {
      this._categorySiteFilters[categoryKey] = sitesWithVisits[0].url;
    }
  }

  /**
   * Items for the active primary sub-tab, optionally filtered by Sites domain.
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
    if (currentSubTab === 'favorites' || currentSubTab === 'history') {
      const siteUrl = this._categorySiteFilters[categoryKey];
      if (siteUrl) {
        const site = (this._defaultSites[categoryKey] || []).find((s) => s.url === siteUrl);
        if (site) {
          items = items.filter((item) => this._itemMatchesSite(item?.url, site));
        }
      }
    }
    return items;
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
   * Inject light-DOM CSS that scopes/resets host-page rules for launcher controls.
   *
   * Host sites (e.g. firefox.com) style bare `button` / `[role="button"]` with large
   * border-radius tokens. Because the launcher is mounted in the page document (not a
   * shadow root), those rules paint our subtabs, clear btn, and card preview buttons
   * unless we win the cascade. High-specificity selectors beat typical host `button`
   * rules without !important so intentional inline border-radius values still win.
   *
   * @param {Document} doc
   * @param {HTMLElement} container
   */
  _injectScopedStyles(doc, container) {
    if (!doc || !container) return;
    const style = doc.createElement('style');
    style.setAttribute('data-kp-launcher-scope', 'true');
    style.textContent = `
      /* Reset form/control radii so host page button styles cannot leak in.
         Specificity (html body .kp-launcher-container button) beats bare button /
         [role=button] host rules; element inline styles still override this. */
      html body .kp-launcher-container button,
      html body .kp-launcher-container [role="button"],
      html body .kp-launcher-container input,
      html body .kp-launcher-container select,
      html body .kp-launcher-container textarea {
        border-radius: 0;
      }
    `;
    container.appendChild(style);
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
      background: rgb(26, 26, 26);
      border: 2px solid #333;
      border-radius: 12px;
      display: flex;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      isolation: isolate;
      contain: layout style paint;
      will-change: transform;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      -webkit-transform: translateZ(0);
    `;

    // Scope/reset host-page control styles before children mount.
    this._injectScopedStyles(doc, this._container);

    this._boundContainerKeyDown = (e) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        try { e.stopImmediatePropagation(); } catch { /* ignore */ }
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
      padding: 20px 16px 16px;
      border-bottom: 1px solid #333;
      flex-shrink: 0;
    `;

    const brandTitle = doc.createElement('h2');
    brandTitle.className = 'kp-launcher-title';
    brandTitle.textContent = 'Launcher';
    brandTitle.style.cssText = `
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      color: #fff;
    `;

    const brandSubtitle = doc.createElement('p');
    brandSubtitle.className = 'kp-launcher-subtitle';
    brandSubtitle.textContent = 'Quick access to your favorite sites';
    brandSubtitle.style.cssText = `
      margin: 6px 0 0 0;
      font-size: 12px;
      line-height: 1.35;
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

    // Render tabs
    if (this._categories) {
      Object.keys(this._categories).forEach(categoryKey => {
        const category = this._categories[categoryKey];
        const tab = this._createTab(categoryKey, category);
        this._tabListContainer.appendChild(tab);
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
      this._updateTabCounts();
      this._updateSubTabsUI();
      this._updateSubTabStyles();
      this._renderCategory(this._currentCategory);
    });

    const checkboxText = doc.createElement('span');
    checkboxText.textContent = 'Show default sites';

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
      padding: 20px 24px;
      border-bottom: 1px solid #333;
      background: #0f0f0f;
      display: flex;
      align-items: center;
      gap: 24px;
    `;

    const titleBlock = doc.createElement('div');
    titleBlock.className = 'kp-launcher-title-block';
    titleBlock.style.cssText = `
      flex: 0 1 auto;
      min-width: 0;
    `;

    this._headerTitle = doc.createElement('h2');
    this._headerTitle.className = 'kp-launcher-category-title';
    this._headerTitle.style.cssText = `
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #fff;
    `;

    this._headerDescription = doc.createElement('p');
    this._headerDescription.className = 'kp-launcher-category-description';
    this._headerDescription.style.cssText = `
      margin: 4px 0 0 0;
      font-size: 14px;
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

    // Sub-tabs: primary row (Sites/Favorites/History/Search) + optional site-filter row
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

    // Footer with navigation controls
    const footer = doc.createElement('div');
    footer.className = 'kp-launcher-footer';
    footer.style.cssText = `
      padding: 16px 24px;
      border-top: 1px solid #333;
      background: #0f0f0f;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const hint = doc.createElement('div');
    hint.style.cssText = 'color: #888; font-size: 13px;';
    hint.innerHTML = 'Press <strong>↑↓</strong> for tabs • <strong>/</strong> to search • <strong>F</strong> to open • <strong>Esc</strong> to close';

    const navControls = doc.createElement('div');
    navControls.className = 'kp-launcher-nav-controls';
    navControls.style.cssText = `
      display: flex;
      gap: 12px;
      align-items: center;
    `;

    // Up button
    const upBtn = this._createNavButton('↑', 'C', () => this._scrollUp());
    navControls.appendChild(upBtn);

    // Down button
    const downBtn = this._createNavButton('↓', 'V', () => this._scrollDown());
    navControls.appendChild(downBtn);

    footer.appendChild(hint);
    footer.appendChild(navControls);

    // Assemble content area
    contentArea.appendChild(header);
    contentArea.appendChild(this._subTabContainer);
    contentArea.appendChild(this._gridContainer);
    contentArea.appendChild(footer);

    // Preview area (iframe)
    const previewArea = doc.createElement('div');
    previewArea.className = 'kp-launcher-preview-area';
    previewArea.style.cssText = `
      width: 0;
      background: #0f0f0f;
      border-left: 1px solid #333;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width 0.3s ease;
    `;

    // Preview header
    const previewHeader = doc.createElement('div');
    previewHeader.className = 'kp-launcher-preview-header';
    previewHeader.style.cssText = `
      padding: 8px 12px;
      border-bottom: 1px solid #333;
      background: #0f0f0f;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    `;

    const previewTitle = doc.createElement('div');
    previewTitle.className = 'kp-launcher-preview-title';
    previewTitle.textContent = 'Preview';
    previewTitle.style.cssText = `
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    // Same Open / Open in New Tab controls as Link Preview titlebar
    const { actions: previewOpenActions } = createPreviewOpenActionButtons({
      doc,
      getUrl: () => this._currentPreviewUrl,
      afterOpen: () => {
        try { this.hide(); } catch { /* ignore */ }
      },
      afterOpenNewTab: () => {
        // Keep launcher open after spawning a tab so the user can keep browsing.
      }
    });

    // Rightward collapse control (preview slides in from the right).
    const previewCloseBtn = doc.createElement('button');
    previewCloseBtn.type = 'button';
    previewCloseBtn.className = 'kp-launcher-preview-close';
    previewCloseBtn.title = 'Collapse preview';
    previewCloseBtn.setAttribute('aria-label', 'Collapse preview');
    previewCloseBtn.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      appearance: none;
      -webkit-appearance: none;
      box-sizing: border-box;
      background: transparent;
      border: 1px solid transparent;
      box-shadow: none;
      color: #888;
      cursor: pointer;
      padding: 0;
      width: 26px;
      height: 26px;
      border-radius: 5px;
      flex-shrink: 0;
      transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    `;
    // Outline chevron pointing right (collapse panel toward the right edge).
    const collapseIcon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    collapseIcon.setAttribute('viewBox', '0 0 24 24');
    collapseIcon.setAttribute('width', '16');
    collapseIcon.setAttribute('height', '16');
    collapseIcon.setAttribute('aria-hidden', 'true');
    collapseIcon.style.cssText = 'display: block; pointer-events: none;';
    const collapsePath = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    collapsePath.setAttribute('d', 'M9 6l6 6-6 6');
    collapsePath.setAttribute('fill', 'none');
    collapsePath.setAttribute('stroke', 'currentColor');
    collapsePath.setAttribute('stroke-width', '2');
    collapsePath.setAttribute('stroke-linecap', 'round');
    collapsePath.setAttribute('stroke-linejoin', 'round');
    collapseIcon.appendChild(collapsePath);
    previewCloseBtn.appendChild(collapseIcon);

    previewCloseBtn.addEventListener('click', () => {
      this._hidePreview();
    });

    previewCloseBtn.addEventListener('mouseenter', () => {
      previewCloseBtn.style.color = '#fff';
      previewCloseBtn.style.background = 'rgba(255,255,255,0.06)';
      previewCloseBtn.style.borderColor = '#3a3a3a';
    });

    previewCloseBtn.addEventListener('mouseleave', () => {
      previewCloseBtn.style.color = '#888';
      previewCloseBtn.style.background = 'transparent';
      previewCloseBtn.style.borderColor = 'transparent';
    });

    previewHeader.appendChild(previewTitle);
    previewHeader.appendChild(previewOpenActions);
    previewHeader.appendChild(previewCloseBtn);

    // Preview iframe
    this._previewIframe = doc.createElement('iframe');
    this._previewIframe.className = 'kp-launcher-preview-iframe';
    this._previewIframe.style.cssText = `
      flex: 1;
      border: none;
      background: #fff;
    `;

    // Create error message container (initially hidden)
    this._previewError = doc.createElement('div');
    this._previewError.className = 'kp-launcher-preview-error';
    this._previewError.style.cssText = `
      flex: 1;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      text-align: center;
      background: #f9f9f9;
      border-radius: 8px;
      margin: 8px;
    `;

    const errorIcon = doc.createElement('div');
    errorIcon.style.cssText = `
      font-size: 32px;
      margin-bottom: 12px;
      color: #999;
    `;
    errorIcon.textContent = '🚫';
    this._previewError.appendChild(errorIcon);

    this._errorTitle = doc.createElement('div');
    this._errorTitle.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 6px;
    `;
    this._errorTitle.textContent = 'Cannot Display Page';
    this._previewError.appendChild(this._errorTitle);

    this._errorMessage = doc.createElement('div');
    this._errorMessage.style.cssText = `
      font-size: 13px;
      color: #666;
      margin-bottom: 16px;
      max-width: 300px;
    `;
    this._errorMessage.textContent = 'This website prevents embedding in iframes for security reasons.';
    this._previewError.appendChild(this._errorMessage);

    const openInTabButton = doc.createElement('button');
    openInTabButton.style.cssText = `
      margin: 0;
      appearance: none;
      -webkit-appearance: none;
      box-sizing: border-box;
      background: #4CAF50;
      color: white;
      border: none;
      box-shadow: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    `;
    openInTabButton.textContent = 'Open in New Tab';
    openInTabButton.onclick = () => {
      if (this._currentPreviewUrl) {
        window.open(this._currentPreviewUrl, '_blank');
      }
    };
    this._previewError.appendChild(openInTabButton);

    previewArea.appendChild(previewHeader);
    previewArea.appendChild(this._previewIframe);
    previewArea.appendChild(this._previewError);

    this._previewArea = previewArea;

    // Assemble container
    this._container.appendChild(sidebar);
    this._container.appendChild(contentArea);
    this._container.appendChild(previewArea);

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
    this._clearCategoryPageResults(this._currentCategory, { render: false });
    this._categorySubTabs[this._currentCategory] = 'search';
    this._currentSheet = 0;
    this._updateSiteFilterTabsUI();
    this._updateSubTabStyles();
    this._renderCategory(this._currentCategory);
    this._updateTabCounts();
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

    const icon = doc.createElement('span');
    icon.textContent = category.icon;
    icon.style.fontSize = '18px';

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
      this._currentCategory = categoryKey;
      this._currentSheet = 0;
      this._updateContentHeader(categoryKey);
      this._updateSubTabsUI(); // Rebuild sub-tabs for new category
      this._updateHeaderPageSearch(categoryKey);
      this._renderCategory(categoryKey);
      this._updateTabStyles();
      this._updateSubTabStyles();
      void this._ensureCategoryHistory(categoryKey);
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
      this._clearCategoryPageResults(this._currentCategory, { render: false });
      this._categorySubTabs[this._currentCategory] = type;
      this._currentSheet = 0;
      if (type === 'favorites' || type === 'history') {
        this._ensureValidSiteFilter(this._currentCategory);
      }
      this._updateSiteFilterTabsUI();
      this._renderCategory(this._currentCategory);
      this._updateSubTabStyles();
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
      sites: 'Sites',
      favorites: 'Favorites',
      history: 'History',
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

    if (hadSearchFocus && this._searchInput) {
      try {
        this._searchInput.focus();
        const pos = searchCaret ?? this._searchInput.value.length;
        this._searchInput.setSelectionRange(pos, pos);
      } catch { /* ignore */ }
    }
  }

  /**
   * Second-row site filters under Favorites / History.
   * Only Sites with ≥1 History visit appear; wraps to multiple rows as needed.
   */
  _updateSiteFilterTabsUI() {
    if (!this._siteFilterRow) return;

    const categoryKey = this._currentCategory;
    const primary = this._categorySubTabs[categoryKey] || 'history';
    const showFilters = primary === 'favorites' || primary === 'history';
    const sitesWithVisits = showFilters ? this._getSitesWithHistoryVisits(categoryKey) : [];

    this._siteFilterRow.innerHTML = '';

    if (!showFilters || !sitesWithVisits.length) {
      this._siteFilterRow.style.display = 'none';
      return;
    }

    this._ensureValidSiteFilter(categoryKey);
    const activeSiteUrl = this._categorySiteFilters[categoryKey];
    this._siteFilterRow.style.display = 'flex';

    for (const site of sitesWithVisits) {
      const isActive = site.url === activeSiteUrl;
      const count = this._filterByDomains(
        this._categories?.[categoryKey]?.[primary] || [],
        [extractDomain(site.url)].filter(Boolean)
      ).length;

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
    input.placeholder = 'Search sites...';
    input.className = 'kp-launcher-search-input';
    input.setAttribute('aria-label', 'Search sites');
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
   * Render a category's page template + card grid, or in-pane search results.
   * Header page search is managed separately via `_updateHeaderPageSearch`.
   */
  _renderCategory(categoryKey) {
    if (!this._categories || !this._categories[categoryKey]) return;

    this._teardownPageResultsBridge();
    this._pageResultsIframe = null;
    this._gridContainer.innerHTML = '';

    const pageResults = this._pageResults[categoryKey];
    if (pageResults?.url) {
      this._gridContainer.appendChild(
        this._createCategoryResultsView(document, categoryKey, pageResults)
      );
      try { this._updateTabCounts?.(); } catch { /* ignore */ }
      return;
    }

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

    // Render items
    sheetItems.forEach((item) => {
      const card = this._createGridCard(item);
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
   * Show search results in the category's card area (iframe).
   * @param {string} categoryKey
   * @param {string} url
   * @param {string} [title]
   */
  _showCategoryPageResults(categoryKey, url, title = 'Search results') {
    if (!categoryKey || !url) return;
    this._pageResults[categoryKey] = { url, title };
    if (this._currentCategory === categoryKey && this._gridContainer) {
      this._renderCategory(categoryKey);
    }
  }

  /**
   * Clear in-pane results and optionally restore the card grid.
   * @param {string} categoryKey
   * @param {{ render?: boolean }} [opts]
   */
  _clearCategoryPageResults(categoryKey, opts = {}) {
    if (!categoryKey) return;
    const render = opts.render !== false;
    if (this._pageResults[categoryKey]) {
      delete this._pageResults[categoryKey];
    }
    this._teardownPageResultsBridge();
    this._pageResultsIframe = null;
    if (render && this._currentCategory === categoryKey && this._gridContainer) {
      this._renderCategory(categoryKey);
    }
  }

  _teardownPageResultsBridge() {
    if (this._pageResultsBridgeTimer) {
      clearInterval(this._pageResultsBridgeTimer);
      this._pageResultsBridgeTimer = null;
    }
    if (this._pageResultsLoadTimeout) {
      clearTimeout(this._pageResultsLoadTimeout);
      this._pageResultsLoadTimeout = null;
    }
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
   * In-pane results view that replaces the card grid after a header search.
   * Embeds via the same declarativeNetRequest strategy as Link Preview /
   * launcher preview (`rules.json` strips X-Frame-Options + CSP on sub_frame).
   * @param {Document} doc
   * @param {string} categoryKey
   * @param {{ url: string, title: string }} results
   * @returns {HTMLElement}
   */
  _createCategoryResultsView(doc, categoryKey, results) {
    const wrap = doc.createElement('div');
    wrap.className = 'kp-launcher-page-results';
    wrap.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      gap: 0;
      background: #0f0f0f;
      border: 1px solid #333;
      border-radius: 8px;
      overflow: hidden;
    `;

    const toolbar = doc.createElement('div');
    toolbar.className = 'kp-launcher-page-results-toolbar';
    toolbar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-bottom: 1px solid #333;
      background: #141414;
      flex-shrink: 0;
    `;

    const backBtn = doc.createElement('button');
    backBtn.type = 'button';
    backBtn.textContent = '← Sites';
    backBtn.style.cssText = `
      margin: 0;
      appearance: none;
      -webkit-appearance: none;
      padding: 6px 10px;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 6px;
      color: #fff;
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
    `;
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._clearCategoryPageResults(categoryKey);
    });

    const titleEl = doc.createElement('div');
    titleEl.textContent = results.title || 'Search results';
    titleEl.title = results.url;
    titleEl.style.cssText = `
      flex: 1;
      min-width: 0;
      color: #ddd;
      font-size: 13px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    const { actions: openActions } = createPreviewOpenActionButtons({
      doc,
      getUrl: () => this._pageResults[categoryKey]?.url || results.url,
      afterOpen: () => {
        try { this.hide(); } catch { /* ignore */ }
      },
      afterOpenNewTab: () => {
        try { this.hide(); } catch { /* ignore */ }
      }
    });

    toolbar.appendChild(backBtn);
    toolbar.appendChild(titleEl);
    toolbar.appendChild(openActions);

    const frameWrap = doc.createElement('div');
    frameWrap.style.cssText = `
      position: relative;
      flex: 1;
      min-height: 0;
      background: #fff;
    `;

    // Same embedding path as Link Preview / launcher card preview:
    // static DNR rules.json removes X-Frame-Options + CSP for sub_frame loads.
    const iframe = doc.createElement('iframe');
    iframe.className = 'kp-launcher-page-results-iframe';
    iframe.title = results.title || 'Search results';
    iframe.tabIndex = 0;
    iframe.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
      background: #fff;
      display: block;
    `;

    const errorEl = doc.createElement('div');
    errorEl.className = 'kp-launcher-page-results-error';
    errorEl.style.cssText = `
      display: none;
      position: absolute;
      inset: 0;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 12px;
      padding: 24px;
      text-align: center;
      color: #666;
      background: #f9f9f9;
      z-index: 1;
    `;

    const errorIcon = doc.createElement('div');
    errorIcon.textContent = '🚫';
    errorIcon.style.cssText = 'font-size: 32px; color: #999;';

    const errorTitle = doc.createElement('div');
    errorTitle.textContent = 'Cannot Display Page';
    errorTitle.style.cssText = 'color: #333; font-size: 16px; font-weight: 600;';

    const errorMsg = doc.createElement('div');
    errorMsg.textContent = 'This website prevents embedding in iframes for security reasons.';
    errorMsg.style.cssText = 'font-size: 13px; max-width: 360px;';

    const openInTabButton = doc.createElement('button');
    openInTabButton.type = 'button';
    openInTabButton.textContent = 'Open in New Tab';
    openInTabButton.style.cssText = `
      margin: 0;
      appearance: none;
      -webkit-appearance: none;
      background: #4CAF50;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    openInTabButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = this._pageResults[categoryKey]?.url || results.url;
      if (!url) return;
      try {
        const a = doc.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.display = 'none';
        doc.body.appendChild(a);
        a.click();
        a.remove();
      } catch {
        try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { /* ignore */ }
      }
      try { this.hide(); } catch { /* ignore */ }
    });

    errorEl.appendChild(errorIcon);
    errorEl.appendChild(errorTitle);
    errorEl.appendChild(errorMsg);
    errorEl.appendChild(openInTabButton);

    const showResultsError = () => {
      iframe.style.display = 'none';
      errorEl.style.display = 'flex';
    };

    const sendBridgeInit = () => {
      try {
        iframe.contentWindow?.postMessage({ type: 'KP_POPOVER_BRIDGE_INIT' }, '*');
      } catch { /* ignore */ }
    };

    this._teardownPageResultsBridge();
    this._pageResultsIframe = iframe;

    // Detect iframe load errors.
    // Note: We can't reliably detect X-Frame-Options blocking for cross-origin
    // iframes due to same-origin policy. The declarativeNetRequest rules should
    // handle most cases (same as Link Preview). Only show error on actual failure.
    iframe.onerror = () => {
      console.log('[LauncherPopover] Page-results iframe load error detected');
      showResultsError();
    };

    // Last-resort timeout when neither onload nor onerror fires
    // (shouldn't happen with declarativeNetRequest header stripping).
    this._pageResultsLoadTimeout = setTimeout(() => {
      this._pageResultsLoadTimeout = null;
      console.log('[LauncherPopover] Page-results iframe load timeout — showing error fallback');
      showResultsError();
    }, 30000);

    iframe.onload = () => {
      if (this._pageResultsLoadTimeout) {
        clearTimeout(this._pageResultsLoadTimeout);
        this._pageResultsLoadTimeout = null;
      }
      // Keep iframe visible — if onload fired, embedding worked (or DNR allowed it).
      console.log('[LauncherPopover] Page-results iframe loaded successfully');
      iframe.style.display = 'block';
      errorEl.style.display = 'none';
      sendBridgeInit();
    };

    iframe.src = results.url;
    sendBridgeInit();

    try {
      let attemptsLeft = 6; // ~1.5s total
      this._pageResultsBridgeTimer = setInterval(() => {
        if (attemptsLeft <= 0 || !this._pageResultsIframe || !this._isOpen) {
          if (this._pageResultsBridgeTimer) {
            clearInterval(this._pageResultsBridgeTimer);
            this._pageResultsBridgeTimer = null;
          }
          return;
        }
        attemptsLeft -= 1;
        sendBridgeInit();
      }, 250);
    } catch { /* ignore */ }

    // Ensure the results pane has a usable height inside the scroll container.
    const minH = Math.max(320, Math.floor((this._gridContainer?.clientHeight || 480) - 8));
    wrap.style.minHeight = `${minH}px`;
    wrap.style.height = `${minH}px`;

    frameWrap.appendChild(iframe);
    frameWrap.appendChild(errorEl);
    wrap.appendChild(toolbar);
    wrap.appendChild(frameWrap);
    return wrap;
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
      flex-direction: column;
      gap: 6px;
      width: 100%;
      max-width: ${maxWidth};
    `;

    const label = doc.createElement('label');
    label.textContent = labelText;
    label.htmlFor = inputId;
    label.style.cssText = `
      color: #aaa;
      font-size: 12px;
      font-weight: 500;
      text-align: right;
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
      padding: 10px 12px;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 8px;
      color: #fff;
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
    `;

    const submitBtn = doc.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'kp-launcher-page-search-submit';
    submitBtn.textContent = 'Search';
    submitBtn.style.cssText = `
      padding: 10px 14px;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 8px;
      color: #fff;
      font-size: 13px;
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
  _createGridCard(item) {
    const doc = document;
    // Shared URL helpers (same as omnibox / history listings)
    const domain = extractDomain(item.url) || String(item.url || '');
    const path = extractPath(item.url);
    const isDefault = item.isDefault === true;

    // Container — solid fallback until YouTube/official or captured page thumb loads.
    const container = doc.createElement('div');
    container.className = 'kp-launcher-card-container';
    container.style.cssText = `
      display: flex;
      background: ${isDefault ? '#3a3a3a' : '#2a2a2a'};
      border: 1px solid ${isDefault ? '#444' : '#333'};
      border-radius: 8px;
      overflow: hidden;
      min-height: 100px;
      transition: all 0.2s;
      position: relative;
    `;

    // Darkened video / page-screenshot background.
    // Lazy: load when near the grid viewport (~visible + 2× buffer), rate-limited + cached.
    applyCardBackground(container, item.url, {
      fallbackSolid: isDefault ? '#3a3a3a' : '#2a2a2a',
      hoverSolid: isDefault ? '#444' : '#333',
      manageHover: true,
      videoPrefer: true,
      youtubePrefer: true,
      lazy: true,
      lazyRoot: this._gridContainer,
      lazyRootMargin: '100% 100% 100% 100%',
      priority: 1
    });

    // Main link area (3/4 width) - add min-width: 0 to allow shrinking
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
      text-decoration: none;
      color: inherit;
      cursor: pointer;
      overflow: hidden;
      position: relative;
      z-index: 1;
    `;

    // Favicon via shared url-listing helper (SW fallback + generic icon)
    const favicon = createFaviconImg(doc, item.url, { size: 32 });
    favicon.style.cssText = `
      width: 32px;
      height: 32px;
      margin-bottom: 12px;
      border-radius: 6px;
      flex-shrink: 0;
    `;

    // Title
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

    // Domain
    const domainEl = doc.createElement('div');
    domainEl.textContent = domain;
    domainEl.style.cssText = `
      font-size: 12px;
      color: #888;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    // Path
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

    // Preview button (fixed width instead of flex)
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
      align-items: center;
      justify-content: center;
      font-size: 24px;
      transition: all 0.2s;
    `;
    previewBtn.innerHTML = '👁';
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

    // Assemble container
    container.appendChild(mainLink);
    container.appendChild(previewBtn);

    // Lift + border on hover (background handled by applyCardBackground)
    container.addEventListener('mouseenter', () => {
      container.style.borderColor = isDefault ? '#555' : '#444';
      container.style.transform = 'translateY(-2px)';
    });

    container.addEventListener('mouseleave', () => {
      container.style.borderColor = isDefault ? '#444' : '#333';
      container.style.transform = 'translateY(0)';
    });

    // Main link click closes launcher
    mainLink.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });

    return container;
  }

  /**
   * Collapse the preview pane and clear the loaded URL.
   */
  _hidePreview() {
    if (this._previewBridgeTimer) {
      clearInterval(this._previewBridgeTimer);
      this._previewBridgeTimer = null;
    }
    if (this._previewArea) {
      this._previewArea.style.width = '0';
    }
    this._currentPreviewUrl = null;
    if (this._previewIframe) {
      this._previewIframe.src = 'about:blank';
      this._previewIframe.onload = null;
      this._previewIframe.onerror = null;
    }
    if (this._previewError) {
      this._previewError.style.display = 'none';
    }
  }

  /**
   * Show preview iframe with URL using advanced bridge system.
   * Clicking preview again for the same URL collapses the pane.
   */
  _showPreview(url) {
    if (!this._previewArea || !this._previewIframe) return;

    // Toggle closed when the same URL is already loaded in the preview pane.
    if (
      url &&
      this._currentPreviewUrl === url &&
      this._previewArea.style.width &&
      this._previewArea.style.width !== '0' &&
      this._previewArea.style.width !== '0px'
    ) {
      this._hidePreview();
      return;
    }

    // Prevent CSP violation by blocking file:// URLs
    if (url && url.startsWith('file://')) {
      console.warn('[LauncherPopover] Cannot preview file:// URLs due to CSP restrictions');
      this._showPreviewError('Cannot preview local files');
      return;
    }

    // Track current preview URL for error recovery
    this._currentPreviewUrl = url;

    this._previewArea.style.width = '40%';
    this._previewIframe.style.display = 'flex';
    if (this._previewError) {
      this._previewError.style.display = 'none';
    }

    // Clear any existing bridge initialization
    if (this._previewBridgeTimer) {
      clearInterval(this._previewBridgeTimer);
      this._previewBridgeTimer = null;
    }

    // Initialize the iframe bridge (content script running inside the iframe)
    // We retry a few times because content scripts in the frame may not be ready immediately
    const sendBridgeInit = () => {
      try {
        this._previewIframe.contentWindow?.postMessage({ type: 'KP_POPOVER_BRIDGE_INIT' }, '*');
      } catch {
        // Ignore
      }
    };

    // Handle iframe load errors.
    // Note: X-Frame-Options / CSP frame-ancestors are stripped by declarativeNetRequest
    // (rules.json) — same strategy as Link Preview. Only surface real load failures.
    this._previewIframe.onerror = () => {
      console.log('[LauncherPopover] Preview iframe load error detected');
      this._showPreviewError();
    };

    // Handle successful iframe load
    this._previewIframe.onload = () => {
      console.log('[LauncherPopover] Preview iframe loaded successfully');
      sendBridgeInit();
    };

    // Set the URL to start loading
    this._previewIframe.src = url;

    // Send initial bridge init attempt
    sendBridgeInit();

    // Short retry window to cover slow frames / initial about:blank then navigation
    try {
      let attemptsLeft = 6; // ~1.5s total
      this._previewBridgeTimer = setInterval(() => {
        if (attemptsLeft <= 0 || !this._previewIframe || !this._isOpen) {
          if (this._previewBridgeTimer) {
            clearInterval(this._previewBridgeTimer);
            this._previewBridgeTimer = null;
          }
          return;
        }
        attemptsLeft -= 1;
        sendBridgeInit();
      }, 250);
    } catch {
      // Ignore
    }
  }

  /**
   * Show preview error message
   */
  _showPreviewError(message = null) {
    if (!this._previewArea) return;

    this._previewArea.style.width = '40%';
    this._previewIframe.style.display = 'none';
    this._previewError.style.display = 'flex';

    if (message) {
      this._errorMessage.textContent = message;
    } else {
      this._errorMessage.textContent = 'This website prevents embedding in iframes for security reasons.';
    }
  }

  /**
   * Scroll to previous sheet
   */
  _scrollUp() {
    if (this._pageResults[this._currentCategory]?.url) return;
    if (this._currentSheet > 0) {
      this._currentSheet--;
      this._renderCategory(this._currentCategory);
    }
  }

  /**
   * Scroll to next sheet
   */
  _scrollDown() {
    if (this._pageResults[this._currentCategory]?.url) return;
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
      const newCategory = this._categoryOrder[currentIndex - 1];
      this._currentCategory = newCategory;
      this._currentSheet = 0;
      this._updateContentHeader(newCategory);
      this._updateSubTabsUI(); // Rebuild sub-tabs for new category
      this._updateHeaderPageSearch(newCategory);
      this._renderCategory(newCategory);
      this._updateTabStyles();
      this._updateSubTabStyles();
      void this._ensureCategoryHistory(newCategory);
    }
  }

  /**
   * Navigate to next category tab
   */
  _navigateToNextTab() {
    const currentIndex = this._categoryOrder.indexOf(this._currentCategory);
    if (currentIndex < this._categoryOrder.length - 1) {
      const newCategory = this._categoryOrder[currentIndex + 1];
      this._currentCategory = newCategory;
      this._currentSheet = 0;
      this._updateContentHeader(newCategory);
      this._updateSubTabsUI(); // Rebuild sub-tabs for new category
      this._updateHeaderPageSearch(newCategory);
      this._renderCategory(newCategory);
      this._updateTabStyles();
      this._updateSubTabStyles();
      void this._ensureCategoryHistory(newCategory);
    }
  }

  /**
   * Handle keyboard events (C/V for scrolling, Arrow keys for tab navigation, Esc to close)
   */
  handleKeyDown(e) {
    if (!this._isOpen) return false;

    const key = e.key.toLowerCase();

    // Always allow Escape to close
    if (key === 'escape') {
      e.preventDefault();
      e.stopPropagation();
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
