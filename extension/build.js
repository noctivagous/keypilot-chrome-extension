/**
 * KeyPilot extension build (esbuild).
 *
 * Bundles content, frame-agent, and occasional-UI (Docs / Settings) entry points,
 * then runs post-bundle side effects (manifest stamp, README/website sync,
 * early-inject UI block).
 *
 * Settings and Docs must stay on their own ESM entries (`pages/*-bundled.js`).
 * Do not import `pages/settings.js` or `pages/docs.js` from the content-script
 * graph — content loads them lazily via `chrome.runtime.getURL`.
 *
 * Usage:
 *   node build.js
 *   node build.js --firefox         # also stages Firefox files in ../extension-firefox
 *   node build.js --minify          # also writes content-bundled.min.js
 *   node build.js --macro-builder   # enable User Macros / Macro Builder UI (v1.2 surface)
 */
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPostBundleTasks } from './build-side-effects.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shouldMinify = process.argv.includes('--minify') || process.argv.includes('-m');
const enableMacroBuilder = process.argv.includes('--macro-builder');
const shouldBuildFirefox = process.argv.includes('--firefox');
const FIREFOX_GECKO_ID = 'keypilot@noctivagous.browserextension';

const FIREFOX_EXCLUDED_FILES = new Set([
  'build.js',
  'build-side-effects.js',
  'content-bundled.min.js',
  'content-bundled.esbuild.js',
  'frame-agent-bundled.esbuild.js',
  'popup-v1.html',
  'popup-v1.js',
  'README.md',
  'pages/docs.js',
  'pages/settings.js',
  'pages/text-mode-practice.html',
  'pages/text-mode-tutorial.html',
  'icons/README.md',
  'icons/icon-source.png',
  'icons/icon.svg',
  'icons/icon76.png',
  '.DS_Store',
]);

const FIREFOX_EXCLUDED_DIRECTORIES = [
  'keyboard/',
  'plans/',
  'reference-info/',
  'img/',
  'tests/',
  'test-pages/',
];

const banner = `/**
 * KeyPilot Chrome Extension — esbuild bundle
 * Generated on ${new Date().toISOString()}
 */
`;

/**
 * Fail the build if a generated artifact cannot be parsed.
 * Uses esbuild instead of `node --check` so Bun builds do not execute browser code.
 * @param {string} outfile
 */
async function verifyGeneratedSyntax(outfile) {
  await esbuild.transform(fs.readFileSync(outfile, 'utf8'), {
    loader: 'js',
    target: 'chrome111',
    sourcefile: outfile,
  });
  console.log(`✓ syntax: ${path.basename(outfile)}`);
}

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome111'],
  legalComments: 'none',
  logLevel: 'info',
  banner: { js: banner },
  ...(enableMacroBuilder
    ? { define: { __KP_BUILD_ENABLE_MACRO_BUILDER__: 'true' } }
    : {})
};

const entries = [
  {
    infile: path.join(__dirname, 'src/content-script.js'),
    outfile: path.join(__dirname, 'content-bundled.js'),
    label: 'content (top frame)',
  },
  {
    infile: path.join(__dirname, 'src/frame-agent-entry.js'),
    outfile: path.join(__dirname, 'frame-agent-bundled.js'),
    label: 'frame-agent (child frames)',
  },
  {
    infile: path.join(__dirname, 'pages/docs.js'),
    outfile: path.join(__dirname, 'pages/docs-bundled.js'),
    label: 'documentation popover',
    format: 'esm',
  },
  {
    infile: path.join(__dirname, 'pages/settings.js'),
    outfile: path.join(__dirname, 'pages/settings-bundled.js'),
    label: 'settings popover / page',
    format: 'esm',
  },
];

/**
 * @param {{ infile: string, outfile: string, label: string }} entry
 * @param {{ minify?: boolean }} opts
 */
async function buildOne(entry, opts = {}) {
  const result = await esbuild.build({
    ...shared,
    format: entry.format || shared.format,
    entryPoints: [entry.infile],
    outfile: entry.outfile,
    minify: !!opts.minify,
    metafile: true,
    write: true,
  });

  await verifyGeneratedSyntax(entry.outfile);
  const bytes = fs.statSync(entry.outfile).size;
  const kb = (bytes / 1024).toFixed(1);
  const inputs = result.metafile ? Object.keys(result.metafile.inputs).length : '?';
  console.log(`✓ ${entry.label}: ${path.basename(entry.outfile)} (${kb}KB, ${inputs} inputs)`);
  return { outfile: entry.outfile, bytes, result };
}

function isFirefoxExcluded(relPath) {
  const rel = relPath.split(path.sep).join('/');
  return rel.split('/').includes('.DS_Store') ||
    FIREFOX_EXCLUDED_FILES.has(rel) ||
    FIREFOX_EXCLUDED_DIRECTORIES.some((dir) => rel.startsWith(dir)) ||
    (rel.startsWith('themes/') && rel.endsWith('/README.md'));
}

