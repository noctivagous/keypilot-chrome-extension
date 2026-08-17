/**
 * Continuous hold-to-scroll via requestAnimationFrame.
 *
 * OS key-repeat + CSS `scrollBy({ behavior: 'smooth' })` stacks competing
 * animations (jitter). The usual fix (games / Vimium style):
 *  - first keydown: optional tap step, then arm continuous motion
 *  - ignore e.repeat for scrolling
 *  - rAF applies small instant deltas while the key is down
 *  - keyup stops the loop
 */

import { SCROLL } from '../config/constants.js';

/**
 * @typedef {object} ScrollHoldApplyContext
 * @property {number} deltaPx  signed pixels for this frame
 * @property {number} sign
 * @property {number} dtSec
 * @property {any} [target]
 */

/**
 * @returns {{ speedPxPerSec: number, startDelayMs: number }}
 */
function holdCfg() {
  const speed = Number(SCROLL.HOLD_PX_PER_SEC);
  const delay = Number(SCROLL.HOLD_RAF_START_MS);
  return {
    speedPxPerSec: Number.isFinite(speed) && speed > 0 ? speed : 1400,
    startDelayMs: Number.isFinite(delay) && delay >= 0 ? delay : 120
  };
}

/**
 * Continuous scroll while a key is held.
 *
 * Usage:
 *   const hold = new ScrollHoldController({
 *     apply: ({ deltaPx, target }) => { ... scroll by deltaPx ... }
 *   });
 *   // first keydown:
 *   hold.begin({ key, sign, target });
 *   // e.repeat: hold.noteRepeat() — do not scroll again
 *   // keyup:
 *   hold.end(key);
 */
export class ScrollHoldController {
  /**
   * @param {{ apply: (ctx: ScrollHoldApplyContext) => void, speedPxPerSec?: number, startDelayMs?: number }} opts
   */
  constructor(opts) {
    this._apply = typeof opts?.apply === 'function' ? opts.apply : () => {};
    this._speedOverride = Number(opts?.speedPxPerSec);
    this._delayOverride = Number(opts?.startDelayMs);

    /** @type {string|null} */
    this.key = null;
    /** @type {number} */
    this.sign = 0;
    /** @type {any} */
    this.target = null;
    /** @type {number} */
    this._raf = 0;
    /** @type {number} */
    this._lastTs = 0;
    /** @type {ReturnType<typeof setTimeout>|0} */
    this._armTimer = 0;
  }

  /** @returns {boolean} */
  get active() {
    return !!this.key;
  }

  /**
   * @param {string|null|undefined} key
   * @param {number} [sign]
   * @returns {boolean}
   */
  isHolding(key, sign) {
    if (!this.key) return false;
    if (key != null && this.key !== key) return false;
    if (sign != null && this.sign !== (sign < 0 ? -1 : 1)) return false;
    return true;
  }

  /**
   * Start (or redirect) a hold. Does not apply the tap step — caller does that.
   * Continuous rAF begins after a short delay so a quick tap stays a single step.
   *
   * @param {{ key?: string|null, sign: number, target?: any, speedPxPerSec?: number }} args
   */
  begin(args) {
    const sign = args.sign < 0 ? -1 : 1;
    const key = args.key == null ? null : String(args.key);
    const same = this.key != null && this.key === key && this.sign === sign;

    this.key = key;
    this.sign = sign;
    this.target = args.target ?? this.target;
    if (Number.isFinite(Number(args.speedPxPerSec)) && Number(args.speedPxPerSec) > 0) {
      this._speedOverride = Number(args.speedPxPerSec);
    }

    if (same && (this._raf || this._armTimer)) return;

    this._clearArmTimer();
    if (this._raf) return;

    const cfg = holdCfg();
    const delay = Number.isFinite(this._delayOverride) && this._delayOverride >= 0
      ? this._delayOverride
      : cfg.startDelayMs;

    if (delay <= 0) {
      this._startLoop();
      return;
    }

    this._armTimer = setTimeout(() => {
      this._armTimer = 0;
      if (!this.key) return;
      this._startLoop();
    }, delay);
  }

  /**
   * OS key-repeat: keep the hold alive; do not scroll here (rAF owns motion).
   * @param {string|null|undefined} key
   * @param {number} [sign]
   * @returns {boolean} true if this repeat belongs to the active hold
   */
  noteRepeat(key, sign) {
    if (!this.isHolding(key, sign)) return false;
    if (!this._raf && !this._armTimer) {
      this._startLoop();
    } else if (!this._raf && this._armTimer) {
      this._clearArmTimer();
      this._startLoop();
    }
    return true;
  }

  /**
   * @param {string|null|undefined} [key]  if set, only stop when it matches
   */
  end(key) {
    if (key != null && this.key != null && this.key !== key) return;
    this.reset();
  }

  reset() {
    this._clearArmTimer();
    if (this._raf) {
      try { cancelAnimationFrame(this._raf); } catch { /* ignore */ }
      this._raf = 0;
    }
    this._lastTs = 0;
    this.key = null;
    this.sign = 0;
    this.target = null;
  }

  _clearArmTimer() {
    if (this._armTimer) {
      try { clearTimeout(this._armTimer); } catch { /* ignore */ }
      this._armTimer = 0;
    }
  }

  _speed() {
    if (Number.isFinite(this._speedOverride) && this._speedOverride > 0) {
      return this._speedOverride;
    }
    return holdCfg().speedPxPerSec;
  }

  _startLoop() {
    if (this._raf) return;
    this._lastTs = 0;
    const tick = (ts) => {
      this._raf = 0;
      if (!this.key) return;
      const last = this._lastTs;
      this._lastTs = ts;
      this._raf = requestAnimationFrame(tick);
      if (!last) return;

      const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
      if (!dt) return;
      const deltaPx = this.sign * this._speed() * dt;
      if (!deltaPx) return;
      try {
        this._apply({
          deltaPx,
          sign: this.sign,
          dtSec: dt,
          target: this.target
        });
      } catch { /* ignore */ }
    };
    this._raf = requestAnimationFrame(tick);
  }
}

/** @deprecated Prefer ScrollHoldController */
export const ScrollHoldTracker = ScrollHoldController;
