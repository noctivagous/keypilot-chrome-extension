/**
 * CDP helpers for the UI-flow runner.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CDP from 'chrome-remote-interface';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pageApiPath = path.join(__dirname, 'page-api.js');

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function evaluate(client, expression, awaitPromise = false, contextId = null) {
  const result = await client.Runtime.evaluate({
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
    ...(contextId != null ? { contextId } : {})
  });
  if (result.exceptionDetails) {
    const desc = result.exceptionDetails.exception?.description
      || result.exceptionDetails.text
      || 'Runtime evaluation failed';
    throw new Error(desc);
  }
  return result.result?.value;
}

export function trackExecutionContexts(client) {
  const contexts = new Map();
  client.Runtime.executionContextCreated(({ context }) => {
    contexts.set(context.id, context);
  });
  client.Runtime.executionContextDestroyed(({ executionContextId }) => {
    contexts.delete(executionContextId);
  });
  client.Runtime.executionContextsCleared(() => {
    contexts.clear();
  });
  client._kpContexts = contexts;
  return contexts;
}

export async function waitForExtension(port, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const targets = await CDP.List({ port });
    if (targets.some((target) => target.type === 'service_worker' && /\/background\.js(?:$|\?)/.test(target.url))) {
      return;
    }
    await sleep(250);
  }
  throw new Error(
    'Chrome for Testing did not load KeyPilot via --load-extension. '
    + 'Confirm Chrome for Testing is installed.'
  );
}

export async function findKeyPilotContext(client, timeoutMs = 25_000) {
  const started = Date.now();
  try { await client.Runtime.enable(); } catch { /* already enabled */ }
  while (Date.now() - started < timeoutMs) {
    for (const context of client._kpContexts.values()) {
      try {
        const ready = await evaluate(
          client,
          'Boolean(window.__KeyPilotInstance)',
          false,
          context.id
        );
        if (ready) return context.id;
      } catch {
        /* Context may have been destroyed during navigation. */
      }
    }
    await sleep(250);
  }
  throw new Error('KeyPilot content script did not become ready');
}

export async function installPageApi(client, contextId) {
  const source = fs.readFileSync(pageApiPath, 'utf8');
  await evaluate(client, source, false, contextId);
  const ready = await evaluate(client, 'Boolean(window.__KP_UI_FLOW)', false, contextId);
  if (!ready) throw new Error('UI flow page API did not initialize in the KeyPilot world');
}

export async function waitUntil(fn, timeoutMs, message) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }
  const extra = lastError ? ` (${lastError.message})` : '';
  throw new Error(`${message}${extra}`);
}

export async function connectPage(port, urlPrefix) {
  const targets = await CDP.List({ port });
  const pages = targets.filter((target) => target.type === 'page');
  const page = pages.find((target) => String(target.url || '').startsWith(urlPrefix))
    || pages.find((target) => target.url && target.url !== 'about:blank')
    || pages[0];
  if (!page) throw new Error('No page target for the fixture');
  const client = await CDP({ port, target: page });
  trackExecutionContexts(client);
  await client.Page.enable();
  await client.Runtime.enable();
  await client.Input.enable?.().catch(() => {});
  await client.Target.setDiscoverTargets?.({ discover: true }).catch(() => {});
  return { client, target: page };
}

export async function ensureSession(session) {
  const { client } = session;
  session.contextId = await findKeyPilotContext(client);
  await installPageApi(client, session.contextId);
  return session;
}

export async function reconnectIfNeeded(session, port, urlPrefix) {
  try {
    const ready = await evaluate(
      session.client,
      'Boolean(window.__KP_UI_FLOW?.ready?.())',
      false,
      session.contextId
    );
    if (ready) return session;
    return ensureSession(session);
  } catch {
    try {
      return await ensureSession(session);
    } catch {
      try { await session.client.close(); } catch { /* ignore */ }
      const next = await connectPage(port, urlPrefix);
      Object.assign(session, next);
      return ensureSession(session);
    }
  }
}

export async function waitForSelectors(session, selectors, timeoutMs = 20_000) {
  const { client } = session;
  const started = Date.now();
  let last = [];
  while (Date.now() - started < timeoutMs) {
    try {
      last = await evaluate(
        client,
        `window.__KP_UI_FLOW.probe(${JSON.stringify(selectors)})`,
        false,
        session.contextId
      );
      if (Array.isArray(last) && last.every((item) => item.visible)) return last;
    } catch {
      /* page or context may be swapping */
    }
    await sleep(150);
  }
  const missing = (last || [])
    .filter((item) => !item.visible)
    .map((item) => `${item.selector}${item.found ? ' (hidden)' : ''}`);
  throw new Error(`Required selectors did not appear: ${missing.join(', ') || selectors.join(', ')}`);
}

