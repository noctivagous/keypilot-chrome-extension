import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  deepElementFromPoint,
  deepestEventTarget,
  getAccessibleShadowRoot
} from '../extension/src/utils/element-from-point.js';

describe('getAccessibleShadowRoot', () => {
  let previousChrome;

  beforeEach(() => {
    previousChrome = globalThis.chrome;
  });

  afterEach(() => {
    globalThis.chrome = previousChrome;
  });

  it('returns an open shadowRoot', () => {
    const root = { mode: 'open' };
    assert.equal(getAccessibleShadowRoot({ shadowRoot: root }), root);
  });

  it('opens a closed shadow via chrome.dom', () => {
    const host = { shadowRoot: null };
    const closed = { mode: 'closed' };
    globalThis.chrome = {
      dom: { openOrClosedShadowRoot: (el) => (el === host ? closed : null) }
    };
    assert.equal(getAccessibleShadowRoot(host), closed);
  });

  it('opens a closed shadow via Firefox openOrClosedShadowRoot', () => {
    globalThis.chrome = undefined;
    const closed = { mode: 'closed' };
    const host = { shadowRoot: null, openOrClosedShadowRoot: closed };
    assert.equal(getAccessibleShadowRoot(host), closed);
  });
});

describe('deepElementFromPoint', () => {
  let previousChrome;

  beforeEach(() => {
    previousChrome = globalThis.chrome;
  });

  afterEach(() => {
    globalThis.chrome = previousChrome;
  });

  it('pierces a closed shadow host the way pokemon.com header nav is built', () => {
    const link = { id: 'pokedex' };
    const closedRoot = {
      elementFromPoint: () => link,
      querySelectorAll: () => [link]
    };
    const host = { shadowRoot: null, id: 'wrapper' };
    const doc = { elementFromPoint: () => host };
    globalThis.chrome = {
      dom: { openOrClosedShadowRoot: (el) => (el === host ? closedRoot : null) }
    };

    assert.equal(deepElementFromPoint(400, 30, doc), link);
  });

  it('stops at a host with no accessible shadow', () => {
    globalThis.chrome = undefined;
    const host = { shadowRoot: null };
    const doc = { elementFromPoint: () => host };
    assert.equal(deepElementFromPoint(10, 10, doc), host);
  });
});

describe('deepestEventTarget', () => {
  let previousChrome;

  beforeEach(() => {
    previousChrome = globalThis.chrome;
  });

  afterEach(() => {
    globalThis.chrome = previousChrome;
  });

  it('re-hit-tests when composedPath stops at a closed-shadow host', () => {
    const link = { id: 'pokedex', nodeType: 1 };
    const closedRoot = {
      elementFromPoint: () => link,
      querySelectorAll: () => [link]
    };
    const host = { shadowRoot: null, nodeType: 1, ownerDocument: null };
    const doc = { elementFromPoint: () => host };
    host.ownerDocument = doc;
    globalThis.chrome = {
      dom: { openOrClosedShadowRoot: (el) => (el === host ? closedRoot : null) }
    };
    const e = {
      clientX: 201,
      clientY: 80,
      composedPath: () => [host, doc]
    };
    assert.equal(deepestEventTarget(e, doc), link);
  });
});
