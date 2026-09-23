# Keyboard Reference: physical keyboard layout localization

## Purpose

Localize the Keyboard Reference so its keycaps represent the user's physical
keyboard layout while KeyPilot continues to bind actions to physical keys.
This is keyboard-layout infrastructure, not translation: UI strings still come
from `extension/_locales/<locale>/messages.json`, while this work changes the
keycap geometry and legends rendered by the Keyboard Reference.

The current keyboard map assumes a US ANSI QWERTY physical keyboard:

- `KEYBOARD_UI_LAYOUT_RIGHT` and `KEYBOARD_UI_LAYOUT_LEFT` in
  `extension/src/config/keyboard-layouts.js` contain visible US key legends and
  row geometry.
- Built-in KeyPilot assignments match `KeyboardEvent.key` by default, with a
  few `KeyboardEvent.code` fallbacks (`Semicolon`, `Quote`).
- The rendered keycap position is inferred from a character-oriented binding,
  rather than a stable physical-key identifier.

As a result, the current reference is wrong for a German QWERTZ keyboard:
the physical `KeyY` slot is labelled `Z` and emits `event.key === 'z'`, so it
triggers a `['z', 'Z']` binding, while the reference renders that binding at
the US-QWERTY `KeyZ` slot. This affects Y/Z bindings immediately and any
layout-specific character or punctuation binding. The model is also insufficient for ISO,
Japanese JIS, and non-Latin input layouts.

## Scope and non-goals

In scope:

1. A keyboard-model registry keyed by physical USB HID usage (or a stable
   equivalent derived from `KeyboardEvent.code`).
2. Per-keyboard-layout geometry and unshifted/shifted legends for Keyboard
   Reference and the layout editor placement surface.
3. A clear mapping from KeyPilot action bindings to the keycap at the physical
   location that triggers the action.
4. Physical models and selection guidance for every currently shipped UI
   locale (`en`, `de`, `es`, `es_419`, `sk`, `zh_CN`, `zh_TW`, `zh_HK`, `ja`).
5. Tests for model integrity, rendered location, and runtime matching.

Out of scope for the first implementation:

- Changing KeyPilot's built-in action layout or automatically remapping
  existing user assignments by locale.
- Input-method-editor composition, dead-key text entry, or translating action
  names.
- Guessing the hardware layout solely from `navigator.language`.
- Treating all keyboards that share a language as physically identical.

## Terminology and identity layers

Keep these concepts separate:

| Layer | Example | Responsibility |
| --- | --- | --- |
| Physical key | HID usage `0x1D`; DOM code `KeyZ` | Stable key location for actions and editor placement |
| Printed legend | `Z` on US, `Y` on German | What Keyboard Reference draws on that keycap |
| Produced character | `event.key === "z"` or `"y"` | Text/layout-dependent event value |
| KeyPilot action | `PAGE_TOP` | Behavior bound to a physical slot |
| UI locale | `de`, `es`, `fr` | Language of KeyPilot's copy; not a reliable hardware-layout selector |

For browser code, `KeyboardEvent.code` is the practical physical-key token
(`KeyQ`, `Semicolon`, `Quote`, `IntlBackslash`, etc.). The model source should
record the corresponding USB HID Keyboard/Keypad usage so that terminology is
unambiguous and a later native/HID integration has a stable identifier.

`event.code` is not a device fingerprint: browsers normalize it and may expose
`Unidentified`, virtual keyboards, remoting software, or unusual hardware
differently. It is still the correct primary identity for a web-extension
keyboard map.

## Proposed model

Create a source module independent from built-in KeyPilot action layouts, for
example `extension/src/config/keyboard-hardware-layouts.js`.

Each model should describe:

```js
{
  id: 'de-qwertz-iso',
  labelKey: 'keyboard_hardware_layout_de_qwertz_iso',
  formFactor: 'ISO',
  rows: [
    // Each key has a physical DOM-code slot and display information.
    { code: 'KeyY', hidUsage: '0x1C', legend: 'Z', shiftLegend: 'Z' },
    { code: 'KeyZ', hidUsage: '0x1D', legend: 'Y', shiftLegend: 'Y' },
    { code: 'IntlBackslash', hidUsage: '0x64', legend: '<', shiftLegend: '>' }
  ]
}
```

The real schema also needs key widths, special-key labels, row offsets, and
possibly a legend stack (primary, shifted, AltGr) rather than only
`legend`/`shiftLegend`. Renderers should consume the model and look up an
action by `code`; they must not look up an action by visible legend.

Action bindings should move toward an explicit physical form:

```js
{ codes: ['KeyZ'], matchOn: ['code'], displayKey: 'Z' }
```

`displayKey` should be derived from the selected hardware model for rendered
maps, not persisted as the identity of the assignment. Character matching can
remain only where intentionally semantic (for example, a command explicitly
bound to a produced punctuation character), and must be visibly documented as
such in the editor.

## Physical-layout coverage for current UI locales

Locale must remain independent from physical-layout selection. This matrix
sets the initial scope and prevents the locale picker from becoming a
misleading keyboard detector.

