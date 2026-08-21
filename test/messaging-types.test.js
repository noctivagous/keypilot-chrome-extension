import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MSG, TAB_UI_FORWARD_TYPES } from '../extension/src/messaging/types.js';
import {
  errorResponse,
  isKnownMessageType,
  isServiceWorkerRequestType,
  isTabUiForwardType,
  validateRuntimeMessage
} from '../extension/src/messaging/validate.js';

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
    assert.equal(MSG.ACK, 'KP_ACK');
  });

  it('registers SW response types used by background handlers', () => {
    assert.equal(MSG.OMNIBOX_SUGGESTIONS, 'KP_OMNIBOX_SUGGESTIONS');
    assert.equal(MSG.BOOKMARKS_RESPONSE, 'KP_BOOKMARKS_RESPONSE');
    assert.equal(MSG.RECENT_BOOKMARKS_RESPONSE, 'KP_RECENT_BOOKMARKS_RESPONSE');
    assert.equal(MSG.MOST_VISITED_RESPONSE, 'KP_MOST_VISITED_RESPONSE');
    assert.equal(MSG.TOP_SITES_RESPONSE, 'KP_TOP_SITES_RESPONSE');
    assert.equal(MSG.HISTORY_FOR_DOMAINS_RESPONSE, 'KP_HISTORY_FOR_DOMAINS_RESPONSE');
    assert.equal(MSG.RECENT_HISTORY_RESPONSE, 'KP_RECENT_HISTORY_RESPONSE');
    assert.equal(MSG.BROWSER_HISTORY_RESULT, 'KP_BROWSER_HISTORY_RESULT');
    assert.equal(MSG.NAVGRAPH_GRAPH, 'KP_NAVGRAPH_GRAPH');
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
    for (const t of TAB_UI_FORWARD_TYPES) {
      assert.equal(isTabUiForwardType(t), true);
    }
  });
});

describe('messaging validate', () => {
  it('accepts known SW requests and rejects unknown or non-SW types', () => {
    assert.equal(isKnownMessageType(MSG.GET_STATE), true);
    assert.equal(isKnownMessageType('KP_NOT_A_REAL_TYPE'), false);
    assert.equal(isServiceWorkerRequestType(MSG.GET_STATE), true);
    assert.equal(isServiceWorkerRequestType(MSG.FRAME_ACTIVATE), false);
    assert.equal(
      validateRuntimeMessage({ type: MSG.GET_STATE }, { requireSwRequest: true }),
      null
    );
    assert.match(
      validateRuntimeMessage({ type: MSG.FRAME_ACTIVATE }, { requireSwRequest: true }) || '',
      /not accepted by service worker/
    );
    assert.match(validateRuntimeMessage(null) || '', /non-null object/);
    assert.match(validateRuntimeMessage({ type: 'KP_NOPE' }) || '', /Unknown message type/);
  });

  it('checks high-value payloads', () => {
    assert.match(
      validateRuntimeMessage({ type: MSG.TRANSIENT_ACTION }) || '',
      /action/
    );
    assert.equal(
      validateRuntimeMessage({ type: MSG.TRANSIENT_ACTION, action: 'back' }),
      null
    );
    assert.match(
      validateRuntimeMessage({ type: MSG.SET_STATE }) || '',
      /enabled/
    );
    assert.equal(
      validateRuntimeMessage({ type: MSG.SET_STATE, enabled: true }),
      null
    );
    assert.match(
      validateRuntimeMessage({ type: MSG.OPEN_URL_FOREGROUND }) || '',
      /url/
    );
    assert.equal(
      validateRuntimeMessage({ type: MSG.NAVGRAPH_JUMP, url: 'https://example.com' }),
      null
    );
  });

  it('builds ERROR envelopes', () => {
    assert.deepEqual(errorResponse('boom'), { type: MSG.ERROR, error: 'boom' });
  });
});
