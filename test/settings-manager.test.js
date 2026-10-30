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

describe('settings-manager normalizers', () => {
  it('clamps invalid enums and accepts paintStrategy aliases', async () => {
    const {
      normalizeCursorMode,
      normalizeFocusColor,
      normalizePaintStrategy,
      normalizeTextFocusStyle,
      normalizeActionsLibraryTableExpanded,
      DEFAULT_SETTINGS
    } = await import('../extension/src/modules/settings-manager.js');

    assert.equal(normalizeCursorMode('nope'), DEFAULT_SETTINGS.cursorMode);
    assert.equal(normalizeFocusColor('magenta'), DEFAULT_SETTINGS.clickMode.focusColor);
    assert.equal(normalizeFocusColor('purple'), 'purple');
    assert.equal(normalizeFocusColor('#FF8C00'), '#ff8c00');
    assert.equal(normalizeTextFocusStyle('weird'), DEFAULT_SETTINGS.textMode.focusStyle);
    assert.equal(normalizePaintStrategy('B->C'), 'BC');
    assert.equal(normalizePaintStrategy('AUTO'), 'auto');
    assert.equal(normalizePaintStrategy('garbage'), DEFAULT_SETTINGS.clickMode.paintStrategy);
  });

  it('treats missing actionsLibraryTableExpanded as defaults and [] as explicit empty', async () => {
    const {
      normalizeActionsLibraryTableExpanded,
      DEFAULT_SETTINGS
    } = await import('../extension/src/modules/settings-manager.js');

    assert.deepEqual(
      normalizeActionsLibraryTableExpanded(undefined),
      [...DEFAULT_SETTINGS.actionsLibraryTableExpanded]
    );
    assert.deepEqual(normalizeActionsLibraryTableExpanded([]), []);
  });
});

