import { startKeyPilotOnPage } from './keypilot-page-init.js';

function postCloseRequest() {
  try {
    window.parent.postMessage({ type: 'KP_POPOVER_REQUEST_CLOSE', key: 'Escape' }, '*');
  } catch {
    // ignore
  }
}

async function init() {
  // Start KeyPilot inside the Guide page (this page is often loaded in an iframe popover).
  await startKeyPilotOnPage({ allowInIframe: true });

  const openSettingsBtn = document.getElementById('open-settings');
  const closeBtn = document.getElementById('close');

  openSettingsBtn?.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'KP_OPEN_SETTINGS_POPOVER' });
    } catch {
      // ignore
    }
  }, true);

  closeBtn?.addEventListener('click', () => postCloseRequest(), true);
}

init();


