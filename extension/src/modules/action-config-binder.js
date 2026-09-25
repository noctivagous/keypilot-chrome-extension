/**
 * Declarative Action-parameter control binder.
 * Adapts DOM controls to ActionConfigController.update — same idea as settings-binder.js.
 */

import { groupActionControlSpecs } from './action-config-schema.js';
import { enhanceNativeSelect } from '../ui/select-menu.js';
import { MSG } from '../messaging/types.js';
import { getMessage } from '../utils/i18n.js';

/**
 * @typedef {{
 *   row?: string,
 *   label?: string,
 *   control?: string,
 *   group?: string,
 *   applyControlClassToToggle?: boolean
 * }} ActionConfigFieldClasses
 */

/**
 * Render schema-driven fields into `host` and route changes through the controller.
 *
 * @param {HTMLElement} host
 * @param {{
 *   controller: import('./action-config-controller.js').ActionConfigController,
 *   live?: boolean,
 *   classes?: ActionConfigFieldClasses,
 *   signal?: AbortSignal
 * }} ctx
 */
export function appendActionConfigFields(host, ctx) {
  if (!host || !ctx?.controller) return;
  const { controller } = ctx;
  const live = ctx.live !== false;
  const classes = ctx.classes || {};
  const listenOpts = ctx.signal ? { signal: ctx.signal, capture: true } : { capture: true };
  const values = controller.state?.parameters || {};

  for (const { group, specs } of groupActionControlSpecs(controller.schema())) {
    if (group) {
      const heading = host.ownerDocument.createElement('div');
      if (classes.group) heading.className = classes.group;
      heading.textContent = group;
      heading.style.marginTop = '8px';
      heading.style.fontWeight = '600';
      host.appendChild(heading);
    }
    for (const spec of specs) {
      host.appendChild(renderField(host.ownerDocument, spec, values[spec.path], {
        controller,
        live,
        classes,
        listenOpts
      }));
    }
  }
}

/**
 * @param {Document} doc
 * @param {import('./action-config-schema.js').ActionControlSpec} spec
 * @param {any} current
 * @param {{
 *   controller: import('./action-config-controller.js').ActionConfigController,
 *   live: boolean,
 *   classes: ActionConfigFieldClasses,
 *   listenOpts: AddEventListenerOptions
 * }} ctx
 * @returns {HTMLElement}
 */
function renderField(doc, spec, current, ctx) {
  const { controller, live, classes, listenOpts } = ctx;
  const row = doc.createElement('div');
  if (classes.row) row.className = classes.row;
  else row.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

  const label = doc.createElement(spec.type === 'toggle' ? 'div' : 'label');
  if (classes.label) label.className = classes.label;
  label.textContent = spec.label || spec.path;
  row.appendChild(label);

  const applyControlClass = spec.type !== 'toggle' || classes.applyControlClassToToggle;
  /** @type {HTMLElement} */
  let control;

  const widget = spec.widget || (spec.type === 'radio' ? 'radio' : spec.type === 'select' ? 'select' : null);

  if (spec.type === 'toggle') {
    const input = doc.createElement('input');
    input.type = 'checkbox';
    input.checked = !!current;
    input.addEventListener('change', () => {
      void controller.update(spec.path, !!input.checked);
    }, listenOpts);
    control = input;
  } else if (spec.type === 'radio' || widget === 'radio') {
    const wrap = doc.createElement('div');
    wrap.setAttribute('role', 'radiogroup');
    wrap.setAttribute('aria-label', spec.label || spec.path);
    const name = `kp-action-${spec.path}`;
    for (const optionDef of spec.options || []) {
      const optLabel = doc.createElement('label');
      const radio = doc.createElement('input');
      radio.type = 'radio';
      radio.name = name;
      radio.value = optionDef.id;
      radio.checked = optionDef.id === current;
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        void controller.update(spec.path, radio.value);
      }, listenOpts);
      optLabel.appendChild(radio);
      optLabel.appendChild(doc.createTextNode(optionDef.label));
      wrap.appendChild(optLabel);
    }
    control = wrap;
  } else if (spec.type === 'enum' || spec.type === 'select' || widget === 'select') {
    const select = doc.createElement('select');
    for (const optionDef of spec.options || []) {
      const option = doc.createElement('option');
      option.value = optionDef.id;
      option.textContent = optionDef.label;
      option.selected = optionDef.id === current;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      void controller.update(spec.path, select.value);
    }, listenOpts);
    control = select;
  } else if (spec.type === 'range') {
    const input = doc.createElement('input');
    input.type = 'number';
    if (spec.min != null) input.min = String(spec.min);
    if (spec.max != null) input.max = String(spec.max);
    if (spec.step != null) input.step = String(spec.step);
    input.value = current != null ? String(current) : '';
    const commit = () => {
      const n = Number(input.value);
      void controller.update(spec.path, Number.isFinite(n) ? n : spec.defaultValue);
    };
    input.addEventListener('change', commit, listenOpts);
    if (live) input.addEventListener('input', commit, listenOpts);
    control = input;
  } else if (spec.type === 'stringList') {
    control = renderStringList(doc, spec, current, ctx);
  } else if (spec.type === 'bookmarkFolder') {
    control = renderBookmarkFolderPicker(doc, spec, current, ctx);
  } else if (spec.type === 'textarea' || spec.multiline) {
    const textarea = doc.createElement('textarea');
    textarea.setAttribute('data-multiline', 'true');
    const rows = Number(spec.rows);
    textarea.rows = Number.isFinite(rows) && rows > 0 ? rows : 3;
    textarea.value = current == null ? '' : String(current);
    const commit = () => { void controller.update(spec.path, textarea.value); };
    textarea.addEventListener('change', commit, listenOpts);
    if (live) textarea.addEventListener('input', commit, listenOpts);
    control = textarea;
  } else {
    const input = doc.createElement('input');
    input.type = 'text';
    input.value = current == null ? '' : String(current);
    const commit = () => { void controller.update(spec.path, input.value); };
    input.addEventListener('change', commit, listenOpts);
    if (live) input.addEventListener('input', commit, listenOpts);
    control = input;
  }

  if (spec.type !== 'stringList' && spec.type !== 'bookmarkFolder' && applyControlClass && classes.control && 'className' in control) {
    control.className = classes.control;
  }
  if (spec.placeholder && 'placeholder' in control) {
    control.placeholder = String(spec.placeholder);
  }
  row.appendChild(control);
  if (control?.tagName === 'SELECT') {
    enhanceNativeSelect(/** @type {HTMLSelectElement} */ (control));
  }
  return row;
}

