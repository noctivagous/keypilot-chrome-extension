/**
 * OnboardingManager
 * - Loads onboarding slides/tasks from XML
 * - Persists progress globally (profile-wide) via chrome.storage
 * - Renders a floating panel (top-left) and auto-checks tasks based on KeyPilot actions/mode changes
 */
import { MODES } from '../config/constants.js';
import { OnboardingPanel } from '../ui/onboarding-panel.js';
import { PracticePopoverPanel } from '../ui/practice-popover-panel.js';

const STORAGE_KEYS = {
  ACTIVE: 'keypilot_onboarding_active',
  PROGRESS: 'keypilot_onboarding_progress'
};

const TRANSIENT_KEYS = {
  LAST_ACTION: 'keypilot_transient_action'
};

function safeBool(v) {
  return typeof v === 'boolean' ? v : null;
}

async function storageGet(keys) {
  // Prefer sync, fall back to local.
  try {
    const r = await chrome.storage.sync.get(keys);
    return r || {};
  } catch {
    // ignore
  }
  try {
    const r = await chrome.storage.local.get(keys);
    return r || {};
  } catch {
    return {};
  }
}

async function storageGetTransient() {
  // Prefer session (ephemeral + fast), fall back to local.
  try {
    if (chrome?.storage?.session?.get) {
      const r = await chrome.storage.session.get([TRANSIENT_KEYS.LAST_ACTION]);
      return r || {};
    }
  } catch {
    // ignore
  }
  try {
    const r = await chrome.storage.local.get([TRANSIENT_KEYS.LAST_ACTION]);
    return r || {};
  } catch {
    return {};
  }
}

async function storageRemoveTransient() {
  try {
    if (chrome?.storage?.session?.remove) {
      await chrome.storage.session.remove([TRANSIENT_KEYS.LAST_ACTION]);
      return;
    }
  } catch {
    // ignore
  }
  try {
    await chrome.storage.local.remove([TRANSIENT_KEYS.LAST_ACTION]);
  } catch {
    // ignore
  }
}

async function storageSet(obj) {
  try {
    await chrome.storage.sync.set(obj);
    return;
  } catch {
    // ignore
  }
  try {
    await chrome.storage.local.set(obj);
  } catch {
    // ignore
  }
}

function withViewTransition(updateDomFn) {
  try {
    if (document && typeof document.startViewTransition === 'function') {
      document.startViewTransition(() => {
        updateDomFn();
      });
      return;
    }
  } catch {
    // ignore, fall back
  }
  updateDomFn();
}

function parseOnboardingXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(xmlText || ''), 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Failed to parse onboarding.xml');
  }

  const slides = [];
  const slideEls = doc.querySelectorAll('onboarding > slide');
  for (const slideEl of slideEls) {
    const id = slideEl.getAttribute('id') || '';
    const title = slideEl.getAttribute('title') || '';
    if (!id) continue;

    const bodyEl = slideEl.querySelector(':scope > body');
    const bodyText = bodyEl ? String(bodyEl.textContent || '').trim() : '';

    const onEnter = [];
    const onEnterEls = slideEl.querySelectorAll(':scope > onEnter');
    for (const oe of onEnterEls) {
      const type = (oe.getAttribute('type') || '').trim();
      if (!type) continue;
      const entry = { type };
      for (const attr of oe.attributes || []) {
        if (!attr || !attr.name) continue;
        if (attr.name === 'type') continue;
        entry[attr.name] = attr.value;
      }
      onEnter.push(entry);
    }

    const tasks = [];
    const taskEls = slideEl.querySelectorAll(':scope > task');
    for (const taskEl of taskEls) {
      const taskId = taskEl.getAttribute('id') || '';
      const label = taskEl.getAttribute('label') || '';
      if (!taskId) continue;

      const whenEl = taskEl.querySelector(':scope > when');
      const when = whenEl
        ? {
            type: (whenEl.getAttribute('type') || '').trim(),
            action: (whenEl.getAttribute('action') || '').trim(),
            target: (whenEl.getAttribute('target') || '').trim(),
            mode: (whenEl.getAttribute('mode') || '').trim(),
            change: (whenEl.getAttribute('change') || '').trim()
          }
        : { type: '' };

      tasks.push({ id: taskId, label, when });
    }

    slides.push({ id, title, tasks, onEnter, bodyText });
  }

  return { slides };
}

