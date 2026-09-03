/**
 * Thin cross-origin iframe click + hover agent.
 *
 * Runs only in non-top frames. Stays light (no full KeyPilot):
 *  1. postMessage / runtime KP_FRAME_ACTIVATE from the parent (top-frame F/B/G)
 *  2. KP_FRAME_POINTER up to parent so top lastMouse stays fresh over iframes
 *     (parent documents do not receive mousemove inside embeds)
 *  3. Blue hover outline on clickable targets under the pointer (rAF-throttled;
 *     matches top-frame DOM-hover focus palette)
 *  4. postMessage / runtime KP_FRAME_SCROLL from parent (C/V/Z/X / Scroll Line under this iframe)
 *  5. Fallback activate/scroll keybinds only while this frame has document focus
 *     (after a manual click); Esc / pointer-leave posts KP_FRAME_FOCUS_RECLAIM
 *     so top KeyPilot regains keyboard ownership for elements outside the iframe
 *  6. KP_FRAME_TYPING_FOCUS / KP_FRAME_TYPING_BLUR so top KeyPilot can enter
 *     text mode when a contenteditable lives in this frame (Gutenberg canvas)
 *
 * Full KeyPilot still initializes only in the top frame. When full KP is also
 * running in this frame (KeyPilot popover), local key + hover + pointer sync
 * are skipped (popover hybrid focus owns that path).
 */

import { MSG } from '../messaging/types.js';
import { COLORS, CSS_CLASSES, SELECTORS, Z_INDEX, SCROLL } from '../config/constants.js';
import { isTypingContext, hasModifierKeys } from '../utils/dom-context.js';
import {
  buildEffectiveKeybindings,
  buildSystemKeybindings,
  DEFAULT_KEYBOARD_LAYOUT_ID,
  normalizeKeyboardLayoutId,
  resolveKeyboardLayoutId
} from '../config/keyboard-layouts.js';
import { getSettings, SETTINGS_STORAGE_KEY, scrollBehaviorFromSpeed, DEFAULT_SETTINGS } from './settings-manager.js';
import { scrollAtPoint, scrollToEdgeAtPoint, scrollByAtPoint, findScrollTargetAtPoint, scrollElementBy } from '../utils/scroll-at-point.js';
import { ScrollHoldController } from '../utils/scroll-hold.js';
import { deepElementFromPoint } from '../utils/element-from-point.js';
import { resolveHoveredLink } from '../utils/resolve-hovered-link.js';
import { containsComposed } from '../ui/kp-chrome-shadow.js';

/**
 * @typedef {{ openInNewTab?: boolean, background?: boolean, topOrigin?: string }} FrameActivateOptions
 */

const CLICKABLE_SEL =
  'a[href], button, [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], summary, [onclick], input, select, textarea, label';

/**
 * Read computed styles with KeyPilot custom-cursor override suspended so
 * cursor:pointer on the page is still visible when CUSTOM_CURSORS is on.
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
function withNativePageCursors(fn) {
  let html = null;
  try { html = document.documentElement; } catch { /* ignore */ }
  if (!html || !html.classList) return fn();
  const hadHidden = html.classList.contains(CSS_CLASSES.CURSOR_HIDDEN);
  if (hadHidden) {
    try { html.classList.remove(CSS_CLASSES.CURSOR_HIDDEN); } catch { /* ignore */ }
  }
  try {
    return fn();
  } finally {
    if (hadHidden) {
      try { html.classList.add(CSS_CLASSES.CURSOR_HIDDEN); } catch { /* ignore */ }
    }
  }
}

/**
 * @param {Element|null} el
 * @returns {Element|null}
 */
function resolveClickable(el) {
  if (!el || el.nodeType !== 1) return null;
  try {
    if (el.tagName === 'IFRAME') return el;
    if (el.id === 'kpv2-frame-hover' || el.closest?.('#kpv2-frame-hover')) return null;
    const specific = typeof el.closest === 'function' ? el.closest(CLICKABLE_SEL) : null;
    if (specific) return specific;
    // CSS cursor:pointer-only targets are a fallback in native-cursor mode.
    // Custom cursor mode forces a cursor with a document-wide !important rule;
    // temporarily dropping it to inspect this hint invalidates the entire frame's
    // styles for every hover transition. Keep hover responsive and rely on the
    // semantic selector above instead.
    try {
      if (el !== document.body && el !== document.documentElement) {
        if (document.documentElement?.classList?.contains(CSS_CLASSES.CURSOR_HIDDEN)) {
          return null;
        }
        return withNativePageCursors(() => {
          const cs = window.getComputedStyle(el);
          if (cs.cursor === 'pointer' && cs.pointerEvents !== 'none') {
            const parent = el.parentElement;
            if (!parent || window.getComputedStyle(parent).cursor !== 'pointer') {
              return el;
            }
          }
          return null;
        });
      }
    } catch { /* ignore */ }
    return null;
  } catch {
    return null;
  }
}

/**
 * Coordinate-carrying click sequence (mirrors ActivationHandler.dispatchClickSequence).
 * @param {EventTarget} target
 * @param {number} clientX
 * @param {number} clientY
 */
