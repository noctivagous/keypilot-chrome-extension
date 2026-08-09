/**
 * KeyPilot extension build (esbuild).
 *
 * Bundles content + frame-agent entry points, then runs post-bundle side effects
 * (manifest stamp, README/website sync, early-inject UI block).
 *
 * The previous manual concat pipeline lives at:
 *   archive/manual-concat-build/build.js
 *
 * Usage:
 *   node build.js
 *   node build.js --minify   # also writes content-bundled.min.js
 */
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPostBundleTasks } from './build-side-effects.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shouldMinify = process.argv.includes('--minify') || process.argv.includes('-m');

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
];

/**
 * @param {{ infile: string, outfile: string, label: string }} entry
 * @param {{ minify?: boolean }} opts
 */
async function buildOne(entry, opts = {}) {
  const result = await esbuild.build({
    ...shared,
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

console.log(`Starting build (esbuild, minify=${shouldMinify})...`);
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

await runPostBundleTasks({ shouldMinify });
