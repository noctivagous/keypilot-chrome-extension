import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { shouldShowScrollLineTargetBox } from '../extension/src/modules/scroll-line-overlay.js';

const view = { vw: 1440, vh: 900 };

describe('scroll line target ring', () => {
  it('never outlines iframes', () => {
    assert.equal(shouldShowScrollLineTargetBox({
      kind: 'iframe', width: 200, height: 120, ...view
    }), false);
    assert.equal(shouldShowScrollLineTargetBox({
      kind: 'frame', width: 1000, height: 860, ...view
    }), false);
  });

  it('hides page-sized panes', () => {
    assert.equal(shouldShowScrollLineTargetBox({
      kind: 'element',
      width: 1440 * 0.7,
      height: 900 * 0.9,
      ...view
    }), false);
    assert.equal(shouldShowScrollLineTargetBox({
      kind: 'element',
      width: 1440 * 0.42,
      height: 900 * 0.9,
      ...view
    }), false);
    assert.equal(shouldShowScrollLineTargetBox({
      kind: 'element',
      width: 1440 * 0.94,
      height: 900 * 0.94,
      ...view
    }), false);
  });

  it('keeps the ring on small overflow widgets', () => {
    assert.equal(shouldShowScrollLineTargetBox({
      kind: 'element', width: 320, height: 240, ...view
    }), true);
    assert.equal(shouldShowScrollLineTargetBox({
      kind: 'element',
      width: 1440 * 0.25,
      height: 900 * 0.9,
      ...view
    }), true);
  });
});
