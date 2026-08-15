/**
 * Smart element activation with semantic handling
 */
export class ActivationHandler {
  constructor(elementDetector) {
    this.detector = elementDetector;
  }

  /**
   * If the given element is inside a <summary>, return that <summary>.
   * Clicking a child inside <summary> does NOT trigger <details> toggling because
   * the activation behavior is on the <summary> element itself (not ancestors).
   * @param {any} el
   * @returns {HTMLElement|null}
   */
  resolveSummaryActivator(el) {
    try {
      if (!el || el.nodeType !== 1) return null;
      const element = /** @type {HTMLElement} */ (el);
      if (element.tagName === 'SUMMARY') return element;
      if (typeof element.closest === 'function') {
        const summary = element.closest('summary');
        if (summary && summary.tagName === 'SUMMARY') return /** @type {HTMLElement} */ (summary);
      }
      if (element.tagName === 'DETAILS') {
        const summary = element.querySelector(':scope > summary');
        if (summary && summary.tagName === 'SUMMARY') return /** @type {HTMLElement} */ (summary);
      }
    } catch { /* ignore */ }
    return null;
  }

  /**
   * Native <select> dropdowns ignore untrusted MouseEvents. Click Element must
   * use showPicker() (or HTMLElement.click()) during the F-key user gesture.
   * @param {any} el
   * @returns {HTMLSelectElement|null}
   */
  resolveSelectActivator(el) {
    try {
      if (!el || el.nodeType !== 1) return null;
      const element = /** @type {HTMLElement} */ (el);
      if (element.tagName === 'SELECT') return /** @type {HTMLSelectElement} */ (element);
      if (typeof element.closest === 'function') {
        const sel = element.closest('select');
        if (sel && sel.tagName === 'SELECT') return /** @type {HTMLSelectElement} */ (sel);
      }
    } catch { /* ignore */ }
    return null;
  }

  /**
   * @param {HTMLSelectElement} selectEl
   * @returns {boolean}
   */
  handleSelect(selectEl) {
    if (!selectEl || selectEl.disabled) return false;
    try {
      selectEl.focus({ preventScroll: true });
    } catch {
      try { selectEl.focus(); } catch { /* ignore */ }
    }
    try {
      if (typeof selectEl.showPicker === 'function') {
        selectEl.showPicker();
        return true;
      }
    } catch { /* ignore — fall through to click() */ }
    try { selectEl.click(); } catch { /* ignore */ }
    return true;
  }

  /**
   * Dispatch a "realistic" click sequence (pointer + mouse) with coordinates.
   * Many webapps (e.g. Internet Archive BookReader) rely on clientX/clientY to
   * decide behavior (page-turn zones), and `HTMLElement.click()` does not carry
   * meaningful coordinates.
   */
  dispatchClickSequence(target, clientX, clientY) {
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

    // Pointer events (preferred when supported)
    const hasPointer = typeof window.PointerEvent === 'function';
    if (hasPointer) {
      const pCommon = {
        ...common,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true
      };
      try { target.dispatchEvent(new PointerEvent('pointerover', pCommon)); } catch { }
      try { target.dispatchEvent(new PointerEvent('pointerenter', pCommon)); } catch { }
      try { target.dispatchEvent(new PointerEvent('pointerdown', pCommon)); } catch { }
    } else {
      // Some sites attach handlers to pointer* names; approximate with MouseEvent if needed.
      try { target.dispatchEvent(new MouseEvent('pointerover', common)); } catch { }
      try { target.dispatchEvent(new MouseEvent('pointerenter', common)); } catch { }
      try { target.dispatchEvent(new MouseEvent('pointerdown', common)); } catch { }
    }

    // Mouse events
    try { target.dispatchEvent(new MouseEvent('mouseover', common)); } catch { }
    try { target.dispatchEvent(new MouseEvent('mouseenter', common)); } catch { }
    try { target.dispatchEvent(new MouseEvent('mousemove', common)); } catch { }
    try { target.dispatchEvent(new MouseEvent('mousedown', common)); } catch { }

    // Release (buttons=0)
    const commonUp = { ...common, buttons: 0 };
    if (hasPointer) {
      const pUp = { ...commonUp, pointerId: 1, pointerType: 'mouse', isPrimary: true };
      try { target.dispatchEvent(new PointerEvent('pointerup', pUp)); } catch { }
    } else {
      try { target.dispatchEvent(new MouseEvent('pointerup', commonUp)); } catch { }
    }
    try { target.dispatchEvent(new MouseEvent('mouseup', commonUp)); } catch { }
    try { target.dispatchEvent(new MouseEvent('click', commonUp)); } catch { }
  }

