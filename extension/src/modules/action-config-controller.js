/**
 * Framework-neutral Action / Function-parameter state controller.
 * No DOM queries or element mutation.
 *
 * Parameter *schema* remains FunctionDef.parameters (function-library.js).
 * Parameter *values* remain on the Action Instance (keyboard-layout-store.js /
 * key-action-settings.js persist helpers). This controller only holds a working
 * snapshot and routes updates through the same normalize + optional persist path.
 */

import {
  defaultFunctionParameters,
  getFunctionDef,
  normalizeFunctionParameters
} from '../config/function-library.js';
import {
  filterFunctionParameterOptions,
  shouldShowFunctionParameter
} from './ai-text-service.js';
import {
  buildActionControlSchema,
  normalizeActionParametersFromSchema,
  normalizeControlValue
} from './action-config-schema.js';

/**
 * @typedef {{
 *   functionId: string,
 *   parameters: Record<string, any>
 * }} ActionConfigState
 */

export class ActionConfigController {
  constructor() {
    /** @type {ActionConfigState} */
    this.state = { functionId: '', parameters: {} };
    /** @type {Set<(state: ActionConfigState) => void>} */
    this._listeners = new Set();
    this._disposed = false;
    /** @type {import('./action-config-schema.js').ActionControlSpec[]} */
    this._specs = [];
    /** @type {((functionId: string, paramId: string, value: any) => any)|null} */
    this._persist = null;
  }

  get disposed() {
    return this._disposed;
  }

  /**
   * @param {(state: ActionConfigState) => void} fn
   * @returns {() => void}
   */
  subscribe(fn) {
    if (typeof fn !== 'function' || this._disposed) return () => {};
    this._listeners.add(fn);
    return () => {
      this._listeners.delete(fn);
    };
  }

  _emit() {
    if (this._disposed) return;
    for (const fn of this._listeners) {
      try { fn(this.state); } catch { /* ignore */ }
    }
  }

  /**
   * @returns {import('./action-config-schema.js').ActionControlSpec[]}
   */
  schema() {
    return this._specs;
  }

  /**
   * @param {{
   *   functionId?: string,
   *   snapshot?: Record<string, any>|null,
   *   parameters?: Array<import('../config/function-library.js').FunctionParameterDef>|null,
   *   radioParamIds?: readonly string[],
   *   persist?: (functionId: string, paramId: string, value: any) => any
   * }} [opts]
   */
  load(opts = {}) {
    if (this._disposed) return this.state;
    const functionId = String(opts.functionId || '');
    const def = functionId ? getFunctionDef(functionId) : null;
    const parameterDefs = opts.parameters || def?.parameters || [];
    this._specs = buildActionControlSchema(parameterDefs, {
      radioParamIds: opts.radioParamIds,
      shouldShow: (param) => shouldShowFunctionParameter(functionId, param),
      filterOptions: (param) => filterFunctionParameterOptions(functionId, param)
    });
    this._persist = typeof opts.persist === 'function' ? opts.persist : null;

    const snapshot = opts.snapshot && typeof opts.snapshot === 'object' ? opts.snapshot : {};
    let parameters;
    if (def) {
      parameters = normalizeFunctionParameters(functionId, {
        ...defaultFunctionParameters(functionId),
        ...snapshot
      });
    } else {
      parameters = normalizeActionParametersFromSchema(this._specs, snapshot);
    }

    this.state = { functionId, parameters };
    this._emit();
    return this.state;
  }

  /**
   * @param {string} path parameter id
   * @param {any} value
   */
  async update(path, value) {
    if (this._disposed) return this.state;
    const spec = this._specs.find((s) => s.path === path);
    const fieldValue = spec ? normalizeControlValue(spec, value) : value;
    const functionId = this.state.functionId;
    const merged = { ...this.state.parameters, [path]: fieldValue };
    const def = functionId ? getFunctionDef(functionId) : null;
    const parameters = def
      ? normalizeFunctionParameters(functionId, merged)
      : normalizeActionParametersFromSchema(this._specs, merged);
    this.state = { functionId, parameters };
    if (this._persist) {
      try {
        await this._persist(functionId, path, parameters[path]);
      } catch {
        // persist failures are the caller's concern; keep local state
      }
    }
    this._emit();
    return this.state;
  }

  dispose() {
    this._disposed = true;
    this._listeners.clear();
    this._persist = null;
    this._specs = [];
  }
}

/**
 * @returns {ActionConfigController}
 */
export function createActionConfigController() {
  return new ActionConfigController();
}
