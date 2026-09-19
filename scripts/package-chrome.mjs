/**
 * Chrome Web Store package target. See scripts/package-channel.mjs.
 *
 * Does not rewrite extension/manifest.json. After a release compile, the
 * staged copy is patched and the development files that build rewrote are
 * restored.
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
