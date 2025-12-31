import { buildSearchUrl, getEngineHomeUrl, getSettings, normalizeSearchEngine, SETTINGS_STORAGE_KEY } from '../src/modules/settings-manager.js';
import { KeyPilot } from '../src/keypilot.js';
import { KeyPilotToggleHandler } from '../src/modules/keypilot-toggle-handler.js';
import { OnboardingManager } from '../src/modules/onboarding-manager.js';
import { getExtensionFaviconUrl, renderUrlListing } from '../src/ui/url-listing.js';
import '../src/vendor/rbush.js';

let currentEngine = 'brave';
const KP_ENABLED_STORAGE_KEY = 'keypilot_enabled';

function parseUrlForThreeLineDisplay(rawUrl) {
  const input = String(rawUrl || '').trim();
  if (!input) return { domain: '', path: '' };

  try {
    const u = new URL(input, 'https://example.invalid');
    const scheme = (u.protocol || '').replace(/:$/, '');
    const host = (u.hostname || '') + (u.port ? `:${u.port}` : '');

    // Domain line: prefer host if present; otherwise fall back to scheme.
    const domain = host || scheme || input;

    // Path line: everything after the domain: pathname + search + hash.
    // Keep '/' for empty paths so the third line isn't blank for homepages.
    const pathname = u.pathname || '';
    const rest = `${pathname || ''}${u.search || ''}${u.hash || ''}`;
    const path = rest || (host ? '/' : '');

    return { domain, path };
  } catch {
    // Very defensive fallback: attempt split on first slash after scheme.
    const m = input.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^\/?#]+)([^\s]*)?$/);
    if (m) {
      const domain = m[1] || input;
      const path = m[2] || '/';
      return { domain, path };
    }
    return { domain: input, path: '' };
  }
}

function renderThreeLineUrlListingEntry({ item, parts }) {
  const url = String(item?.url || '').trim();
  const title = String(item?.title || '').trim();
  const { domain, path } = parseUrlForThreeLineDisplay(url);

  // Order requirement:
  // 1) domain
  // 2) page title
  // 3) path
  parts.titleEl.textContent = domain || url || '';
  parts.metaEl.textContent = title;
  parts.urlEl.textContent = path;
}

