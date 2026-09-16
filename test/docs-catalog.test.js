import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = join(import.meta.dirname, '..');
const docsRoot = join(root, 'extension', 'userdocs');

function flattenTopics(topics, out = []) {
  for (const topic of topics || []) {
    out.push(topic);
    flattenTopics(topic.children, out);
  }
  return out;
}

describe('documentation locale catalog', () => {
  it('keeps the English navigation and Markdown topic tree aligned', () => {
    const localeRoot = join(docsRoot, 'en');
    const index = JSON.parse(readFileSync(join(localeRoot, 'index.json'), 'utf8'));
    const topics = flattenTopics(index.topics);
    const ids = new Set();

    for (const topic of topics) {
      assert.equal(ids.has(topic.id), false, `duplicate topic id: ${topic.id}`);
      ids.add(topic.id);
      assert.equal(typeof topic.title, 'string', `missing title: ${topic.id}`);
      if (topic.file) {
        assert.equal(
          existsSync(join(localeRoot, topic.file)),
          true,
          `missing Markdown topic: ${topic.file}`
        );
      }
    }

    const markdownFiles = new Set(
      readdirSync(localeRoot).filter((file) => file.endsWith('.md'))
    );
    const indexedFiles = new Set(topics.filter((topic) => topic.file).map((topic) => topic.file));
    assert.deepEqual([...markdownFiles].sort(), [...indexedFiles].sort());
  });

  it('keeps screenshots shared by default and documents locale-specific paths', () => {
    const policy = readFileSync(join(docsRoot, 'README.md'), 'utf8');
    assert.match(policy, /userdocs\/images\//);
    assert.match(policy, /userdocs\/<locale>\/images\//);
  });
});
