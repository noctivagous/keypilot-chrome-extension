import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getTextAtPoint } from '../extension/src/utils/text-at-point.js';

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

class FakeText {
  /**
   * @param {string} text
   * @param {FakeElement|null} parent
   */
  constructor(text, parent) {
    this.nodeType = TEXT_NODE;
    this.textContent = text;
    this.parentElement = parent;
  }
}

class FakeElement {
  /**
   * @param {string} tag
   * @param {FakeElement|null} [parent]
   */
  constructor(tag, parent = null) {
    this.nodeType = ELEMENT_NODE;
    this.tagName = tag.toUpperCase();
    this.parentElement = parent;
    /** @type {Array<FakeElement|FakeText>} */
    this.childNodes = [];
  }

  /**
   * @param {FakeElement|FakeText} node
   */
  append(node) {
    node.parentElement = this;
    this.childNodes.push(node);
    return node;
  }

  /**
   * @param {string} selector
   * @returns {FakeElement|null}
   */
  closest(selector) {
    const tags = selector.split(',').map((part) => part.trim().toUpperCase());
    /** @type {FakeElement|null} */
    let current = this;
    while (current) {
      if (tags.includes(current.tagName)) return current;
      current = current.parentElement;
    }
    return null;
  }
}

/**
 * @param {FakeElement} root
 * @param {(node: FakeText) => void} visit
 */
function walkText(root, visit) {
  for (const child of root.childNodes) {
    if (child.nodeType === TEXT_NODE) visit(/** @type {FakeText} */ (child));
    else walkText(/** @type {FakeElement} */ (child), visit);
  }
}

/**
 * @param {FakeText} caretNode
 * @param {number} caretOffset
 * @param {string} [lang]
 */
function fakeDocument(caretNode, caretOffset, lang = '') {
  return {
    documentElement: { lang },
    caretRangeFromPoint() {
      return { startContainer: caretNode, startOffset: caretOffset };
    },
    createTreeWalker(root, _what, filter) {
      /** @type {FakeText[]} */
      const nodes = [];
      walkText(root, (node) => {
        const accepted = !filter || filter.acceptNode(node) === 1;
        if (accepted) nodes.push(node);
      });
      let index = 0;
      return { nextNode: () => nodes[index++] || null };
    },
    createRange() {
      return {
        startContainer: null,
        startOffset: 0,
        endContainer: null,
        endOffset: 0,
        setStart(node, offset) {
          this.startContainer = node;
          this.startOffset = offset;
        },
        setEnd(node, offset) {
          this.endContainer = node;
          this.endOffset = offset;
        }
      };
    }
  };
}

describe('word under cursor across text nodes', () => {
  it('joins a CJK word split by rich-editor styling', () => {
    globalThis.Node = { TEXT_NODE, ELEMENT_NODE };
    globalThis.NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };

    const block = new FakeElement('div');
    const first = new FakeElement('span', block);
    const second = new FakeElement('span', block);
    block.childNodes.push(first, second);
    const firstText = new FakeText('你', first);
    const secondText = new FakeText('好世界', second);
    first.childNodes.push(firstText);
    second.childNodes.push(secondText);

    const doc = fakeDocument(secondText, 0);
    block.ownerDocument = doc;
    const result = getTextAtPoint(0, 0, {
      granularity: 'word',
      doc: /** @type {any} */ (doc)
    });

    assert.equal(result.text, '你好');
    assert.equal(result.range?.startContainer, firstText);
    assert.equal(result.range?.startOffset, 0);
    assert.equal(result.range?.endContainer, secondText);
    assert.equal(result.range?.endOffset, 1);
  });

  it('segments words and sentences with the page language', () => {
    globalThis.Node = { TEXT_NODE, ELEMENT_NODE };
    globalThis.NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };

    const original = Intl.Segmenter;
    /** @type {Array<string|undefined>} */
    const locales = [];
    function RecordingSegmenter(locale, options) {
      locales.push(locale);
      return new original(locale, options);
    }
    RecordingSegmenter.supportedLocalesOf = original.supportedLocalesOf.bind(original);
    Intl.Segmenter = /** @type {any} */ (RecordingSegmenter);

    try {
      const block = new FakeElement('p');
      const text = new FakeText('你好。世界', block);
      block.childNodes.push(text);
      const doc = fakeDocument(text, 0, 'zh-CN');
      block.ownerDocument = doc;
      const expected = original.supportedLocalesOf('zh-CN')[0];

      getTextAtPoint(0, 0, { granularity: 'word', doc: /** @type {any} */ (doc) });
      getTextAtPoint(0, 0, { granularity: 'sentence', doc: /** @type {any} */ (doc) });

      assert.deepEqual(locales, [expected, expected]);
    } finally {
      Intl.Segmenter = original;
    }
  });
});