function toUrlOrSearch(text) {
  const t = String(text || '').trim();
  if (!t) return getEngineHomeUrl(currentEngine);

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(t)) return t;

  const looksLikeHost =
    /(^localhost\b)/i.test(t) ||
    /(^\d{1,3}(\.\d{1,3}){3}\b)/.test(t) ||
    /([a-zA-Z0-9-]+\.[a-zA-Z]{2,})([\/:?#]|$)/.test(t);

  if (looksLikeHost) return `https://${t}`;

  return buildSearchUrl(currentEngine, t);
}

async function refreshEngineLabel() {
  try {
    const settings = await getSettings();
    currentEngine = normalizeSearchEngine(settings?.searchEngine);
  } catch {
    currentEngine = 'brave';
  }

  const label = document.getElementById('engine-label');
  if (label) {
    const pretty = currentEngine === 'duckduckgo' ? 'DuckDuckGo' : (currentEngine[0].toUpperCase() + currentEngine.slice(1));
    label.textContent = `Engine: ${pretty}`;
  }
}

function navigate(url) {
  try {
    window.location.assign(url);
  } catch {
    window.location.href = url;
  }
}

/**
 * @param {any} target
 */
function isTypingTarget(target) {
  const el = target;
  const tag = el?.tagName?.toLowerCase?.();
  if (tag !== 'input' && tag !== 'textarea') return false;
  if (tag === 'textarea') return true;
  const type = String(el.getAttribute?.('type') || el.type || 'text').toLowerCase();
  return type === 'text' || type === 'search' || type === 'url' || type === 'email' || type === 'tel' || type === 'password' || type === 'number';
}

function createModal({ title, hintKeyLabel, closeKeys, url, width, height }) {
  const root = document.getElementById('modal-root');
  if (!root) return null;

  root.hidden = false;
  root.textContent = '';

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const container = document.createElement('div');
  container.className = 'modal-container';

  // Apply custom dimensions if provided
  if (width) container.style.width = width;
  if (height) container.style.height = height;

  const hint = document.createElement('div');
  hint.className = 'modal-hint';
  hint.textContent = `Press ${hintKeyLabel} / Esc to close. Use Z/X/C/V/B/N to scroll.`;

  const header = document.createElement('div');
  header.className = 'modal-header';

  const titleEl = document.createElement('div');
  titleEl.className = 'modal-title';
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.type = 'button';
  closeBtn.title = 'Close (Esc)';
  closeBtn.textContent = '×';

  const iframe = document.createElement('iframe');
  iframe.className = 'modal-iframe';
  iframe.src = url;
  iframe.tabIndex = 0;

  const requestClose = () => {
    root.hidden = true;
    root.textContent = '';
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('message', onMessage, true);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      requestClose();
      return;
    }
  };

  const onMessage = (event) => {
    const data = event?.data;
    if (!data || typeof data.type !== 'string') return;
    if (iframe.contentWindow && event.source !== iframe.contentWindow) return;

    if (data.type === 'KP_POPOVER_BRIDGE_READY') {
      try { iframe.focus(); } catch { /* ignore */ }
      try { iframe.contentWindow?.focus?.(); } catch { /* ignore */ }
      return;
    }

    if (data.type === 'KP_POPOVER_REQUEST_CLOSE') {
      if (closeKeys.includes(String(data.key))) requestClose();
    }
  };

  closeBtn.addEventListener('click', requestClose, true);
  backdrop.addEventListener('click', requestClose, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('message', onMessage, true);

  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  container.appendChild(hint);
  container.appendChild(header);
  container.appendChild(iframe);
  root.appendChild(backdrop);
  root.appendChild(container);

  // Kick off bridge init so Esc/quote etc works when the iframe has focus.
  const sendInit = () => {
    try {
      iframe.contentWindow?.postMessage({ type: 'KP_POPOVER_BRIDGE_INIT' }, '*');
    } catch {
      // ignore
    }
  };
  sendInit();
  try {
    let attemptsLeft = 6;
    const t = setInterval(() => {
      attemptsLeft -= 1;
      if (attemptsLeft <= 0) return clearInterval(t);
      sendInit();
    }, 250);
  } catch {
    // ignore
  }

  return { close: requestClose };
}

function createSuggestionsController({ inputEl, rootEl }) {
  /** @type {Array<{title: string, url: string, source: string}>} */
  let suggestions = [];
  let selectedIndex = -1;
  let userNavigatedList = false;
  let debounceTimer = null;
  let lastQuery = '';

  const clearDebounce = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const hide = () => {
    suggestions = [];
    selectedIndex = -1;
    userNavigatedList = false;
    rootEl.hidden = true;
    rootEl.textContent = '';
  };

  const render = () => {
    rootEl.textContent = '';
    if (!suggestions.length) {
      rootEl.hidden = true;
      return;
    }
    rootEl.hidden = false;

    renderUrlListing({
      container: rootEl,
      items: suggestions,
      view: 'list',
      useInlineStyles: false,
      classNames: {
        row: 'suggestion-row',
        rowSelected: 'selected',
        content: 'kp-url-content',
        text: 'kp-url-text',
        title: 'kp-url-domain',
        meta: 'kp-url-title',
        url: 'kp-url-path',
        favicon: 'kp-url-favicon'
      },
      getTitle: (s) => s.title || s.url,
      getUrl: (s) => s.url,
      showFavicon: true,
      showMetaLine: true,
      showUrlLine: true,
      selectedIndex,
      decorateRow: ({ row, item, idx, parts }) => {
        row.dataset.kpSuggestionIndex = String(idx);
        renderThreeLineUrlListingEntry({ item, parts });
      },
      onRowMouseEnter: ({ idx }) => {
        selectedIndex = idx;
        render();
      },
      onRowMouseDown: ({ event }) => {
        // prevent input blur
        event.preventDefault();
      },
      onRowClick: ({ item, event }) => {
        event.preventDefault();
        const target = item.url || (inputEl.value || '').trim();
        hide();
        navigate(toUrlOrSearch(target));
      }
    });
  };

  const fetchSuggestions = async (query) => {
    try {
      if (!chrome?.runtime?.sendMessage) return [];
      const resp = await chrome.runtime.sendMessage({
        type: 'KP_OMNIBOX_SUGGEST',
        query,
        maxResults: 12
      });
      if (resp && resp.type === 'KP_OMNIBOX_SUGGESTIONS' && Array.isArray(resp.suggestions)) {
        return resp.suggestions
          .filter((s) => s && typeof s.url === 'string' && s.url.trim())
          .slice(0, 12);
      }
    } catch {
      // ignore
    }
    return [];
  };

  const schedule = () => {
    clearDebounce();
    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      const q = (inputEl.value || '').trim();
      lastQuery = q;
      const next = await fetchSuggestions(q);
      // stale guard
      if ((inputEl.value || '').trim() !== lastQuery) return;
      suggestions = next;
      // Default selection: nothing selected. User must press ArrowDown (or hover/click)
      // to move into the list.
      selectedIndex = -1;
      userNavigatedList = false;
      render();
    }, 90);
  };

  const moveSelection = (delta) => {
    const count = suggestions.length;
    if (!count) {
      selectedIndex = -1;
      render();
      return;
    }
    // Omnibox-like behavior: ArrowUp from the first row returns to the input (clears selection).
    let next = selectedIndex;
    if (delta < 0 && next === 0) {
      next = -1;
    } else if (next === -1) {
      next = delta > 0 ? 0 : -1;
    } else {
      next = (next + delta + count) % count;
    }
    selectedIndex = next;
    render();
  };

  const commit = () => {
    const raw = (inputEl.value || '').trim();
    const selected = selectedIndex >= 0 ? suggestions[selectedIndex] : null;
    const allowSelected =
      selectedIndex >= 0 &&
      (userNavigatedList || selected?.source === 'domain');
    const target = allowSelected && selected?.url ? selected.url : raw;
    hide();
    navigate(toUrlOrSearch(target));
  };

  inputEl.addEventListener('input', () => schedule(), { capture: true });
  inputEl.addEventListener('focus', () => schedule(), { capture: true });
  inputEl.addEventListener('blur', () => {
    // Give click handlers a chance.
    setTimeout(() => hide(), 120);
  }, { capture: true });

  inputEl.addEventListener('keydown', (e) => {
    if (!isTypingTarget(e.target)) return;

    if (e.key === 'Escape') {
      e.stopPropagation();
      e.stopImmediatePropagation();
      hide();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      userNavigatedList = true;
      moveSelection(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      commit();
      return;
    }
  }, { capture: true });

  return { hide };
}