function dispatchClickSequence(target, clientX, clientY) {
  if (!target) return;

  const common = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX,
    clientY,
    button: 0,
    buttons: 1
  };

  const hasPointer = typeof window.PointerEvent === 'function';
  if (hasPointer) {
    const pCommon = { ...common, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    try { target.dispatchEvent(new PointerEvent('pointerover', pCommon)); } catch { /* ignore */ }
    try { target.dispatchEvent(new PointerEvent('pointerenter', pCommon)); } catch { /* ignore */ }
    try { target.dispatchEvent(new PointerEvent('pointerdown', pCommon)); } catch { /* ignore */ }
  } else {
    try { target.dispatchEvent(new MouseEvent('pointerover', common)); } catch { /* ignore */ }
    try { target.dispatchEvent(new MouseEvent('pointerenter', common)); } catch { /* ignore */ }
    try { target.dispatchEvent(new MouseEvent('pointerdown', common)); } catch { /* ignore */ }
  }

  try { target.dispatchEvent(new MouseEvent('mouseover', common)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('mouseenter', common)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('mousemove', common)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('mousedown', common)); } catch { /* ignore */ }

  const commonUp = { ...common, buttons: 0 };
  if (hasPointer) {
    const pUp = { ...commonUp, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    try { target.dispatchEvent(new PointerEvent('pointerup', pUp)); } catch { /* ignore */ }
  } else {
    try { target.dispatchEvent(new MouseEvent('pointerup', commonUp)); } catch { /* ignore */ }
  }
  try { target.dispatchEvent(new MouseEvent('mouseup', commonUp)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('click', commonUp)); } catch { /* ignore */ }
}

/**
 * @param {Element|null} el
 * @returns {HTMLAnchorElement|null}
 */
function closestLink(el) {
  try {
    const found = resolveHoveredLink(el);
    if (found?.link && found.link.tagName === 'A') {
      return /** @type {HTMLAnchorElement} */ (found.link);
    }
    if (!el || el.nodeType !== 1) return null;
    if (el.tagName === 'A' && /** @type {HTMLAnchorElement} */ (el).href) {
      return /** @type {HTMLAnchorElement} */ (el);
    }
    const a = typeof el.closest === 'function' ? el.closest('a[href]') : null;
    return a && a.tagName === 'A' ? /** @type {HTMLAnchorElement} */ (a) : null;
  } catch {
    return null;
  }
}

/**
 * Find a <video>/<audio> at the hit target or in the paint stack under the cursor.
 * X/Twitter center play overlays sit ABOVE the <video> — elementsFromPoint finds
 * media underneath. Do not search distant ancestors (that steals every embed click).
 * @param {Element|null} el
 * @param {number} [clientX]
 * @param {number} [clientY]
 * @returns {HTMLMediaElement|null}
 */
function findMediaAtPoint(el, clientX, clientY) {
  const asMedia = (node) => {
    try {
      if (!node || node.nodeType !== 1) return null;
      const tag = node.tagName;
      if (tag === 'VIDEO' || tag === 'AUDIO') return /** @type {HTMLMediaElement} */ (node);
    } catch { /* ignore */ }
    return null;
  };

  let found = asMedia(el);
  if (found) return found;

  try {
    const close = el && typeof el.closest === 'function' ? el.closest('video, audio') : null;
    if (close) return /** @type {HTMLMediaElement} */ (close);
  } catch { /* ignore */ }

  if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
    try {
      const stack = typeof document.elementsFromPoint === 'function'
        ? document.elementsFromPoint(clientX, clientY)
        : [];
      for (let i = 0; i < stack.length; i++) {
        const m = asMedia(stack[i]);
        if (m) return m;
      }
    } catch { /* ignore */ }
  }

  return null;
}

/**
 * @param {Element|null} el
 * @param {HTMLMediaElement|null} media
 * @returns {boolean}
 */
function isDirectMediaHit(el, media) {
  if (!el || !media) return false;
  try {
    if (el === media) return true;
    if (el.tagName === 'VIDEO' || el.tagName === 'AUDIO') return true;
    if (typeof media.contains === 'function' && media.contains(el)) return true;
  } catch { /* ignore */ }
  return false;
}

/**
 * Center play/pause overlay — not tweet links or social action buttons.
 * @param {Element|null} el
 * @param {Element|null} activator
 * @returns {boolean}
 */
function isPlayOverlayControl(el, activator) {
  /** @type {Element[]} */
  const nodes = [];
  if (activator && activator.nodeType === 1) nodes.push(activator);
  if (el && el.nodeType === 1) nodes.push(el);
  try {
    const b = el && typeof el.closest === 'function'
      ? el.closest('button, [role="button"]')
      : null;
    if (b) nodes.push(b);
  } catch { /* ignore */ }

  for (const c of nodes) {
    if (!c || c.nodeType !== 1) continue;
    try {
      if (c.tagName === 'A' && /** @type {HTMLAnchorElement} */ (c).href) continue;
    } catch { /* ignore */ }

    let label = '';
    try {
      label = `${c.getAttribute?.('aria-label') || ''} ${c.getAttribute?.('title') || ''} ${c.getAttribute?.('data-testid') || ''}`.toLowerCase();
    } catch { /* ignore */ }

    if (/like|reply|repost|retweet|share|follow|bookmark|menu|more|comment|profile/.test(label)) {
      continue;
    }
    if (/play|pause|replay|watch/.test(label)) return true;

    try {
      const tag = c.tagName;
      const role = (c.getAttribute?.('role') || '').toLowerCase();
      if (tag !== 'BUTTON' && role !== 'button') continue;
      if (c === el || c === activator || (typeof c.contains === 'function' && el && c.contains(el))) {
        return true;
      }
    } catch { /* ignore */ }
  }
  return false;
}

/**
 * @param {HTMLMediaElement} media
 * @returns {boolean}
 */
function toggleMediaPlayback(media) {
  if (!media) return false;
  try {
    if (media.paused) {
      const p = media.play();
      if (p && typeof p.then === 'function') {
        p.catch(() => {
          // Cross-frame activate arrives via postMessage and often lacks a user
          // gesture; muted play is usually allowed (X embeds are muted by default).
          try {
            media.muted = true;
            const p2 = media.play();
            if (p2 && typeof p2.catch === 'function') p2.catch(() => { /* ignore */ });
          } catch { /* ignore */ }
        });
      }
    } else {
      media.pause();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} url
 * @param {{ background?: boolean }} opts
 * @returns {boolean}
 */
function openUrlViaRuntime(url, opts = {}) {
  if (!url) return false;
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return false;
    const type = opts.background ? MSG.OPEN_URL_BACKGROUND : MSG.OPEN_URL_FOREGROUND;
    chrome.runtime.sendMessage({ type, url }).catch(() => { /* ignore */ });
    return true;
  } catch {
    return false;
  }
}

/**
 * Same-tab navigation via the service worker (bypasses iframe sandbox top-nav
 * user-activation restrictions that block synthetic link.click()).
 * @param {string} url
 * @returns {boolean}
 */
function navigateSameTabViaRuntime(url) {
  if (!url) return false;
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return false;
    chrome.runtime.sendMessage({ type: MSG.NAVIGATE_SAME_TAB, url }).catch(() => { /* ignore */ });
    return true;
  } catch {
    return false;
  }
}

/**
 * Absolute http(s) href for a link, or null.
 * @param {HTMLAnchorElement|Element|null|undefined} link
 * @returns {string|null}
 */
