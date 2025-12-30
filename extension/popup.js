(function () {
const statusEl = document.getElementById('status');

class PopupToggleController {
    constructor() {
        this.toggleSwitch = null;
        this.toggleContainer = null;
        this.unavailableMessage = null;
        this.keyboardContainer = null;
        this.settingsButton = null;
        this.tutorialButton = null;
        this.isInitialized = false;
        this.isUnavailable = false;
    }

    async initialize() {
        this.toggleSwitch = document.getElementById('extension-toggle');
        this.toggleContainer = document.getElementById('toggle-container');
        this.unavailableMessage = document.getElementById('unavailable-message');
        this.keyboardContainer = document.querySelector('.keyboard-container');
        this.settingsButton = document.getElementById('open-settings');
        this.tutorialButton = document.getElementById('open-tutorial');
        
        if (!this.toggleSwitch || !this.toggleContainer || !this.unavailableMessage) {
            console.error('Required popup elements not found');
            return;
        }

        // Check if extension is available on current page
        await this.checkAvailability();

        if (this.isUnavailable) {
            this.showUnavailableState();
            return;
        }

        // Query current state from service worker
        try {
            const response = await chrome.runtime.sendMessage({ type: 'KP_GET_STATE' });
            const enabled = response && response.enabled !== undefined ? response.enabled : true;
            this.updateToggleState(enabled);
        } catch (error) {
            console.error('Failed to get initial state:', error);
            // Default to enabled if service worker is not available
            this.updateToggleState(true);
        }

        // Set up event listener for toggle clicks
        this.toggleSwitch.addEventListener('change', this.handleToggleClick.bind(this));

        // Open Settings in the active tab (tab-local popover).
        if (this.settingsButton) {
            this.settingsButton.addEventListener('click', this.handleOpenSettingsClick.bind(this));
        }

        // Open onboarding tutorial in the active tab (Alt+/ equivalent).
        if (this.tutorialButton) {
            this.tutorialButton.addEventListener('click', this.handleOpenTutorialClick.bind(this));
        }

        // Listen for state changes from service worker
        chrome.runtime.onMessage.addListener((message) => {
            if (message && message.type === 'KP_STATE_CHANGED') {
                this.updateToggleState(message.enabled);
            }
        });

        this.isInitialized = true;
    }

    async handleOpenSettingsClick() {
        try {
            const tab = await queryActiveTab();
            if (tab && tab.id) {
                await chrome.tabs.sendMessage(tab.id, { type: 'KP_OPEN_SETTINGS_POPOVER' });
                window.close();
                return;
            }
        } catch (e) {
            // fall through to extension-page fallback
        }

        try {
            const url = chrome.runtime.getURL('pages/settings.html');
            await chrome.tabs.create({ url });
            window.close();
        } catch (e2) {
            console.error('Failed to open Settings:', e2);
        }
    }

    async handleOpenTutorialClick() {
        try {
            const tab = await queryActiveTab();
            if (tab && tab.id) {
                await chrome.tabs.sendMessage(tab.id, { type: 'KP_OPEN_ONBOARDING' });
                window.close();
                return;
            }
        } catch (e) {
            // fall through to extension-page fallback
        }

        // Fallback: open the guide page as a standalone tutorial.
        try {
            const url = chrome.runtime.getURL('pages/guide.html');
            await chrome.tabs.create({ url });
            window.close();
        } catch (e2) {
            console.error('Failed to open Tutorial:', e2);
        }
    }

    async handleToggleClick() {
        if (!this.isInitialized || this.isUnavailable) return;

        const enabled = this.toggleSwitch.checked;
        
        try {
            // Send toggle command to service worker
            await chrome.runtime.sendMessage({ 
                type: 'KP_SET_STATE', 
                enabled: enabled 
            });
        } catch (error) {
            console.error('Failed to set extension state:', error);
            // Revert toggle state on error
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

            // Check for restricted URLs where content scripts can't run
            const restrictedPatterns = [
                /^chrome:\/\//,
                // Removed /^chrome-extension:\/\//, - allow chrome-extension for new tab page but is general.
                // /^moz-extension:\/\//,
                /^edge:\/\//,
                /^about:/,
                // Removed /^file:\/\//, - allow file:// URLs (users must enable "Allow access to file URLs" in Chrome settings)
                /^data:/,
                /^javascript:/
            ];

            this.isUnavailable = restrictedPatterns.some(pattern => pattern.test(tab.url));

        } catch (error) {
            console.error('Failed to check availability:', error);
            this.isUnavailable = true;
        }
    }

    showUnavailableState() {
        this.toggleContainer.style.display = 'none';
        this.unavailableMessage.style.display = 'flex';
        if (this.settingsButton) {
            this.settingsButton.disabled = true;
        }
        if (this.tutorialButton) {
            this.tutorialButton.disabled = true;
        }
        
        if (this.keyboardContainer) {
            this.keyboardContainer.classList.add('unavailable');
        }
        
        // Update status to show unavailable
        setStatus('unavailable', false);
    }

    updateToggleState(enabled) {
        if (this.toggleSwitch && !this.isUnavailable) {
            this.toggleSwitch.checked = enabled;
        }
    }
}

// Initialize toggle controller
const toggleController = new PopupToggleController();

async function getToggleShortcutDisplay() {
    // Alt+K is handled directly by early-inject.js, not through chrome.commands
    return 'Alt + K';
}

async function initKeybindingsUI() {
    const keyboardContainer = document.getElementById('kp-keyboard');
    const legendTbody = document.getElementById('kp-assigned-keys-body');
    if (!keyboardContainer && !legendTbody) return;

    try {
        const settingsUrl = chrome.runtime.getURL('src/modules/settings-manager.js');
        const layoutsUrl = chrome.runtime.getURL('src/config/keyboard-layouts.js');
        const uiUrl = chrome.runtime.getURL('src/ui/keybindings-ui.js');

        const [settingsMod, layouts, ui] = await Promise.all([
            import(settingsUrl),
            import(layoutsUrl),
            import(uiUrl)
        ]);

        const settings = settingsMod && typeof settingsMod.getSettings === 'function'
            ? await settingsMod.getSettings()
            : null;
        const layoutId = layouts && typeof layouts.normalizeKeyboardLayoutId === 'function'
            ? layouts.normalizeKeyboardLayoutId(settings && settings.keyboardLayoutId)
            : 'browsing-right';

        const keybindings = layouts && typeof layouts.buildKeybindingsForLayout === 'function'
            ? layouts.buildKeybindingsForLayout(layoutId)
            : (ui && ui.KEYBINDINGS ? ui.KEYBINDINGS : {});

        const keyboardLayout = layouts && typeof layouts.getKeyboardUiLayoutForLayout === 'function'
            ? layouts.getKeyboardUiLayoutForLayout(layoutId)
            : undefined;

        const extraRows = [
            { id: 'TOGGLE_EXTENSION', keys: await getToggleShortcutDisplay(), action: 'Toggle On/Off' }
        ];

        ui.renderKeybindingsUI({
            keyboardContainer,
            legendTbody,
            keybindings,
            keyboardLayout,
            layoutId,
            extraRows
        });
    } catch (error) {
        console.error('Failed to render keybindings UI:', error);
    }
}


function setStatus(mode, extensionEnabled = true) {
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


async function queryActiveTab() {
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
return tab;
}


async function getStatus() {
    // If extension is unavailable on this page, don't try to get status
    if (toggleController.isUnavailable) {
        return setStatus('unavailable', false);
    }

    try {
        // First check if extension is globally enabled
        let extensionEnabled = true;
        try {
            const stateResponse = await chrome.runtime.sendMessage({ type: 'KP_GET_STATE' });
            extensionEnabled = stateResponse && stateResponse.enabled !== undefined ? stateResponse.enabled : true;
        } catch (error) {
            console.error('Failed to get extension state:', error);
        }

        // If extension is disabled globally, show OFF status
        if (!extensionEnabled) {
            return setStatus('none', false);
        }

        // If extension is enabled, get the current mode from content script
        const tab = await queryActiveTab();
        if (!tab || !tab.id) return setStatus('none', true);
        
        const resp = await chrome.tabs.sendMessage(tab.id, { type: 'KP_GET_STATUS' });
        setStatus(resp && resp.mode || 'none', true);
    } catch (e) {
        // Content script may not be injected yet (e.g., chrome:// pages). 
        // Check extension state and show appropriate status
        try {
            const stateResponse = await chrome.runtime.sendMessage({ type: 'KP_GET_STATE' });
            const extensionEnabled = stateResponse && stateResponse.enabled !== undefined ? stateResponse.enabled : true;
            setStatus('none', extensionEnabled);
        } catch (error) {
            // If service worker is not available, assume enabled
            setStatus('none', true);
        }
    }
}


// Listen for push updates from the content script while the popup is open
chrome.runtime.onMessage.addListener((msg) => {
    if (toggleController.isUnavailable) {
        return; // Don't process messages if extension is unavailable
    }

    if (msg && msg.type === 'KP_STATUS') {
        // When receiving status updates, check if extension is still enabled
        chrome.runtime.sendMessage({ type: 'KP_GET_STATE' }).then(response => {
            const extensionEnabled = response && response.enabled !== undefined ? response.enabled : true;
            setStatus(msg.mode, extensionEnabled);
        }).catch(() => {
            // If service worker is not available, assume enabled
            setStatus(msg.mode, true);
        });
    } else if (msg && msg.type === 'KP_STATE_CHANGED') {
        // Extension toggle state changed, refresh status
        getStatus();
    }
});


getStatus();
toggleController.initialize();
initKeybindingsUI();
})();