async function renderBookmarks() {
  const list = document.getElementById('bookmark-list');
  const empty = document.getElementById('bookmark-empty');
  if (!list || !empty) return;

  list.textContent = '';

  /** @type {Array<chrome.bookmarks.BookmarkTreeNode>} */
  let nodes = [];
  try {
    if (chrome.bookmarks?.getRecent) {
      nodes = await chrome.bookmarks.getRecent(10);
    }
  } catch {
    nodes = [];
  }

  const bookmarks = (nodes || []).filter((n) => n && n.url);
  if (!bookmarks.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  renderUrlListing({
    container: list,
    items: bookmarks,
    view: 'list',
    useInlineStyles: false,
    rowTag: 'li',
    classNames: {
      row: 'kp-url-row',
      content: 'kp-url-content',
      text: 'kp-url-text',
      title: 'kp-url-domain',
      meta: 'kp-url-title',
      url: 'kp-url-path',
      favicon: 'kp-url-favicon'
    },
    getTitle: (b) => b.title || b.url,
    getUrl: (b) => b.url,
    showFavicon: true,
    showMetaLine: true,
    showUrlLine: true,
    decorateRow: ({ item, parts }) => renderThreeLineUrlListingEntry({ item, parts }),
    onRowClick: ({ item, event }) => {
      event.preventDefault();
      navigate(item.url);
    }
  });
}

async function renderToolbarBookmarks() {
  const root = document.getElementById('toolbar-bookmarks');
  const empty = document.getElementById('toolbar-empty');
  const section = document.getElementById('toolbar-bookmarks-section');
  if (!root || !empty || !section) return;

  root.textContent = '';

  /** @type {Array<chrome.bookmarks.BookmarkTreeNode>} */
  let items = [];
  try {
    items = await chrome.bookmarks.getChildren('1'); // Bookmarks bar
  } catch {
    items = [];
  }

  // Filter to only include bookmarks with URLs (exclude folders)
  const bookmarks = (items || []).filter((n) => n && n.url);

  if (!bookmarks.length) {
    // Hide the entire section when no toolbar bookmarks exist
    section.style.display = 'none';
    return;
  }

  // Show the section when bookmarks exist
  section.style.display = '';

  renderUrlListing({
    container: root,
    items: bookmarks,
    view: 'list',
    useInlineStyles: false,
    classNames: {
      row: 'kp-url-row',
      content: 'kp-url-content',
      text: 'kp-url-text',
      title: 'kp-url-domain',
      meta: 'kp-url-title',
      url: 'kp-url-path',
      favicon: 'kp-url-favicon'
    },
    getTitle: (b) => b.title || b.url,
    getUrl: (b) => b.url,
    showFavicon: true,
    showMetaLine: true,
    showUrlLine: true,
    decorateRow: ({ item, parts }) => renderThreeLineUrlListingEntry({ item, parts }),
    onRowClick: ({ item, event }) => {
      event.preventDefault();
      navigate(item.url);
    }
  });
}

async function renderRecentHistory() {
  const container = document.getElementById('recent-history');
  if (!container) return;

  container.textContent = '';

  /** @type {Array<chrome.history.HistoryItem>} */
  let historyItems = [];
  try {
    if (chrome.history?.search) {
      const results = await chrome.history.search({
        text: '', // empty string to get all history
        maxResults: 30,
        startTime: Date.now() - (30 * 24 * 60 * 60 * 1000) // last 30 days
      });
      // Filter out chrome-extension URLs
      historyItems = (results || []).filter(item => !item.url?.startsWith('chrome-extension://'));
    }
  } catch {
    historyItems = [];
  }

  if (!historyItems.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No recent history found.';
    container.appendChild(empty);
    return;
  }

  // Convert history items to the format expected by renderUrlListing
  const formattedItems = historyItems.map(item => ({
    title: item.title || item.url,
    url: item.url,
    lastVisitTime: item.lastVisitTime
  }));

  renderUrlListing({
    container,
    items: formattedItems,
    view: 'list',
    useInlineStyles: false,
    classNames: {
      row: 'kp-url-row',
      content: 'kp-url-content',
      text: 'kp-url-text',
      title: 'kp-url-domain',
      meta: 'kp-url-title',
      url: 'kp-url-path',
      favicon: 'kp-url-favicon'
    },
    getTitle: (h) => h.title || h.url,
    getUrl: (h) => h.url,
    showFavicon: true,
    showMetaLine: true,
    showUrlLine: true,
    decorateRow: ({ item, parts }) => renderThreeLineUrlListingEntry({ item, parts }),
    onRowClick: ({ item, event }) => {
      event.preventDefault();
      navigate(item.url);
    }
  });
}

async function renderTopSites() {
  const container = document.getElementById('top-sites');
  if (!container) return;

  container.textContent = '';

  /** @type {Array<chrome.topSites.MostVisitedURL>} */
  let topSites = [];
  try {
    if (chrome.topSites?.get) {
      // Get the most frequently visited sites from Chrome's top sites
      topSites = await chrome.topSites.get();
      // Limit to top 7
      topSites = topSites.slice(0, 8);
    }
  } catch {
    topSites = [];
  }

  if (!topSites.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No frequently visited sites found.';
    container.appendChild(empty);
    return;
  }

  // Create horizontal list
  const list = document.createElement('div');
  list.className = 'top-sites-horizontal';

  for (const site of topSites) {
    const item = document.createElement('div');
    item.className = 'top-site-item';

    const link = document.createElement('a');
    link.href = site.url;
    link.className = 'top-site-link';
    link.title = site.title || site.url;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(site.url);
    });

    const favicon = document.createElement('img');
    favicon.className = 'top-site-favicon';
    // Use the shared MV3 helper (handles runtime.getURL correctly + falls back when unavailable).
    favicon.src = getExtensionFaviconUrl(site.url, 32);
    favicon.onerror = () => {
      // Fallback to default favicon if loading fails
      favicon.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNCIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPgo8L3N2Zz4=';
    };

    const title = document.createElement('div');
    title.className = 'top-site-title';
    title.textContent = site.title || site.url;

    link.appendChild(favicon);
    link.appendChild(title);
    item.appendChild(link);
    list.appendChild(item);
  }

  container.appendChild(list);
}

