/**
 * Launch Chrome for Testing with a disposable profile and the unpacked extension.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '..', '..');
export const defaultBrowserBinary =
  process.env.CHROME_BINARY
  || '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
export const chromeBundleId = 'com.google.chrome.for.testing';

export function chromeLocale(locale) {
  return String(locale || 'en').replaceAll('_', '-');
}

export function setMacUiLanguage(locale) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'defaults',
      ['write', chromeBundleId, 'AppleLanguages', '-array', chromeLocale(locale)],
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

export async function findFreePort() {
  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function waitForDebugPort(port, timeoutMs = 20_000) {
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

export function serveFixture() {
  const files = {
    '/': path.join(__dirname, 'fixture.html'),
    '/index.html': path.join(__dirname, 'fixture.html'),
    '/next.html': path.join(__dirname, 'next.html'),
    '/page-api.js': path.join(__dirname, 'page-api.js')
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
        : 'text/html; charset=utf-8';
      response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
      response.end(fs.readFileSync(file));
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

export function launchChrome({ locale, port, profile, browserBinary, url }) {
  const extensionPath = path.join(repoRoot, 'extension');
  if (!fs.existsSync(browserBinary)) {
    throw new Error(`Chrome for Testing was not found at ${browserBinary}`);
  }
  if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
    throw new Error('Built extension not found. Run "npm run build" first.');
  }

  fs.rmSync(profile, { recursive: true, force: true });
  fs.mkdirSync(profile, { recursive: true });

  const args = [
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${profile}`,
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    `--lang=${chromeLocale(locale)}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-popup-blocking',
    '--disable-component-extensions-with-background-pages',
    url
  ];

  const child = spawn(browserBinary, args, { detached: true, stdio: 'ignore' });
  child.unref();
  return { child, profile };
}

export function killAutomationChrome(profile) {
  return new Promise((resolve) => {
    const child = spawn('pkill', ['-f', `--user-data-dir=${profile}`], { stdio: 'ignore' });
    child.on('close', () => resolve());
    child.on('error', () => resolve());
  });
}
