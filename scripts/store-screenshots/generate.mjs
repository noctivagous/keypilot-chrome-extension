/**
 * Generate Chrome Web Store listing PNGs from SVG templates + locale captures.
 *
 *   npm run store:screenshots
 *   npm run store:screenshots -- --locale=en
 *   npm run store:screenshots -- --all
 *   npm run store:screenshots -- --promo-only
 */
import {
  ensureOverlayCjkFonts,
  generateLocaleScreenshots,
  generatePromoTiles,
  loadSlots,
  localesToGenerate,
  repoRoot
} from './lib.mjs';

function parseArgs(argv) {
  const opts = { all: false, promoOnly: false, locale: null };
  for (const arg of argv) {
    if (arg === '--all') opts.all = true;
    else if (arg === '--promo-only') opts.promoOnly = true;
    else if (arg.startsWith('--locale=')) opts.locale = arg.slice('--locale='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const slots = loadSlots(repoRoot);
  await ensureOverlayCjkFonts(repoRoot);

  const promo = generatePromoTiles(repoRoot, slots);
  for (const item of promo) {
    console.log(`Wrote ${item.file} (${item.bytes} bytes)`);
  }

  if (opts.promoOnly) return;

  const locales = localesToGenerate(repoRoot, slots, opts);
  for (const locale of locales) {
    const outputs = generateLocaleScreenshots(repoRoot, slots, locale);
    for (const item of outputs) {
      console.log(`Wrote ${item.file} (${item.bytes} bytes)`);
    }
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
