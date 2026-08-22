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

const banner = `/**
 * KeyPilot Chrome Extension — esbuild bundle
 * Generated on ${new Date().toISOString()}
 */
`;

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

  const bytes = fs.statSync(entry.outfile).size;
  const kb = (bytes / 1024).toFixed(1);
  const inputs = result.metafile ? Object.keys(result.metafile.inputs).length : '?';
  console.log(`✓ ${entry.label}: ${path.basename(entry.outfile)} (${kb}KB, ${inputs} inputs)`);
  return { outfile: entry.outfile, bytes, result };
}

console.log(`Starting build (esbuild, minify=${shouldMinify}, macroBuilder=${enableMacroBuilder})...`);
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
  const kb = (fs.statSync(minOut).size / 1024).toFixed(1);
  console.log(`✓ content-bundled.min.js (${kb}KB)`);
}

console.log(`esbuild finished in ${Date.now() - started}ms`);

await runPostBundleTasks({ shouldMinify, enableMacroBuilder });