/**
 * One text field per URL, plus add / remove. Values commit as a string array;
 * normalization (http/https, cap) happens in the controller.
 * @param {Document} doc
 * @param {import('./action-config-schema.js').ActionControlSpec} spec
 * @param {any} current
 * @param {{
 *   controller: import('./action-config-controller.js').ActionConfigController,
 *   live: boolean,
 *   classes: ActionConfigFieldClasses,
 *   listenOpts: AddEventListenerOptions
 * }} ctx
 * @returns {HTMLElement}
 */
function renderStringList(doc, spec, current, ctx) {
  if (spec.presentation === 'table') return renderStringListTable(doc, spec, current, ctx);
  const { controller, live, classes, listenOpts } = ctx;
  const maxItems = Number.isFinite(spec.maxItems) && spec.maxItems > 0 ? spec.maxItems : 20;
  const wrap = doc.createElement('div');
  wrap.className = 'kp-cfg-url-list';
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

  const rows = doc.createElement('div');
  rows.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
  wrap.appendChild(rows);

  const addBtn = doc.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'kp-cfg-btn';
  addBtn.textContent = spec.addLabel || 'Add URL';

  const commit = () => {
    const values = [...rows.querySelectorAll('input')].map((input) => input.value);
    void controller.update(spec.path, values);
  };

  const syncAddEnabled = () => {
    addBtn.disabled = rows.childElementCount >= maxItems;
  };

  const addRow = (value) => {
    if (rows.childElementCount >= maxItems) return;
    const line = doc.createElement('div');
    line.style.cssText = 'display:flex;gap:4px;align-items:center;';
    const input = doc.createElement('input');
    input.type = 'text';
    input.inputMode = 'url';
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.value = value == null ? '' : String(value);
    if (classes.control) input.className = classes.control;
    input.style.flex = '1';
    input.style.minWidth = '0';
    input.style.width = 'auto';
    if (spec.placeholder) input.placeholder = String(spec.placeholder);
    input.addEventListener('change', commit, listenOpts);
    if (live) input.addEventListener('input', commit, listenOpts);

    const remove = doc.createElement('button');
    remove.type = 'button';
    remove.className = 'kp-cfg-btn';
    remove.textContent = '×';
    remove.setAttribute('aria-label', spec.removeLabel || 'Remove URL');
    remove.title = spec.removeLabel || 'Remove URL';
    remove.addEventListener('click', () => {
      line.remove();
      if (!rows.childElementCount) addRow('');
      syncAddEnabled();
      commit();
    }, listenOpts);

    line.appendChild(input);
    line.appendChild(remove);
    rows.appendChild(line);
    syncAddEnabled();
  };

  const initial = Array.isArray(current) ? current.filter((item) => String(item || '').trim()) : [];
  if (initial.length) {
    for (const value of initial) addRow(value);
  } else {
    addRow('');
  }

  addBtn.addEventListener('click', () => {
    addRow('');
    const inputs = rows.querySelectorAll('input');
    const last = inputs[inputs.length - 1];
    if (last) last.focus();
  }, listenOpts);
  wrap.appendChild(addBtn);
  syncAddEnabled();
  return wrap;
}

