import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { installChromeMock, EXTENSION_ORIGIN } from './helpers/chrome-mock.js';

before(() => {
  installChromeMock({ isMac: false });
});

describe('url-policy', () => {
  it('treats empty or missing URLs as skippable', async () => {
    const { isSkippableUrl, isSkippableTab } =
      await import('../extension/src/config/url-policy.js');
    assert.equal(isSkippableUrl(null), true);
    assert.equal(isSkippableUrl(''), true);
    assert.equal(isSkippableUrl('   '), true);
    assert.equal(isSkippableTab(null), true);
    assert.equal(isSkippableTab({}), true);
  });

  it('skips chrome, edge, about, and data schemes for recording', async () => {
    const { isSkippableUrl } = await import('../extension/src/config/url-policy.js');
    assert.equal(isSkippableUrl('chrome://extensions'), true);
    assert.equal(isSkippableUrl('chrome-extension://abc/page.html'), true);
    assert.equal(isSkippableUrl('edge://settings'), true);
    assert.equal(isSkippableUrl('about:blank'), true);
    assert.equal(isSkippableUrl('data:text/html,hi'), true);
    assert.equal(isSkippableUrl('https://example.com'), false);
  });

  it('allowlists KeyPilot new tab for Q/W cycling', async () => {
    const { isKeyPilotNewTabUrl, isSkippableTab } =
      await import('../extension/src/config/url-policy.js');

    assert.equal(isKeyPilotNewTabUrl('chrome://newtab'), true);
    assert.equal(isKeyPilotNewTabUrl('chrome://new-tab-page/'), true);

    const kpNewTab = `${EXTENSION_ORIGIN}/pages/newtab.html`;
    assert.equal(isKeyPilotNewTabUrl(kpNewTab), true);
    assert.equal(isKeyPilotNewTabUrl(`${kpNewTab}#focus`), true);
    assert.equal(isSkippableTab({ url: kpNewTab }), false);

    assert.equal(isSkippableTab({ url: 'chrome://extensions' }), true);
    assert.equal(isSkippableTab({ url: 'https://example.com' }), false);
  });

  it('marks chrome://, NTP, Web Store, and other-extension pages as content-script restricted', async () => {
    const { isContentScriptRestrictedUrl, isWebStoreUrl } =
      await import('../extension/src/config/url-policy.js');

    assert.equal(isContentScriptRestrictedUrl(null), true);
    assert.equal(isContentScriptRestrictedUrl(''), true);
    assert.equal(isContentScriptRestrictedUrl('chrome://extensions'), true);
    assert.equal(isContentScriptRestrictedUrl('chrome://newtab/'), true);
    assert.equal(isContentScriptRestrictedUrl('chrome://new-tab-page/'), true);
    assert.equal(isContentScriptRestrictedUrl('chrome://settings'), true);
    assert.equal(isContentScriptRestrictedUrl('edge://newtab'), true);
    assert.equal(isContentScriptRestrictedUrl('about:blank'), true);
    assert.equal(isContentScriptRestrictedUrl('view-source:https://example.com'), true);
    assert.equal(isContentScriptRestrictedUrl('chrome-extension://other-id/popup.html'), true);

    assert.equal(isWebStoreUrl('https://chromewebstore.google.com/'), true);
    assert.equal(isWebStoreUrl('https://chromewebstore.google.com/detail/keypilot/abc'), true);
    assert.equal(isWebStoreUrl('https://chrome.google.com/webstore/detail/foo'), true);
    assert.equal(isWebStoreUrl('https://microsoftedge.microsoft.com/addons/detail/foo'), true);
    assert.equal(isContentScriptRestrictedUrl('https://chromewebstore.google.com/'), true);
    assert.equal(isContentScriptRestrictedUrl('https://chrome.google.com/webstore'), true);

    assert.equal(isContentScriptRestrictedUrl('https://example.com'), false);
    assert.equal(isContentScriptRestrictedUrl('https://google.com'), false);
    assert.equal(isContentScriptRestrictedUrl('file:///tmp/page.html'), false);

    const ownSettings = `${EXTENSION_ORIGIN}/pages/settings.html`;
    assert.equal(isContentScriptRestrictedUrl(ownSettings), false);
    assert.equal(isContentScriptRestrictedUrl(`${EXTENSION_ORIGIN}/pages/newtab.html`), false);
  });
});
