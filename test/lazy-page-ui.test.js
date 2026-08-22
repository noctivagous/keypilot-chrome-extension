import { before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installChromeMock, resetChromeMock } from './helpers/chrome-mock.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {ReturnType<typeof installChromeMock>} */
let mock;

before(() => {
  mock = installChromeMock({ isMac: false });
});

beforeEach(() => {
  resetChromeMock(mock);
});

describe('lazy-page-ui', () => {
  it('maps Settings and Docs to local pages/* WAR bundles (no remote URLs)', async () => {
    const { PAGE_UI_BUNDLES, pageUiBundlePath, pageUiBundleUrl } =
      await import('../extension/src/modules/lazy-page-ui.js');
    assert.equal(PAGE_UI_BUNDLES.docs, 'pages/docs-bundled.js');
    assert.equal(PAGE_UI_BUNDLES.settings, 'pages/settings-bundled.js');
    for (const id of Object.keys(PAGE_UI_BUNDLES)) {
      const rel = pageUiBundlePath(id);
      assert.match(rel, /^pages\/[\w-]+-bundled\.js$/);
      const url = pageUiBundleUrl(id);
      assert.equal(url.startsWith('http://') || url.startsWith('https://'), false);
      assert.match(url, /^chrome-extension:\/\/keypilot-test\/pages\//);
    }
  });
});

describe('content-script UI import graph', () => {
  it('does not statically import Settings or Docs page modules', () => {
    const src = readFileSync(
      join(root, 'extension/src/modules/popover-controller.js'),
      'utf8'
    );
    assert.equal(src.includes("from '../../pages/docs.js'"), false);
    assert.equal(src.includes("from '../../pages/settings.js'"), false);
    assert.equal(src.includes('lazy-page-ui.js'), true);
  });

  it('keeps Settings and Docs (and markdown-it) out of the eager content bundle when built', () => {
    const bundled = join(root, 'extension/content-bundled.js');
    if (!existsSync(bundled)) return;
    const src = readFileSync(bundled, 'utf8');
    assert.equal(src.includes('bindSettingsControls'), false, 'settings binder leaked into content bundle');
    assert.equal(src.includes('adaptHeaderForPopoverEmbed'), false, 'settings page leaked into content bundle');
    assert.equal(src.includes('docsThemeStorageInstalled'), false, 'docs page leaked into content bundle');
    assert.equal(
      /markdown-it|MarkdownIt/.test(src),
      false,
      'markdown-it leaked into content bundle'
    );
    assert.equal(src.includes('pages/docs-bundled.js'), true);
    assert.equal(src.includes('pages/settings-bundled.js'), true);
  });
});
