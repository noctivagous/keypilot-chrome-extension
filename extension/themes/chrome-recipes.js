/**
 * Shared chrome color/effect recipes used by theme packages.
 */

const METAL_SPECULAR =
  'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.08) 28%, transparent 55%)';

export function createDarkProColor() {
  return {
    bg: '#0f0f10',
    panel: '#232323',
    panelEdge: '#3a3a3a',
    panelEdgeDark: '#111',
    titleTop: '#4c4c4c',
    titleMid: '#353535',
    titleBot: '#252525',
    btnTop: '#4a4a4a',
    btnMid: '#343434',
    btnBot: '#2a2a2a',
    litTop: '#5a7a9a',
    litBot: '#3a5570',
    litEdge: '#2a4a66',
    accent: '#4a90c8',
    accent2: '#4a90c8',
    fg: '#ddd',
    fgDim: '#aaa',
    fgMute: '#777',
    fieldBg: '#141414',
    fieldEdge: '#0a0a0a',
    fieldInsetTop: '#333',
    hover: 'rgba(255,255,255,0.06)',
    selected: 'rgba(74,144,200,0.22)',
    selectedText: '#e8f0f8',
    focusRing: 'inset 0 0 0 1px rgba(74,144,200,0.55)',
    kbdColor: '#ddd',
    scrollbarThumb: '#4a4a4a',
    scrollbarThumbHover: '#5c5c5c',
    scrollbarTrack: '#141414'
  };
}

export function createDarkProEffect(c) {
  return {
    titlebarBg: `linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    titlebarBorder: `1px solid ${c.panelEdgeDark}`,
    titlebarShadow: `0 1px 0 ${c.panelEdge}`,
    panelBg: c.panel,
    panelBorder: `1px solid ${c.panelEdgeDark}`,
    panelShadow:
      `0 0 0 1px ${c.panelEdge} inset, ` +
      `0 0 0 1px rgba(190, 190, 190, 0.52), ` +
      `0 0 10px rgba(255, 255, 255, 0.14), ` +
      `0 16px 40px rgba(0,0,0,0.55)`,
    btnBg: `linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 50%, ${c.btnBot} 100%)`,
    btnBorder: `1px solid ${c.panelEdgeDark}`,
    btnLitBg: `linear-gradient(180deg, ${c.litTop} 0%, ${c.litBot} 100%)`,
    btnLitBorder: `1px solid ${c.litEdge}`,
    fieldBg: c.fieldBg,
    fieldBorder: `1px solid ${c.fieldEdge}`,
    fieldShadow: `inset 0 1px 0 ${c.fieldInsetTop}`,
    kbdBg: c.fieldBg,
    kbdBorder: `1px solid ${c.panelEdgeDark}`,
    kbdShadow: 'none',
    backdropBg: 'rgba(0,0,0,0.35)',
    backdropBlur: 'blur(6px)',
    hatchEdit:
      'repeating-linear-gradient(-45deg, rgba(180, 200, 220, 0.08) 0px, rgba(180, 200, 220, 0.08) 1px, transparent 1px, transparent 7px)',
    hatchEditTitlebarBg: 'linear-gradient(180deg, #646464 0%, #4a4a4a 45%, #383838 100%)',
    hatchEditBodyBg: '#1a1c20'
  };
}

export function createMetalColor() {
  return {
    bg: '#6e6e6e',
    panel: '#838383',
    panelEdge: 'rgba(190,190,190,0.48)',
    panelEdgeDark: 'rgba(42,52,62,0.92)',
    titleTop: '#b0b0b0',
    titleMid: '#929292',
    titleBot: '#787878',
    btnTop: '#c2c2c2',
    btnMid: '#9e9e9e',
    btnBot: '#868686',
    litTop: '#7aa0c0',
    litBot: '#4a7090',
    litEdge: '#3a5a78',
    accent: '#3a6a94',
    accent2: '#3a6a94',
    fg: '#1c1c1c',
    fgDim: 'rgba(28,28,28,0.72)',
    fgMute: 'rgba(28,28,28,0.55)',
    fieldBg: '#9a9a9a',
    fieldEdge: '#4a4a4a',
    fieldInsetTop: 'rgba(255,255,255,0.35)',
    hover: 'rgba(255,255,255,0.22)',
    selected: 'rgba(58,106,148,0.28)',
    selectedText: '#0e1a24',
    focusRing: 'inset 0 0 0 1px rgba(58,106,148,0.55)',
    kbdColor: '#141414',
    scrollbarThumb: '#a8a8a8',
    scrollbarThumbHover: '#b5b5b5',
    scrollbarTrack: '#747474'
  };
}

export function createMetalEffect(c) {
  return {
    titlebarBg: `${METAL_SPECULAR}, linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    titlebarBorder: '1px solid #4a4a4a',
    titlebarShadow: '0 1px 0 rgba(255,255,255,0.35)',
    panelBg: `${METAL_SPECULAR}, linear-gradient(180deg, #9a9a9a 0%, #838383 48%, #707070 100%)`,
    panelBorder: '1px solid rgba(42,52,62,0.92)',
    panelShadow:
      '0 0 0 1px rgba(255,255,255,0.28) inset, ' +
      '0 0 0 1px rgba(190,190,190,0.48), ' +
      '0 0 10px rgba(255,255,255,0.12), ' +
      '0 16px 40px rgba(0,0,0,0.45)',
    btnBg: `linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 50%, ${c.btnBot} 100%)`,
    btnBorder: '1px solid #4a4a4a',
    btnLitBg: `linear-gradient(180deg, ${c.litTop} 0%, ${c.litBot} 100%)`,
    btnLitBorder: `1px solid ${c.litEdge}`,
    fieldBg: c.fieldBg,
    fieldBorder: '1px solid #4a4a4a',
    fieldShadow: 'inset 0 1px 0 rgba(255,255,255,0.40)',
    kbdBg: 'linear-gradient(180deg, #e4e4e4 0%, #c8c8c8 45%, #b0b0b0 55%, #9a9a9a 100%)',
    kbdBorder: '1px solid #3d3d3d',
    kbdShadow:
      '0 1px 0 rgba(255,255,255,0.72) inset, 0 -1px 0 rgba(0,0,0,0.28) inset, 0 1px 2px rgba(0,0,0,0.32)',
    backdropBg: 'rgba(40,40,40,0.35)',
    backdropBlur: 'blur(6px)',
    hatchEdit:
      'repeating-linear-gradient(-45deg, rgba(24, 24, 24, 0.28) 0px, rgba(24, 24, 24, 0.28) 1px, transparent 1px, transparent 7px)',
    hatchEditTitlebarBg: `${METAL_SPECULAR}, linear-gradient(180deg, #b8b8b8 0%, #9a9a9a 45%, #808080 100%)`,
    hatchEditBodyBg: '#8a8a8a'
  };
}

