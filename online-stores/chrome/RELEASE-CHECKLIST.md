# Chrome listing screenshot release checklist

Fill one row per shipped locale after generating assets and uploading them in
the Chrome Developer Dashboard. Chrome does not read screenshots from the
extension package.

| Locale | Dashboard language | Generated revision (git SHA or date) | Uploaded files | Reviewer | Date |
|---|---|---|---|---|---|
| en | English | | `01-key-click-browsing.png`, `02-keyboard-map.png`, `03-customize-workflow.png` | | |
| de | German | | `01-key-click-browsing.png`, `02-keyboard-map.png`, `03-customize-workflow.png` | | |
| es | Spanish | | `01-key-click-browsing.png`, `02-keyboard-map.png`, `03-customize-workflow.png` | | |
| es_419 | Spanish (Latin America) | | `01-key-click-browsing.png`, `02-keyboard-map.png`, `03-customize-workflow.png` | | |
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
4. Under **Localized screenshots**, upload only that locale’s files from
   `online-stores/generated/chrome/<locale>/`.
5. Leave **Small promotional tile** and **Marquee promotional tile** as the
   global English promo PNGs. Do not upload per-locale promo variants.
