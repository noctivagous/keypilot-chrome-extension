# Firefox build directory research

Findings from Brave Search + this repo’s current build shape (Aug 2026). Goal: prepare `build.js` to emit a loadable Firefox extension directory.

## Recommendation

**Yes — add a generated `extension-firefox/` (or `dist/firefox/`) as a loadable output, not a second source tree.**

- Keep `extension/` as the Chrome source + unpacked dir you already load.
- Do **not** maintain a parallel `extension-firefox/src` / second `background.js`.
- One source, browser-specific emit (same pattern as Extension.js / vite-plugin-web-extension).

A single dual-key `manifest.json` in `extension/` is **not enough** for KeyPilot (`favicon`, `chrome:` in CSP, `/_favicon/` are Chromium-only; Firefox `service_worker` is still the fragile path).

### Timing vs Chrome-first work (agent / overhead)

**Mostly no distraction — if Firefox stays opt-in and never becomes the default path.** It becomes a mild tax only if agents start treating Firefox as an equal target on every Chrome change.

**Low-distraction shape (required if landing build support early):**

- `npm run build:firefox` / `node build.js --firefox` only
- Generated `extension-firefox/` (gitignored)
- One manifest patch function
- **Not** wired into the default `npm run build`
- **Not** required in CI for Chrome work
- Documented as optional / later (this file); README stays Chrome-first

In that shape, Chrome agents keep editing `extension/src`, running `npm run build`, loading `extension/`. The Firefox script is dead code until someone runs it.



**Where overhead actually shows up:**

1. **Agents “helpfully” dual-target** — every PR starts getting “also update Firefox manifest / rules / CSP.” Process noise, not build cost. Fix with a short rule: Chrome-only unless the task says Firefox.
2. **Shared runtime branches** — `if (isFirefox)` / feature flags / alternate `rules.json` inside `background.js` or content code. That’s the real tax: every Chrome change risks touching those paths. Avoid until you actually load Firefox.
3. **Default build includes Firefox** — slower builds, more files to reason about, agents inspecting both trees. Don’t do this yet.
4. **Docs / README implying dual support** — agents will scope tasks wider. Keep README Chrome-first; leave Firefox in `refs/`.

| Do now (or when ready) | Defer |
|---|---|
| Optional `--firefox` copy + manifest transform | Firefox-specific runtime / DNR / favicon / event-page fixes |
| Gitignore `extension-firefox/` | Making `build` = chrome+firefox |
| Leave default `npm run build` unchanged | Agent rules that say “always consider Firefox” |

**Verdict:** Thin build emit support is fine and won’t meaningfully distract Chrome work. What *would* distract is merging Firefox into the default workflow or into shared product code before you’re ready to own those bugs.

If you want zero agent confusion, wait until you’re about to load in Firefox; the build change is small and can land in one focused PR then. The research in this file means you’re not losing much by waiting.
## Why a separate directory

Today `npm run build` is **in-place**: esbuild writes `content-bundled.js` / `frame-agent-bundled.js` into `extension/`, then `build-side-effects.js` stamps `manifest.json` and docs. Load unpacked = `extension/`.

If that same `manifest.json` is rewritten for Firefox, Chrome load-unpacked breaks. `web-ext` / AMO also expect a Firefox `--source-dir`, not a shared live Chromium manifest.

Gitignore `extension-firefox/` (and any `.xpi`). Treat it like `content-bundled.js`: generated.

## Manifest / packaging differences (Brave Search)

### Background entry (main split)

| Chrome MV3 | Firefox MV3 |
|---|---|
| `background.service_worker` | `background.scripts` (event page) |

