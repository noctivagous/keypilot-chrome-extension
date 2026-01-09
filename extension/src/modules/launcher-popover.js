/**
 * LauncherPopover
 *
 * A popover that provides quick access to websites organized in categories.
 * Features a tab list on the left for categories (social media, news, etc.)
 * and a grid of website items on the right. Supports V/C key scrolling through
 * sheets of grid items.
 */

import { PopupManager } from './popup-manager.js';
import { createUrlListingContainer, renderUrlListing, getExtensionFaviconUrl } from '../ui/url-listing.js';

export class LauncherPopover {
  constructor(keypilot) {
    this._keypilot = keypilot;
    this._container = null;
    this._tabListContainer = null;
    this._gridContainer = null;
    this._searchInput = null;
    this._currentCategory = 'favorites';
    this._categorySubTabs = {}; // Store per-category sub-tab selection
    this._currentSheet = 0;
    this._itemsPerSheet = 60; // Increased from 12 to 60 items per page
    this._categories = null;
    this._isOpen = false;
    this._searchQuery = '';
    this._categoryOrder = ['favorites', 'bookmarks', 'history', 'social', 'news', 'productivity', 'videos', 'entertainment', 'shopping', 'ai', 'archive', 'searches'];
    this._showDefaultSites = true; // Checkbox state for showing default sites (only affects favorites tab)

    // Define available sub-tabs for each category (extensible for future types)
    // Order matters: first in array is the default if history is empty
    this._categorySubTabConfig = {
      favorites: ['favorites', 'history'],
      bookmarks: ['favorites', 'history'],
      history: ['favorites', 'history'],
      social: ['favorites', 'history'],
      news: ['favorites', 'history'],
      productivity: ['favorites', 'history'],
      videos: ['favorites', 'history'],
      entertainment: ['favorites', 'history'],
      shopping: ['favorites', 'history'],
      ai: ['favorites', 'history'],
      archive: ['favorites', 'history'],
      searches: ['favorites', 'history']
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
        { title: 'YouTube', url: 'https://youtube.com', isDefault: true },
        { title: 'Rumble', url: 'https://rumble.com', isDefault: true },
        { title: 'Twitch', url: 'https://twitch.tv', isDefault: true },
        { title: 'Vimeo', url: 'https://vimeo.com', isDefault: true },
        { title: 'Dailymotion', url: 'https://dailymotion.com', isDefault: true },
        { title: 'Odysee', url: 'https://odysee.com', isDefault: true }
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
        { title: 'Wayback Machine', url: 'https://web.archive.org', isDefault: true }
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
      searches: [
        { title: 'Google', url: 'https://google.com', isDefault: true },
        { title: 'Bing', url: 'https://bing.com', isDefault: true },
        { title: 'DuckDuckGo', url: 'https://duckduckgo.com', isDefault: true },
        { title: 'Yahoo', url: 'https://yahoo.com', isDefault: true },
        { title: 'Brave Search', url: 'https://search.brave.com', isDefault: true },
        { title: 'Ecosia', url: 'https://ecosia.org', isDefault: true },
        { title: 'Startpage', url: 'https://startpage.com', isDefault: true },
        { title: 'Yandex', url: 'https://yandex.com', isDefault: true }
      ]
    };
  }

  /**
   * Show the launcher popover
   */
  async show() {
    if (this._isOpen) return;
    this._isOpen = true;

    // Fetch bookmarks and history data
    await this._loadCategories();

    // Build the UI
    this._buildUI();

    // Show via PopupManager
    this._keypilot.overlayManager?.popupManager?.showModal({
      id: 'launcher-popover',
      panel: this._container,
      onRequestClose: () => this.hide()
    });

    // Render initial category
    this._renderCategory(this._currentCategory);
  }

  /**
   * Show the launcher popover with search input focused
   */
  async showWithSearchFocus() {
    await this.show();

    // Focus search input after a brief delay
    setTimeout(() => {
      if (this._searchInput && this._isOpen) {
        this._searchInput.focus();
      }
    }, 100);
  }

