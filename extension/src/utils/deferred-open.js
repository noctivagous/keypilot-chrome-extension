export const DEFERRED_OPEN_STORAGE_KEY = 'kp_deferred_open_jobs_v1';
export const DEFERRED_OPEN_ALARM_PREFIX = 'kp-deferred-open:';
export const DEFERRED_OPEN_RETRY_MS = 60 * 1000;
export const DEFERRED_OPEN_MIN_MINUTES = 1;
export const DEFERRED_OPEN_MAX_MINUTES = 48 * 60;

let mutationQueue = Promise.resolve();

const DATE_TIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function pad2(value) {
  return String(value).padStart(2, '0');
}

/**
 * Format epoch milliseconds as the local value expected by `<input type="datetime-local">`.
 * @param {number} ms
 * @returns {string}
 */
export function formatDateTimeLocalValue(ms) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
    + `T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * Parse a `datetime-local` value as local time. Returns NaN for malformed or
 * non-existent dates (for example 2026-02-31 or a skipped DST hour).
 * @param {unknown} value
 * @returns {number}
 */
export function parseDateTimeLocalValue(value) {
  const match = DATE_TIME_LOCAL_RE.exec(String(value || '').trim());
  if (!match) return NaN;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute) {
    return NaN;
  }
  return date.getTime();
}

/**
 * Default manual schedule: one hour from now, rounded up to the next whole minute.
 * @param {number} [now]
 * @returns {number}
 */
export function defaultManualFireAt(now = Date.now()) {
  return Math.ceil((now + 60 * 60 * 1000) / 60_000) * 60_000;
}

/**
 * Local time tomorrow at `hour`:00, for the "Tomorrow morning" quick-pick chip.
 * @param {number} [now]
 * @param {number} [hour]
 * @returns {number}
 */
export function tomorrowMorningFireAt(now = Date.now(), hour = 9) {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
}

/**
 * Move a local date/time by whole hours and calendar days.
 * Hours and days are applied on the local clock, so a DST change does not
 * shrink or stretch the result the way a fixed millisecond offset would.
 * @param {number} ms
 * @param {{ hours?: number, days?: number }} [delta]
 * @returns {number}
 */
export function shiftLocalFireAt(ms, { hours = 0, days = 0 } = {}) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return NaN;
  if (days) date.setDate(date.getDate() + days);
  if (hours) date.setHours(date.getHours() + hours);
  return date.getTime();
}

/**
 * A manual schedule must be a finite timestamp strictly after `now`.
 * @param {unknown} fireAt
 * @param {number} [now]
 * @returns {boolean}
 */
export function isValidManualFireAt(fireAt, now = Date.now()) {
  return typeof fireAt === 'number' && Number.isFinite(fireAt) && fireAt > now;
}

/**
 * Random Alt+Shift scheduling stays quiet when the shared setting is on.
 * An exact `fireAt` from the dialog always confirms out loud. A missing
 * setting is silent, matching the default.
 * @param {{ fireAt?: number }|null|undefined} schedule
 * @param {boolean|undefined} silentRandomScheduling
 * @returns {boolean}
 */
export function randomScheduleIsSilent(schedule, silentRandomScheduling) {
  if (schedule?.fireAt !== undefined) return false;
  return silentRandomScheduling !== false;
}

export function normalizeDeferredDelayRange(minMinutes, maxMinutes) {
  const clamp = (raw, fallback) => {
    const value = Number(raw);
    const finite = Number.isFinite(value) ? value : fallback;
    return Math.min(DEFERRED_OPEN_MAX_MINUTES, Math.max(DEFERRED_OPEN_MIN_MINUTES, finite));
  };
  const min = clamp(minMinutes, DEFERRED_OPEN_MIN_MINUTES);
  const max = clamp(maxMinutes, min);
  return {
    minMinutes: Math.min(min, max),
    maxMinutes: Math.max(min, max)
  };
}

export function randomDeferredDelayMs(minMinutes, maxMinutes, random = Math.random) {
  const range = normalizeDeferredDelayRange(minMinutes, maxMinutes);
  const minMs = Math.round(range.minMinutes * 60 * 1000);
  const maxMs = Math.round(range.maxMinutes * 60 * 1000);
  if (maxMs <= minMs) return minMs;
  const ratio = Math.min(1, Math.max(0, Number(random()) || 0));
  return minMs + Math.round(ratio * (maxMs - minMs));
}

/**
 * Build a persisted job. `input.fireAt` schedules at that exact future time;
 * otherwise the time is randomized from `minMinutes`..`maxMinutes`.
 * @throws {Error} when an exact `fireAt` is not in the future
 */
export function createDeferredOpenJob(input, opts = {}) {
  const now = Number(opts.now) || Date.now();
  let fireAt;
  if (input.fireAt !== undefined) {
    if (!isValidManualFireAt(input.fireAt, now)) {
      throw new Error('Deferred open fireAt must be a future timestamp');
    }
    fireAt = input.fireAt;
  } else {
    fireAt = now + randomDeferredDelayMs(input.minMinutes, input.maxMinutes, opts.random);
  }
  const id = opts.id || `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    action: input.action,
    payload: input.payload,
    target: input.target === 'originalWindow' ? 'originalWindow' : 'activeWindow',
    originalWindowId: Number.isInteger(input.originalWindowId) ? input.originalWindowId : null,
    createdAt: now,
    fireAt
  };
}

