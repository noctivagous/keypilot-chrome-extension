import { getSettings, SETTINGS_STORAGE_KEY } from '../src/modules/settings-manager.js';
import { applyThemeToRoots, resolveThemeFromSettings } from '../src/modules/theme-manager.js';

function paintPopupTheme(settings) {
  applyThemeToRoots(resolveThemeFromSettings(settings), {
    roots: [document],
    hosts: [document.documentElement]
  });
}

try {
  void getSettings().then((settings) => {
    paintPopupTheme(settings);
  }).catch(() => { /* ignore */ });
} catch { /* ignore */ }

try {
  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area !== 'sync' && area !== 'local') return;
    const entry = changes?.[SETTINGS_STORAGE_KEY];
    if (!entry) return;
    const raw = entry.newValue;
    if (raw && typeof raw === 'object') {
      try { paintPopupTheme(raw); } catch { /* ignore */ }
    }
    void getSettings().then(paintPopupTheme).catch(() => { /* ignore */ });
  });
} catch { /* ignore */ }
