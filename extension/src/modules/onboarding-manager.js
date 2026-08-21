/**
 * OnboardingManager
 * - Loads onboarding slides/tasks from XML
 * - Persists progress globally (profile-wide) via chrome.storage
 * - Renders a floating panel (top-left) and auto-checks tasks based on KeyPilot actions/mode changes
 */
import { MODES } from '../config/constants.js';
import { OnboardingPanel } from '../ui/onboarding-panel.js';
import { PracticePopoverPanel } from '../ui/practice-popover-panel.js';
import {
  ONBOARDING_STORAGE_KEYS,
  cloneProgress,
  createEmptyProgress,
  isSlideComplete,
  progressEqual
} from '../ui/onboarding-shared.js';
import { storageSetObject } from '../utils/storage.js';
import { MSG } from '../messaging/types.js';

// NOTE: Do not `import { X as Y }` — build.js strips imports and aliases are lost.
// Use ONBOARDING_STORAGE_KEYS by name (defined in onboarding-shared.js).

const TRANSIENT_KEYS = {
  LAST_ACTION: 'keypilot_transient_action'
};

function safeBool(v) {
  return typeof v === 'boolean' ? v : null;
}

/**
 * Read onboarding keys from sync + local.
 * For PROGRESS, prefer the newer timestamp when both areas have a value so a
 * successful local-only reset cannot be masked by stale sync data (and vice versa).
 * @param {string[]} keys
 */
