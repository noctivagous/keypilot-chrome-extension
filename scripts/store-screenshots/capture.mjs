/**
 * Store-listing GUI capture helper for chrome-dev / CDP (no Playwright).
 *
 *   npm run store:screenshots:serve
 *   npm run store:screenshots:serve -- write en key-click-browsing   # PNG or base64 on stdin
 *
 * Capture in a Chrome profile whose UI language matches the locale. Do not
 * reuse an English GUI capture under translated annotations.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSlots, repoRoot, storesRoot } from './lib.mjs';
import { pngDimensions } from './png.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, 'fixture.html');
const pageApiPath = path.join(__dirname, 'page-api.js');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function printPlaybook(origin) {
  const slots = loadSlots(repoRoot);
  const viewport = slots.captureDefaults.viewport;
  console.log(`Fixture: ${origin}?lang=<locale>  (en, es, es_419, de)`);
  console.log(`Viewport: ${viewport.width}×${viewport.height} @ ${slots.captureDefaults.deviceScaleFactor}x`);
  console.log(`Chrome UI language: ${slots.captureDefaults.chromeUiLanguage}`);
  console.log('');
  console.log('chrome-dev playbook (KeyPilot unpacked + enabled, locale matching the capture folder):');
  console.log('  1. Set the browser UI language to the capture locale (or launch Chrome with --lang).');
  console.log('  2. Navigate to the fixture URL with ?lang= matching the capture locale. Emulate the viewport above.');
  console.log('  3. Wait until Runtime.evaluate returns true:');
  console.log('       window.__KP_STORE_SHOTS.ready()');
  console.log('  4. For each slot:');
  console.log('       __KP_STORE_SHOTS.reset()');
  console.log('       __KP_STORE_SHOTS.open(slotId)');
  console.log('       screenshot the viewport (not a cropped overlay)');
  console.log('       write online-stores/chrome/captures/<locale>/<captureFile>');
  console.log('');
  for (const slot of slots.slots) {
    const required = (slot.capture.requiredSelectors || []).join(', ');
    console.log(`  - ${slot.id}: __KP_STORE_SHOTS.open('${slot.capture.open}')`);
    console.log(`      hover=${slot.capture.hoverSelector || '—'} pin=${slot.capture.pinActionId || '—'} tab=${slot.capture.libraryTab || '—'}`);
    console.log(`      required: ${required}`);
    console.log(`      → chrome/captures/<locale>/${slot.captureFile}`);
  }
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
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const file = files[url.pathname];
      if (!file) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const ext = path.extname(file) || '.html';
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, origin: `http://127.0.0.1:${port}/` });
    });
    server.on('error', reject);
  });
}

function decodePngBuffer(raw) {
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return buf;
  const text = buf.toString('utf8').trim().replace(/^data:image\/png;base64,/, '');
  return Buffer.from(text, 'base64');
}

function writeCapture(locale, idOrFile, raw) {
  const slots = loadSlots(repoRoot);
  const slot = slots.slots.find((item) => item.id === idOrFile || item.captureFile === idOrFile);
  if (!slot) {
    throw new Error(`Unknown store shot "${idOrFile}". See online-stores/chrome/slots.json`);
  }
  const dir = path.join(storesRoot(repoRoot), slots.paths.captures, locale);
  fs.mkdirSync(dir, { recursive: true });
  const png = decodePngBuffer(raw);
  const size = pngDimensions(png);
  const expected = slots.captureDefaults.viewport;
  if (size.width !== expected.width || size.height !== expected.height) {
    throw new Error(
      `Capture is ${size.width}×${size.height}, expected ${expected.width}×${expected.height}`
    );
  }
  const dest = path.join(dir, slot.captureFile);
  fs.writeFileSync(dest, png);
  const meta = {
    locale,
    viewport: expected,
    deviceScaleFactor: slots.captureDefaults.deviceScaleFactor,
    shots: {
      ...(fs.existsSync(path.join(dir, 'meta.json'))
        ? JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')).shots || {}
        : {}),
      [slot.id]: slot.captureFile
    }
  };
  fs.writeFileSync(path.join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  return dest;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0] || 'serve';

  if (cmd === 'write') {
    const locale = argv[1];
    const id = argv[2];
    if (!locale || !id) {
      console.error('Usage: node capture.mjs write <locale> <slot-id-or-file>   # PNG or base64 on stdin');
      process.exit(1);
    }
    const dest = writeCapture(locale, id, await readStdin());
    console.log(`Wrote ${dest}`);
    return;
  }

  if (cmd === 'list') {
    for (const slot of loadSlots(repoRoot).slots) {
      console.log(`${slot.id}\t${slot.captureFile}\t${slot.capture.open}\t${slot.capture.requiredSelectors.join(',')}`);
    }
    return;
  }

  const { origin } = await serveFixture();
  printPlaybook(origin);
  console.log('');
  console.log('Fixture server running. Stop with Ctrl+C.');
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