export async function box(session, selector) {
  return evaluate(
    session.client,
    `window.__KP_UI_FLOW.box(${JSON.stringify(selector)})`,
    false,
    session.contextId
  );
}

export async function paintedTasks(session) {
  return evaluate(session.client, 'window.__KP_UI_FLOW.paintedTasks()', false, session.contextId) || [];
}

export async function onboardingState(session) {
  return evaluate(session.client, 'window.__KP_UI_FLOW.onboarding()', false, session.contextId) || {};
}

export async function overlayOpen(session) {
  return Boolean(
    await evaluate(session.client, 'window.__KP_UI_FLOW.overlayOpen()', false, session.contextId)
  );
}

export async function pageHref(session) {
  return String(
    await evaluate(session.client, 'window.__KP_UI_FLOW.href()', false, session.contextId) || ''
  );
}

export async function clickPoint(session, x, y) {
  await session.client.Input.dispatchMouseEvent({
    type: 'mouseMoved', x, y, button: 'none', buttons: 0, pointerType: 'mouse'
  });
  await session.client.Input.dispatchMouseEvent({
    type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse'
  });
  await session.client.Input.dispatchMouseEvent({
    type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse'
  });
}

export async function clickSelector(session, selector) {
  const rect = await waitUntil(
    async () => {
      const next = await box(session, selector);
      return next?.visible ? next : null;
    },
    12_000,
    `Click target not visible: ${selector}`
  );
  await clickPoint(session, rect.x + rect.width / 2, rect.y + rect.height / 2);
}

export async function hoverSelector(session, selector) {
  const rect = await waitUntil(
    async () => {
      const next = await box(session, selector);
      return next?.visible ? next : null;
    },
    12_000,
    `Hover target not visible: ${selector}`
  );
  const x = rect.x + Math.min(rect.width / 2, 12);
  const y = rect.y + Math.min(rect.height / 2, 10);
  await session.client.Input.dispatchMouseEvent({
    type: 'mouseMoved', x, y, button: 'none', buttons: 0, pointerType: 'mouse'
  });
  await evaluate(
    session.client,
    `(() => {
      const x = ${JSON.stringify(x)};
      const y = ${JSON.stringify(y)};
      const ev = new PointerEvent('pointermove', {
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
        view: window,
        pointerType: 'mouse',
        pointerId: 1
      });
      const hit = document.elementFromPoint(x, y) || document.documentElement;
      hit.dispatchEvent(ev);
      document.dispatchEvent(ev);
    })()`,
    false,
    session.contextId
  );
}

function virtualKeyFromCode(code, key) {
  if (code === 'Escape') return 27;
  if (code.startsWith('Key') && code.length === 4) {
    return code.charCodeAt(3);
  }
  if (typeof key === 'string' && key.length === 1) {
    return key.toUpperCase().charCodeAt(0);
  }
  return 0;
}

export async function pressKey(session, { key, code }) {
  const windowsVirtualKeyCode = virtualKeyFromCode(code, key);
  const payload = {
    key,
    code,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode
  };
  const text = key.length === 1 ? key : '';
  await session.client.Input.dispatchKeyEvent({ type: 'rawKeyDown', ...payload });
  if (text) {
    await session.client.Input.dispatchKeyEvent({ type: 'char', ...payload, text, unmodifiedText: text });
  }
  await session.client.Input.dispatchKeyEvent({ type: 'keyUp', ...payload, text, unmodifiedText: text });
}

export async function listPageTargets(port) {
  const targets = await CDP.List({ port });
  return targets.filter((target) => target.type === 'page');
}

export const CHROME_SELECTORS = {
  walkthrough: '.kp-onboarding-panel',
  walkthroughTitle: '[data-kp-onboarding-title="true"]',
  overlayPrimary: 'button[data-kp-onboarding-overlay-primary="true"]',
  overlay: '[data-kp-onboarding-overlay="true"]',
  controlStrip: '[data-kp-control-strip="true"]',
  controlStripStatus: '[data-kp-control-strip-status="true"]',
  keyboardHelp: '.kp-floating-keyboard-help',
  keyboardTitlebar: '[data-kp-floating-keyboard-titlebar="true"]',
  keyboardKey: '.kp-floating-keyboard-help [data-kp-action-id]',
  keyboardKeyAny: '[data-kp-action-id]',
  reenableTip: '[data-kp-onboarding-reenable-tip="true"]',
  practiceLink: '#practice-link',
  practiceLink2: '#practice-link-2',
  practiceField: '#practice-field'
};
