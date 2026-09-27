/**
 * Drive walkthrough <when> matchers. Keys come from the default built-in layout.
 */
import {
  BUILTIN_KEYBOARD_LAYOUTS,
  DEFAULT_KEYBOARD_LAYOUT_ID
} from '../../extension/src/config/keyboard-layouts.js';
import {
  box,
  CHROME_SELECTORS,
  clickSelector,
  hoverSelector,
  listPageTargets,
  onboardingState,
  overlayOpen,
  paintedTasks,
  pressKey,
  reconnectIfNeeded,
  sleep,
  waitUntil
} from './cdp.mjs';
import { whenKey } from './model.mjs';

const ACTION_TO_FUNCTION = {
  activate: 'ACTIVATE',
  back: 'BACK',
  activateNewTabBackground: 'ACTIVATE_NEW_TAB_BACKGROUND',
  activateNewTab: 'ACTIVATE_NEW_TAB',
  newTab: 'NEW_TAB',
  tabLeft: 'TAB_LEFT',
  tabRight: 'TAB_RIGHT',
  scrollDown: 'PAGE_DOWN_INSTANT',
  scrollUp: 'PAGE_UP_INSTANT',
  scrollBottom: 'PAGE_BOTTOM',
  scrollTop: 'PAGE_TOP'
};

function layoutAssignment(functionId) {
  const layout = BUILTIN_KEYBOARD_LAYOUTS[DEFAULT_KEYBOARD_LAYOUT_ID];
  const assignment = layout?.assignments?.[functionId];
  if (!assignment) {
    throw new Error(`Default layout ${DEFAULT_KEYBOARD_LAYOUT_ID} has no assignment for ${functionId}`);
  }
  const code = String(assignment.keys?.[0] || '');
  const key = String(assignment.displayKey || assignment.keyLabel || '').slice(0, 1).toLowerCase();
  if (!code) throw new Error(`Assignment ${functionId} has no physical code`);
  return { code, key: key || code.replace(/^Key/i, '').toLowerCase() };
}

async function pressLayoutAction(session, action) {
  const functionId = ACTION_TO_FUNCTION[action];
  if (!functionId) {
    throw new Error(`No layout mapping for onboarding action "${action}"`);
  }
  await pressKey(session, layoutAssignment(functionId));
}

async function waitTaskDone(session, taskId, timeoutMs = 15_000) {
  await waitUntil(async () => {
    const state = await onboardingState(session);
    if (state.completedTaskIds?.includes(String(taskId))) return true;
    const rows = await paintedTasks(session);
    return rows.some((row) => row.id === taskId && row.done);
  }, timeoutMs, `Task "${taskId}" did not complete`);
}

async function hoverPracticeLink(session) {
  const selector = (await box(session, CHROME_SELECTORS.practiceLink))?.visible
    ? CHROME_SELECTORS.practiceLink
    : CHROME_SELECTORS.practiceLink2;
  await hoverSelector(session, selector);
  await sleep(80);
}

const HANDLERS = {
  'action|activate|link||': async (session, task, ctx) => {
    await hoverPracticeLink(session);
    await pressLayoutAction(session, 'activate');
    try {
      await waitTaskDone(session, task.id, 8_000);
    } catch {
      await reconnectIfNeeded(session, ctx.port, ctx.origin);
      await waitTaskDone(session, task.id);
    }
  },
  'action|back|||': async (session, task, ctx) => {
    await pressLayoutAction(session, 'back');
    await reconnectIfNeeded(session, ctx.port, ctx.origin);
    await waitTaskDone(session, task.id);
  },
  'action|hover|keyboardHelpKey||': async (session, task) => {
    await hoverSelector(session, CHROME_SELECTORS.keyboardKeyAny);
    await sleep(200);
    await waitTaskDone(session, task.id);
  },
  'action|toggleExtension|||off': async (session, task) => {
    await clickSelector(session, CHROME_SELECTORS.controlStripStatus);
    await waitUntil(
      async () => {
        const state = await onboardingState(session).catch(() => ({}));
        if (state.completedTaskIds?.includes(String(task.id))) return true;
        const tip = await box(session, CHROME_SELECTORS.reenableTip);
        return Boolean(tip?.visible);
      },
      12_000,
      'Extension did not turn off / re-enable tip missing'
    );
    await waitUntil(
      async () => {
        const tip = await box(session, CHROME_SELECTORS.reenableTip);
        return Boolean(tip?.visible);
      },
      8_000,
      'Re-enable tip did not appear'
    );
    await clickSelector(session, CHROME_SELECTORS.controlStripStatus);
    await waitTaskDone(session, task.id);
  },
  'mode|||text_focus|enter': async (session, task) => {
    await hoverSelector(session, CHROME_SELECTORS.practiceField);
    await pressLayoutAction(session, 'activate');
    await waitTaskDone(session, task.id);
  },
  'mode|||text_focus|exit': async (session, task) => {
    await pressKey(session, { key: 'Escape', code: 'Escape' });
    await waitTaskDone(session, task.id);
  },
  'action|scrollDown|||': async (session, task) => {
    await pressLayoutAction(session, 'scrollDown');
    await waitTaskDone(session, task.id);
  },
  'action|scrollUp|||': async (session, task) => {
    await pressLayoutAction(session, 'scrollUp');
    await waitTaskDone(session, task.id);
  },
  'action|scrollBottom|||': async (session, task) => {
    await pressLayoutAction(session, 'scrollBottom');
    await waitTaskDone(session, task.id);
  },
  'action|scrollTop|||': async (session, task) => {
    await pressLayoutAction(session, 'scrollTop');
    await waitTaskDone(session, task.id);
  },
  'action|activateNewTabBackground|link||': async (session, task, ctx) => {
    const before = (await listPageTargets(ctx.port)).length;
    await hoverPracticeLink(session);
    await pressLayoutAction(session, 'activateNewTabBackground');
    await waitUntil(
      async () => (await listPageTargets(ctx.port)).length > before,
      10_000,
      'Background tab did not open'
    );
    await waitTaskDone(session, task.id);
  },
  'action|activateNewTab|link||': async (session, task, ctx) => {
    await hoverPracticeLink(session);
    await pressLayoutAction(session, 'activateNewTab');
    await waitTaskDone(session, task.id);
  },
  'action|newTab|||': async (session, task) => {
    await pressLayoutAction(session, 'newTab');
    await waitTaskDone(session, task.id);
  },
  'action|tabLeft|||': async (session, task) => {
    await pressLayoutAction(session, 'tabLeft');
    await waitTaskDone(session, task.id);
  },
  'action|tabRight|||': async (session, task) => {
    await pressLayoutAction(session, 'tabRight');
    await waitTaskDone(session, task.id);
  }
};

export async function dismissOverlayIfOpen(session) {
  const open = await overlayOpen(session);
  if (!open) return;
  await clickSelector(session, CHROME_SELECTORS.overlayPrimary);
  await waitUntil(async () => !(await overlayOpen(session)), 10_000, 'Onboarding overlay did not dismiss');
}

export async function runWhenHandler(session, task, ctx) {
  const key = whenKey(task.when);
  const handler = HANDLERS[key];
  if (!handler) {
    throw new Error(`No UI-flow handler for when "${key}" (task ${task.id})`);
  }
  await handler(session, task, ctx);
}
