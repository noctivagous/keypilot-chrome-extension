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
  it('keeps every shipped locale navigation and Markdown topic tree aligned', () => {
    const sourceRoot = join(docsRoot, 'en');
    const sourceIndex = JSON.parse(readFileSync(join(sourceRoot, 'index.json'), 'utf8'));
    const sourceTopics = flattenTopics(sourceIndex.topics);
    const sourceIds = sourceTopics.map((topic) => topic.id).sort();
    const sourceFiles = sourceTopics.filter((topic) => topic.file).map((topic) => topic.file).sort();
    const locales = readdirSync(docsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'images')
      .map((entry) => entry.name);

    for (const locale of locales) {
      const localeRoot = join(docsRoot, locale);
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
      assert.deepEqual([...ids].sort(), sourceIds, `${locale} topic IDs match English`);
      assert.deepEqual([...indexedFiles].sort(), sourceFiles, `${locale} topic files match English`);
    }
  });

  it('keeps screenshots shared by default and documents locale-specific paths', () => {
    const policy = readFileSync(join(docsRoot, 'README.md'), 'utf8');
    assert.match(policy, /userdocs\/images\//);
    assert.match(policy, /userdocs\/<locale>\/images\//);
  });
});