  smartClick(el, clientX, clientY, openInNewTab = false) {
    if (!el) return false;

    // Scrubbers must not be promoted to a surrounding card/link activator.
    // (Suno/Rumble progress bars sit inside large pointer/link-ish chrome.)
    try {
      const scrub = this.detector.resolveScrubber?.(el, clientX, clientY);
      if (scrub?.control) {
        if (scrub.kind === 'range' || this.detector.isNativeType(scrub.control, 'range')) {
          return this.handleRange(scrub.control, clientX, clientY, scrub.track);
        }
        if (scrub.kind === 'role-slider') {
          return this.handleRoleSlider(scrub.control, clientX, clientY, scrub.track);
        }
        return this.handleScrubberTrack(scrub.track || scrub.control, clientX, clientY);
      }
    } catch { /* ignore */ }

    // First, try to find a more specific clickable parent (links, buttons)
    // Prioritize links for video/audio elements (common on video websites)
    let activator = el;

    // Special case: <details>/<summary> accordions.
    // Ensure our fallback .click() targets the <summary>, otherwise the accordion won't toggle.
    const summaryActivator = this.resolveSummaryActivator(el);
    if (summaryActivator) {
      activator = summaryActivator;
    }

    if (el.closest) {
      let specificClickable;

      // For video/audio elements, prioritize finding parent links
      if (el.tagName === 'VIDEO' || el.tagName === 'AUDIO') {
        specificClickable = el.closest('a[href]');
        if (specificClickable) {
          console.log('[KeyPilot] Found parent link for video/audio element:', specificClickable.href);
        }
      }

      // If no specific handling above, look for any clickable parent
      if (!specificClickable) {
        // Keep <summary> as activator if we already resolved it above.
        if (!summaryActivator) {
          specificClickable = el.closest('a[href], button, [role="button"], [onclick], [tabindex]');
        }
      }

      if (specificClickable) {
        activator = specificClickable;
      }
    }

    // Special handling for links
    if (activator.tagName === 'A' && activator.href) {
      if (openInNewTab) {
        console.log('[KeyPilot] Activating link in new tab:', activator.href);
        // Store original target and temporarily change it to open in new tab
        const originalTarget = activator.target;
        activator.target = '_blank';

        try {
          // Try programmatic click first
          activator.click();
          return true;
        } catch (error) {
          console.log('[KeyPilot] Programmatic click failed, using window.open:', error);
          // Fallback to direct window.open
          window.open(activator.href, '_blank');
          return true;
        } finally {
          // Restore original target
          if (originalTarget !== undefined) {
            activator.target = originalTarget;
          } else {
            activator.removeAttribute('target');
          }
        }
      } else {
        console.log('[KeyPilot] Activating link in same window:', activator.href);

        // Store original target and temporarily change it
        const originalTarget = activator.target;
        activator.target = '_self';

        try {
          // Try programmatic click first
          activator.click();
          return true;
        } catch (error) {
          console.log('[KeyPilot] Programmatic click failed, using navigation:', error);
          // Fallback to direct navigation
          window.location.href = activator.href;
          return true;
        } finally {
          // Restore original target
          if (originalTarget !== undefined) {
            activator.target = originalTarget;
          } else {
            activator.removeAttribute('target');
          }
        }
      }
    }

    // For non-links, prefer a coordinate-carrying click sequence at the actual point under cursor.
    // (IA BookReader uses click zones; a coordinate-less `.click()` won't page-turn.)
    let pointTarget = null;
    try {
      if (Number.isFinite(clientX) && Number.isFinite(clientY) && this.detector?.deepElementFromPoint) {
        pointTarget = this.detector.deepElementFromPoint(clientX, clientY);
      }
    } catch { /* ignore */ }

    // If the actual point is inside a <summary>, ensure the activator is the <summary>.
    const pointSummary = this.resolveSummaryActivator(pointTarget);
    if (pointSummary) activator = pointSummary;

    // <details>/<summary>: the browser's open/close toggle is summary *activation behavior*.
    // Synthetic MouseEvent/PointerEvent clicks (isTrusted=false) do NOT run that behavior —
    // only a real user click or HTMLElement.click() does. Hitting a child (label, count,
    // padding) used to dispatch only synthetic events, so F appeared to work only on a few
    // hit targets depending on what was under the pointer.
    if (activator && activator.tagName === 'SUMMARY') {
      try {
        activator.click();
      } catch { /* ignore */ }
      return true;
    }

    const primary = pointTarget || el || activator;
    this.dispatchClickSequence(primary, clientX, clientY);
    // If `primary` is already inside the clickable activator (e.g. a <span> inside a <button>),
    // the event will bubble to the activator. Dispatching again on the activator would double-click.
    // Light-DOM `contains()` is false across a shadow boundary, so a slotted-label host
    // (point target) plus its inner <button> (hover activator) used to fire two sequences
    // and toggle dropdowns closed. Treat either composed direction as one control.
    try {
      const primaryNode = /** @type {any} */ (primary);
      const activatorEl = /** @type {any} */ (activator);
      const sameControl = !!(
        activatorEl &&
        primaryNode &&
        this.detector &&
        typeof this.detector.composedContains === 'function' &&
        (this.detector.composedContains(activatorEl, primaryNode) ||
          this.detector.composedContains(primaryNode, activatorEl))
      );
      if (activator && activator !== primary && !sameControl) {
        this.dispatchClickSequence(activator, clientX, clientY);
      }
      // No extra `activator.click()` fallback here; it causes double activation for normal controls
      // because `dispatchClickSequence()` already emits a click. (Summary handled above.)
    } catch { /* ignore */ }

    return true;
  }



