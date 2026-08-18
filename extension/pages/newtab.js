import { buildSearchUrl, getEngineHomeUrl, getSettings, setSettings, normalizeSearchEngine, SETTINGS_STORAGE_KEY } from '../src/modules/settings-manager.js';
import { KeyPilot } from '../src/keypilot.js';
import { KeyPilotToggleHandler } from '../src/modules/keypilot-toggle-handler.js';
import { OnboardingManager } from '../src/modules/onboarding-manager.js';
import {
  GENERIC_FAVICON_DATA_URL,
  attachFaviconWithUpgrade,
  renderUrlListing,
  extractDomain,
  parseUrlForThreeLineDisplay
} from '../src/ui/url-listing.js';
import { applyCardBackground, requestPageThumb } from '../src/ui/page-thumb-ui.js';
import { createPopoverTitlebar, createTitlebarCloseHint } from '../src/ui/popover-titlebar.js';
import { createTitlebarActionButton } from '../src/ui/preview-open-actions.js';
import { createSegmentedControl } from '../src/ui/segmented-control.js';
import {
  NEWTAB_THEME_STORAGE_KEY,
  NEWTAB_FONT_SIZE_STORAGE_KEY,
  NEWTAB_UI_SCALE_STORAGE_KEY,
  NEWTAB_CONTENT_WIDTH_STORAGE_KEY,
  NEWTAB_FONT_SCALE_STORAGE_KEY,
  DEFAULT_NEWTAB_THEME,
  DEFAULT_NEWTAB_FONT_SIZE_PX,
  DEFAULT_NEWTAB_UI_SCALE,
  DEFAULT_NEWTAB_CONTENT_WIDTH,
  normalizeNewtabTheme,
  normalizeNewtabFontSizePx,
  normalizeNewtabUiScale,
  normalizeNewtabContentWidth,
  fontScaleToPx,
  applyNewtabDisplaySettings,
  createNewtabDisplayPopover
} from '../src/ui/newtab-display-popover.js';
import { storageGetValue } from '../src/utils/storage.js';
import { postPopoverBridgeInit } from '../src/modules/popover-bridge-init.js';

let currentEngine = 'brave';
const KP_ENABLED_STORAGE_KEY = 'keypilot_enabled';
const KP_KEYBOARD_HELP_STORAGE_KEY = 'keypilot_keyboard_help_visible';
const BOOKMARKS_VIEW_STORAGE_KEY = 'kp_newtab_bookmarks_view';

/**
 * Darkened page-preview background on New Tab card rows (grid only).
 * List rows keep the solid chrome.
 * @param {HTMLElement} row
 * @param {{ url?: string }|string} itemOrUrl
 * @param {boolean} [isGrid]
 */
function attachPageThumbToCardRow(row, itemOrUrl, isGrid = true) {
  if (!row || !isGrid) return;
  const url =
    typeof itemOrUrl === 'string'
      ? itemOrUrl
      : (itemOrUrl && typeof itemOrUrl.url === 'string' ? itemOrUrl.url : '');
  if (!url) return;
  applyCardBackground(row, url, {
    fallbackSolid: '',
    hoverSolid: '',
    manageHover: false,
    youtubePrefer: true,
    useCssVar: true,
    cssVarName: '--kp-page-thumb',
    readyClass: 'kp-has-page-thumb'
  });
}

/**
 * Persist display settings and apply them to the page.
 * @param {{ theme?: unknown, fontSizePx?: unknown, uiScale?: unknown, contentWidth?: unknown }} partial
 * @param {{ theme: 'cyberforward'|'earth', fontSizePx: number, uiScale: number, contentWidth: import('../src/ui/newtab-display-popover.js').NewtabContentWidth }} current
 */
function commitNewtabDisplaySettings(partial, current) {
  const next = applyNewtabDisplaySettings({
    theme: partial.theme != null ? partial.theme : current.theme,
    fontSizePx: partial.fontSizePx != null ? partial.fontSizePx : current.fontSizePx,
    uiScale: partial.uiScale != null ? partial.uiScale : current.uiScale,
    contentWidth: partial.contentWidth != null ? partial.contentWidth : current.contentWidth
  });
  try {
    chrome.storage.local.set({
      [NEWTAB_THEME_STORAGE_KEY]: next.theme,
      [NEWTAB_FONT_SIZE_STORAGE_KEY]: next.fontSizePx,
      [NEWTAB_UI_SCALE_STORAGE_KEY]: next.uiScale,
      [NEWTAB_CONTENT_WIDTH_STORAGE_KEY]: next.contentWidth
    });
  } catch {
    // ignore
  }
  return next;
}

