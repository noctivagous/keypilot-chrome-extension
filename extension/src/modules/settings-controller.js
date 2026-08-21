/**
 * Framework-neutral Settings state controller.
 * No DOM queries or element mutation.
 */

import { DEFAULT_SETTINGS, getSettings, resetAllSettings, setSettings, SETTINGS_STORAGE_KEY } from './settings-manager.js';
import { getTheme, getThemeClickDefaults, normalizeThemeId } from './theme-manager.js';
import { pathToPartial, setOverridePath } from './settings-path.js';

/**
 * @typedef {'all'|'appearance'|'click-cursor'|'click-mode'|'text-mode'|'text-cursor'|'scroll'} SettingsResetScope
 */

export class SettingsController {
  constructor() {
    /** @type {import('./settings-manager.js').KeyPilotSettings} */
    this.state = /** @type {any} */ ({ ...DEFAULT_SETTINGS });
    /** @type {Set<(state: any) => void>} */
    this._listeners = new Set();
    this._disposed = false;
    this._storageAttached = false;
    this._onStorageChanged = this._onStorageChanged.bind(this);
  }

  get disposed() {
    return this._disposed;
  }

  /**
   * @param {(state: any) => void} fn
   * @returns {() => void}
   */
  subscribe(fn) {
    if (typeof fn !== 'function' || this._disposed) return () => {};
    this._listeners.add(fn);
    return () => {
      this._listeners.delete(fn);
    };
  }

  _emit() {
    if (this._disposed) return;
    for (const fn of this._listeners) {
      try { fn(this.state); } catch { /* ignore */ }
    }
  }

  /**
   * @param {{ snapshot?: object|null }} [opts]
   */
  async load(opts = {}) {
    if (this._disposed) return this.state;
    const snap = opts.snapshot;
    if (snap && typeof snap === 'object') {
      this.state = /** @type {any} */ (snap);
    } else {
      this.state = await getSettings();
    }
    this._attachStorage();
    this._emit();
    return this.state;
  }

  _attachStorage() {
    if (this._storageAttached || this._disposed) return;
    try {
      if (!chrome?.storage?.onChanged?.addListener) return;
      chrome.storage.onChanged.addListener(this._onStorageChanged);
      this._storageAttached = true;
    } catch {
      // ignore
    }
  }

  /**
   * @param {Record<string, chrome.storage.StorageChange>} changes
   * @param {string} area
   */
  async _onStorageChanged(changes, area) {
    if (this._disposed) return;
    if (area !== 'sync' && area !== 'local') return;
    const entry = changes?.[SETTINGS_STORAGE_KEY];
    if (!entry) return;
    try {
      this.state = await getSettings();
      this._emit();
    } catch {
      if (entry.newValue && typeof entry.newValue === 'object') {
        this.state = /** @type {any} */ (entry.newValue);
        this._emit();
      }
    }
  }

  /**
   * @param {string} path
   * @param {any} value
   */
  async update(path, value) {
    if (this._disposed) return this.state;
    return this.updatePartial(pathToPartial(path, value));
  }

  /**
   * @param {Partial<import('./settings-manager.js').KeyPilotSettings>} partial
   */
  async updatePartial(partial) {
    if (this._disposed) return this.state;
    this.state = await setSettings(partial);
    this._emit();
    return this.state;
  }

  /**
   * @param {string} overridePath
   * @param {any} value
   */
  async updateThemeOverride(overridePath, value) {
    if (this._disposed) return this.state;
    const nextOverrides = setOverridePath(this.state?.themeOverrides, overridePath, value);
    return this.updatePartial({ themeOverrides: nextOverrides });
  }

  /**
   * @param {any} rawId
   */
  async applyThemePack(rawId) {
    if (this._disposed) return this.state;
    const themeId = normalizeThemeId(rawId);
    const theme = getTheme(themeId);
    const clickPatch = getThemeClickDefaults(theme);
    return this.updatePartial({
      themeId,
      themeOverrides: {},
      cursorMode: clickPatch.cursorMode,
      clickMode: clickPatch.clickMode,
      clickModeThemeId: themeId
    });
  }

  /**
   * @param {SettingsResetScope} scope
   */
  async reset(scope) {
    if (this._disposed) return this.state;
    switch (scope) {
      case 'all':
        this.state = await resetAllSettings();
        this._emit();
        return this.state;
      case 'appearance':
        return this.updatePartial({ themeOverrides: {} });
      case 'click-cursor': {
        const defaults = getThemeClickDefaults(getTheme(this.state?.themeId));
        return this.updatePartial({
          clickMode: { cursor: { ...defaults.clickMode.cursor } }
        });
      }
      case 'click-mode': {
        const defaults = getThemeClickDefaults(getTheme(this.state?.themeId));
        const { cursor: _cursor, ...clickModeDefaults } = defaults.clickMode;
        return this.updatePartial({ clickMode: { ...clickModeDefaults } });
      }
      case 'text-cursor':
        return this.updatePartial({
          textMode: { cursorType: DEFAULT_SETTINGS.textMode.cursorType }
        });
      case 'text-mode':
        return this.updatePartial({ textMode: { ...DEFAULT_SETTINGS.textMode } });
      case 'scroll':
        return this.updatePartial({ scroll: { ...DEFAULT_SETTINGS.scroll } });
      default:
        return this.state;
    }
  }

  dispose() {
    this._disposed = true;
    this._listeners.clear();
    if (this._storageAttached) {
      try {
        chrome.storage.onChanged.removeListener(this._onStorageChanged);
      } catch { /* ignore */ }
      this._storageAttached = false;
    }
  }
}

/**
 * @returns {SettingsController}
 */
export function createSettingsController() {
  return new SettingsController();
}
