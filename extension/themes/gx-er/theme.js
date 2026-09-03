import { createKeyChromeTokens, createProRadiusTokens, createProTypeTokens, createTitlebarChromeTokens } from '../schema.js';
import { createGxColor, createGxEffect } from '../chrome-recipes.js';
import { GX_ER_CLICK_DEFAULTS } from '../click-defaults.js';

const color = createGxColor();

const type = createProTypeTokens({
  display: "'ROBOTECHGPRegular', 'TitilliumText', Helvetica, Arial, sans-serif",
  heading: "'Cubellan', 'TitilliumText', Helvetica, Arial, sans-serif",
  subhead: "'TitilliumText', Helvetica, Arial, sans-serif",
  body: "'Ezarion', 'Dosis', Helvetica, Arial, sans-serif",
  ui: "'TitilliumText', Helvetica, Arial, sans-serif",
  kbd: "'Dosis', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  mono: "'Dosis', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  caption: "'Ezarion', Helvetica, Arial, sans-serif"
});
type.letterSpacing = {
  display: '0.08em',
  titlebar: '0.06em',
  ui: '0.02em'
};
type.textTransform = {
  display: 'uppercase',
  titlebar: 'uppercase'
};

export const GX_ER_THEME = Object.freeze({
  id: 'gx-er',
  meta: Object.freeze({ name: 'GX-er' }),
  type,
  titlebar: createTitlebarChromeTokens({
    titleWeight: '700',
    iconDisplay: 'inline-flex',
    iconSize: '12px',
    kbdTransform: 'uppercase',
    kbdTracking: '0.06em'
  }),
  keys: createKeyChromeTokens({
    shading: 'flat',
    border: '1px solid rgba(0, 229, 255, 0.35)',
    cornerMode: 'cut',
    cutSize: '4px'
  }),
  radius: createProRadiusTokens({
    panel: '0px',
    btn: '0px',
    field: '0px',
    xs: '0px',
    sm: '0px'
  }),
  color,
  effect: createGxEffect(color),
  shape: Object.freeze({ cornerMode: 'cut', cutSize: '8px' }),
  icons: Object.freeze({
    pack: 'gx-er',
    fallbackPack: 'shared',
    overrides: Object.freeze({
      close: 'chrome/close.svg',
      collapse: 'chrome/collapse.svg'
    }),
    color: Object.freeze({
      chrome: color.accent,
      keycap: '#001018',
      accent: color.accent
    })
  }),
  clickDefaults: GX_ER_CLICK_DEFAULTS
});
