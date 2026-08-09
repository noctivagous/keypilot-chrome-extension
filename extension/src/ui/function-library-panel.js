/**
 * Function Library panel — browse the unified Function Library (function-library.js),
 * create/edit Action Instances for customizable Functions (e.g. TYPE_CHARACTERS), and bind
 * a Function (bare or instance) to a slot on the current user keyboard layout.
 *
 * This is additive: it does not replace the existing drag-and-drop
 * `keyboard-layout-config-panel.js` palette. See KEY_ACTION_ARCHITECTURE.md → "Migration
 * mapping" for why (folding this into the existing 1.6k-line palette is a separate, larger,
 * still-open follow-up).
 *
 * Key-binding capture: clicking "Bind key…" listens for the next keydown.
 * - If it has no modifiers, it's treated as a bare-key slot ("Q").
 * - If it has modifiers, it's treated as a chord slot ("Ctrl+Alt+Q" — see utils/key-chord.js).
 * `validateFunctionSlotKey()` (function-library.js) rejects a bare key for any Function flagged
 * `worksWhileTyping` (e.g. TYPE_CHARACTERS, CLIPBOARD_*) — those Functions must use a chord so
 * they can actually fire while the text field they act on is focused. See
 * KEY_ACTION_ARCHITECTURE.md → "Text-active Functions & modifier-chord assignment".
 */

import { Z_INDEX, KP_UI_FONT, COLORS } from '../config/constants.js';
import {
  FUNCTION_CATEGORY_ORDER,
  FUNCTION_LIBRARY,
  getFunctionCategory,
  getFunctionDef,
  isFunctionInstantiable,
  listFunctionDefs,
  summarizeFunctionParameters,
  validateFunctionSlotKey
} from '../config/function-library.js';
import {
  addUserMacroStep,
  createUserAction,
  createUserMacro,
  deleteUserAction,
  deleteUserMacro,
  listUserActions,
  listUserMacros,
  moveUserMacroStep,
  removeUserMacroStep,
  setUserKeyboardLayoutSlot,
  upsertUserAction
} from '../modules/keyboard-layout-store.js';
import { buildChordSlotKey, formatChordSlotKeyLabel, isChordSlotKey } from '../utils/key-chord.js';
import { makePanelDraggable } from '../utils/panel-position.js';

const FNLIB_PANEL_STYLE_ATTR = 'data-kp-function-library-panel-style';

