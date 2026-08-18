import { getSettings } from '../src/modules/settings-manager.js';
import { applyThemeToRoots, resolveThemeFromSettings } from '../src/modules/theme-manager.js';

try {
  void getSettings().then((settings) => {
    applyThemeToRoots(resolveThemeFromSettings(settings), {
      roots: [document],
      hosts: [document.documentElement]
    });
  }).catch(() => { /* ignore */ });
} catch { /* ignore */ }
