/**
 * Load the walkthrough model with the same parser production uses.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseOnboardingXml } from '../../extension/src/utils/onboarding-model.js';
import { repoRoot } from './launch.mjs';

export function loadWalkthroughModel(locale = 'en') {
  const xmlPath = path.join(repoRoot, 'extension', 'onboarding', `${locale}.xml`);
  const xml = fs.readFileSync(xmlPath, 'utf8');
  return parseOnboardingXml(xml);
}

export function whenKey(when = {}) {
  return [
    String(when.type || ''),
    String(when.action || ''),
    String(when.target || ''),
    String(when.mode || ''),
    String(when.change || '')
  ].join('|');
}
