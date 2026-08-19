# KeyPilot Extension Icons

This directory contains the following icon files:

- `icon16.png` - 16×16 (toolbar)
- `icon32.png` - 32×32 (toolbar / retina)
- `icon48.png` - 48×48 (extensions management page)
- `icon76.png` - 76×76 (new-tab brand slot @2x for 38px display)
- `icon128.png` - 128×128 (Chrome Web Store / install dialog)
- `icon-source.png` - full-resolution source art (center-cropped when generating)
- `icon.svg` - legacy SVG (superseded by photo art)

## Icon Design

Front-facing cybernetic racing yoke with cyan (left) and amber (right) grip buttons on a black background. Source art uses transparent pixels whose RGB is magenta — flatten onto black before resize or the chroma shows through.

## Regenerating

From the repo root (requires ImageMagick). Point `SRC` at the latest source screenshot/PNG:

```bash
SRC="extension/icons/icon-source.png"
magick "$SRC" \
  -background black -alpha remove -alpha off \
  -fuzz 8% -trim +repage \
  -bordercolor black -border 6% \
  -background black -gravity center \
  -extent '%[fx:max(w,h)]x%[fx:max(w,h)]' \
  /tmp/kp-icon-square.png
for s in 16 32 48 76 128; do
  magick /tmp/kp-icon-square.png -filter Lanczos -resize ${s}x${s} -unsharp 0x0.6+0.9+0.02 -strip extension/icons/icon${s}.png
done
```

## Chrome Web Store

PNG sizes 16 / 48 / 128 (plus optional 32) as required by Chromium extension packaging.