function copyFirefoxRuntimeFiles(sourceDir, destinationDir) {
  const copied = [];
  function visit(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const sourcePath = path.join(currentDir, entry.name);
      const relPath = path.relative(sourceDir, sourcePath);
      if (isFirefoxExcluded(relPath)) continue;
      const destinationPath = path.join(destinationDir, relPath);
      if (entry.isDirectory()) {
        fs.mkdirSync(destinationPath, { recursive: true });
        visit(sourcePath);
      } else if (entry.isFile()) {
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.copyFileSync(sourcePath, destinationPath);
        copied.push(relPath.split(path.sep).join('/'));
      }
    }
  }

  visit(sourceDir);
  return copied;
}

function collectFirefoxManifestPaths(manifest) {
  const paths = [];
  const add = (value) => {
    if (typeof value === 'string' && value) paths.push(value.replace(/^\/+/, ''));
  };

  for (const script of manifest.background?.scripts || []) add(script);
  add(manifest.action?.default_popup);
  for (const icon of Object.values(manifest.action?.default_icon || {})) add(icon);
  for (const icon of Object.values(manifest.icons || {})) add(icon);
  for (const group of manifest.content_scripts || []) {
    for (const script of group.js || []) add(script);
    for (const stylesheet of group.css || []) add(stylesheet);
  }
  return paths;
}

function createFirefoxManifest(sourceManifest) {
  const manifest = JSON.parse(JSON.stringify(sourceManifest));
  const background = { ...(manifest.background || {}) };
  delete background.service_worker;
  background.scripts = ['background.js'];
  manifest.background = background;
  manifest.browser_specific_settings = {
    ...(manifest.browser_specific_settings || {}),
    gecko: {
      ...(manifest.browser_specific_settings?.gecko || {}),
      id: FIREFOX_GECKO_ID,
    },
  };
  manifest.permissions = (manifest.permissions || []).filter(
    (permission) => permission !== 'favicon' && permission !== 'windows'
  );

  manifest.web_accessible_resources = (manifest.web_accessible_resources || [])
    .map((group) => ({
      ...group,
      resources: (group.resources || []).filter((resource) => resource !== '_favicon/*'),
    }))
    .filter((group) => group.resources.length > 0);

  const extensionPagesCsp = manifest.content_security_policy?.extension_pages;
  if (typeof extensionPagesCsp === 'string') {
    manifest.content_security_policy.extension_pages = extensionPagesCsp.replace(/\bchrome:/g, 'moz-extension:');
  }
  return manifest;
}

function stageFirefoxBuild() {
  const outputDir = path.resolve(__dirname, '..', 'extension-firefox');
  const sourceManifestPath = path.join(__dirname, 'manifest.json');
  const sourceManifestContent = fs.readFileSync(sourceManifestPath, 'utf8');
  const sourceManifest = JSON.parse(sourceManifestContent);

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  const copied = copyFirefoxRuntimeFiles(__dirname, outputDir);
  const manifest = createFirefoxManifest(sourceManifest);
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 4)}\n`);

  const errors = [];
  if (manifest.background?.service_worker) errors.push('Firefox manifest must not include background.service_worker');
  if (manifest.browser_specific_settings?.gecko?.id !== FIREFOX_GECKO_ID) {
    errors.push('Firefox manifest must include the configured Gecko ID');
  }
  if (JSON.stringify(manifest.permissions || []).includes('"favicon"')) errors.push('Firefox manifest must not include the favicon permission');
  if (JSON.stringify(manifest.permissions || []).includes('"windows"')) errors.push('Firefox manifest must not include the windows permission');
  if (JSON.stringify(manifest.web_accessible_resources || []).includes('_favicon/')) errors.push('Firefox manifest must not include _favicon resources');
  if (manifest.content_security_policy?.extension_pages?.includes('chrome:')) errors.push('Firefox manifest CSP must not include chrome:');
  for (const relPath of collectFirefoxManifestPaths(manifest)) {
    if (!fs.existsSync(path.join(outputDir, relPath))) {
      errors.push(`Manifest path missing from Firefox output: ${relPath}`);
    }
  }
  if (fs.readFileSync(sourceManifestPath, 'utf8') !== sourceManifestContent) {
    errors.push('Firefox staging must not modify extension/manifest.json');
  }
  if (errors.length) throw new Error(`Firefox build validation failed:\n- ${errors.join('\n- ')}`);

  console.log(`✓ Firefox extension staged: ${outputDir} (${copied.length + 1} files)`);
}

console.log(`Starting build (esbuild, minify=${shouldMinify}, macroBuilder=${enableMacroBuilder}, firefox=${shouldBuildFirefox})...`);
const started = Date.now();

for (const entry of entries) {
  await buildOne(entry, { minify: false });
}

if (shouldMinify) {
  const contentEntry = entries[0];
  const minOut = path.join(__dirname, 'content-bundled.min.js');
  console.log('Writing content-bundled.min.js...');
  await esbuild.build({
    ...shared,
    entryPoints: [contentEntry.infile],
    outfile: minOut,
    minify: true,
    write: true,
  });
  await verifyGeneratedSyntax(minOut);
  const kb = (fs.statSync(minOut).size / 1024).toFixed(1);
  console.log(`✓ content-bundled.min.js (${kb}KB)`);
}

console.log(`esbuild finished in ${Date.now() - started}ms`);

await runPostBundleTasks({ shouldMinify, enableMacroBuilder });

if (shouldBuildFirefox) {
  stageFirefoxBuild();
}