/**
 * Scrollable URL table. `visibleRows` is the viewport (default 5), not the data cap.
 * @param {Document} doc
 * @param {import('./action-config-schema.js').ActionControlSpec} spec
 * @param {any} current
 * @param {{
 *   controller: import('./action-config-controller.js').ActionConfigController,
 *   live: boolean,
 *   classes: ActionConfigFieldClasses,
 *   listenOpts: AddEventListenerOptions
 * }} ctx
 * @returns {HTMLElement}
 */
function renderStringListTable(doc, spec, current, ctx) {
  const { controller, live, classes, listenOpts } = ctx;
  const maxItems = Number.isFinite(spec.maxItems) && spec.maxItems > 0 ? spec.maxItems : 20;
  const visibleRows = Number.isFinite(spec.visibleRows) && spec.visibleRows > 0 ? spec.visibleRows : 5;
  const wrap = doc.createElement('div');
  wrap.className = 'kp-string-table';

  const scroller = doc.createElement('div');
  scroller.className = 'kp-string-table-scroll';
  scroller.style.maxHeight = `calc(${visibleRows} * var(--kp-string-table-row, 30px))`;
  scroller.style.overflowY = 'auto';

  const table = doc.createElement('table');
  const tbody = doc.createElement('tbody');
  table.appendChild(tbody);
  scroller.appendChild(table);
  wrap.appendChild(scroller);

  const addBtn = doc.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'kp-cfg-btn kp-string-table-add';
  addBtn.textContent = spec.addLabel || 'Add URL';

  const commit = () => {
    const values = [...tbody.querySelectorAll('input')].map((input) => input.value);
    void controller.update(spec.path, values);
  };

  const syncAddEnabled = () => {
    addBtn.disabled = tbody.childElementCount >= maxItems;
  };

  const addRow = (value) => {
    if (tbody.childElementCount >= maxItems) return;
    const tr = doc.createElement('tr');
    const valueCell = doc.createElement('td');
    const input = doc.createElement('input');
    input.type = 'text';
    input.inputMode = 'url';
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.value = value == null ? '' : String(value);
    if (classes.control) input.className = classes.control;
    if (spec.placeholder) input.placeholder = String(spec.placeholder);
    input.addEventListener('change', commit, listenOpts);
    if (live) input.addEventListener('input', commit, listenOpts);
    valueCell.appendChild(input);

    const removeCell = doc.createElement('td');
    const remove = doc.createElement('button');
    remove.type = 'button';
    remove.className = 'kp-cfg-btn kp-string-table-remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', spec.removeLabel || 'Remove URL');
    remove.title = spec.removeLabel || 'Remove URL';
    remove.addEventListener('click', () => {
      tr.remove();
      if (!tbody.childElementCount) addRow('');
      syncAddEnabled();
      commit();
    }, listenOpts);
    removeCell.appendChild(remove);

    tr.appendChild(valueCell);
    tr.appendChild(removeCell);
    tbody.appendChild(tr);
    syncAddEnabled();
  };

  const initial = Array.isArray(current) ? current.filter((item) => String(item || '').trim()) : [];
  if (initial.length) {
    for (const value of initial) addRow(value);
  } else {
    addRow('');
  }

  addBtn.addEventListener('click', () => {
    addRow('');
    const inputs = tbody.querySelectorAll('input');
    const last = inputs[inputs.length - 1];
    if (last) last.focus();
    if (tbody.childElementCount > visibleRows) {
      try { scroller.scrollTop = scroller.scrollHeight; } catch { /* ignore */ }
    }
  }, listenOpts);
  wrap.appendChild(addBtn);
  syncAddEnabled();
  return wrap;
}

/**
 * @returns {Promise<Array<{ id: string, path: string }>>}
 */
async function fetchBookmarkFolders() {
  try {
    const response = await chrome.runtime.sendMessage({ type: MSG.LIST_BOOKMARK_FOLDERS });
    if (response && response.type === MSG.BOOKMARK_FOLDERS && Array.isArray(response.folders)) {
      return response.folders.filter((folder) => folder && folder.id && folder.path);
    }
  } catch { /* ignore */ }
  return [];
}

/**
 * Scrollable Bookmarks Manager folder picker. The stored value is the folder id.
 * @param {Document} doc
 * @param {import('./action-config-schema.js').ActionControlSpec} spec
 * @param {any} current
 * @param {{
 *   controller: import('./action-config-controller.js').ActionConfigController,
 *   classes: ActionConfigFieldClasses,
 *   listenOpts: AddEventListenerOptions
 * }} ctx
 * @returns {HTMLElement}
 */
