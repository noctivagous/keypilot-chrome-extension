/**
 * Inline editor for a configured Macro Key (built-in kinds).
 * Used by Keyboard Layout Config — configure before assigning to a slot.
 */

import {
  formatKeyStroke,
  MACRO_KEY_KIND_DEFS,
  normalizeKeyStroke,
  normalizeMacroKeyConfig
} from '../config/macro-keys.js';

/**
 * @param {Document} doc
 * @param {import('../config/macro-keys.js').KeyStroke} stroke
 * @param {(next: import('../config/macro-keys.js').KeyStroke) => void} onChange
 * @returns {HTMLElement}
 */
function buildStrokeEditor(doc, stroke, onChange) {
  const row = doc.createElement('div');
  row.className = 'kp-mk-stroke';

  const keyInput = doc.createElement('input');
  keyInput.type = 'text';
  keyInput.className = 'kp-cfg-field kp-mk-key-input';
  keyInput.placeholder = 'Key';
  keyInput.value = stroke?.key || '';
  keyInput.setAttribute('aria-label', 'Key');
  keyInput.addEventListener('input', () => {
    onChange(normalizeKeyStroke({
      ...stroke,
      key: keyInput.value
    }));
  }, true);

  const mkCheck = (name, checked) => {
    const lab = doc.createElement('label');
    lab.className = 'kp-mk-mod';
    const cb = doc.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!checked;
    cb.addEventListener('change', () => {
      onChange(normalizeKeyStroke({
        ...stroke,
        key: keyInput.value,
        ctrl: name === 'ctrl' ? cb.checked : stroke?.ctrl,
        alt: name === 'alt' ? cb.checked : stroke?.alt,
        shift: name === 'shift' ? cb.checked : stroke?.shift,
        meta: name === 'meta' ? cb.checked : stroke?.meta
      }));
    }, true);
    lab.appendChild(cb);
    lab.appendChild(doc.createTextNode(name === 'meta' ? 'Win' : name[0].toUpperCase() + name.slice(1)));
    return lab;
  };

  row.appendChild(mkCheck('ctrl', stroke?.ctrl));
  row.appendChild(mkCheck('alt', stroke?.alt));
  row.appendChild(mkCheck('shift', stroke?.shift));
  row.appendChild(mkCheck('meta', stroke?.meta));
  row.appendChild(keyInput);
  return row;
}

/**
 * @param {{
 *   doc?: Document,
 *   macroKey: import('../config/macro-keys.js').UserMacroKey,
 *   onChange: (next: import('../config/macro-keys.js').UserMacroKey) => void,
 *   onSave: () => void,
 *   onCancel: () => void,
 *   onDelete?: () => void
 * }} opts
 * @returns {HTMLElement}
 */
