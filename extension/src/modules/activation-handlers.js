/**
 * Activation / Open Popover key handlers mixed onto KeyPilot (F / G / B / E).
 * Semantic DOM click implementation remains in ActivationHandler.
 * Layout dispatch stays `this[handler]()`; these methods run with KeyPilot as `this`.
 */
import { COLORS, MODES } from '../config/constants.js';
import { MSG } from '../messaging/types.js';
import { closestComposed, containsComposed } from '../ui/kp-chrome-shadow.js';
import { pinKeyPopover } from '../ui/keybindings-ui.js';
import { findMapSurfaceAtPoint } from '../utils/map-surface-drag.js';
import { noteExtensionContextError } from '../utils/extension-context.js';

/** @param {Function} Base */
export function withActivationHandlers(Base) {
  return class ActivationHandlers extends Base {
  handleActivateKey() {
    const currentState = this.state.getState();
    const x = currentState.lastMouse.x;
    const y = currentState.lastMouse.y;

    // Cross-origin iframes (Google account switcher, etc.): forward into the frame.
    if (this._tryActivateIframeUnderCursor(x, y, {})) {
      this.showRipple(x, y);
      this.emitAction('activate', { viaIframe: true });
      return;
    }

    const target = this._getValidatedActivationTarget(currentState);

    if (!target || target === document.documentElement || target === document.body) {
      return;
    }

    // Popover mode is modal: don't allow activation on background page elements.
    if (currentState.mode === MODES.POPOVER) {
      if (!this._isElementInPopover(target)) {
        return;
      }
    }

    console.log('[KeyPilot] Activating element:', {
      tagName: target.tagName,
      className: target.className,
      id: target.id,
      hasClickHandler: !!(target.onclick || target.getAttribute('onclick'))
    });

    const activationDetail = this._buildActivationDetail(target);
    // Onboarding "click a link" also accepts a successful F on the blue focus-outline
    // target — many clickables look like links but don't navigate (or aren't <a>).
    try {
      const focus = currentState.focusEl;
      if (
        focus instanceof Element &&
        target instanceof Element &&
        (focus === target || containsComposed(focus, target) || containsComposed(target, focus))
      ) {
        activationDetail.hadFocusOutline = true;
      }
    } catch { /* ignore */ }

    // Store coordinates if this is a link click
    if (target.tagName === 'A' && target.href) {
      this.mouseCoordinateManager.handleLinkClick(x, y, target);
    }

    this._flashThenActivate(target, () => {
      if (!this.activator.handleSmartActivate(target, x, y)) {
        this.activator.smartClick(target, x, y);
      }
      this.postClickRefresh(target, x, y);
      this.emitAction('activate', activationDetail);
      if (activationDetail.isKeyboardHelpKey) {
        try {
          const keyEl = closestComposed(target, '[data-kp-action-id]');
          const actionId = keyEl?.dataset?.kpActionId;
          if (actionId) pinKeyPopover(actionId, { keyEl, keybindings: this.keybindings });
        } catch { /* ignore */ }
      }
    });
  }

  handleActivateNewTabKey() {
    const currentState = this.state.getState();
    const x = currentState.lastMouse.x;
    const y = currentState.lastMouse.y;

    if (this._tryActivateIframeUnderCursor(x, y, { openInNewTab: true })) {
      this.showRipple(x, y);
      this.emitAction('activateNewTab', { viaIframe: true });
      return;
    }

    const target = this._getValidatedActivationTarget(currentState);

    if (!target || target === document.documentElement || target === document.body) {
      this._flashNewTabUnavailable(target, x, y);
      return;
    }

    // Popover mode is modal: don't allow activation on background page elements.
    if (currentState.mode === MODES.POPOVER) {
      if (!this._isElementInPopover(target)) {
        this._flashNewTabUnavailable(target, x, y);
        return;
      }
    }

    console.log('[KeyPilot] Activating element in new tab:', {
      tagName: target.tagName,
      className: target.className,
      id: target.id,
      hasClickHandler: !!(target.onclick || target.getAttribute('onclick'))
    });

    // Ancestor <a href> / data-kp-url, else a descendant permalink on a card
    // (X/Mastodon feed posts: body is not wrapped in a link).
    let link = target;
    let url = null;
    const resolvedNewTab = this._resolveHoveredLink(target);
    if (resolvedNewTab?.url) {
      url = resolvedNewTab.url;
      link = resolvedNewTab.link;
    }

    const mx = currentState.lastMouse.x;
    const my = currentState.lastMouse.y;

    if (!url) {
      this._flashNewTabUnavailable(target, mx, my);
      return;
    }

    this.mouseCoordinateManager.handleLinkClick(mx, my, link);

    this._flashThenActivate(link, () => {
      try {
        if (this._sendRuntimeMessage({ type: MSG.OPEN_URL_FOREGROUND, url })) {
          this.postClickRefresh(link, mx, my);
          this.emitAction('activateNewTab', { isLink: true, href: url });
          return;
        }
      } catch (error) {
        if (noteExtensionContextError(error)) {
          this._handleExtensionContextInvalidated();
        } else {
          console.error('[KeyPilot] Failed to open link in foreground tab:', error);
        }
      }
      this._activateNewTabFallback(target, mx, my);
    });
  }

  /**
   * Visual "this will not open a tab" cue: dashed orange outline on the hover
   * box, or a small cursor square when nothing interactive is under the pointer.
   * @param {Element|null|undefined} target
   * @param {number} [x]
   * @param {number} [y]
   */
  _flashNewTabUnavailable(target, x, y) {
    const el =
      (target instanceof Element &&
        target !== document.documentElement &&
        target !== document.body)
        ? target
        : null;
    try {
      this.overlayManager?.flashDeniedDashOutline?.(el, { x, y });
    } catch { /* ignore */ }
  }

  _activateNewTabFallback(target, x, y) {
    if (this.activator.handleSmartActivate(target, x, y, true)) {
      this.postClickRefresh(target, x, y);
      this.emitAction('activateNewTab', this._buildActivationDetail(target));
      return;
    }
    this.activator.smartClick(target, x, y, true);
    this.postClickRefresh(target, x, y);
    this.emitAction('activateNewTab', this._buildActivationDetail(target));
  }

  handleActivateNewTabBackgroundKey() {
    const currentState = this.state.getState();
    const x = currentState.lastMouse.x;
    const y = currentState.lastMouse.y;

    if (this._tryActivateIframeUnderCursor(x, y, { background: true, openInNewTab: true })) {
      this.showRipple(x, y);
      this.emitAction('activateNewTabBackground', { viaIframe: true });
      return;
    }

    const target = this._getValidatedActivationTarget(currentState);

    if (!target || target === document.documentElement || target === document.body) {
      this._flashNewTabUnavailable(target, x, y);
      return;
    }

    // Popover mode is modal: don't allow activation on background page elements.
    if (currentState.mode === MODES.POPOVER) {
      if (!this._isElementInPopover(target)) {
        this._flashNewTabUnavailable(target, x, y);
        return;
      }
    }

    let link = target;
    let url = null;
    const resolvedBg = this._resolveHoveredLink(target);
    if (resolvedBg?.url) {
      url = resolvedBg.url;
      link = resolvedBg.link;
    }

    // Only work if we have a URL
    if (!url) {
      console.log('[KeyPilot] Activate New Tab Background: not hovering over a hyperlink');
      this._flashNewTabUnavailable(target, x, y);
      return;
    }

    console.log('[KeyPilot] Opening link in new tab (background):', url);

    // Store coordinates for link click
    this.mouseCoordinateManager.handleLinkClick(currentState.lastMouse.x, currentState.lastMouse.y, link);

    this._flashThenActivate(link, () => {
      try {
        if (this._sendRuntimeMessage({ type: MSG.OPEN_URL_BACKGROUND, url })) {
          this.postClickRefresh(link, currentState.lastMouse.x, currentState.lastMouse.y);
          this.emitAction('activateNewTabBackground', { isLink: true, href: url });
          return;
        }
        try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { /* ignore */ }
      } catch (error) {
        if (noteExtensionContextError(error)) {
          this._handleExtensionContextInvalidated();
        } else {
          console.error('[KeyPilot] Failed to open link in background tab:', error);
        }
        try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { /* ignore */ }
      }
    });
  }

  handleOpenPopover(e) {
    if (!this._allowActionKey('handleOpenPopover', e)) return;
    // Check if popover is already open - if so, close it (toggle behavior)
    if (this.overlayManager.isPopoverOpen()) {
      this._closeMapSitePopover();
      return;
    }

    const currentState = this.state.getState();
    const { lastMouse } = currentState;

    const mx = Number(lastMouse?.x);
    const my = Number(lastMouse?.y);
    const px = Number.isFinite(mx) ? mx : (window.innerWidth || 0) / 2;
    const py = Number.isFinite(my) ? my : (window.innerHeight || 0) / 2;
    const onMap = this.isOnMapWebsite() || !!findMapSurfaceAtPoint(px, py);
    if (onMap) {
      void this._resolvePoiWebsiteAtPoint(px, py).then((poiUrl) => {
        if (!poiUrl) {
          this.showFlashNotification('No website for this place', COLORS.NOTIFICATION_INFO);
          return;
        }
        this._openFullPopover(poiUrl);
      }).catch(() => {
        this.showFlashNotification('No website for this place', COLORS.NOTIFICATION_INFO);
      });
      return;
    }

    // Prefer DOM-hover focusEl; fall back to elementFromPoint when nothing is hovered.
    let target = currentState.focusEl;
    if (!target) {
      const under = this.detector.deepElementFromPoint(lastMouse.x, lastMouse.y);
      target = this.detector.findClickable(under);
    }

    if (!target || !(target instanceof Element)) {
      console.log('[KeyPilot] Open popover: not hovering over a link');
      return;
    }

    const resolvedPopover = this._resolveHoveredLink(target);
    const url = resolvedPopover?.url || null;

    if (!url) {
      console.log('[KeyPilot] Open popover: not hovering over a link');
      return;
    }
    console.log('[KeyPilot] Opening popover for link:', url);

    // Show popover
    this.overlayManager.showPopover(url);
    this.state.setPopoverOpen(true, url);
  }

  };
}
