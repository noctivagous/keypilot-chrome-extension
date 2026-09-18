import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  clamp01,
  mediaTimeFromClientX,
  volumeFromClientPoint,
  sliderAxis,
  isVolumeOrNonSeekSlider,
  resolveScrubberControl,
  resolveVolumeControl
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

  it('does not promote mute in a YouTube-style playbar to the seek slider', () => {
    const slider = {
      nodeType: 1,
      tagName: 'DIV',
      getAttribute: (name) => (name === 'role' ? 'slider' : ''),
      hasAttribute: () => false,
      className: 'ytp-progress-bar',
      closest: function closest(sel) {
        return String(sel).includes('slider') ? this : null;
      },
      contains: (n) => n === slider,
      parentElement: null
    };
    const mute = {
      nodeType: 1,
      tagName: 'BUTTON',
      getAttribute: (name) => (name === 'aria-label' ? 'Mute' : ''),
      hasAttribute: () => false,
      className: 'ytp-mute-button',
      closest: (sel) => {
        const s = String(sel);
        if (s.includes('button') || s.includes('role="button"')) return mute;
        if (s.includes('slider')) return null;
        return null;
      },
      parentElement: null
    };
    const chrome = {
      nodeType: 1,
      tagName: 'DIV',
      getAttribute: () => '',
      hasAttribute: () => false,
      className: 'ytp-chrome-bottom',
      getBoundingClientRect: () => ({ width: 600, height: 40, left: 0, top: 0 }),
      querySelector: (sel) => {
        const s = String(sel);
        if (s.includes('button')) return mute;
        if (s.includes('slider')) return slider;
        return null;
      },
      contains: (n) => n === mute || n === slider,
      closest: () => null,
      parentElement: null
    };
    mute.parentElement = chrome;
    slider.parentElement = chrome;
    assert.equal(resolveScrubberControl(mute), null);

    const pad = {
      nodeType: 1,
      tagName: 'DIV',
      getAttribute: () => '',
      hasAttribute: () => false,
      className: '',
      closest: () => null,
      querySelector: () => null,
      getBoundingClientRect: () => ({ width: 12, height: 12, left: 0, top: 0 }),
      parentElement: chrome
    };
    assert.equal(resolveScrubberControl(pad), null);
  });

  it('maps a vertical volume bar: top = 1, bottom = 0', () => {
    const rect = { left: 0, top: 100, width: 12, height: 100 };
    assert.equal(volumeFromClientPoint(6, 100, rect, 'y'), 1);
    assert.equal(volumeFromClientPoint(6, 150, rect, 'y'), 0.5);
    assert.equal(volumeFromClientPoint(6, 200, rect, 'y'), 0);
    assert.equal(volumeFromClientPoint(6, 50, rect, 'y'), 1);
    assert.equal(volumeFromClientPoint(6, 250, rect, 'y'), 0);
  });

  it('treats a tall unlabeled slider as volume, not a seek bar', () => {
    const vol = {
      nodeType: 1,
      tagName: 'DIV',
      getAttribute: (name) => (name === 'role' ? 'slider' : ''),
      hasAttribute: () => false,
      className: 'ytp-volume-slider',
      closest: function closest(sel) {
        return String(sel).includes('slider') ? this : null;
      },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 12, height: 80 }),
      parentElement: null
    };
    assert.equal(sliderAxis(vol), 'y');
    assert.equal(isVolumeOrNonSeekSlider(vol), true);
    assert.equal(resolveScrubberControl(vol), null);
    assert.equal(resolveVolumeControl(vol), vol);
  });
});
