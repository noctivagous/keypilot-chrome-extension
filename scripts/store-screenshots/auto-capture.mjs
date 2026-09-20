/**
 * Launch Google Chrome for Testing with the unpacked extension and capture
 * every configured Chrome Web Store screenshot slot through CDP.
 *
 * Usage:
 *   npm run store:screenshots:auto
 *   npm run store:screenshots:auto -- --locales=en,es,es_419,de
 *
 * Chrome for Testing is launched with a disposable profile for each locale, so
 * the normal Chrome profile is not modified. On macOS, UI locale is selected
 * through AppleLanguages on the Chrome for Testing bundle.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import CDP from 'chrome-remote-interface';
import { loadSlots, repoRoot, storesRoot, listShippedLocales, isExcludedLocale, looksLikeTestLocaleCatalog } from './lib.mjs';
import { pngDimensions } from './png.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, 'fixture.html');
const pageApiPath = path.join(__dirname, 'page-api.js');
const chromeApp = '/Applications/Google Chrome for Testing.app';
const chromeBinary = `${chromeApp}/Contents/MacOS/Google Chrome for Testing`;
const chromeBundleId = 'com.google.chrome.for.testing';
const defaultPort = 0;

function parseArgs(argv) {
  const options = {
    locales: null,
    port: defaultPort,
    keepBrowser: false,
    browserBinary: process.env.CHROME_BINARY || chromeBinary,
    profileRoot: path.join(repoRoot, 'tmp-captures', 'chrome-profiles')
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--keep-browser') options.keepBrowser = true;
    else if (arg === '--locales' || arg === '--locale') options.locales = argv[++index]?.split(',');
    else if (arg.startsWith('--locales=')) options.locales = arg.slice('--locales='.length).split(',');
    else if (arg.startsWith('--locale=')) options.locales = [arg.slice('--locale='.length)];
    else if (arg === '--port') options.port = Number(argv[++index]);
    else if (arg.startsWith('--port=')) options.port = Number(arg.slice('--port='.length));
    else if (arg === '--profile-root') options.profileRoot = path.resolve(argv[++index]);
    else if (arg.startsWith('--profile-root=')) options.profileRoot = path.resolve(arg.slice('--profile-root='.length));
    else if (arg === '--browser-binary') options.browserBinary = path.resolve(argv[++index]);
    else if (arg.startsWith('--browser-binary=')) options.browserBinary = path.resolve(arg.slice('--browser-binary='.length));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    throw new Error(`Invalid CDP port: ${options.port}`);
  }
  return options;
}

function chromeLocale(locale) {
  return locale.replaceAll('_', '-');
}

function setMacUiLanguage(locale) {
  return new Promise((resolve, reject) => {
    const child = spawn('defaults', ['write', chromeBundleId, 'AppleLanguages', '-array', chromeLocale(locale)]);
    let error = '';
    child.stderr.on('data', (chunk) => { error += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Could not set Chrome AppleLanguages (${code}): ${error.trim()}`));
    });
  });
}

function serveFixture() {
  const slotsPath = path.join(storesRoot(repoRoot), 'chrome/slots.json');
  const files = {
    '/': fixturePath,
    '/index.html': fixturePath,
    '/page-api.js': pageApiPath,
    '/slots.json': slotsPath
  };
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const file = files[url.pathname];
      if (!file) {
        response.writeHead(404);
        response.end('not found');
        return;
      }
      const extension = path.extname(file);
      const contentType = extension === '.js'
        ? 'text/javascript; charset=utf-8'
        : extension === '.json'
          ? 'application/json; charset=utf-8'
          : 'text/html; charset=utf-8';
      response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
      response.end(fs.readFileSync(file));
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, origin: `http://127.0.0.1:${port}/` });
    });
  });
}

async function waitForDebugPort(port, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Chrome did not open CDP port ${port} within ${timeoutMs} ms`);
}

async function findFreePort() {
  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function launchChrome({ locale, port, profileRoot, browserBinary }) {
  fs.mkdirSync(profileRoot, { recursive: true });
  const profile = path.join(profileRoot, locale);
  fs.rmSync(profile, { recursive: true, force: true });
  fs.mkdirSync(profile, { recursive: true });
  const extensionPath = path.join(repoRoot, 'extension');
  const command = browserBinary;
  const args = [
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${profile}`,
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-component-extensions-with-background-pages',
    'about:blank'
  ];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();
  return { child, profile };
}

function killAutomationChrome(profile) {
  return new Promise((resolve) => {
    const child = spawn('pkill', ['-f', `--user-data-dir=${profile}`], { stdio: 'ignore' });
    child.on('close', () => resolve());
    child.on('error', () => resolve());
  });
}

async function evaluate(client, expression, awaitPromise = false, contextId = null) {
  const result = await client.Runtime.evaluate({
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
    ...(contextId != null ? { contextId } : {})
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  }
  return result.result?.value;
}

function trackExecutionContexts(client) {
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

async function findKeyPilotContext(client, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    for (const context of client._kpContexts.values()) {
      try {
        const ready = await evaluate(
          client,
          'Boolean(window.__KeyPilotInstance && typeof window.__KeyPilotInstance.applyKeyboardHelpVisibility === "function")',
          false,
          context.id
        );
        if (ready) return context.id;
      } catch {
        /* Context may have been destroyed during navigation. */
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('KeyPilot content script did not become ready');
}

