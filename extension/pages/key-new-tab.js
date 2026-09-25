import { KeyPilot } from '../src/keypilot.js';
import { KeyPilotToggleHandler } from '../src/modules/keypilot-toggle-handler.js';
import { OnboardingManager } from '../src/modules/onboarding-manager.js';
import { GENERIC_FAVICON_DATA_URL, attachFaviconWithUpgrade } from '../src/ui/url-listing.js';
import { MSG } from '../src/messaging/types.js';
import { navigate, setSearchSubmitHandler, toUrlOrSearch } from './key-new-tab-boot.js';

function isTypingTarget(target) {
  const tag = target?.tagName?.toLowerCase?.();
  if (tag !== 'input' && tag !== 'textarea') return false;
  if (tag === 'textarea') return true;
  const type = String(target.getAttribute?.('type') || target.type || 'text').toLowerCase();
  return type === 'text' || type === 'search' || type === 'url';
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

  const input = document.getElementById('search-input');
  const suggestions = document.getElementById('search-suggestions');
  if (!(input instanceof HTMLInputElement) || !suggestions) return;

  const controller = createSuggestionsController({
    inputEl: input,
    rootEl: suggestions,
    onCommit: (value) => navigate(toUrlOrSearch(value))
  });
  setSearchSubmitHandler(() => controller.commit());
}

init();
