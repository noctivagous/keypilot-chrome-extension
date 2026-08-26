import { before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { installChromeMock, resetChromeMock } from './helpers/chrome-mock.js';

/** @type {ReturnType<typeof installChromeMock>} */
let mock;

before(() => {
  mock = installChromeMock({ isMac: false });
});

beforeEach(() => {
  resetChromeMock(mock);
});

const SAMPLE_PARAMETERS = Object.freeze([
  { id: 'enabled', label: 'On', type: 'boolean', defaultValue: false },
  {
    id: 'mode',
    label: 'Mode',
    type: 'enum',
    defaultValue: 'element',
    options: [
      { id: 'element', label: 'Element' },
      { id: 'cumulative', label: 'Cumulative' }
    ]
  },
  { id: 'count', label: 'Count', type: 'number', defaultValue: 3, min: 1, max: 10, step: 1 },
  { id: 'format', label: 'Format', type: 'enum', defaultValue: 'plain', options: [{ id: 'plain', label: 'Plain' }, { id: 'rich', label: 'Rich' }] },
  { id: 'note', label: 'Note', type: 'string', defaultValue: '', placeholder: 'hint' },
  { id: 'script', label: 'Script', type: 'string', multiline: true, defaultValue: '//', rows: 6, group: 'Callbacks' }
]);

describe('action-config-schema', () => {
  it('maps range, select/enum, radio, toggle, and action-parameter controls', async () => {
    const {
      ACTION_RADIO_PARAMETER_IDS,
      buildActionControlSchema,
      controlTypeForParameter,
      normalizeControlValue
    } = await import('../extension/src/modules/action-config-schema.js');

    assert.equal(controlTypeForParameter({ type: 'boolean' }), 'toggle');
    assert.equal(controlTypeForParameter({ type: 'number' }), 'range');
    assert.equal(controlTypeForParameter({ type: 'enum', id: 'mode' }), 'enum');
    assert.equal(
      controlTypeForParameter({ type: 'enum', id: 'mode' }, { radioParamIds: ACTION_RADIO_PARAMETER_IDS }),
      'radio'
    );
    assert.equal(controlTypeForParameter({ type: 'string', multiline: true }), 'textarea');
    assert.equal(controlTypeForParameter({ type: 'string' }), 'text');

    const schema = buildActionControlSchema(SAMPLE_PARAMETERS, {
      radioParamIds: ACTION_RADIO_PARAMETER_IDS
    });
    const byPath = Object.fromEntries(schema.map((s) => [s.path, s]));
    assert.equal(byPath.enabled.type, 'toggle');
    assert.equal(byPath.mode.type, 'radio');
    assert.equal(byPath.mode.widget, 'radio');
    assert.equal(byPath.count.type, 'range');
    assert.equal(byPath.format.type, 'radio');
    assert.equal(byPath.note.type, 'text');
    assert.equal(byPath.script.type, 'textarea');
    assert.equal(byPath.script.group, 'Callbacks');

    assert.equal(normalizeControlValue(byPath.mode, 'nope'), 'element');
    assert.equal(normalizeControlValue(byPath.mode, 'cumulative'), 'cumulative');
    assert.equal(normalizeControlValue(byPath.count, '99'), 10);
    assert.equal(normalizeControlValue(byPath.count, 'abc'), 3);
    assert.equal(normalizeControlValue(byPath.enabled, 'yes'), true);
    assert.equal(normalizeControlValue(byPath.note, 12), '12');
  });

  it('groups consecutive specs that share a group label', async () => {
    const { buildActionControlSchema, groupActionControlSpecs } =
      await import('../extension/src/modules/action-config-schema.js');
    const schema = buildActionControlSchema(SAMPLE_PARAMETERS);
    const groups = groupActionControlSpecs(schema);
    assert.equal(groups[0].group, '');
    assert.ok(groups[0].specs.length >= 5);
    assert.equal(groups[groups.length - 1].group, 'Callbacks');
    assert.deepEqual(groups[groups.length - 1].specs.map((s) => s.path), ['script']);
  });
});

describe('ActionConfigController', () => {
  it('loads Function-library defaults and normalizes updates through the catalog SSOT', async () => {
    const { createActionConfigController } =
      await import('../extension/src/modules/action-config-controller.js');
    const { defaultFunctionParameters } =
      await import('../extension/src/config/function-library.js');

    const seen = [];
    const persisted = [];
    const c = createActionConfigController();
    c.subscribe((s) => seen.push({ ...s.parameters }));

    await c.load({
      functionId: 'RECTANGLE_HIGHLIGHT',
      snapshot: { mode: 'bogus' },
      persist: (functionId, paramId, value) => {
        persisted.push({ functionId, paramId, value });
      }
    });
    assert.equal(c.state.parameters.mode, 'element');
    assert.deepEqual(c.state.parameters, defaultFunctionParameters('RECTANGLE_HIGHLIGHT'));
    assert.equal(persisted.length, 0);

    await c.update('mode', 'cumulative');
    assert.equal(c.state.parameters.mode, 'cumulative');
    await c.update('mode', 'not-a-mode');
    assert.equal(c.state.parameters.mode, 'element');
    assert.equal(persisted.length, 2);
    assert.equal(persisted[0].value, 'cumulative');
    assert.ok(seen.some((p) => p.mode === 'cumulative'));

    c.dispose();
    await c.update('mode', 'cumulative');
    assert.equal(c.state.parameters.mode, 'element');
    assert.equal(c.disposed, true);
  });

  it('builds TYPE_CHARACTERS / COPY_HOVERED_IMAGE action-parameter schema', async () => {
    const { createActionConfigController } =
      await import('../extension/src/modules/action-config-controller.js');

    const typeChars = createActionConfigController();
    typeChars.load({ functionId: 'TYPE_CHARACTERS' });
    const textSpec = typeChars.schema().find((s) => s.path === 'text');
    assert.ok(textSpec);
    assert.equal(textSpec.type, 'textarea');
    await typeChars.update('text', 'hello');
    assert.equal(typeChars.state.parameters.text, 'hello');
    typeChars.dispose();

    const copyImage = createActionConfigController();
    copyImage.load({ functionId: 'COPY_HOVERED_IMAGE' });
    const paths = copyImage.schema().map((s) => `${s.path}:${s.type}`);
    assert.ok(paths.includes('destination:enum'));
    await copyImage.update('destination', 'not-real');
    assert.equal(
      copyImage.state.parameters.destination,
      copyImage.schema().find((s) => s.path === 'destination').defaultValue
    );
    copyImage.dispose();
  });

  it('normalizes synthetic (catalog-free) parameter snapshots', async () => {
    const { createActionConfigController } =
      await import('../extension/src/modules/action-config-controller.js');
    const c = createActionConfigController();
    c.load({
      functionId: '',
      parameters: SAMPLE_PARAMETERS,
      snapshot: { enabled: 1, mode: 'nope', count: 50 }
    });
    assert.equal(c.state.parameters.enabled, true);
    assert.equal(c.state.parameters.mode, 'element');
    assert.equal(c.state.parameters.count, 10);
    await c.update('count', 2);
    assert.equal(c.state.parameters.count, 2);
    c.dispose();
  });
});