export class OnboardingManager {
  /**
   * @param {Object} [params]
   * @param {(type:string, detail:Object) => void} [params.onEvent] Optional callback hook for onboarding lifecycle events.
   */
  constructor({ onEvent } = {}) {
    this.panel = new OnboardingPanel({
      onRequestClose: () => this.setActive(false),
      onRequestPrev: () => this.goPrevSlide(),
      onRequestNext: () => this.goNextSlide(),
      onRequestReset: () => this.resetTutorial()
    });

    this.practicePanel = new PracticePopoverPanel({
      onRequestClose: () => {
        // Practice popover is auxiliary; hiding it should not disable onboarding.
        this._practiceDismissed = true;
      }
    });

    this.model = { slides: [] };
    this.progress = {
      slideId: null,
      completedTaskIds: [],
      onEnterDoneSlideIds: [],
      completed: false,
      timestamp: Date.now()
    };

    this.active = false;
    this._bound = false;
    this._keyPilotReady = false;
    this._unsubscribeState = null;
    this._prevMode = null;
    this._practiceDismissed = false;
    this._practiceLastSlideId = null;

    this._onActionEvent = this._onActionEvent.bind(this);
    this._onDocKeydownCapture = this._onDocKeydownCapture.bind(this);
    this._onPageShow = this._onPageShow.bind(this);
    this._pageShowBound = false;

    // Event hooks
    this._onEvent = typeof onEvent === 'function' ? onEvent : null;
    this._listeners = new Map(); // eventType -> Set<fn>

    // Track transitions
    this._lastRenderedSlideId = null;
    this._lastRenderedSlideIndex = null;
    this._lastAction = null;
    this._isTransitioning = false;

    // Cross-tab progress sync + transient recovery when tab becomes visible.
    this._storageListenerBound = false;
    this._storageChangeTimer = null;
    this._onStorageChanged = this._onStorageChanged.bind(this);
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    this._visibilityBound = false;

    // Cached "enabled" state to avoid startup races.
    // IMPORTANT: treat unknown (null) as disabled so we never show onboarding when KeyPilot is OFF.
    this._enabledCache = null; // boolean|null
    this._enabledCacheTs = 0;
  }

  /**
   * Subscribe to onboarding events.
   * Events are also dispatched globally as `document` CustomEvents: `keypilot:onboarding`.
   *
   * @param {string} type
   * @param {(detail:Object) => void} handler
   * @returns {() => void} unsubscribe
   */
  on(type, handler) {
    if (!type || typeof handler !== 'function') return () => {};
    const key = String(type);
    const set = this._listeners.get(key) || new Set();
    set.add(handler);
    this._listeners.set(key, set);
    return () => {
      try { set.delete(handler); } catch { /* ignore */ }
    };
  }

  _emit(type, detail = {}) {
    const t = String(type || '');
    if (!t) return;

    const payload = { type: t, ...(detail && typeof detail === 'object' ? detail : {}) };

    // 1) Optional direct callback
    try { this._onEvent?.(t, payload); } catch { /* ignore */ }

    // 2) Instance listeners
    try {
      const set = this._listeners.get(t);
      if (set && set.size) {
        for (const fn of set) {
          try { fn(payload); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }

    // 3) Global DOM event hook
    try {
      document.dispatchEvent(new CustomEvent('keypilot:onboarding', { detail: payload }));
    } catch { /* ignore */ }
  }

  async resetTutorial() {
    if (!this._isKeyPilotEnabled()) return;

    const firstSlideId = this.model.slides[0]?.id || null;
    this.progress = {
      slideId: firstSlideId,
      completedTaskIds: [],
      onEnterDoneSlideIds: [],
      completed: false,
      timestamp: Date.now()
    };
    this.active = true;
    this._practiceDismissed = false;
    this._practiceLastSlideId = null;
    await this._persist();
    this._isTransitioning = true;
    this._render({ transition: { type: 'slide', dir: 1 }, reason: 'reset' });
  }

  async goPrevSlide() {
    if (!this._isKeyPilotEnabled() || this._isTransitioning) return;
    const idx = this._currentSlideIndex();
    if (idx <= 0) return;
    const prev = this.model.slides[idx - 1];
    if (!prev) return;
    this.progress.slideId = prev.id;
    await this._persist();
    this._isTransitioning = true;
    this._render({ transition: { type: 'slide', dir: -1 }, reason: 'manualPrev' });
  }

  async goNextSlide() {
    if (!this._isKeyPilotEnabled() || this._isTransitioning) return;
    const idx = this._currentSlideIndex();
    const next = this.model.slides[idx + 1];
    if (!next) return;
    console.log('[KeyPilot Onboarding] goNextSlide: moving from', this.model.slides[idx]?.id, 'to', next.id);
    this.progress.slideId = next.id;
    await this._persist();
    this._isTransitioning = true;
    this._render({ transition: { type: 'slide', dir: 1 }, reason: 'manualNext' });
  }

  _readEnabledFromGlobals() {
    // Prefer the toggle handler's authoritative state.
    try {
      const th = window.__KeyPilotToggleHandler;
      if (th && typeof th.enabled === 'boolean') return th.enabled === true;
    } catch { /* ignore */ }

    // Fall back to KeyPilot instance state ONLY once initialization is complete.
    // During startup `kp.enabled` briefly defaults to true before KP_GET_STATE resolves.
    try {
      const kp = window.__KeyPilotInstance;
      if (kp && kp.initializationComplete === true && typeof kp.enabled === 'boolean') {
        return kp.enabled === true;
      }
    } catch { /* ignore */ }

    return null;
  }

  async _syncEnabledFromServiceWorker() {
    // The service worker is the source of truth for global enable/disable.
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'KP_GET_STATE' });
      if (resp && typeof resp.enabled === 'boolean') {
        this._enabledCache = resp.enabled === true;
        this._enabledCacheTs = Date.now();
        return this._enabledCache;
      }
    } catch {
      // ignore and fall back
    }

    const g = this._readEnabledFromGlobals();
    if (typeof g === 'boolean') {
      this._enabledCache = g === true;
      this._enabledCacheTs = Date.now();
      return this._enabledCache;
    }

    // Conservative default: if we can't confirm enabled, treat it as disabled.
    this._enabledCache = false;
    this._enabledCacheTs = Date.now();
    return this._enabledCache;
  }

