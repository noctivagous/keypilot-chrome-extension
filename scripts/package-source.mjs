/**
 * AMO reviewer source archive for the Firefox package.
 *
 * Produces a ZIP of the pre-esbuild sources plus the scripts needed to
 * reproduce `npm run package:firefox`. Bundled outputs and node_modules are
 * omitted; reviewers regenerate them from this archive.
 *
 * Usage:
 *   npm run package:firefox-source
 *   node scripts/package-source.mjs
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const stagingDir = path.join(repoRoot, 'dist', 'source');
const zipDir = path.join(repoRoot, 'dist');

const EXCLUDE_MATCHERS = [
  /^\.git(\/|$)/,
  /^node_modules(\/|$)/,
  /^dist(\/|$)/,
  /^extension-firefox(\/|$)/,
  /^test-results(\/|$)/,
  /^playwright-report(\/|$)/,
  /^blob-report(\/|$)/,
  /^coverage(\/|$)/,
  /^\.cursor(\/|$)/,
  /^\.grok(\/|$)/,
  /^\.vscode(\/|$)/,
  /^\.idea(\/|$)/,
  /(^|\/)\.DS_Store$/,
  /\.crx$/,
  /\.pem$/,
  /\.zip$/,
  /^extension\/content-bundled(\.min)?\.js$/,
  /^extension\/content-bundled\.esbuild\.js$/,
  /^extension\/frame-agent-bundled(\.esbuild)?\.js$/,
  /^extension\/pages\/docs-bundled\.js$/,
  /^extension\/pages\/settings-bundled\.js$/,
  /^extension\/popup-v1\.html$/,
  /^extension\/popup-v1\.js$/,
];

function posixRel(from, to) {
  return path.relative(from, to).split(path.sep).join('/');
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function emptyDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function isExcluded(relPath) {
  const rel = String(relPath).replaceAll('\\', '/');
  return EXCLUDE_MATCHERS.some((re) => re.test(rel));
}

function walkFiles(rootDir) {
  const out = [];
  function visit(abs) {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const next = path.join(abs, entry.name);
      const rel = posixRel(rootDir, next);
      if (isExcluded(rel)) continue;
      if (entry.isDirectory()) visit(next);
      else if (entry.isFile()) out.push({ abs: next, rel });
    }
  }
  visit(rootDir);
  return out;
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    let out = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function gitRev() {
  try {
    return await run('git', ['rev-parse', 'HEAD'], repoRoot);
  } catch {
    return null;
  }
}

function readExtensionVersion() {
  const manifestPath = path.join(repoRoot, 'extension', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const version = String(manifest.version || '').trim();
  if (!version) throw new Error('extension/manifest.json is missing version');
  return version;
}

function writeSourceReadme(destPath, { version, commit }) {
  const contents = `# KeyPilot — AMO source package

This archive is the reviewer source for the Firefox extension package
\`keypilot-firefox-v${version}.zip\`.

KeyPilot uses **esbuild** (open source) to bundle a few entry points into:

- \`extension/content-bundled.js\`
- \`extension/frame-agent-bundled.js\`
- \`extension/pages/docs-bundled.js\`
- \`extension/pages/settings-bundled.js\`

Those bundled files are intentionally omitted from this source archive. Rebuild
them with the instructions below, then compare against the uploaded extension
ZIP.

## Environment

- Node.js 20+ (reviewer default Node 24 is fine)
- npm (lockfile included: \`package-lock.json\`)
- macOS / Linux / Windows

Build tooling versions are pinned by \`package-lock.json\`. Install with
\`npm ci\` when possible.

## Reproduce the Firefox package

From the root of this extracted archive:

\`\`\`bash
npm ci
# If npm ci is unavailable in the review environment:
# npm install

npm run package:firefox
\`\`\`

That command:

1. Runs \`npm run build:firefox\` (\`node extension/build.js --firefox\`)
2. Bundles the entry points with esbuild (**without** minify)
3. Stages a Firefox-specific tree in \`extension-firefox/\`
4. Writes the store archive to \`dist/keypilot-firefox-v${version}.zip\`

Compare the rebuilt archive (or \`dist/firefox/\` staging directory) to the
uploaded extension package. Bundled JS should match aside from the esbuild
banner timestamp (\`Generated on …\`) and any development timestamp stamped
into the working-tree Chrome \`extension/manifest.json\` description during
build. The Firefox store package description is replaced from
\`scripts/firefox/release-config.json\` and must match the uploaded ZIP.

## Third-party libraries

Declared npm dependencies include:

- \`markdown-it\` — documentation markdown rendering
- \`query-selector-shadow-dom\` — Shadow DOM selector helper
- \`esbuild\` (devDependency) — bundler used by \`extension/build.js\`
- \`archiver\` (devDependency) — ZIP packaging

## Git revision

${commit ? `Packaged from git commit \`${commit}\`.` : 'Git commit unavailable when this archive was produced.'}

## Contact

https://github.com/noctivagous/keypilot-chrome-extension/issues
`;
  fs.writeFileSync(destPath, contents);
}

function zipDirContents(sourceDir, zipPath) {
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', () => resolve(archive.pointer()));
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function packageSource() {
  const version = readExtensionVersion();
  const commit = await gitRev();
  const zipName = `keypilot-firefox-source-v${version}.zip`;
  const zipPath = path.join(zipDir, zipName);

  emptyDir(stagingDir);

  const files = walkFiles(repoRoot);
  for (const file of files) {
    const dest = path.join(stagingDir, file.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file.abs, dest);
  }

  writeSourceReadme(path.join(stagingDir, 'AMO-SOURCE-README.md'), { version, commit });

  const required = [
    'package.json',
    'package-lock.json',
    'extension/build.js',
    'extension/build-side-effects.js',
    'extension/manifest.json',
    'extension/background.js',
    'extension/src/content-script.js',
    'scripts/package-firefox.mjs',
    'scripts/package-channel.mjs',
    'scripts/firefox/release-config.json',
    'AMO-SOURCE-README.md',
  ];
  const missing = required.filter((rel) => !fs.existsSync(path.join(stagingDir, rel)));
  if (missing.length) {
    throw new Error(`Source package missing required files:\n- ${missing.join('\n- ')}`);
  }

  const stagedFiles = walkFiles(stagingDir);
  const bytes = await zipDirContents(stagingDir, zipPath);
  const digest = sha256File(zipPath);
  const builtAt = new Date().toISOString();
  const metadata = {
    channel: 'source',
    purpose: 'AMO reviewer source for package:firefox',
    archive: posixRel(repoRoot, zipPath),
    version,
    bytes,
    sha256: digest,
    gitCommit: commit,
    builtAt,
    stagedFiles: stagedFiles.length,
  };
  const metadataPath = path.join(zipDir, zipName.replace(/\.zip$/i, '.metadata.json'));
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  console.log('');
  console.log(`Channel:    source (AMO)`);
  console.log(`Archive:    ${metadata.archive}`);
  console.log(`Version:    ${version}`);
  console.log(`Bytes:      ${bytes}`);
  console.log(`SHA-256:    ${digest}`);
  console.log(`Git commit: ${commit || '(unavailable)'}`);
  console.log(`Built:      ${builtAt}`);
  console.log(`Files:      ${stagedFiles.length} total`);
  console.log(`README:     AMO-SOURCE-README.md`);
  console.log(`Metadata:   ${posixRel(repoRoot, metadataPath)}`);
}

packageSource().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