describe('getSettings / setSettings / resetAllSettings', () => {
  it('returns defaults when storage is empty', async () => {
    const { getSettings, DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } =
      await import('../extension/src/modules/settings-manager.js');
    const settings = await getSettings();
    assert.equal(settings.themeId, DEFAULT_SETTINGS.themeId);
    assert.equal(settings.keyboardLayoutId, DEFAULT_SETTINGS.keyboardLayoutId);
    assert.equal(settings.keyboardHardwareLayoutId, 'us-ansi-qwerty');
    assert.equal(settings.clickMode.paintStrategy, DEFAULT_SETTINGS.clickMode.paintStrategy);
    assert.equal(settings.scroll.middleClickScrollLine, false);
    assert.equal(settings.controlStrip.collapsed, true);
    assert.equal(settings.deferredOpen.enabled, false);
    assert.equal(settings.deferredOpen.numberRowKeys, 'auto');
    assert.equal(settings.deferredOpen.openUrls.enabled, true);
    assert.equal(settings.deferredOpen.randomBookmarks.enabled, true);
    assert.equal(settings.deferredOpen.target, 'activeWindow');
    assert.equal(settings.deferredOpen.silentRandomScheduling, false);
    assert.equal(settings.deferredOpen.clickElement.enabled, true);
    assert.equal(settings.deferredOpen.clickElement.minMinutes, 1);
    assert.equal(settings.deferredOpen.clickElement.maxMinutes, 60);
    assert.equal(settings.deferredOpen.closeTab.enabled, true);
    assert.equal(settings.deferredOpen.closeTab.minMinutes, 1);
    assert.equal(settings.deferredOpen.closeTab.maxMinutes, 60);
    assert.equal(settings.deferredOpen.closeWindow.enabled, true);
    assert.equal(settings.deferredOpen.closeWindow.minMinutes, 1);
    assert.equal(settings.deferredOpen.closeWindow.maxMinutes, 60);
    assert.equal(settings.clickMode.overlayFillMaxWidth, 250);
    assert.equal(settings.clickMode.overlayFillMaxHeight, 250);
    assert.ok(!mock.syncStore.has(SETTINGS_STORAGE_KEY));
  });

  it('infers family/handedness from legacy keyboardLayoutId', async () => {
    const { getSettings, SETTINGS_STORAGE_KEY } =
      await import('../extension/src/modules/settings-manager.js');
    mock.seed(SETTINGS_STORAGE_KEY, { keyboardLayoutId: 'browsing-left' }, 'sync');
    const settings = await getSettings();
    assert.equal(settings.keyboardLayoutFamilyId, 'browsing');
    assert.equal(settings.keyboardHandedness, 'left');
    assert.equal(settings.keyboardLayoutId, 'browsing-left');
  });

  it('persists an explicit hardware layout without deriving it from locale', async () => {
    const { getSettings, setSettings, SETTINGS_STORAGE_KEY } =
      await import('../extension/src/modules/settings-manager.js');

    await setSettings({ keyboardHardwareLayoutId: 'us-ansi-qwerty' });
    assert.equal(
      mock.syncStore.get(SETTINGS_STORAGE_KEY).keyboardHardwareLayoutId,
      'us-ansi-qwerty'
    );
    assert.equal((await getSettings()).keyboardHardwareLayoutId, 'us-ansi-qwerty');

    mock.seed(SETTINGS_STORAGE_KEY, { keyboardHardwareLayoutId: 'not-a-layout' }, 'sync');
    assert.equal((await getSettings()).keyboardHardwareLayoutId, 'us-ansi-qwerty');
  });

  it('deep-merges nested partial updates without clobbering siblings', async () => {
    const { getSettings, setSettings, SETTINGS_STORAGE_KEY } =
      await import('../extension/src/modules/settings-manager.js');

    await setSettings({
      clickMode: { cursor: { sizePixels: 20 }, focusColor: 'green' },
      panelPositions: { controlStrip: { anchor: 'top-right' } },
      actionSettings: {
        RECTANGLE_HIGHLIGHT: { mode: 'rectangle', parameters: { foo: 1 } }
      }
    });

    const stored = mock.syncStore.get(SETTINGS_STORAGE_KEY);
    assert.ok(stored);
    assert.ok(mock.localStore.has(SETTINGS_STORAGE_KEY), 'dualWrite should mirror to local');

    const settings = await getSettings();
    assert.equal(settings.clickMode.cursor.sizePixels, 20);
    assert.equal(settings.clickMode.cursor.lineWidth, 4);
    assert.equal(settings.clickMode.focusColor, 'green');
    assert.equal(settings.panelPositions.controlStrip.anchor, 'top-right');
    assert.equal(settings.panelPositions.keyboardReference.anchor, 'bottom-left');
    assert.equal(settings.actionSettings.RECTANGLE_HIGHLIGHT.mode, 'rectangle');
    assert.equal(settings.actionSettings.RECTANGLE_HIGHLIGHT.parameters.foo, 1);
  });

  it('normalizes invalid stored nested values on read', async () => {
    const { getSettings, SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS } =
      await import('../extension/src/modules/settings-manager.js');
    mock.seed(
      SETTINGS_STORAGE_KEY,
      {
        searchEngine: 'bing',
        clickMode: { paintStrategy: 'B->C', cursor: { lineWidth: 99 } },
        textMode: { focusStyle: 'nope' }
      },
      'sync'
    );
    const settings = await getSettings();
    assert.equal(settings.searchEngine, DEFAULT_SETTINGS.searchEngine);
    assert.equal(settings.clickMode.paintStrategy, 'BC');
    assert.equal(settings.clickMode.cursor.lineWidth, 12);
    assert.equal(settings.textMode.focusStyle, DEFAULT_SETTINGS.textMode.focusStyle);
  });

  it('clamps overlay fill max size and skips fill when either axis exceeds it', async () => {
    const {
      getSettings,
      overlayFillExceedsMaxSize,
      SETTINGS_STORAGE_KEY,
      DEFAULT_SETTINGS
    } = await import('../extension/src/modules/settings-manager.js');
    mock.seed(
      SETTINGS_STORAGE_KEY,
      { clickMode: { overlayFillMaxWidth: 1, overlayFillMaxHeight: 99999 } },
      'sync'
    );
    const settings = await getSettings();
    assert.equal(settings.clickMode.overlayFillMaxWidth, 20);
    assert.equal(settings.clickMode.overlayFillMaxHeight, 2000);
    assert.equal(DEFAULT_SETTINGS.clickMode.overlayFillMaxWidth, 250);
    assert.equal(overlayFillExceedsMaxSize({ width: 251, height: 40 }, 250, 250), true);
    assert.equal(overlayFillExceedsMaxSize({ width: 40, height: 251 }, 250, 250), true);
    assert.equal(overlayFillExceedsMaxSize({ width: 250, height: 250 }, 250, 250), false);
  });

  it('normalizes deferred-open ranges and preserves independent action settings', async () => {
    const { getSettings, setSettings, SETTINGS_STORAGE_KEY } =
      await import('../extension/src/modules/settings-manager.js');
    mock.seed(SETTINGS_STORAGE_KEY, {
      deferredOpen: {
        openUrls: { enabled: false, minMinutes: 5000, maxMinutes: 2 },
        randomBookmarks: { enabled: true, minMinutes: 0, maxMinutes: 9000 },
        target: 'originalWindow',
        silentRandomScheduling: false
      }
    }, 'sync');

    const normalized = await getSettings();
    assert.deepEqual(normalized.deferredOpen.openUrls, {
      enabled: false,
      minMinutes: 2,
      maxMinutes: 2880
    });
    assert.deepEqual(normalized.deferredOpen.randomBookmarks, {
      enabled: true,
      minMinutes: 1,
      maxMinutes: 2880
    });
    assert.equal(normalized.deferredOpen.enabled, false);
    assert.equal(normalized.deferredOpen.numberRowKeys, 'auto');
    assert.equal(normalized.deferredOpen.target, 'originalWindow');
    assert.equal(normalized.deferredOpen.silentRandomScheduling, false);

    const updated = await setSettings({
      deferredOpen: { openUrls: { enabled: true } }
    });
    assert.equal(updated.deferredOpen.openUrls.enabled, true);
    assert.equal(updated.deferredOpen.randomBookmarks.enabled, true);
    assert.equal(updated.deferredOpen.target, 'originalWindow');
    assert.equal(updated.deferredOpen.silentRandomScheduling, false);
    assert.equal(updated.deferredOpen.clickElement.enabled, true);
    assert.equal(updated.deferredOpen.clickElement.maxMinutes, 60);
    assert.equal(updated.deferredOpen.closeTab.enabled, true);
    assert.equal(updated.deferredOpen.closeTab.maxMinutes, 60);
    assert.equal(updated.deferredOpen.closeWindow.enabled, true);
    assert.equal(updated.deferredOpen.closeWindow.maxMinutes, 60);

    const silenced = await setSettings({
      deferredOpen: { silentRandomScheduling: true }
    });
    assert.equal(silenced.deferredOpen.silentRandomScheduling, true);
    assert.equal(silenced.deferredOpen.target, 'originalWindow');
  });

  it('resetAllSettings replaces stored values with defaults', async () => {
    const { setSettings, resetAllSettings, getSettings, DEFAULT_SETTINGS } =
      await import('../extension/src/modules/settings-manager.js');
    await setSettings({
      themeId: 'gx-er',
      clickMode: { focusColor: 'green', cursor: { sizePixels: 40 } },
      controlStrip: { visible: false, collapsed: false }
    });
    const reset = await resetAllSettings();
    assert.equal(reset.themeId, DEFAULT_SETTINGS.themeId);
    assert.equal(reset.clickMode.focusColor, DEFAULT_SETTINGS.clickMode.focusColor);
    assert.equal(reset.clickMode.cursor.sizePixels, DEFAULT_SETTINGS.clickMode.cursor.sizePixels);
    assert.equal(reset.controlStrip.visible, DEFAULT_SETTINGS.controlStrip.visible);
    assert.equal(reset.controlStrip.collapsed, DEFAULT_SETTINGS.controlStrip.collapsed);

    const again = await getSettings();
    assert.equal(again.themeId, DEFAULT_SETTINGS.themeId);
  });

  it('returns safe defaults when storage throws', async () => {
    const { getSettings, DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } =
      await import('../extension/src/modules/settings-manager.js');
    mock.seed(SETTINGS_STORAGE_KEY, { themeId: 'gx-er' }, 'sync');
    mock.setSyncThrows(true);
    mock.setLocalThrows(true);
    const settings = await getSettings();
    assert.equal(settings.themeId, DEFAULT_SETTINGS.themeId);
    assert.equal(settings.clickMode.paintStrategy, DEFAULT_SETTINGS.clickMode.paintStrategy);
  });
});
