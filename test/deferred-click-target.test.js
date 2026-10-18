import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  closestFormButton,
  describeDeferredClickTarget,
  findDeferredClickTarget,
  isFormButton
} from '../extension/src/utils/deferred-click-target.js';

function element(tag, attrs = {}, children = [], text = '') {
  const node = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    id: attrs.id || '',
    attrs,
    value: attrs.value || '',
    textContent: text,
    parentElement: null,
    children: [],
    form: null,
    clicked: false,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    getRootNode() {
      return { host: null };
    },
    click() {
      this.clicked = true;
    }
  };
  for (const child of children) {
    child.parentElement = node;
    node.children.push(child);
  }
  return node;
}

function documentFrom(root) {
  const forms = [];
  const walk = (node) => {
    if (node.tagName === 'FORM') forms.push(node);
    for (const child of node.children) walk(child);
  };
  walk(root);
  return {
    documentElement: root,
    forms,
    getElementById(id) {
      const stack = [root];
      while (stack.length) {
        const node = stack.pop();
        if (node.id === id) return node;
        stack.push(...node.children);
      }
      return null;
    }
  };
}

describe('deferred click targets', () => {
  it('clicks the captured button and refuses a different one', () => {
    const save = element('button', { type: 'submit' }, [], 'Save');
    const cancel = element('button', { type: 'submit' }, [], 'Cancel');
    const body = element('body', {}, [save, cancel]);
    const doc = documentFrom(element('html', {}, [body]));

    const described = describeDeferredClickTarget(save, doc);
    assert.equal(findDeferredClickTarget(doc, described), save);

    save.textContent = 'Save draft';
    assert.equal(findDeferredClickTarget(doc, described), null);
    assert.equal(cancel.clicked, false);
  });

  it('describes a form submit input and a button reached through a child', () => {
    const submit = element('input', { type: 'submit', name: 'go', value: 'Go' });
    const label = element('span', {}, [], 'Send');
    const button = element('button', {}, [label], 'Send');
    const form = element('form', {}, [submit, button]);
    submit.form = form;
    button.form = form;
    const doc = documentFrom(element('html', {}, [element('body', {}, [form])]));

    assert.equal(isFormButton(submit), true);
    assert.equal(closestFormButton(label), button);
    const described = describeDeferredClickTarget(submit, doc);
    assert.equal(described.formIndex, 0);
    assert.equal(findDeferredClickTarget(doc, described), submit);
    assert.equal(findDeferredClickTarget(doc, describeDeferredClickTarget(button, doc)), button);
  });

  it('does not describe a shadow button as a light-DOM selector', () => {
    const shadowButton = element('button', {}, [], 'Save');
    shadowButton.getRootNode = () => ({ host: element('div') });
    const pageButton = element('button', {}, [], 'Save');
    const doc = documentFrom(element('html', {}, [element('body', {}, [pageButton])]));
    assert.equal(describeDeferredClickTarget(shadowButton, doc), null);
    assert.equal(pageButton.clicked, false);
  });
});