  _isKeyPilotEnabled() {
    // When KeyPilot is toggled off, the content script may still exist but should not
    // keep extra hotkey listeners alive. Alt+K is handled separately.
    // Prefer the toggle handler's authoritative state even if our cache is stale.
    // This prevents hotkeys from being captured when the extension has been toggled OFF.
    const g = this._readEnabledFromGlobals();
    if (typeof g === 'boolean') return g === true;

    if (typeof this._enabledCache === 'boolean') return this._enabledCache === true;
    return false;
  }

  _setAltSlashListenerEnabled(enabled) {
    const next = !!enabled;
    try {
      if (next) {
        if (this._altSlashListenerInstalled) return;
        document.addEventListener('keydown', this._onDocKeydownCapture, true);
        this._altSlashListenerInstalled = true;
      } else {
        if (!this._altSlashListenerInstalled) return;
        document.removeEventListener('keydown', this._onDocKeydownCapture, true);
        this._altSlashListenerInstalled = false;
      }
    } catch {
      // ignore
    }
  }

  async init() {
    // Never run inside iframes (keeps onboarding at the top level only).
    if (window !== window.top) return;
    if (this._bound) return;
    this._bound = true;

    await this._loadModel();
    await this._loadProgress();

    // Ensure we have a valid initial slide.
    if (!this.progress.slideId) {
      this.progress.slideId = this.model.slides[0]?.id || null;
    }

    // If a previous page navigated away too quickly to persist onboarding progress,
    // recover "transient" actions recorded by the service worker (most importantly: back).
    await this._applyTransientActionHeuristicIfNeeded();

    // If this page load came from a back/forward navigation, mark the "back" task as done.
    // This covers cases where the user used the browser back button OR navigation happened too fast
    // for an in-page storage write to complete.
    await this._applyBackForwardHeuristicIfNeeded();

    // BFCache restores do not rerun the content script; apply transient recovery on pageshow.
    if (!this._pageShowBound) {
      this._pageShowBound = true;
      try {
        window.addEventListener('pageshow', this._onPageShow, true);
      } catch {
        // ignore
      }
    }

    // Keep onboarding state consistent across tabs/windows.
    this._bindStorageSync();

    // When the document becomes visible (user tab-switches), apply transient recovery.
    if (!this._visibilityBound) {
      this._visibilityBound = true;
      try {
        document.addEventListener('visibilitychange', this._onVisibilityChange, true);
      } catch {
        // ignore
      }
    }

    // Wire event listeners first (so actions right after load count).
    try {
      document.addEventListener('keypilot:action', this._onActionEvent, true);
    } catch {
      // ignore
    }

    // Prime enabled state from the service worker before we decide whether to show anything.
    await this._syncEnabledFromServiceWorker();

    // Alt + / re-opens onboarding, but ONLY while KeyPilot is enabled.
    this._setAltSlashListenerEnabled(this._isKeyPilotEnabled());

    // Show/hide based on persisted active flag.
    this._render();

    // Bind to KeyPilot state (for mode enter/exit tasks).
    this._attachToKeyPilotStateSoon();
  }

