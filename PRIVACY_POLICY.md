# KeyPilot Privacy Policy

**Effective date:** September 3, 2026

KeyPilot is a keyboard-navigation browser extension. It does not collect,
sell, share, rent, or retain personal data on servers operated by its
developer. KeyPilot has no analytics, advertising, telemetry, user accounts,
or tracking identifiers.

## Information that stays on your device

KeyPilot stores its settings, custom keyboard layouts, enabled or disabled
state, onboarding progress, and locally generated interface data in the
browser's extension storage. This information stays in your browser and is
not uploaded to the developer.

When you explicitly open features such as the address-bar overlay, history
launcher, bookmarks view, or Top Sites view, KeyPilot reads the corresponding
browser data locally to render that feature. Browsing history, bookmarks, Top
Sites, tab information, and page URLs are not collected or transmitted to
KeyPilot's developer.

## Requests to third-party services

KeyPilot makes limited requests only when needed for a feature or lookup:

- Site icons may be requested through the browser's favicon service, using the
  relevant site URL or domain.
- A dictionary lookup sends the single word requested to
  `api.dictionaryapi.dev`.
- Video preview lookups send the specific video URL or video ID requested to
  the relevant provider, such as Vimeo, Rumble, Odysee, or YouTube's image
  service.

KeyPilot does not send bulk browsing history, page content, personal
identifiers, or extension usage data in these requests. KeyPilot does not
execute JavaScript fetched from external services; all extension code is
included in the installed package.

## User-authored scripts

The optional **Execute JS** feature runs a script supplied by you in the
content-script isolated world of the current page. The script can read or
modify that page's DOM and can use only the callbacks you explicitly enable.
It cannot access `chrome.*` extension APIs, KeyPilot storage, or the KeyPilot
instance. Scripts have an eight-second timeout.

Do not paste scripts you do not understand. User-authored scripts run locally
and are not sent to KeyPilot's developer.

## Data retention and deletion

KeyPilot does not retain data on developer-operated servers. Extension
settings and local data can be removed through the browser's extension-storage
controls or by uninstalling the extension. Browser history, bookmarks, and
Top Sites data remain governed by the browser and are not deleted by
KeyPilot.

## Changes to this policy

If KeyPilot's data practices change, this policy will be updated before the
change takes effect.

## Contact

Questions or support requests can be filed at:

<https://github.com/noctivagous/keypilot-chrome-extension/issues>
