import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { resolveHoveredLink } from '../extension/src/utils/resolve-hovered-link.js';

const ELEMENT_NODE = 1;

class FakeAnchor {
  /**
   * @param {string} href
   * @param {Record<string, string>} [attrs]
   */
  constructor(href, attrs = {}) {
    this.nodeType = ELEMENT_NODE;
    this.tagName = 'A';
    this.href = href;
    this.parentElement = null;
    this.dataset = {};
    this._attrs = { href, ...attrs };
    /** @type {FakeEl[]} */
    this._children = [];
  }

  getAttribute(name) {
    return this._attrs[name] ?? null;
  }

  querySelector(sel) {
    if (sel === 'time' && this._children.some((c) => c.tagName === 'TIME')) return this._children[0];
    return null;
  }

  closest(sel) {
    if (sel === 'a[href]' && this.href) return this;
    return null;
  }

  getRootNode() {
    return { host: null };
  }
}

class FakeEl {
  /**
   * @param {string} tag
   * @param {{ role?: string, box?: { width: number, height: number } }} [opts]
   */
  constructor(tag, opts = {}) {
    this.nodeType = ELEMENT_NODE;
    this.tagName = tag.toUpperCase();
    this.parentElement = null;
    this.dataset = {};
    this._role = opts.role || '';
    this._box = opts.box || { width: 200, height: 80 };
    /** @type {Array<FakeEl|FakeAnchor>} */
    this._children = [];
  }

  getAttribute(name) {
    if (name === 'role') return this._role || null;
    return null;
  }

  getBoundingClientRect() {
    return {
      width: this._box.width,
      height: this._box.height,
      top: 0,
      left: 0,
      right: this._box.width,
      bottom: this._box.height
    };
  }

  /**
   * @param {FakeEl|FakeAnchor} child
   */
  append(child) {
    child.parentElement = this;
    this._children.push(child);
    return child;
  }

  querySelectorAll(sel) {
    if (sel !== 'a[href]' && sel !== '*') return [];
    /** @type {Array<FakeEl|FakeAnchor>} */
    const out = [];
    const walk = (n) => {
      for (const c of n._children || []) {
        if (sel === 'a[href]') {
          if (c.tagName === 'A' && c.href) out.push(c);
        } else {
          out.push(c);
        }
        if (c._children) walk(c);
      }
    };
    walk(this);
    return out;
  }

  closest(sel) {
    if (sel === 'a[href]') {
      let n = this;
      while (n) {
        if (n.tagName === 'A' && n.href) return n;
        n = n.parentElement;
      }
      return null;
    }
    return null;
  }

  getRootNode() {
    return { host: null };
  }
}

describe('resolveHoveredLink', () => {
  let prevLocation;
  let prevWindow;
  let prevDocument;

  before(() => {
    prevLocation = globalThis.location;
    prevWindow = globalThis.window;
    prevDocument = globalThis.document;
    globalThis.location = { href: 'https://example.com/' };
    globalThis.window = { innerWidth: 1280, innerHeight: 800 };
    globalThis.document = { body: {}, documentElement: {} };
  });

  after(() => {
    globalThis.location = prevLocation;
    globalThis.window = prevWindow;
    globalThis.document = prevDocument;
  });

  it('returns the ancestor <a href> when the cursor is on a link', () => {
    const a = new FakeAnchor('https://example.com/post/1');
    const span = new FakeEl('span');
    a._children = [span];
    span.parentElement = a;
    const found = resolveHoveredLink(span);
    assert.equal(found?.url, 'https://example.com/post/1');
    assert.equal(found?.link, a);
  });

  it('does not open the first page link from a viewport-sized shell', () => {
    const main = new FakeEl('main', { box: { width: 1200, height: 700 } });
    const first = new FakeAnchor('https://example.com/status/111');
    first._children = [new FakeEl('time')];
    const second = new FakeAnchor('https://example.com/status/222');
    second._children = [new FakeEl('time')];
    main.append(first);
    main.append(second);
    assert.equal(resolveHoveredLink(main), null);
  });

  it('does not treat a page-wrapping <article> as a feed card', () => {
    const article = new FakeEl('article', { box: { width: 1100, height: 720 } });
    const pad = new FakeEl('div', { box: { width: 1100, height: 80 } });
    const perma = new FakeAnchor('https://example.com/status/999');
    perma._children = [new FakeEl('time')];
    article.append(pad);
    article.append(perma);
    pad.parentElement = article;
    assert.equal(resolveHoveredLink(pad), null);
  });

  it('picks a descendant permalink inside a compact feed article', () => {
    const article = new FakeEl('article', { box: { width: 560, height: 220 } });
    const body = new FakeEl('div', { box: { width: 540, height: 160 } });
    const perma = new FakeAnchor('https://x.com/user/status/42');
    perma._children = [new FakeEl('time')];
    article.append(body);
    body.append(perma);
    const found = resolveHoveredLink(body);
    assert.equal(found?.url, 'https://x.com/user/status/42');
    assert.equal(found?.link, perma);
  });

  it('resolves a unique descendant link on a compact chip, not a page shell', () => {
    const chip = new FakeEl('div', { box: { width: 240, height: 32 } });
    const a = new FakeAnchor('https://mail.google.com/mail/u/0/#inbox');
    chip.append(a);
    const found = resolveHoveredLink(chip);
    assert.equal(found?.url, 'https://mail.google.com/mail/u/0/#inbox');
    assert.equal(found?.link, a);
  });
});
