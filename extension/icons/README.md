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

Front-facing cybernetic racing yoke with cyan (left) and amber (right) grip buttons against a dark teal holographic circuit background.

## Regenerating

From the repo root (requires ImageMagick). Point `SRC` at the latest source screenshot/PNG:

```bash
SRC="Screenshot 2026-08-04 at 2.32.49 PM copy.png"
magick "$SRC" -gravity center -crop '%[fx:min(w,h)]x%[fx:min(w,h)]+0+0' +repage /tmp/kp-icon-square.png
for s in 16 32 48 76 128; do
  magick /tmp/kp-icon-square.png -resize ${s}x${s} -strip extension/icons/icon${s}.png
done
cp "$SRC" extension/icons/icon-source.png
```

## Chrome Web Store

PNG sizes 16 / 48 / 128 (plus optional 32) as required by Chromium extension packaging.
