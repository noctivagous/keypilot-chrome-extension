import { startKeyPilotOnPage } from './keypilot-page-init.js';

function postCloseRequest() {
  try {
    window.parent.postMessage({ type: 'KP_POPOVER_REQUEST_CLOSE', key: 'Escape' }, '*');
  } catch {
    // ignore
  }
}

/**
 * When Guide is embedded in the KeyPilot iframe popover, the outer chrome
 * already provides a standard titlebar + × close. Hide the in-page header so
 * we don't stack two header bars.
 */
function adaptHeaderForPopoverEmbed() {
  try {
    const embedded = window.parent && window.parent !== window;
    if (!embedded) return;
    document.documentElement.classList.add('kp-popover-embed');
    document.body?.classList?.add('kp-popover-embed');
    const header = document.querySelector('main.wrap > .header, .header');
    if (header) {
      header.hidden = true;
      header.setAttribute('aria-hidden', 'true');
    }
  } catch {
    // ignore
  }
}

async function init() {
  adaptHeaderForPopoverEmbed();

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


