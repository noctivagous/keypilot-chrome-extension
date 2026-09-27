import { CHROME_SELECTORS, waitForSelectors } from '../cdp.mjs';

export async function assertInstallChromeVisible(session) {
  await waitForSelectors(session, [
    CHROME_SELECTORS.walkthrough,
    CHROME_SELECTORS.walkthroughTitle,
    CHROME_SELECTORS.controlStrip,
    CHROME_SELECTORS.keyboardHelp,
    CHROME_SELECTORS.keyboardTitlebar
  ], 30_000);
  console.log('  Flow 1: walkthrough, control strip, and keyboard reference are visible');
}
