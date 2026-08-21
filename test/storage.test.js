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

describe('storageGetValue', () => {
  it('returns sync value when only sync has the key', async () => {
    const { storageGetValue } = await import('../extension/src/utils/storage.js');
    mock.seed('k', { v: 1 }, 'sync');
    assert.deepEqual(await storageGetValue('k', null), { v: 1 });
  });

  it('falls back to local when sync is empty', async () => {
    const { storageGetValue } = await import('../extension/src/utils/storage.js');
    mock.seed('k', { v: 2 }, 'local');
    assert.deepEqual(await storageGetValue('k', null), { v: 2 });
  });

  it('falls back to local when sync throws', async () => {
    const { storageGetValue } = await import('../extension/src/utils/storage.js');
    mock.seed('k', { v: 3 }, 'local');
    mock.setSyncThrows(true);
    assert.deepEqual(await storageGetValue('k', null), { v: 3 });
  });

  it('picks the newer _updatedAt when both areas have the key', async () => {
    const { storageGetValue } = await import('../extension/src/utils/storage.js');
    mock.seed('k', { name: 'sync', _updatedAt: 100 }, 'sync');
    mock.seed('k', { name: 'local', _updatedAt: 200 }, 'local');
    assert.equal((await storageGetValue('k')).name, 'local');

    mock.seed('k', { name: 'sync', _updatedAt: 300 }, 'sync');
    assert.equal((await storageGetValue('k')).name, 'sync');
  });

  it('returns default when both areas fail or are empty', async () => {
    const { storageGetValue } = await import('../extension/src/utils/storage.js');
    mock.setSyncThrows(true);
    mock.setLocalThrows(true);
    assert.equal(await storageGetValue('missing', 'fallback'), 'fallback');
  });

  it('returns default for invalid keys', async () => {
    const { storageGetValue } = await import('../extension/src/utils/storage.js');
    assert.equal(await storageGetValue('', 'd'), 'd');
    assert.equal(await storageGetValue(null, 'd'), 'd');
  });
});

describe('storageGetKeys', () => {
  it('prefers sync per key and falls back to local when no _updatedAt', async () => {
    const { storageGetKeys } = await import('../extension/src/utils/storage.js');
    mock.seed('a', 1, 'sync');
    mock.seed('b', 2, 'local');
    mock.seed('c', 3, 'sync');
    mock.seed('c', 99, 'local');
    assert.deepEqual(await storageGetKeys(['a', 'b', 'c', 'd']), { a: 1, b: 2, c: 3 });
  });

  it('applies the same _updatedAt newer-wins rule as storageGetValue', async () => {
    const { storageGetKeys, storageGetValue } = await import('../extension/src/utils/storage.js');
    mock.seed('k', { name: 'sync', _updatedAt: 100 }, 'sync');
    mock.seed('k', { name: 'local', _updatedAt: 200 }, 'local');
    const viaKeys = await storageGetKeys(['k']);
    const viaValue = await storageGetValue('k');
    assert.equal(viaKeys.k.name, 'local');
    assert.deepEqual(viaKeys.k, viaValue);

    mock.seed('k', { name: 'sync', _updatedAt: 300 }, 'sync');
    assert.equal((await storageGetKeys(['k'])).k.name, 'sync');
  });

  it('returns {} for empty or invalid key lists', async () => {
    const { storageGetKeys } = await import('../extension/src/utils/storage.js');
    assert.deepEqual(await storageGetKeys([]), {});
    assert.deepEqual(await storageGetKeys(null), {});
  });

  it('omits keys when both areas fail', async () => {
    const { storageGetKeys } = await import('../extension/src/utils/storage.js');
    mock.seed('k', { v: 1 }, 'sync');
    mock.setSyncThrows(true);
    mock.setLocalThrows(true);
    assert.deepEqual(await storageGetKeys(['k']), {});
  });
});

describe('storageSetValue', () => {
  it('writes sync and returns true without dualWrite', async () => {
    const { storageSetValue } = await import('../extension/src/utils/storage.js');
    assert.equal(await storageSetValue('k', { ok: true }), true);
    assert.deepEqual(mock.syncStore.get('k'), { ok: true });
    assert.equal(mock.localStore.has('k'), false);
  });

  it('dual-writes local after successful sync', async () => {
    const { storageSetValue } = await import('../extension/src/utils/storage.js');
    assert.equal(await storageSetValue('k', { ok: true }, { dualWrite: true }), true);
    assert.deepEqual(mock.syncStore.get('k'), { ok: true });
    assert.deepEqual(mock.localStore.get('k'), { ok: true });
  });

  it('falls back to local when sync set throws', async () => {
    const { storageSetValue } = await import('../extension/src/utils/storage.js');
    mock.setSyncThrows(true);
    assert.equal(await storageSetValue('k', { ok: true }), true);
    assert.equal(mock.syncStore.has('k'), false);
    assert.deepEqual(mock.localStore.get('k'), { ok: true });
  });

  it('returns true when dualWrite sync succeeds but local fails (partial failure)', async () => {
    const { storageSetValue } = await import('../extension/src/utils/storage.js');
    mock.setLocalThrows(true);
    assert.equal(await storageSetValue('k', { ok: true }, { dualWrite: true }), true);
    assert.deepEqual(mock.syncStore.get('k'), { ok: true });
    assert.equal(mock.localStore.has('k'), false);
  });

  it('returns false when both areas fail', async () => {
    const { storageSetValue } = await import('../extension/src/utils/storage.js');
    mock.setSyncThrows(true);
    mock.setLocalThrows(true);
    assert.equal(await storageSetValue('k', { ok: true }), false);
  });

  it('writes sibling timestamp key when includeTimestamp is set', async () => {
    const { storageSetValue } = await import('../extension/src/utils/storage.js');
    assert.equal(await storageSetValue('k', true, { includeTimestamp: true }), true);
    assert.equal(mock.syncStore.get('k'), true);
    assert.equal(typeof mock.syncStore.get('timestamp'), 'number');
  });
});
