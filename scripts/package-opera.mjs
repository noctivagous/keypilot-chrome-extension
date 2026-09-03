/**
 * Opera Add-ons package target. See scripts/package-channel.mjs.
 *
 * Usage:
 *   npm run package:opera
 *   node scripts/package-opera.mjs --skip-build
 */
import { packageChannel } from './package-channel.mjs';

const skipBuild = process.argv.includes('--skip-build');
packageChannel('opera', { skipBuild }).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
