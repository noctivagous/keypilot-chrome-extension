import { before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { installChromeMock, resetChromeMock } from './helpers/chrome-mock.js';

/** @type {ReturnType<typeof installChromeMock>} */
let mock;

before(() => {
  mock = installChromeMock({ isMac: false });
});

beforeEach(() => {
  resetChromeMock(mock);
});

describe('settings-path', () => {
  it('builds nested partials and reads paths', async () => {
    const { pathToPartial, getPath, setOverridePath, clampNumber } =
      await import('../extension/src/modules/settings-path.js');
    assert.deepEqual(pathToPartial('clickMode.cursor.gap', 4), {
      clickMode: { cursor: { gap: 4 } }
    });
    assert.equal(getPath({ clickMode: { cursor: { gap: 4 } } }, 'clickMode.cursor.gap'), 4);
    assert.equal(clampNumber('9', 1, 12), 9);
    const next = setOverridePath({ color: { fg: '#111111' } }, 'shape.cornerMode', 'cut');
    assert.equal(next.shape.cornerMode, 'cut');
    assert.equal(next.color.fg, '#111111');
  });
});

describe('SettingsController', () => {
  it('loads defaults, updates a range path, and disposes storage listeners', async () => {
    const { createSettingsController } =
      await import('../extension/src/modules/settings-controller.js');
    const c = createSettingsController();
    const seen = [];
    const unsub = c.subscribe((s) => seen.push(s.clickMode.cursor.lineWidth));
    await c.load();
    await c.update('clickMode.cursor.lineWidth', 8);
    assert.equal(c.state.clickMode.cursor.lineWidth, 8);
    assert.equal(c.state.clickMode.cursor.sizePixels, 10);
    assert.ok(seen.includes(8));
    c.dispose();
    unsub();
    assert.equal(c.disposed, true);
    mock.emitChange({ kp_settings_v1: { newValue: { clickMode: { cursor: { lineWidth: 2 } } } } }, 'sync');
    assert.equal(c.state.clickMode.cursor.lineWidth, 8);
  });

  it('updates a radio-style path and resets appearance overrides', async () => {
    const { createSettingsController } =
      await import('../extension/src/modules/settings-controller.js');
    const c = createSettingsController();
    await c.load();
    await c.update('cursorMode', 'CUSTOM-CURSORS');
    await c.updateThemeOverride('shape.cornerMode', 'cut');
    assert.equal(c.state.themeOverrides.shape.cornerMode, 'cut');
    await c.reset('appearance');
    assert.deepEqual(c.state.themeOverrides, {});
    c.dispose();
  });

  it('applies external chrome.storage.onChanged snapshots', async () => {
    const { createSettingsController } =
      await import('../extension/src/modules/settings-controller.js');
    const { SETTINGS_STORAGE_KEY, setSettings } =
      await import('../extension/src/modules/settings-manager.js');
    const c = createSettingsController();
    await c.load();
    await setSettings({ searchEngine: 'duckduckgo' });
    mock.emitChange({
      [SETTINGS_STORAGE_KEY]: { newValue: mock.syncStore.get(SETTINGS_STORAGE_KEY) }
    }, 'sync');
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(c.state.searchEngine, 'duckduckgo');
    c.dispose();
  });
});
