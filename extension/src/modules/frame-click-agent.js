/**
 * Thin cross-origin iframe click + hover agent.
 *
 * Runs only in non-top frames. Stays light (no full KeyPilot):
 *  1. postMessage / runtime KP_FRAME_ACTIVATE from the parent (top-frame F/B/G)
 *  2. Activate keybinds when this frame has focus
 *  3. Blue hover outline on clickable targets under the pointer (rAF-throttled;
 *     matches top-frame DOM-hover focus palette)
 *  4. postMessage / runtime KP_FRAME_SCROLL from parent (C/V/Z/X under this iframe)
 *     plus local C/V/Z/X when this frame has focus — nested overflow first
 *
 * Full KeyPilot still initializes only in the top frame. When full KP is also
 * running in this frame (KeyPilot popover), local key + hover handling is skipped.
 */

import { MSG } from '../messaging/types.js';
import { COLORS, CSS_CLASSES, Z_INDEX, SCROLL } from '../config/constants.js';
import { isTypingContext, hasModifierKeys } from '../utils/dom-context.js';
import {
  buildKeybindingsForLayout,
  DEFAULT_KEYBOARD_LAYOUT_ID,
  normalizeKeyboardLayoutId
} from '../config/keyboard-layouts.js';
import { getSettings, SETTINGS_STORAGE_KEY, scrollBehaviorFromSpeed, DEFAULT_SETTINGS } from './settings-manager.js';
import { scrollAtPoint, scrollToEdgeAtPoint } from '../utils/scroll-at-point.js';

/**
 * @typedef {{ openInNewTab?: boolean, background?: boolean }} FrameActivateOptions
 */

const CLICKABLE_SEL =
  'a[href], button, [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], summary, [onclick], input, select, textarea, label';

/**
 * Shadow-DOM–aware elementFromPoint (no iframe piercing — that is recursive via postMessage).
 * @param {number} x
 * @param {number} y
 * @returns {Element|null}
 */
