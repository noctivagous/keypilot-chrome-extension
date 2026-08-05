/**
 * Early New Tab display bootstrap (theme + font size + UI scale).
 * Loaded as an external script so MV3 CSP allows it (no inline scripts).
 */
(function () {
  try {
    var t = localStorage.getItem('kp_newtab_theme');
    // Current ids + legacy names from earlier iterations.
    // Default (no stored preference) is earth.
    if (t === 'cyberforward' || t === 'noctivagous') {
      document.documentElement.setAttribute('data-theme', 'cyberforward');
    } else {
      document.documentElement.setAttribute('data-theme', 'earth');
    }
  } catch (e) {
    // ignore
  }

  try {
    var fontPx = parseFloat(localStorage.getItem('kp_newtab_font_size_px'));
    if (!isFinite(fontPx) || fontPx <= 0) {
      // Legacy multiplier: 1 → 24px root
      var legacy = parseFloat(localStorage.getItem('kp_newtab_font_scale'));
      if (isFinite(legacy) && legacy > 0) fontPx = legacy * 24;
    }
    if (isFinite(fontPx) && fontPx > 0) {
      document.documentElement.style.setProperty('--nt-font-size-px', String(fontPx));
    }
  } catch (e) {
    // ignore
  }

  try {
    var scale = parseFloat(localStorage.getItem('kp_newtab_ui_scale'));
    if (isFinite(scale) && scale > 0) {
      document.documentElement.style.setProperty('--nt-ui-scale', String(scale));
    }
  } catch (e) {
    // ignore
  }

  try {
    var w = localStorage.getItem('kp_newtab_content_width');
    if (w === 'full' || w === 'none' || w === 'max') {
      document.documentElement.style.setProperty('--nt-content-max-width', 'none');
    } else {
      var wn = parseFloat(w);
      if (isFinite(wn) && wn > 0) {
        document.documentElement.style.setProperty('--nt-content-max-width', wn + 'px');
      }
    }
  } catch (e) {
    // ignore
  }
})();