async function installStoreApi(client, contextId) {
  const source = fs.readFileSync(pageApiPath, 'utf8');
  await evaluate(client, source, false, contextId);
  const ready = await evaluate(client, 'Boolean(window.__KP_STORE_SHOTS?.ready?.())', false, contextId);
  if (!ready) throw new Error('Store screenshot API did not initialize in the KeyPilot world');
}

async function waitForExtension(port, timeoutMs = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const targets = await CDP.List({ port });
    if (targets.some((target) => target.type === 'service_worker' && /\/background\.js(?:$|\?)/.test(target.url))) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    'Chrome for Testing did not load KeyPilot via --load-extension. ' +
    'Confirm the app exists at /Applications/Google Chrome for Testing.app.'
  );
}

async function waitForSelectors(client, selectors, contextId, timeoutMs = 10_000) {
  const started = Date.now();
  let last = [];
  while (Date.now() - started < timeoutMs) {
    last = await evaluate(
      client,
      `window.__KP_STORE_SHOTS.probe(${JSON.stringify(selectors)})`,
      false,
      contextId
    );
    if (Array.isArray(last) && last.every((item) => item.visible)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const missing = (last || []).filter((item) => !item.visible).map((item) => `${item.selector}${item.found ? ' (hidden)' : ''}`);
  throw new Error(`Required screenshot selectors did not appear: ${missing.join(', ')}`);
}

function writeCapture(slots, locale, slot, png) {
  const size = pngDimensions(png);
  const expected = slots.captureDefaults.viewport;
  if (size.width !== expected.width || size.height !== expected.height) {
    throw new Error(`${slot.id} rendered ${size.width}×${size.height}; expected ${expected.width}×${expected.height}`);
  }
  const directory = path.join(storesRoot(repoRoot), slots.paths.captures, locale);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, slot.captureFile), png);
  const metaPath = path.join(directory, 'meta.json');
  const previous = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  fs.writeFileSync(metaPath, `${JSON.stringify({
    locale,
    viewport: expected,
    deviceScaleFactor: slots.captureDefaults.deviceScaleFactor,
    shots: { ...(previous.shots || {}), [slot.id]: slot.captureFile }
  }, null, 2)}\n`);
}

