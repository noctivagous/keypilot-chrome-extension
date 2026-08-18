/** Keep in sync with CURSOR_MODE in src/config/constants.js */
const NO_CUSTOM = 'NO-CUSTOM-CURSORS';

export const DARK_PRO_CLICK_DEFAULTS = Object.freeze({
  cursorMode: NO_CUSTOM,
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: 'crosshair',
      lineWidth: 4,
      sizePixels: 10,
      gap: 6
    }),
    focusColor: 'blue',
    overlayFillEnabled: false,
    overlayShadowEnabled: false,
    rectangleThickness: 3,
    clickEffect: 'flash',
    keyboardLinkHoverHints: false,
    paintStrategy: 'BC',
    focusPadding: 2
  })
});

export const GRAY_METAL_CLICK_DEFAULTS = Object.freeze({
  cursorMode: NO_CUSTOM,
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: 'crosshair',
      lineWidth: 5,
      sizePixels: 12,
      gap: 6
    }),
    focusColor: 'blue',
    overlayFillEnabled: false,
    overlayShadowEnabled: false,
    rectangleThickness: 4,
    clickEffect: 'flash',
    keyboardLinkHoverHints: false,
    paintStrategy: 'BC',
    focusPadding: 2
  })
});

export const GX_ER_CLICK_DEFAULTS = Object.freeze({
  cursorMode: NO_CUSTOM,
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: 'crosshair',
      lineWidth: 3,
      sizePixels: 14,
      gap: 8
    }),
    focusColor: 'green',
    overlayFillEnabled: false,
    overlayShadowEnabled: true,
    rectangleThickness: 3,
    clickEffect: 'flash',
    keyboardLinkHoverHints: false,
    paintStrategy: 'BC',
    focusPadding: 2
  })
});
