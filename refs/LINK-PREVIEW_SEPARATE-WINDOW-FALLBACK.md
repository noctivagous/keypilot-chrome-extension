# Link Preview: iframe refusal and a separate-window fallback

Notes from investigating why **E (Link Preview)** fails on some hosts (notably X.com) even though KeyPilot already uses `declarativeNetRequest` to allow iframes, and whether a real OS popup window would fit the existing UI.

Related code:

- `extension/rules.json` — DNR header stripping
- `extension/src/utils/preview-url.js` — HTTPS prefer + X/Twitter embed rewrite
- `extension/src/modules/overlay-manager.js` — `showPreviewPopover()`
- `extension/src/modules/launcher-popover.js` — same iframe strategy
- `extension/src/ui/preview-open-actions.js` — Open / Open in New Tab (always the **original** URL)

---

## Symptom

On X.com (and a few other hosts), Link Preview opens the popover but the iframe shows Chrome’s **“refused to connect”** page (`ERR_BLOCKED_BY_RESPONSE` / framing refusal), not the site.

On most other sites the same popover works.

This is separate from the earlier “G/B/E cannot find a URL on a tweet card” bug. After permalink resolution, E *has* the status URL; the iframe still cannot load `https://x.com/.../status/...` as a framed document.

---

## What we already do (and what it actually fixes)

`rules.json` is a Manifest V3 `declarativeNetRequest` rule on `main_frame` and `sub_frame`. It **removes response headers**:

- `X-Frame-Options` / `Frame-Options`
- `Content-Security-Policy` (includes `frame-ancestors`)
- `Content-Security-Policy-Report-Only`
- `Cross-Origin-Resource-Policy`
- `Cross-Origin-Embedder-Policy`
- `Cross-Origin-Opener-Policy`

That is why preview works on **most** websites. The common refusal is “don’t put me in an iframe,” expressed as those headers. After they are stripped, Chrome loads the HTML in the preview iframe like a normal page.

Architecture comments that say DNR “enables popover iframes” are right for that common case. They overstate it as a complete solution.

DNR does **not** help when:

1. **The server never sends the page.** The host sees `Sec-Fetch-Dest: iframe` (and similar client hints) and returns an empty/blocked response. Chrome then shows “refused to connect.” There is no useful header left to strip.
2. **JavaScript frame-busting** after load (`top !== self`).
3. **A `<meta http-equiv="Content-Security-Policy">` in the HTML** — DNR only sees HTTP headers.

X.com is in bucket (1): it refuses the **request**, not just the framing headers. An extension cannot spoof `Sec-Fetch-Dest` to look like a top-level navigation.

---

## What we do for X specifically

For tweet/status URLs, `rewriteUrlForIframePreview()` maps:

`https://x.com/{user}/status/{id}`  
→ `https://platform.twitter.com/embed/Tweet.html?id={id}&theme=dark&dnt=true`

That document is **meant** to be iframed. Profile-only `x.com/{handle}` URLs go to X’s syndication timeline embed.

**Open** / **Open in New Tab** in the titlebar still use the real `x.com` URL. The rewrite is iframe-src only.

This is a **host embed rewrite**, not a generic un-block. YouTube, Vimeo, Reddit, etc. have the same kind of official embed URL if we need them later.

---

## Techniques when there is no official embed

For hosts that still refuse a full-page iframe and have no `platform.twitter.com`-style document:

| Approach | Idea | Fit for KeyPilot |
|---|---|---|
| **OG / unfurl card** | Background `fetch` the URL, render title + description + image | Good for articles; empty for JS shells (X, Facebook) |
| **Screenshot** | Load the URL in a real tab, `captureVisibleTab`, show the image | Works almost everywhere; snapshot only; we already have page-thumb plumbing |
| **Official / oEmbed per host** | Same as the X rewrite | Host list, not universal |
| **Real window** | `chrome.windows.create({ type: 'popup', url })` | Framing rules do not apply; different product (see below) |
| **`srcdoc` of fetched HTML** | Rewrite and inject | Breaks SPAs, cookies, relative URLs |
| **Mobile UA** | Already supported on the preview titlebar | Sometimes less strict; does not help X |

What does **not** work in a Chrome extension: `<webview>` (Apps / Electron only).

Practical stack: **DNR (already) → host embed rewrite (X now) → OG card and/or screenshot → Open buttons**. The titlebar Open actions stay the guaranteed escape hatch.

---

## Separate-window fallback (`chrome.windows.create`)

A popup window is a **top-level** navigation. X, Facebook, banks, etc. will load. Cookies and session work. KeyPilot’s content script would inject in that window.

It is **not** a drop-in for the current Link Preview UI.

### What Link Preview is today

- A **layer on the same tab**, near the cursor; the feed stays visible around it
- KeyPilot chrome: drag, Mobile/Desktop, Open / Open in New Tab, **E / Esc** to close
- Hybrid focus so keys work in the iframe **and** on the titlebar
- Click-outside dismisses
- One preview; the originating page stays the home context
- Frame agent + popover bridge run **inside** the iframe

### What a real popup window is

A second OS/Brave window. Framing rules do not apply.

| Current overlay | OS popup |
|---|---|
| Sits on the feed | Separate window (can go behind, other Space, awkward in fullscreen) |
| Custom titlebar + E to close | Native Brave chrome; E-close needs extra window-id plumbing |
| Click-outside dismiss | Clicks on the feed do not automatically close it |
| Hybrid hover/focus with the parent page | Focus **leaves** the feed when the window opens |
| Mobile/Desktop + Open in *our* bar | No room for that chrome unless we wrap the URL |

**Cannot** wrap X in `preview.html` + an inner iframe — that hits the same “refused to connect” wall. The popup must navigate **directly** to `x.com`, so it looks like a small browser window, not a KeyPilot panel.

### Where a window *does* fit

- **Fallback** when the iframe (or tweet embed) fails: “Open preview window”
- **Optional mode**, not a replacement for E on sites that embed fine
- Accept the cost: focus steal, another window to manage, no in-place peek

Good escape hatch. Weak match for “peek without leaving the feed.”

---

## Recommendation

1. Keep the overlay as the default Link Preview.
2. Keep DNR for header-based blocks (most of the web).
3. Keep host embed rewrites for X posts (and add others as needed).
4. Do **not** replace E with `chrome.windows.create` as the default.
5. If we add a window at all, treat it as an explicit fallback (failed iframe, or a per-host setting “this site never embeds”), not as the same UI surface.

---

## Open questions (if we implement the window)

- Position/size relative to the originating tab vs last cursor.
- Whether creating the window focuses it (usually yes — interrupts feed browsing).
- Closing: E/Esc in the popup vs focusing the original tab.
- One window vs stacking if E is pressed again.
- Whether Mobile UA session rules should apply to that window’s tab id.
- How `MODES.POPOVER` / hybrid focus interact when the preview is no longer a child iframe of the page.
