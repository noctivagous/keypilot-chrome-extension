import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { planKeyInfoPopoverLayout } from '../extension/src/ui/key-info-popover-layout.js';

const GAP = 10;

describe('planKeyInfoPopoverLayout', () => {
  it('keeps the bottom arrow on the key and grows upward when there is room above', () => {
    const key = { targetTop: 500, targetBottom: 550, targetCenterX: 400 };
    const short = planKeyInfoPopoverLayout({
      ...key, popW: 200, popH: 100, settingsH: 40, vw: 1000, vh: 800
    });
    const tall = planKeyInfoPopoverLayout({
      ...key, popW: 200, popH: 180, settingsH: 120, vw: 1000, vh: 800
    });

    assert.equal(short.placement, 'top');
    assert.equal(tall.placement, 'top');
    assert.equal(short.top + short.usedH, key.targetTop - GAP);
    assert.equal(tall.top + tall.usedH, key.targetTop - GAP);
    assert.ok(tall.top < short.top);
    assert.equal(tall.settingsMaxHeight, null);
  });

  it('hangs below a top-aligned key and keeps the top arrow put as the card grows', () => {
    const key = { targetTop: 4, targetBottom: 54, targetCenterX: 400 };
    const short = planKeyInfoPopoverLayout({
      ...key, popW: 220, popH: 90, settingsH: 30, vw: 1000, vh: 800
    });
    const tall = planKeyInfoPopoverLayout({
      ...key, popW: 220, popH: 240, settingsH: 180, vw: 1000, vh: 800
    });

    assert.equal(short.placement, 'bottom');
    assert.equal(tall.placement, 'bottom');
    assert.equal(short.top, key.targetBottom + GAP);
    assert.equal(tall.top, key.targetBottom + GAP);
    assert.equal(tall.settingsMaxHeight, null);
  });

  it('flips below the key when growth no longer fits above', () => {
    const key = { targetTop: 160, targetBottom: 210, targetCenterX: 300 };
    const before = planKeyInfoPopoverLayout({
      ...key, popW: 200, popH: 80, settingsH: 20, vw: 900, vh: 800
    });
    const after = planKeyInfoPopoverLayout({
      ...key, popW: 200, popH: 220, settingsH: 160, vw: 900, vh: 800
    });

    assert.equal(before.placement, 'top');
    assert.equal(before.top + before.usedH, key.targetTop - GAP);
    assert.equal(after.placement, 'bottom');
    assert.equal(after.top, key.targetBottom + GAP);
  });

  it('scrolls the settings and keeps the arrow edge when neither side can hold the card', () => {
    const above = planKeyInfoPopoverLayout({
      targetTop: 220,
      targetBottom: 270,
      targetCenterX: 400,
      popW: 200,
      popH: 400,
      settingsH: 300,
      vw: 1000,
      vh: 420
    });
    assert.equal(above.placement, 'top');
    assert.equal(above.top + above.usedH, 220 - GAP);
    assert.equal(above.settingsMaxHeight, 100);

    const below = planKeyInfoPopoverLayout({
      targetTop: 30,
      targetBottom: 80,
      targetCenterX: 400,
      popW: 200,
      popH: 500,
      settingsH: 400,
      vw: 1000,
      vh: 500
    });
    assert.equal(below.placement, 'bottom');
    assert.equal(below.top, 80 + GAP);
    assert.ok(below.settingsMaxHeight != null && below.settingsMaxHeight < 400);
    assert.equal(below.usedH, 100 + below.settingsMaxHeight);
  });
});