function ensureFunctionLibraryPanelStyles(doc) {
  if (!doc?.head) return;
  let style = doc.head.querySelector(`style[${FNLIB_PANEL_STYLE_ATTR}]`);
  if (!style) {
    style = doc.createElement('style');
    style.setAttribute(FNLIB_PANEL_STYLE_ATTR, 'true');
    doc.head.appendChild(style);
  }
  style.textContent = `
.kp-fnlib-panel {
  position: fixed;
  top: 80px;
  right: 24px;
  z-index: ${Z_INDEX.KEY_ACTION_CONFIG || 2147483047};
  width: 380px;
  max-height: min(720px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  color: rgba(248, 250, 252, 0.95);
  font-family: ${KP_UI_FONT};
  font-size: 12px;
  line-height: 1.4;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.45);
  background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 40%), linear-gradient(180deg, #3a4150 0%, #2c313e 100%);
  box-shadow: 0 1px 0 rgba(0,0,0,0.4), 0 14px 32px rgba(0,0,0,0.45);
  box-sizing: border-box;
}
.kp-fnlib-panel[hidden] { display: none !important; }
.kp-fnlib-panel__titlebar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; cursor: grab; user-select: none; border-bottom: 1px solid rgba(0,0,0,0.35); }
.kp-fnlib-panel__title { font-weight: 600; font-size: 12px; letter-spacing: 0.02em; }
.kp-fnlib-panel__close { appearance: none; border: 0; background: rgba(0,0,0,0.25); color: inherit; width: 22px; height: 22px; border-radius: 6px; cursor: pointer; font-size: 14px; line-height: 1; }
.kp-fnlib-panel__hint { padding: 6px 10px; font-size: 11px; opacity: 0.75; border-bottom: 1px solid rgba(0,0,0,0.25); }
.kp-fnlib-panel__body { overflow-y: auto; padding: 6px 10px 12px; display: flex; flex-direction: column; gap: 10px; }
.kp-fnlib-category { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.6; margin-top: 6px; }
.kp-fnlib-row { border: 1px solid rgba(0,0,0,0.35); border-radius: 8px; background: rgba(0,0,0,0.18); padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.kp-fnlib-row__head { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; }
.kp-fnlib-row__label { font-weight: 600; }
.kp-fnlib-row__badge { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 6px; border-radius: 999px; background: rgba(255,166,87,0.22); color: #ffcf9e; white-space: nowrap; }
.kp-fnlib-row__desc { opacity: 0.75; font-size: 11px; }
.kp-fnlib-row__instances { display: flex; flex-direction: column; gap: 6px; }
.kp-fnlib-instance { border: 1px solid rgba(0,0,0,0.3); border-radius: 6px; background: rgba(0,0,0,0.2); padding: 6px; display: flex; flex-direction: column; gap: 6px; }
.kp-fnlib-instance__summary { font-size: 11px; opacity: 0.85; word-break: break-word; }
.kp-fnlib-row__actions, .kp-fnlib-instance__actions { display: flex; gap: 6px; flex-wrap: wrap; }
.kp-fnlib-btn { appearance: none; border: 1px solid rgba(0,0,0,0.4); background: rgba(255,255,255,0.06); color: inherit; border-radius: 6px; padding: 4px 8px; font: inherit; font-size: 11px; cursor: pointer; }
.kp-fnlib-btn:hover { background: rgba(255,255,255,0.12); }
.kp-fnlib-btn[data-capturing="true"] { background: #ffb020; color: #221a05; border-color: #ffb020; }
.kp-fnlib-textarea { width: 100%; box-sizing: border-box; border-radius: 6px; border: 1px solid rgba(0,0,0,0.4); background: rgba(0,0,0,0.22); color: inherit; padding: 6px 8px; font: inherit; min-height: 48px; resize: vertical; }
.kp-fnlib-error { color: #ffb0b0; font-size: 11px; }
.kp-fnlib-select { appearance: none; border-radius: 6px; border: 1px solid rgba(0,0,0,0.4); background: rgba(0,0,0,0.22); color: inherit; padding: 4px 6px; font: inherit; font-size: 11px; }
.kp-fnlib-macro { border: 1px solid rgba(0,0,0,0.35); border-radius: 8px; background: rgba(0,0,0,0.18); padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.kp-fnlib-macro__head { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; }
.kp-fnlib-macro__label { font-weight: 600; }
.kp-fnlib-steps { display: flex; flex-direction: column; gap: 4px; }
.kp-fnlib-step { border: 1px solid rgba(0,0,0,0.3); border-radius: 6px; background: rgba(0,0,0,0.2); padding: 5px 6px; display: flex; align-items: center; gap: 6px; }
.kp-fnlib-step__index { opacity: 0.5; font-size: 10px; min-width: 14px; }
.kp-fnlib-step__body { flex: 1; min-width: 0; }
.kp-fnlib-step__label { font-weight: 600; font-size: 11px; }
.kp-fnlib-step__summary { opacity: 0.7; font-size: 10px; }
.kp-fnlib-step__actions { display: flex; gap: 3px; flex-shrink: 0; }
.kp-fnlib-step-btn { appearance: none; border: 1px solid rgba(0,0,0,0.4); background: rgba(255,255,255,0.06); color: inherit; border-radius: 5px; padding: 2px 5px; font: inherit; font-size: 10px; line-height: 1.3; cursor: pointer; }
.kp-fnlib-step-btn:hover { background: rgba(255,255,255,0.12); }
.kp-fnlib-add-step { display: flex; gap: 6px; align-items: center; }
.kp-fnlib-empty { opacity: 0.65; font-style: italic; font-size: 11px; }
`;
}

export class FunctionLibraryPanel {
  constructor() {
    /** @type {any} */
    this._kp = null;
    /** @type {HTMLElement|null} */
    this.root = null;
    /** @type {HTMLElement|null} */
    this._bodyEl = null;
    /** @type {{ dispose: () => void }|null} */
    this._dragApi = null;
    /** @type {UserAction[]} */
    this._userActions = [];
    /** @type {import('../modules/keyboard-layout-store.js').UserMacro[]} */
    this._userMacros = [];
    /** Live keydown capture state: which slot-bind button is listening. */
    this._captureCleanup = null;
  }

  isOpen() {
    return !!(this.root && this.root.isConnected && !this.root.hidden);
  }

  /** @param {any} kp */
  async show(kp) {
    this._kp = kp || null;
    this._ensureDom();
    await this._refresh();
    this.root.hidden = false;
  }