- Chrome starts a service worker; Firefox starts scripts as an event page ([MDN `background`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)).
- Chrome **121+** and Firefox **121+** can list **both** keys ([Mozilla add-ons blog, Mar 2024](https://blog.mozilla.org/addons/2024/03/13/manifest-v3-manifest-v2-march-2024-update/), [SO 78491335](https://stackoverflow.com/questions/78491335/how-can-i-write-a-chrome-and-firefox-manifest-v3-extension-that-shares-code-when)).
- Older Firefox / `web-ext` still fail on `background.service_worker` ([web-ext #3045](https://github.com/mozilla/web-ext/issues/3045), [#2532](https://github.com/mozilla/web-ext/issues/2532)).

**Safer for a dedicated Firefox dir:** `scripts` only, no `service_worker`.

Current Chrome-only shape:

```json
"background": {
  "service_worker": "background.js",
  "type": "module"
}
```

Firefox equivalent:

```json
"background": {
  "scripts": ["background.js"],
  "type": "module"
}
```

`background.js` is already an ES module — keep `"type": "module"`.

### Gecko id (AMO / persistent identity)

Chrome ignores `browser_specific_settings`. Firefox/AMO need:

```json
"browser_specific_settings": {
  "gecko": {
    "id": "keypilot@your-domain-or-guid",
    "strict_min_version": "121.0"
  }
}
```

Pick a stable id once. Temporary `about:debugging` loads can work without it; publishing cannot.

Docs: [MDN `browser_specific_settings`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings), [Firefox MV3 migration guide](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/).

### Tooling

- `web-ext run --source-dir=extension-firefox`
- `web-ext lint` / `web-ext build` for AMO zip
- Separate manifests are a known need ([web-ext #2653](https://github.com/mozilla/web-ext/issues/2653))

## Implemented build behavior

`node build.js --firefox` / `npm run build:firefox` keeps the current Chrome path and then:

1. Runs the existing esbuild (same bundles).
2. Recreates a generated, gitignored `extension-firefox/` from the runtime file set (not `build.js`, tests, or repo docs).
3. Writes a **Firefox `manifest.json`** from the Chrome one (patch, don’t maintain two by hand).
4. Validates that each manifest-referenced runtime file exists in the generated directory.

**Copy in:** bundled JS, `background.js`, `early-inject.js`, `popup.*`, `pages/`, `icons/`, `fonts/`, `rules.json`, and **`src/`** (extension pages import from `src/`; WAR also lists `src/*`).

**Leave out:** `build.js`, `build-side-effects.js`, tests, repo README.

### Manifest transforms

| Chrome (`extension/`) | Firefox output |
|---|---|
| `background.service_worker` | `background.scripts` |
| no Gecko ID | no Gecko ID for temporary local loading |
| `"favicon"` permission + `/_favicon/` | drop permission; Chromium-only |
| CSP `img-src … chrome:` | `moz-extension:` (drop `chrome:`) |
| `match_origin_as_fallback` | keep only if min Firefox version supports it |

This build intentionally does not add `browser_specific_settings.gecko.id`; choose a stable ID only when preparing an AMO submission. Background + favicon/CSP are why a generated folder is still worth it.

A later npm run package:firefox would zip that staged directory the same way Chrome/Opera packaging works today.

## Work beyond the build script

The directory is the easy part. Runtime is the rest:

- **`chrome.*` APIs** — Firefox accepts most of this; no bulk rewrite for a first port.
- **`declarativeNetRequest` + `rules.json` stripping CSP/XFO on all frames** — Firefox has DNR; AMO will likely reject that rule. Expect a Firefox-specific `rules.json` or feature flag.
- **Favicons** — Google s2 + origin probes already exist; skip `/_favicon/` on Firefox.
- **Service-worker assumptions** — `background.js` uses SW lifetime (fetch video bytes, session DNR, in-memory `Map`s). Firefox event pages **sleep**; maps reset. Product work, not copy-files.
- **`chrome://newtab` / skippable URLs** — `url-policy.js` is Chromium-shaped; Firefox uses `about:newtab`, etc.
- **Custom NTP** — `chrome_url_overrides` is already omitted; Firefox new-tab override is a separate, extra-review feature.

## Practical sequence

1. **When ready to load Firefox (or as a thin opt-in only):** generate `extension-firefox/` with a patched manifest — keep default `npm run build` Chrome-only.
2. Load in Firefox (`about:debugging` or `web-ext run`).
3. Fix API / CSP / DNR / newtab gaps (this is when shared runtime cost begins — not at emit time).
4. Then AMO (`web-ext`, gecko id, reviewer notes).

The extra directory is the right first build change; it is not a full Firefox port by itself. Prefer landing emit support in the same window as first Firefox load if you want to avoid unused dual-browser surface in the repo.

## Key references

- [MDN: Chrome incompatibilities](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities)
- [MDN: `background`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
- [MDN: `browser_specific_settings`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)
- [Firefox Extension Workshop: MV3 migration](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/)
- [Mozilla blog: MV3 / event pages (Mar 2024)](https://blog.mozilla.org/addons/2024/03/13/manifest-v3-manifest-v2-march-2024-update/)
- [SO: shared MV3 manifests](https://stackoverflow.com/questions/78491335/how-can-i-write-a-chrome-and-firefox-manifest-v3-extension-that-shares-code-when)
- [web-ext: `service_worker` disabled](https://github.com/mozilla/web-ext/issues/3045)
- Repo: `extension/build.js`, `extension/manifest.json`, `package.json` (`npm run build`)
