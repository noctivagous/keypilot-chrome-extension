import { KeyPilot } from '../src/keypilot.js';
import { KeyPilotToggleHandler } from '../src/modules/keypilot-toggle-handler.js';
import { OnboardingManager } from '../src/modules/onboarding-manager.js';
import { buildSearchUrl, getEngineHomeUrl, getSettings, normalizeSearchEngine, SETTINGS_STORAGE_KEY } from '../src/modules/settings-manager.js';
import { urlFromAddressInput } from '../src/utils/address-input.js';
import { getSearchEngineMeta } from '../src/config/search-engines.js';
import { GENERIC_FAVICON_DATA_URL, attachFaviconWithUpgrade } from '../src/ui/url-listing.js';
import { getMessage, localizeElements } from '../src/utils/i18n.js';
import { MSG } from '../src/messaging/types.js';

localizeElements();

let currentEngine = 'brave';

function navigate(url) {
  try {
    window.location.assign(url);
  } catch {
    window.location.href = url;
  }
}

function toUrlOrSearch(text) {
  const t = String(text || '').trim();
  if (!t) return getEngineHomeUrl(currentEngine);
  return urlFromAddressInput(t) || buildSearchUrl(currentEngine, t);
}

function isTypingTarget(target) {
  const tag = target?.tagName?.toLowerCase?.();
  if (tag !== 'input' && tag !== 'textarea') return false;
  if (tag === 'textarea') return true;
  const type = String(target.getAttribute?.('type') || target.type || 'text').toLowerCase();
  return type === 'text' || type === 'search' || type === 'url';
}

async function refreshEngineLabel() {
  try {
    const settings = await getSettings();
    currentEngine = normalizeSearchEngine(settings?.searchEngine);
  } catch {
    currentEngine = 'brave';
  }
  const label = document.getElementById('engine-label');
  if (!label) return;
  const pretty = getSearchEngineMeta(currentEngine).label;
  label.textContent = getMessage('key_new_tab_engine_label', pretty);
}

function closeAllBookmarkMenus() {
  document.querySelectorAll('.bm-menu').forEach((menu) => {
    menu.hidden = true;
  });
  document.querySelectorAll('.bm-folder.kp-open').forEach((folder) => {
    folder.classList.remove('kp-open');
    folder.querySelector(':scope > .bm-folder-btn')?.setAttribute('aria-expanded', 'false');
  });
}

/**
 * Keep folder menus in the viewport. They use position:fixed so they are not
 * clipped by the two-row bookmarks overflow.
 * @param {HTMLElement} folder
 */
function positionBookmarkMenu(folder) {
  const menu = folder.querySelector(':scope > .bm-menu');
  const button = folder.querySelector(':scope > .bm-folder-btn');
  if (!menu || !button || menu.hidden) return;

  const rect = button.getBoundingClientRect();
  const nested = Boolean(folder.parentElement?.closest('.bm-menu'));
  const menuWidth = menu.offsetWidth || 220;
  const menuHeight = menu.offsetHeight || 160;
  const margin = 8;
  let top;
  let left;

  if (nested) {
    left = rect.right + 4;
    top = rect.top;
    if (left + menuWidth > window.innerWidth - margin) {
      left = Math.max(margin, rect.left - menuWidth - 4);
    }
  } else {
    left = rect.left;
    top = rect.bottom + 4;
    if (left + menuWidth > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - menuWidth - margin);
    }
    if (top + menuHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - menuHeight - 4);
    }
  }

  if (top + menuHeight > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - menuHeight - margin);
  }

  menu.style.top = `${Math.round(top)}px`;
  menu.style.left = `${Math.round(left)}px`;
}

function repositionOpenBookmarkMenus() {
  document.querySelectorAll('.bm-folder.kp-open').forEach((folder) => {
    if (folder instanceof HTMLElement) positionBookmarkMenu(folder);
  });
}

/**
 * Close open folder menus that are not this folder or one of its ancestors.
 * @param {HTMLElement} folder
 * @param {boolean} open
 */
function setFolderOpen(folder, open) {
  const menu = folder.querySelector(':scope > .bm-menu');
  const button = folder.querySelector(':scope > .bm-folder-btn');
  if (!menu || !button) return;

  if (open) {
    const parent = folder.parentElement;
    parent?.querySelectorAll(':scope > .bm-folder.kp-open').forEach((sibling) => {
      if (sibling !== folder) setFolderOpen(sibling, false);
    });
  } else {
    folder.querySelectorAll('.bm-folder.kp-open').forEach((nested) => {
      nested.classList.remove('kp-open');
      const nestedMenu = nested.querySelector(':scope > .bm-menu');
      if (nestedMenu) nestedMenu.hidden = true;
      nested.querySelector(':scope > .bm-folder-btn')?.setAttribute('aria-expanded', 'false');
    });
  }

  menu.hidden = !open;
  folder.classList.toggle('kp-open', open);
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) requestAnimationFrame(() => positionBookmarkMenu(folder));
}

