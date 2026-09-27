/**
 * Maestro-style UI flow against Chrome for Testing.
 *
 *   npm run build
 *   npm run test:ui-flow
 *   npm run test:ui-flow -- --keep-browser
 */
import path from 'node:path';
import {
  defaultBrowserBinary,
  findFreePort,
  killAutomationChrome,
  launchChrome,
  repoRoot,
  serveFixture,
  setMacUiLanguage,
  waitForDebugPort
} from './launch.mjs';
import {
  connectPage,
  ensureSession,
  waitForExtension
} from './cdp.mjs';
import { loadWalkthroughModel } from './model.mjs';
import { assertInstallChromeVisible } from './flows/install-chrome.mjs';
import { walkOnboardingModel } from './flows/walkthrough.mjs';

function parseArgs(argv) {
  const options = {
    keepBrowser: false,
    locale: 'en',
    port: 0,
    browserBinary: defaultBrowserBinary,
    profile: path.join(repoRoot, 'tmp-captures', 'chrome-ui-flow-profile')
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--keep-browser') options.keepBrowser = true;
    else if (arg === '--locale') options.locale = argv[++index];
    else if (arg.startsWith('--locale=')) options.locale = arg.slice(9);
    else if (arg === '--port') options.port = Number(argv[++index]);
    else if (arg.startsWith('--port=')) options.port = Number(arg.slice(7));
    else if (arg === '--browser-binary') options.browserBinary = path.resolve(argv[++index]);
    else if (arg.startsWith('--browser-binary=')) options.browserBinary = path.resolve(arg.slice(17));
    else if (arg === '--profile') options.profile = path.resolve(argv[++index]);
    else if (arg.startsWith('--profile=')) options.profile = path.resolve(arg.slice(10));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    throw new Error(`Invalid CDP port: ${options.port}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const model = loadWalkthroughModel(options.locale);
  if (!model.slides.length) throw new Error('Onboarding XML produced no slides');

  const server = await serveFixture();
  const port = options.port || await findFreePort();
  await setMacUiLanguage(options.locale);
  const browser = launchChrome({
    locale: options.locale,
    port,
    profile: options.profile,
    browserBinary: options.browserBinary,
    url: `${server.origin}/`
  });
  console.log(`Fixture: ${server.origin}/`);
  console.log(`Chrome CDP: http://127.0.0.1:${port}`);
  console.log(`Profile: ${browser.profile}`);

  let session;
  try {
    await waitForDebugPort(port);
    await waitForExtension(port);
    session = await connectPage(port, server.origin);
    await session.client.Emulation.setDeviceMetricsOverride({
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await ensureSession(session);

    await assertInstallChromeVisible(session);
    await walkOnboardingModel(session, model, {
      port,
      origin: server.origin
    });
    console.log('UI flow passed');
  } finally {
    if (session?.client && !options.keepBrowser) {
      await session.client.Browser.close().catch(() => {});
    }
    await session?.client?.close().catch(() => {});
    if (!options.keepBrowser) {
      await killAutomationChrome(browser.profile);
    }
    server.server.close();
  }
}

main().catch((error) => {
  console.error(`test:ui-flow failed: ${error.message || error}`);
  process.exitCode = 1;
});
