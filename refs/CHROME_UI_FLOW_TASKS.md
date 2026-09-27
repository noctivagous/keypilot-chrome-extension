# Chrome-for-Testing UI flow tasks

Maestro-style **procedural** UI automation for KeyPilot, run against **Google Chrome for Testing** over CDP. This is the automation backlog. It does not replace the manual pass in [`UI_TESTING_CHECKLIST.md`](UI_TESTING_CHECKLIST.md).

Do **not** use Maestro YAML/CLI. Maestro’s web runner uses its own Chromium, cannot `--load-extension`, and cannot import walkthrough XML. Keep Maestro’s *shape*: sequential wait-until-visible steps, fail on the first missing chrome, then drive a journey.

Runner: [`scripts/ui-flow/`](../scripts/ui-flow/). Command: `npm run test:ui-flow` (not part of default `npm test` until the harness is stable). Requires Chrome for Testing at `/Applications/Google Chrome for Testing.app` or `CHROME_BINARY`.

Mark each item:

- `[ ]` not done
- `[x]` pass
- `[~]` pass with note
- `[F]` fail (write the note next to the item)

---

## Owners of truth (keep the runner in sync)

| Surface | Authoritative source | How the runner stays in sync |
|---|---|---|
| Walkthrough slides, tasks, overlays, `<when>` | [`extension/onboarding/en.xml`](../extension/onboarding/en.xml) via [`parseOnboardingXml`](../extension/src/utils/onboarding-model.js) | Import the parser. Do not hardcode slide or task lists. Unmapped `<when>` throws. |
| Walkthrough paint / overlay / task rows | [`onboarding-shared.js`](../extension/src/ui/onboarding-shared.js) + [`onboarding-panel.js`](../extension/src/ui/onboarding-panel.js) | Query `data-kp-onboarding-*` only. Assert painted task IDs match the current XML slide. |
| Control strip | [`control-strip.js`](../extension/src/ui/control-strip.js) | `[data-kp-control-strip="true"]` and inner `data-kp-control-strip-*` (open shadow). |
| Keyboard reference | [`floating-keyboard-help.js`](../extension/src/ui/floating-keyboard-help.js) | `.kp-floating-keyboard-help` / `[data-kp-floating-keyboard-titlebar="true"]`. Hover keys via `[data-kp-action-id]`. |
| Physical keys for a `<when action>` | [`BUILTIN_KEYBOARD_LAYOUTS`](../extension/src/config/keyboard-layouts.js) default (`browsing-right`) | Look up `code` from the layout; do not copy F/D/V labels from XML copy. |
| First-run chrome | [`background.js`](../extension/background.js) `ensureDefaultOnboardingState` / keyboard help visible | Disposable empty profile every run. |

---

## 0. Harness

- [x] Disposable Chrome-for-Testing profile under `tmp-captures/chrome-ui-flow-profile` (wipe each run so onboarding is first-install).
- [x] Reuse debug-chrome launch flags: `--load-extension`, `--disable-extensions-except`, `--remote-debugging-port`, `--no-first-run`.
- [x] CDP client (`chrome-remote-interface`); pierce open shadow roots.
- [x] Local fixture page (links + text field + tall scroll) served on `127.0.0.1`.
- [x] `npm run build` before the flow so `extension/` is current.
- [x] Leave off default `npm test`.

---

## 1. Contract

- [x] Import `parseOnboardingXml` on `extension/onboarding/en.xml`.
- [x] Assert live painted `[data-kp-onboarding-task-id]` list matches the current slide’s task IDs.
- [x] Selectors are `data-kp-*` / documented host classes only (no English-label-only asserts).
- [x] Handler map keyed by `<when type action target mode change>`; unknown signatures fail loudly.

---

## 2. Flow 1 — install chrome visible

After first-run load on the fixture `http://` page, wait until all three are visible:

- [x] Walkthrough: `.kp-onboarding-panel` / `[data-kp-onboarding-title="true"]`
- [x] Control strip: `[data-kp-control-strip="true"]` (open shadow)
- [x] Keyboard reference: `.kp-floating-keyboard-help` / `[data-kp-floating-keyboard-titlebar="true"]`

---

## 3. Flow 2 — walk the XML model

- [x] Dismiss each slide `onEnter` overlay via `[data-kp-onboarding-overlay-primary="true"]`.
- [x] For each slide/task in the parsed model, run the `when` handler; wait for `[data-kp-onboarding-task-done="true"]`.
- [x] After `toggle_extension_off`, use `[data-kp-onboarding-reenable-tip="true"]` and click the strip On/Off segment again (tip is not an XML task).
- [x] Drive keys from the default layout assignment for that `when.action`.
- [ ] Tabs slide (`G` / new-tab / `T` / `Q` / `W`): extra CDP targets; if a step is too brittle, fail with a handler error rather than faking completion. Treat remaining flakes as follow-up, not as a fake pass.

---

## 4. Later (not in the first runner)

Same “catalog + `data-kp-*`” pattern; do not dump selectors into YAML.

- [ ] Extension popup (toolbar)
- [ ] Settings popover
- [ ] Docs / Guide
- [ ] Remaining [`UI_TESTING_CHECKLIST.md`](UI_TESTING_CHECKLIST.md) surfaces
- [ ] Locale-specific walkthrough XML (`de.xml`, `es.xml`, …) using the same IDs

---

## How to run

```text
npm run build
npm run test:ui-flow
npm run test:ui-flow -- --keep-browser
```