  /**
   * Hide the launcher popover
   */
  hide() {
    if (!this._isOpen) return;
    this._isOpen = false;

    // Clear any pending bridge initialization
    if (this._previewBridgeTimer) {
      clearInterval(this._previewBridgeTimer);
      this._previewBridgeTimer = null;
    }

    this._keypilot.overlayManager?.popupManager?.hideModal('launcher-popover');

    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }

    this._container = null;
    this._tabListContainer = null;
    this._gridContainer = null;
    this._searchInput = null;
    this._clearBtn = null;
    this._previewArea = null;
    this._previewIframe = null;
    this._currentSheet = 0;
    this._searchQuery = '';
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
    return this._defaultSites[categoryKey].map(site => {
      try {
        const url = new URL(site.url);
        return url.hostname.replace('www.', '');
      } catch (e) {
        return '';
      }
    }).filter(domain => domain !== '');
  }

  /**
   * Load categories and their items from Chrome APIs
   */
  async _loadCategories() {
    try {
      // Get bookmarks via message passing to background script
      let bookmarks = [];
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'KP_GET_BOOKMARKS'
        });

        if (response && response.success && response.bookmarks) {
          bookmarks = response.bookmarks;
        } else {
          console.warn('[LauncherPopover] Failed to get bookmarks:', response?.error);
        }
      } catch (error) {
        console.warn('[LauncherPopover] Bookmarks message failed:', error);
      }

      // Get top sites from history
      const topSites = await this._getTopSites();

      // Get recent searches
      const recentSearches = await this._getRecentSearches();

      // Build categories with history and favorites sub-tabs
      // History is searched specifically for default site domains
      // Favorites only shows default sites if checkbox is enabled
      const socialHistory = await this._getHistoryForDomains(this._getDefaultDomains('social'));
      const newsHistory = await this._getHistoryForDomains(this._getDefaultDomains('news'));
      const productivityHistory = await this._getHistoryForDomains(this._getDefaultDomains('productivity'));
      const videosHistory = await this._getHistoryForDomains(this._getDefaultDomains('videos'));
      const entertainmentHistory = await this._getHistoryForDomains(this._getDefaultDomains('entertainment'));
      const shoppingHistory = await this._getHistoryForDomains(this._getDefaultDomains('shopping'));
      const archiveHistory = await this._getHistoryForDomains(this._getDefaultDomains('archive'));
      const aiHistory = await this._getHistoryForDomains(this._getDefaultDomains('ai'));

      this._categories = {
        favorites: {
          label: 'Favorites',
          icon: '⭐',
          history: [...bookmarks.slice(0, 10), ...topSites.slice(0, 10)],
          favorites: []
        },
        bookmarks: {
          label: 'Bookmarks',
          icon: '📑',
          history: bookmarks,
          favorites: []
        },
        history: {
          label: 'Recent',
          icon: '🕐',
          history: topSites,
          favorites: []
        },
        social: {
          label: 'Social Media',
          icon: '💬',
          history: socialHistory,
          favorites: this._showDefaultSites ? [...this._defaultSites.social] : []
        },
        news: {
          label: 'News',
          icon: '📰',
          history: newsHistory,
          favorites: this._showDefaultSites ? [...this._defaultSites.news] : []
        },
        productivity: {
          label: 'Productivity',
          icon: '⚡',
          history: productivityHistory,
          favorites: this._showDefaultSites ? [...this._defaultSites.productivity] : []
        },
        videos: {
          label: 'Videos',
          icon: '📹',
          history: videosHistory,
          favorites: this._showDefaultSites ? [...this._defaultSites.videos] : []
        },
        entertainment: {
          label: 'Entertainment',
          icon: '🎬',
          history: entertainmentHistory,
          favorites: this._showDefaultSites ? [...this._defaultSites.entertainment] : []
        },
        shopping: {
          label: 'Shopping',
          icon: '🛒',
          history: shoppingHistory,
          favorites: this._showDefaultSites ? [...this._defaultSites.shopping] : []
        },
        ai: {
          label: 'AI',
          icon: '🤖',
          history: aiHistory,
          favorites: this._showDefaultSites ? [...this._defaultSites.ai] : []
        },
        archive: {
          label: 'Internet Archive',
          icon: '📚',
          history: archiveHistory,
          favorites: this._showDefaultSites ? [...this._defaultSites.archive] : []
        },
        searches: {
          label: 'Searches',
          icon: '🔍',
          history: recentSearches,
          favorites: this._showDefaultSites ? [...this._defaultSites.searches] : []
        }
      };

      // Initialize default sub-tab selection for each category
      // Use first sub-tab in config (usually 'favorites') if history count is 0,
      // otherwise use second sub-tab (usually 'history')
      for (const categoryKey in this._categories) {
        if (!this._categorySubTabs[categoryKey]) {
          const subTabConfig = this._categorySubTabConfig[categoryKey] || ['favorites', 'history'];
          const historyCount = this._categories[categoryKey].history?.length || 0;
          const favoritesCount = this._categories[categoryKey].favorites?.length || 0;

          // Default to favorites (first in config) if it has items, otherwise history if it has items,
          // otherwise just use first sub-tab
          if (favoritesCount > 0) {
            this._categorySubTabs[categoryKey] = subTabConfig[0];
          } else if (historyCount > 0) {
            this._categorySubTabs[categoryKey] = subTabConfig[1] || subTabConfig[0];
          } else {
            this._categorySubTabs[categoryKey] = subTabConfig[0];
          }
        }
      }
    } catch (error) {
      console.error('[LauncherPopover] Error loading categories:', error);
      this._categories = {
        favorites: { label: 'Favorites', icon: '⭐', history: [], favorites: [] }
      };
    }
  }

  /**
   * Get top visited sites from history via message passing
   */
  async _getTopSites() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'KP_GET_TOP_SITES',
        maxResults: 1000,
        days: 30
      });

      if (response && response.success && response.topSites) {
        return response.topSites;
      } else {
        console.warn('[LauncherPopover] Failed to get top sites:', response?.error);
        return [];
      }
    } catch (error) {
      console.error('[LauncherPopover] Error getting top sites:', error);
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
      } else {
        console.warn('[LauncherPopover] Failed to get history for domains:', response?.error);
        return [];
      }
    } catch (error) {
      console.error('[LauncherPopover] Error getting history for domains:', error);
      return [];
    }
  }

  /**
   * Get recent search queries from history via message passing
   */
  async _getRecentSearches() {
    try {
      // Get recent history from background script
      const response = await chrome.runtime.sendMessage({
        type: 'KP_GET_TOP_SITES',
        maxResults: 1000,
        days: 7
      });

      if (!response || !response.success || !response.topSites) {
        console.warn('[LauncherPopover] Failed to get history for searches:', response?.error);
        return [];
      }

      // Extract search queries from common search engines
      const searches = [];
      const seenQueries = new Set();

      for (const item of response.topSites) {
        if (item.url) {
          try {
            const url = new URL(item.url);
            let query = null;

            // Google search
            if (url.hostname.includes('google.com') && url.pathname === '/search') {
              query = url.searchParams.get('q');
            }
            // Bing search
            else if (url.hostname.includes('bing.com') && url.pathname === '/search') {
              query = url.searchParams.get('q');
            }
            // DuckDuckGo search
            else if (url.hostname.includes('duckduckgo.com')) {
              query = url.searchParams.get('q');
            }
            // Yahoo search
            else if (url.hostname.includes('yahoo.com') && url.pathname === '/search') {
              query = url.searchParams.get('p');
            }

            if (query && !seenQueries.has(query)) {
              seenQueries.add(query);
              searches.push({
                title: query,
                url: item.url
              });
            }
          } catch (e) {
            // Skip invalid URLs
          }
        }
      }

      return searches.slice(0, 50); // Return top 50 searches
    } catch (error) {
      console.error('[LauncherPopover] Error getting recent searches:', error);
      return [];
    }
  }

  /**
   * Filter items by matching domains
   */
  _filterByDomains(items, domains) {
    return items.filter(item => {
      try {
        const itemDomain = new URL(item.url).hostname.replace('www.', '');
        return domains.some(domain => itemDomain === domain || itemDomain.endsWith('.' + domain));
      } catch (e) {
        return false;
      }
    });
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
   * Build the launcher UI
   */
  _buildUI() {
    const doc = document;

    // Main container
    this._container = doc.createElement('div');
    this._container.className = 'kp-launcher-container';
    this._container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) translateZ(0);
      width: 80vw;
      max-width: 1400px;
      height: 80vh;
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
      -webkit-transform: translate(-50%, -50%) translateZ(0);
    `;

    // Left sidebar (tab list)
    const sidebar = doc.createElement('div');
    sidebar.className = 'kp-launcher-sidebar';
    sidebar.style.cssText = `
      width: 200px;
      background: #0f0f0f;
      border-right: 1px solid #333;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    `;

    // Tab list
    this._tabListContainer = doc.createElement('div');
    this._tabListContainer.className = 'kp-launcher-tabs';
    this._tabListContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      padding: 12px 0;
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
      this._loadCategories().then(() => {
        this._renderCategory(this._currentCategory);
      });
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

    // Header
    const header = doc.createElement('div');
    header.className = 'kp-launcher-header';
    header.style.cssText = `
      padding: 20px 24px;
      border-bottom: 1px solid #333;
      background: #0f0f0f;
    `;

    const title = doc.createElement('h2');
    title.className = 'kp-launcher-title';
    title.textContent = 'Launcher';
    title.style.cssText = `
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #fff;
    `;

    const subtitle = doc.createElement('p');
    subtitle.className = 'kp-launcher-subtitle';
    subtitle.textContent = 'Quick access to your favorite sites';
    subtitle.style.cssText = `
      margin: 4px 0 0 0;
      font-size: 14px;
      color: #888;
    `;

    // Search input container
    const searchContainer = doc.createElement('div');
    searchContainer.className = 'kp-launcher-search-container';
    searchContainer.style.cssText = `
      margin-top: 16px;
      position: relative;
    `;

    // Search input
    this._searchInput = doc.createElement('input');
    this._searchInput.type = 'text';
    this._searchInput.placeholder = 'Search sites...';
    this._searchInput.className = 'kp-launcher-search-input';
    this._searchInput.style.cssText = `
      width: 100%;
      padding: 10px 36px 10px 12px;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 6px;
      color: #fff;
      font-size: 14px;
      outline: none;
      transition: all 0.2s;
    `;

    // Search input event listeners
    this._searchInput.addEventListener('input', (e) => {
      this._searchQuery = e.target.value.toLowerCase().trim();
      this._currentSheet = 0;
      this._renderCategory(this._currentCategory);
    });

    this._searchInput.addEventListener('focus', () => {
      this._searchInput.style.borderColor = '#666';
      this._searchInput.style.background = '#333';
    });

    this._searchInput.addEventListener('blur', () => {
      this._searchInput.style.borderColor = '#444';
      this._searchInput.style.background = '#2a2a2a';
    });

    // Clear button
    const clearBtn = doc.createElement('button');
    clearBtn.textContent = '×';
    clearBtn.className = 'kp-launcher-search-clear';
    clearBtn.style.cssText = `
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      color: #888;
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
      display: ${this._searchQuery ? 'block' : 'none'};
      transition: color 0.2s;
    `;

    clearBtn.addEventListener('click', () => {
      this._searchQuery = '';
      this._searchInput.value = '';
      this._currentSheet = 0;
      clearBtn.style.display = 'none';
      this._renderCategory(this._currentCategory);
      this._searchInput.focus();
    });

    clearBtn.addEventListener('mouseenter', () => {
      clearBtn.style.color = '#fff';
    });

    clearBtn.addEventListener('mouseleave', () => {
      clearBtn.style.color = '#888';
    });

    // Store clear button reference for showing/hiding
    this._clearBtn = clearBtn;

    // Update search input listener to show/hide clear button
    this._searchInput.addEventListener('input', (e) => {
      this._searchQuery = e.target.value.toLowerCase().trim();
      this._currentSheet = 0;
      this._clearBtn.style.display = this._searchQuery ? 'block' : 'none';
      this._renderCategory(this._currentCategory);
    });

    searchContainer.appendChild(this._searchInput);
    searchContainer.appendChild(clearBtn);

    header.appendChild(title);
    header.appendChild(subtitle);
    header.appendChild(searchContainer);

    // Sub-tabs container (dynamically populated based on category config)
    this._subTabContainer = doc.createElement('div');
    this._subTabContainer.className = 'kp-launcher-subtabs';
    this._subTabContainer.style.cssText = `
      display: flex;
      gap: 8px;
      padding: 16px 24px 0;
      border-bottom: 1px solid #333;
      background: #0f0f0f;
    `;

    // Sub-tabs will be populated dynamically when category changes
    this._updateSubTabsUI();

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
      padding: 12px 16px;
      border-bottom: 1px solid #333;
      background: #0f0f0f;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const previewTitle = doc.createElement('div');
    previewTitle.className = 'kp-launcher-preview-title';
    previewTitle.textContent = 'Preview';
    previewTitle.style.cssText = `
      color: #fff;
      font-size: 14px;
      font-weight: 500;
    `;

    const previewCloseBtn = doc.createElement('button');
    previewCloseBtn.textContent = '×';
    previewCloseBtn.className = 'kp-launcher-preview-close';
    previewCloseBtn.style.cssText = `
      background: transparent;
      border: none;
      color: #888;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      line-height: 1;
      transition: color 0.2s;
    `;

    previewCloseBtn.addEventListener('click', () => {
      previewArea.style.width = '0';
      if (this._previewIframe) {
        this._previewIframe.src = 'about:blank';
      }
    });

    previewCloseBtn.addEventListener('mouseenter', () => {
      previewCloseBtn.style.color = '#fff';
    });

    previewCloseBtn.addEventListener('mouseleave', () => {
      previewCloseBtn.style.color = '#888';
    });

    previewHeader.appendChild(previewTitle);
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
      background: #4CAF50;
      color: white;
      border: none;
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
    `;

    const icon = doc.createElement('span');
    icon.textContent = category.icon;
    icon.style.fontSize = '18px';

    const label = doc.createElement('span');
    label.textContent = category.label;

    tab.appendChild(icon);
    tab.appendChild(label);

    tab.addEventListener('click', () => {
      this._currentCategory = categoryKey;
      this._currentSheet = 0;
      this._updateSubTabsUI(); // Rebuild sub-tabs for new category
      this._renderCategory(categoryKey);
      this._updateTabStyles();
      this._updateSubTabStyles();
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
   * Create a sub-tab button for history/favorites
   */
  _createSubTab(type, label) {
    const doc = document;
    const subTab = doc.createElement('button');
    subTab.className = 'kp-launcher-subtab';
    subTab.dataset.type = type;

    const currentSubTab = this._categorySubTabs[this._currentCategory] || 'history';
    const isActive = type === currentSubTab;
    subTab.style.cssText = `
      padding: 10px 20px;
      background: ${isActive ? '#2a2a2a' : 'transparent'};
      border: none;
      border-bottom: 2px solid ${isActive ? '#4CAF50' : 'transparent'};
      color: ${isActive ? '#fff' : '#888'};
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    `;

    subTab.textContent = label;

    subTab.addEventListener('click', () => {
      this._categorySubTabs[this._currentCategory] = type;
      this._currentSheet = 0;
      this._renderCategory(this._currentCategory);
      this._updateSubTabStyles();
    });

    subTab.addEventListener('mouseenter', () => {
      const currentSubTab = this._categorySubTabs[this._currentCategory] || 'history';
      if (type !== currentSubTab) {
        subTab.style.color = '#fff';
      }
    });

    subTab.addEventListener('mouseleave', () => {
      const currentSubTab = this._categorySubTabs[this._currentCategory] || 'history';
      if (type !== currentSubTab) {
        subTab.style.color = '#888';
      }
    });

    return subTab;
  }

  /**
   * Update sub-tab styles to reflect active sub-tab
   */
  _updateSubTabStyles() {
    const subTabs = this._subTabContainer.querySelectorAll('.kp-launcher-subtab');
    const currentSubTab = this._categorySubTabs[this._currentCategory] || 'favorites';
    subTabs.forEach(subTab => {
      const isActive = subTab.dataset.type === currentSubTab;
      subTab.style.background = isActive ? '#2a2a2a' : 'transparent';
      subTab.style.borderBottomColor = isActive ? '#4CAF50' : 'transparent';
      subTab.style.color = isActive ? '#fff' : '#888';
    });
  }

  /**
   * Update sub-tabs UI based on current category configuration
   */
  _updateSubTabsUI() {
    if (!this._subTabContainer) return;

    // Clear existing sub-tabs
    this._subTabContainer.innerHTML = '';

    // Get sub-tab configuration for current category
    const subTabConfig = this._categorySubTabConfig[this._currentCategory] || ['favorites', 'history'];

    // Create sub-tabs based on configuration
    const subTabLabels = {
      'favorites': 'Favorites',
      'history': 'History'
      // Future sub-tab types can be added here
    };

    subTabConfig.forEach(subTabType => {
      const label = subTabLabels[subTabType] || subTabType;
      const subTab = this._createSubTab(subTabType, label);
      this._subTabContainer.appendChild(subTab);
    });
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
   * Render a category's items in the grid
   */
  _renderCategory(categoryKey) {
    if (!this._categories || !this._categories[categoryKey]) return;

    const category = this._categories[categoryKey];
    // Get items from the current sub-tab (history or favorites) for this category
    const currentSubTab = this._categorySubTabs[categoryKey] || 'history';
    let items = category[currentSubTab] || [];

    // Filter items based on search query
    if (this._searchQuery) {
      items = items.filter(item => {
        const title = (item.title || '').toLowerCase();
        const url = (item.url || '').toLowerCase();
        return title.includes(this._searchQuery) || url.includes(this._searchQuery);
      });
    }

    // Clear grid
    this._gridContainer.innerHTML = '';

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
    `;

    // Render items
    sheetItems.forEach(item => {
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
      empty.textContent = this._searchQuery ? 'No sites match your search' : 'No items in this category';
      grid.appendChild(empty);
    }

    this._gridContainer.appendChild(grid);
  }

  /**
   * Extract path from URL
   */
  _extractPath(url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname + urlObj.search + urlObj.hash;
      // Return empty string if path is just '/'
      return path === '/' ? '' : path;
    } catch (e) {
      return '';
    }
  }

  /**
   * Extract YouTube video ID from URL
   * Supports formats:
   * - https://www.youtube.com/watch?v=VIDEO_ID
   * - https://youtu.be/VIDEO_ID
   * - https://www.youtube.com/embed/VIDEO_ID
   * - https://www.youtube.com/v/VIDEO_ID
   * @param {string} url
   * @returns {string|null} Video ID or null if not a YouTube video URL
   */
  _extractYouTubeVideoId(url) {
    if (!url || typeof url !== 'string') return null;

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace(/^www\./, '');

      // Check if it's a YouTube domain
      if (!hostname.includes('youtube.com') && !hostname.includes('youtu.be')) {
        return null;
      }

      // Handle youtu.be short URLs: https://youtu.be/VIDEO_ID
      if (hostname.includes('youtu.be')) {
        const videoId = urlObj.pathname.slice(1).split('?')[0].split('&')[0];
        // YouTube video IDs are 11 characters
        if (videoId && videoId.length === 11) {
          return videoId;
        }
        return null;
      }

      // Handle youtube.com URLs
      if (hostname.includes('youtube.com')) {
        // Check for /watch?v=VIDEO_ID format
        if (urlObj.pathname === '/watch' && urlObj.searchParams.has('v')) {
          const videoId = urlObj.searchParams.get('v');
          if (videoId && videoId.length === 11) {
            return videoId;
          }
        }

        // Check for /embed/VIDEO_ID format
        const embedMatch = urlObj.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
        if (embedMatch) {
          return embedMatch[1];
        }

        // Check for /v/VIDEO_ID format
        const vMatch = urlObj.pathname.match(/^\/v\/([a-zA-Z0-9_-]{11})/);
        if (vMatch) {
          return vMatch[1];
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Generate YouTube thumbnail URL
   * @param {string} videoId
   * @param {string} quality - 'default', 'mqdefault', 'hqdefault', 'sddefault', 'maxresdefault'
   * @returns {string} Thumbnail URL
   */
  _getYouTubeThumbnailUrl(videoId, quality = 'hqdefault') {
    if (!videoId || typeof videoId !== 'string') return null;
    const validQualities = ['default', 'mqdefault', 'hqdefault', 'sddefault', 'maxresdefault'];
    const q = validQualities.includes(quality) ? quality : 'hqdefault';
    return `https://img.youtube.com/vi/${videoId}/${q}.jpg`;
  }

  /**
   * Create a grid card for a website
   */
  _createGridCard(item) {
    const doc = document;
    const domain = this._extractDomain(item.url);
    const path = this._extractPath(item.url);
    const isDefault = item.isDefault === true;

    // Check if this is a YouTube video URL and get thumbnail
    const youtubeVideoId = this._extractYouTubeVideoId(item.url);
    const hasYouTubeThumbnail = youtubeVideoId !== null;
    const thumbnailUrl = hasYouTubeThumbnail ? this._getYouTubeThumbnailUrl(youtubeVideoId, 'hqdefault') : null;

    // Container - lighter color for default sites, with optional YouTube thumbnail background
    const container = doc.createElement('div');
    container.className = 'kp-launcher-card-container';
    
    // Build background style - use thumbnail if available, otherwise solid color
    let backgroundStyle = '';
    if (thumbnailUrl) {
      backgroundStyle = `
        background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.85) 100%),
                    url(${thumbnailUrl}) center/cover no-repeat;
      `;
    } else {
      backgroundStyle = `background: ${isDefault ? '#3a3a3a' : '#2a2a2a'};`;
    }

    container.style.cssText = `
      display: flex;
      ${backgroundStyle}
      border: 1px solid ${isDefault ? '#444' : '#333'};
      border-radius: 8px;
      overflow: hidden;
      min-height: 100px;
      transition: all 0.2s;
      position: relative;
    `;

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

    // Favicon
    const favicon = doc.createElement('img');
    favicon.src = getExtensionFaviconUrl(item.url, 32);
    favicon.style.cssText = `
      width: 32px;
      height: 32px;
      margin-bottom: 12px;
      border-radius: 6px;
      flex-shrink: 0;
    `;
    favicon.onerror = () => {
      favicon.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNCIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPgo8L3N2Zz4=';
    };

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
    previewBtn.title = 'Preview in iframe';

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

    // Hover effects for container
    container.addEventListener('mouseenter', () => {
      if (thumbnailUrl) {
        container.style.background = `linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.75) 100%), url(${thumbnailUrl}) center/cover no-repeat`;
      } else {
        container.style.background = isDefault ? '#444' : '#333';
      }
      container.style.borderColor = isDefault ? '#555' : '#444';
      container.style.transform = 'translateY(-2px)';
    });

    container.addEventListener('mouseleave', () => {
      if (thumbnailUrl) {
        container.style.background = `linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.85) 100%), url(${thumbnailUrl}) center/cover no-repeat`;
      } else {
        container.style.background = isDefault ? '#3a3a3a' : '#2a2a2a';
      }
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
   * Show preview iframe with URL using advanced bridge system
   */
  _showPreview(url) {
    if (!this._previewArea || !this._previewIframe) return;

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

    // Handle iframe load errors (X-Frame-Options blocking, network errors, etc.)
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
   * Extract domain from URL
   */
  _extractDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch (e) {
      return url;
    }
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

    const category = this._categories[this._currentCategory];
    const currentSubTab = this._categorySubTabs[this._currentCategory] || 'history';
    const items = category[currentSubTab] || [];
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
      this._updateSubTabsUI(); // Rebuild sub-tabs for new category
      this._renderCategory(newCategory);
      this._updateTabStyles();
      this._updateSubTabStyles();
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
      this._updateSubTabsUI(); // Rebuild sub-tabs for new category
      this._renderCategory(newCategory);
      this._updateTabStyles();
      this._updateSubTabStyles();
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

    // If search input is focused, don't intercept most keys (let user type)
    const isSearchFocused = this._searchInput && document.activeElement === this._searchInput;
    if (isSearchFocused && key !== 'escape') {
      return false;
    }

    // Forward slash focuses search
    if (key === '/' && !isSearchFocused) {
      e.preventDefault();
      e.stopPropagation();
      if (this._searchInput) {
        this._searchInput.focus();
      }
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