  _onPageShow(ev) {
    try {
      if (!ev || ev.persisted !== true) return;
      if (!this.active || this.progress.completed) return;
      this._applyTransientActionHeuristicIfNeeded()
        .then(() => {
          withViewTransition(() => this._render());
        })
        .catch(() => {});
    } catch {
      // ignore
    }
  }

  async _applyTransientActionHeuristicIfNeeded() {
    try {
      if (!this.active || this.progress.completed) return;

      const data = await storageGetTransient();
      const rec = data && data[TRANSIENT_KEYS.LAST_ACTION];
      if (!rec || typeof rec !== 'object') return;

      const action = typeof rec.action === 'string' ? rec.action : '';
      const ts = typeof rec.timestamp === 'number' ? rec.timestamp : 0;
      if (!action) return;

      // Expire old records to avoid false positives.
      const now = Date.now();
      if (!ts || now - ts > 15000) {
        await storageRemoveTransient();
        return;
      }

      // Only handle actions onboarding cares about currently.
      // These are the actions that commonly happen concurrently with navigation/tab switching.
      const handled = new Set(['back', 'newTab', 'tabLeft', 'tabRight']);
      if (!handled.has(action)) {
        await storageRemoveTransient();
        return;
      }

      const slide = this._getCurrentSlide();
      if (!slide) return;

      const completed = new Set(this.progress.completedTaskIds);
      let changed = false;

      for (const task of slide.tasks || []) {
        if (!task || !task.id || completed.has(task.id)) continue;
        if (this._taskMatches(task, { type: 'action', action, detail: {} })) {
          completed.add(task.id);
          changed = true;
        }
      }

      // Consume it regardless; we only want it to apply once.
      await storageRemoveTransient();

      if (!changed) return;
      this.progress.completedTaskIds = Array.from(completed);
      await this._persist();

      // IMPORTANT: If a slide becomes complete via transient recovery (common for tab switches),
      // we still need to auto-advance just like we do in the live `keypilot:action` handler.
      const slideComplete = this._isSlideComplete(slide, completed);
      if (slideComplete) {
        this._handleSlideCompleted(slide, { cause: `transient:${action}`, completedTaskIds: Array.from(completed) });
        await this._advanceSlide({ cause: `transient:${action}` });
      }
    } catch {
      // ignore
    }
  }

  _bindStorageSync() {
    if (this._storageListenerBound) return;
    this._storageListenerBound = true;
    try {
      chrome.storage.onChanged.addListener(this._onStorageChanged);
    } catch {
      // ignore
    }
  }

  _onStorageChanged(changes, areaName) {
    try {
      if (!changes || typeof changes !== 'object') return;
      if (!areaName || (areaName !== 'sync' && areaName !== 'local' && areaName !== 'session')) return;
      const relevant =
        Object.prototype.hasOwnProperty.call(changes, STORAGE_KEYS.ACTIVE) ||
        Object.prototype.hasOwnProperty.call(changes, STORAGE_KEYS.PROGRESS);
      if (!relevant) return;

      // Debounce: multiple writes can come in quick bursts.
      try { if (this._storageChangeTimer) clearTimeout(this._storageChangeTimer); } catch { /* ignore */ }
      this._storageChangeTimer = setTimeout(() => {
        this._loadProgress()
          .then(() => {
            withViewTransition(() => this._render({ reason: 'storageChanged' }));
          })
          .catch(() => {});
      }, 50);
    } catch {
      // ignore
    }
  }

  _onVisibilityChange() {
    try {
      if (document.visibilityState !== 'visible') return;
      if (!this.active || this.progress.completed) return;
      this._applyTransientActionHeuristicIfNeeded()
        .then(() => {
          withViewTransition(() => this._render({ reason: 'visibility' }));
        })
        .catch(() => {});
    } catch {
      // ignore
    }
  }

  async _applyBackForwardHeuristicIfNeeded() {
    try {
      // Only relevant for onboarding being active/incomplete.
      if (!this.active || this.progress.completed) return;

      const navEntries = (typeof performance !== 'undefined' && performance.getEntriesByType)
        ? performance.getEntriesByType('navigation')
        : [];
      const nav = navEntries && navEntries[0];
      const navType = nav && typeof nav.type === 'string' ? nav.type : '';
      if (navType !== 'back_forward') return;

      const slide = this._getCurrentSlide();
      if (!slide) return;

      const completed = new Set(this.progress.completedTaskIds);
      let changed = false;

      for (const task of slide.tasks || []) {
        if (!task || !task.id || completed.has(task.id)) continue;
        if (this._taskMatches(task, { type: 'action', action: 'back', detail: {} })) {
          completed.add(task.id);
          changed = true;
        }
      }

      if (!changed) return;
      this.progress.completedTaskIds = Array.from(completed);
      await this._persist();

      // Mirror auto-advance behavior for BFCache/back-forward recovery.
      const slideComplete = this._isSlideComplete(slide, completed);
      if (slideComplete) {
        this._handleSlideCompleted(slide, { cause: 'back_forward', completedTaskIds: Array.from(completed) });
        await this._advanceSlide({ cause: 'back_forward' });
      }
    } catch {
      // ignore
    }
  }