async function captureLocale(locale, options, server, slots) {
  console.log(`\nCapturing ${locale}`);
  await setMacUiLanguage(locale);
  const port = options.port || await findFreePort();
  const browser = launchChrome({
    locale,
    port,
    profileRoot: options.profileRoot,
    browserBinary: options.browserBinary
  });
  console.log(`  Chrome CDP: http://127.0.0.1:${port} (profile ${browser.profile})`);
  let client;
  try {
    await waitForDebugPort(port);
    await waitForExtension(port);
    const targets = await CDP.List({ port });
    const page = targets.find((target) => target.type === 'page') || targets[0];
    client = await CDP({ port, target: page });
    trackExecutionContexts(client);
    await client.Page.enable();
    await client.Runtime.enable();
    await client.Emulation.setDeviceMetricsOverride({
      width: slots.captureDefaults.viewport.width,
      height: slots.captureDefaults.viewport.height,
      deviceScaleFactor: slots.captureDefaults.deviceScaleFactor,
      mobile: false
    });
    const loaded = client.Page.loadEventFired();
    await client.Page.navigate({ url: server.origin });
    await loaded;
    const contextId = await findKeyPilotContext(client);
    await installStoreApi(client, contextId);
    for (const slot of slots.slots) {
      const reset = await evaluate(client, 'window.__KP_STORE_SHOTS.reset()', true, contextId);
      const opened = await evaluate(client, `window.__KP_STORE_SHOTS.open(${JSON.stringify(slot.capture.open)})`, true, contextId);
      if (!opened?.ok) {
        throw new Error(`Could not open slot "${slot.id}": ${opened?.error || JSON.stringify(opened)} (reset=${JSON.stringify(reset)})`);
      }
      if (slot.capture.hoverSelector) {
        const box = await evaluate(client, `window.__KP_STORE_SHOTS.box(${JSON.stringify(slot.capture.hoverSelector)})`, false, contextId);
        if (box?.visible) {
          await client.Input.dispatchMouseEvent({
            type: 'mouseMoved',
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
            button: 'none',
            buttons: 0,
            pointerType: 'mouse'
          });
        }
      }
      if (slot.capture.pinActionId) {
        const keyBox = await evaluate(
          client,
          `window.__KP_STORE_SHOTS.box(${JSON.stringify(`[data-kp-action-id="${slot.capture.pinActionId}"]`)})`,
          false,
          contextId
        );
        if (keyBox?.visible) {
          const x = keyBox.x + keyBox.width / 2;
          const y = keyBox.y + keyBox.height / 2;
          await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none', buttons: 0, pointerType: 'mouse' });
          await client.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
          await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });
        }
      }
      await waitForSelectors(client, slot.capture.requiredSelectors || [], contextId);
      const screenshot = await client.Page.captureScreenshot({
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false
      });
      writeCapture(slots, locale, slot, Buffer.from(screenshot.data, 'base64'));
      console.log(`  wrote ${locale}/${slot.captureFile}`);
    }
  } finally {
    if (client && !options.keepBrowser) {
      await client.Browser.close().catch(() => {});
    }
    await client?.close().catch(() => {});
    if (!options.keepBrowser) {
      await killAutomationChrome(browser.profile);
    }
  }
}

function eligibleLocales(slots, requested) {
  const shipped = listShippedLocales(repoRoot);
  const eligible = shipped.filter((locale) => !isExcludedLocale(locale, slots) && !looksLikeTestLocaleCatalog(repoRoot, locale));
  const locales = requested || eligible;
  for (const locale of locales) {
    if (!eligible.includes(locale)) throw new Error(`Locale "${locale}" is not an eligible shipped locale`);
  }
  return locales;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.browserBinary)) {
    throw new Error(`Chrome for Testing not found at ${options.browserBinary}`);
  }
  const slots = loadSlots(repoRoot);
  const locales = eligibleLocales(slots, options.locales);
  const server = await serveFixture();
  console.log(`Fixture: ${server.origin}`);
  try {
    for (const locale of locales) await captureLocale(locale, options, server, slots);
  } finally {
    server.server.close();
  }
  console.log('\nCapture complete. Generate localized listing PNGs with:');
  console.log('  npm run store:screenshots -- --all');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