async function storageGet(keys) {
  const list = Array.isArray(keys) ? keys.filter((k) => typeof k === 'string' && k) : [];
  if (!list.length) return {};

  /** @type {Record<string, any>} */
  let sync = {};
  /** @type {Record<string, any>} */
  let local = {};

  try {
    if (chrome?.storage?.sync?.get) {
      sync = (await chrome.storage.sync.get(list)) || {};
    }
  } catch {
    sync = {};
  }
  try {
    if (chrome?.storage?.local?.get) {
      local = (await chrome.storage.local.get(list)) || {};
    }
  } catch {
    local = {};
  }

  /** @type {Record<string, any>} */
  const out = {};
  for (const key of list) {
    const hasSync = Object.prototype.hasOwnProperty.call(sync, key) && sync[key] !== undefined;
    const hasLocal = Object.prototype.hasOwnProperty.call(local, key) && local[key] !== undefined;

    if (key === ONBOARDING_STORAGE_KEYS.PROGRESS && hasSync && hasLocal) {
      const s = sync[key];
      const l = local[key];
      const sTs = s && typeof s === 'object' && typeof s.timestamp === 'number' ? s.timestamp : 0;
      const lTs = l && typeof l === 'object' && typeof l.timestamp === 'number' ? l.timestamp : 0;
      out[key] = lTs > sTs ? l : s;
      continue;
    }

    if (hasSync) out[key] = sync[key];
    else if (hasLocal) out[key] = local[key];
  }
  return out;
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

/**
 * Write onboarding keys to both sync and local.
 * Preferring sync-only caused reset/progress races: a failed or partial sync write left
 * local with a newer snapshot that later reads could miss (or vice versa).
 * @param {Record<string, any>} obj
 */
async function storageSet(obj) {
  if (!obj || typeof obj !== 'object') return false;
  let ok = false;
  try {
    if (chrome?.storage?.sync?.set) {
      await chrome.storage.sync.set(obj);
      ok = true;
    }
  } catch {
    // continue; still try local so both areas can converge
  }
  try {
    if (chrome?.storage?.local?.set) {
      await chrome.storage.local.set(obj);
      ok = true;
    }
  } catch {
    // ignore
  }
  // Fallback to shared helper if neither area accepted the direct write.
  if (!ok) {
    ok = await storageSetObject(obj);
  }
  return ok;
}

/**
 * Run a DOM update for onboarding.
 *
 * Intentionally does NOT use document.startViewTransition here.
 * Chrome's page-level View Transitions can swallow the first onEnter overlay
 * paint on install (Brave often falls back / differs). Slide transitions are
 * already handled inside OnboardingPanel.render().
 * @param {() => void} updateDomFn
 */
function withViewTransition(updateDomFn) {
  try {
    updateDomFn();
  } catch {
    // ignore
  }
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
      onRequestReset: () => this.resetTutorial(),
      onRequestUncheckTask: (taskId) => this.uncheckLastTask(taskId)
    });

    this.practicePanel = new PracticePopoverPanel({
      onRequestClose: () => {
        // Practice popover is auxiliary; hiding it should not disable onboarding.
        this._practiceDismissed = true;
      }
    });

    this.model = { slides: [] };
    this.progress = createEmptyProgress(null);

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
    /** @type {string|null} */
    this._onEnterOverlayPendingSlideId = null;

    // Coalesced persistence: rapid task updates + Reset must not race.
    // Fire-and-forget _persist() used to capture a live progress object that a later
    // resetTutorial() replaced — the late write then restored stale completed tasks.
    this._persistDirty = false;
    this._persistChain = null;
    this._persistEpoch = 0;
    this._applyingRemoteProgress = false;

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

  /**
   * Clear all walkthrough progress and return to the first slide.
   * Safe to call while other task-completion persists are in flight.
   */
  /**
   * Undo only the most recently completed task (user clicked that checklist row).
   * @param {string} taskId
   */
  uncheckLastTask(taskId) {
    if (!this._isKeyPilotEnabled() || !this.active || this.progress.completed) return;
    const id = String(taskId || '');
    if (!id) return;
    const ids = Array.isArray(this.progress.completedTaskIds)
      ? this.progress.completedTaskIds.map(String)
      : [];
    if (!ids.length || ids[ids.length - 1] !== id) return;
    this.progress.completedTaskIds = ids.slice(0, -1);
    // Allow onEnter effects (overlay/marquee) to re-fire if undoing back into a prior slide context
    // is not needed; only uncheck the task.
    this._persist();
    this._render({ reason: 'uncheck', forceRebuild: true });
  }

  async resetTutorial() {
    if (!this._isKeyPilotEnabled()) return;

    const firstSlideId = this.model.slides[0]?.id || null;
    // Bump epoch first so any in-flight remote apply / stale persist is ignored.
    this._persistEpoch += 1;
    this.progress = createEmptyProgress(firstSlideId);
    this.active = true;
    this._practiceDismissed = false;
    this._practiceLastSlideId = null;
    this._lastRenderedSlideId = null;
    this._lastRenderedSlideIndex = null;
    this._isTransitioning = false;
    this._lastAction = null;

    try { this.panel.hideOverlay(); } catch { /* ignore */ }
    try { this.practicePanel.hide(); } catch { /* ignore */ }

    await this._persist();
    this._isTransitioning = true;
    // forceRebuild: always rebuild checklist rows so completed checkmarks cannot stick
    // via in-place DOM update when remaining on the same slide.
    this._render({
      transition: { type: 'slide', dir: -1 },
      reason: 'reset',
      forceRebuild: true
    });
    this._emit('tutorialReset', {
      slideId: firstSlideId,
      timestamp: this.progress.timestamp
    });
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
      const resp = await chrome.runtime.sendMessage({ type: MSG.GET_STATE });
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

    // Alt + T re-opens onboarding, but ONLY while KeyPilot is enabled.
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
      // Don't apply recovered completions under an unaccepted intro overlay.
      if (this._isOverlayBlockingTasks()) return;

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
      const changed = this._tryCompleteNextMatchingTask(slide, completed, {
        type: 'action',
        action,
        detail: {}
      });

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
      // Ignore echo from our own coalesced persist loop.
      if (this._applyingRemoteProgress) return;
      if (this._persistDirty || this._persistChain) return;

      const relevant =
        Object.prototype.hasOwnProperty.call(changes, ONBOARDING_STORAGE_KEYS.ACTIVE) ||
        Object.prototype.hasOwnProperty.call(changes, ONBOARDING_STORAGE_KEYS.PROGRESS);
      if (!relevant) return;

      // Debounce: multiple writes can come in quick bursts (sync + local dual-write).
      try { if (this._storageChangeTimer) clearTimeout(this._storageChangeTimer); } catch { /* ignore */ }
      const epochAtSchedule = this._persistEpoch;
      this._storageChangeTimer = setTimeout(() => {
        // A local reset/navigation happened after this event was scheduled.
        if (epochAtSchedule !== this._persistEpoch) return;
        if (this._persistDirty || this._persistChain) return;
        this._loadProgress({ preferRemote: true })
          .then((changed) => {
            if (epochAtSchedule !== this._persistEpoch) return;
            if (changed === false) return;
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
      if (this._isOverlayBlockingTasks()) return;

      const navEntries = (typeof performance !== 'undefined' && performance.getEntriesByType)
        ? performance.getEntriesByType('navigation')
        : [];
      const nav = navEntries && navEntries[0];
      const navType = nav && typeof nav.type === 'string' ? nav.type : '';
      if (navType !== 'back_forward') return;

      const slide = this._getCurrentSlide();
      if (!slide) return;

      const completed = new Set(this.progress.completedTaskIds);
      const changed = this._tryCompleteNextMatchingTask(slide, completed, {
        type: 'action',
        action: 'back',
        detail: {}
      });

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
    try {
      const url = chrome.runtime.getURL('pages/onboarding.xml');
      const res = await fetch(url);
      const text = await res.text();
      this.model = parseOnboardingXml(text);
      if (this.model?.slides?.length) return;
    } catch {
      // fall through to early-inject stamped model
    }
    try {
      const early = window.KEYPILOT_EARLY?.getOnboardingModel?.();
      if (early && Array.isArray(early.slides) && early.slides.length) {
        this.model = early;
      }
    } catch {
      // ignore
    }
  }

  /**
   * Load active flag + progress from storage.
   * @param {{preferRemote?: boolean}} [opts]
   * @returns {Promise<boolean>} true when in-memory state was updated
   */
  async _loadProgress(opts = {}) {
    const preferRemote = opts.preferRemote === true;
    const data = await storageGet([ONBOARDING_STORAGE_KEYS.ACTIVE, ONBOARDING_STORAGE_KEYS.PROGRESS]);

    const active = safeBool(data[ONBOARDING_STORAGE_KEYS.ACTIVE]);
    let changed = false;

    if (active !== null && active !== this.active) {
      this.active = active;
      changed = true;
    } else if (active === null && !preferRemote) {
      // First load: default inactive when unset.
      if (this.active !== false) {
        this.active = false;
        changed = true;
      }
    }

    const p = data[ONBOARDING_STORAGE_KEYS.PROGRESS];
    if (p && typeof p === 'object') {
      const remote = cloneProgress(p);
      const localTs = typeof this.progress?.timestamp === 'number' ? this.progress.timestamp : 0;
      const remoteTs = remote.timestamp || 0;

      // Drop strictly older snapshots (stale dual-area / late writes).
      // Equal timestamps still apply so a cold load can hydrate.
      if (preferRemote && remoteTs && localTs && remoteTs < localTs) {
        return changed;
      }

      if (!progressEqual(this.progress, remote)) {
        this.progress = remote;
        changed = true;
      }
    }
    return changed;
  }

  /**
   * Persist active + progress. Coalesces concurrent callers so the last
   * in-memory state always wins (critical for Reset vs task-complete races).
   * @returns {Promise<void>}
   */
  async _persist() {
    this._persistDirty = true;
    if (!this._persistChain) {
      this._persistChain = this._drainPersistQueue().finally(() => {
        this._persistChain = null;
      });
    }
    await this._persistChain;
  }

  async _drainPersistQueue() {
    while (this._persistDirty) {
      this._persistDirty = false;
      // Snapshot at write time (not at schedule time) so superseded states are skipped.
      const payload = {
        [ONBOARDING_STORAGE_KEYS.ACTIVE]: this.active,
        [ONBOARDING_STORAGE_KEYS.PROGRESS]: cloneProgress({
          ...this.progress,
          timestamp: Date.now()
        })
      };
      this.progress.timestamp = payload[ONBOARDING_STORAGE_KEYS.PROGRESS].timestamp;
      this._applyingRemoteProgress = true;
      try {
        await storageSet(payload);
      } finally {
        // Allow storage echo handlers after a tick so dual-area onChanged can settle.
        try {
          setTimeout(() => {
            this._applyingRemoteProgress = false;
          }, 0);
        } catch {
          this._applyingRemoteProgress = false;
        }
      }
    }
  }

  async setActive(active) {
    const next = !!active;
    // Don't allow Alt+T (or other triggers) to reopen onboarding while KeyPilot is disabled.
    if (next && !this._isKeyPilotEnabled()) {
      this.panel.hide();
      this.practicePanel.hide();
      this._isTransitioning = false;
      return;
    }
    if (this.active === next) {
      // Even if state hasn't changed, ensure UI is in sync (e.g., if panel visibility got out of sync)
      if (next) this._render();
      else {
        this.hideReEnableTip();
        this.hideToggleOffArrow();
        this.panel.hide();
        this.practicePanel.hide();
        await this._persist();
      }
      return;
    }
    this.active = next;
    this._isTransitioning = false;
    if (!next) {
      this.hideReEnableTip();
      this.hideToggleOffArrow();
    }
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
   * @param {boolean} [opts.forceRebuild] Force checklist DOM rebuild (e.g. after Reset)
   */
  _render(opts = {}) {
    const slide = this._getCurrentSlide();
    const total = this.model.slides.length;
    const index = this._currentSlideIndex();

    // Never show onboarding UI while KeyPilot is disabled.
    if (!this._isKeyPilotEnabled()) {
      this.hideToggleOffArrow();
      this.panel.hide();
      this.practicePanel.hide();
      return;
    }

    if (!this.active || this.progress.completed || !slide) {
      this.hideToggleOffArrow();
      this.panel.hide();
      this.practicePanel.hide();
      return;
    }

    // If the off-step is still open while KeyPilot is already disabled, complete it
    // so the user can focus on turning KeyPilot back on.
    try { this._autoCompleteToggleOffIfAlreadyDisabled(); } catch { /* ignore */ }

    // Determine whether this render is a slide transition (for animation + hooks)
    // before mutating last-rendered ids / showing the panel.
    const isSlideChange =
      this._lastRenderedSlideId !== null &&
      String(this._lastRenderedSlideId) !== String(slide.id);

    /** @type {{type:'slide', dir:1|-1}|null} */
    const wantTransition =
      opts && opts.transition
        ? opts.transition
        : (isSlideChange ? { type: 'slide', dir: index > (this._lastRenderedSlideIndex || 0) ? 1 : -1 } : null);
    // Don't slide-animate the first reveal (would animate off the placeholder).
    const transition = this.panel.isVisible() ? wantTransition : null;

    const reason = opts && opts.reason ? String(opts.reason) : 'render';
    const forceRebuild = !!(opts && opts.forceRebuild) || reason === 'reset';

    const fromSlideId = this._lastRenderedSlideId;

    // If an overlay was shown on the prior slide (e.g. via onEnter), ensure it doesn't
    // persist into the next slide when the user manually navigates or resets.
    if (
      reason === 'reset' ||
      (transition && transition.type === 'slide' && fromSlideId !== null && String(fromSlideId) !== String(slide.id))
    ) {
      try { this.panel.hideOverlay(); } catch { /* ignore */ }
    }

    // Fire onEnter (incl. slide overlay) before revealing the panel / painting the
    // checklist so the first visible frame includes the dimmer.
    if (!this.progress.onEnterDoneSlideIds.includes(slide.id)) {
      this._runOnEnter(slide);
    }

    this._syncKeyboardReferenceForKeyInfoStep();

    if (transition && transition.type === 'slide') {
      this._emit('slideTransitionStart', {
        fromSlideId,
        toSlideId: slide.id,
        dir: transition.dir,
        reason
      });
    }

    const tasksForUi = (slide.tasks || []).map((t) => ({
      ...t,
      label: this._resolveTaskLabel(t)
    }));

    const completedList = Array.isArray(this.progress.completedTaskIds)
      ? this.progress.completedTaskIds.map(String)
      : [];
    // Only the most recently completed task may be unchecked by clicking it.
    const lastCompletedTaskId = completedList.length ? completedList[completedList.length - 1] : null;

    const renderPromise = this.panel.render({
      title: slide.title || 'Welcome to KeyPilot',
      bodyText: slide.bodyText || '',
      slideId: slide.id,
      slideIndex: index,
      slideCount: total,
      tasks: tasksForUi,
      completedTaskIds: new Set(completedList),
      lastCompletedTaskId,
      // Reopen tip removed from walkthrough slides (kept available via showTip API).
      showTip: false,
      showCloseButton: slide.id === 'completion',
      transition,
      forceRebuild
    });

    // Reveal after the first paint so a restored slideIndex > 0 is not preceded
    // by the early-inject placeholder / slide 1 title.
    this.panel.show();

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

    // Control-strip arrow only for the next incomplete "turn off" task.
    this._syncToggleOffArrow();
    this._syncKeyboardReferenceForKeyInfoStep();

  }

  /**
   * Persist that onEnter for this slide has finished (so it won't re-fire).
   * For overlay onEnter, call only after the user accepts the modal (OK / primary) —
   * not merely when the overlay is shown, and not when they Close/dismiss without accepting.
   * @param {string|null|undefined} slideId
   */
  _markOnEnterDone(slideId) {
    const id = String(slideId || '');
    if (!id) return;
    if (this.progress.onEnterDoneSlideIds.includes(id)) return;
    this.progress.onEnterDoneSlideIds.push(id);
    this._persist(); // best-effort; don't block UI
  }

  _runOnEnter(slide) {
    const entries = Array.isArray(slide?.onEnter) ? slide.onEnter : [];
    const slideId = slide?.id || null;
    let hasOverlay = false;

    for (const entry of entries) {
      if (!entry || !entry.type) continue;

      // overlay: show a modal overlay on top of the onboarding panel, blurring the slide behind it.
      if (entry.type === 'overlay') {
        hasOverlay = true;
        const title = String(entry.title || 'Nice!').trim();
        const message = String(entry.message || entry.text || '').trim();
        const primaryText = String(entry.primaryText || entry.primary || 'OK').trim();
        const secondaryText = String(entry.secondaryText || entry.secondary || '').trim();
        const secondaryAction = String(entry.secondaryAction || '').trim().toLowerCase();
        const laterTitle = String(entry.laterTitle || '').trim();
        const laterMessage = String(entry.laterMessage || entry.laterText || '').trim();
        const laterPrimaryText = String(entry.laterPrimaryText || entry.laterPrimary || 'OK, Close').trim();
        const effect = String(entry.effect || '').trim().toLowerCase();
        const shouldPlayEffect =
          effect === 'marquee' || effect === 'flash' || effect === 'dash' || effect === 'scale';

        const closeWalkthrough = () => {
          try { this.setActive(false); } catch { /* ignore */ }
        };

        const acceptOverlay = () => {
          this._markOnEnterDone(slideId);
        };

        const showLaterReminder = () => {
          const reminderTitle =
            laterTitle ||
            'Return to this Tutorial with `Alt`+`T`';
          try {
            this.panel.showOverlay({
              title: reminderTitle,
              message: laterMessage,
              primaryText: laterPrimaryText || 'OK, Close',
              secondaryText: '',
              onPrimary: closeWalkthrough
            });
          } catch {
            closeWalkthrough();
          }
        };

        let onSecondary = null;
        if (secondaryText) {
          if (secondaryAction === 'later' || secondaryAction === 'defer' || secondaryAction === 'remind') {
            // Choosing "later" counts as accepting this slide's intro (don't re-show it).
            onSecondary = () => {
              acceptOverlay();
              showLaterReminder();
            };
          } else if (secondaryAction === 'close' || secondaryAction === 'dismiss') {
            // Close without accepting — reopen should show this overlay again.
            onSecondary = closeWalkthrough;
          }
        }

        /** Run border celebration only after the overlay is visible on screen. */
        const scheduleBorderEffect = () => {
          if (!shouldPlayEffect) return;
          const play = () => {
            try {
              if (!this.panel.isOverlayOpen?.()) return;
              this.panel.playBorderEffect?.(effect);
            } catch { /* ignore */ }
          };
          try {
            // Wait for overlay layout/paint, then a short beat so the card reads first.
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                try {
                  setTimeout(play, 160);
                } catch {
                  play();
                }
              });
            });
          } catch {
            try { setTimeout(play, 200); } catch { play(); }
          }
        };

        // Avoid stacking multiple deferred attempts for the same slide.
        if (this._onEnterOverlayPendingSlideId === slideId) continue;
        this._onEnterOverlayPendingSlideId = slideId;

        // Early-inject may already have the welcome modal open — adopt it.
        // Do not mark onEnter done until the user accepts (OK); Close must leave it pending.
        try {
          if (this.panel.isOverlayOpen?.()) {
            this._onEnterOverlayPendingSlideId = null;
            // Re-bind accept / close handlers onto the adopted early overlay.
            try {
              this.panel.showOverlay({
                title,
                message,
                primaryText,
                secondaryText,
                onPrimary: acceptOverlay,
                onSecondary
              });
            } catch { /* ignore */ }
            scheduleBorderEffect();
            continue;
          }
        } catch { /* ignore */ }

        const tryShow = () => {
          try {
            this.panel.showOverlay({
              title,
              message,
              primaryText,
              secondaryText,
              onPrimary: acceptOverlay,
              onSecondary
            });
            this._emit('overlayShown', { slideId, title, message });
          } catch {
            // ignore
          }
          try {
            return !!this.panel.isOverlayOpen?.();
          } catch {
            return false;
          }
        };

        const finish = (shown) => {
          if (this._onEnterOverlayPendingSlideId === slideId) {
            this._onEnterOverlayPendingSlideId = null;
          }
          // Leave onEnter unmarked until OK so Close → reopen still shows the overlay.
          // If show failed, leave pending cleared so a later _render can retry.
          if (shown) {
            scheduleBorderEffect();
          }
        };

        // Immediate attempt, then double-rAF retry for Chrome first-paint / layout
        // races (panel body height / early-shell adoption).
        if (tryShow()) {
          finish(true);
          continue;
        }
        try {
          requestAnimationFrame(() => {
            if (slideId && this.progress.onEnterDoneSlideIds.includes(String(slideId))) {
              this._onEnterOverlayPendingSlideId = null;
              return;
            }
            if (this.panel.isOverlayOpen?.()) {
              finish(true);
              return;
            }
            if (tryShow()) {
              finish(true);
              return;
            }
            requestAnimationFrame(() => {
              if (slideId && this.progress.onEnterDoneSlideIds.includes(String(slideId))) {
                this._onEnterOverlayPendingSlideId = null;
                return;
              }
              if (this.panel.isOverlayOpen?.()) {
                finish(true);
                return;
              }
              finish(tryShow());
            });
          });
        } catch {
          finish(tryShow());
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
          chrome.runtime.sendMessage({ type: MSG.OPEN_URL_FOREGROUND, url }).catch(() => {});
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

    // Non-overlay onEnter (openTab / openPopover): mark done immediately.
    // Overlay slides wait until the user accepts the modal (OK / primary).
    if (!hasOverlay) {
      this._markOnEnterDone(slideId);
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

      // Alt + T : open/close onboarding.
      //
      // Notes:
      // - Prefer `e.code === 'KeyT'` because `e.key` varies by layout.
      // - Support AltGr layouts where the browser may report Ctrl+Alt, and/or AltGraph state.
      const isAltOrAltGraph =
        !!e &&
        (
          e.altKey === true ||
          (typeof e.getModifierState === 'function' && e.getModifierState('AltGraph') === true)
        );

      const isTKey =
        !!e &&
        (
          e.code === 'KeyT' ||
          e.key === 't' ||
          e.key === 'T'
        );

      const isAltT = isAltOrAltGraph && isTKey;

      if (!isAltT) return;

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

  /**
   * True while the panel's modal overlay is up (welcome / slide intro).
   * Checklist tasks must not be checked off until the user accepts it.
   * @returns {boolean}
   */
  _isOverlayBlockingTasks() {
    try {
      return !!this.panel?.isOverlayOpen?.();
    } catch {
      return false;
    }
  }

  _onActionEvent(ev) {
    if (!this.active || this.progress.completed) return;

    const detail = ev?.detail || {};
    const action = typeof detail.action === 'string' ? detail.action : '';
    if (!action) return;
    this._lastAction = action;

    // Keep enabled cache in sync for toggle actions (before task matching / UI hide).
    if (action === 'toggleExtension' && typeof detail.enabled === 'boolean') {
      this._enabledCache = detail.enabled === true;
      this._enabledCacheTs = Date.now();
      this._setAltSlashListenerEnabled(detail.enabled);
    }

    const slide = this._getCurrentSlide();
    if (!slide) {
      if (action === 'toggleExtension' && detail.enabled === false) {
        this.hideToggleOffArrow();
        this.panel.hide();
        this.practicePanel.hide();
      }
      if (action === 'toggleExtension' && detail.enabled === true) {
        this.hideReEnableTip();
        this._render({ reason: 'toggleOn' });
      }
      return;
    }

    // Do not check off tasks while the welcome / intro overlay is still open.
    if (this._isOverlayBlockingTasks()) {
      // Still handle toggleExtension UI (hide panel when KP turns off) without completing tasks.
      if (action === 'toggleExtension' && detail.enabled === false) {
        this.hideToggleOffArrow();
        this.panel.hide();
        this.practicePanel.hide();
      }
      if (action === 'toggleExtension' && detail.enabled === true) {
        this.hideReEnableTip();
        this._render({ reason: 'toggleOn' });
      }
      return;
    }

    const completedBefore = new Set(this.progress.completedTaskIds);
    const nextBefore = this._nextIncompleteTask(slide, completedBefore);
    const offTaskWasOpen = this._isToggleExtensionOffTask(nextBefore);

    let changed = false;
    const completed = new Set(this.progress.completedTaskIds);

    // Coming back from disabled: complete pending "turn off" only if it is the next step.
    if (action === 'toggleExtension' && detail.enabled === true) {
      const next = this._nextIncompleteTask(slide, completed);
      if (this._isToggleExtensionOffTask(next)) {
        completed.add(next.id);
        changed = true;
      }
    }

    // Strict order: only the next incomplete task may be checked off.
    if (this._tryCompleteNextMatchingTask(slide, completed, { type: 'action', action, detail })) {
      changed = true;
    }

    if (changed) {
      this.progress.completedTaskIds = Array.from(completed);
      this._persist(); // best-effort
    }

    // Turned off: hide walkthrough + turn-off arrow, keep active, optional tip on the strip.
    if (action === 'toggleExtension' && detail.enabled === false) {
      this.hideToggleOffArrow();
      this.panel.hide();
      this.practicePanel.hide();
      if (offTaskWasOpen) {
        this.showReEnableTip();
      }
      return;
    }

    // Turned back on: drop tip and restore walkthrough (active was preserved).
    if (action === 'toggleExtension' && detail.enabled === true) {
      this.hideReEnableTip();
      this._render({ reason: 'toggleOn' });
      const slideComplete = this._isSlideComplete(slide, new Set(this.progress.completedTaskIds));
      if (slideComplete) {
        this._handleSlideCompleted(slide, {
          cause: action,
          completedTaskIds: Array.from(this.progress.completedTaskIds)
        });
        this._advanceSlide({ cause: action });
      }
      return;
    }

    if (changed) {
      this._render({ reason: 'taskUpdate' });
      const slideComplete = this._isSlideComplete(slide, completed);
      if (slideComplete) {
        this._handleSlideCompleted(slide, { cause: action, completedTaskIds: Array.from(completed) });
        this._advanceSlide({ cause: action });
      }
    }
  }

  showReEnableTip() {
    try {
      // Turn-off arrow is only for the ON step; never stack it with the re-enable tip.
      this.hideToggleOffArrow();
      const strip = document.querySelector('.kp-control-strip, [data-kp-control-strip="true"]');
      const anchor = strip?.shadowRoot?.querySelector?.('[data-kp-control-strip-status="true"]') || strip;
      this.panel?.showReEnableTip?.({
        anchorEl: anchor,
        message: 'Click it again to turn KeyPilot back on.'
      });
    } catch { /* ignore */ }
  }

  hideReEnableTip() {
    try { this.panel?.hideReEnableTip?.(); } catch { /* ignore */ }
  }

  showToggleOffArrow() {
    try {
      // Prefer the ON/OFF segment so the arrow sits just past that control, not the whole strip.
      const strip = document.querySelector('.kp-control-strip, [data-kp-control-strip="true"]');
      const anchor = strip?.shadowRoot?.querySelector?.('[data-kp-control-strip-status="true"]') || strip;
      this.panel?.showToggleOffArrow?.({ anchorEl: anchor });
    } catch { /* ignore */ }
  }

  hideToggleOffArrow() {
    try { this.panel?.hideToggleOffArrow?.(); } catch { /* ignore */ }
  }

  /**
   * Keyboard Reference hover step: keep the window open and expanded, including
   * after the walkthrough is closed and reopened on this task.
   */
  _syncKeyboardReferenceForKeyInfoStep() {
    try {
      if (!this.active || this.progress.completed || !this._isKeyPilotEnabled()) return;
      const slide = this._getCurrentSlide();
      if (!slide) return;
      const completed = new Set(
        Array.isArray(this.progress.completedTaskIds)
          ? this.progress.completedTaskIds.map(String)
          : []
      );
      const nextTask = this._nextIncompleteTask(slide, completed);
      if (nextTask && String(nextTask.id) === 'keyboard_key_info') {
        this.panel?.ensureKeyboardReferenceOpenAndExpanded?.();
      }
    } catch { /* ignore */ }
  }

  /**
   * Arrow only while the next incomplete task is "click strip to turn off".
   * Hidden on click (task complete / KP off), step change, or panel hide.
   */
  _syncToggleOffArrow() {
    try {
      if (!this.active || this.progress.completed || !this._isKeyPilotEnabled()) {
        this.hideToggleOffArrow();
        return;
      }
      const slide = this._getCurrentSlide();
      if (!slide) {
        this.hideToggleOffArrow();
        return;
      }
      const completed = new Set(
        Array.isArray(this.progress.completedTaskIds)
          ? this.progress.completedTaskIds.map(String)
          : []
      );
      const nextTask = this._nextIncompleteTask(slide, completed);
      if (nextTask && String(nextTask.id) === 'toggle_extension_off') {
        this.showToggleOffArrow();
      } else {
        this.hideToggleOffArrow();
      }
    } catch {
      try { this.hideToggleOffArrow(); } catch { /* ignore */ }
    }
  }

  _isSlideComplete(slide, completedTaskIdsSet) {
    return isSlideComplete(slide, completedTaskIdsSet);
  }

  /**
   * First incomplete task in slide order (the only step detection may check off).
   * @param {{tasks?: Array<{id?: string}>}|null|undefined} slide
   * @param {Set<string>|string[]|null|undefined} completedSet
   * @returns {{id: string, when?: Object, label?: string}|null}
   */
  _nextIncompleteTask(slide, completedSet) {
    const set = completedSet instanceof Set
      ? completedSet
      : new Set(Array.isArray(completedSet) ? completedSet.map(String) : []);
    for (const task of slide?.tasks || []) {
      if (!task?.id) continue;
      if (!set.has(String(task.id))) return task;
    }
    return null;
  }

  /**
   * @param {{when?: Object}|null|undefined} task
   * @returns {boolean}
   */
  _isToggleExtensionOffTask(task) {
    if (!task?.id) return false;
    const when = task.when || {};
    return (
      String(when.type || '') === 'action' &&
      String(when.action || '') === 'toggleExtension' &&
      String(when.change || '') === 'off'
    );
  }

  /**
   * Complete at most the next incomplete task when it matches ctx.
   * Later tasks are ignored even if the same action would match them.
   * @param {{tasks?: Array}|null|undefined} slide
   * @param {Set<string>} completed
   * @param {Object} ctx
   * @returns {boolean}
   */
  _tryCompleteNextMatchingTask(slide, completed, ctx) {
    const next = this._nextIncompleteTask(slide, completed);
    if (!next?.id) return false;
    if (!this._taskMatches(next, ctx)) return false;
    completed.add(String(next.id));
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
    if (this._isTransitioning) return;

    const idx = this._currentSlideIndex();
    const next = this.model.slides[idx + 1];

    if (!next) {
      // Completed all slides.
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

      // Optional polarity for toggles: change="off" | "on"
      const change = String(when.change || '').trim();
      if (change === 'off') {
        if (ctx.detail?.enabled !== false) return false;
      } else if (change === 'on') {
        if (ctx.detail?.enabled !== true) return false;
      }

      const target = String(when.target || '').trim();
      if (!target) return true;

      if (target === 'link') {
        // Link category OR a successful F-click on the hovered focus-outline target
        // (buttons/JS widgets that look clickable but don't navigate).
        return !!(ctx.detail?.isLink || ctx.detail?.hadFocusOutline);
      }
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

  /**
   * Labels that depend on whether KeyPilot is currently ON or OFF.
   * @param {{id?: string, label?: string}} task
   * @returns {string}
   */
  _resolveTaskLabel(task) {
    const base = String(task?.label || task?.id || '');
    const id = String(task?.id || '');
    const enabled = this._isKeyPilotEnabled();

    if (id === 'toggle_extension_off') {
      if (!enabled) {
        // Panel is usually hidden while off; tip bubble carries the "click again" copy.
        return 'KeyPilot is already off (control strip shows `OFF`). Click the strip to turn it back on — a tip points at the control if you need it.';
      }
      return base || 'There is a control strip above that says `ON`. Click it to turn KeyPilot completely off.';
    }
    return base;
  }

  /**
   * If the "turn off" step is still open and KeyPilot is already disabled, complete it.
   * @returns {boolean} whether progress changed
   */
  _autoCompleteToggleOffIfAlreadyDisabled() {
    if (!this.active || this.progress.completed) return false;
    if (this._isKeyPilotEnabled()) return false;
    if (this._isOverlayBlockingTasks()) return false;

    const slide = this._getCurrentSlide();
    if (!slide) return false;

    const completed = new Set(this.progress.completedTaskIds);
    const next = this._nextIncompleteTask(slide, completed);
    if (!this._isToggleExtensionOffTask(next)) return false;

    completed.add(String(next.id));
    this.progress.completedTaskIds = Array.from(completed);
    this._persist();
    return true;
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

          // Block mode-based task completion until the intro overlay is accepted.
          if (this._isOverlayBlockingTasks()) return;

          let changed = false;
          const completed = new Set(this.progress.completedTaskIds);

          if (this._tryCompleteNextMatchingTask(slide, completed, {
            type: 'mode',
            prevMode,
            nextMode
          })) {
            changed = true;
          }

          if (!changed) return;
          this.progress.completedTaskIds = Array.from(completed);
          this._persist(); // best-effort
          this._render({ reason: 'modeTaskUpdate' });

          const slideComplete = this._isSlideComplete(slide, completed);
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