  async _loadModel() {
    const url = chrome.runtime.getURL('pages/onboarding.xml');
    const res = await fetch(url);
    const text = await res.text();
    this.model = parseOnboardingXml(text);
  }

  async _loadProgress() {
    const data = await storageGet([STORAGE_KEYS.ACTIVE, STORAGE_KEYS.PROGRESS]);

    const active = safeBool(data[STORAGE_KEYS.ACTIVE]);
    this.active = active === null ? false : active;

    const p = data[STORAGE_KEYS.PROGRESS];
    if (p && typeof p === 'object') {
      this.progress.slideId = typeof p.slideId === 'string' ? p.slideId : this.progress.slideId;
      this.progress.completed = !!p.completed;
      this.progress.timestamp = typeof p.timestamp === 'number' ? p.timestamp : this.progress.timestamp;

      if (Array.isArray(p.completedTaskIds)) {
        this.progress.completedTaskIds = p.completedTaskIds.map(String);
      }
      if (Array.isArray(p.onEnterDoneSlideIds)) {
        this.progress.onEnterDoneSlideIds = p.onEnterDoneSlideIds.map(String);
      }
    }
  }

  async _persist() {
    this.progress.timestamp = Date.now();
    await storageSet({
      [STORAGE_KEYS.ACTIVE]: this.active,
      [STORAGE_KEYS.PROGRESS]: this.progress
    });
  }

  async setActive(active) {
    const next = !!active;
    console.log('[KeyPilot Onboarding] setActive called:', { current: this.active, next });
    // Don't allow Alt+/ (or other triggers) to reopen onboarding while KeyPilot is disabled.
    if (next && !this._isKeyPilotEnabled()) {
      console.log('[KeyPilot Onboarding] KeyPilot disabled, hiding panel');
      this.panel.hide();
      this.practicePanel.hide();
      this._isTransitioning = false;
      return;
    }
    if (this.active === next) {
      console.log('[KeyPilot Onboarding] Active state unchanged, ensuring render state is correct');
      // Even if state hasn't changed, ensure UI is in sync (e.g., if panel visibility got out of sync)
      this._render();
      // If closing (next === false), ensure we persist this so other factors don't re-show it
      if (!next) {
        await this._persist();
      }
      return;
    }
    console.log('[KeyPilot Onboarding] Changing active state and persisting');
    this.active = next;
    this._isTransitioning = false;
    await this._persist();
    this._render();
  }

  _currentSlideIndex() {
    const idx = this.model.slides.findIndex((s) => s.id === this.progress.slideId);
    return idx >= 0 ? idx : 0;
  }

  _getCurrentSlide() {
    const idx = this._currentSlideIndex();
    return this.model.slides[idx] || null;
  }