| UI locale | Likely physical/input layouts | Initial KeyPilot treatment |
| --- | --- | --- |
| `en` | US ANSI QWERTY, UK ISO QWERTY, and many other English-language hardware layouts | Keep the existing US ANSI model as an explicit option, not an inference from `en`; add UK ISO only after its punctuation legends are verified. |
| `de` | German (Germany) ISO QWERTZ is the primary model; German Swiss and external QWERTY keyboards differ | Add a verified `de-DE-qwertz-iso` model. Do not generalize it to all German-language users. |
| `es` | Spain Spanish ISO QWERTY | Add a verified Spain model, including its ISO-only key and dead-key/AltGr legends. |
| `es_419` | Multiple country and OS variants; “Latin American Spanish” is not one universal hardware layout | Do not automatically select a model. Add specifically verified models, starting with the operating-system layout(s) actually targeted, and expose them as explicit choices. |
| `sk` | Slovak QWERTZ is common; Slovak QWERTY also exists | Add Slovak QWERTZ only after verifying its number-row, diacritic, and AltGr/dead-key levels. Keep QWERTY selectable; never infer it from `sk`. |
| `zh_CN` | Usually QWERTY hardware plus a Simplified-Chinese IME (commonly Pinyin); ANSI versus ISO remains hardware-specific | Use the chosen QWERTY physical model. Do not create a Chinese physical layout merely because the UI locale is Simplified Chinese. |
| `zh_TW` | QWERTY hardware with Traditional-Chinese input methods; some keycaps additionally print Zhuyin or Cangjie legends | Use the chosen QWERTY physical model. A future Taiwan keycap model may add verified secondary legends, but must not change action positions. |
| `zh_HK` | QWERTY hardware with Traditional-Chinese/Cantonese-oriented input methods, often Cangjie or related methods | Use the chosen QWERTY physical model. Do not assume Taiwan Zhuyin legends or a single Hong Kong input method. |
| `ja` | Japanese JIS keyboard or an external ANSI/ISO QWERTY keyboard, each paired with a Japanese IME | Add a separate JIS model. It needs JIS geometry and keys such as `IntlYen`, `IntlRo`, `Convert`, `NonConvert`, and Kana/Eisu-mode keys, subject to Chromium event verification. Keep US/ISO models available for external keyboards. |

The Chinese and Japanese rows are especially important: an IME changes
character composition, not necessarily the physical key layout. The Keyboard
Reference must continue to show action placement from the selected hardware
model while KeyPilot respects existing text-entry/IME guards.

## Layout families and accuracy requirements

### QWERTY

Used by US, UK, Italy, Netherlands, much of Latin America, and other regions,
but those layouts are not interchangeable. The US ANSI model is the existing
baseline; UK and most continental variants are ISO and add a physical key next
to the left Shift key (`IntlBackslash`).

### German QWERTZ

German uses QWERTZ. The letter printed on `KeyY` is `Z`; the letter printed on
`KeyZ` is `Y`. It also has German-specific punctuation and umlaut legends,
including `ä`, `ö`, `ü`, and `ß`. Those details affect the full visual model,
not merely a Y/Z label swap.

### Spanish (Spain) QWERTY

Spanish (Spain) is QWERTY-based and includes `Ñ`, inverted punctuation, and
dead-key accents. Do not encode the claim that `Ç` simply “replaces
backslash”: physical placement and available glyphs vary by ISO/ANSI geometry
and operating-system layout. Validate the complete model against the target OS
layouts before shipping it.

### Spanish (Latin America) QWERTY

Latin-American Spanish is QWERTY-based and commonly includes `Ñ`, but
`es_419` covers many countries and does not identify one physical layout.
Each supported variant needs verified punctuation, dead-key, and AltGr
legends; it must not be implemented as Spain Spanish with one key removed.

### Slovak QWERTZ

Slovak keyboards commonly use QWERTZ and expose Slovak diacritics and symbols
through their number row, modifiers, and dead keys. QWERTY variants are also
used. The full legend stack must be verified against supported OS layouts;
only swapping Y/Z would leave the reference materially incorrect.

### Chinese input layouts

Chinese UI locales do not imply a Chinese physical keyboard. Simplified and
Traditional Chinese users commonly type through an IME on an ordinary QWERTY
keyboard, while hardware may be ANSI or ISO. Taiwan-branded keyboards can add
Zhuyin/Cangjie legends, but those are secondary keycap labels on the same
physical positions. Hong Kong must not inherit Taiwan's legends without
specific verification.

### Japanese JIS

Japanese JIS is a separate physical model, not US QWERTY with Japanese
legends. It has different key geometry, a shorter space bar, and Japanese
input-control keys. Its DOM-code coverage and legends must be captured in
Chromium on each supported OS before it is used for action binding or editor
placement. A Japanese UI user with an external US/ISO keyboard must still be
able to choose that hardware model.

## Selection and fallback

Provide an explicit **Keyboard hardware layout** preference, separate from:

- Chrome/KeyPilot UI locale;
- the built-in KeyPilot action family and handedness; and
- a user-created action layout.

