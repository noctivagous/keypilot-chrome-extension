import { createKeyChromeTokens, createProRadiusTokens, createProTypeTokens, createTitlebarChromeTokens } from '../schema.js';
import { createDarkProColor, createDarkProEffect, createMetalColor, createMetalEffect } from '../chrome-recipes.js';
import { DARK_PRO_CLICK_DEFAULTS } from '../click-defaults.js';

const color = createDarkProColor();
const metalColor = createMetalColor();

export const DARK_PRO_THEME = Object.freeze({
  id: 'dark-pro',
  meta: Object.freeze({ name: 'Dark Pro' }),
  type: createProTypeTokens(),
  titlebar: createTitlebarChromeTokens(),
  keys: createKeyChromeTokens(),
  radius: createProRadiusTokens(),
  color,
  effect: createDarkProEffect(color),
  shape: Object.freeze({ cornerMode: 'radius', cutSize: '0px' }),
  icons: Object.freeze({
    pack: 'dark-pro',
    fallbackPack: 'shared',
    overrides: Object.freeze({}),
    color: Object.freeze({
      chrome: color.fg,
      keycap: '#0c1018',
      accent: color.accent
    })
  }),
  clickDefaults: DARK_PRO_CLICK_DEFAULTS,
  surfaces: Object.freeze({
    onboarding: Object.freeze({
      color: metalColor,
      effect: createMetalEffect(metalColor),
      icons: Object.freeze({
        color: Object.freeze({
          chrome: metalColor.fg,
          keycap: '#1c1c1c',
          accent: metalColor.accent
        })
      })
    })
  })
});