  /**
   * @param {Object} [opts]
   * @param {{type:'slide', dir:1|-1}|null} [opts.transition]
   * @param {string} [opts.reason]
   */
  _render(opts = {}) {
    const slide = this._getCurrentSlide();
    const total = this.model.slides.length;
    const index = this._currentSlideIndex();

    console.log('[KeyPilot Onboarding] _render called:', { active: this.active, completed: this.progress.completed, slide: slide?.id });

    // Never show onboarding UI while KeyPilot is disabled.
    if (!this._isKeyPilotEnabled()) {
      this.panel.hide();
      this.practicePanel.hide();
      return;
    }

    if (!this.active || this.progress.completed || !slide) {
      console.log('[KeyPilot Onboarding] Hiding panels (not active, completed, or no slide)');
      this.panel.hide();
      this.practicePanel.hide();
      return;
    }

    this.panel.show();
    // Determine whether this render is a slide transition (for animation + hooks).
    const isSlideChange =
      this._lastRenderedSlideId !== null &&
      String(this._lastRenderedSlideId) !== String(slide.id);

    /** @type {{type:'slide', dir:1|-1}|null} */
    const transition =
      opts && opts.transition
        ? opts.transition
        : (isSlideChange ? { type: 'slide', dir: index > (this._lastRenderedSlideIndex || 0) ? 1 : -1 } : null);

    const reason = opts && opts.reason ? String(opts.reason) : 'render';

    const fromSlideId = this._lastRenderedSlideId;

    // If an overlay was shown on the prior slide (e.g. via onEnter), ensure it doesn't
    // persist into the next slide when the user manually navigates.
    if (transition && transition.type === 'slide' && fromSlideId !== null && String(fromSlideId) !== String(slide.id)) {
      try { this.panel.hideOverlay(); } catch { /* ignore */ }
    }

    if (transition && transition.type === 'slide') {
      this._emit('slideTransitionStart', {
        fromSlideId,
        toSlideId: slide.id,
        dir: transition.dir,
        reason
      });
    }

    const renderPromise = this.panel.render({
      title: slide.title || 'Welcome to KeyPilot',
      bodyText: slide.bodyText || '',
      slideId: slide.id,
      slideIndex: index,
      slideCount: total,
      tasks: slide.tasks,
      completedTaskIds: new Set(this.progress.completedTaskIds),
      transition
    });

    // Transition end hook (best-effort).
    if (transition && transition.type === 'slide') {
      Promise.resolve(renderPromise)
        .then(() => {
          this._isTransitioning = false;
          this._emit('slideTransitionEnd', {
            fromSlideId,
            toSlideId: slide.id,
            dir: transition.dir,
            reason
          });
        })
        .catch(() => {
          this._isTransitioning = false;
        });
    } else {
      // No transition, so we're not transitioning
      this._isTransitioning = false;
    }

    this._lastRenderedSlideId = slide.id;
    this._lastRenderedSlideIndex = index;

    // Check if this slide is already complete (which would trigger auto-advance)
    const isComplete = this._isSlideComplete(slide, new Set(this.progress.completedTaskIds));
    console.log('[KeyPilot Onboarding] Rendered slide:', slide.id, 'complete:', isComplete, 'completed tasks:', this.progress.completedTaskIds);

    // Reset practice dismissal when entering a new slide.
    if (this._practiceLastSlideId !== slide.id) {
      this._practiceLastSlideId = slide.id;
      this._practiceDismissed = false;
    }

    // Practice popover: show only on the text box mode slide, and hide otherwise.
    const shouldShowPractice = slide.id === 'text_box_mode' && !this._practiceDismissed;
    if (shouldShowPractice) {
      const wasVisible = this.practicePanel.isVisible();

      this.practicePanel.show();
      this.practicePanel.render();
      this.practicePanel.positionNextToOnboarding(this.panel.root);

      // IMPORTANT: Only do the "start fresh" text-mode exit when the practice popover
      // FIRST appears. If we do this on every render, it will immediately cancel text mode
      // the moment the user focuses an input inside the practice panel.
      if (!wasVisible) {
        try {
          const kp = window.__KeyPilotInstance;
          const st = kp?.state?.getState?.();
          if (st?.mode === MODES.TEXT_FOCUS && typeof kp.handleEscapeFromTextFocus === 'function') {
            kp.handleEscapeFromTextFocus(st);
          }
        } catch { /* ignore */ }
      }
    } else {
      this.practicePanel.hide();
    }

    // Fire onEnter actions once per slide.
    if (!this.progress.onEnterDoneSlideIds.includes(slide.id)) {
      this.progress.onEnterDoneSlideIds.push(slide.id);
      this._persist(); // best-effort; don't block UI
      this._runOnEnter(slide);
    }

  }

  _runOnEnter(slide) {
    const entries = Array.isArray(slide?.onEnter) ? slide.onEnter : [];
    for (const entry of entries) {
      if (!entry || !entry.type) continue;

      // overlay: show a modal overlay on top of the onboarding panel, blurring the slide behind it.
      if (entry.type === 'overlay') {
        const title = String(entry.title || 'Nice!').trim();
        const message = String(entry.message || entry.text || '').trim();
        const primaryText = String(entry.primaryText || entry.primary || 'Got it').trim();
        const secondaryText = String(entry.secondaryText || entry.secondary || '').trim();
        try {
          this.panel.showOverlay({
            title,
            message,
            primaryText,
            secondaryText
          });
          this._emit('overlayShown', { slideId: slide?.id || null, title, message });
        } catch {
          // ignore
        }
        continue;
      }

      // openTab: open an extension page in a new foreground tab so users can practice.
      if (entry.type === 'openTab') {
        const relUrl = String(entry.url || '').trim();
        if (!relUrl) continue;
        const url = chrome.runtime.getURL(relUrl);

        // Prefer opening via background so it behaves like KeyPilot's other new-tab actions.
        try {
          chrome.runtime.sendMessage({ type: 'KP_OPEN_URL_FOREGROUND', url }).catch(() => {});
          continue;
        } catch {
          // fall back
        }

        try {
          window.open(url, '_blank', 'noopener,noreferrer');
        } catch {
          // ignore
        }
        continue;
      }

      // Legacy: openPopover (kept for future slides).
      if (entry.type === 'openPopover') {
        const relUrl = String(entry.url || '').trim();
        if (!relUrl) continue;

        const title = String(entry.title || 'KeyPilot Tutorial');

        try {
          const kp = window.__KeyPilotInstance;
          if (!kp || !kp.overlayManager || typeof kp.overlayManager.showPopover !== 'function') continue;
          const url = chrome.runtime.getURL(relUrl);
          kp.overlayManager.showPopover(url, { title });
          // Popover is modal; keep KeyPilot state consistent.
          try {
            kp.state?.setPopoverOpen?.(true, url);
          } catch {
            // ignore
          }
        } catch {
          // ignore
        }
      }
    }
  }

