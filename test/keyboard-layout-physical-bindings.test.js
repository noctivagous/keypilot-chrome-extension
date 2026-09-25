import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

globalThis.chrome = {
  i18n: {
    getMessage: () => ''
  }
};

const {
  buildKeybindingsForLayout,
  buildSystemKeybindings,
  createCharacterKeyAssignment,
  getKeyboardUiLayoutForLayout
} = await import('../extension/src/config/keyboard-layouts.js');
const {
  characterSlotKeyForCharacter,
  physicalCodeFromSlotKey,
  physicalSlotKeyForCode
} = await import('../extension/src/modules/keyboard-layout-store.js');

describe('built-in keyboard layout physical bindings', () => {
  it('binds every built-in action by DOM code', () => {
    for (const layoutId of ['browsing-right', 'browsing-left', 'basic-navigation-right', 'basic-navigation-left', 'click-history-right', 'click-history-left']) {
      const bindings = buildKeybindingsForLayout(layoutId);
      for (const [actionId, binding] of Object.entries(bindings)) {
        assert.equal(binding.bindingType, 'physical', `${layoutId}:${actionId}`);
        assert.deepEqual(binding.matchOn, ['code'], `${layoutId}:${actionId}`);
        assert.equal(binding.keys.length, 1, `${layoutId}:${actionId}`);
        assert.match(binding.keys[0], /^(Key[A-Z]|Backspace|Semicolon|Comma|Period|Slash|BracketLeft|BracketRight)$/, `${layoutId}:${actionId}`);
      }
    }
  });

  it('binds system-layer actions by DOM code', () => {
    for (const handedness of ['right', 'left']) {
      const bindings = buildSystemKeybindings(handedness);
      for (const [actionId, binding] of Object.entries(bindings)) {
        assert.equal(binding.bindingType, 'physical', `${handedness}:${actionId}`);
        assert.deepEqual(binding.matchOn, ['code'], `${handedness}:${actionId}`);
        assert.match(binding.keys[0], /^(Escape|Key[A-Z]|Quote)$/, `${handedness}:${actionId}`);
      }
    }
  });

  it('keeps character-semantic bindings explicitly typed', () => {
    const binding = createCharacterKeyAssignment(['ñ', 'Ñ'], { displayKey: 'Ñ' });

    assert.equal(binding.bindingType, 'character');
    assert.deepEqual(binding.matchOn, ['key']);
    assert.deepEqual(binding.keys, ['ñ', 'Ñ']);
    assert.equal(binding.displayKey, 'Ñ');
  });

  it('keeps persisted physical and character slots distinct', () => {
    const physical = physicalSlotKeyForCode('KeyY');
    const character = characterSlotKeyForCharacter('y');

    assert.equal(physical, 'code:KeyY');
    assert.equal(character, 'key:y');
    assert.notEqual(physical, character);
    assert.equal(physicalCodeFromSlotKey(physical), 'KeyY');
    assert.equal(physicalCodeFromSlotKey(character), '');
  });

  it('renders the selected hardware model without moving built-in actions', () => {
    const cells = getKeyboardUiLayoutForLayout('browsing-right', {
      hardwareLayoutId: 'de-de-qwertz-iso'
    }).flat();
    const keyY = cells.find((cell) => cell.code === 'KeyY');
    const keyZ = cells.find((cell) => cell.code === 'KeyZ');

    assert.equal(keyY.legend, 'Z');
    assert.equal(keyZ.legend, 'Y');
    assert.equal(keyY.id, 'RECTANGLE_HIGHLIGHT');
    assert.equal(keyZ.id, 'PAGE_TOP');
  });

  it('uses the hardware legend for action keycaps instead of a US display label', async () => {
    const rendererSource = await readFile('extension/src/ui/keybindings-ui.js', 'utf8');
    assert.match(
      rendererSource,
      /item\.legend \|\| \(binding && binding\.displayKey\)/
    );
  });

  it('keeps custom physical and character dispatch distinct', async () => {
    const keyPilotSource = await readFile('extension/src/keypilot.js', 'utf8');

    assert.match(
      keyPilotSource,
      /const physicalSlot = physicalSlotKeyForCode\(e\?\.code\);[\s\S]*const characterSlot = characterSlotKeyForCharacter\(e\?\.key\);[\s\S]*slots\[physicalSlot\] \|\| slots\[characterSlot\]/
    );
    assert.equal(characterSlotKeyForCharacter('z'), 'key:z');
    assert.equal(physicalSlotKeyForCode('KeyY'), 'code:KeyY');
  });

  it('dispatches physical bindings and pressed feedback by event.code', async () => {
    const [keyPilotSource, keyboardHelpSource] = await Promise.all([
      readFile('extension/src/keypilot.js', 'utf8'),
      readFile('extension/src/ui/floating-keyboard-help.js', 'utf8')
    ]);

    assert.match(
      keyPilotSource,
      /keybinding\.bindingType === 'physical'[\s\S]*keybinding\.keys\.includes\(String\(e\.code \|\| ''\)\)/
    );
    assert.equal(
      (keyPilotSource.match(/if \(!this\._matchesKeybinding\(keybinding, e\)\) continue;/g) || []).length,
      2
    );
    assert.match(
      keyboardHelpSource,
      /if \(code && code !== 'Unidentified'\)[\s\S]*else \{[\s\S]*const key = e && typeof e\.key === 'string'/
    );
  });

  it('uses the physical Click Element binding during the Text Mode hover window', async () => {
    const keyPilotSource = await readFile('extension/src/keypilot.js', 'utf8');

    assert.match(
      keyPilotSource,
      /Text mode isolation[\s\S]*this\._matchesKeybinding\(KB\.ACTIVATE, e\)[\s\S]*this\._textModeClickArmed/
    );
  });

  it('matches physical bindings in focused iframe and popover input paths', async () => {
    const [keyPilotSource, frameAgentSource] = await Promise.all([
      readFile('extension/src/keypilot.js', 'utf8'),
      readFile('extension/src/modules/frame-click-agent.js', 'utf8')
    ]);

    assert.match(
      keyPilotSource,
      /Allow click keys to interact with popover UI[\s\S]*this\._matchesKeybinding\(KB\.ACTIVATE, e\)/
    );
    assert.match(
      frameAgentSource,
      /assignment\.bindingType === 'physical'[\s\S]*keys\.includes\(String\(event\.code \|\| ''\)\)/
    );
    assert.match(
      frameAgentSource,
      /bindingMatchesEvent\(kb\.ACTIVATE, e\)/
    );
  });

  it('completes rectangle selection through physical bindings and displays a keycap', async () => {
    const [keyPilotSource, highlightManagerSource] = await Promise.all([
      readFile('extension/src/keypilot.js', 'utf8'),
      readFile('extension/src/modules/highlight-manager.js', 'utf8')
    ]);

    assert.match(
      keyPilotSource,
      /currentState\.mode === MODES\.HIGHLIGHT[\s\S]*_matchesKeybinding\(KB\.HIGHLIGHT, e\)[\s\S]*_matchesKeybinding\(KB\.RECTANGLE_HIGHLIGHT, e\)/
    );
    assert.match(
      keyPilotSource,
      /renderedKey\?\.legend \|\| renderedKey\?\.text[\s\S]*finishCode\.startsWith\('Key'\)/
    );
    assert.match(highlightManagerSource, /getMessage\('highlight_finish_before'\)/);
    assert.match(highlightManagerSource, /getMessage\('highlight_finish_after'\)/);
    assert.match(highlightManagerSource, /document\.createElement\('kbd'\)/);
    assert.match(highlightManagerSource, /localizeKeycapLabel\(finishKeyRaw\)/);
  });
});