/**
 * @param {chrome.bookmarks.BookmarkTreeNode} node
 */
function createBookmarkLink(node) {
  const link = document.createElement('a');
  link.className = 'bm-item bm-link';
  link.href = node.url;
  link.title = node.title ? `${node.title}\n${node.url}` : node.url;

  const favicon = document.createElement('img');
  favicon.alt = '';
  attachFaviconWithUpgrade(favicon, node.url, {
    displaySize: 16,
    fallbackUrl: GENERIC_FAVICON_DATA_URL
  });

  const label = document.createElement('span');
  label.textContent = node.title || node.url;
  link.append(favicon, label);
  link.addEventListener('click', (event) => {
    event.preventDefault();
    navigate(node.url);
  });
  return link;
}

/**
 * @param {chrome.bookmarks.BookmarkTreeNode} node
 */
function createBookmarkFolder(node) {
  const folder = document.createElement('div');
  folder.className = 'bm-folder';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'bm-item bm-folder-btn';
  button.textContent = node.title || getMessage('key_new_tab_folder');
  button.title = button.textContent;
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');

  const menu = document.createElement('div');
  menu.className = 'bm-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'group');

  const children = Array.isArray(node.children) ? node.children : [];
  if (!children.length) {
    const empty = document.createElement('div');
    empty.className = 'bm-menu-empty';
    empty.textContent = getMessage('key_new_tab_folder_empty');
    menu.appendChild(empty);
  } else {
    for (const child of children) {
      if (!child) continue;
      if (child.url) menu.appendChild(createBookmarkLink(child));
      else menu.appendChild(createBookmarkFolder(child));
    }
  }

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    setFolderOpen(folder, !folder.classList.contains('kp-open'));
  });

  folder.append(button, menu);
  return folder;
}

async function renderBookmarksBar() {
  const bar = document.getElementById('bookmarks-bar');
  const shelf = document.getElementById('bookmarks-shelf');
  if (!bar) return;
  bar.textContent = '';

  /** @type {chrome.bookmarks.BookmarkTreeNode[]} */
  let children = [];
  try {
    const tree = await chrome.bookmarks.getSubTree('1');
    children = tree?.[0]?.children || [];
  } catch {
    children = [];
  }

  const items = children.filter((node) => node && (node.url || node.children));
  if (!items.length) {
    if (shelf) shelf.hidden = true;
    return;
  }

  if (shelf) shelf.hidden = false;
  for (const node of items) {
    bar.appendChild(node.url ? createBookmarkLink(node) : createBookmarkFolder(node));
  }
}

async function renderTopSites() {
  const container = document.getElementById('top-sites');
  const empty = document.getElementById('top-sites-empty');
  if (!container) return;
  container.textContent = '';

  /** @type {chrome.topSites.MostVisitedURL[]} */
  let sites = [];
  try {
    if (chrome.topSites?.get) {
      sites = (await chrome.topSites.get()).slice(0, 10);
    }
  } catch {
    sites = [];
  }

  if (!sites.length) {
    container.hidden = true;
    if (empty) empty.hidden = false;
    return;
  }
  container.hidden = false;
  if (empty) empty.hidden = true;

  for (const site of sites) {
    const link = document.createElement('a');
    link.className = 'top-site';
    link.href = site.url;
    const title = String(site.title || '').trim() || site.url;
    link.title = title;

    const favicon = document.createElement('img');
    favicon.alt = '';
    attachFaviconWithUpgrade(favicon, site.url, {
      displaySize: 48,
      fallbackUrl: GENERIC_FAVICON_DATA_URL
    });

    const label = document.createElement('span');
    label.textContent = title;
    link.append(favicon, label);
    link.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(site.url);
    });
    container.appendChild(link);
  }
}

