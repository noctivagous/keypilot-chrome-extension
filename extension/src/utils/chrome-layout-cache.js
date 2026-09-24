/**
 * document_start chrome layout cache (control strip + Keyboard Reference).
 * localStorage is origin-scoped, so cache only visual layout that is safe to
 * restore locally before chrome.storage resolves.
 */

export const CHROME_LAYOUT_CACHE_KEY = 'kp_chrome_layout_v1';

/**
 * @returns {{
 *   panelPositions?: {
 *     controlStrip?: { left?: number, top?: number, anchor?: string|null },
 *     keyboardReference?: { left?: number, top?: number, anchor?: string|null }
 *   },
 *   controlStrip?: { visible?: boolean, collapsed?: boolean },
 *   keyboardReferenceCollapsed?: boolean
 * }|null}
 */
export function peekChromeLayoutCache() {
  try {
    const raw = localStorage.getItem(CHROME_LAYOUT_CACHE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} [patch]
 */
export function cacheChromeLayout(patch) {
  if (!patch || typeof patch !== 'object') return;
  try {
    const prev = peekChromeLayoutCache() || {};
    const next = { ...prev };
    if (patch.panelPositions && typeof patch.panelPositions === 'object') {
      next.panelPositions = {
        ...(prev.panelPositions || {}),
        ...patch.panelPositions
      };
    }
    if (patch.controlStrip && typeof patch.controlStrip === 'object') {
      next.controlStrip = {
        ...(prev.controlStrip || {}),
        ...patch.controlStrip
      };
    }
    if (typeof patch.keyboardReferenceCollapsed === 'boolean') {
      next.keyboardReferenceCollapsed = patch.keyboardReferenceCollapsed;
    }
    localStorage.setItem(CHROME_LAYOUT_CACHE_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}
