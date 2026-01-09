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
    this._currentSheet = 0;
    this._itemsPerSheet = 12; // 3 rows x 4 cols
    this._categories = null;
    this._isOpen = false;
    this._searchQuery = '';
    this._categoryOrder = ['favorites', 'bookmarks', 'history', 'social', 'news', 'productivity', 'entertainment', 'shopping'];
    // Preview-related properties
    this._previewError = null;
    this._errorTitle = null;
    this._errorMessage = null;
    this._currentPreviewUrl = null;
    this._previewBridgeTimer = null;
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

      // Build categories
      this._categories = {
        favorites: {
          label: 'Favorites',
          icon: '⭐',
          items: [...bookmarks.slice(0, 10), ...topSites.slice(0, 10)]
        },
        bookmarks: {
          label: 'Bookmarks',
          icon: '📑',
          items: bookmarks
        },
        history: {
          label: 'Recent',
          icon: '🕐',
          items: topSites
        },
        social: {
          label: 'Social Media',
          icon: '💬',
          items: this._filterByKeywords(bookmarks, ['twitter', 'facebook', 'instagram', 'reddit', 'linkedin', 'tiktok'])
        },
        news: {
          label: 'News',
          icon: '📰',
          items: this._filterByKeywords(bookmarks, ['news', 'cnn', 'bbc', 'nytimes', 'reuters', 'guardian'])
        },
        productivity: {
          label: 'Productivity',
          icon: '⚡',
          items: this._filterByKeywords(bookmarks, ['gmail', 'calendar', 'drive', 'docs', 'notion', 'slack', 'trello'])
        },
        entertainment: {
          label: 'Entertainment',
          icon: '🎬',
          items: this._filterByKeywords(bookmarks, ['youtube', 'netflix', 'spotify', 'twitch', 'hulu'])
        },
        shopping: {
          label: 'Shopping',
          icon: '🛒',
          items: this._filterByKeywords(bookmarks, ['amazon', 'ebay', 'walmart', 'target', 'shop'])
        }
      };
    } catch (error) {
      console.error('[LauncherPopover] Error loading categories:', error);
      this._categories = {
        favorites: { label: 'Favorites', icon: '⭐', items: [] }
      };
    }
  }

  /**
   * Get top visited sites from history
   */
  async _getTopSites() {
    try {
      const historyItems = await chrome.history.search({
        text: '',
        maxResults: 100,
        startTime: Date.now() - (30 * 24 * 60 * 60 * 1000) // Last 30 days
      });

      // Count visits by domain
      const domainCounts = new Map();
      for (const item of historyItems) {
        if (item.url && item.visitCount) {
          try {
            const domain = new URL(item.url).hostname;
            const existing = domainCounts.get(domain) || { count: 0, title: item.title, url: item.url };
            existing.count += item.visitCount;
            domainCounts.set(domain, existing);
          } catch (e) {
            // Skip invalid URLs
          }
        }
      }

      // Sort by visit count and return top 50
      return Array.from(domainCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 50)
        .map(item => ({ title: item.title, url: item.url }));
    } catch (error) {
      console.error('[LauncherPopover] Error getting top sites:', error);
      return [];
    }
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
      this._renderCategory(categoryKey);
      this._updateTabStyles();
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
    let items = category.items;

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
   * Create a grid card for a website
   */
  _createGridCard(item) {
    const doc = document;
    const domain = this._extractDomain(item.url);

    // Container
    const container = doc.createElement('div');
    container.className = 'kp-launcher-card-container';
    container.style.cssText = `
      display: flex;
      background: #2a2a2a;
      border: 1px solid #333;
      border-radius: 8px;
      overflow: hidden;
      min-height: 100px;
      transition: all 0.2s;
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

    // URL
    const url = doc.createElement('div');
    url.textContent = domain;
    url.style.cssText = `
      font-size: 12px;
      color: #888;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    mainLink.appendChild(favicon);
    mainLink.appendChild(title);
    mainLink.appendChild(url);

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
      container.style.background = '#333';
      container.style.borderColor = '#444';
      container.style.transform = 'translateY(-2px)';
    });

    container.addEventListener('mouseleave', () => {
      container.style.background = '#2a2a2a';
      container.style.borderColor = '#333';
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
    const maxSheets = Math.ceil(category.items.length / this._itemsPerSheet);

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
      this._renderCategory(newCategory);
      this._updateTabStyles();
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
      this._renderCategory(newCategory);
      this._updateTabStyles();
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