function createSuggestionsController({ inputEl, rootEl, onCommit }) {
  /** @type {Array<{title?: string, url: string, source?: string}>} */
  let suggestions = [];
  let selectedIndex = -1;
  let userNavigatedList = false;
  let debounceTimer = null;
  let lastQuery = '';

  const hide = () => {
    suggestions = [];
    selectedIndex = -1;
    userNavigatedList = false;
    rootEl.hidden = true;
    rootEl.textContent = '';
    inputEl.removeAttribute('aria-activedescendant');
  };

  const render = () => {
    rootEl.textContent = '';
    if (!suggestions.length) {
      rootEl.hidden = true;
      return;
    }
    rootEl.hidden = false;
    suggestions.forEach((item, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'suggestion';
      row.id = `knt-suggestion-${index}`;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', index === selectedIndex ? 'true' : 'false');
      if (index === selectedIndex) row.classList.add('selected');

      const favicon = document.createElement('img');
      favicon.alt = '';
      attachFaviconWithUpgrade(favicon, item.url, {
        displaySize: 16,
        fallbackUrl: GENERIC_FAVICON_DATA_URL
      });

      const text = document.createElement('span');
      text.className = 'suggestion-text';
      const title = document.createElement('span');
      title.className = 'suggestion-title';
      title.textContent = item.title || item.url;
      const url = document.createElement('span');
      url.className = 'suggestion-url';
      url.textContent = item.url;
      text.append(title, url);
      row.append(favicon, text);

      row.addEventListener('mouseenter', () => {
        if (selectedIndex === index) return;
        selectedIndex = index;
        userNavigatedList = true;
        render();
      });
      row.addEventListener('mousedown', (event) => {
        event.preventDefault();
      });
      row.addEventListener('click', () => {
        hide();
        onCommit(item.url);
      });
      rootEl.appendChild(row);
    });

    if (selectedIndex >= 0) {
      inputEl.setAttribute('aria-activedescendant', `knt-suggestion-${selectedIndex}`);
      rootEl.querySelector('.suggestion.selected')?.scrollIntoView?.({ block: 'nearest' });
    } else {
      inputEl.removeAttribute('aria-activedescendant');
    }
  };

  const fetchSuggestions = async (query) => {
    try {
      const resp = await chrome.runtime.sendMessage({
        type: MSG.OMNIBOX_SUGGEST,
        query,
        maxResults: 8
      });
      if (resp && resp.type === MSG.OMNIBOX_SUGGESTIONS && Array.isArray(resp.suggestions)) {
        return resp.suggestions
          .filter((item) => item && typeof item.url === 'string' && item.url.trim())
          .slice(0, 8);
      }
    } catch {
      // ignore
    }
    return [];
  };

  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      const query = (inputEl.value || '').trim();
      if (!query) {
        lastQuery = '';
        hide();
        return;
      }
      lastQuery = query;
      const next = await fetchSuggestions(query);
      if ((inputEl.value || '').trim() !== lastQuery) return;
      suggestions = next;
      selectedIndex = -1;
      userNavigatedList = false;
      render();
    }, 90);
  };

  const moveSelection = (delta) => {
    const count = suggestions.length;
    if (!count) return;
    if (delta < 0 && selectedIndex <= 0) selectedIndex = -1;
    else if (selectedIndex === -1) selectedIndex = delta > 0 ? 0 : -1;
    else selectedIndex = (selectedIndex + delta + count) % count;
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
    onCommit(target);
  };

  inputEl.addEventListener('input', () => schedule());
  inputEl.addEventListener('focus', () => {
    if ((inputEl.value || '').trim()) schedule();
  });
  inputEl.addEventListener('blur', () => {
    setTimeout(() => hide(), 120);
  });
  inputEl.addEventListener('keydown', (event) => {
    if (!isTypingTarget(event.target)) return;
    if (event.key === 'Escape') {
      if (!rootEl.hidden) {
        event.preventDefault();
        event.stopPropagation();
        hide();
      }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (rootEl.hidden) return;
      event.preventDefault();
      event.stopPropagation();
      userNavigatedList = true;
      moveSelection(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      commit();
    }
  }, true);

  return { commit };
}

async function bootKeyPilot() {
  try {
    const keyPilot = new KeyPilot();
    window.keyPilot = keyPilot;
    const toggleHandler = new KeyPilotToggleHandler(keyPilot);
    await toggleHandler.initialize();
    window.__KeyPilotToggleHandler = toggleHandler;
  } catch (error) {
    console.error('[KeyPilot] Failed to initialize on Key New Tab:', error);
    try {
      const keyPilot = new KeyPilot();
      window.keyPilot = keyPilot;
    } catch (fallbackError) {
      console.error('[KeyPilot] Complete initialization failure:', fallbackError);
    }
  }

  try {
    if (!window.__KeyPilotOnboarding) {
      const onboarding = new OnboardingManager();
      onboarding.init();
      window.__KeyPilotOnboarding = onboarding;
    }
  } catch (error) {
    console.warn('[KeyPilot] Failed to initialize onboarding on Key New Tab:', error);
  }
}

function init() {
  void bootKeyPilot();
  void renderBookmarksBar();
  void renderTopSites();
  void refreshEngineLabel();

  document.addEventListener('click', () => closeAllBookmarkMenus());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllBookmarkMenus();
  });
  window.addEventListener('resize', repositionOpenBookmarkMenus);
  document.getElementById('bookmarks-bar')?.addEventListener('scroll', repositionOpenBookmarkMenus);

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (!changes || !changes[SETTINGS_STORAGE_KEY]) return;
      void refreshEngineLabel();
    });
  } catch {
    // ignore
  }

  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  const suggestions = document.getElementById('search-suggestions');
  if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || !suggestions) return;

  const controller = createSuggestionsController({
    inputEl: input,
    rootEl: suggestions,
    onCommit: (value) => navigate(toUrlOrSearch(value))
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    controller.commit();
  });
}

init();
