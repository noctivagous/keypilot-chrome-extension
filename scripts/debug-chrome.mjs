/**
 * Launch Chrome for Testing with the unpacked KeyPilot extension for interactive
 * debugging. This intentionally does not capture screenshots or touch any
 * store-listing assets.
 *
 * Usage:
 *   npm run build
 *   npm run debug:chrome
 *   npm run debug:chrome -- --url=https://example.com
 *   npm run debug:chrome -- --locale=de --url=http://127.0.0.1:8080/
 *
 * Cursor MCP configuration:
 *
 *   {
 *     "mcpServers": {
 *       "chrome-devtools": {
 *         "command": "npx",
 *         "args": [
 *           "-y",
 *           "chrome-devtools-mcp@latest",
 *           "--browser-url=http://127.0.0.1:9222",
 *           "--experimental-include-all-pages",
 *           "--no-usage-statistics",
 *           "--no-performance-crux"
 *         ]
 *       }
 *     }
 *   }
 *
 * Add this under Cursor Settings > MCP, then restart the MCP server. Start
 * this launcher first so the MCP server can attach to port 9222.
 *
 * Security: this uses a separate profile, but CDP permits local processes to
 * control every page in this debug browser. Do not use it for personal
 * browsing or authenticated accounts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const defaultBrowserBinary =
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const defaultProfile = path.join(repoRoot, 'tmp-captures', 'chrome-debug-profile');

function parseArgs(argv) {
  const options = {
    browserBinary: process.env.CHROME_BINARY || defaultBrowserBinary,
    locale: 'en',
    port: 9222,
    profile: defaultProfile,
    url: 'about:blank'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--browser-binary') options.browserBinary = path.resolve(argv[++index]);
    else if (arg.startsWith('--browser-binary=')) options.browserBinary = path.resolve(arg.slice(17));
    else if (arg === '--locale') options.locale = argv[++index];
    else if (arg.startsWith('--locale=')) options.locale = arg.slice(9);
    else if (arg === '--port') options.port = Number(argv[++index]);
    else if (arg.startsWith('--port=')) options.port = Number(arg.slice(7));
    else if (arg === '--profile') options.profile = path.resolve(argv[++index]);
    else if (arg.startsWith('--profile=')) options.profile = path.resolve(arg.slice(10));
    else if (arg === '--url') options.url = argv[++index];
    else if (arg.startsWith('--url=')) options.url = arg.slice(6);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error(`Invalid CDP port: ${options.port}`);
  }
  return options;
}

function chromeLocale(locale) {
  return locale.replaceAll('_', '-');
}

function setMacUiLanguage(locale) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'defaults',
      ['write', 'com.google.chrome.for.testing', 'AppleLanguages', '-array', chromeLocale(locale)],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
    let error = '';
    child.stderr.on('data', (chunk) => { error += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Could not set Chrome UI language (${code}): ${error.trim()}`));
    });
  });
}

async function assertPortAvailable(port) {
  try {
    await fetch(`http://127.0.0.1:${port}/json/version`);
    throw new Error(`CDP port ${port} is already in use. Close that browser or choose --port.`);
  } catch (error) {
    if (error.message.startsWith('CDP port')) throw error;
  }
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

function launchChrome(options) {
  const extensionPath = path.join(repoRoot, 'extension');
  if (!fs.existsSync(options.browserBinary)) {
    throw new Error(`Chrome for Testing was not found at ${options.browserBinary}`);
  }
  if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
    throw new Error('Built extension not found. Run "npm run build" first.');
  }

  fs.mkdirSync(options.profile, { recursive: true });
  const args = [
    `--remote-debugging-port=${options.port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${options.profile}`,
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    `--lang=${chromeLocale(options.locale)}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-component-extensions-with-background-pages',
    options.url
  ];

  return spawn(options.browserBinary, args, { stdio: 'inherit' });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await assertPortAvailable(options.port);
  await setMacUiLanguage(options.locale);
  const browser = launchChrome(options);
  let shuttingDown = false;

  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (!browser.killed) browser.kill('SIGTERM');
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  await waitForDebugPort(options.port);
  console.log(`Chrome for Testing is ready at http://127.0.0.1:${options.port}`);
  console.log(`Profile: ${options.profile}`);
  console.log('Press Ctrl-C to close the debug browser.');

  await new Promise((resolve) => browser.once('close', resolve));
}

main().catch((error) => {
  console.error(`debug:chrome failed: ${error.message}`);
  process.exitCode = 1;
});
