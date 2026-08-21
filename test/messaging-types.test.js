import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MSG, TAB_UI_FORWARD_TYPES } from '../extension/src/messaging/types.js';

describe('messaging types', () => {
  it('freezes the MSG catalog and keeps UI-forward string values stable', () => {
    assert.equal(Object.isFrozen(MSG), true);
    assert.equal(MSG.OPEN_SETTINGS_POPOVER, 'KP_OPEN_SETTINGS_POPOVER');
    assert.equal(MSG.OPEN_GUIDE_POPOVER, 'KP_OPEN_GUIDE_POPOVER');
    assert.equal(MSG.OPEN_DOCS_POPOVER, 'KP_OPEN_DOCS_POPOVER');
    assert.equal(MSG.OPEN_ONBOARDING, 'KP_OPEN_ONBOARDING');
    assert.equal(MSG.LAUNCH_WALKTHROUGH, 'KP_LAUNCH_WALKTHROUGH');
    assert.equal(MSG.SUCCESS, 'KP_SUCCESS');
    assert.equal(MSG.ERROR, 'KP_ERROR');
  });

  it('lists exactly the five tab UI forward types used by the service worker', () => {
    assert.equal(Object.isFrozen(TAB_UI_FORWARD_TYPES), true);
    assert.deepEqual([...TAB_UI_FORWARD_TYPES], [
      MSG.OPEN_SETTINGS_POPOVER,
      MSG.OPEN_GUIDE_POPOVER,
      MSG.OPEN_DOCS_POPOVER,
      MSG.OPEN_ONBOARDING,
      MSG.LAUNCH_WALKTHROUGH
    ]);
  });
});