async function initNewtabDisplay() {
  /** @type {{ theme: 'cyberforward'|'earth', fontSizePx: number, uiScale: number, contentWidth: number|'full' }} */
  let settings = {
    theme: DEFAULT_NEWTAB_THEME,
    fontSizePx: DEFAULT_NEWTAB_FONT_SIZE_PX,
    uiScale: DEFAULT_NEWTAB_UI_SCALE,
    contentWidth: DEFAULT_NEWTAB_CONTENT_WIDTH
  };

  try {
    const stored = await chrome.storage.local.get([
      NEWTAB_THEME_STORAGE_KEY,
      NEWTAB_FONT_SIZE_STORAGE_KEY,
      NEWTAB_UI_SCALE_STORAGE_KEY,
      NEWTAB_CONTENT_WIDTH_STORAGE_KEY,
      NEWTAB_FONT_SCALE_STORAGE_KEY
    ]);
    const migratedFont =
      stored?.[NEWTAB_FONT_SIZE_STORAGE_KEY] != null
        ? normalizeNewtabFontSizePx(stored[NEWTAB_FONT_SIZE_STORAGE_KEY])
        : (fontScaleToPx(stored?.[NEWTAB_FONT_SCALE_STORAGE_KEY]) ?? DEFAULT_NEWTAB_FONT_SIZE_PX);
    settings = {
      theme: normalizeNewtabTheme(stored?.[NEWTAB_THEME_STORAGE_KEY]),
      fontSizePx: migratedFont,
      uiScale: normalizeNewtabUiScale(
        stored?.[NEWTAB_UI_SCALE_STORAGE_KEY] ?? DEFAULT_NEWTAB_UI_SCALE
      ),
      contentWidth: normalizeNewtabContentWidth(
        stored?.[NEWTAB_CONTENT_WIDTH_STORAGE_KEY] ?? DEFAULT_NEWTAB_CONTENT_WIDTH
      )
    };
  } catch {
    try {
      const lsFont = localStorage.getItem(NEWTAB_FONT_SIZE_STORAGE_KEY);
      const lsScaleLegacy = localStorage.getItem(NEWTAB_FONT_SCALE_STORAGE_KEY);
      settings = {
        theme: normalizeNewtabTheme(localStorage.getItem(NEWTAB_THEME_STORAGE_KEY)),
        fontSizePx:
          lsFont != null
            ? normalizeNewtabFontSizePx(lsFont)
            : (fontScaleToPx(lsScaleLegacy) ?? DEFAULT_NEWTAB_FONT_SIZE_PX),
        uiScale: normalizeNewtabUiScale(
          localStorage.getItem(NEWTAB_UI_SCALE_STORAGE_KEY) ?? DEFAULT_NEWTAB_UI_SCALE
        ),
        contentWidth: normalizeNewtabContentWidth(
          localStorage.getItem(NEWTAB_CONTENT_WIDTH_STORAGE_KEY) ?? DEFAULT_NEWTAB_CONTENT_WIDTH
        )
      };
    } catch {
      // ignore
    }
  }

  settings = applyNewtabDisplaySettings(settings);

  const anchor = document.getElementById('btn-display');
  if (!anchor) return;

  const popover = createNewtabDisplayPopover({
    anchorButton: anchor,
    theme: settings.theme,
    fontSizePx: settings.fontSizePx,
    uiScale: settings.uiScale,
    contentWidth: settings.contentWidth,
    onThemeChange: (theme) => {
      settings = commitNewtabDisplaySettings({ theme }, settings);
    },
    onFontSizeChange: (fontSizePx) => {
      settings = commitNewtabDisplaySettings({ fontSizePx }, settings);
    },
    onUiScaleChange: (uiScale) => {
      settings = commitNewtabDisplaySettings({ uiScale }, settings);
    },
    onContentWidthChange: (contentWidth) => {
      settings = commitNewtabDisplaySettings({ contentWidth }, settings);
    },
    onResetToDefaults: (defaults) => {
      settings = commitNewtabDisplaySettings(
        {
          theme: defaults.theme,
          fontSizePx: defaults.fontSizePx,
          uiScale: defaults.uiScale,
          contentWidth: defaults.contentWidth
        },
        settings
      );
    }
  });

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (!changes) return;

      let nextTheme = settings.theme;
      let nextFont = settings.fontSizePx;
      let nextScale = settings.uiScale;
      let nextWidth = settings.contentWidth;
      let changed = false;

      if (changes[NEWTAB_THEME_STORAGE_KEY]) {
        nextTheme = normalizeNewtabTheme(changes[NEWTAB_THEME_STORAGE_KEY].newValue);
        changed = true;
      }
      if (changes[NEWTAB_FONT_SIZE_STORAGE_KEY]) {
        nextFont = normalizeNewtabFontSizePx(changes[NEWTAB_FONT_SIZE_STORAGE_KEY].newValue);
        changed = true;
      }
      if (changes[NEWTAB_UI_SCALE_STORAGE_KEY]) {
        nextScale = normalizeNewtabUiScale(changes[NEWTAB_UI_SCALE_STORAGE_KEY].newValue);
        changed = true;
      }
      if (changes[NEWTAB_CONTENT_WIDTH_STORAGE_KEY]) {
        nextWidth = normalizeNewtabContentWidth(changes[NEWTAB_CONTENT_WIDTH_STORAGE_KEY].newValue);
        changed = true;
      }
      if (!changed) return;

      settings = applyNewtabDisplaySettings({
        theme: nextTheme,
        fontSizePx: nextFont,
        uiScale: nextScale,
        contentWidth: nextWidth
      });
      popover.setTheme(settings.theme, { silent: true });
      popover.setFontSizePx(settings.fontSizePx, { silent: true });
      popover.setUiScale(settings.uiScale, { silent: true });
      popover.setContentWidth(settings.contentWidth, { silent: true });
    });
  } catch {
    // ignore
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

function createModal({ title, hintKeyLabel, closeKeys, url, width, height, actions }) {
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

  // Match overlay-manager.showPopover chrome: single shared titlebar (title +
  // close-key hint + ×). Avoids a separate modal-hint strip above the header.
  const requestClose = () => {
    root.hidden = true;
    root.textContent = '';
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('message', onMessage, true);
  };

  const titlebarHint = createTitlebarCloseHint({
    keys: [hintKeyLabel, 'Esc'],
    suffix: 'Use the same keyboard navigation controls.'
  });
  const titlebarApi = createPopoverTitlebar({
    title,
    icon: 'window',
    variant: 'modal',
    showClose: true,
    onClose: requestClose,
    closeTitle: 'Close (Esc)',
    hint: titlebarHint,
    className: 'kpv2-popover-titlebar',
    actions: actions || null
  });

  const iframe = document.createElement('iframe');
  iframe.className = 'modal-iframe';
  iframe.src = url;
  iframe.tabIndex = 0;

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

    if (data.type === 'KP_POPOVER_LAUNCH_WALKTHROUGH') {
      requestClose();
      try {
        const ob = window.__KeyPilotOnboarding;
        if (ob && typeof ob.resetTutorial === 'function') {
          void ob.resetTutorial();
        }
      } catch {
        // ignore
      }
    }
  };

  backdrop.addEventListener('click', requestClose, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('message', onMessage, true);

  container.appendChild(titlebarApi.titlebar);
  container.appendChild(iframe);
  root.appendChild(backdrop);
  root.appendChild(container);

  // Kick off bridge init so Esc/quote etc works when the iframe has focus.
  const sendInit = () => {
    postPopoverBridgeInit(iframe.contentWindow, { closeKeys });
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
      // Match omnibox typing behavior: no suggestion menu until the user types.
      // (Empty-query "recent" suggestions only make sense when the omnibox overlay
      // is intentionally opened; the new-tab field is always visible.)
      if (!q) {
        lastQuery = '';
        hide();
        return;
      }
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

  // Only fetch on typing — do not open the menu on focus/click with an empty box.
  inputEl.addEventListener('input', () => schedule(), { capture: true });
  inputEl.addEventListener('focus', () => {
    // Restore suggestions only if the field already has a query (e.g. refocus after blur).
    if ((inputEl.value || '').trim()) schedule();
  }, { capture: true });
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

async function renderBookmarks(view = 'grid') {
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

  list.classList.toggle('kp-card-grid', view === 'grid');
  list.classList.toggle('kp-row-list', view === 'list');

  renderUrlListing({
    container: list,
    items: bookmarks,
    view: view === 'grid' ? 'grid' : 'list',
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
    decorateRow: ({ row, item, parts }) => {
      renderThreeLineUrlListingEntry({ item, parts });
      attachPageThumbToCardRow(row, item, view === 'grid');
    },
    onRowClick: ({ item, event }) => {
      event.preventDefault();
      navigate(item.url);
    }
  });
}

/**
 * Recursively render a bookmark tree node. Bookmarks render as card tiles
 * (grid), grouped per folder; folders render as collapsible outline containers.
 * @param {chrome.bookmarks.BookmarkTreeNode} node
 * @param {{ expanded?: boolean }} [opts]
 * @returns {HTMLElement}
 */
function renderBookmarkNode(node, { expanded = false } = {}) {
  if (node?.url) {
    const grid = document.createElement('div');
    grid.className = 'kp-card-grid';
    renderUrlListing({
      container: grid,
      items: [node],
      view: 'grid',
      useInlineStyles: false,
      classNames: {
        row: 'kp-url-row bm-leaf',
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
      decorateRow: ({ row, item, parts }) => {
        renderThreeLineUrlListingEntry({ item, parts });
        attachPageThumbToCardRow(row, item, true);
      },
      onRowClick: ({ item, event }) => {
        event.preventDefault();
        navigate(item.url);
      }
    });
    return grid;
  }

  const details = document.createElement('details');
  details.className = 'bm-folder';
  if (expanded) details.open = true;

  const summary = document.createElement('summary');
  summary.className = 'bm-folder-summary';
  summary.textContent = node?.title || 'Untitled folder';
  summary.title = node?.title || 'Untitled folder';

  const leafNodes = (node?.children || []).filter((n) => n?.url);
  const folderNodes = (node?.children || []).filter((n) => n && !n.url);

  const children = document.createElement('div');
  children.className = 'bm-folder-children';

  if (leafNodes.length) {
    const grid = document.createElement('div');
    grid.className = 'kp-card-grid';
    renderUrlListing({
      container: grid,
      items: leafNodes,
      view: 'grid',
      useInlineStyles: false,
      classNames: {
        row: 'kp-url-row bm-leaf',
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
      decorateRow: ({ row, item, parts }) => {
        renderThreeLineUrlListingEntry({ item, parts });
        attachPageThumbToCardRow(row, item, true);
      },
      onRowClick: ({ item, event }) => {
        event.preventDefault();
        navigate(item.url);
      }
    });
    children.appendChild(grid);
  }

  for (const folderNode of folderNodes) {
    children.appendChild(renderBookmarkNode(folderNode));
  }

  details.appendChild(summary);
  details.appendChild(children);
  return details;
}

async function renderAllBookmarks() {
  const root = document.getElementById('all-bookmarks');
  const empty = document.getElementById('all-bookmarks-empty');
  if (!root || !empty) return;

  root.textContent = '';

  /** @type {Array<chrome.bookmarks.BookmarkTreeNode>} */
  let tree = [];
  try {
    if (chrome.bookmarks?.getTree) {
      tree = await chrome.bookmarks.getTree();
    }
  } catch {
    tree = [];
  }

  const hasBookmarks = (nodes) => (nodes || []).some((n) => Boolean(n.url) || (n.children && hasBookmarks(n.children)));
  if (!hasBookmarks(tree)) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  // Top-level roots (Bookmarks bar, Other bookmarks, Mobile bookmarks) are
  // expanded so users can browse; nested folders stay collapsed.
  const rootNodes = (tree[0]?.children || []).filter((n) => n);
  for (const node of rootNodes) {
    root.appendChild(renderBookmarkNode(node, { expanded: true }));
  }
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
    view: 'grid',
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
    decorateRow: ({ row, item, parts }) => {
      renderThreeLineUrlListingEntry({ item, parts });
      attachPageThumbToCardRow(row, item, true);
    },
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

  // Group visits to the same website into outline containers.
  const groups = new Map();
  for (const item of formattedItems) {
    const domain = extractDomain(item.url) || item.url;
    let group = groups.get(domain);
    if (!group) {
      group = { domain, items: [] };
      groups.set(domain, group);
    }
    group.items.push(item);
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    const aTime = Math.max(...a.items.map((i) => i.lastVisitTime || 0));
    const bTime = Math.max(...b.items.map((i) => i.lastVisitTime || 0));
    return bTime - aTime;
  });

  for (const group of sortedGroups) {
    group.items.sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0));

    const details = document.createElement('details');
    details.className = 'history-outline';

    // Root domain URL for Link Preview (E) when the group is collapsed.
    // Prefer https so preview iframes can load; derive host from the label domain.
    let rootUrl = `https://${group.domain}/`;
    try {
      const first = group.items[0]?.url;
      if (first) {
        const u = new URL(first);
        const host = (u.hostname || group.domain).replace(/^www\./i, '') || group.domain;
        const port = u.port ? `:${u.port}` : '';
        rootUrl = `https://${host}${port}/`;
      }
    } catch { /* keep https://domain/ fallback */ }
    details.dataset.kpRootUrl = rootUrl;

    const summary = document.createElement('summary');
    summary.className = 'history-outline-summary';

    const favicon = document.createElement('img');
    favicon.className = 'history-outline-favicon';
    favicon.alt = '';
    attachFaviconWithUpgrade(favicon, group.items[0].url, {
      displaySize: 32,
      requestSize: 64,
      fallbackUrl: GENERIC_FAVICON_DATA_URL,
      highRes: true
    });

    const label = document.createElement('span');
    label.className = 'history-outline-label';
    label.textContent = group.domain;

    const count = document.createElement('span');
    count.className = 'history-outline-count';
    count.textContent = String(group.items.length);

    summary.appendChild(favicon);
    summary.appendChild(label);
    summary.appendChild(count);

    // Page preview on the collapsed header. Class goes on <details> so CSS can
    // adjust padding; --kp-page-thumb is painted on the summary ::after layer.
    const primaryThumbUrl = group.items[0]?.url || rootUrl;
    applyCardBackground(details, primaryThumbUrl, {
      youtubePrefer: true,
      useCssVar: true,
      cssVarName: '--kp-page-thumb',
      readyClass: 'kp-has-page-thumb'
    });
    if (primaryThumbUrl !== rootUrl) {
      void (async () => {
        const primary = await requestPageThumb(primaryThumbUrl);
        if (primary || !details.isConnected) return;
        if (details.classList.contains('kp-has-page-thumb')) return;
        const rootData = await requestPageThumb(rootUrl);
        if (!rootData || !details.isConnected) return;
        if (details.classList.contains('kp-has-page-thumb')) return;
        try {
          const safe = String(rootData).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          details.style.setProperty('--kp-page-thumb', `url("${safe}")`);
          details.classList.add('kp-has-page-thumb');
          details.dataset.kpThumbSource = 'capture';
          details.dataset.kpThumbReady = '1';
        } catch {
          // ignore
        }
      })();
    }

    const children = document.createElement('div');
    children.className = 'history-outline-children';

    renderUrlListing({
      container: children,
      items: group.items,
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

    details.appendChild(summary);
    details.appendChild(children);
    container.appendChild(details);
  }
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
      // Limit to top 20; a visible horizontal scrollbar appears at the bottom.
      topSites = topSites.slice(0, 20);
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
    // Compact tile: high-res favicon; page title top + URL bottom (both clip on overflow).
    link.className = 'top-site-link top-site-card';
    const { domain } = parseUrlForThreeLineDisplay(site.url);
    const pageTitle = String(site.title || '').trim();
    const urlLabel = domain || site.url;
    link.title = pageTitle ? `${pageTitle}\n${urlLabel}` : urlLabel;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(site.url);
    });

    const tile = document.createElement('div');
    tile.className = 'top-site-tile';

    const titleEl = document.createElement('div');
    titleEl.className = 'top-site-page-title';
    titleEl.textContent = pageTitle || urlLabel;

    const urlEl = document.createElement('div');
    urlEl.className = 'top-site-url';
    urlEl.textContent = urlLabel;

    const favicon = document.createElement('img');
    favicon.className = 'top-site-favicon';
    favicon.alt = '';
    // Quick Chrome favicon, then upgrade via SW multi-source high-res probe.
    attachFaviconWithUpgrade(favicon, site.url, {
      displaySize: 48,
      requestSize: 128,
      fallbackUrl: GENERIC_FAVICON_DATA_URL,
      highRes: true
    });

    tile.appendChild(titleEl);
    tile.appendChild(favicon);
    tile.appendChild(urlEl);
    link.appendChild(tile);
    item.appendChild(link);
    list.appendChild(item);

    // Page screenshot / YouTube thumb as darkened tile background.
    applyCardBackground(tile, site.url, {
      youtubePrefer: true,
      useCssVar: true,
      cssVarName: '--kp-page-thumb',
      readyClass: 'kp-has-page-thumb'
    });
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

  // Fallback: shared sync → local helper.
  const value = await storageGetValue(KP_ENABLED_STORAGE_KEY, true);
  return typeof value === 'boolean' ? value : true;
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
    if (stateText) {
      stateText.textContent = on ? 'ON' : 'OFF';
      stateText.setAttribute('data-state', on ? 'on' : 'off');
    }
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

async function queryKeyboardHelpVisible() {
  // Prefer live KeyPilot instance when available (same process as the newtab page).
  try {
    const kp = window.keyPilot || window.__KeyPilotInstance;
    if (kp && typeof kp.getKeyboardHelpVisibleFromStorage === 'function') {
      return Boolean(await kp.getKeyboardHelpVisibleFromStorage());
    }
  } catch {
    // ignore
  }

  try {
    const syncResult = await chrome.storage.sync.get([KP_KEYBOARD_HELP_STORAGE_KEY]);
    if (typeof syncResult?.[KP_KEYBOARD_HELP_STORAGE_KEY] === 'boolean') {
      return syncResult[KP_KEYBOARD_HELP_STORAGE_KEY];
    }
  } catch {
    // ignore
  }
  try {
    const localResult = await chrome.storage.local.get([KP_KEYBOARD_HELP_STORAGE_KEY]);
    if (typeof localResult?.[KP_KEYBOARD_HELP_STORAGE_KEY] === 'boolean') {
      return localResult[KP_KEYBOARD_HELP_STORAGE_KEY];
    }
  } catch {
    // ignore
  }
  return false;
}

async function setKeyboardHelpVisible(visible) {
  const desired = Boolean(visible);

  // Prefer KeyPilot APIs so show/hide + persistence stay consistent with the K shortcut.
  try {
    const kp = window.keyPilot || window.__KeyPilotInstance;
    if (kp && typeof kp.applyKeyboardHelpVisibility === 'function') {
      kp.applyKeyboardHelpVisibility(desired, { persist: true });
      return desired;
    }
  } catch {
    // fall through to storage
  }

  const payload = { [KP_KEYBOARD_HELP_STORAGE_KEY]: desired, timestamp: Date.now() };
  try { await chrome.storage.sync.set(payload); } catch { /* ignore */ }
  try { await chrome.storage.local.set(payload); } catch { /* ignore */ }
  return desired;
}

function initKeyboardHelpSwitch() {
  /** @type {HTMLInputElement | null} */
  const toggle = /** @type {any} */ (document.getElementById('kp-keyboard-toggle'));
  if (!toggle) return;
  const stateText = document.getElementById('kp-keyboard-text');

  const setUi = (visible) => {
    const on = Boolean(visible);
    toggle.checked = on;
    if (stateText) {
      stateText.textContent = on ? 'ON' : 'OFF';
      stateText.setAttribute('data-state', on ? 'on' : 'off');
    }
  };

  queryKeyboardHelpVisible().then(setUi).catch(() => setUi(false));

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' && area !== 'local') return;
      const c = changes?.[KP_KEYBOARD_HELP_STORAGE_KEY];
      if (!c) return;
      if (typeof c.newValue === 'boolean') setUi(c.newValue);
    });
  } catch {
    // ignore
  }

  toggle.addEventListener('change', async () => {
    const desired = toggle.checked;
    toggle.disabled = true;
    try {
      const actual = await setKeyboardHelpVisible(desired);
      setUi(actual);
    } catch {
      setUi(await queryKeyboardHelpVisible());
    } finally {
      toggle.disabled = false;
    }
  }, { capture: true });
}

