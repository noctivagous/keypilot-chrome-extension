/**
 * Declarative control metadata for Function / key-action parameter forms.
 * DOM-free. Maps FunctionParameterDef into Settings-like control specs.
 */

import { clampNumber } from './settings-path.js';

/**
 * Enums painted as radio/button groups on the Keyboard Reference key-info popover.
 * Layout Config inspector still uses `select` unless `radioParamIds` is passed.
 */
export const ACTION_RADIO_PARAMETER_IDS = Object.freeze(['mode', 'action', 'format', 'destination']);

/** @typedef {'toggle'|'select'|'radio'|'range'|'enum'|'text'|'textarea'} ActionControlType */

/**
 * @typedef {{
 *   type: ActionControlType,
 *   widget?: 'select'|'radio',
 *   path: string,
 *   label: string,
 *   group: string,
 *   options?: Array<{ id: string, label: string }>,
 *   min?: number,
 *   max?: number,
 *   step?: number,
 *   placeholder?: string,
 *   rows?: number,
 *   defaultValue?: any,
 *   multiline?: boolean
 * }} ActionControlSpec
 */

/**
 * @param {{ type?: string, id?: string, multiline?: boolean }|null|undefined} param
 * @param {{ radioParamIds?: readonly string[] }} [opts]
 * @returns {ActionControlType}
 */
export function controlTypeForParameter(param, opts = {}) {
  if (!param) return 'text';
  if (param.type === 'boolean') return 'toggle';
  if (param.type === 'number') return 'range';
  if (param.type === 'enum') {
    const radioIds = opts.radioParamIds || [];
    return radioIds.includes(param.id) ? 'radio' : 'enum';
  }
  if (param.multiline) return 'textarea';
  return 'text';
}

/**
 * @param {import('../config/function-library.js').FunctionParameterDef|null|undefined} param
 * @param {{ radioParamIds?: readonly string[] }} [opts]
 * @returns {ActionControlSpec|null}
 */
export function parameterToControlSpec(param, opts = {}) {
  if (!param || !param.id) return null;
  const type = controlTypeForParameter(param, opts);
  /** @type {ActionControlSpec} */
  const spec = {
    type,
    path: param.id,
    label: param.label || param.id,
    group: String(param.group || ''),
    defaultValue: param.defaultValue
  };
  if (type === 'enum' || type === 'radio' || type === 'select') {
    spec.widget = type === 'radio' ? 'radio' : 'select';
    spec.options = Array.isArray(param.options) ? param.options : [];
  }
  if (type === 'range') {
    if (param.min != null) spec.min = param.min;
    if (param.max != null) spec.max = param.max;
    if (param.step != null) spec.step = param.step;
  }
  if (param.placeholder) spec.placeholder = String(param.placeholder);
  if (param.multiline) spec.multiline = true;
  if (param.rows != null) spec.rows = param.rows;
  return spec;
}

/**
 * @param {Array<import('../config/function-library.js').FunctionParameterDef>|null|undefined} parameters
 * @param {{
 *   radioParamIds?: readonly string[],
 *   shouldShow?: (param: any) => boolean,
 *   filterOptions?: (param: any) => Array<{ id: string, label: string }>
 * }} [opts]
 * @returns {ActionControlSpec[]}
 */
export function buildActionControlSchema(parameters, opts = {}) {
  const shouldShow = opts.shouldShow || (() => true);
  const filterOptions = opts.filterOptions;
  /** @type {ActionControlSpec[]} */
  const specs = [];
  for (const param of parameters || []) {
    if (!param || !shouldShow(param)) continue;
    const spec = parameterToControlSpec(param, opts);
    if (!spec) continue;
    if ((spec.type === 'enum' || spec.type === 'radio' || spec.type === 'select') && filterOptions) {
      spec.options = filterOptions(param);
    }
    specs.push(spec);
  }
  return specs;
}

/**
 * @param {ActionControlSpec[]} specs
 * @returns {Array<{ group: string, specs: ActionControlSpec[] }>}
 */
export function groupActionControlSpecs(specs) {
  /** @type {Array<{ group: string, specs: ActionControlSpec[] }>} */
  const groups = [];
  for (const spec of specs || []) {
    if (!spec) continue;
    const group = String(spec.group || '');
    const last = groups[groups.length - 1];
    if (last && last.group === group) last.specs.push(spec);
    else groups.push({ group, specs: [spec] });
  }
  return groups;
}

/**
 * Normalize a single control value against its spec (no Function catalog lookup).
 * @param {ActionControlSpec|null|undefined} spec
 * @param {any} raw
 * @returns {any}
 */
export function normalizeControlValue(spec, raw) {
  if (!spec) return raw;
  switch (spec.type) {
    case 'toggle':
      return !!raw;
    case 'range': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n)) return spec.defaultValue;
      if (spec.min != null && spec.max != null) return clampNumber(n, spec.min, spec.max);
      return n;
    }
    case 'enum':
    case 'select':
    case 'radio': {
      const options = spec.options || [];
      return options.some((o) => o && o.id === raw) ? raw : spec.defaultValue;
    }
    default:
      return raw !== undefined && raw !== null ? String(raw) : (spec.defaultValue ?? '');
  }
}

/**
 * Apply per-field spec normalization, then optionally a Function-level normalizer.
 * @param {ActionControlSpec[]} specs
 * @param {Record<string, any>|null|undefined} raw
 * @returns {Record<string, any>}
 */
export function normalizeActionParametersFromSchema(specs, raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  /** @type {Record<string, any>} */
  const out = {};
  for (const spec of specs || []) {
    const has = Object.prototype.hasOwnProperty.call(src, spec.path);
    out[spec.path] = normalizeControlValue(spec, has ? src[spec.path] : spec.defaultValue);
  }
  return out;
}
