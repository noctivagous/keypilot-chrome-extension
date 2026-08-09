/**
 * Keyboard layout edit-mode orchestrator (Alt+C).
 *
 * Opens the Keyboard Reference in edit mode and a compact Keyboard Layout Config
 * floating panel (palette + CRUD). The keyboard itself is edited on the Reference.
 */

import { KeyboardLayoutConfigPanel } from './keyboard-layout-config-panel.js';
import { unpinKeyPopover } from './keybindings-ui.js';
import { getSharedFunctionLibraryPanel } from './function-library-panel.js';

/** @type {KeyboardLayoutConfigPanel|null} */
let _configPanel = null;

/**
 * @param {any} kp KeyPilot instance
 * @returns {boolean}
 */
export function isKeyboardLayoutEditMode(kp) {
  try {
    return !!(kp?.floatingKeyboardHelp && typeof kp.floatingKeyboardHelp.isEditMode === 'function'
      && kp.floatingKeyboardHelp.isEditMode());
  } catch {
    return false;
  }
}

/**
 * Exit edit mode and hide the config panel.
 * @param {any} kp
 */
export function exitKeyboardLayoutEditMode(kp) {
  try {
    if (_configPanel) _configPanel.hide();
  } catch { /* ignore */ }
  try {
    getSharedFunctionLibraryPanel().hide();
  } catch { /* ignore */ }
  try {
    kp?.floatingKeyboardHelp?.setEditMode?.(false);
  } catch { /* ignore */ }
  // Ensure live key dispatch matches the last saved layout (no page refresh).
  try {
    void kp?._refreshCurrentKeyboardLayoutFromSettings?.();
  } catch { /* ignore */ }
}

/**
 * Toggle layout edit mode: Keyboard Reference becomes the edit surface;
 * Keyboard Layout Config supplies functions/macros.
 * @param {any} kp KeyPilot instance
 */
export function toggleKeyboardLayoutConfigurator(kp) {
  if (!kp) return;

  try {
    if (isKeyboardLayoutEditMode(kp)) {
      exitKeyboardLayoutEditMode(kp);
      return;
    }

    // Ensure Keyboard Reference is visible (edit surface).
    try {
      if (typeof kp.applyKeyboardHelpVisibility === 'function') {
        kp.applyKeyboardHelpVisibility(true, { persist: false });
      } else {
        kp.floatingKeyboardHelp?.show?.();
      }
    } catch { /* ignore */ }

    try { unpinKeyPopover(); } catch { /* ignore */ }

    if (!_configPanel) {
      _configPanel = new KeyboardLayoutConfigPanel({
        onChange: ({ state }) => {
          try {
            kp.floatingKeyboardHelp?.setEditLayout?.(state);
          } catch { /* ignore */ }
        },
        onClose: () => {
          try { kp.floatingKeyboardHelp?.setEditMode?.(false); } catch { /* ignore */ }
          try { void kp?._refreshCurrentKeyboardLayoutFromSettings?.(); } catch { /* ignore */ }
        }
      });
    }

    const help = kp.floatingKeyboardHelp;
    if (help && typeof help.setEditMode === 'function') {
      help.setEditMode(true, {
        getConfigPanel: () => _configPanel,
        onLayoutPersisted: (layout) => {
          try { _configPanel?.syncUserLayout?.(layout); } catch { /* ignore */ }
          try {
            const st = _configPanel?.getState?.();
            void kp?.applyLiveUserLayout?.(layout, {
              macros: st?.macros,
              actions: st?.actions
            });
          } catch { /* ignore */ }
        }
      });
    }

    void _configPanel.show(kp).then(() => {
      try {
        kp.floatingKeyboardHelp?.setEditLayout?.(_configPanel.getState());
      } catch { /* ignore */ }
    });

    // Function Library browser — additive alongside the drag-drop palette above.
    // See KEY_ACTION_ARCHITECTURE.md "Migration mapping" for why this is a separate panel today.
    void getSharedFunctionLibraryPanel().show(kp);
  } catch {
    // ignore
  }
}
