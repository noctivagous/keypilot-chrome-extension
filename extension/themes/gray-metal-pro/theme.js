import { createKeyChromeTokens, createProRadiusTokens, createProTypeTokens, createTitlebarChromeTokens } from '../schema.js';
import { createMetalColor, createMetalEffect } from '../chrome-recipes.js';
import { GRAY_METAL_CLICK_DEFAULTS } from '../click-defaults.js';

const color = createMetalColor();

export const GRAY_METAL_PRO_THEME = Object.freeze({
  id: 'gray-metal-pro',
  meta: Object.freeze({ name: 'Gray Metal Pro' }),
  type: createProTypeTokens({
    ui: 'Helvetica, Arial, sans-serif'
  }),
  titlebar: createTitlebarChromeTokens(),
  keys: createKeyChromeTokens(),
  radius: createProRadiusTokens({ panel: '3px', btn: '2px' }),
  color,
  effect: createMetalEffect(color),
  shape: Object.freeze({ cornerMode: 'radius', cutSize: '0px' }),
  icons: Object.freeze({
    pack: 'gray-metal-pro',
    fallbackPack: 'shared',
    overrides: Object.freeze({}),
    color: Object.freeze({
      chrome: color.fg,
      keycap: '#1c1c1c',
      accent: color.accent
    })
  }),
  clickDefaults: GRAY_METAL_CLICK_DEFAULTS
});
