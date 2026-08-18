/**
 * Docs screenshot helper for chrome-dev / Grok Build (no Playwright).
 *
 *   npm run docs:screenshots              # serve fixture + catalog; leave running
 *   npm run docs:screenshots -- write <id-or-file>   # stdin = PNG or base64 PNG
 *
 * chrome-dev: load unpacked KeyPilot, open the printed fixture URL, then for each
 * shot in shots.json: evaluate __KP_DOCS_SHOTS.reset(); __KP_DOCS_SHOTS.open(...);
 * screenshot the selector; write PNG into extension/userdocs/images/.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(repoRoot, 'extension', 'userdocs', 'images');
const shotsPath = path.join(__dirname, 'shots.json');
const fixturePath = path.join(__dirname, 'fixture.html');
const pageApiPath = path.join(__dirname, 'page-api.js');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function loadCatalog() {
  return JSON.parse(fs.readFileSync(shotsPath, 'utf8'));
}

function resolveShot(idOrFile) {
  const catalog = loadCatalog();
  const key = String(idOrFile || '').trim();
  const shot = (catalog.shots || []).find((s) => s.id === key || s.file === key);
  if (!shot) {
    throw new Error(`Unknown shot "${key}". See scripts/docs-screenshots/shots.json`);
  }
  return shot;
}

function printPlaybook(origin) {
  const catalog = loadCatalog();
  console.log(`Fixture: ${origin}`);
  console.log(`Catalog: ${origin}shots.json`);
  console.log('');
  console.log('chrome-dev playbook (KeyPilot unpacked + enabled):');
  console.log('  1. Navigate to the fixture URL.');
  console.log('  2. Wait until Runtime.evaluate returns true:');
  console.log('       window.__KP_DOCS_SHOTS.ready()');
  console.log('  3. For each in-page shot (no "page" field):');
  console.log('       __KP_DOCS_SHOTS.reset()');
  console.log('       __KP_DOCS_SHOTS.open(kind, { panelId, topicId })');
  console.log('       screenshot the "selector" host');
  console.log('       write extension/userdocs/images/<file>');
  console.log('  4. For shots with "page": open chrome-extension://<id>/<page> and screenshot selector.');
  console.log('');
  for (const shot of catalog.shots || []) {
    if (shot.page) {
      console.log(`  - ${shot.id}: chrome-extension://<id>/${shot.page}  selector=${shot.selector}  → ${shot.file}`);
      continue;
    }
    const opts = [];
    if (shot.panelId) opts.push(`panelId: '${shot.panelId}'`);
    if (shot.topicId) opts.push(`topicId: '${shot.topicId}'`);
    const optStr = opts.length ? `, { ${opts.join(', ')} }` : '';
    console.log(`  - ${shot.id}: __KP_DOCS_SHOTS.open('${shot.open}'${optStr})  selector=${shot.selector}  → ${shot.file}`);
  }
}

function serveFixture() {
  const files = {
    '/': fixturePath,
    '/index.html': fixturePath,
    '/page-api.js': pageApiPath,
    '/shots.json': shotsPath
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
      const ext = path.extname(file) || (url.pathname === '/' ? '.html' : '');
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

function writeShotPng(idOrFile, raw) {
  const shot = resolveShot(idOrFile);
  fs.mkdirSync(outDir, { recursive: true });
  const dest = path.join(outDir, shot.file);
  const png = decodePngBuffer(raw);
  if (png.length < 32 || png[0] !== 0x89 || png[1] !== 0x50) {
    throw new Error('Input is not a PNG (pass raw PNG bytes or base64)');
  }
  fs.writeFileSync(dest, png);
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
    const id = argv[1];
    if (!id) {
      console.error('Usage: node capture.mjs write <shot-id-or-file>   # PNG or base64 on stdin');
      process.exit(1);
    }
    const raw = await readStdin();
    const dest = writeShotPng(id, raw);
    console.log(`Wrote ${dest}`);
    return;
  }

  if (cmd === 'list') {
    for (const shot of loadCatalog().shots || []) {
      console.log(`${shot.id}\t${shot.file}\t${shot.page || shot.open}\t${shot.selector}`);
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
