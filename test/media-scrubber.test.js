import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  clamp01,
  mediaTimeFromClientX,
  isVolumeOrNonSeekSlider,
  resolveScrubberControl
} from '../extension/src/utils/media-scrubber.js';

describe('media-scrubber math', () => {
  it('clamp01 bounds and rejects NaN', () => {
    assert.equal(clamp01(0.4), 0.4);
    assert.equal(clamp01(-2), 0);
    assert.equal(clamp01(2), 1);
    assert.equal(clamp01(Number.NaN), 0);
  });

  it('maps clientX along a track onto duration', () => {
    const rect = { left: 100, width: 200 };
    assert.equal(mediaTimeFromClientX(100, rect, 80), 0);
    assert.equal(mediaTimeFromClientX(200, rect, 80), 40);
    assert.equal(mediaTimeFromClientX(300, rect, 80), 80);
    assert.equal(mediaTimeFromClientX(50, rect, 80), 0);
    assert.equal(mediaTimeFromClientX(400, rect, 80), 80);
  });

  it('rejects missing duration, live streams, and empty tracks', () => {
    const rect = { left: 0, width: 100 };
    assert.equal(mediaTimeFromClientX(50, rect, 0), null);
    assert.equal(mediaTimeFromClientX(50, rect, Infinity), null);
    assert.equal(mediaTimeFromClientX(50, { left: 0, width: 0 }, 80), null);
    assert.equal(mediaTimeFromClientX(Number.NaN, rect, 80), null);
  });
});

describe('media-scrubber volume vs timeline', () => {
  it('treats volume-labeled sliders as non-seek', () => {
    const vol = {
      nodeType: 1,
      getAttribute: (name) => (name === 'aria-label' ? 'Volume' : ''),
      hasAttribute: () => false,
      className: '',
      closest: () => null
    };
    assert.equal(isVolumeOrNonSeekSlider(vol), true);
  });

  it('does not treat a seek slider as volume', () => {
    const seek = {
      nodeType: 1,
      getAttribute: (name) => (name === 'aria-label' ? 'Seek slider' : ''),
      hasAttribute: () => false,
      className: 'ytp-progress-bar',
      closest: () => null
    };
    assert.equal(isVolumeOrNonSeekSlider(seek), false);
  });

  it('does not promote a play button to a scrubber', () => {
    const play = {
      nodeType: 1,
      tagName: 'BUTTON',
      getAttribute: () => 'Play',
      closest: () => null
    };
    assert.equal(resolveScrubberControl(play), null);
  });
});
