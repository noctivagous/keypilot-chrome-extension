# Microsoft Edge build directory research

Findings from Microsoft's own Edge extension docs + Brave Search, cross-referenced
with this repo's current build shape (Sep 2026). Goal: figure out what (if
anything) `build.js` needs to do to ship KeyPilot on the Microsoft Edge
Add-ons store.

## tl;dr — Edge is the easy one; no generated directory needed

Edge is Chromium, running the same extension platform as Chrome. Microsoft's
own porting guide is five steps, and step 1 is "check the API list," not
"rewrite the manifest":

> "Microsoft Edge allows you to port your Chrome extension to Microsoft Edge
> with minimal changes. The Extension APIs and manifest keys supported by
> Chrome are code-compatible with Microsoft Edge."
> — [Port a Chrome extension to Microsoft Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension)

**Recommendation: don't add a `--edge` flag or an `extension-edge/` directory
at all.** Zip the existing `extension/` output as-is (same artifact you'd
send to the Chrome Web Store) and upload it through Partner Center. Unlike
Firefox (needs a patched manifest + background key swap) and Safari (needs
an entire native app wrapper), there is no required manifest transform for
Edge. The work here is almost entirely on the *publishing/listing* side, not
the build side.

## Why no manifest patch is needed

Checked KeyPilot's actual `extension/manifest.json` against Microsoft's
authoritative [Supported APIs for Microsoft Edge extensions](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support)
list. Every permission KeyPilot declares today is fully supported on Edge
desktop (Windows/Mac/Linux), MV3:

| KeyPilot permission | Edge support |
|---|---|
| `storage` | Supported (MV2, MV3) |
| `tabs` | Supported |
| `windows` | Supported |
| `scripting` | Supported (MV3) |
| `history` | Supported |
| `bookmarks` | Supported |
| `topSites` | Supported |
| `webNavigation` | Supported |
| `contextMenus` | Supported |
| `favicon` (+ `_favicon/*` web-accessible resource) | Not called out either way — it's a Chromium feature (Chrome 104+) rather than a listed cross-browser API. Since Edge tracks Chromium releases closely, this is expected to work, but **verify empirically** by sideloading before relying on it; unlike Firefox, there's no known incompatibility reported. |

None of KeyPilot's APIs appear on Microsoft's [unsupported list](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support#unsupported-apis)
(that list is mostly ChromeOS-only APIs like `certificateProvider`,
`fileSystemProvider`, `printing`, plus `identity.getAuthToken` /
`identity.getAccounts`, `gcm`, `instanceID`, `readingList` — none of which
KeyPilot uses).

### Manifest keys to double check, per Microsoft's port guide

1. **Remove `update_url`** if present — KeyPilot's manifest doesn't set
   this today, so nothing to do. (It would point at the Chrome Web Store
   update endpoint, which is meaningless/wrong for an Edge Add-ons
   listing — Edge has its own store update mechanism.)
2. **No "Chrome" branding in name/description** — Microsoft's certification
   process requires rebranding any Chrome-specific wording to
   "Microsoft Edge." KeyPilot's current `name` (`"KeyPilot"`) and
   `description` don't mention Chrome, so this is already clean at the
   manifest level — worth a quick grep of `extension/README.md`,
   popup/settings copy, and store-listing text if those get reused for the
   Edge listing description.
3. **`minimum_chrome_version`, not a `minimum_edge_version` key** — if a
   minimum browser version is ever needed, Edge honors Chromium's
   `minimum_chrome_version` manifest key directly; there's no
   Edge-specific equivalent (unlike Firefox's
   `browser_specific_settings.gecko.strict_min_version`)
   ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/149204/the-edge-extension-keys)).
