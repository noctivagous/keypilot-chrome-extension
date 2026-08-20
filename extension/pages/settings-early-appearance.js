/**
 * Blocking Settings hydrate for Keyboard Keys appearance.
 * Runs before the module boot so Shading / key chrome do not flash Bevel→Flat
 * while KeyPilot and chrome.storage catch up.
 */
(function () {
  var OVERRIDES_KEY = 'kp_theme_overrides_v1';
  var SETTINGS_KEY = 'kp_settings_v1';
  var SHADE_BEVEL =
    'linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 18%, transparent 42%)';

  function peekOverrides() {
    try {
      var raw = localStorage.getItem(OVERRIDES_KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch (e) {
      return {};
    }
  }

  function setRadio(name, value) {
    var nodes = document.querySelectorAll('input[name="' + name + '"]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].checked = nodes[i].value === value;
    }
  }

  function applyKeys(keys) {
    if (!keys || typeof keys !== 'object') return;
    var shading = keys.shading === 'flat' ? 'flat' : (keys.shading === 'bevel' ? 'bevel' : null);
    if (shading) setRadio('app-key-shading', shading);
    if (keys.cornerMode === 'cut' || keys.cornerMode === 'radius') {
      setRadio('app-key-corner', keys.cornerMode);
    }
    var cutEl = document.getElementById('app-key-cut-range');
    var cutNum = document.getElementById('app-key-cut-number');
    if (keys.cutSize && (cutEl || cutNum)) {
      var n = parseFloat(String(keys.cutSize));
      if (Number.isFinite(n)) {
        if (cutEl) cutEl.value = String(n);
        if (cutNum) cutNum.value = String(n);
      }
    }
    var borderEl = document.getElementById('app-key-border');
    if (keys.border && borderEl) borderEl.value = String(keys.border);

    var root = document.documentElement;
    if (!root || !root.style) return;
    if (shading === 'flat' || shading === 'bevel') {
      var flat = shading === 'flat';
      root.style.setProperty('--kp-key-shading', shading);
      root.style.setProperty('--kp-key-sheen-opacity', flat ? '0' : '1');
      root.style.setProperty('--kp-key-shade-layer', flat ? 'transparent' : SHADE_BEVEL);
    }
  }

  applyKeys(peekOverrides().keys);

  try {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) return;
    chrome.storage.sync.get([SETTINGS_KEY], function (result) {
      try {
        var stored = result && result[SETTINGS_KEY];
        var ov = stored && stored.themeOverrides && typeof stored.themeOverrides === 'object'
          ? stored.themeOverrides
          : null;
        if (ov && ov.keys) applyKeys(ov.keys);
      } catch (e) { /* ignore */ }
    });
  } catch (e) { /* ignore */ }
})();