function resolveHttpHref(link) {
  if (!link) return null;
  try {
    const href = /** @type {HTMLAnchorElement} */ (link).href;
    if (!href) return null;
    const u = new URL(href, location.href);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * @param {HTMLAnchorElement|Element} link
 * @returns {string}
 */
function getLinkBrowsingContextTarget(link) {
  try {
    return String(link.getAttribute?.('target') || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

/**
 * In a child frame, prefer extension navigation when synthetic click cannot
 * perform the intended browsing-context change:
 * - target=_top / _parent (sandbox often requires a real user gesture)
 * - href origin differs from this frame (don't trap foreign sites inside the embed)
 *
 * Same-origin path navigations stay on link.click() so in-frame SPAs keep working.
 * `topOrigin` is threaded from the parent for future use; not applied as a path rewrite.
 *
 * @param {HTMLAnchorElement} link
 * @param {{ topOrigin?: string }} [ctx]
 * @returns {string|null} absolute URL to navigate via SW, or null to use link.click()
 */
function runtimeNavigateUrlForFrameLink(link, ctx = {}) {
  try {
    if (window === window.top) return null;
  } catch {
    // Access to top can throw — treat as framed.
  }

  const url = resolveHttpHref(link);
  if (!url) return null;

  const target = getLinkBrowsingContextTarget(link);
  if (target === '_top' || target === '_parent') {
    return url;
  }

  try {
    if (new URL(url).origin !== location.origin) {
      return url;
    }
  } catch {
    return null;
  }

  void ctx.topOrigin;
  return null;
}

/**
 * True when full KeyPilot is running in this frame (e.g. KP popover iframe).
 * @returns {boolean}
 */
function hasFullKeyPilot() {
  try {
    return !!(window.keyPilot || window.__KeyPilotInstance || window.__KeyPilotToggleHandler);
  } catch {
    return false;
  }
}

/**
 * Find an iframe/frame element whose contentWindow is `win`.
 * Window reference equality works across origins.
 * @param {Window|null|undefined} win
 * @returns {HTMLIFrameElement|HTMLFrameElement|null}
 */
function findIframeByContentWindow(win) {
  if (!win) return null;
  try {
    const nodes = document.querySelectorAll('iframe, frame');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      try {
        if (el && el.contentWindow === win) {
          return /** @type {HTMLIFrameElement|HTMLFrameElement} */ (el);
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * True when this frame's document currently owns keyboard focus.
 * @returns {boolean}
 */
function frameHasKeyboardFocus() {
  try {
    if (typeof document.hasFocus === 'function' && document.hasFocus()) return true;
  } catch { /* ignore */ }
  return false;
}

/**
 * Install the frame click agent in a child frame.
 * @returns {{ dispose: () => void }|null}
 */
export function installFrameClickAgent() {
  try {
    if (window === window.top) return null;

    /** @type {boolean} */
    let enabled = true;
    /** @type {{ x: number|null, y: number|null }} */
    let lastMouse = { x: null, y: null };
    /** @type {ReturnType<typeof buildEffectiveKeybindings>} */
    let keybindings = buildEffectiveKeybindings(DEFAULT_KEYBOARD_LAYOUT_ID);
    /** @type {number} */
    let halfPagePx = SCROLL.HALF_PAGE_PX;
    /** @type {'smooth'|'auto'} */
    let scrollBehavior = SCROLL.BEHAVIOR === 'smooth' ? 'smooth' : 'auto';
    /** @type {{ el: Element, axis: 'x'|'y' }|null} */
    let scrollHoldLock = null;
    const scrollHold = new ScrollHoldController({
      apply: ({ deltaPx, target }) => {
        const t = target || scrollHoldLock;
        if (!t?.el) return;
        const axis = t.axis === 'x' ? 'x' : 'y';
        scrollElementBy(t.el, axis === 'x' ? deltaPx : 0, axis === 'y' ? deltaPx : 0, 'auto');
      }
    });

    /** @type {HTMLElement|null} */
    let hoverEl = null;
    /** @type {Element|null} */
    let hoverTarget = null;
    /** @type {number} */
    let hoverRaf = 0;
    /** @type {boolean} */
    let pointerInside = false;
    /** @type {number} */
    let pointerSyncRaf = 0;
    /** @type {number} */
    let lastPointerPostedX = NaN;
    /** @type {number} */
    let lastPointerPostedY = NaN;
    /** @type {{ focusColor: string, overlayFillEnabled: boolean, overlayShadowEnabled: boolean, rectangleThickness: number }} */
    let focusChrome = {
      focusColor: 'blue',
      overlayFillEnabled: false,
      overlayShadowEnabled: false,
      rectangleThickness: 3
    };
    /** Parent tab origin from KP_FRAME_ACTIVATE (for future link aliasing). */
    /** @type {string} */
    let lastTopOrigin = '';

    /**
     * Ask parent to take keyboard focus back (top KeyPilot owns keys).
     * Only postMessage — do not call parent.focus() or blur here. Focusing the
     * parent dismisses Google account / similar iframes that close on blur.
     */
    const requestFocusReclaim = () => {
      if (!enabled) return;
      try {
        window.parent.postMessage({ type: MSG.FRAME_FOCUS_RECLAIM }, '*');
      } catch { /* ignore */ }
    };

    /** @type {boolean|null} last typing-focus post (avoid duplicate messages) */
    let lastTypingPosted = null;

    /**
     * Tell top-frame FocusDetector that this document's typing focus changed.
     * Parent peeks same-origin activeElement; we do not send the node.
     * @param {boolean} typing
     */
    const postTypingToParent = (typing) => {
      if (!enabled) return;
      if (hasFullKeyPilot()) return;
      const next = !!typing;
      // Always re-post FOCUS so the parent can switch fields (title → paragraph).
      // Only coalesce repeated BLUR.
      if (!next && lastTypingPosted === false) return;
      lastTypingPosted = next;
      try {
        window.parent.postMessage({
          type: next ? MSG.FRAME_TYPING_FOCUS : MSG.FRAME_TYPING_BLUR
        }, '*');
      } catch { /* ignore */ }
    };

    const syncTypingFocusToParent = () => {
      if (!enabled || hasFullKeyPilot()) return;
      try {
        postTypingToParent(isTypingContext(document.activeElement));
      } catch {
        postTypingToParent(false);
      }
    };

    /** @param {FocusEvent} [e] */
    const onFocusIn = (e) => {
      try {
        if (!enabled || hasFullKeyPilot()) return;
        if (isTypingContext(e?.target) || isTypingContext(document.activeElement)) {
          postTypingToParent(true);
        }
      } catch { /* ignore */ }
    };

    const onFocusOut = () => {
      try {
        if (!enabled || hasFullKeyPilot()) return;
        setTimeout(syncTypingFocusToParent, 0);
      } catch { /* ignore */ }
    };

    /**
     * Nested agents post to this frame; re-bubble typing notices to the top.
     * @param {MessageEvent} event
     * @param {any} data
     * @returns {boolean}
     */
    const bubbleChildTyping = (event, data) => {
      if (!data || (data.type !== MSG.FRAME_TYPING_FOCUS && data.type !== MSG.FRAME_TYPING_BLUR)) {
        return false;
      }
      try {
        if (event.source === window) return false;
      } catch { /* ignore */ }
      if (!enabled || hasFullKeyPilot()) return true;
      try {
        window.parent.postMessage({ type: data.type }, '*');
      } catch { /* ignore */ }
      return true;
    };

    /**
     * @param {boolean} inside
     * @param {number} [clientX]
     * @param {number} [clientY]
     */
    const postPointerToParent = (inside, clientX, clientY) => {
      // Never talk to the parent while KeyPilot is off — leave posts were
      // dismissing Google account menus on toggle-off.
      if (!enabled) return;
      // Popover full-KP path owns pointer/focus; don't fight hybrid focus.
      if (hasFullKeyPilot()) return;
      try {
        if (inside) {
          const x = Number(clientX);
          const y = Number(clientY);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;
          // Skip no-op posts (sub-pixel noise).
          if (
            Math.abs(x - lastPointerPostedX) < 0.5 &&
            Math.abs(y - lastPointerPostedY) < 0.5
          ) {
            return;
          }
          lastPointerPostedX = x;
          lastPointerPostedY = y;
          window.parent.postMessage({
            type: MSG.FRAME_POINTER,
            inside: true,
            clientX: x,
            clientY: y
          }, '*');
        } else {
          lastPointerPostedX = NaN;
          lastPointerPostedY = NaN;
          window.parent.postMessage({
            type: MSG.FRAME_POINTER,
            inside: false
          }, '*');
        }
      } catch { /* ignore */ }
    };

    const schedulePointerSync = () => {
      if (pointerSyncRaf) return;
      pointerSyncRaf = requestAnimationFrame(() => {
        pointerSyncRaf = 0;
        try {
          if (!enabled || !pointerInside || hasFullKeyPilot()) return;
          const x = lastMouse.x;
          const y = lastMouse.y;
          if (typeof x !== 'number' || typeof y !== 'number') return;
          postPointerToParent(true, x, y);
        } catch { /* ignore */ }
      });
    };

    /**
     * Re-bubble a child frame's pointer report with coords local to this frame.
     * @param {MessageEvent} event
     * @param {any} data
     * @returns {boolean}
     */
    const bubbleChildPointer = (event, data) => {
      if (!data || data.type !== MSG.FRAME_POINTER) return false;
      if (!enabled) return true; // swallow while off — do not re-bubble
      try {
        if (event.source === window) return false;
      } catch { /* ignore */ }
      if (hasFullKeyPilot()) return true;

      if (data.inside === false) {
        // Nested child left; if the pointer is still in *this* frame, keep reporting.
        if (pointerInside && typeof lastMouse.x === 'number' && typeof lastMouse.y === 'number') {
          lastPointerPostedX = NaN;
          lastPointerPostedY = NaN;
          postPointerToParent(true, lastMouse.x, lastMouse.y);
        } else {
          postPointerToParent(false);
        }
        return true;
      }

      const childFrame = findIframeByContentWindow(/** @type {Window} */ (event.source));
      if (!childFrame) return false;
      let rect;
      try {
        rect = childFrame.getBoundingClientRect();
      } catch {
        return false;
      }
      const x = rect.left + Number(data.clientX);
      const y = rect.top + Number(data.clientY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      postPointerToParent(true, x, y);
      return true;
    };

    const paletteFor = (color) => {
      if (color === 'green') {
        return {
          border: COLORS.FOCUS_GREEN || 'rgba(0,180,0,0.95)',
          shadow: COLORS.GREEN_SHADOW || 'rgba(0,180,0,0.45)',
          shadowBright: COLORS.GREEN_SHADOW_BRIGHT || 'rgba(0,180,0,0.5)',
          fill: COLORS.FOCUS_GREEN_BG_T2 || 'rgba(46, 204, 113, 0.4)'
        };
      }
      return {
        border: COLORS.FOCUS_BLUE || 'rgba(33,150,243,0.95)',
        shadow: COLORS.BLUE_SHADOW || 'rgba(33,150,243,0.35)',
        shadowBright: COLORS.BLUE_SHADOW_BRIGHT || 'rgba(33,150,243,0.45)',
        fill: COLORS.FOCUS_BLUE_BG_T2 || 'rgba(33,150,243,0.25)'
      };
    };

    const applyFocusChromeToHoverEl = (target = hoverTarget) => {
      if (!hoverEl) return;
      let isText = false;
      try {
        isText = !!(target && target.matches && target.matches(SELECTORS.FOCUSABLE_TEXT));
      } catch {
        isText = false;
      }
      const p = isText
        ? {
            border: COLORS.ORANGE,
            shadow: COLORS.ORANGE_SHADOW,
            shadowBright: COLORS.ORANGE_SHADOW,
            fill: 'transparent'
          }
        : paletteFor(focusChrome.focusColor);
      const thickness = Math.min(Math.max(Number(focusChrome.rectangleThickness) || 3, 1), 16);
      try {
        hoverEl.style.border = `${thickness}px solid ${p.border}`;
        hoverEl.style.background = isText || focusChrome.overlayFillEnabled === false
          ? 'transparent'
          : p.fill;
        hoverEl.style.boxShadow = focusChrome.overlayShadowEnabled === false
          ? 'none'
          : `0 0 0 1px ${p.shadow}, 0 0 8px ${p.shadowBright}`;
      } catch { /* ignore */ }
    };

    const keyIn = (assignment, key) => {
      try {
        const keys = assignment?.keys;
        return Array.isArray(keys) && keys.includes(key);
      } catch {
        return false;
      }
    };

    const refreshKeybindings = async () => {
      try {
        const settings = await getSettings();
        // Exclusive user layouts are top-frame only: skip built-in KP key actions in child frames.
        const currentSel = String(settings?.currentKeyboardLayoutId || 'builtin');
        if (currentSel.startsWith('user:')) {
          // Exclusive user layouts: only the always-on system layer in child frames.
          keybindings = buildSystemKeybindings(settings?.keyboardHandedness);
        } else {
          const layoutId = resolveKeyboardLayoutId({
            familyId: settings?.keyboardLayoutFamilyId,
            handedness: settings?.keyboardHandedness
          }) || normalizeKeyboardLayoutId(settings?.keyboardLayoutId);
          keybindings = buildEffectiveKeybindings(layoutId, settings?.keyboardHandedness);
        }
        const cm = settings?.clickMode || {};
        focusChrome = {
          focusColor: cm.focusColor === 'green' ? 'green' : 'blue',
          overlayFillEnabled: cm.overlayFillEnabled === true,
          overlayShadowEnabled: cm.overlayShadowEnabled === true,
          rectangleThickness: Number(cm.rectangleThickness) || 3
        };
        const half = Number(settings?.scroll?.halfPagePx);
        if (Number.isFinite(half) && half > 0) halfPagePx = half;
        else halfPagePx = SCROLL.HALF_PAGE_PX;
        try {
          scrollBehavior = scrollBehaviorFromSpeed(
            settings?.scroll?.speed ?? DEFAULT_SETTINGS.scroll.speed
          );
        } catch {
          scrollBehavior = SCROLL.BEHAVIOR === 'smooth' ? 'smooth' : 'auto';
        }
        applyFocusChromeToHoverEl();
        if (pointerInside && enabled) scheduleHoverUpdate();
      } catch {
        // keep previous / default
      }
    };

    /**
     * C / V (delta) or Z / X (edge) scroll under the pointer.
     * @param {number} clientX
     * @param {number} clientY
     * @param {number} sign  -1 up/left, +1 down/right
     * @param {number} [deltaPx]
     * @param {ScrollBehavior} [behavior]
     * @param {'delta'|'edge'|'xy'} [mode='delta']
     * @param {{ deltaX?: number, deltaY?: number }} [xy]
     * @returns {boolean}
     */
    const scrollAt = (clientX, clientY, sign, deltaPx, behavior, mode = 'delta', xy = null) => {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
      const edge = mode === 'edge';
      const xyMode = mode === 'xy';
      const amount = Math.abs(Number(deltaPx));
      const delta = Number.isFinite(amount) && amount > 0 ? amount : halfPagePx;
      const s = sign < 0 ? -1 : 1;
      const beh = xyMode || behavior === 'auto' || behavior === 'instant'
        ? 'instant'
        : (behavior || scrollBehavior);
      const deltaX = Number(xy?.deltaX) || 0;
      const deltaY = Number(xy?.deltaY) || 0;

      // Nested iframe under point: re-forward into child agent.
      try {
        const under = deepElementFromPoint(clientX, clientY);
        if (under && under.tagName === 'IFRAME') {
          const iframe = /** @type {HTMLIFrameElement} */ (under);
          const rect = iframe.getBoundingClientRect();
          const localX = clientX - rect.left;
          const localY = clientY - rect.top;
          if (
            localX >= 0 && localY >= 0 &&
            localX <= rect.width && localY <= rect.height &&
            iframe.contentWindow
          ) {
            iframe.contentWindow.postMessage({
              type: MSG.FRAME_SCROLL,
              clientX: localX,
              clientY: localY,
              sign: s,
              mode: xyMode ? 'xy' : (edge ? 'edge' : 'delta'),
              deltaPx: edge || xyMode ? 0 : delta,
              deltaX: xyMode ? deltaX : 0,
              deltaY: xyMode ? deltaY : 0,
              behavior: beh,
              frameName: typeof iframe.name === 'string' ? iframe.name : ''
            }, '*');
            return true;
          }
        }
      } catch { /* fall through */ }

      if (xyMode) {
        const result = scrollByAtPoint(clientX, clientY, deltaX, deltaY, beh);
        return !!result?.scrolled;
      }
      if (edge) {
        const result = scrollToEdgeAtPoint(clientX, clientY, s, beh);
        return !!result?.scrolled;
      }
      const result = scrollAtPoint(clientX, clientY, s, delta, beh);
      return !!result?.scrolled;
    };

    const setEnabled = (next) => {
      enabled = !!next;
      if (!enabled) {
        hideHover();
        pointerInside = false;
        lastPointerPostedX = NaN;
        lastPointerPostedY = NaN;
        if (pointerSyncRaf) {
          try { cancelAnimationFrame(pointerSyncRaf); } catch { /* ignore */ }
          pointerSyncRaf = 0;
        }
        // Do NOT post FRAME_POINTER leave / reclaim. Toggle-off while a Google
        // account (or similar) iframe is focused would blur it and dismiss the menu.
        lastTypingPosted = null;
        try {
          window.parent.postMessage({ type: MSG.FRAME_TYPING_BLUR }, '*');
        } catch { /* ignore */ }
      }
    };

    const syncEnabledFromRuntime = async () => {
      try {
        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
        const response = await chrome.runtime.sendMessage({ type: MSG.GET_STATE });
        if (response && typeof response.enabled === 'boolean') {
          setEnabled(response.enabled);
        }
      } catch {
        // Default enabled on communication failure (matches toggle handler).
        setEnabled(true);
      }
    };

    const ensureHoverEl = () => {
      if (hoverEl && hoverEl.isConnected) return hoverEl;
      try {
        const el = document.createElement('div');
        el.id = 'kpv2-frame-hover';
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText = [
          'position:fixed',
          'left:0',
          'top:0',
          'width:0',
          'height:0',
          'margin:0',
          'padding:0',
          'box-sizing:border-box',
          'pointer-events:none',
          `z-index:${typeof Z_INDEX?.OVERLAYS === 'number' ? Z_INDEX.OVERLAYS : 2147483020}`,
          'border-radius:2px',
          'display:none',
          'opacity:1'
        ].join(';');
        (document.documentElement || document.body)?.appendChild(el);
        hoverEl = el;
        applyFocusChromeToHoverEl();
        return el;
      } catch {
        hoverEl = null;
        return null;
      }
    };

    /**
     * Click New Tab / Background (and other URL actions) with no URL in this frame:
     * dashed orange flash.
     * Frame agent does not load StyleManager, so this is a self-contained pulse.
     * @param {Element|null} target
     * @param {number} clientX
     * @param {number} clientY
     */
    const flashDeniedDashOutline = (target, clientX, clientY) => {
      try {
        let left;
        let top;
        let width;
        let height;
        const el =
          (target &&
            target.nodeType === 1 &&
            target !== document.body &&
            target !== document.documentElement)
            ? target
            : null;
        if (el) {
          const r = el.getBoundingClientRect();
          if (r && r.width >= 2 && r.height >= 2) {
            left = r.left;
            top = r.top;
            width = r.width;
            height = r.height;
          }
        }
        if (width == null) {
          const size = 36;
          left = clientX - size / 2;
          top = clientY - size / 2;
          width = size;
          height = size;
        }
        const pulse = document.createElement('div');
        pulse.setAttribute('aria-hidden', 'true');
        pulse.style.cssText = [
          'position:fixed',
          `left:${left}px`,
          `top:${top}px`,
          `width:${width}px`,
          `height:${height}px`,
          'box-sizing:border-box',
          'pointer-events:none',
          `z-index:${typeof Z_INDEX?.OVERLAYS_ABOVE === 'number' ? Z_INDEX.OVERLAYS_ABOVE : 2147483021}`,
          `border:3px dashed ${COLORS.FLASH_DENIED || 'rgba(255,140,0,1)'}`,
          'background:transparent',
          `box-shadow:0 0 0 1px ${COLORS.FLASH_DENIED_SHADOW || 'rgba(255,140,0,0.85)'},0 0 10px 1px ${COLORS.FLASH_DENIED_GLOW || 'rgba(255,140,0,0.7)'}`
        ].join(';');
        (document.body || document.documentElement)?.appendChild(pulse);
        const anim = pulse.animate(
          [{ opacity: 1 }, { opacity: 0.12 }, { opacity: 1 }, { opacity: 0 }],
          { duration: 480, easing: 'ease-out' }
        );
        const cleanup = () => { try { pulse.remove(); } catch { /* ignore */ } };
        if (anim && typeof anim.addEventListener === 'function') {
          anim.addEventListener('finish', cleanup);
        } else {
          setTimeout(cleanup, 500);
        }
      } catch { /* ignore */ }
    };

    const hideHover = () => {
      hoverTarget = null;
      if (hoverRaf) {
        try { cancelAnimationFrame(hoverRaf); } catch { /* ignore */ }
        hoverRaf = 0;
      }
      if (hoverEl) {
        try {
          hoverEl.style.display = 'none';
          hoverEl.style.width = '0px';
          hoverEl.style.height = '0px';
        } catch { /* ignore */ }
      }
    };

    /**
     * @param {Element|null} target
     */
    const paintHover = (target) => {
      if (!target || !(target instanceof Element)) {
        hideHover();
        return;
      }
      // Don't outline nested iframes (child agent / shell only).
      if (target.tagName === 'IFRAME') {
        hideHover();
        return;
      }
      let rect;
      try {
        rect = target.getBoundingClientRect();
      } catch {
        hideHover();
        return;
      }
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        hideHover();
        return;
      }
      // Skip absurd full-viewport fills (often body/html mistaken for clickable).
      try {
        if (rect.width >= window.innerWidth * 0.95 && rect.height >= window.innerHeight * 0.95) {
          hideHover();
          return;
        }
      } catch { /* ignore */ }

      const el = ensureHoverEl();
      if (!el) return;
      hoverTarget = target;
      applyFocusChromeToHoverEl(target);
      try {
        el.style.display = 'block';
        el.style.transform = `translate(${Math.round(rect.left)}px, ${Math.round(rect.top)}px)`;
        el.style.width = `${Math.round(rect.width)}px`;
        el.style.height = `${Math.round(rect.height)}px`;
      } catch { /* ignore */ }
    };

    const scheduleHoverUpdate = () => {
      if (hoverRaf) return;
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = 0;
        try {
          if (!enabled || !pointerInside || hasFullKeyPilot()) {
            hideHover();
            return;
          }
          const x = lastMouse.x;
          const y = lastMouse.y;
          if (typeof x !== 'number' || typeof y !== 'number') {
            hideHover();
            return;
          }
          const under = deepElementFromPoint(x, y);
          const clickable = resolveClickable(under);
          if (clickable === hoverTarget && hoverEl && hoverEl.style.display === 'block') {
            // Same target — refresh rect in case of scroll/layout shift.
            paintHover(clickable);
            return;
          }
          paintHover(clickable);
        } catch {
          hideHover();
        }
      });
    };

    /** Prevent double-activate when parent uses both postMessage and SW fan-out. */
    let lastActivateAt = 0;

    /**
     * @param {number} clientX
     * @param {number} clientY
     * @param {FrameActivateOptions} [opts]
     * @returns {boolean}
     */
    const activateAt = (clientX, clientY, opts = {}) => {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;

      const now = Date.now();
      if (now - lastActivateAt < 100) return false;
      lastActivateAt = now;

      const el = deepElementFromPoint(clientX, clientY);
      if (!el) return false;

      // Nested iframe: re-forward with coordinates local to the nested frame.
      if (el.tagName === 'IFRAME') {
        try {
          const iframe = /** @type {HTMLIFrameElement} */ (el);
          const rect = iframe.getBoundingClientRect();
          const localX = clientX - rect.left;
          const localY = clientY - rect.top;
          if (
            localX >= 0 && localY >= 0 &&
            localX <= rect.width && localY <= rect.height &&
            iframe.contentWindow
          ) {
            iframe.contentWindow.postMessage({
              type: MSG.FRAME_ACTIVATE,
              clientX: localX,
              clientY: localY,
              openInNewTab: !!opts.openInNewTab,
              background: !!opts.background,
              topOrigin: typeof opts.topOrigin === 'string' ? opts.topOrigin : lastTopOrigin
            }, '*');
            return true;
          }
        } catch {
          // Fall through to click the iframe element itself.
        }
      }

      const openInNewTab = !!opts.openInNewTab;
      const background = !!opts.background;
      const link = closestLink(el);
      const activator = resolveClickable(el) || el;
      const mediaEl = findMediaAtPoint(el, clientX, clientY);
      const directMedia = isDirectMediaHit(el, mediaEl);
      const playOverlay = isPlayOverlayControl(el, activator);

      // Only toggle media for a direct video hit or the center play overlay.
      // Finding any nearby <video> must not swallow link / control clicks in the embed.
      if (
        mediaEl &&
        !openInNewTab &&
        !background &&
        (directMedia || playOverlay)
      ) {
        toggleMediaPlayback(mediaEl);
        return true;
      }

      if (openInNewTab || background) {
        let url = '';
        let openLink = link;
        try {
          const resolved = resolveHoveredLink(el) || resolveHoveredLink(activator);
          if (resolved?.url) {
            url = resolved.url;
            openLink = resolved.link || link;
          }
        } catch { /* ignore */ }
        if (!url && link) {
          url = resolveHttpHref(link) || link.href || '';
        }
        if (!url) {
          flashDeniedDashOutline(activator || el, clientX, clientY);
          return true;
        }
        if (openUrlViaRuntime(url, { background })) return true;
        try {
          if (background) {
            window.open(url, '_blank', 'noopener,noreferrer');
          } else if (openLink && openLink.tagName === 'A') {
            const originalTarget = openLink.target;
            openLink.target = '_blank';
            try { openLink.click(); } catch { window.open(url, '_blank', 'noopener,noreferrer'); }
            if (originalTarget !== undefined && originalTarget !== null && originalTarget !== '') {
              openLink.target = originalTarget;
            } else {
              openLink.removeAttribute('target');
            }
          } else {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
          return true;
        } catch {
          return false;
        }
      }

      // Same-window link: programmatic click preserves site handlers better than location assign.
      // Skip when we already handled paused media above.
      {
        const sameLink =
          (activator && activator.tagName === 'A' && /** @type {HTMLAnchorElement} */ (activator).href)
            ? /** @type {HTMLAnchorElement} */ (activator)
            : link;
        if (sameLink && sameLink.href && !openInNewTab && !background) {
          const topOrigin = typeof opts.topOrigin === 'string' && opts.topOrigin
            ? opts.topOrigin
            : lastTopOrigin;
          const runtimeUrl = runtimeNavigateUrlForFrameLink(
            /** @type {HTMLAnchorElement} */ (sameLink),
            { topOrigin }
          );
          if (runtimeUrl && navigateSameTabViaRuntime(runtimeUrl)) return true;
          try {
            sameLink.click();
            return true;
          } catch { /* fall through to event sequence */ }
        }
      }

      // Buttons: prefer trusted HTMLElement.click() (media play overlays, X embeds).
      try {
        if (
          activator &&
          (activator.tagName === 'BUTTON' ||
            (activator.getAttribute?.('role') || '').toLowerCase() === 'button') &&
          typeof /** @type {any} */ (activator).click === 'function'
        ) {
          /** @type {any} */ (activator).click();
          return true;
        }
      } catch { /* fall through */ }

      // <summary> toggles <details> only via activation behavior (HTMLElement.click() /
      // trusted click). Synthetic events alone do not open/close the accordion.
      try {
        let summary = null;
        if (activator && activator.tagName === 'SUMMARY') summary = activator;
        else if (el && typeof el.closest === 'function') {
          const s = el.closest('summary');
          if (s && s.tagName === 'SUMMARY') summary = s;
        } else if (activator && activator.tagName === 'DETAILS') {
          summary = activator.querySelector(':scope > summary');
        }
        if (summary && typeof summary.click === 'function') {
          summary.click();
          return true;
        }
      } catch { /* fall through */ }

      dispatchClickSequence(el, clientX, clientY);
      try {
        const sameControl = !!(
          activator &&
          el &&
          (containsComposed(activator, el) || containsComposed(el, activator))
        );
        if (activator && activator !== el && !sameControl) {
          dispatchClickSequence(activator, clientX, clientY);
        }
      } catch { /* ignore */ }

      return true;
    };

    /**
     * Shared gate for parent → child frame messages (activate + scroll).
     * postMessage source checks are unreliable across content-script isolated
     * worlds (`event.source === window.parent` often fails). Accept only when
     * framed and payload is well-formed; optional frameName targets a specific
     * iframe (e.g. Google name="account").
     * @param {MessageEvent|null} event
     * @param {any} data
     * @param {string} type
     * @returns {boolean}
     */
    const acceptFramePayload = (event, data, type) => {
      if (!data || data.type !== type) return false;
      if (!enabled) return false;
      // Must be embedded (not top-level).
      try {
        if (window === window.top) return false;
      } catch {
        // Access to top can throw in rare sandboxes — treat as framed.
      }
      // Reject self-posted messages when we can tell.
      try {
        if (event && event.source === window) return false;
      } catch { /* ignore */ }
      // Optional name targeting (parent includes iframe.name when set).
      try {
        const want = typeof data.frameName === 'string' ? data.frameName : '';
        if (want && window.name && want !== window.name) return false;
      } catch { /* ignore */ }
      return Number.isFinite(Number(data.clientX)) && Number.isFinite(Number(data.clientY));
    };

    /**
     * @param {MessageEvent|null} event
     * @param {any} data
     * @returns {boolean}
     */
    const acceptActivatePayload = (event, data) =>
      acceptFramePayload(event, data, MSG.FRAME_ACTIVATE);

    /**
     * @param {MessageEvent|null} event
     * @param {any} data
     * @returns {boolean}
     */
    const acceptScrollPayload = (event, data) =>
      acceptFramePayload(event, data, MSG.FRAME_SCROLL);

    /** @param {MessageEvent} event */
    const onMessage = (event) => {
      try {
        const data = event?.data;
        if (bubbleChildPointer(event, data)) return;
        if (bubbleChildTyping(event, data)) return;
        if (acceptActivatePayload(event, data)) {
          const x = Number(data.clientX);
          const y = Number(data.clientY);
          if (typeof data.topOrigin === 'string' && data.topOrigin) {
            lastTopOrigin = data.topOrigin;
          }
          activateAt(x, y, {
            openInNewTab: !!data.openInNewTab,
            background: !!data.background,
            topOrigin: typeof data.topOrigin === 'string' ? data.topOrigin : lastTopOrigin
          });
          return;
        }
        if (acceptScrollPayload(event, data)) {
          const x = Number(data.clientX);
          const y = Number(data.clientY);
          const sign = Number(data.sign) < 0 ? -1 : 1;
          const delta = Number(data.deltaPx);
          const beh = data.behavior === 'auto' || data.behavior === 'instant'
            ? 'instant'
            : (data.behavior || scrollBehavior);
          const mode = data.mode === 'edge' ? 'edge' : (data.mode === 'xy' ? 'xy' : 'delta');
          scrollAt(x, y, sign, delta, beh, mode, {
            deltaX: Number(data.deltaX) || 0,
            deltaY: Number(data.deltaY) || 0
          });
        }
      } catch {
        // ignore
      }
    };

    /** @param {MouseEvent|PointerEvent} e */
    const onPointer = (e) => {
      try {
        if (!enabled) return;
        if (typeof e.clientX === 'number') lastMouse.x = e.clientX;
        if (typeof e.clientY === 'number') lastMouse.y = e.clientY;
        pointerInside = true;
        if (!hasFullKeyPilot()) {
          schedulePointerSync();
          scheduleHoverUpdate();
        }
      } catch {
        // ignore
      }
    };

    /** @param {MouseEvent} [e] */
    const onPointerLeave = (e) => {
      // Fully idle while KeyPilot is off — no parent messages.
      if (!enabled) {
        pointerInside = false;
        hideHover();
        return;
      }

      // Moving into a nested <iframe> still fires mouseleave on this document.
      // Don't treat that as leaving the embed tree — the nested agent takes over.
      try {
        const rt = e?.relatedTarget;
        if (rt && (rt.tagName === 'IFRAME' || rt.tagName === 'FRAME')) {
          pointerInside = false;
          hideHover();
          return;
        }
      } catch { /* ignore */ }

      pointerInside = false;
      hideHover();
      // Leaving the embed: sync leave so parent can reclaim keys. Do not blur or
      // parent.focus() here — that dismisses Google account iframes on open.
      postPointerToParent(false);
    };

    const onScroll = () => {
      if (pointerInside && enabled) {
        schedulePointerSync();
        scheduleHoverUpdate();
      }
    };

    /** @param {KeyboardEvent} e */
    const onKeyDown = (e) => {
      try {
        if (!enabled) return;
        // Full KeyPilot in this frame owns activate / scroll keys.
        if (hasFullKeyPilot()) return;
        if (hasModifierKeys(e)) return;

        const key = e.key;
        const kb = keybindings || {};

        // Esc while typing: exit KeyPilot text mode (blur field, notify parent).
        // Do not reclaim the iframe — Gutenberg should keep the canvas focused.
        if (
          (keyIn(kb.CANCEL, key) || key === 'Escape' || key === 'Esc') &&
          isTypingContext(e.target)
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          try { document.activeElement?.blur?.(); } catch { /* ignore */ }
          postTypingToParent(false);
          return;
        }

        if (isTypingContext(e.target)) return;

        // Fallback path only: top KeyPilot is the primary keyboard owner via
        // KP_FRAME_ACTIVATE / KP_FRAME_SCROLL. Local keys run only while this
        // document has focus (after a real click into the iframe).
        if (!frameHasKeyboardFocus()) return;

        // Esc / cancel: return keyboard ownership to the top frame.
        if (keyIn(kb.CANCEL, key) || key === 'Escape' || key === 'Esc') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          requestFocusReclaim();
          return;
        }

        let mode = null;
        /** @type {number|null} */
        let scrollSign = null;
        /** @type {'delta'|'edge'} */
        let scrollMode = 'delta';
        if (keyIn(kb.ACTIVATE, key)) mode = 'activate';
        else if (keyIn(kb.ACTIVATE_NEW_TAB, key)) mode = 'newTab';
        else if (keyIn(kb.ACTIVATE_NEW_TAB_BACKGROUND, key)) mode = 'background';
        else if (keyIn(kb.PAGE_UP_INSTANT, key)) scrollSign = -1;
        else if (keyIn(kb.PAGE_DOWN_INSTANT, key)) scrollSign = 1;
        else if (keyIn(kb.PAGE_TOP, key)) {
          scrollSign = -1;
          scrollMode = 'edge';
        } else if (keyIn(kb.PAGE_BOTTOM, key)) {
          scrollSign = 1;
          scrollMode = 'edge';
        } else return;

        // Pointer left this frame but focus stuck: reclaim instead of activating
        // at stale in-frame coords (lets top handle the next key on parent UI).
        if (!pointerInside) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          requestFocusReclaim();
          return;
        }

        let x = lastMouse.x;
        let y = lastMouse.y;
        if (typeof x !== 'number' || typeof y !== 'number') {
          x = Math.floor(window.innerWidth / 2);
          y = Math.floor(window.innerHeight / 2);
        }

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (scrollSign !== null) {
          if (scrollMode === 'edge') {
            scrollAt(x, y, scrollSign, halfPagePx, scrollBehavior, scrollMode);
            return;
          }
          const s = scrollSign < 0 ? -1 : 1;
          if (e.repeat) {
            scrollHold.noteRepeat(key, s);
            return;
          }
          const found = findScrollTargetAtPoint(x, y, s);
          const el = found?.el || document.scrollingElement || document.documentElement || document.body;
          const axis = found?.axis || 'y';
          scrollAt(x, y, s, halfPagePx, scrollBehavior, 'delta');
          scrollHoldLock = el ? { el, axis } : null;
          const speed = Math.max(600, Math.min(2400, halfPagePx * 2.8));
          scrollHold.begin({
            key,
            sign: s,
            target: scrollHoldLock,
            speedPxPerSec: speed
          });
          return;
        }

        activateAt(x, y, {
          openInNewTab: mode === 'newTab',
          background: mode === 'background',
          topOrigin: lastTopOrigin
        });
      } catch {
        // ignore
      }
    };

    /**
     * @param {any} message
     * @param {chrome.runtime.MessageSender} _sender
     * @param {(response?: any) => void} sendResponse
     */
    const onRuntimeMessage = (message, _sender, sendResponse) => {
      try {
        if (message?.type === MSG.TOGGLE_STATE || message?.type === MSG.UPDATE_STATE) {
          if (typeof message.enabled === 'boolean') {
            setEnabled(message.enabled);
          }
          return false;
        }

        // Backup path: SW can fan-out FRAME_ACTIVATE / FRAME_SCROLL to subframes
        // (postMessage is primary).
        if (message?.type === MSG.FRAME_ACTIVATE) {
          if (!acceptActivatePayload(null, message)) {
            try { sendResponse({ ok: false }); } catch { /* ignore */ }
            return true;
          }
          if (typeof message.topOrigin === 'string' && message.topOrigin) {
            lastTopOrigin = message.topOrigin;
          }
          const ok = activateAt(Number(message.clientX), Number(message.clientY), {
            openInNewTab: !!message.openInNewTab,
            background: !!message.background,
            topOrigin: typeof message.topOrigin === 'string' ? message.topOrigin : lastTopOrigin
          });
          try { sendResponse({ ok: !!ok, href: String(location.href || '').slice(0, 120) }); } catch { /* ignore */ }
          return true;
        }

        if (message?.type === MSG.FRAME_SCROLL) {
          if (!acceptScrollPayload(null, message)) {
            try { sendResponse({ ok: false }); } catch { /* ignore */ }
            return true;
          }
          const sign = Number(message.sign) < 0 ? -1 : 1;
          const mode = message.mode === 'edge' ? 'edge' : (message.mode === 'xy' ? 'xy' : 'delta');
          const ok = scrollAt(
            Number(message.clientX),
            Number(message.clientY),
            sign,
            Number(message.deltaPx),
            message.behavior,
            mode,
            {
              deltaX: Number(message.deltaX) || 0,
              deltaY: Number(message.deltaY) || 0
            }
          );
          try { sendResponse({ ok: !!ok, href: String(location.href || '').slice(0, 120) }); } catch { /* ignore */ }
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    };

    /** @param {Record<string, chrome.storage.StorageChange>} changes @param {string} area */
    const onStorageChanged = (changes, area) => {
      try {
        if (area !== 'sync' && area !== 'local') return;
        if (changes?.keypilot_enabled && typeof changes.keypilot_enabled.newValue === 'boolean') {
          setEnabled(changes.keypilot_enabled.newValue);
        }
        if (changes && Object.prototype.hasOwnProperty.call(changes, SETTINGS_STORAGE_KEY)) {
          void refreshKeybindings();
        }
      } catch {
        // ignore
      }
    };

    /** @param {KeyboardEvent} e */
    const onKeyUp = (e) => {
      try {
        scrollHold.end(e?.key);
        if (!scrollHold.active) scrollHoldLock = null;
      } catch { /* ignore */ }
    };

    window.addEventListener('message', onMessage, true);
    document.addEventListener('mousemove', onPointer, { capture: true, passive: true });
    document.addEventListener('pointermove', onPointer, { capture: true, passive: true });
    document.addEventListener('mouseleave', onPointerLeave, true);
    document.addEventListener('pointerleave', onPointerLeave, true);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);

    try {
      chrome.runtime?.onMessage?.addListener(onRuntimeMessage);
    } catch { /* ignore */ }
    try {
      chrome.storage?.onChanged?.addListener(onStorageChanged);
    } catch { /* ignore */ }

    // Visible to page-world diagnostics (isolated world cannot expose JS globals to the page).
    try {
      document.documentElement?.setAttribute('data-kp-frame-agent', '1');
    } catch { /* ignore */ }

    void syncEnabledFromRuntime();
    void refreshKeybindings();
    try { syncTypingFocusToParent(); } catch { /* ignore */ }

    return {
      dispose() {
        hideHover();
        if (pointerSyncRaf) {
          try { cancelAnimationFrame(pointerSyncRaf); } catch { /* ignore */ }
          pointerSyncRaf = 0;
        }
        try {
          if (hoverEl) hoverEl.remove();
        } catch { /* ignore */ }
        hoverEl = null;
        try {
          window.removeEventListener('message', onMessage, true);
          document.removeEventListener('mousemove', onPointer, true);
          document.removeEventListener('pointermove', onPointer, true);
          document.removeEventListener('mouseleave', onPointerLeave, true);
          document.removeEventListener('pointerleave', onPointerLeave, true);
          document.removeEventListener('scroll', onScroll, true);
          window.removeEventListener('scroll', onScroll, true);
          document.removeEventListener('keydown', onKeyDown, true);
          document.removeEventListener('keyup', onKeyUp, true);
          document.removeEventListener('focusin', onFocusIn, true);
          document.removeEventListener('focusout', onFocusOut, true);
        } catch { /* ignore */ }
        try {
          chrome.runtime?.onMessage?.removeListener(onRuntimeMessage);
        } catch { /* ignore */ }
        try {
          chrome.storage?.onChanged?.removeListener(onStorageChanged);
        } catch { /* ignore */ }
        try {
          document.documentElement?.removeAttribute('data-kp-frame-agent');
        } catch { /* ignore */ }
      }
    };
  } catch (error) {
    console.warn('[KeyPilot] Failed to install frame click agent:', error);
    return null;
  }
}