  handleSmartActivate(target, x, y, openInNewTab = false) {
    if (!target) return false;

    // Handle label elements
    target = this.resolveLabel(target);

    const selectEl = this.resolveSelectActivator(target);
    if (selectEl) {
      return this.handleSelect(selectEl);
    }

    // IMPORTANT: Check if video/audio is wrapped in a link first
    // This handles video preview thumbnails on video websites where clicking should navigate
    if ((target.tagName === 'VIDEO' || target.tagName === 'AUDIO') && target.closest) {
      const parentLink = target.closest('a[href]');
      if (parentLink) {
        // Let the link be handled by smartClick instead of controlling media playback
        console.log('[KeyPilot] Video/audio wrapped in link, deferring to link activation');
        return false;
      }
    }

    // Media scrubbers (thumb-style ranges, custom div tracks, role=slider).
    // Resolve before generic radio/checkbox/text so track fills map to the real control.
    try {
      const scrub = this.detector.resolveScrubber?.(target, x, y);
      if (scrub?.control) {
        if (scrub.kind === 'range' || this.detector.isNativeType(scrub.control, 'range')) {
          return this.handleRange(scrub.control, x, y, scrub.track);
        }
        if (scrub.kind === 'role-slider') {
          return this.handleRoleSlider(scrub.control, x, y, scrub.track);
        }
        if (scrub.kind === 'track') {
          return this.handleScrubberTrack(scrub.track || scrub.control, x, y);
        }
      }
    } catch { /* ignore */ }

    // Handle different input types semantically
    if (this.detector.isNativeType(target, 'radio')) {
      return this.handleRadio(target);
    }

    if (this.detector.isNativeType(target, 'checkbox')) {
      return this.handleCheckbox(target);
    }

    if (this.detector.isNativeType(target, 'range')) {
      return this.handleRange(target, x, y);
    }

    // Handle role="slider" elements
    const role = (target.getAttribute && (target.getAttribute('role') || '').trim().toLowerCase()) || '';
    if (role === 'slider') {
      return this.handleRoleSlider(target, x, y);
    }

    if (this.detector.isTextLike(target)) {
      return this.handleTextField(target);
    }

    if (this.detector.isContentEditable(target)) {
      return this.handleContentEditable(target);
    }

    // Handle video and audio elements (only if not wrapped in a link)
    if (target.tagName === 'VIDEO' || target.tagName === 'AUDIO') {
      return this.handleMediaElement(target);
    }

    return false;
  }