function deepElementFromPoint(x, y) {
  try {
    let el = document.elementFromPoint(x, y);
    let guard = 0;
    while (el && el.shadowRoot && guard++ < 10) {
      const nested = el.shadowRoot.elementFromPoint(x, y);
      if (!nested || nested === el) break;
      el = nested;
    }
    return el || null;
  } catch {
    return null;
  }
}

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
    // cursor:pointer on this node only (not inherited from body).
    // Suspend custom-cursor override — otherwise getComputedStyle always reports
    // the KeyPilot crosshair and pointer-only targets never outline.
    try {
      if (el !== document.body && el !== document.documentElement) {
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
    /** @type {ReturnType<typeof buildKeybindingsForLayout>} */
    let keybindings = buildKeybindingsForLayout(DEFAULT_KEYBOARD_LAYOUT_ID);
    /** @type {number} */
    let halfPagePx = SCROLL.HALF_PAGE_PX;
    /** @type {'smooth'|'auto'} */
    let scrollBehavior = SCROLL.BEHAVIOR === 'smooth' ? 'smooth' : 'auto';

    /** @type {HTMLElement|null} */
    let hoverEl = null;
    /** @type {Element|null} */
    let hoverTarget = null;
    /** @type {number} */
    let hoverRaf = 0;
    /** @type {boolean} */
    let pointerInside = false;
    /** @type {{ focusColor: string, overlayFillEnabled: boolean, overlayShadowEnabled: boolean, rectangleThickness: number }} */
    let focusChrome = {
      focusColor: 'blue',
      overlayFillEnabled: false,
      overlayShadowEnabled: false,
      rectangleThickness: 3
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

    const applyFocusChromeToHoverEl = () => {
      if (!hoverEl) return;
      const p = paletteFor(focusChrome.focusColor);
      const thickness = Math.min(Math.max(Number(focusChrome.rectangleThickness) || 3, 1), 16);
      try {
        hoverEl.style.border = `${thickness}px solid ${p.border}`;
        hoverEl.style.background =
          focusChrome.overlayFillEnabled === false ? 'transparent' : p.fill;
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
        const layoutId = normalizeKeyboardLayoutId(settings?.keyboardLayoutId);
        keybindings = buildKeybindingsForLayout(layoutId);
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
     * @param {'delta'|'edge'} [mode='delta']
     * @returns {boolean}
     */
    const scrollAt = (clientX, clientY, sign, deltaPx, behavior, mode = 'delta') => {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
      const edge = mode === 'edge';
      const amount = Math.abs(Number(deltaPx));
      const delta = Number.isFinite(amount) && amount > 0 ? amount : halfPagePx;
      const s = sign < 0 ? -1 : 1;
      const beh = behavior === 'auto' || behavior === 'instant' ? 'auto' : (behavior || scrollBehavior);

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
              mode: edge ? 'edge' : 'delta',
              deltaPx: edge ? 0 : delta,
              behavior: beh,
              frameName: typeof iframe.name === 'string' ? iframe.name : ''
            }, '*');
            return true;
          }
        }
      } catch { /* fall through */ }

      if (edge) {
        const result = scrollToEdgeAtPoint(clientX, clientY, s, beh);
        return !!result?.scrolled;
      }
      const result = scrollAtPoint(clientX, clientY, s, delta, beh);
      return !!result?.scrolled;
    };

    const setEnabled = (next) => {
      enabled = !!next;
      if (!enabled) hideHover();
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
        return null;
      }
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
              background: !!opts.background
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

      if (link && (openInNewTab || background)) {
        const url = link.href;
        if (openUrlViaRuntime(url, { background })) return true;
        try {
          if (background) {
            window.open(url, '_blank', 'noopener,noreferrer');
          } else {
            const originalTarget = link.target;
            link.target = '_blank';
            try { link.click(); } catch { window.open(url, '_blank', 'noopener,noreferrer'); }
            if (originalTarget !== undefined && originalTarget !== null && originalTarget !== '') {
              link.target = originalTarget;
            } else {
              link.removeAttribute('target');
            }
          }
          return true;
        } catch {
          return false;
        }
      }

      const activator = resolveClickable(el) || el;

      // Same-window link: programmatic click preserves site handlers better than location assign.
      if (activator.tagName === 'A' && /** @type {HTMLAnchorElement} */ (activator).href && !openInNewTab && !background) {
        try {
          /** @type {HTMLAnchorElement} */ (activator).click();
          return true;
        } catch { /* fall through to event sequence */ }
      }

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
        if (
          activator &&
          activator !== el &&
          !(typeof activator.contains === 'function' && activator.contains(el))
        ) {
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
        if (acceptActivatePayload(event, data)) {
          const x = Number(data.clientX);
          const y = Number(data.clientY);
          activateAt(x, y, {
            openInNewTab: !!data.openInNewTab,
            background: !!data.background
          });
          return;
        }
        if (acceptScrollPayload(event, data)) {
          const x = Number(data.clientX);
          const y = Number(data.clientY);
          const sign = Number(data.sign) < 0 ? -1 : 1;
          const delta = Number(data.deltaPx);
          const beh = data.behavior === 'auto' || data.behavior === 'instant'
            ? 'auto'
            : (data.behavior || scrollBehavior);
          const mode = data.mode === 'edge' ? 'edge' : 'delta';
          scrollAt(x, y, sign, delta, beh, mode);
        }
      } catch {
        // ignore
      }
    };

    /** @param {MouseEvent|PointerEvent} e */
    const onPointer = (e) => {
      try {
        if (typeof e.clientX === 'number') lastMouse.x = e.clientX;
        if (typeof e.clientY === 'number') lastMouse.y = e.clientY;
        pointerInside = true;
        if (enabled && !hasFullKeyPilot()) scheduleHoverUpdate();
      } catch {
        // ignore
      }
    };

    const onPointerLeave = () => {
      pointerInside = false;
      hideHover();
    };

    const onScroll = () => {
      if (pointerInside && enabled) scheduleHoverUpdate();
    };

    /** @param {KeyboardEvent} e */
    const onKeyDown = (e) => {
      try {
        if (!enabled) return;
        // Full KeyPilot in this frame owns activate / scroll keys.
        if (hasFullKeyPilot()) return;
        if (hasModifierKeys(e)) return;
        if (isTypingContext(e.target)) return;

        const key = e.key;
        const kb = keybindings || {};
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
          scrollAt(x, y, scrollSign, halfPagePx, scrollBehavior, scrollMode);
          return;
        }

        activateAt(x, y, {
          openInNewTab: mode === 'newTab',
          background: mode === 'background'
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
          const ok = activateAt(Number(message.clientX), Number(message.clientY), {
            openInNewTab: !!message.openInNewTab,
            background: !!message.background
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
          const mode = message.mode === 'edge' ? 'edge' : 'delta';
          const ok = scrollAt(
            Number(message.clientX),
            Number(message.clientY),
            sign,
            Number(message.deltaPx),
            message.behavior,
            mode
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

    window.addEventListener('message', onMessage, true);
    document.addEventListener('mousemove', onPointer, { capture: true, passive: true });
    document.addEventListener('pointermove', onPointer, { capture: true, passive: true });
    document.addEventListener('mouseleave', onPointerLeave, true);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('keydown', onKeyDown, true);

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

    return {
      dispose() {
        hideHover();
        try {
          if (hoverEl) hoverEl.remove();
        } catch { /* ignore */ }
        hoverEl = null;
        try {
          window.removeEventListener('message', onMessage, true);
          document.removeEventListener('mousemove', onPointer, true);
          document.removeEventListener('pointermove', onPointer, true);
          document.removeEventListener('mouseleave', onPointerLeave, true);
          document.removeEventListener('scroll', onScroll, true);
          window.removeEventListener('scroll', onScroll, true);
          document.removeEventListener('keydown', onKeyDown, true);
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
