# Chrome listing screenshot release checklist

Use Chrome for Testing to capture the live extension, then composite the listing PNGs.

From keypilot-chrome-extension:

npm run build
npm run store:screenshots:auto -- --locales=en,es,es_419,de
npm run store:screenshots -- --all

---

Fill one row per shipped locale after generating assets and uploading them in
the Chrome Developer Dashboard. Chrome does not read screenshots from the
extension package.

| Locale | Dashboard language | Generated revision (git SHA or date) | Uploaded files | Reviewer | Date |
|---|---|---|---|---|---|
| en | English | | `01-key-click-browsing.png`, `02-keyboard-map.png`, `03-customize-workflow.png`, `04-walkthrough.png`, `05-context-menu.png` | | |
| de | German | | `01-key-click-browsing.png`, `02-keyboard-map.png`, `03-customize-workflow.png`, `04-walkthrough.png`, `05-context-menu.png` | | |
| es | Spanish | | `01-key-click-browsing.png`, `02-keyboard-map.png`, `03-customize-workflow.png`, `04-walkthrough.png`, `05-context-menu.png` | | |
| es_419 | Spanish (Latin America) | | `01-key-click-browsing.png`, `02-keyboard-map.png`, `03-customize-workflow.png`, `04-walkthrough.png`, `05-context-menu.png` | | |
| zh_CN | Chinese (Simplified) | | `01-key-click-browsing.png`, `02-keyboard-map.png`, `03-customize-workflow.png`, `04-walkthrough.png`, `05-context-menu.png` | | |
| zh_TW | Chinese (Traditional) | | `01-key-click-browsing.png`, `02-keyboard-map.png`, `03-customize-workflow.png`, `04-walkthrough.png`, `05-context-menu.png` | | |
| zh_HK | Chinese (Traditional, Hong Kong) | | `01-key-click-browsing.png`, `02-keyboard-map.png`, `03-customize-workflow.png`, `04-walkthrough.png`, `05-context-menu.png` | | |
| | | | | | |

Global promo tiles (upload once, not per locale):

| Asset | File | Reviewer | Date |
|---|---|---|---|
| Small tile 440×280 | `generated/chrome/promo/small.png` | | |
| Marquee 1400×560 | `generated/chrome/promo/marquee.png` | | |

Procedure:

1. Run `npm run store:screenshots` (or `--locale=<id>` after that locale ships).
2. Open [Store listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing).
3. Select the matching language in the listing language selector. The language
   appears only after a package with that `_locales/<locale>` catalog is uploaded.
4. Paste **Detailed description** from `listing/<locale>.txt`. Chrome does
   not take this field from the package. The short **Summary from package**
   comes from `extension/_locales/<locale>/messages.json`
   (`extension_description`).
5. Under **Localized screenshots**, upload only that locale’s files from
   `online-stores/generated/chrome/<locale>/`.
6. Leave **Small promotional tile** and **Marquee promotional tile** as the
   global English promo PNGs. Do not upload per-locale promo variants.

Detailed description paste record:

| Locale | Dashboard language | Source file | Pasted | Reviewer | Date |
|---|---|---|---|---|---|
| en | English | `listing/en.txt` | | | |
| de | German | `listing/de.txt` | | | |
| es | Spanish | `listing/es.txt` | | | |
| es_419 | Spanish (Latin America) | `listing/es_419.txt` | | | |
| zh_CN | Chinese (Simplified) | `listing/zh_CN.txt` | | | |
| zh_TW | Chinese (Traditional) | `listing/zh_TW.txt` | | | |
| zh_HK | Chinese (Traditional, Hong Kong) | `listing/zh_HK.txt` | | | |