export function deferredOpenAlarmName(jobId) {
  return `${DEFERRED_OPEN_ALARM_PREFIX}${jobId}`;
}

export function deferredOpenJobIdFromAlarm(name) {
  const value = String(name || '');
  return value.startsWith(DEFERRED_OPEN_ALARM_PREFIX)
    ? value.slice(DEFERRED_OPEN_ALARM_PREFIX.length)
    : '';
}

export async function readDeferredOpenJobs() {
  const stored = await chrome.storage.local.get(DEFERRED_OPEN_STORAGE_KEY);
  const jobs = stored?.[DEFERRED_OPEN_STORAGE_KEY];
  return Array.isArray(jobs) ? jobs.filter((job) => job && typeof job.id === 'string') : [];
}

async function writeDeferredOpenJobs(jobs) {
  await chrome.storage.local.set({ [DEFERRED_OPEN_STORAGE_KEY]: jobs });
}

function serializeMutation(work) {
  const next = mutationQueue.then(work, work);
  mutationQueue = next.catch(() => {});
  return next;
}

export async function persistDeferredOpenJob(job) {
  return serializeMutation(async () => {
    const jobs = await readDeferredOpenJobs();
    const next = [...jobs.filter((entry) => entry.id !== job.id), job];
    await writeDeferredOpenJobs(next);
    await chrome.alarms.create(deferredOpenAlarmName(job.id), { when: job.fireAt });
    return job;
  });
}

export async function restoreDeferredOpenAlarms() {
  const jobs = await readDeferredOpenJobs();
  const now = Date.now();
  await Promise.all(jobs.map((job) => chrome.alarms.create(
    deferredOpenAlarmName(job.id),
    { when: Math.max(now, Number(job.fireAt) || now) }
  )));
  return jobs.length;
}

export async function handleDeferredOpenAlarm(alarmName, executeJob) {
  const jobId = deferredOpenJobIdFromAlarm(alarmName);
  if (!jobId) return false;
  return serializeMutation(async () => {
    const jobs = await readDeferredOpenJobs();
    const job = jobs.find((entry) => entry.id === jobId);
    if (!job) return true;

    let completed = false;
    try {
      completed = (await executeJob(job)) === true;
    } catch (error) {
      console.warn('[KeyPilot] Deferred open failed; retrying:', error?.message || error);
    }

    if (completed) {
      await writeDeferredOpenJobs(jobs.filter((entry) => entry.id !== jobId));
      return true;
    }

    const retryJob = { ...job, fireAt: Date.now() + DEFERRED_OPEN_RETRY_MS };
    await writeDeferredOpenJobs(jobs.map((entry) => entry.id === jobId ? retryJob : entry));
    await chrome.alarms.create(deferredOpenAlarmName(jobId), { when: retryJob.fireAt });
    return false;
  });
}