  resolveLabel(target) {
    // If the target IS a label or is nested INSIDE a label, resolve to the label's control.
    // This is critical for settings UIs where the visible click target is a <div> inside <label>.
    let label = null;
    try {
      if (target && target.tagName === 'LABEL') label = target;
      else if (target && typeof target.closest === 'function') label = target.closest('label');
    } catch { /* ignore */ }

    if (label && label.tagName === 'LABEL') {
      const forId = label.getAttribute('for');
      if (forId) {
        const labelCtl = (label.getRootNode() || document).getElementById(forId);
        if (labelCtl) return labelCtl;
      } else {
        const ctl = label.querySelector('input, textarea, select');
        if (ctl) return ctl;
      }
    }
    return target;
  }

  handleRadio(target) {
    if (!target.checked) {
      target.checked = true;
      this.dispatchInputChange(target);
    }
    return true;
  }

  handleCheckbox(target) {
    target.checked = !target.checked;
    this.dispatchInputChange(target);
    return true;
  }

  /**
   * Geometry used to map clientX → slider value.
   * Thumb-sized range inputs are only ~12px wide and positioned with left:%;
   * value math must use the full track host rect instead of the thumb box.
   */
  getSliderMetricsRect(control, trackHint = null) {
    let track = trackHint;
    try {
      if (!track && this.detector.getScrubTrackElement) {
        track = this.detector.getScrubTrackElement(control);
      }
    } catch { /* ignore */ }

    let controlRect = null;
    let trackRect = null;
    try { controlRect = control.getBoundingClientRect(); } catch { controlRect = null; }
    try { trackRect = track && track !== control ? track.getBoundingClientRect() : null; } catch { trackRect = null; }

    // Prefer a substantially wider track when the control looks like a thumb-only range.
    if (trackRect && trackRect.width > 0 && controlRect && controlRect.width > 0) {
      if (trackRect.width >= controlRect.width * 2.5) return trackRect;
    }
    if (trackRect && trackRect.width > 40 && (!controlRect || controlRect.width < 24)) {
      return trackRect;
    }
    if (controlRect && controlRect.width > 0) return controlRect;
    return trackRect;
  }

  /**
   * Closest slider / range host for a hit target (time scrubber, volume, etc.).
   * Used to scope synthetic drag-end events to one control.
   * @param {EventTarget|null|undefined} originTarget
   * @returns {Element|null}
   */
  resolveSliderRoot(originTarget) {
    try {
      const el = /** @type {Element|null} */ (
        originTarget && /** @type {any} */ (originTarget).nodeType === 1
          ? originTarget
          : null
      );
      if (!el) return null;
      if (typeof el.closest === 'function') {
        const root = el.closest(
          '[role="slider"], input[type="range"], [data-media-time-slider], .vds-slider, .vds-time-slider'
        );
        if (root) return root;
      }
      return el;
    } catch {
      return null;
    }
  }