async function queryControlStripVisible() {
  try {
    const settings = await getSettings();
    return settings?.controlStrip?.visible !== false;
  } catch {
    return true;
  }
}

async function setControlStripVisible(visible) {
  const desired = Boolean(visible);
  await setSettings({ controlStrip: { visible: desired } });

  // Prefer live KeyPilot so the strip updates immediately on this page.
  try {
    const kp = window.keyPilot || window.__KeyPilotInstance;
    if (kp) {
      if (kp._settings) {
        kp._settings.controlStrip = {
          ...(kp._settings.controlStrip || {}),
          visible: desired
        };
      }
      if (typeof kp.applyControlStripFromSettings === 'function') {
        kp.applyControlStripFromSettings();
      }
    }
  } catch {
    // storage listener will still apply
  }

  return desired;
}

function initControlStripSwitch() {
  /** @type {HTMLInputElement | null} */
  const toggle = /** @type {any} */ (document.getElementById('kp-control-strip-toggle'));
  if (!toggle) return;
  const stateText = document.getElementById('kp-control-strip-text');

  const setUi = (visible) => {
    const on = Boolean(visible);
    toggle.checked = on;
    if (stateText) {
      stateText.textContent = on ? 'ON' : 'OFF';
      stateText.setAttribute('data-state', on ? 'on' : 'off');
    }
  };

  queryControlStripVisible().then(setUi).catch(() => setUi(true));

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' && area !== 'local') return;
      const entry = changes?.[SETTINGS_STORAGE_KEY];
      if (!entry) return;
      const next = entry.newValue;
      if (!next || typeof next !== 'object') return;
      if (next.controlStrip && typeof next.controlStrip.visible === 'boolean') {
        setUi(next.controlStrip.visible);
      }
    });
  } catch {
    // ignore
  }

  toggle.addEventListener('change', async () => {
    const desired = toggle.checked;
    toggle.disabled = true;
    try {
      const actual = await setControlStripVisible(desired);
      setUi(actual);
    } catch {
      setUi(await queryControlStripVisible());
    } finally {
      toggle.disabled = false;
    }
  }, { capture: true });
}