  hide() {
    this._stopCapture();
    if (this.root) this.root.hidden = true;
  }

  dispose() {
    this._stopCapture();
    try { this._dragApi?.dispose?.(); } catch { /* ignore */ }
    this._dragApi = null;
    try { this.root?.remove(); } catch { /* ignore */ }
    this.root = null;
  }

  _ensureDom() {
    if (this.root) return;
    const doc = document;
    ensureFunctionLibraryPanelStyles(doc);
    this.root = doc.createElement('div');
    this.root.className = 'kp-fnlib-panel';
    this.root.setAttribute('role', 'dialog');
    this.root.innerHTML = `
      <div class="kp-fnlib-panel__titlebar" data-kp-fnlib-drag="true">
        <div class="kp-fnlib-panel__title">Function Library</div>
        <button type="button" class="kp-fnlib-panel__close" aria-label="Close">×</button>
      </div>
      <div class="kp-fnlib-panel__hint">Browse Functions. Customizable ones (e.g. Type Characters) can have several independently-configured instances, each bound to its own key.</div>
      <div class="kp-fnlib-panel__body"></div>
    `;
    doc.body.appendChild(this.root);
    this._bodyEl = this.root.querySelector('.kp-fnlib-panel__body');

    this.root.querySelector('.kp-fnlib-panel__close')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
    });

    const handle = this.root.querySelector('[data-kp-fnlib-drag="true"]');
    this._dragApi = makePanelDraggable(this.root, handle, { excludeSelector: '.kp-fnlib-panel__close' });
  }

  async _refresh() {
    try { this._userActions = await listUserActions(); } catch { this._userActions = []; }
    try { this._userMacros = await listUserMacros(); } catch { this._userMacros = []; }
    this._render();
  }

  _currentUserLayoutId() {
    const sel = String(this._kp?._currentKeyboardLayoutId || '');
    return sel.startsWith('user:') ? sel.slice('user:'.length) : null;
  }

  _render() {
    if (!this._bodyEl) return;
    this._stopCapture();
    this._bodyEl.replaceChildren();

    const layoutId = this._currentUserLayoutId();
    if (!layoutId) {
      const warn = document.createElement('div');
      warn.className = 'kp-fnlib-panel__hint';
      warn.textContent = 'Open a user keyboard layout (Alt+C, then pick/duplicate a layout) to bind Functions to keys. You can still browse below.';
      this._bodyEl.appendChild(warn);
    }

    const byCategory = new Map();
    for (const def of listFunctionDefs()) {
      const cat = getFunctionCategory(def.id);
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(def);
    }

    const categories = [
      ...FUNCTION_CATEGORY_ORDER.filter((c) => byCategory.has(c)),
      ...[...byCategory.keys()].filter((c) => !FUNCTION_CATEGORY_ORDER.includes(c))
    ];

    for (const cat of categories) {
      const heading = document.createElement('div');
      heading.className = 'kp-fnlib-category';
      heading.textContent = cat;
      this._bodyEl.appendChild(heading);

      for (const def of byCategory.get(cat)) {
        this._bodyEl.appendChild(this._renderFunctionRow(def, layoutId));
      }
    }

    this._bodyEl.appendChild(this._renderMacrosSection(layoutId));
  }

  /**
   * Ordered scripts of Function calls — see KEY_ACTION_ARCHITECTURE.md "Data model" (`UserMacro`
   * / `MacroStep`). Kept in this same panel rather than a separate one so Steps can be added by
   * picking straight from the Function Library above.
   * @param {string|null} layoutId
   */
  _renderMacrosSection(layoutId) {
    const section = document.createElement('div');

    const heading = document.createElement('div');
    heading.className = 'kp-fnlib-category';
    heading.textContent = 'Macros';
    section.appendChild(heading);

    for (const macro of this._userMacros) {
      section.appendChild(this._renderMacroRow(macro, layoutId));
    }

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'kp-fnlib-btn';
    addBtn.textContent = '+ New Macro';
    addBtn.addEventListener('click', async () => {
      const created = await createUserMacro({ label: `Macro ${this._userMacros.length + 1}` });
      if (created) {
        this._userMacros.push(created);
        this._render();
      }
    });
    section.appendChild(addBtn);

    return section;
  }

  /**
   * @param {import('../modules/keyboard-layout-store.js').UserMacro} macro
   * @param {string|null} layoutId
   */
  _renderMacroRow(macro, layoutId) {
    const wrap = document.createElement('div');
    wrap.className = 'kp-fnlib-macro';

    const head = document.createElement('div');
    head.className = 'kp-fnlib-macro__head';
    const label = document.createElement('div');
    label.className = 'kp-fnlib-macro__label';
    label.textContent = macro.label;
    head.appendChild(label);
    wrap.appendChild(head);

    const steps = Array.isArray(macro.steps) ? macro.steps : [];
    const stepsWrap = document.createElement('div');
    stepsWrap.className = 'kp-fnlib-steps';
    if (steps.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'kp-fnlib-empty';
      empty.textContent = 'No steps yet — add one below.';
      stepsWrap.appendChild(empty);
    } else {
      steps.forEach((step, index) => {
        stepsWrap.appendChild(this._renderMacroStepRow(macro, step, index, steps.length));
      });
    }
    wrap.appendChild(stepsWrap);

    wrap.appendChild(this._renderAddStepControl(macro));

    const actions = document.createElement('div');
    actions.className = 'kp-fnlib-row__actions';
    actions.appendChild(this._renderBindControl({
      functionId: null,
      slotItemId: macro.id,
      slotItemType: 'macro',
      layoutId,
      errorHost: wrap
    }));

    const runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = 'kp-fnlib-btn';
    runBtn.textContent = 'Run now';
    runBtn.title = 'Run this macro\u2019s steps immediately, for testing.';
    runBtn.addEventListener('click', async () => {
      try { await this._kp?._runMacroById?.(macro.id); } catch { /* ignore */ }
    });
    actions.appendChild(runBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'kp-fnlib-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      await deleteUserMacro(macro.id);
      this._userMacros = this._userMacros.filter((m) => m.id !== macro.id);
      this._render();
    });
    actions.appendChild(deleteBtn);

    wrap.appendChild(actions);
    return wrap;
  }

  /**
   * @param {import('../modules/keyboard-layout-store.js').UserMacro} macro
   * @param {import('../modules/keyboard-layout-store.js').MacroStep} step
   * @param {number} index
   * @param {number} total
   */
  _renderMacroStepRow(macro, step, index, total) {
    const row = document.createElement('div');
    row.className = 'kp-fnlib-step';

    const idx = document.createElement('div');
    idx.className = 'kp-fnlib-step__index';
    idx.textContent = String(index + 1);
    row.appendChild(idx);

    const def = getFunctionDef(step.functionId);
    const body = document.createElement('div');
    body.className = 'kp-fnlib-step__body';
    const label = document.createElement('div');
    label.className = 'kp-fnlib-step__label';
    label.textContent = def?.label || step.functionId;
    body.appendChild(label);
    const summaryText = summarizeFunctionParameters(step.functionId, step.parameters);
    if (summaryText) {
      const summary = document.createElement('div');
      summary.className = 'kp-fnlib-step__summary';
      summary.textContent = summaryText;
      body.appendChild(summary);
    }
    row.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'kp-fnlib-step__actions';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'kp-fnlib-step-btn';
    upBtn.textContent = '\u2191';
    upBtn.title = 'Move up';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', async () => {
      const updated = await moveUserMacroStep(macro.id, index, index - 1);
      if (updated) { Object.assign(macro, updated); this._render(); }
    });
    actions.appendChild(upBtn);

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'kp-fnlib-step-btn';
    downBtn.textContent = '\u2193';
    downBtn.title = 'Move down';
    downBtn.disabled = index === total - 1;
    downBtn.addEventListener('click', async () => {
      const updated = await moveUserMacroStep(macro.id, index, index + 1);
      if (updated) { Object.assign(macro, updated); this._render(); }
    });
    actions.appendChild(downBtn);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'kp-fnlib-step-btn';
    removeBtn.textContent = '\u00d7';
    removeBtn.title = 'Remove step';
    removeBtn.addEventListener('click', async () => {
      const updated = await removeUserMacroStep(macro.id, index);
      if (updated) { Object.assign(macro, updated); this._render(); }
    });
    actions.appendChild(removeBtn);

    row.appendChild(actions);
    return row;
  }

  /**
   * @param {import('../modules/keyboard-layout-store.js').UserMacro} macro
   */
  _renderAddStepControl(macro) {
    const row = document.createElement('div');
    row.className = 'kp-fnlib-add-step';

    const select = document.createElement('select');
    select.className = 'kp-fnlib-select';
    for (const def of listFunctionDefs()) {
      const opt = document.createElement('option');
      opt.value = def.id;
      opt.textContent = def.label;
      select.appendChild(opt);
    }
    row.appendChild(select);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'kp-fnlib-btn';
    addBtn.textContent = '+ Add step';
    addBtn.addEventListener('click', async () => {
      const updated = await addUserMacroStep(macro.id, { functionId: select.value });
      if (updated) { Object.assign(macro, updated); this._render(); }
    });
    row.appendChild(addBtn);

    return row;
  }

  /**
   * @param {import('../config/function-library.js').FunctionDef} def
   * @param {string|null} layoutId
   */
  _renderFunctionRow(def, layoutId) {
    const row = document.createElement('div');
    row.className = 'kp-fnlib-row';

    const head = document.createElement('div');
    head.className = 'kp-fnlib-row__head';
    const label = document.createElement('div');
    label.className = 'kp-fnlib-row__label';
    label.textContent = def.label;
    head.appendChild(label);
    if (def.worksWhileTyping) {
      const badge = document.createElement('span');
      badge.className = 'kp-fnlib-row__badge';
      badge.textContent = 'Needs modifier';
      badge.title = 'Must be bound to a modifier-key combination so it can run while a text field is focused.';
      head.appendChild(badge);
    }
    row.appendChild(head);

    const desc = document.createElement('div');
    desc.className = 'kp-fnlib-row__desc';
    desc.textContent = def.description;
    row.appendChild(desc);

    const instantiable = isFunctionInstantiable(def.id) && !def.legacyMacroKeyKind;

    if (instantiable) {
      const instancesWrap = document.createElement('div');
      instancesWrap.className = 'kp-fnlib-row__instances';
      const instances = this._userActions.filter((a) => a && a.functionId === def.id);
      for (const instance of instances) {
        instancesWrap.appendChild(this._renderInstanceRow(def, instance, layoutId));
      }
      row.appendChild(instancesWrap);

      const actions = document.createElement('div');
      actions.className = 'kp-fnlib-row__actions';
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'kp-fnlib-btn';
      addBtn.textContent = '+ New instance';
      addBtn.addEventListener('click', async () => {
        const created = await createUserAction({ functionId: def.id });
        if (created) {
          this._userActions.push(created);
          this._render();
        }
      });
      actions.appendChild(addBtn);
      row.appendChild(actions);
    } else if (!def.legacyMacroKeyKind) {
      // Bare, non-instantiable Function — bind the Function id directly to a slot.
      const actions = document.createElement('div');
      actions.className = 'kp-fnlib-row__actions';
      actions.appendChild(this._renderBindControl({
        functionId: def.id,
        slotItemId: def.id,
        layoutId,
        errorHost: row
      }));
      row.appendChild(actions);
    } else {
      const note = document.createElement('div');
      note.className = 'kp-fnlib-row__desc';
      note.textContent = 'Configure instances of this keystroke primitive from the Macro Keys tab in Keyboard Layout Config (Alt+C) for now.';
      row.appendChild(note);
    }

    return row;
  }

  /**
   * @param {import('../config/function-library.js').FunctionDef} def
   * @param {any} instance
   * @param {string|null} layoutId
   */
  _renderInstanceRow(def, instance, layoutId) {
    const wrap = document.createElement('div');
    wrap.className = 'kp-fnlib-instance';

    if (def.id === 'TYPE_CHARACTERS') {
      const textarea = document.createElement('textarea');
      textarea.className = 'kp-fnlib-textarea';
      textarea.placeholder = def.parameters?.[0]?.placeholder || '';
      textarea.value = String(instance.parameters?.text ?? '');
      textarea.addEventListener('change', async () => {
        const updated = await upsertUserAction({
          ...instance,
          parameters: { ...instance.parameters, text: textarea.value }
        });
        if (updated) {
          Object.assign(instance, updated);
          summary.textContent = this._summarize(def, instance);
        }
      });
      wrap.appendChild(textarea);
    }

    const summary = document.createElement('div');
    summary.className = 'kp-fnlib-instance__summary';
    summary.textContent = this._summarize(def, instance);
    wrap.appendChild(summary);

    const actions = document.createElement('div');
    actions.className = 'kp-fnlib-instance__actions';
    actions.appendChild(this._renderBindControl({
      functionId: def.id,
      slotItemId: instance.id,
      layoutId,
      errorHost: wrap
    }));

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'kp-fnlib-btn';
    removeBtn.textContent = 'Delete';
    removeBtn.addEventListener('click', async () => {
      await deleteUserAction(instance.id);
      this._userActions = this._userActions.filter((a) => a.id !== instance.id);
      this._render();
    });
    actions.appendChild(removeBtn);

    wrap.appendChild(actions);
    return wrap;
  }

  _summarize(def, instance) {
    if (def.id === 'TYPE_CHARACTERS') {
      const text = String(instance.parameters?.text || '');
      if (!text) return 'No text configured yet.';
      return text.length > 40 ? `“${text.slice(0, 40)}…”` : `“${text}”`;
    }
    return '';
  }

  /**
   * A button that, when clicked, listens for the next keydown and binds `slotItemId` (a bare
   * Function id, Action Instance id, or — when `slotItemType: 'macro'` — a Macro id) to the
   * resulting slot key on the current user layout.
   * @param {{ functionId: string|null, slotItemId: string, slotItemType?: 'function'|'macro', layoutId: string|null, errorHost: HTMLElement }} opts
   */
  _renderBindControl({ functionId, slotItemId, slotItemType = 'function', layoutId, errorHost }) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kp-fnlib-btn';
    btn.textContent = 'Bind key…';
    btn.disabled = !layoutId;
    btn.title = layoutId ? '' : 'Open/create a user layout first (Alt+C).';

    btn.addEventListener('click', () => {
      if (!layoutId) return;
      this._stopCapture();
      btn.dataset.capturing = 'true';
      btn.textContent = 'Press keys… (Esc to cancel)';

      const onKeyDown = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        this._stopCapture();
        btn.textContent = 'Bind key…';

        if (ev.key === 'Escape') return;

        const hasMods = !!(ev.ctrlKey || ev.altKey || ev.shiftKey || ev.metaKey);
        const slotKey = hasMods
          ? buildChordSlotKey({ key: ev.key, ctrl: ev.ctrlKey, alt: ev.altKey, shift: ev.shiftKey, meta: ev.metaKey })
          : (String(ev.key || '').length === 1 ? String(ev.key).toUpperCase() : String(ev.key || ''));

        if (!slotKey) return;

        this._clearError(errorHost);
        if (slotItemType === 'function') {
          const check = validateFunctionSlotKey(functionId, slotKey);
          if (!check.ok) {
            this._showError(errorHost, check.reason);
            return;
          }
        }

        const result = await setUserKeyboardLayoutSlot(layoutId, slotKey, { type: slotItemType, id: slotItemId });
        if (!result.ok) {
          this._showError(errorHost, result.reason);
          return;
        }

        const label = isChordSlotKey(slotKey) ? formatChordSlotKeyLabel(slotKey) : slotKey;
        this._showBound(errorHost, label);

        // Push the update live (no page refresh) — mirrors keyboard-layout-configurator.js.
        try { await this._kp?.applyLiveUserLayout?.(result.layout); } catch { /* ignore */ }
      };

      document.addEventListener('keydown', onKeyDown, { capture: true, once: true });
      this._captureCleanup = () => {
        try { document.removeEventListener('keydown', onKeyDown, { capture: true }); } catch { /* ignore */ }
      };
    });

    return btn;
  }

  _stopCapture() {
    if (this._captureCleanup) {
      try { this._captureCleanup(); } catch { /* ignore */ }
      this._captureCleanup = null;
    }
    if (this.root) {
      for (const btn of this.root.querySelectorAll('[data-capturing="true"]')) {
        btn.removeAttribute('data-capturing');
        btn.textContent = 'Bind key…';
      }
    }
  }

  _clearError(host) {
    host?.querySelector?.('.kp-fnlib-error')?.remove();
  }

  _showError(host, message) {
    this._clearError(host);
    const el = document.createElement('div');
    el.className = 'kp-fnlib-error';
    el.textContent = message || 'Could not bind key.';
    host?.appendChild?.(el);
  }

  _showBound(host, label) {
    this._clearError(host);
    const el = document.createElement('div');
    el.className = 'kp-fnlib-error';
    el.style.color = COLORS?.NOTIFICATION_SUCCESS || '#8fe3a5';
    el.textContent = `Bound to ${label}.`;
    host?.appendChild?.(el);
  }
}

/** Shared singleton, mirrors getSharedKeyActionConfigPanel() in key-action-settings.js. */
let _sharedFunctionLibraryPanel = null;

/** @returns {FunctionLibraryPanel} */
export function getSharedFunctionLibraryPanel() {
  if (!_sharedFunctionLibraryPanel) _sharedFunctionLibraryPanel = new FunctionLibraryPanel();
  return _sharedFunctionLibraryPanel;
}
