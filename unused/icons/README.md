# KeyPilot Extension Icons

This directory contains the following icon files:

- `icon16.png` - 16×16 (toolbar)
- `icon32.png` - 32×32 (toolbar / retina)
- `icon48.png` - 48×48 (extensions management page)
- `icon76.png` - 76×76 (new-tab brand slot @2x for 38px display)
- `icon128.png` - 128×128 (Chrome Web Store / install dialog)
- `icon256.png` - 256×256 (high-DPI source; declared in `icons`, not `action.default_icon`)
- `icon-source.png` - full-resolution source art (edge-to-edge; alpha-trimmed when generating)
- `icon.svg` - legacy SVG (superseded by photo art)

## Icon Design

Front-facing cybernetic racing yoke with cyan (left) and amber (right) grip buttons. Background is transparent. Source fills the width (no side margins); square canvases pad top/bottom only. Neutralize leftover magenta fringe under low-alpha edge pixels before resize.

## Regenerating

From the repo root (requires ImageMagick):

```bash
SRC="extension/icons/icon-source.png"
BOUNDS=$(magick "$SRC" -alpha extract -trim -format '%wx%h%O' info:)
magick "$SRC" \
  -channel RGB -fuzz 20% -fill black -opaque '#FF00FF' +channel \
  -background none \
  -crop "$BOUNDS" +repage \
  -gravity center \
  -extent '%[fx:max(w,h)]x%[fx:max(w,h)]' \
  PNG32:/tmp/kp-icon-square.png
for s in 16 32 48 76 128 256; do
  magick /tmp/kp-icon-square.png -background none -filter Lanczos \
    -resize ${s}x${s} -unsharp 0x0.6+0.9+0.02 -strip \
    PNG32:extension/icons/icon${s}.png
done
```

## Chrome Web Store

PNG sizes 16 / 48 / 128 (plus optional 32) as required by Chromium extension packaging. 256 is valid in the `icons` map (Chrome picks the closest size) but is not a documented toolbar or Web Store size.