function renderBookmarkFolderPicker(doc, spec, current, ctx) {
  const { controller, classes, listenOpts } = ctx;
  let selectedId = current == null ? '' : String(current);
  const wrap = doc.createElement('div');
  wrap.className = 'kp-bookmark-folder-list';

  const filter = doc.createElement('input');
  filter.type = 'text';
  filter.autocomplete = 'off';
  filter.spellcheck = false;
  filter.placeholder = spec.placeholder || getMessage('fn_param_bookmark_folder_filter') || 'Filter folders';
  filter.setAttribute('aria-label', filter.placeholder);
  if (classes.control) filter.className = classes.control;

  const scroller = doc.createElement('div');
  scroller.className = 'kp-bookmark-folder-scroll';
  scroller.style.maxHeight = 'calc(5 * var(--kp-string-table-row, 30px))';
  scroller.style.overflowY = 'auto';
  scroller.setAttribute('role', 'listbox');
  scroller.setAttribute('aria-label', spec.label || 'Folder');

  const hint = doc.createElement('div');
  hint.className = 'kp-bookmark-folder-hint';
  hint.textContent = spec.hint
    || getMessage('fn_param_bookmark_folder_hint')
    || 'Opens the first 30 website bookmarks in this folder.';

  /** @type {Array<{ id: string, path: string }>} */
  let folders = [];

  const allLabel = getMessage('fn_param_bookmark_folder_all') || 'All bookmarks';
  const appendAll = (needle) => {
    if (!spec.allowAll) return false;
    if (needle && !allLabel.toLowerCase().includes(needle)) return false;
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'kp-bookmark-folder-btn';
    btn.dataset.folderId = '';
    btn.textContent = allLabel;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', selectedId === '' ? 'true' : 'false');
    btn.addEventListener('click', () => {
      selectedId = '';
      scroller.querySelectorAll('.kp-bookmark-folder-btn').forEach((el) => {
        el.setAttribute('aria-selected', el === btn ? 'true' : 'false');
      });
      void controller.update(spec.path, '');
    }, listenOpts);
    scroller.appendChild(btn);
    return true;
  };

  const paint = (query) => {
    const needle = String(query || '').trim().toLowerCase();
    scroller.replaceChildren();
    const matches = folders.filter((folder) => !needle || folder.path.toLowerCase().includes(needle));
    const showedAll = appendAll(needle);
    if (!folders.length) {
      if (showedAll) return;
      const empty = doc.createElement('div');
      empty.className = 'kp-bookmark-folder-status';
      empty.textContent = getMessage('fn_param_bookmark_folder_empty') || 'No bookmark folders';
      scroller.appendChild(empty);
      return;
    }
    if (selectedId && !folders.some((folder) => folder.id === selectedId) && !needle) {
      const missing = doc.createElement('button');
      missing.type = 'button';
      missing.className = 'kp-bookmark-folder-btn';
      missing.setAttribute('aria-pressed', 'true');
      missing.textContent = getMessage('fn_param_bookmark_folder_missing') || 'Folder not found';
      scroller.appendChild(missing);
    }
    if (!matches.length) {
      const empty = doc.createElement('div');
      empty.className = 'kp-bookmark-folder-status';
      empty.textContent = getMessage('fn_param_bookmark_folder_empty') || 'No bookmark folders';
      scroller.appendChild(empty);
      return;
    }
    for (const folder of matches) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'kp-bookmark-folder-btn';
      btn.dataset.folderId = folder.id;
      btn.textContent = folder.path;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', folder.id === selectedId ? 'true' : 'false');
      btn.addEventListener('click', () => {
        selectedId = folder.id;
        scroller.querySelectorAll('.kp-bookmark-folder-btn').forEach((el) => {
          el.setAttribute('aria-selected', el === btn ? 'true' : 'false');
        });
        void controller.update(spec.path, folder.id);
      }, listenOpts);
      scroller.appendChild(btn);
    }
  };

  filter.addEventListener('input', () => paint(filter.value), listenOpts);
  const loading = doc.createElement('div');
  loading.className = 'kp-bookmark-folder-status';
  loading.textContent = getMessage('fn_param_bookmark_folder_loading') || 'Loading folders…';
  scroller.appendChild(loading);

  wrap.appendChild(filter);
  wrap.appendChild(scroller);
  wrap.appendChild(hint);

  void fetchBookmarkFolders().then((next) => {
    if (!wrap.isConnected) return;
    folders = next;
    paint(filter.value);
  });
  return wrap;
}