  /**
   * True when this control is a volume / non-timeline slider.
   * Volume must not trigger media.currentTime seeks or full-page drag teardown.
   * @param {Element|null|undefined} el
   * @returns {boolean}
   */
  isVolumeOrNonSeekSlider(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      const label = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('aria-valuetext') || ''}`.toLowerCase();
      if (/\b(volume|mute|sound|loudness|gain)\b/.test(label)) return true;
      // data-media-volume-slider / class tokens used by Vidstack and common players
      try {
        if (el.hasAttribute('data-media-volume-slider')) return true;
      } catch { /* ignore */ }
      const cls = String(/** @type {any} */ (el).className || '').toLowerCase();
      if (/\b(volume|mute)[-_]?slider\b|\bvolume-?control\b|\bvds-volume\b/.test(cls)) return true;
      // Nested under a mute/volume control chrome
      if (typeof el.closest === 'function') {
        const host = el.closest(
          '[aria-label*="volume" i], [aria-label*="mute" i], [data-media-volume-slider], .vds-volume-slider'
        );
        if (host) return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Force-end a synthetic pointer drag on ONE slider tree only.
   *
   * Media scrubbers (Vidstack/vds-slider, custom React players like Suno) call
   * `setPointerCapture` on pointerdown and keep seeking until the captured
   * pointerup. Synthetic events cannot capture a real pointer id
   * (`NotFoundError: No active pointer…`), so the initial element-level up in
   * `dispatchClickSequence` often leaves `data-dragging` / isSeeking true and
   * the knob sticks to the real mouse.
   *
   * We re-fire pointerup/mouseup/pointercancel on the activated slider subtree
   * after React commits drag-start. We intentionally do NOT dispatch on
   * document/window — that can end (or drive) other sliders in the same player
   * (e.g. volume drag affecting the time scrubber).
   *
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} [pointerId=1] Must match the id used in dispatchClickSequence.
   * @param {EventTarget|null} [originTarget] Element that received the down.
   */
  endSyntheticPointerDrag(clientX, clientY, pointerId = 1, originTarget = null) {
    const x = Number.isFinite(clientX) ? clientX : 0;
    const y = Number.isFinite(clientY) ? clientY : 0;
    const id = Number.isFinite(pointerId) ? pointerId : 1;
    const sliderRoot = this.resolveSliderRoot(originTarget);

    const upCommon = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 0
    };
    const pUp = {
      ...upCommon,
      pointerId: id,
      pointerType: 'mouse',
      isPrimary: true
    };

    const hasPointer = typeof window.PointerEvent === 'function';
    /** @type {Set<EventTarget>} */
    const targets = new Set();

    // Hit target + ancestors up through the slider root (only this control).
    try {
      let n = originTarget && /** @type {any} */ (originTarget).nodeType === 1
        ? /** @type {Element} */ (originTarget)
        : null;
      let depth = 0;
      while (n && n.nodeType === 1 && depth < 12) {
        targets.add(n);
        if (sliderRoot && n === sliderRoot) break;
        // Stop before leaving the slider into shared player chrome.
        if (!sliderRoot && (n.parentElement === document.body || n === document.documentElement)) break;
        n = n.parentElement;
        depth++;
      }
    } catch { /* ignore */ }

    if (sliderRoot) targets.add(sliderRoot);
    if (originTarget) targets.add(originTarget);

    for (const t of targets) {
      if (!t || typeof t.dispatchEvent !== 'function') continue;
      if (hasPointer) {
        try { t.dispatchEvent(new PointerEvent('pointerup', pUp)); } catch { /* ignore */ }
        try { t.dispatchEvent(new PointerEvent('pointercancel', pUp)); } catch { /* ignore */ }
      } else {
        try { t.dispatchEvent(new MouseEvent('pointerup', upCommon)); } catch { /* ignore */ }
        try { t.dispatchEvent(new MouseEvent('pointercancel', upCommon)); } catch { /* ignore */ }
      }
      try { t.dispatchEvent(new MouseEvent('mouseup', upCommon)); } catch { /* ignore */ }
    }

    // Best-effort release only inside this slider tree.
    try {
      for (const t of targets) {
        if (!t || typeof /** @type {any} */ (t).hasPointerCapture !== 'function') continue;
        try {
          if (/** @type {any} */ (t).hasPointerCapture(id)) {
            /** @type {any} */ (t).releasePointerCapture(id);
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  /**
   * Pointer/mouse down+up at coordinates.
   * Custom media scrubbers listen for this (not for programmatic range.value).
   * mouseup is required on some players to commit the seek.
   */
  dispatchPointerSeek(target, clientX, clientY) {
    if (!target) return;
    const clientYSafe = Number.isFinite(clientY) ? clientY : (() => {
      try {
        const r = target.getBoundingClientRect();
        return r.top + r.height / 2;
      } catch {
        return 0;
      }
    })();
    // Full pointer+mouse sequence including mouseup (commit) at the seek point.
    this.dispatchClickSequence(target, clientX, clientYSafe);

    // Force drag-end on THIS slider AFTER the player's drag-start state commits.
    //
    // Why deferred:
    // - Synthetic pointerdown cannot setPointerCapture (no real OS pointer id).
    // - Players often arm `data-dragging` via React state that flushes after the
    //   event handler returns; a synchronous up races that commit and loses.
    // Microtask + macrotask cover React batching and setTimeout-armed handlers.
    // Events stay scoped to the slider tree (not document) so volume/time stay independent.
    const endDrag = () => {
      try {
        this.endSyntheticPointerDrag(clientX, clientYSafe, 1, target);
      } catch { /* ignore */ }
    };
    try {
      queueMicrotask(endDrag);
    } catch {
      endDrag();
    }
    try {
      setTimeout(endDrag, 0);
    } catch { /* ignore */ }
  }

  /**
   * True when the range input is a positioned thumb and a separate wider track owns seek geometry
   * (common custom players: small input with left:%, full-width visual track sibling).
   */
  isThumbStyleRange(control, track) {
    if (!control || !track || track === control) return false;
    try {
      const cr = control.getBoundingClientRect();
      const tr = track.getBoundingClientRect();
      if (!cr || !tr || cr.width <= 0 || tr.width <= 0) return false;
      return tr.width >= cr.width * 2.5;
    } catch {
      return false;
    }
  }

  /**
   * Containment root for "is under-point inside this scrubber?" checks.
   * Expands one level to a short track host (presentation + thumb wrapper) without
   * expanding into a full playbar that would include play/volume buttons.
   */
  getSeekContainmentRoot(track) {
    if (!track || track.nodeType !== 1) return track;
    try {
      const parent = track.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) {
        return track;
      }
      const pr = parent.getBoundingClientRect();
      // Track hosts are short horizontal bars, not whole player chrome.
      if (pr.height > 0 && pr.height <= 48 && pr.width >= 64) {
        return parent;
      }
    } catch { /* ignore */ }
    return track;
  }

  /**
   * Prefer the real hit-target under the cursor (progress fill / remaining bar).
   * Synthetic events on the outer presentation wrapper alone often move the knob
   * UI without committing media seek; events on the under-point node do both.
   */
  resolveSeekPointTarget(track, clientX, clientY) {
    if (!track) return track;
    try {
      if (Number.isFinite(clientX) && Number.isFinite(clientY) && this.detector?.deepElementFromPoint) {
        const under = this.detector.deepElementFromPoint(clientX, clientY);
        if (!under) return track;
        const root = this.getSeekContainmentRoot(track) || track;
        if (under === track || under === root ||
            (typeof root.contains === 'function' && root.contains(under)) ||
            (typeof track.contains === 'function' && track.contains(under))) {
          return under;
        }
      }
    } catch { /* ignore */ }
    return track;
  }

  /**
   * Find <audio>/<video> associated with a scrubber (same player shell, or duration ≈ range max).
   * @param {Element} fromEl
   * @param {HTMLInputElement|null} [rangeEl]
   * @returns {HTMLMediaElement|null}
   */
  findAssociatedMedia(fromEl, rangeEl = null) {
    try {
      let n = fromEl;
      let depth = 0;
      while (n && n.nodeType === 1 && depth < 8) {
        if (n === document.body || n === document.documentElement) break;
        if (n.tagName === 'VIDEO' || n.tagName === 'AUDIO') {
          return /** @type {HTMLMediaElement} */ (n);
        }
        try {
          const list = n.querySelectorAll?.('audio, video');
          if (list && list.length) {
            let best = null;
            for (const m of list) {
              if (Number.isFinite(m.duration) && m.duration > 1) {
                best = m;
                break;
              }
              if (!best) best = m;
            }
            if (best) return /** @type {HTMLMediaElement} */ (best);
          }
        } catch { /* ignore */ }
        try {
          const r = n.getBoundingClientRect();
          if (r.height > window.innerHeight * 0.85 && r.width > window.innerWidth * 0.85) break;
        } catch { /* ignore */ }
        n = n.parentElement;
        depth++;
      }
    } catch { /* ignore */ }

    // Match range max ≈ media duration (playback progress controls).
    try {
      const max = rangeEl ? this.asNum(rangeEl.max, NaN) : NaN;
      if (Number.isFinite(max) && max > 1) {
        const all = document.querySelectorAll('audio, video');
        for (const m of all) {
          if (Number.isFinite(m.duration) && Math.abs(m.duration - max) < 1.5) {
            return /** @type {HTMLMediaElement} */ (m);
          }
        }
      }
    } catch { /* ignore */ }

    return null;
  }

  /**
   * Soft fallback: set media.currentTime from cursor position along the track.
   * Used after pointer seek for custom players that update the knob but not media.
   * Never runs for volume / non-timeline sliders (would scrub the video when adjusting volume).
   */
  maybeSeekAssociatedMedia(trackEl, clientX, clientY, rangeEl = null) {
    try {
      if (!trackEl || !Number.isFinite(clientX)) return;
      if (this.isVolumeOrNonSeekSlider(trackEl) || this.isVolumeOrNonSeekSlider(rangeEl)) return;
      // Also ignore when the resolved slider root is clearly volume chrome.
      try {
        const root = this.resolveSliderRoot(trackEl);
        if (root && this.isVolumeOrNonSeekSlider(root)) return;
      } catch { /* ignore */ }

      const media = this.findAssociatedMedia(trackEl, rangeEl);
      if (!media || !Number.isFinite(media.duration) || media.duration <= 0) return;

      const metricsEl = this.getSeekContainmentRoot(trackEl) || trackEl;
      const rect = metricsEl.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;

      // Volume/popover sliders are short; timeline scrubbers span most of the player width.
      // Guard against mapping a narrow control's X onto media duration.
      if (rect.width < 120) return;

      const pct = this.clamp((clientX - rect.left) / rect.width, 0, 1);
      const targetTime = pct * media.duration;
      // Only nudge when clearly out of sync (avoid fighting smooth seeking UIs).
      if (Math.abs(media.currentTime - targetTime) < 0.35) return;
      media.currentTime = targetTime;
    } catch { /* ignore */ }
  }

  /**
   * Generic custom-scrubber seek: one pointer sequence on the element under the cursor.
   * Do not set range.value from our geometry, do not fire on a tiny thumb input,
   * do not double-dispatch on track + fill.
   */
  seekCustomScrubber(track, clientX, clientY, rangeEl = null) {
    if (!track) return false;
    const pointTarget = this.resolveSeekPointTarget(track, clientX, clientY);
    this.dispatchPointerSeek(pointTarget, clientX, clientY);
    // Soft media sync after pointer commit (timeline scrubbers only).
    this.maybeSeekAssociatedMedia(track, clientX, clientY, rangeEl);
    return true;
  }

  handleRange(target, clientX, clientY = null, trackHint = null) {
    let track = trackHint;
    try {
      if (!track && this.detector.getScrubTrackElement) {
        track = this.detector.getScrubTrackElement(target);
      }
    } catch { /* ignore */ }
    track = track || target;

    // Thumb-style custom scrubbers: site owns seek math via pointer at clientX/Y on the
    // visual hit target under the cursor (often a fill child of the track).
    // Do NOT:
    //  - set .value from our rect math (misses thumb-width compensation → offset knob)
    //  - fire pointer events on the tiny range input (native range misreads clientX)
    //  - double-dispatch (track wrapper + fill) — causes offset / UI-only seeks
    if (this.isThumbStyleRange(target, track)) {
      return this.seekCustomScrubber(track, clientX, clientY, target);
    }

    // Native full-width <input type="range">: map clientX onto the control and set value.
    const rect = this.getSliderMetricsRect(target, track);
    const min = this.asNum(target.min, 0);
    const max = this.asNum(target.max, 100);
    const stepAttr = target.step && target.step !== 'any' ? this.asNum(target.step, 1) : 'any';

    if (rect && rect.width > 0) {
      const pct = this.clamp((clientX - rect.left) / rect.width, 0, 1);
      let val = min + pct * (max - min);

      if (stepAttr !== 'any' && Number.isFinite(stepAttr) && stepAttr > 0) {
        const steps = Math.round((val - min) / stepAttr);
        val = min + steps * stepAttr;
      }
      val = this.clamp(val, min, max);
      const before = target.value;
      try {
        target.value = String(val);
        if (target.value !== before) this.dispatchInputChange(target);
      } catch { /* ignore */ }
    }

    // Coordinate sequence on the range itself for listeners that use clientX.
    this.dispatchPointerSeek(target, clientX, clientY);
    return true;
  }

  handleRoleSlider(target, clientX, clientY, trackHint = null) {
    // ARIA sliders: update aria-valuenow when present, then one coordinate pointer sequence.
    const rect = this.getSliderMetricsRect(target, trackHint || target);
    if (rect && rect.width > 0) {
      const min = this.asNum(target.getAttribute('aria-valuemin'), 0);
      const max = this.asNum(target.getAttribute('aria-valuemax'), 100);
      const step = this.asNum(target.getAttribute('aria-step'), 1);

      const pct = this.clamp((clientX - rect.left) / rect.width, 0, 1);
      let newValue = min + pct * (max - min);

      if (step > 0) {
        const steps = Math.round((newValue - min) / step);
        newValue = min + steps * step;
      }

      newValue = this.clamp(newValue, min, max);

      const before = target.getAttribute('aria-valuenow');
      try { target.setAttribute('aria-valuenow', String(newValue)); } catch { /* ignore */ }

      if (String(newValue) !== before) {
        this.dispatchInputChange(target);
        try {
          target.dispatchEvent(new CustomEvent('sliderchange', {
            bubbles: true,
            detail: { value: newValue, previousValue: this.asNum(before, min) }
          }));
        } catch { }
      }
    }

    const seekRoot = trackHint && trackHint !== target ? trackHint : target;
    const pointTarget = this.resolveSeekPointTarget(seekRoot, clientX, clientY);
    // Prefer the semantic slider root so drag-end stays on this control (volume vs time).
    const sequenceTarget = pointTarget || target;
    this.dispatchPointerSeek(sequenceTarget, clientX, clientY);
    // Timeline only — never map volume X onto video.currentTime.
    if (!this.isVolumeOrNonSeekSlider(target) && !this.isVolumeOrNonSeekSlider(seekRoot)) {
      this.maybeSeekAssociatedMedia(seekRoot, clientX, clientY, null);
    }
    return true;
  }

  /**
   * Custom scrub tracks with no input/role (pure div progress bars).
   * One pointer sequence on the under-cursor hit target.
   */
  handleScrubberTrack(track, clientX, clientY) {
    if (!track) return false;
    return this.seekCustomScrubber(track, clientX, clientY, null);
  }

  handleTextField(target) {
    try {
      target.focus({ preventScroll: true });
    } catch {
      try { target.focus(); } catch { }
    }
    try {
      const v = target.value ?? '';
      target.setSelectionRange(v.length, v.length);
    } catch { }
    return true;
  }

  handleContentEditable(target) {
    try {
      target.focus({ preventScroll: true });
    } catch {
      try { target.focus(); } catch { }
    }

    // Try to position cursor at the end of content
    try {
      const selection = window.getSelection();
      const range = document.createRange();

      // If there's text content, position at the end
      if (target.childNodes.length > 0) {
        const lastNode = target.childNodes[target.childNodes.length - 1];
        if (lastNode.nodeType === Node.TEXT_NODE) {
          range.setStart(lastNode, lastNode.textContent.length);
        } else {
          range.setStartAfter(lastNode);
        }
      } else {
        // Empty contenteditable, position at the beginning
        range.setStart(target, 0);
      }

      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (error) {
      // Fallback: just focus without cursor positioning
      console.debug('Could not position cursor in contenteditable:', error);
    }

    return true;
  }

  handleMediaElement(target) {
    try {
      // Toggle play/pause for video and audio elements
      if (target.paused) {
        target.play();
      } else {
        target.pause();
      }
      return true;
    } catch (error) {
      console.debug('Could not control media element:', error);
      // Fallback to regular click behavior
      return false;
    }
  }

  dispatchInputChange(el) {
    const opts = { bubbles: true, composed: true };
    el.dispatchEvent(new Event('input', opts));
    el.dispatchEvent(new Event('change', opts));
  }

  clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  asNum(v, d) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }
}