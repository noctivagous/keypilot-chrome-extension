/**
 * Onboarding walkthrough model: locale-neutral IDs, locale-scoped copy.
 *
 * XML lives at `onboarding/<locale>.xml`. Display strings may differ by locale;
 * slide IDs, task IDs, and `<when>` matching fields stay identical.
 */

import { getLocaleCandidates } from './i18n.js';
import { rewriteBacktickAltTokens } from './platform.js';

export const ONBOARDING_BASE_LOCALE = 'en';
export const ONBOARDING_MODEL_PATH = (locale) => `onboarding/${locale}.xml`;

/**
 * Parse a walkthrough XML document into the in-memory slide model.
 * Comment nodes are stripped so commented-out tasks are not loaded.
 * @param {string} xmlText
 * @returns {{ slides: Array<{
 *   id: string,
 *   title: string,
 *   bodyText: string,
 *   onEnter: Array<Record<string, string>>,
 *   tasks: Array<{
 *     id: string,
 *     label: string,
 *     when: { type: string, action: string, target: string, mode: string, change: string }
 *   }>
 * }> }}
 */
export function parseOnboardingXml(xmlText) {
  const xml = String(xmlText || '').replace(/<!--[\s\S]*?-->/g, '');
  const slides = [];

  const slideRe = /<slide\b([^>]*)>([\s\S]*?)<\/slide>/g;
  const taskRe = /<task\b([^>]*)>([\s\S]*?)<\/task>/g;
  const whenRe = /<when\b([^/>]*)\/>/g;
  const onEnterRe = /<onEnter\b([\s\S]*?)\/>/g;
  const bodyRe = /<body\b[^>]*>([\s\S]*?)<\/body>/i;
  const attrRe = /(\w+)\s*=\s*"([^"]*)"/g;

  const readAttrs = (raw) => {
    /** @type {Record<string, string>} */
    const attrs = {};
    if (!raw) return attrs;
    attrRe.lastIndex = 0;
    let match;
    while ((match = attrRe.exec(raw))) {
      const key = match[1];
      if (key) attrs[key] = match[2];
    }
    return attrs;
  };

  let slideMatch;
  while ((slideMatch = slideRe.exec(xml))) {
    const slideAttrs = readAttrs(slideMatch[1]);
    const slideBody = slideMatch[2] || '';
    const id = String(slideAttrs.id || '').trim();
    if (!id) continue;

    const title = rewriteBacktickAltTokens(String(slideAttrs.title || '').trim());
    const tasks = [];
    const onEnter = [];

    let bodyText = '';
    const bodyMatch = bodyRe.exec(slideBody);
    if (bodyMatch) bodyText = rewriteBacktickAltTokens(String(bodyMatch[1] || '').trim());
    bodyRe.lastIndex = 0;

    onEnterRe.lastIndex = 0;
    let onEnterMatch;
    while ((onEnterMatch = onEnterRe.exec(slideBody))) {
      const oeAttrs = readAttrs(onEnterMatch[1]);
      const type = String(oeAttrs.type || '').trim();
      if (!type) continue;
      const entry = { type };
      for (const [key, value] of Object.entries(oeAttrs)) {
        if (key === 'type') continue;
        entry[key] = rewriteBacktickAltTokens(value);
      }
      onEnter.push(entry);
    }

    taskRe.lastIndex = 0;
    let taskMatch;
    while ((taskMatch = taskRe.exec(slideBody))) {
      const taskAttrs = readAttrs(taskMatch[1]);
      const taskBody = taskMatch[2] || '';
      const taskId = String(taskAttrs.id || '').trim();
      if (!taskId) continue;

      let when = { type: '', action: '', target: '', mode: '', change: '' };
      whenRe.lastIndex = 0;
      const whenMatch = whenRe.exec(taskBody);
      if (whenMatch) {
        const wAttrs = readAttrs(whenMatch[1]);
        when = {
          type: String(wAttrs.type || '').trim(),
          action: String(wAttrs.action || '').trim(),
          target: String(wAttrs.target || '').trim(),
          mode: String(wAttrs.mode || '').trim(),
          change: String(wAttrs.change || '').trim()
        };
      }

      tasks.push({
        id: taskId,
        label: rewriteBacktickAltTokens(String(taskAttrs.label || '').trim()),
        when
      });
    }

    slides.push({ id, title, tasks, onEnter, bodyText });
  }

  return { slides };
}

/**
 * Stable matching signature used to compare locale models without copy.
 * @param {{ slides?: Array<any> }} model
 */
export function onboardingModelStructure(model) {
  return (model?.slides || []).map((slide) => ({
    id: slide.id,
    onEnter: (slide.onEnter || []).map((entry) => ({
      type: entry.type || '',
      secondaryAction: entry.secondaryAction || ''
    })),
    tasks: (slide.tasks || []).map((task) => ({
      id: task.id,
      when: {
        type: task.when?.type || '',
        action: task.when?.action || '',
        target: task.when?.target || '',
        mode: task.when?.mode || '',
        change: task.when?.change || ''
      }
    }))
  }));
}

/**
 * Fetch the first available localized walkthrough model.
 * @param {{
 *   uiLanguage?: string,
 *   fetchImpl?: typeof fetch,
 *   getURL?: (path: string) => string
 * }} [opts]
 * @returns {Promise<{ locale: string, model: ReturnType<typeof parseOnboardingXml> } | null>}
 */
export async function loadLocalizedOnboardingModel(opts = {}) {
  const fetchFn = opts.fetchImpl || globalThis.fetch;
  const getURL = opts.getURL || ((path) => chrome?.runtime?.getURL?.(path));
  if (typeof fetchFn !== 'function' || typeof getURL !== 'function') return null;

  for (const locale of getLocaleCandidates(opts.uiLanguage, ONBOARDING_BASE_LOCALE)) {
    try {
      const res = await fetchFn(getURL(ONBOARDING_MODEL_PATH(locale)));
      if (!res?.ok) continue;
      const model = parseOnboardingXml(await res.text());
      if (model.slides.length) return { locale, model };
    } catch {
      // Try the hyphen/underscore variant, base language, or English.
    }
  }
  return null;
}