4. **Icon format quirk (rare)** — one reported Partner Center validation
   error rejects an MV3 `icons` value if it's shaped as an array instead of
   the standard `{ "size": "path" }` object map
   ([microsoft/MicrosoftEdge-Extensions#73](https://github.com/microsoft/MicrosoftEdge-Extensions/discussions/73)).
   KeyPilot's manifest already uses the object-map form
   (`extension/manifest.json` `icons` / `action.default_icon`), so this
   shouldn't apply, but it's a one-line thing to keep an eye on if the
   manifest's icon shape ever changes.

### Native messaging note (not currently used by KeyPilot)

If KeyPilot ever added `chrome.runtime.connectNative`, Edge's native
messaging host manifest needs `allowed_origins` set to
`chrome-extension://[Edge-Add-ons-extension-ID]` — note it's still the
`chrome-extension://` scheme, not an Edge-specific one, and the ID is the
one assigned by the Edge Add-ons catalog, not the Chrome Web Store ID
([Port a Chrome extension to Microsoft Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension#setting-allowed_origins-for-a-native-app)).
Not actionable today since KeyPilot has no native messaging host.

## Testing locally (sideloading)

Identical workflow to Chrome's unpacked-load:

1. Go to `edge://extensions`.
2. Enable Developer mode.
3. "Load unpacked" → point at `extension/` (the same directory already used
   for Chrome — no copy needed).

No separate build output, no `web-ext`-equivalent CLI, no Xcode. This is
the same directory Chrome loads today.

## Publishing (Partner Center) — this is where the actual work is

Full flow: [Publish a Microsoft Edge extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension).
Unlike the build step, this has real one-time setup and per-release process
overhead:

1. **Register as a Microsoft Edge extension developer** at Partner Center
   (separate account/registration from a Google or Apple developer
   account; no fee is mentioned in Microsoft's docs, unlike Apple's
   $99/year — confirm current terms at registration time since policy can
   change).
2. **Package**: same `.zip` shape as the Chrome Web Store package — manifest
   + all runtime files. The existing `extension/` output can be zipped
   directly; no Firefox/Safari-style file-exclusion filtering has been
   identified as necessary (Edge doesn't reject `build.js`/tests being
   present the way AMO reviews might scrutinize a Firefox source zip, but
   as good practice you'd still only zip runtime files, same list already
   excluded from what ships to users).
3. **Partner Center review flow is more form-heavy than the Chrome Web
   Store's**, structured as: Availability (visibility/markets) → Properties
   (category, website, support contact) → **Privacy** (single-purpose
   description, per-permission justification, remote-code declaration, data
   usage certification, privacy policy URL) → Store listing (per-language
   name/description/logo/screenshots, description must be
   250–10,000 characters) → certification notes → submit.
4. **Per-permission justification is mandatory** — Partner Center lists
   every permission from the manifest and requires a written justification
   for each ("least privilege" review). Worth drafting justification text
   for KeyPilot's `bookmarks`, `history`, `topSites`, `webNavigation`,
   `contextMenus`, `favicon`, and `<all_urls>` host permission ahead of
   submission, since these are exactly the kind of broad permissions that
   invite reviewer scrutiny.
5. **Remote code declaration** — MV3 disallows remotely-hosted executable
   code entirely (same rule as Chrome Web Store); KeyPilot doesn't use
   remote code today, so this should be a straightforward "No."
6. **Certification takes up to 7 business days**, vs. typically faster
   informal turnaround for Chrome Web Store MV3 submissions (though Google
   doesn't publish a fixed SLA either) — plan release timing accordingly if
   Edge and Chrome versions are meant to ship together.
7. **i18n note**: if KeyPilot ever ships localized listings, Partner Center
   only auto-detects available languages when `name`/`description` in the
   manifest use `__MSG_extensionName__` placeholders backed by
   `_locales/*/messages.json` — hardcoded strings collapse the listing to a
   single locale regardless of how many `_locales` folders exist.

## Practical sequence

1. No build change needed today — `extension/` is already Edge-loadable.
   Confirm by sideloading via `edge://extensions` → Load unpacked once.
2. Spot-check `favicon` / `_favicon/*` behavior in Edge specifically (the
   one permission without an explicit Microsoft compatibility statement).
3. Grep extension copy (popup, settings, docs pages, README used for store
   description) for any literal "Chrome" wording that needs neutralizing
   for the Edge listing.
4. Register a Partner Center developer account, zip `extension/`, and work
   through the Availability → Properties → Privacy → Store listing →
   Submit flow, with permission justifications drafted in advance.
5. If/when Firefox or Safari support lands and `build.js` grows
   browser-specific staging, revisit whether Edge should get its own
   `extension-edge/` for symmetry — but nothing in this research suggests
   it would fix an actual bug or gap today.

Like the Firefox and Safari files, this document exists so agents don't
assume Edge support requires the same kind of build-step or runtime work
those two do — Edge is the one target where the Chrome build already is
the Edge build; the real lift is entirely in Partner Center's review
process, not in code.

## Key references

- [Port a Chrome extension to Microsoft Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension)
- [Publish a Microsoft Edge extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
- [Supported APIs for Microsoft Edge extensions](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support)
- [Alternative ways to distribute an extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/alternate-distribution-options)
- [Overview of Microsoft Edge extensions](https://learn.microsoft.com/en-us/microsoft-edge/extensions/)
- [Manifest V3 and Microsoft Edge Add-ons (Edge blog, Dec 2022)](https://blogs.windows.com/msedgedev/2022/12/05/manifest-v3-and-microsoft-edge-add-ons/)
- [Microsoft Q&A: minimum_chrome_version for Edge](https://learn.microsoft.com/en-us/answers/questions/149204/the-edge-extension-keys)
- [microsoft/MicrosoftEdge-Extensions#73: MV3 icons array validation error](https://github.com/microsoft/MicrosoftEdge-Extensions/discussions/73)
- Repo: `extension/manifest.json`, `extension/build.js` (no Edge-specific path exists or is proposed)
