import { before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { installChromeMock, resetChromeMock } from './helpers/chrome-mock.js';

let mock;

before(() => {
  mock = installChromeMock();
});

beforeEach(() => {
  resetChromeMock(mock);
});

describe('deferred opening queue', () => {
  it('chooses a delay inside the normalized 1 minute to 48 hour range', async () => {
    const {
      createDeferredOpenJob,
      randomDeferredDelayMs
    } = await import('../extension/src/utils/deferred-open.js');

    assert.equal(randomDeferredDelayMs(0, 9999, () => 0), 60_000);
    assert.equal(randomDeferredDelayMs(0, 9999, () => 1), 2_880 * 60_000);

    const job = createDeferredOpenJob({
      action: 'OPEN_URLS',
      payload: { urls: ['https://example.com'] },
      minMinutes: 10,
      maxMinutes: 20,
      target: 'activeWindow'
    }, { now: 1_000, random: () => 0.5, id: 'job-1' });
    assert.equal(job.id, 'job-1');
    assert.ok(job.fireAt >= 1_000 + 10 * 60_000);
    assert.ok(job.fireAt <= 1_000 + 20 * 60_000);
  });

  it('converts between local datetime-local values and epoch milliseconds', async () => {
    const {
      defaultManualFireAt,
      formatDateTimeLocalValue,
      isValidManualFireAt,
      parseDateTimeLocalValue,
      randomScheduleIsSilent,
      shiftLocalFireAt,
      tomorrowMorningFireAt
    } = await import('../extension/src/utils/deferred-open.js');

    const local = new Date(2030, 5, 15, 9, 5, 0, 0).getTime();
    assert.equal(formatDateTimeLocalValue(local), '2030-06-15T09:05');
    assert.equal(parseDateTimeLocalValue('2030-06-15T09:05'), local);

    for (const bad of ['', 'nope', '2030-06-15', '2030-02-31T10:00', '2030-13-01T10:00', '2030-06-15T25:00']) {
      assert.ok(Number.isNaN(parseDateTimeLocalValue(bad)), bad);
    }
    assert.equal(formatDateTimeLocalValue(Number.NaN), '');

    const now = new Date(2030, 0, 1, 12, 0, 30, 0).getTime();
    const suggested = defaultManualFireAt(now);
    assert.equal(suggested % 60_000, 0);
    assert.ok(suggested >= now + 3_600_000 && suggested < now + 3_600_000 + 60_000);
    assert.equal(parseDateTimeLocalValue(formatDateTimeLocalValue(suggested)), suggested);

    assert.equal(isValidManualFireAt(now + 1, now), true);
    assert.equal(isValidManualFireAt(now, now), false);
    assert.equal(isValidManualFireAt(now - 1, now), false);
    assert.equal(isValidManualFireAt(Number.NaN, now), false);
    assert.equal(isValidManualFireAt('9999999999999', now), false);

    assert.equal(randomScheduleIsSilent({ minMinutes: 1, maxMinutes: 60 }, true), true);
    assert.equal(randomScheduleIsSilent({ minMinutes: 1, maxMinutes: 60 }, undefined), true);
    assert.equal(randomScheduleIsSilent({ minMinutes: 1, maxMinutes: 60 }, false), false);
    assert.equal(randomScheduleIsSilent({ fireAt: now + 60_000 }, true), false);

    const morningNow = new Date(2030, 2, 4, 14, 30, 0, 0).getTime();
    const shiftedHour = shiftLocalFireAt(morningNow, { hours: 1 });
    assert.equal(shiftedHour, new Date(2030, 2, 4, 15, 30, 0, 0).getTime());
    const shiftedDay = shiftLocalFireAt(morningNow, { days: 1 });
    assert.equal(shiftedDay, new Date(2030, 2, 5, 14, 30, 0, 0).getTime());
    assert.equal(shiftLocalFireAt(shiftedHour, { hours: 1 }), new Date(2030, 2, 4, 16, 30, 0, 0).getTime());

    const morning = tomorrowMorningFireAt(morningNow);
    const expected = new Date(2030, 2, 5, 9, 0, 0, 0).getTime();
    assert.equal(morning, expected);
    assert.ok(morning > morningNow);
  });

  it('schedules an exact future fireAt without randomizing it and rejects past times', async () => {
    const {
      DEFERRED_OPEN_STORAGE_KEY,
      createDeferredOpenJob,
      deferredOpenAlarmName,
      persistDeferredOpenJob
    } = await import('../extension/src/utils/deferred-open.js');

    const now = 1_000_000;
    const fireAt = now + 5 * 24 * 60 * 60_000;
    const job = createDeferredOpenJob({
      action: 'OPEN_URLS',
      payload: { urls: ['https://example.com'] },
      fireAt,
      target: 'originalWindow',
      originalWindowId: 7
    }, { now, id: 'exact-job', random: () => 0.99 });
    assert.equal(job.fireAt, fireAt);
    assert.equal(job.createdAt, now);
    assert.equal(job.target, 'originalWindow');
    assert.equal(job.originalWindowId, 7);

    for (const bad of [now, now - 1, Number.NaN, '5000000']) {
      assert.throws(() => createDeferredOpenJob({
        action: 'OPEN_URLS',
        payload: { urls: ['https://example.com'] },
        fireAt: bad,
        target: 'activeWindow'
      }, { now }), /future timestamp/);
    }
    assert.equal(mock.localStore.get(DEFERRED_OPEN_STORAGE_KEY), undefined);

    const persistable = createDeferredOpenJob({
      action: 'RANDOM_BOOKMARK',
      payload: { folderId: '', count: 2 },
      fireAt: Date.now() + 3 * 24 * 60 * 60_000,
      target: 'activeWindow'
    }, { id: 'exact-persisted' });
    await persistDeferredOpenJob(persistable);
    assert.deepEqual(mock.localStore.get(DEFERRED_OPEN_STORAGE_KEY), [persistable]);
    assert.ok(mock.alarmStore.has(deferredOpenAlarmName(persistable.id)));
  });

  it('persists jobs and restores their alarms after a worker restart', async () => {
    const {
      DEFERRED_OPEN_STORAGE_KEY,
      createDeferredOpenJob,
      deferredOpenAlarmName,
      persistDeferredOpenJob,
      restoreDeferredOpenAlarms
    } = await import('../extension/src/utils/deferred-open.js');

    const job = createDeferredOpenJob({
      action: 'RANDOM_BOOKMARK',
      payload: { folderId: '', count: 1 },
      minMinutes: 1,
      maxMinutes: 1,
      target: 'activeWindow'
    }, { now: Date.now(), id: 'durable-job' });
    await persistDeferredOpenJob(job);

    assert.deepEqual(mock.localStore.get(DEFERRED_OPEN_STORAGE_KEY), [job]);
    assert.ok(mock.alarmStore.has(deferredOpenAlarmName(job.id)));
    mock.alarmStore.clear();
    assert.equal(await restoreDeferredOpenAlarms(), 1);
    assert.ok(mock.alarmStore.has(deferredOpenAlarmName(job.id)));
  });

  it('removes completed jobs and retries jobs with no eligible window', async () => {
    const {
      DEFERRED_OPEN_STORAGE_KEY,
      createDeferredOpenJob,
      deferredOpenAlarmName,
      handleDeferredOpenAlarm,
      persistDeferredOpenJob
    } = await import('../extension/src/utils/deferred-open.js');

    const completed = createDeferredOpenJob({
      action: 'OPEN_URLS',
      payload: { urls: ['https://example.com'] },
      minMinutes: 1,
      maxMinutes: 1,
      target: 'activeWindow'
    }, { now: Date.now(), id: 'completed-job' });
    await persistDeferredOpenJob(completed);
    assert.equal(
      await handleDeferredOpenAlarm(deferredOpenAlarmName(completed.id), async () => true),
      true
    );
    assert.deepEqual(mock.localStore.get(DEFERRED_OPEN_STORAGE_KEY), []);

    const retry = { ...completed, id: 'retry-job' };
    await persistDeferredOpenJob(retry);
    assert.equal(
      await handleDeferredOpenAlarm(deferredOpenAlarmName(retry.id), async () => false),
      false
    );
    const queued = mock.localStore.get(DEFERRED_OPEN_STORAGE_KEY);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].id, retry.id);
    assert.ok(queued[0].fireAt > Date.now());
  });
});