  _onDocKeydownCapture(e) {
    try {
      if (!this._isKeyPilotEnabled()) return;

      // Don't open onboarding popover when in text mode (similar to how ' doesn't open settings)
      try {
        const kp = window.__KeyPilotInstance;
        const st = kp?.state?.getState?.();
        if (st?.mode === MODES.TEXT_FOCUS) return;
      } catch { /* ignore */ }

      // Alt + / : open/close onboarding.
      //
      // Notes:
      // - Prefer `e.code === 'Slash'` because `e.key` varies by layout.
      // - Support AltGr layouts where the browser may report Ctrl+Alt, and/or AltGraph state.
      const isAltOrAltGraph =
        !!e &&
        (
          e.altKey === true ||
          (typeof e.getModifierState === 'function' && e.getModifierState('AltGraph') === true)
        );

      const isSlashKey =
        !!e &&
        (
          e.code === 'Slash' ||
          e.key === '/' ||
          e.key === '?'
        );

      const isAltSlash = isAltOrAltGraph && isSlashKey;

      if (!isAltSlash) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Toggle onboarding panel (does not reset progress).
      // If it's open, close it; if closed, open it.
      const shouldOpen = !(this.active === true && this.panel?.isVisible?.());
      this.setActive(shouldOpen);
    } catch {
      // ignore
    }
  }

  _onActionEvent(ev) {
    if (!this.active || this.progress.completed) return;
    // If KeyPilot toggles off/on, update UI and listeners accordingly.
    try {
      const a = ev?.detail?.action;
      if (a === 'toggleExtension') {
        const enabled = ev?.detail?.enabled;
        if (typeof enabled === 'boolean') {
          this._enabledCache = enabled === true;
          this._enabledCacheTs = Date.now();
          this._setAltSlashListenerEnabled(enabled);
          if (!enabled) {
            console.log('[KeyPilot Onboarding] Extension toggled off, hiding panel');
            this.panel.hide();
            this.practicePanel.hide();
            return;
          } else {
            console.log('[KeyPilot Onboarding] Extension toggled on, re-rendering onboarding');
            // Re-render to ensure the panel is in the correct state
            this._render();
          }
        }
      }
    } catch { /* ignore */ }
    const slide = this._getCurrentSlide();
    if (!slide) return;

    const detail = ev?.detail || {};
    const action = typeof detail.action === 'string' ? detail.action : '';
    if (!action) return;
    this._lastAction = action;

    let changed = false;
    const completed = new Set(this.progress.completedTaskIds);

    for (const task of slide.tasks || []) {
      if (!task || !task.id || completed.has(task.id)) continue;
      if (this._taskMatches(task, { type: 'action', action, detail })) {
        completed.add(task.id);
        changed = true;
      }
    }

    if (!changed) return;

    this.progress.completedTaskIds = Array.from(completed);
    this._persist(); // best-effort

    this._render({ reason: 'taskUpdate' });

    // If slide is complete, advance.
    const slideComplete = this._isSlideComplete(slide, completed);
    console.log('[KeyPilot Onboarding] After action', action, 'slide', slide.id, 'complete:', slideComplete);
    if (slideComplete) {
      this._handleSlideCompleted(slide, { cause: action, completedTaskIds: Array.from(completed) });
      this._advanceSlide({ cause: action });
    }
  }

  _isSlideComplete(slide, completedTaskIdsSet) {
    const tasks = slide?.tasks || [];
    if (!tasks.length) return true;
    for (const t of tasks) {
      if (!t?.id) continue;
      if (!completedTaskIdsSet.has(t.id)) return false;
    }
    return true;
  }

