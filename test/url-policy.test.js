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
});
