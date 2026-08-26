import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MODES, modeShowsClickableHover } from '../extension/src/config/constants.js';

describe('modeShowsClickableHover', () => {
  it('keeps Click Mode hover chrome in browsing, text focus, popover, and omnibox', () => {
    assert.equal(modeShowsClickableHover(MODES.NONE), true);
    assert.equal(modeShowsClickableHover(MODES.TEXT_FOCUS), true);
    assert.equal(modeShowsClickableHover(MODES.POPOVER), true);
    assert.equal(modeShowsClickableHover(MODES.OMNIBOX), true);
  });

  it('turns Click Mode off for selection rectangle and click-one-at-a-time pick modes', () => {
    assert.equal(modeShowsClickableHover(MODES.HIGHLIGHT), false);
    assert.equal(modeShowsClickableHover(MODES.INSPECTOR), false);
    assert.equal(modeShowsClickableHover(MODES.DELETE), false);
    assert.equal(modeShowsClickableHover(MODES.COLS), false);
    assert.equal(modeShowsClickableHover(MODES.SCROLL_LINE), false);
  });
});