  _handleSlideCompleted(slide, { cause = '', completedTaskIds = null } = {}) {
    try {
      const idx = this._currentSlideIndex();
      const next = this.model.slides[idx + 1] || null;
      const isLast = !next;
      this._emit('slideCompleted', {
        slideId: slide?.id || null,
        slideIndex: idx,
        slideCount: this.model.slides.length,
        nextSlideId: next?.id || null,
        cause: String(cause || ''),
        completedTaskIds: Array.isArray(completedTaskIds) ? completedTaskIds : Array.from(new Set(this.progress.completedTaskIds))
      });
      if (isLast) {
        this._emit('lastSlideCompleted', {
          slideId: slide?.id || null,
          slideIndex: idx,
          slideCount: this.model.slides.length,
          cause: String(cause || '')
        });
      }
    } catch {
      // ignore
    }
  }

  async _advanceSlide({ cause = '' } = {}) {
    console.log('[KeyPilot Onboarding] _advanceSlide called, cause:', cause, 'isTransitioning:', this._isTransitioning);
    if (this._isTransitioning) return;

    const idx = this._currentSlideIndex();
    const next = this.model.slides[idx + 1];

    if (!next) {
      // Completed all slides.
      console.log('[KeyPilot Onboarding] No next slide, completing onboarding');
      this.progress.completed = true;
      this.active = false;
      await this._persist();
      this._emit('onboardingCompleted', {
        slideId: this.progress.slideId,
        slideIndex: idx,
        slideCount: this.model.slides.length,
        cause: String(cause || '')
      });
      this._render({ reason: 'completed' });
      return;
    }

    console.log('[KeyPilot Onboarding] Auto-advancing from slide', this.model.slides[idx]?.id, 'to', next.id);
    this.progress.slideId = next.id;
    await this._persist();
    this._isTransitioning = true;
    this._render({ transition: { type: 'slide', dir: 1 }, reason: 'autoAdvance' });
  }

  _taskMatches(task, ctx) {
    const when = task?.when || {};
    const type = String(when.type || '').trim();
    if (!type) return false;

    if (type === 'action' && ctx.type === 'action') {
      if (when.action && when.action !== ctx.action) return false;

      const target = String(when.target || '').trim();
      if (!target) return true;

      if (target === 'link') return !!ctx.detail?.isLink;
      if (target === 'keyboardHelpKey') return !!ctx.detail?.isKeyboardHelpKey;
      return false;
    }

    if (type === 'mode' && ctx.type === 'mode') {
      const mode = String(when.mode || '').trim();
      const change = String(when.change || '').trim();
      if (!mode || !change) return false;

      if (change === 'enter') return ctx.nextMode === mode && ctx.prevMode !== mode;
      if (change === 'exit') return ctx.prevMode === mode && ctx.nextMode !== mode;
      return false;
    }

    return false;
  }

  _attachToKeyPilotStateSoon() {
    if (this._keyPilotReady) return;

    const tryAttach = () => {
      try {
        const kp = window.__KeyPilotInstance;
        if (!kp || !kp.state || typeof kp.state.subscribe !== 'function') return false;

        this._keyPilotReady = true;
        // Track initial mode.
        try {
          const s = kp.state.getState?.();
          this._prevMode = s?.mode || null;
        } catch {
          this._prevMode = null;
        }

        this._unsubscribeState = kp.state.subscribe((nextState, prevState) => {
          if (!this.active || this.progress.completed) return;
          const slide = this._getCurrentSlide();
          if (!slide) return;

          const prevMode = prevState?.mode || this._prevMode || null;
          const nextMode = nextState?.mode || null;
          this._prevMode = nextMode;

          let changed = false;
          const completed = new Set(this.progress.completedTaskIds);

          for (const task of slide.tasks || []) {
            if (!task || !task.id || completed.has(task.id)) continue;
            if (this._taskMatches(task, { type: 'mode', prevMode, nextMode })) {
              completed.add(task.id);
              changed = true;
            }
          }

          if (!changed) return;
          this.progress.completedTaskIds = Array.from(completed);
          this._persist(); // best-effort
          this._render({ reason: 'modeTaskUpdate' });

          const slideComplete = this._isSlideComplete(slide, completed);
          console.log('[KeyPilot Onboarding] After mode change, slide', slide.id, 'complete:', slideComplete);
          if (slideComplete) {
            this._handleSlideCompleted(slide, { cause: 'modeChange', completedTaskIds: Array.from(completed) });
            this._advanceSlide({ cause: 'modeChange' });
          }
        });

        return true;
      } catch {
        return false;
      }
    };

    // Poll for KeyPilot instance for a short window; it initializes async.
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (tryAttach() || attempts > 80) {
        try { clearInterval(timer); } catch { /* ignore */ }
      }
    }, 100);
  }
}


