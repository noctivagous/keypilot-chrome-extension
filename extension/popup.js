import { SETTINGS_STORAGE_KEY } from './src/modules/settings-manager.js';
import { getActionIconDataUri } from './src/ui/keybindings-ui-shared.js';
import {
  KP_KEYBOARD_HELP_STORAGE_KEY,
  ONBOARDING_ACTIVE_STORAGE_KEY,
  getKeypilotHubCardCss,
  paintHubOnboardingCard,
  paintHubToggleCard,
  queryControlStripVisible,
  queryKeyboardHelpVisible,
  queryOnboardingActive,
  setControlStripVisible,
  setKeyboardHelpVisible
} from './src/ui/keypilot-hub.js';

const statusEl = document.getElementById('status');

(function injectHubCardCss() {
  if (document.head.querySelector('[data-kp-hub-card-styles]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-kp-hub-card-styles', '');
  style.textContent = getKeypilotHubCardCss();
  document.head.appendChild(style);
})();

function applyHubIcons() {
  document.querySelectorAll('.kp-hub-icon[data-icon]').forEach((el) => {
    const uri = getActionIconDataUri(el.getAttribute('data-icon'), { fill: 'rgba(255,255,255,0.94)' });
    if (uri) el.style.setProperty('--kp-hub-icon', uri);
  });
}

async function queryActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function isKeyPilotNewTabPage(url) {
  try {
    const mod = await import(chrome.runtime.getURL('src/config/url-policy.js'));
    if (mod && typeof mod.isKeyPilotNewTabUrl === 'function') {
      return mod.isKeyPilotNewTabUrl(url);
    }
  } catch {
    // fall through
  }
  return /^chrome:\/\/newtab\/?/i.test(url) || /^chrome:\/\/new-tab-page\/?/i.test(url);
}

async function sendToActiveTab(message) {
  const tab = await queryActiveTab();
  if (!tab || !tab.id) throw new Error('No active tab');
  await chrome.tabs.sendMessage(tab.id, message);
  return tab;
}

async function openFallbackPage(relativePath) {
  const url = chrome.runtime.getURL(relativePath);
  await chrome.tabs.create({ url });
}

async function openOnActiveTabOrFallback(message, fallbackPath) {
  try {
    await sendToActiveTab(message);
    window.close();
    return;
  } catch {
    // content script may be missing
  }
  try {
    await openFallbackPage(fallbackPath);
    window.close();
  } catch (err) {
    console.error('Failed to open KeyPilot page:', err);
  }
}

function setToggleCard(card, on) {
  paintHubToggleCard(card, on);
}

function setOnboardingCard(card, active) {
  paintHubOnboardingCard(card, active);
}

function setStatus(mode, extensionEnabled = true) {
  if (!statusEl) return;
  if (mode === 'unavailable') {
    statusEl.textContent = 'UNAVAILABLE';
    statusEl.classList.remove('ok', 'warn', 'err');
    statusEl.classList.add('unavailable');
  } else if (!extensionEnabled) {
    statusEl.textContent = 'OFF';
    statusEl.classList.remove('ok', 'warn', 'unavailable');
    statusEl.classList.add('err');
  } else if (mode === 'delete') {
    statusEl.textContent = 'DELETE';
    statusEl.classList.remove('ok', 'warn', 'unavailable');
    statusEl.classList.add('err');
  } else if (mode === 'cols' || mode === 'inspector') {
    statusEl.textContent = mode === 'cols' ? 'COLS' : 'INSPECT';
    statusEl.classList.remove('ok', 'err', 'unavailable');
    statusEl.classList.add('warn');
  } else if (mode === 'text_focus') {
    statusEl.textContent = 'TEXT';
    statusEl.classList.remove('ok', 'err', 'unavailable');
    statusEl.classList.add('warn');
  } else {
    statusEl.textContent = 'ON';
    statusEl.classList.remove('err', 'warn', 'unavailable');
    statusEl.classList.add('ok');
  }
}

class PopupHubController {
  constructor() {
    this.toggleSwitch = null;
    this.toggleContainer = null;
    this.unavailableMessage = null;
    this.keyboardCard = null;
    this.controlStripCard = null;
    this.tutorialCard = null;
    this.isInitialized = false;
    this.isUnavailable = false;
  }

  async initialize() {
    this.toggleSwitch = document.getElementById('extension-toggle');
    this.toggleContainer = document.getElementById('toggle-container');
    this.unavailableMessage = document.getElementById('unavailable-message');
    this.keyboardCard = document.querySelector('[data-action="keyboard"]');
    this.controlStripCard = document.querySelector('[data-action="control-strip"]');
    this.tutorialCard = document.querySelector('[data-action="tutorial"]');

    applyHubIcons();
    await this.checkAvailability();

    if (this.isUnavailable) {
      this.showUnavailableState();
    } else {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'KP_GET_STATE' });
        const enabled = response && response.enabled !== undefined ? response.enabled : true;
        this.updateToggleState(enabled);
      } catch {
        this.updateToggleState(true);
      }
      this.toggleSwitch?.addEventListener('change', this.handleToggleClick.bind(this));
    }

    await this.refreshOverlayStatus();
    this.bindCards();
    this.listenForStorage();

    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.type === 'KP_STATE_CHANGED') {
        this.updateToggleState(message.enabled);
      }
    });

    this.isInitialized = true;
  }

  bindCards() {
    this.keyboardCard?.addEventListener('click', async () => {
      const next = this.keyboardCard.getAttribute('aria-checked') !== 'true';
      this.keyboardCard.disabled = true;
      try {
        setToggleCard(this.keyboardCard, await setKeyboardHelpVisible(next));
      } catch {
        setToggleCard(this.keyboardCard, await queryKeyboardHelpVisible());
      } finally {
        this.keyboardCard.disabled = false;
      }
    });

    this.controlStripCard?.addEventListener('click', async () => {
      const next = this.controlStripCard.getAttribute('aria-checked') !== 'true';
      this.controlStripCard.disabled = true;
      try {
        setToggleCard(this.controlStripCard, await setControlStripVisible(next));
      } catch {
        setToggleCard(this.controlStripCard, await queryControlStripVisible());
      } finally {
        this.controlStripCard.disabled = false;
      }
    });

    document.querySelector('[data-action="settings"]')?.addEventListener('click', () => {
      void openOnActiveTabOrFallback(
        { type: 'KP_OPEN_SETTINGS_POPOVER' },
        'pages/settings.html'
      );
    });

    document.querySelector('[data-action="docs"]')?.addEventListener('click', () => {
      void openOnActiveTabOrFallback(
        { type: 'KP_OPEN_DOCS_POPOVER' },
        'pages/docs.html'
      );
    });

    this.tutorialCard?.addEventListener('click', () => {
      void openOnActiveTabOrFallback(
        { type: 'KP_OPEN_ONBOARDING' },
        'pages/guide.html'
      );
    });
  }

  listenForStorage() {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync' && area !== 'local') return;

        const help = changes?.[KP_KEYBOARD_HELP_STORAGE_KEY];
        if (this.keyboardCard && typeof help?.newValue === 'boolean') {
          setToggleCard(this.keyboardCard, help.newValue);
        }

        const onboarding = changes?.[ONBOARDING_ACTIVE_STORAGE_KEY];
        if (this.tutorialCard && typeof onboarding?.newValue === 'boolean') {
          setOnboardingCard(this.tutorialCard, onboarding.newValue);
        }

        const settings = changes?.[SETTINGS_STORAGE_KEY];
        const nextCs = settings?.newValue?.controlStrip;
        if (this.controlStripCard && nextCs && typeof nextCs.visible === 'boolean') {
          setToggleCard(this.controlStripCard, nextCs.visible);
        }
      });
    } catch { /* ignore */ }
  }

  async refreshOverlayStatus() {
    try {
      setToggleCard(this.keyboardCard, await queryKeyboardHelpVisible());
    } catch {
      setToggleCard(this.keyboardCard, true);
    }
    try {
      setToggleCard(this.controlStripCard, await queryControlStripVisible());
    } catch {
      setToggleCard(this.controlStripCard, true);
    }
    try {
      setOnboardingCard(this.tutorialCard, await queryOnboardingActive());
    } catch {
      setOnboardingCard(this.tutorialCard, false);
    }
  }

  async handleToggleClick() {
    if (!this.isInitialized || this.isUnavailable || !this.toggleSwitch) return;
    const enabled = this.toggleSwitch.checked;
    try {
      await chrome.runtime.sendMessage({ type: 'KP_SET_STATE', enabled });
    } catch (error) {
      console.error('Failed to set extension state:', error);
      this.toggleSwitch.checked = !enabled;
    }
  }

  async checkAvailability() {
    try {
      const tab = await queryActiveTab();
      if (!tab || !tab.url) {
        this.isUnavailable = true;
        return;
      }
      const currentUrl = tab.url;
      if (await isKeyPilotNewTabPage(currentUrl)) {
        this.isUnavailable = false;
        return;
      }
      const restrictedPatterns = [
        /^chrome:\/\//,
        /^edge:\/\//,
        /^about:/,
        /^data:/,
        /^javascript:/
      ];
      this.isUnavailable = restrictedPatterns.some((pattern) => pattern.test(currentUrl));
    } catch {
      this.isUnavailable = true;
    }
  }

  showUnavailableState() {
    if (this.toggleContainer) this.toggleContainer.style.display = 'none';
    if (this.unavailableMessage) this.unavailableMessage.style.display = 'flex';
    setStatus('unavailable', false);
  }

  updateToggleState(enabled) {
    if (this.toggleSwitch && !this.isUnavailable) {
      this.toggleSwitch.checked = enabled;
    }
  }
}

