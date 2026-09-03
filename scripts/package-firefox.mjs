/**
 * Firefox package target. See scripts/package-channel.mjs.
 *
 * Creates an AMO-submittable ZIP from the Firefox-specific staged extension.
 *
 * Usage:
 *   npm run package:firefox
 *   node scripts/package-firefox.mjs --skip-build
 */
import { packageChannel } from './package-channel.mjs';

const skipBuild = process.argv.includes('--skip-build');
packageChannel('firefox', { skipBuild }).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
