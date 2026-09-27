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
  clickPoint,
  clickSelector,
  evaluate,
  hoverSelector,
  listPageTargets,
  onboardingState,
  overlayOpen,
  pageHref,
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

async function recover(session, ctx) {
  if (!ctx?.port) return session;
  return reconnectIfNeeded(session, ctx.port, ctx.origin);
}

async function waitTaskDone(session, taskId, ctx, timeoutMs = 15_000) {
  await waitUntil(async () => {
    try {
      const state = await onboardingState(session);
      if (state.completedTaskIds?.includes(String(taskId))) return true;
      const rows = await paintedTasks(session);
      return rows.some((row) => row.id === taskId && row.done);
    } catch (error) {
      if (/context/i.test(String(error.message || error))) {
        await recover(session, ctx);
        return false;
      }
      throw error;
    }
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
    await waitUntil(async () => {
      try {
        await recover(session, ctx);
        return /next\.html/.test(await pageHref(session));
      } catch {
        return false;
      }
    }, 8_000, 'F-click did not navigate to next.html');
    await settlePage(session, ctx);
    await waitTaskDone(session, task.id, ctx);
  },
  'action|back|||': async (session, task, ctx) => {
    await settlePage(session, ctx);
    await clickPoint(session, 640, 420);
    await pressLayoutAction(session, 'back');
    await settlePage(session, ctx);
    await waitTaskDone(session, task.id, ctx);
  },
  'action|hover|keyboardHelpKey||': async (session, task, ctx) => {
    await hoverSelector(session, CHROME_SELECTORS.keyboardKeyAny);
    await sleep(200);
    await waitTaskDone(session, task.id, ctx);
  },
  'action|toggleExtension|||off': async (session, task, ctx) => {
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
    await waitTaskDone(session, task.id, ctx);
  },
  'mode|||text_focus|enter': async (session, task, ctx) => {
    await hoverSelector(session, CHROME_SELECTORS.practiceField);
    await sleep(250);
    await pressLayoutAction(session, 'activate');
    await waitTaskDone(session, task.id, ctx);
  },
  'mode|||text_focus|exit': async (session, task, ctx) => {
    await pressKey(session, { key: 'Escape', code: 'Escape' });
    await waitTaskDone(session, task.id, ctx);
  },
  'action|scrollDown|||': async (session, task, ctx) => {
    await pressLayoutAction(session, 'scrollDown');
    await waitTaskDone(session, task.id, ctx);
  },
  'action|scrollUp|||': async (session, task, ctx) => {
    await pressLayoutAction(session, 'scrollUp');
    await waitTaskDone(session, task.id, ctx);
  },
  'action|scrollBottom|||': async (session, task, ctx) => {
    await pressLayoutAction(session, 'scrollBottom');
    await waitTaskDone(session, task.id, ctx);
  },
  'action|scrollTop|||': async (session, task, ctx) => {
    await pressLayoutAction(session, 'scrollTop');
    await waitTaskDone(session, task.id, ctx);
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
    await waitTaskDone(session, task.id, ctx);
  },
  'action|activateNewTab|link||': async (session, task, ctx) => {
    await hoverPracticeLink(session);
    await pressLayoutAction(session, 'activateNewTab');
    await waitTaskDone(session, task.id, ctx);
  },
  'action|newTab|||': async (session, task, ctx) => {
    await pressLayoutAction(session, 'newTab');
    await waitTaskDone(session, task.id, ctx);
  },
  'action|tabLeft|||': async (session, task, ctx) => {
    await pressLayoutAction(session, 'tabLeft');
    await waitTaskDone(session, task.id, ctx);
  },
  'action|tabRight|||': async (session, task, ctx) => {
    await pressLayoutAction(session, 'tabRight');
    await waitTaskDone(session, task.id, ctx);
  }
};

export async function dismissOverlayIfOpen(session) {
  const clicked = await evaluate(
    session.client,
    'window.__KP_UI_FLOW.clickOverlayPrimary()',
    false,
    session.contextId
  ).catch(() => false);
  if (!clicked) {
    const open = await overlayOpen(session).catch(() => false);
    if (!open) return;
    await clickSelector(session, CHROME_SELECTORS.overlayPrimary);
  }
  await waitUntil(async () => !(await overlayOpen(session)), 10_000, 'Onboarding overlay did not dismiss');
}

async function settlePage(session, ctx) {
  await recover(session, ctx);
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (await overlayOpen(session).catch(() => false)) {
      await dismissOverlayIfOpen(session);
      return;
    }
    await sleep(80);
  }
}

export async function runWhenHandler(session, task, ctx) {
  const key = whenKey(task.when);
  const handler = HANDLERS[key];
  if (!handler) {
    throw new Error(`No UI-flow handler for when "${key}" (task ${task.id})`);
  }
  await settlePage(session, ctx);
  await handler(session, task, ctx);
}