const hub = new PopupHubController();

async function getStatus() {
  if (hub.isUnavailable) {
    return setStatus('unavailable', false);
  }
  try {
    let extensionEnabled = true;
    try {
      const stateResponse = await chrome.runtime.sendMessage({ type: 'KP_GET_STATE' });
      extensionEnabled = stateResponse && stateResponse.enabled !== undefined ? stateResponse.enabled : true;
    } catch { /* ignore */ }

    if (!extensionEnabled) {
      return setStatus('none', false);
    }

    const tab = await queryActiveTab();
    if (!tab || !tab.id) return setStatus('none', true);

    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'KP_GET_STATUS' });
    setStatus((resp && resp.mode) || 'none', true);
  } catch {
    try {
      const stateResponse = await chrome.runtime.sendMessage({ type: 'KP_GET_STATE' });
      const extensionEnabled = stateResponse && stateResponse.enabled !== undefined ? stateResponse.enabled : true;
      setStatus('none', extensionEnabled);
    } catch {
      setStatus('none', true);
    }
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (hub.isUnavailable) return;
  if (msg && msg.type === 'KP_STATUS') {
    chrome.runtime.sendMessage({ type: 'KP_GET_STATE' }).then((response) => {
      const extensionEnabled = response && response.enabled !== undefined ? response.enabled : true;
      setStatus(msg.mode, extensionEnabled);
    }).catch(() => setStatus(msg.mode, true));
  } else if (msg && msg.type === 'KP_STATE_CHANGED') {
    getStatus();
  }
});

void hub.initialize().then(() => getStatus());
