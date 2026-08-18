/** Shared @font-face rules for theme type stacks (web-accessible fonts/). */

function fontUrl(file) {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(`fonts/${file}`);
    }
  } catch { /* ignore */ }
  return `../fonts/${file}`;
}

/**
 * @returns {string}
 */
export function getThemeFontFaceCss() {
  const robotech = fontUrl('ROBOTECHGPRegular.ttf');
  const titillium = fontUrl('TitilliumTextRegular.otf');
  const cubellan = fontUrl('CubellanRegular.ttf');
  const ezarion = fontUrl('EzarionRegular.ttf');
  const dosis = fontUrl('DosisBook.ttf');
  return `
@font-face {
  font-family: 'ROBOTECHGPRegular';
  src: url('${robotech}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'TitilliumText';
  src: url('${titillium}') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Cubellan';
  src: url('${cubellan}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Ezarion';
  src: url('${ezarion}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Dosis';
  src: url('${dosis}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
`.trim();
}

/** Relative URLs for extension pages (settings/docs) that sit in pages/. */
export function getThemeFontFaceCssForPages() {
  return `
@font-face {
  font-family: 'ROBOTECHGPRegular';
  src: url('../fonts/ROBOTECHGPRegular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'TitilliumText';
  src: url('../fonts/TitilliumTextRegular.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Cubellan';
  src: url('../fonts/CubellanRegular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Ezarion';
  src: url('../fonts/EzarionRegular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Dosis';
  src: url('../fonts/DosisBook.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
`.trim();
}
