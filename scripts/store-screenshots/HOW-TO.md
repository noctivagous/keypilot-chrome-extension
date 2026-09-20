Generate captures and localized composites for all four locales with one command:

cd keypilot-chrome-extension
npm run store:screenshots:auto -- --locales=en,es,es_419,de && npm run store:screenshots -- --all

This uses Chrome for Testing, captures the live extension on the fixture with
`?lang=` for each locale, then creates numbered PNGs and SVG composites.

Generated assets are located at:

keypilot-chrome-extension/online-stores/generated/chrome/<locale>/

generated/chrome/en/01-key-click-browsing.png
generated/chrome/en/02-keyboard-map.png
generated/chrome/en/03-customize-workflow.png
generated/chrome/en/01-key-click-browsing.svg