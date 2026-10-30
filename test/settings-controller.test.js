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

describe('writeSettingsInputValue', () => {
  it('skips identical values and focused controls so range drags are not rewritten', async () => {
    const { writeSettingsInputValue } =
      await import('../extension/src/modules/settings-binder.js');
    const el = {
      value: '250',
      getRootNode() {
        return { activeElement: this };
      }
    };
    writeSettingsInputValue(el, '400');
    assert.equal(el.value, '250');
    el.getRootNode = () => ({ activeElement: null });
    writeSettingsInputValue(el, '400');
    assert.equal(el.value, '400');
    const before = el.value;
    writeSettingsInputValue(el, '400');
    assert.equal(el.value, before);
  });

  it('does not write a range or stale paired number while the thumb is down', async () => {
    const { writeSettingsInputValue, setSettingsRangeDragging } =
      await import('../extension/src/modules/settings-binder.js');
    const root = { activeElement: null, getElementById: (id) => map[id] || null };
    const range = {
      id: 'click-overlay-fill-max-width-range',
      type: 'range',
      value: '401',
      getRootNode: () => root
    };
    const number = {
      id: 'click-overlay-fill-max-width-number',
      type: 'number',
      value: '401',
      getRootNode: () => root
    };
    const map = {
      'click-overlay-fill-max-width-range': range,
      'click-overlay-fill-max-width-number': number
    };
    setSettingsRangeDragging(range, true);
    writeSettingsInputValue(range, '400');
    assert.equal(range.value, '401');
    writeSettingsInputValue(number, '400');
    assert.equal(number.value, '401');
    writeSettingsInputValue(number, '401');
    assert.equal(number.value, '401');
    setSettingsRangeDragging(range, false);
    writeSettingsInputValue(range, '400');
    assert.equal(range.value, '400');
  });
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

  it('does not re-emit storage echoes of a local write', async () => {
    const { createSettingsController } =
      await import('../extension/src/modules/settings-controller.js');
    const { SETTINGS_STORAGE_KEY } =
      await import('../extension/src/modules/settings-manager.js');
    const c = createSettingsController();
    await c.load();
    let n = 0;
    c.subscribe(() => { n += 1; });
    await c.update('clickMode.cursor.lineWidth', 7);
    const afterUpdate = n;
    mock.emitChange({
      [SETTINGS_STORAGE_KEY]: { newValue: mock.syncStore.get(SETTINGS_STORAGE_KEY) }
    }, 'sync');
    mock.emitChange({
      [SETTINGS_STORAGE_KEY]: { newValue: mock.localStore.get(SETTINGS_STORAGE_KEY) }
    }, 'local');
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(n, afterUpdate);
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