async function queryGlobalEnabledState() {
  // Preferred: ask the service worker (handles sync/local fallback consistently).
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'KP_GET_STATE' });
    if (resp && typeof resp.enabled === 'boolean') return resp.enabled;
  } catch {
    // ignore
  }

  // Fallback: read storage directly.
  try {
    const syncResult = await chrome.storage.sync.get([KP_ENABLED_STORAGE_KEY]);
    if (typeof syncResult?.[KP_ENABLED_STORAGE_KEY] === 'boolean') return syncResult[KP_ENABLED_STORAGE_KEY];
  } catch {
    // ignore
  }
  try {
    const localResult = await chrome.storage.local.get([KP_ENABLED_STORAGE_KEY]);
    if (typeof localResult?.[KP_ENABLED_STORAGE_KEY] === 'boolean') return localResult[KP_ENABLED_STORAGE_KEY];
  } catch {
    // ignore
  }

  return true;
}

async function setGlobalEnabledState(enabled) {
  const desired = Boolean(enabled);
  const resp = await chrome.runtime.sendMessage({ type: 'KP_SET_STATE', enabled: desired });
  if (resp && typeof resp.enabled === 'boolean') return resp.enabled;
  return desired;
}

function initEnabledSwitch() {
  /** @type {HTMLInputElement | null} */
  const toggle = /** @type {any} */ (document.getElementById('kp-enabled-toggle'));
  if (!toggle) return;
  const stateText = document.getElementById('kp-enabled-text');

  const setUi = (enabled) => {
    const on = Boolean(enabled);
    toggle.checked = on;
    if (stateText) stateText.textContent = on ? 'ON' : 'OFF';
  };

  // Initial state.
  queryGlobalEnabledState().then(setUi).catch(() => setUi(true));

  // Keep in sync if changed elsewhere (popup, hotkey, etc).
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' && area !== 'local') return;
      const c = changes?.[KP_ENABLED_STORAGE_KEY];
      if (!c) return;
      if (typeof c.newValue === 'boolean') setUi(c.newValue);
    });
  } catch {
    // ignore
  }

  // User interaction.
  toggle.addEventListener('change', async () => {
    const desired = toggle.checked;
    toggle.disabled = true;
    try {
      const actual = await setGlobalEnabledState(desired);
      setUi(actual);
    } catch {
      // revert on failure
      setUi(await queryGlobalEnabledState());
    } finally {
      toggle.disabled = false;
    }
  }, { capture: true });
}

