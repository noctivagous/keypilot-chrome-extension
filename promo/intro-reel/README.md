# KeyPilot intro reel

Research snapshot (Brave Search + HyperFrames docs + Chrome listing docs), 19 Sep 2026.

## What it is

[HyperFrames](https://github.com/heygen-com/hyperframes) (HeyGen, Apache 2.0) turns **HTML + CSS + seekable animation + media** into a **deterministic MP4**. Agents write ordinary HTML; the CLI seeks frame-by-frame in headless Chrome and encodes with FFmpeg.

- Site: https://hyperframes.heygen.com/
- Playground: https://www.hyperframes.dev/
- License: Apache 2.0 (no per-render fee)
- Requirements: Node.js 22+, FFmpeg
- Loop: `npx hyperframes init` → `preview` → `lint` / `check` → `render --output out.mp4`

A composition is an HTML stage with `data-start` / `data-duration` / `data-width` / `data-height`. Animation must be **seekable** (paused GSAP timeline registered on `window.__timelines`, CSS keyframes, Lottie, Three.js, WAAPI, etc.). Wall-clock-only SMIL (what the current key-click SVGs use) is **not** a drop-in source.

Closest analogue: [Remotion](https://www.remotion.dev), but HyperFrames bets on plain HTML instead of React.

Agent entry: `npx skills add heygen-com/hyperframes` then the `/hyperframes` router. The skill that matches us best is **`/product-launch-video`**: website / product promo, ~30–90s sweet spot, up to ~3 min.

## What we have today

| Surface | Current asset | Gap |
|---|---|---|
| noctivagous.com hero | Looping `cyberpilotfloat-optimized.mp4` (decorative, muted, `aria-hidden`) | Same file on `en` / `de` / `es` / `es_419`. Not an explainer. |
| Site key-click demo | SMIL SVGs (`web/assets/keyclick-*.svg` + locale copies) | Lightweight and already localized, but not a store video. |
| Chrome Web Store | Localized **screenshots** for `en`, `de`, `es`, `es_419` (`store:screenshots`). Promo **tiles** are global, no text. | Listing still wants a **YouTube URL**. Chrome does not take a raw MP4. Video **can** be localized per dashboard locale. |

Chrome listing order of graphic assets: localized video → localized screenshots → global video → global screenshots. A localized HyperFrames cut would sit **above** the screenshots we already generate.

Chrome does **not** localize the 440×280 / 1400×560 promo tiles; keep those text-free. Video is the right place for spoken or on-screen copy.

## How it helps the Chrome listing

HyperFrames does **not** upload to the store. The pipeline is:

1. Author one HTML composition (1920×1080, 30 fps is the CLI default).
2. `npx hyperframes render --output keypilot-en.mp4` (or `--quality high`).
3. Upload that file to YouTube (unlisted or public).
4. Paste the URL into **Promo video** / **Localized promo video** in the Developer Dashboard.

Useful HyperFrames pieces for that cut:

- **`/product-launch-video`** from https://noctivagous.com/ plus a short script (key-click, F / G / D, MIT, Chrome Web Store CTA).
- **`frame.md`**: invert site tokens (the Inter + rose/sage/navy palette in `site.css`) so the video matches the listing screenshots instead of generic HeyGen catalog looks.
- **Variables / batch render**: same timeline, swap copy for `de`, `es`, `es_419` — same idea as locale folders on the site and `online-stores/generated/chrome/<locale>/`.
- **Captions** (`/embedded-captions`) if we keep one English master and localize with burned-in or YouTube captions. Burned-in per locale is closer to how we already ship distinct screenshots.
- Catalog blocks for kinetic type, transitions, lower-thirds.

Keep the store video **product-true**: mouse steers, F opens, D goes back. Do not invent UI that the extension does not have. Chrome also warns if localized listing metadata diverges from the described feature set.

Length: 30–90s is the HyperFrames product-launch sweet spot and is enough for CWS. YouTube is 16:9; 1920×1080 is the right master.

## How it helps the website

Three separate jobs. Do not collapse them into one file.

1. **Hero bed (keep the current MP4)**  
   Ambient loop, no copy. HyperFrames is overkill unless we want a *programmatic* restyle of that loop. Leave `cyberpilotfloat-optimized.mp4` unless we later render a WebM with alpha (`--format webm`) as a lighter overlay.

2. **Explainer / trailer (new)**  
   The same MP4 we upload to YouTube can sit below the fold or on a “Watch” control. Formats HyperFrames can emit that the site can use: **MP4** (universal), **WebM**, **HLS** (`master.m3u8` for self-hosted VOD), **GIF** (docs / GitHub only).  
   Embed options:
   - `<video src="…mp4">` like the hero (simplest, matches current stack).
   - [`@hyperframes/player`](https://github.com/heygen-com/hyperframes) `<hyperframes-player>` if we want the HTML composition playable in-page without a pre-render (preview-quality, not a substitute for the YouTube listing file).

3. **Key-click diagram**  
   Replacing the SMIL SVGs is optional. HyperFrames would mean rewriting the demo as a seekable GSAP composition, then rendering MP4/WebM **or** keeping HTML for in-page preview. Cost: lose the tiny SVG file and the locale-specific SVG copies. Benefit: one composition + variables instead of four hand-edited SVGs; easier captions. Only worth it if the SVG set becomes painful as locales grow.

`/product-launch-video` can also **capture the live site** as footage inside the composition (site-tour skill). That is a fast way to get a first English trailer from noctivagous.com without rebuilding the key-click animation from scratch.

## Project layout

This intro reel lives in the extension repository so its source, locale data,
and rendering notes stay versioned together:

```text
promo/intro-reel/
  key-click-intro.html    # 1920×1080, ~35s
  hyperframes.json
  README.md
  locales/key-click-intro/   # en.json de.json es.json es_419.json batch.json
                             # HTML: key-click-intro.html?lang=de
  renders/                  # generated MP4s; ignored by Git
```

```bash
npx hyperframes preview
npx hyperframes render \
  --composition key-click-intro.html \
  --variables-file locales/key-click-intro/en.json \
  --output renders/key-click-intro-en.mp4
npx hyperframes render \
  --composition key-click-intro.html \
  --batch locales/key-click-intro/batch.json \
  --output "renders/key-click-intro-{locale}.mp4"
```

Script outline (aligns with the landing page):

1. Title: KeyPilot — keyboard-powered browsing  
2. Mouse points, F key-clicks a link (reuse the existing diagram art or a screen capture)  
3. G opens background tab; D goes back  
4. Bimodal Control one-liner  
5. CTA: Chrome Web Store + noctivagous.com  

Then batch the three non-English copies and add YouTube URLs beside the screenshot checklist in `online-stores/chrome/RELEASE-CHECKLIST.md`.

## What it will not do

- It will not replace CWS screenshots or promo tiles (wrong aspect, wrong review process).
- It will not skip YouTube for the store listing.
- It will not auto-play a store video on noctivagous.com unless we host the file ourselves.
- Existing `keyclick-*.svg` SMIL cannot be fed to the renderer as-is.
- Renders are slower than opening an SVG (headless Chrome × every frame). Fine for a trailer; wrong for a 10s infinite hero loop unless we render **once** and ship the MP4.

## Sources

- https://github.com/heygen-com/hyperframes  
- https://hyperframes.heygen.com/  
- https://hyperframes.heygen.com/guides/rendering  
- https://github.com/heygen-com/hyperframes-launch-video (worked example: `npx hyperframes preview` / `render`)  
- https://developer.chrome.com/docs/webstore/cws-dashboard-listing (promo video + per-locale video)  
- https://developer.chrome.com/docs/webstore/images (tiles are not locale-specific)