function initBookmarkTabs() {
  const tabs = Array.from(document.querySelectorAll('.tabbar-tab[data-panel]'));
  const panels = {
    recent: document.getElementById('panel-recent'),
    all: document.getElementById('panel-all')
  };
  if (!tabs.length || !panels.recent || !panels.all) return;

  let allLoaded = false;

  const select = async (panel) => {
    for (const tab of tabs) {
      const selected = tab.dataset.panel === panel;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    }
    // Render the tree before swapping panels on first load. Rendering while the
    // tall "Recent" panel is still visible keeps the page height stable, so the
    // document scroll position doesn't get clamped to the top.
    if (panel === 'all' && !allLoaded) {
      allLoaded = true;
      await renderAllBookmarks();
    }
    panels.recent.hidden = panel !== 'recent';
    panels.all.hidden = panel !== 'all';
  };

  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab.dataset.panel), true);
  }

  // Arrow-key navigation within the horizontal tablist (ARIA tabs pattern).
  const tabbar = tabs[0].parentElement;
  tabbar?.addEventListener('keydown', (e) => {
    if (!e) return;
    const key = e.key;
    if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') return;
    const currentIndex = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;
    if (key === 'ArrowRight') nextIndex = Math.min(tabs.length - 1, currentIndex + 1);
    if (key === 'ArrowLeft') nextIndex = Math.max(0, currentIndex - 1);
    if (key === 'Home') nextIndex = 0;
    if (key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === currentIndex) return;

    e.preventDefault();
    select(tabs[nextIndex].dataset.panel);
    try {
      tabs[nextIndex].focus();
    } catch {
      // ignore
    }
  });

  select('recent');
}