export function createGxColor() {
  return {
    bg: '#0a0a0c',
    panel: '#16161a',
    panelEdge: '#2a2a32',
    panelEdgeDark: '#050506',
    titleTop: '#2c2c34',
    titleMid: '#1c1c22',
    titleBot: '#121216',
    btnTop: '#3a3a44',
    btnMid: '#26262e',
    btnBot: '#1a1a20',
    litTop: '#00e5ff',
    litBot: '#0088aa',
    litEdge: '#006688',
    accent: '#00e5ff',
    accent2: '#ff2d95',
    fg: '#e8e8ef',
    fgDim: '#9aa0b0',
    fgMute: '#6a7080',
    fieldBg: '#0c0c10',
    fieldEdge: '#000',
    fieldInsetTop: '#333344',
    hover: 'rgba(0,229,255,0.08)',
    selected: 'rgba(0,229,255,0.18)',
    selectedText: '#f0ffff',
    focusRing: 'inset 0 0 0 1px rgba(0,229,255,0.55)',
    kbdColor: '#00e5ff',
    scrollbarThumb: '#3a3a44',
    scrollbarThumbHover: '#00e5ff',
    scrollbarTrack: '#0c0c10'
  };
}

export function createGxEffect(c) {
  return {
    titlebarBg: `linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    titlebarBorder: `1px solid ${c.panelEdgeDark}`,
    titlebarShadow: `0 1px 0 ${c.accent}33`,
    panelBg: `linear-gradient(180deg, #1c1c22 0%, ${c.panel} 48%, #101014 100%)`,
    panelBorder: `1px solid ${c.panelEdgeDark}`,
    panelShadow:
      `0 0 0 1px ${c.panelEdge} inset, ` +
      `0 0 0 1px rgba(0, 229, 255, 0.22), ` +
      `0 0 14px rgba(0, 229, 255, 0.12), ` +
      `0 16px 40px rgba(0,0,0,0.65)`,
    btnBg: `linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 50%, ${c.btnBot} 100%)`,
    btnBorder: `1px solid ${c.panelEdgeDark}`,
    btnLitBg: `linear-gradient(180deg, ${c.litTop} 0%, ${c.litBot} 100%)`,
    btnLitBorder: `1px solid ${c.litEdge}`,
    fieldBg: c.fieldBg,
    fieldBorder: `1px solid ${c.fieldEdge}`,
    fieldShadow: `inset 0 1px 0 ${c.fieldInsetTop}`,
    kbdBg: 'rgba(0, 229, 255, 0.08)',
    kbdBorder: `1px solid ${c.accent}`,
    kbdShadow: `0 0 0 1px ${c.accent}55, 0 0 8px ${c.accent}44`,
    backdropBg: 'rgba(0,0,0,0.5)',
    backdropBlur: 'blur(8px)',
    hatchEdit:
      'repeating-linear-gradient(-45deg, rgba(0, 229, 255, 0.16) 0px, rgba(0, 229, 255, 0.16) 1px, transparent 1px, transparent 7px)',
    hatchEditTitlebarBg: `linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    hatchEditBodyBg: '#101014'
  };
}
