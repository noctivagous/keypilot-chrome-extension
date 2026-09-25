import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PAGE_ZOOM_PRESETS,
  ZOOM_AT_POINT,
  ZOOM_CSS_PREVIEW,
  ZOOM_NATIVE_ANIM,
  interpolateZoom,
  previewOrigin,
  scrollToKeepPoint,
  stepZoomFactor,
  zoomPreviewScale
} from '../extension/src/utils/page-zoom.js';

describe('page zoom steps', () => {
  it('applies one browser zoom step by default', () => {
    assert.equal(ZOOM_CSS_PREVIEW, false);
    assert.equal(ZOOM_AT_POINT, false);
    assert.equal(ZOOM_NATIVE_ANIM, false);
  });

  it('interpolates zoom geometrically and lands on the endpoints', () => {
    assert.equal(interpolateZoom(1, 1.1, 0), 1);
    assert.ok(Math.abs(interpolateZoom(1, 1.1, 1) - 1.1) < 1e-9);
    const mid = interpolateZoom(1, 1.1, 0.5);
    assert.ok(mid > 1 && mid < 1.1);
    assert.ok(mid > 1.05);
  });

  it('steps through presets in both directions and clamps at the ends', () => {
    assert.equal(stepZoomFactor(1, 1), 1.1);
    assert.equal(stepZoomFactor(1, -1), 0.9);
    assert.equal(stepZoomFactor(1.1, 1), 1.25);
    assert.equal(stepZoomFactor(5, 1), 5);
    assert.equal(stepZoomFactor(0.25, -1), 0.25);
    assert.equal(stepZoomFactor(Number.NaN, 1), 1.1);
  });

  it('treats nearby one-third factors as the same preset', () => {
    assert.equal(stepZoomFactor(0.33, 1), 0.5);
    assert.equal(stepZoomFactor(1 / 3, -1), 0.25);
    assert.equal(PAGE_ZOOM_PRESETS[1], 1 / 3);
  });
});

describe('zoom anchor scroll', () => {
  it('keeps the document point under the cursor when zooming in', () => {
    const scroll = { x: 100, y: 40 };
    const client = { x: 400, y: 200 };
    const docX = scroll.x + client.x;
    const docY = scroll.y + client.y;
    const next = scrollToKeepPoint(scroll, client, 1, 1.1);
    const scale = 1 / 1.1;
    assert.ok(Math.abs((next.x + client.x * scale) - docX) < 1e-9);
    assert.ok(Math.abs((next.y + client.y * scale) - docY) < 1e-9);
  });

  it('places the preview origin at the cursor inside a scrolled border box', () => {
    assert.deepEqual(
      previewOrigin({ x: 100, y: 80 }, { left: 0, top: -200 }),
      { x: 100, y: 280 }
    );
    assert.deepEqual(
      previewOrigin({ x: 40, y: 10 }, { left: 0, top: 0 }),
      { x: 40, y: 10 }
    );
  });

  it('previews a zoom step as a CSS scale against the committed factor', () => {
    assert.equal(zoomPreviewScale(1, 1.1), 1.1);
    assert.ok(Math.abs(zoomPreviewScale(1, 1.25) - 1.25) < 1e-9);
    assert.equal(zoomPreviewScale(1, 1), 1);
    assert.equal(zoomPreviewScale(0, 1.1), 1);
  });

  it('leaves scroll unchanged when the factor does not change', () => {
    assert.deepEqual(
      scrollToKeepPoint({ x: 10, y: 20 }, { x: 30, y: 40 }, 1, 1),
      { x: 10, y: 20 }
    );
  });
});