async function init() {
  // Initialize KeyPilot with toggle functionality (same as content script)
  try {
    // Create KeyPilot instance
    const keyPilot = new KeyPilot();

    // Store reference globally for debugging/metrics panels (used by OverlayManager debug panel)
    // Note: this is within the content-script isolated world; it is intended for KeyPilot internals.
    window.keyPilot = keyPilot;

    // Create toggle handler and wrap KeyPilot instance
    const toggleHandler = new KeyPilotToggleHandler(keyPilot);

    // Initialize toggle handler (queries service worker for state)
    await toggleHandler.initialize();

    // Store reference globally for debugging
    window.__KeyPilotToggleHandler = toggleHandler;

  } catch (error) {
    console.error('[KeyPilot] Failed to initialize with toggle functionality:', error);

    // Fallback: initialize KeyPilot without toggle functionality
    try {
      const keyPilot = new KeyPilot();
      window.keyPilot = keyPilot;
      console.warn('[KeyPilot] Initialized without toggle functionality as fallback');
    } catch (fallbackError) {
      console.error('[KeyPilot] Complete initialization failure:', fallbackError);
    }
  }

  // Also run onboarding on the custom New Tab page.
  // Content scripts don't run on extension pages, so we bootstrap it here to keep the
  // onboarding + practice popover persistent across normal sites and the New Tab override.
  try {
    if (!window.__KeyPilotOnboarding) {
      const onboarding = new OnboardingManager();
      onboarding.init(); // async; fire-and-forget
      window.__KeyPilotOnboarding = onboarding;
    }
  } catch (e) {
    console.warn('[KeyPilot] Failed to initialize onboarding on newtab:', e);
  }

  const focusHint = document.getElementById('focus-hint');

  const refreshFocusHint = () => {
    // Best-effort heuristic: on the New Tab page, focusing the omnibox typically blurs the page
    // while the document remains visible. We avoid showing the hint when the tab isn't visible.
    const shouldShow = document.visibilityState === 'visible' && !document.hasFocus();
    try {
      document.body?.classList?.toggle('kp-unfocused', shouldShow);
    } catch {
      // ignore
    }
    if (focusHint) {
      focusHint.hidden = !shouldShow;
    }
  };
  window.addEventListener('focus', refreshFocusHint, true);
  window.addEventListener('blur', refreshFocusHint, true);
  document.addEventListener('visibilitychange', refreshFocusHint, true);
  // Chrome doesn't always emit blur/focus events when the omnibox steals focus; poll cheaply.
  const focusHintPoll = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    refreshFocusHint();
  }, 250);
  window.addEventListener('pagehide', () => clearInterval(focusHintPoll), { capture: true, once: true });
  refreshFocusHint();

  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  const suggestionsRoot = document.getElementById('search-suggestions');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input?.value || '';
    const url = toUrlOrSearch(q);
    navigate(url);
  }, true);

  document.getElementById('btn-settings')?.addEventListener('click', () => {
    // Calculate settings container dimensions + 10pt padding
    // The settings container has max-width: 920px and padding: 18px on each side
    const settingsContainerWidth = Math.min(920, window.innerWidth - 36) + 20; // 920px max + 10pt padding each side
    const settingsContainerHeight = Math.min(window.innerHeight * 0.8, window.innerHeight - 100) + 20; // Use 80vh max + 10pt padding each side

    createModal({
      title: 'KeyPilot Settings',
      hintKeyLabel: "'",
      closeKeys: ['Escape', "'", '"'],
      url: 'settings.html',
      width: `${settingsContainerWidth}px`,
      height: `${settingsContainerHeight}px`
    });
  }, true);

  renderTopSites();

  document.getElementById('btn-guide')?.addEventListener('click', () => {
    // Calculate guide container dimensions + 10pt padding
    // The guide container has max-width: 920px and padding: 18px on each side (same as settings)
    const guideContainerWidth = Math.min(920, window.innerWidth - 36) + 20; // 920px max + 10pt padding each side
    const guideContainerHeight = Math.min(window.innerHeight * 0.8, window.innerHeight - 100) + 20; // Use 80vh max + 10pt padding each side

    createModal({
      title: 'KeyPilot Guide',
      hintKeyLabel: 'Esc',
      closeKeys: ['Escape', "'", '"', 'e', 'E'],
      url: 'guide.html',
      width: `${guideContainerWidth}px`,
      height: `${guideContainerHeight}px`
    });
  }, true);

  // Keep search engine label in sync.
  refreshEngineLabel();
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (!changes || !changes[SETTINGS_STORAGE_KEY]) return;
      refreshEngineLabel();
    });
  } catch {
    // ignore
  }

  initEnabledSwitch();

  renderBookmarks();
  if (input && suggestionsRoot) {
    createSuggestionsController({ inputEl: input, rootEl: suggestionsRoot });
  }
  renderToolbarBookmarks();
  renderRecentHistory();
}

init();


