import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';

const layoutIds = [
  'us-ansi-qwerty',
  'de-de-qwertz-iso',
  'es-es-qwerty-iso',
  'sk-sk-qwertz-iso',
  'ja-jis-106'
];

describe('keyboard hardware visual fixtures', () => {
  it('contains an SVG fixture for every shipped physical model', () => {
    for (const layoutId of layoutIds) {
      assert.equal(
        existsSync(`test/fixtures/keyboard-hardware-layouts/${layoutId}.svg`),
        true,
        layoutId
      );
    }
  });

  it('keeps SVG fixtures synchronized with the hardware registry', () => {
    assert.doesNotThrow(() => {
      execFileSync(process.execPath, ['scripts/generate-keyboard-layout-fixtures.mjs', '--check'], {
        stdio: 'pipe'
      });
    });
  });
});