async function initBookmarkViewToggle() {
  const root = document.getElementById('bookmark-view-toggle');
  if (!root) return;

  let view = 'grid'; // Cards by default.
  try {
    const stored = await chrome.storage.local.get([BOOKMARKS_VIEW_STORAGE_KEY]);
    const value = stored?.[BOOKMARKS_VIEW_STORAGE_KEY];
    if (value === 'list' || value === 'grid') view = value;
  } catch {
    // ignore
  }

  const control = createSegmentedControl({
    value: view,
    ariaLabel: 'Bookmark view',
    options: [
      { value: 'list', label: 'List' },
      { value: 'grid', label: 'Cards' }
    ],
    onChange: (next) => {
      view = next;
      try {
        chrome.storage.local.set({ [BOOKMARKS_VIEW_STORAGE_KEY]: view });
      } catch {
        // ignore
      }
      renderBookmarks(view);
    }
  });

  control.root.classList.add('view-toggle-control');
  root.appendChild(control.root);

  renderBookmarks(view);
}

async function init() {
  // Initialize KeyPilot with toggle functionality (same as content script)
  try {
    // Create KeyPilot instance
    const keyPilot = new KeyPilot();

    // Store reference globally for debugging/metrics panels (used by OverlayManager debug panel).
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
  // Content scripts don't run on extension pages; early-inject.js is loaded from
  // newtab.html for the walkthrough + control-strip shells, and we hydrate
  // OnboardingManager here so behavior stays consistent with normal sites.
  try {
    if (!window.__KeyPilotOnboarding) {
      const onboarding = new OnboardingManager();
      onboarding.init(); // async; fire-and-forget
      window.__KeyPilotOnboarding = onboarding;
    }
  } catch (e) {
    console.warn('[KeyPilot] Failed to initialize onboarding on newtab:', e);
  }

  /*
   * ---------------------------------------------------------------------------
   * New Tab "address bar has focus" hint (#focus-hint / focus-hint-bg.svg)
   * STATUS: DISABLED (FOCUS_HINT_ENABLED = false). DOM/CSS remain in place.
   * ---------------------------------------------------------------------------
   *
   * Intent
   *   When Chrome's omnibox (address bar) has focus, dim the page and show the
   *   SVG watermark so keyboard users know why KeyPilot keys are not reaching
   *   the page. Clear the hint when the page regains focus (click, Tab, etc.).
   *
   * Permissions
   *   No special extension permission exists for "omnibox focused". This is
   *   pure page DOM (hasFocus / blur / focusin). Manifest changes won't help.
   *
   * Chrome quirk (extension NTP / chrome_url_overrides newtab)
   *   After a cold load, the address bar often already owns keyboard input
   *   while document.hasFocus() still returns true. Clicking the omnibox is
   *   then a no-op for hasFocus/window.blur — the hint never appears if you
   *   only poll !document.hasFocus().
   *
   *   Opening DevTools (or any real blur) "repairs" the focus graph; after
   *   that, omnibox click correctly flips hasFocus. Same repair happens once
   *   the user has engaged the page with a real focus transition.
   *
   *   mouseleave toward the top of the viewport can detect moving into the
   *   toolbar, but false-triggers whenever the cursor merely exits into
   *   browser chrome (tabs, bookmarks) without focusing the omnibox — do not
   *   use that as the sole show signal.
   *
   * Working multi-signal approach (when re-enabling)
   *   - pageOwnsFocus starts false → show hint (NTP omnibox-first).
   *   - Hide on: focusin (Tab from omnibox into page), pointerdown, page keydown.
   *   - Show on: window blur, !document.hasFocus(), Cmd/Ctrl+L.
   *   - Do not claim page ownership on cold-load window.focus alone (hasFocus lies).
   *   - After sawBrowserBlur, window.focus + hasFocus may mark page ownership.
   *   - Optional debug HUD was used during diagnosis; keep it off in production.
   *
   * Markup / styles (still in newtab.html + newtab.css)
   *   #focus-hint, .focus-hint-scrim, img.focus-hint-bg, body.kp-unfocused
   * ---------------------------------------------------------------------------
   */
  const FOCUS_HINT_ENABLED = false;

  const focusHint = document.getElementById('focus-hint');
  // Force off while disabled (also clears any leftover unfocused styling).
  try {
    document.body?.classList?.remove('kp-unfocused');
    if (focusHint) focusHint.hidden = true;
  } catch {
    // ignore
  }
  try {
    document.getElementById('kp-focus-debug-hud')?.remove();
  } catch {
    // ignore
  }

  if (FOCUS_HINT_ENABLED) {
    let pageOwnsFocus = false;
    /** True after we've observed a real window blur (browser chrome took focus). */
    let sawBrowserBlur = false;

    const refreshFocusHint = () => {
      let hasFocus = true;
      try { hasFocus = document.hasFocus(); } catch { hasFocus = true; }

      if (!hasFocus) {
        pageOwnsFocus = false;
      }

      const shouldShow = document.visibilityState === 'visible' && !pageOwnsFocus;
      try {
        document.body?.classList?.toggle('kp-unfocused', shouldShow);
      } catch {
        // ignore
      }
      if (focusHint) {
        focusHint.hidden = !shouldShow;
      }
    };

    const markPageOwnsFocus = () => {
      pageOwnsFocus = true;
      refreshFocusHint();
    };

    const markBrowserOwnsFocus = () => {
      sawBrowserBlur = true;
      pageOwnsFocus = false;
      refreshFocusHint();
    };

    window.addEventListener('focus', () => {
      // After a real blur to browser chrome, window focus means the page is active again.
      // Do not claim ownership on cold-load focus (hasFocus can lie before any blur).
      try {
        if (document.hasFocus() && (sawBrowserBlur || pageOwnsFocus)) {
          markPageOwnsFocus();
          return;
        }
      } catch { /* ignore */ }
      refreshFocusHint();
    }, true);

    window.addEventListener('blur', () => markBrowserOwnsFocus(), true);

    document.addEventListener('visibilitychange', () => refreshFocusHint(), true);

    // Tab from the omnibox lands focus on a page control → focusin clears the hint.
    document.addEventListener('focusin', () => markPageOwnsFocus(), true);

    document.addEventListener('pointerdown', (e) => {
      if (e && typeof e.button === 'number' && e.button !== 0) return;
      markPageOwnsFocus();
    }, true);

    document.addEventListener('keydown', (e) => {
      if (!e) return;
      if (e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift') return;
      if ((e.metaKey || e.ctrlKey) && String(e.key || '').toLowerCase() === 'l') {
        markBrowserOwnsFocus();
        return;
      }
      if (e.key === 'Tab') {
        markPageOwnsFocus();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      markPageOwnsFocus();
    }, true);

    const focusHintPoll = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      refreshFocusHint();
    }, 250);
    window.addEventListener('pagehide', () => clearInterval(focusHintPoll), { capture: true, once: true });

    pageOwnsFocus = false;
    refreshFocusHint();
  }

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
    // Match KeyPilot handleOpenSettingsPopover sizing (master–detail layout).
    const settingsContainerWidth = Math.min(980, window.innerWidth - 36) + 20;
    const settingsContainerHeight = Math.min(window.innerHeight * 0.82, window.innerHeight - 80) + 20;

    createModal({
      title: 'KeyPilot Settings',
      hintKeyLabel: "'",
      closeKeys: ['Escape', "'", '"'],
      url: 'settings.html',
      width: `${settingsContainerWidth}px`,
      height: `${settingsContainerHeight}px`,
      actions: createTitlebarActionButton({
        label: 'Help/Documentation',
        title: 'Help/Documentation',
        className: 'kpv2-popover-titlebar-docs',
        iconPaths: [
          { attrs: { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' } },
          { attrs: { d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' } }
        ],
        onClick: () => {
          const docsContainerWidth = Math.min(980, window.innerWidth - 36) + 20;
          const docsContainerHeight = Math.min(window.innerHeight * 0.82, window.innerHeight - 80) + 20;
          createModal({
            title: 'KeyPilot Docs',
            hintKeyLabel: 'Alt+H',
            closeKeys: ['Escape'],
            url: 'docs.html',
            width: `${docsContainerWidth}px`,
            height: `${docsContainerHeight}px`
          });
        }
      })
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
  initControlStripSwitch();
  initKeyboardHelpSwitch();
  initNewtabDisplay();

  initBookmarkTabs();
  initBookmarkViewToggle();
  if (input && suggestionsRoot) {
    createSuggestionsController({ inputEl: input, rootEl: suggestionsRoot });
  }
  renderToolbarBookmarks();
  renderRecentHistory();
}

init();


