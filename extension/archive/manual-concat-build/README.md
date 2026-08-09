# Archived: manual concat build

This directory preserves the pre-esbuild KeyPilot bundler.

## What it was

`build.js` concatenated ESM source files in a hard-coded order, stripped
`import`/`export`, wrapped the result in an IIFE, and wrote:

- `extension/content-bundled.js`
- `extension/frame-agent-bundled.js`

It also ran post-bundle side effects (manifest timestamp, README/website
stamps, early-inject UI block). Those side effects now live in
`extension/build-side-effects.js` and are invoked by the esbuild-based
`extension/build.js`.

## Why archived

Default `npm run build` uses esbuild for real module-graph bundling and
tree-shaking. This concat pipeline is kept for reference / emergency rollback.

## How to run (not default)

From the repo root:

```bash
cd extension && node archive/manual-concat-build/build.js
```

Or:

```bash
npm run build:manual
```

Do not use this unless you intentionally want the old concat outputs.
