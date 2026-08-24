/**
 * Declarative Action-parameter control binder.
 * Adapts DOM controls to ActionConfigController.update — same idea as settings-binder.js.
 */

import { groupActionControlSpecs } from './action-config-schema.js';
import { enhanceNativeSelect } from '../ui/select-menu.js';

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
    input.addEventListener('change', () => {
      const n = Number(input.value);
      void controller.update(spec.path, Number.isFinite(n) ? n : spec.defaultValue);
    }, listenOpts);
    control = input;
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

  if (applyControlClass && classes.control && 'className' in control) {
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