export function createMacroKeyEditor(opts) {
  const doc = opts.doc || document;
  const mk = opts.macroKey;
  const kindDef = MACRO_KEY_KIND_DEFS.find((d) => d.id === mk.kind);
  let draft = {
    ...mk,
    config: normalizeMacroKeyConfig(mk.kind, mk.config)
  };

  const root = doc.createElement('div');
  root.className = 'kp-mk-editor';
  root.setAttribute('data-kp-macro-key-editor', 'true');

  const title = doc.createElement('div');
  title.className = 'kp-mk-editor-title';
  title.textContent = `Configure: ${kindDef?.label || mk.kind}`;
  root.appendChild(title);

  const labelLab = doc.createElement('label');
  labelLab.className = 'kp-mk-field-label';
  labelLab.textContent = 'Name';
  const labelInput = doc.createElement('input');
  labelInput.type = 'text';
  labelInput.className = 'kp-cfg-field';
  labelInput.value = draft.label || '';
  labelInput.addEventListener('input', () => {
    draft = { ...draft, label: labelInput.value };
    opts.onChange?.(draft);
  }, true);
  root.appendChild(labelLab);
  root.appendChild(labelInput);

  const body = doc.createElement('div');
  body.className = 'kp-mk-editor-body';
  root.appendChild(body);

  const emitConfig = (config) => {
    draft = { ...draft, config: normalizeMacroKeyConfig(mk.kind, config) };
    opts.onChange?.(draft);
    preview.textContent = formatPreview(draft);
  };

  const preview = doc.createElement('div');
  preview.className = 'kp-mk-preview';
  preview.textContent = formatPreview(draft);

  if (mk.kind === 'hotkey' || mk.kind === 'key' || mk.kind === 'continuous') {
    const strokeLab = doc.createElement('div');
    strokeLab.className = 'kp-mk-field-label';
    strokeLab.textContent = mk.kind === 'continuous' ? 'Key to hold/repeat' : 'Key / chord';
    body.appendChild(strokeLab);
    body.appendChild(buildStrokeEditor(doc, draft.config.stroke, (stroke) => {
      emitConfig({ ...draft.config, stroke });
    }));
    if (mk.kind === 'continuous') {
      const intLab = doc.createElement('div');
      intLab.className = 'kp-mk-field-label';
      intLab.textContent = 'Interval (ms)';
      const intInput = doc.createElement('input');
      intInput.type = 'number';
      intInput.className = 'kp-cfg-field';
      intInput.min = '10';
      intInput.max = '5000';
      intInput.value = String(draft.config.intervalMs || 50);
      intInput.addEventListener('input', () => {
        emitConfig({ ...draft.config, intervalMs: Number(intInput.value) });
      }, true);
      body.appendChild(intLab);
      body.appendChild(intInput);
    }
  } else if (mk.kind === 'burst' || mk.kind === 'roundRobin') {
    const listKey = mk.kind === 'burst' ? 'steps' : 'items';
    const listLab = doc.createElement('div');
    listLab.className = 'kp-mk-field-label';
    listLab.textContent = mk.kind === 'burst' ? 'Sequence' : 'Cycle items';
    body.appendChild(listLab);

    const listHost = doc.createElement('div');
    listHost.className = 'kp-mk-stroke-list';
    body.appendChild(listHost);

    const redrawList = () => {
      listHost.replaceChildren();
      const arr = Array.isArray(draft.config[listKey]) ? draft.config[listKey] : [];
      arr.forEach((stroke, index) => {
        const wrap = doc.createElement('div');
        wrap.className = 'kp-mk-stroke-row';
        const idx = doc.createElement('span');
        idx.className = 'kp-mk-stroke-idx';
        idx.textContent = String(index + 1);
        wrap.appendChild(idx);
        wrap.appendChild(buildStrokeEditor(doc, stroke, (next) => {
          const copy = arr.slice();
          copy[index] = next;
          emitConfig({ ...draft.config, [listKey]: copy });
        }));
        const rm = doc.createElement('button');
        rm.type = 'button';
        rm.className = 'kp-cfg-btn';
        rm.textContent = '×';
        rm.title = 'Remove';
        rm.addEventListener('click', () => {
          const copy = arr.slice();
          copy.splice(index, 1);
          emitConfig({ ...draft.config, [listKey]: copy });
          redrawList();
        }, true);
        wrap.appendChild(rm);
        listHost.appendChild(wrap);
      });
    };
    redrawList();

    const addBtn = doc.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'kp-cfg-btn';
    addBtn.textContent = 'Add stroke';
    addBtn.addEventListener('click', () => {
      const arr = Array.isArray(draft.config[listKey]) ? draft.config[listKey].slice() : [];
      arr.push(normalizeKeyStroke({ key: '' }));
      emitConfig({ ...draft.config, [listKey]: arr });
      redrawList();
    }, true);
    body.appendChild(addBtn);

    if (mk.kind === 'burst') {
      const gapLab = doc.createElement('div');
      gapLab.className = 'kp-mk-field-label';
      gapLab.textContent = 'Gap between strokes (ms)';
      const gapInput = doc.createElement('input');
      gapInput.type = 'number';
      gapInput.className = 'kp-cfg-field';
      gapInput.min = '0';
      gapInput.max = '2000';
      gapInput.value = String(draft.config.gapMs ?? 40);
      gapInput.addEventListener('input', () => {
        emitConfig({ ...draft.config, gapMs: Number(gapInput.value) });
      }, true);
      body.appendChild(gapLab);
      body.appendChild(gapInput);
    }

    // Keep list in sync when emitConfig updates draft from stroke editors inside redraw.
    const origEmit = emitConfig;
    // redrawList closes over draft; stroke onChange already calls emitConfig.
  } else if (mk.kind === 'mouse') {
    const lab = doc.createElement('div');
    lab.className = 'kp-mk-field-label';
    lab.textContent = 'Mouse button';
    body.appendChild(lab);
    const row = doc.createElement('div');
    row.className = 'kp-mk-mouse-row';
    for (const button of ['left', 'middle', 'right']) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'kp-cfg-btn';
      b.textContent = button;
      b.setAttribute('aria-pressed', draft.config.button === button ? 'true' : 'false');
      b.addEventListener('click', () => {
        emitConfig({ button });
        row.querySelectorAll('button').forEach((el) => {
          el.setAttribute('aria-pressed', el.textContent === button ? 'true' : 'false');
        });
      }, true);
      row.appendChild(b);
    }
    body.appendChild(row);
  }

  root.appendChild(preview);

  const actions = doc.createElement('div');
  actions.className = 'kp-mk-editor-actions';
  const saveBtn = doc.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'kp-cfg-btn';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    opts.onChange?.(draft);
    opts.onSave?.();
  }, true);
  const cancelBtn = doc.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'kp-cfg-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => opts.onCancel?.(), true);
  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  if (typeof opts.onDelete === 'function') {
    const delBtn = doc.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'kp-cfg-btn';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => opts.onDelete?.(), true);
    actions.appendChild(delBtn);
  }
  root.appendChild(actions);

  return root;
}

/**
 * @param {import('../config/macro-keys.js').UserMacroKey} mk
 * @returns {string}
 */
function formatPreview(mk) {
  const cfg = normalizeMacroKeyConfig(mk.kind, mk.config);
  if (mk.kind === 'hotkey' || mk.kind === 'key') return formatKeyStroke(cfg.stroke);
  if (mk.kind === 'burst') return (cfg.steps || []).map(formatKeyStroke).join(' → ');
  if (mk.kind === 'roundRobin') return (cfg.items || []).map(formatKeyStroke).join(' / ');
  if (mk.kind === 'continuous') return `${formatKeyStroke(cfg.stroke)} every ${cfg.intervalMs}ms`;
  if (mk.kind === 'mouse') return `${cfg.button} click`;
  return '';
}
