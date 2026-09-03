/**
 * Chrome Web Store package target. See scripts/package-channel.mjs.
 *
 * Does not rewrite extension/manifest.json. The shared `npm run build` step may
 * still stamp the development description; this script copies that file and
 * replaces the description only in dist/chrome/manifest.json.
 *
 * Usage:
 *   npm run package:chrome
 *   node scripts/package-chrome.mjs --skip-build
 */
import { packageChannel } from './package-channel.mjs';

const skipBuild = process.argv.includes('--skip-build');
packageChannel('chrome', { skipBuild }).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