Default to the current US QWERTY visual model until a user selects another
model. A locale-based suggestion may be offered during onboarding, but must
never silently select a hardware layout: locale does not distinguish hardware,
OS input source, external keyboards, or user preference.

Persist the selected model ID with Keyboard Reference presentation settings.
Changing the visual model alone must not reinterpret saved assignments.
Current saved character bindings remain character-semantic unless they are
explicitly converted to the new physical-binding form; new built-in
code-based assignments retain their physical positions regardless of selected
model. This distinction must be visible in the layout editor.

## Integration points

1. Replace the US-specific `KEYBOARD_UI_LAYOUT_*` cells with model-driven
   physical key cells (DOM `code` + geometry).
2. Update `keybindings-ui-shared.js`, `floating-keyboard-help.js`, and the
   layout editor to render model legends and resolve action highlighting by
   physical code.
3. Extend the binding schema/editor so new physical assignments are persisted
   as code-based bindings. Preserve intentional semantic character bindings as
   a distinct type, not an ambiguous array of strings.
4. Keep the system layer (`Escape`, Keyboard Reference toggle, Settings) in
   the same physical-key resolution pipeline.
5. Localize model-picker labels in `_locales`, but keep model IDs, DOM codes,
   and HID usages invariant.
6. Update the Keyboard Reference help and testing checklist with the selected
   hardware layout, physical-vs-character behavior, and unsupported-layout
   fallback.

## Risks and open issues

- **Current character bindings are locale-sensitive.** A binding such as
  `['z', 'Z']` follows the typed character, while the map currently paints a
  US physical location. On German QWERTZ, the displayed/triggered positions
  are therefore transposed. Runtime matching and rendering must become
  code-first together.
- **ISO vs ANSI geometry matters.** European keyboards generally use ISO
  geometry, including `IntlBackslash`; rendering only different glyphs on an
  ANSI keyboard produces an incorrect placement surface.
- **Dead keys and AltGr need multi-level legends.** Accents, `¿`, `¡`, `@`,
  `€`, braces, pipes, and similar characters may be dead-key, Shift, or AltGr
  outputs. They are display data, not a substitute for physical identity.
- **Browser-reserved shortcuts and text inputs remain constraints.** A
  code-based model cannot make unavailable browser/OS shortcuts capturable, or
  safely override typing while an editable control is focused.
- **One locale has multiple operating-system layouts.** Verify at least
  Chromium on macOS, Windows, and Linux where browser event behavior or legend
  conventions differ. This is mandatory for Spanish variants, Slovak, JIS,
  and IME-driven Chinese locales.
- **IME composition must never activate a browsing action.** During Japanese
  or Chinese composition, `event.key` can represent an intermediate character
  or composition state. Preserve and test the existing editable/IME guards
  before making code-based matching broader.
- **JIS keys need browser evidence.** `IntlYen`, `IntlRo`, `Convert`,
  `NonConvert`, and Kana/Eisu-related keys do not have the same hardware
  availability as US/ISO keys. Verify their `code`, `key`, and modifier output
  in Chromium rather than relying only on a static keycap drawing.
- **Keyboard Layout Map API is not a foundation.** `navigator.keyboard.getLayoutMap()`
  is not universally available and requires permissions/secure contexts in
  supporting browsers. It may be an optional diagnostic or future enhancement,
  not the only source of truth.
- **Custom layouts need clear semantics.** Existing custom layouts may be
  character-centric. Decide whether the new editor converts only newly created
  physical bindings, or whether it provides an explicit choice between
  “physical key” and “typed character.” Do not silently reinterpret saved
  custom layouts.
- **Accessibility.** The accessible name should say both the visible legend
  and action, and must stay understandable for a screen-reader user whose
  physical keyboard differs from the visual model.
- **Screenshot and visual regression coverage.** Store screenshots and
  Keyboard Reference tests currently assume US geometry. Add fixture coverage
  for at least US ANSI, German ISO, Spanish ISO, and French ISO once models
  exist.

## Acceptance criteria

- A user can explicitly select a hardware layout independently of UI language,
  handedness, and KeyPilot action family.
- German QWERTZ shows `Z` at `KeyY` and `Y` at `KeyZ`, and action highlighting
  follows physical key positions.
- Spanish (Spain) and Spanish (Latin America) are separate, verified models.
- `es_419`, `sk`, Chinese, and Japanese UI locales never silently choose a
  physical model from the locale; their documented candidate models remain
  explicit user choices.
- Japanese JIS is rendered as a distinct geometry and is tested with Chromium
  event data; Chinese IME users retain their selected QWERTY hardware model.
- ISO-only keys are present where applicable and can be used as layout-editor
  targets.
- A key's tooltip, pressed-state feedback, and assigned action all resolve
  through the same physical-code identity.
- Unsupported/unknown hardware models fall back visibly to US QWERTY without
  altering the user's action assignments.
- Unit tests reject duplicate physical codes/HID usages, missing required
  geometry, and action cells that cannot resolve to a rendered physical key.
