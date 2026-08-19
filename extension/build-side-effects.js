/**
 * Post-bundle build side effects for KeyPilot.
 * Manifest stamp, README/website sync, early-inject UI block, etc.
 * Invoked by extension/build.js after esbuild finishes.
 */
import fs from 'fs';
import path from 'path';
import { KEYBINDINGS, Z_INDEX } from './src/config/constants.js';
import {
  BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META,
  BUILTIN_KEYBOARD_LAYOUT_META,
  BUILD_EXCLUDED_KEY_ACTIONS,
  BUILD_ENABLE_MACRO_BUILDER,
  DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID,
  DEFAULT_KEYBOARD_LAYOUT_ID,
  SYSTEM_LAYER_ACTION_IDS,
  buildEffectiveKeybindings,
  getKeyboardUiLayoutForLayout,
  inferFamilyAndHandednessFromLayoutId
} from './src/config/keyboard-layouts.js';
import { FUNCTION_LIBRARY } from './src/config/function-library.js';
import {
  KEYBINDINGS_KEYBOARD_LAYOUT,
  KEYBINDINGS_UI_STYLE_ATTR,
  getKeybindingsUiCss
} from './src/ui/keybindings-ui-shared.js';
import { POPUP_THEME_VARS } from './src/ui/popup-theme-vars.js';
import { getAllThemesCss, getTheme, THEME_IDS } from './themes/index.js';

function getBuildTimestamp(now = new Date()) {
  // Format date as: Mar-14-2026-4:20PM
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[now.getMonth()];
  const day = now.getDate();
  const year = now.getFullYear();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minutesStr = minutes.toString().padStart(2, '0');
  return `${month}-${day}-${year}-${hours}:${minutesStr}${ampm}`;
}


export async function runPostBundleTasks({ shouldMinify = false, enableMacroBuilder = false } = {}) {
  const shouldMinifyFlag = shouldMinify;
  if (Array.isArray(BUILD_EXCLUDED_KEY_ACTIONS) && BUILD_EXCLUDED_KEY_ACTIONS.length) {
    console.log(`Build-excluded key actions: ${BUILD_EXCLUDED_KEY_ACTIONS.join(', ')}`);
  }
  const macroBuilderOn = !!enableMacroBuilder || !!BUILD_ENABLE_MACRO_BUILDER;
  console.log(`Macro Builder UI: ${macroBuilderOn ? 'enabled' : 'disabled (v1 — use Execute JS)'}`);
  // Validate background.js exists in extension directory
  if (fs.existsSync('background.js')) {
    console.log('background.js found and ready for extension');
  } else {
    console.error('ERROR: background.js not found in extension directory! Extension will not work properly.');
    process.exit(1);
  }

  /**
   * README Key Mappings Generator
   *
   * We keep docs in sync with the real keybindings in `src/config/constants.js`.
   * Only the section between the markers is overwritten.
   */
  const README_MARKER_START = '<!-- KP_KEY_MAPPINGS_START -->';
  const README_MARKER_END = '<!-- KP_KEY_MAPPINGS_END -->';

  function formatInlineCode(text) {
    // Special-case backtick so it renders correctly in markdown.
    if (text === '`') return '`` ` ``';
    // If key label itself contains backticks, fall back to plain text.
    if (String(text).includes('`')) return String(text);
    return `\`${String(text)}\``;
  }

  function formatKeysLabel(displayKey) {
    if (!displayKey) return '';
    const str = String(displayKey).trim();
    // Common pattern in this codebase: "1 or /"
    if (str.includes(' or ')) {
      return str
        .split(' or ')
        .map((part) => formatInlineCode(part.trim()))
        .join(' or ');
    }
    return formatInlineCode(str);
  }

  function actionCategory(actionId) {
    if (!actionId) return 'Other';
    if (actionId.startsWith('PAGE_')) return 'Page navigation';
    if (actionId === 'TAB_LEFT' || actionId === 'TAB_RIGHT' || actionId === 'NEW_TAB' || actionId === 'CLOSE_TAB') return 'Tabs';
    if (actionId === 'DELETE' || actionId === 'CANCEL' || actionId === 'HIGHLIGHT' || actionId === 'RECTANGLE_HIGHLIGHT' || actionId === 'TOGGLE_KEYBOARD_HELP') {
      return 'Modes & UI';
    }
    return 'Navigation';
  }

  function buildKeyMappingsMarkdown({ keybindings, manifest }) {
    const rows = Object.entries(keybindings || {}).map(([id, b]) => {
      const keys = formatKeysLabel(b.displayKey || b.keyLabel || (Array.isArray(b.keys) ? b.keys.join(' / ') : ''));
      const action = String(b.description || b.label || id);
      const sortRow = typeof b.row === 'number' ? b.row : 99;
      return { id, keys, action, sortRow, category: actionCategory(id) };
    });

    // Stable sort: category, row, keys, id
    const categoryOrder = ['Navigation', 'Tabs', 'Page navigation', 'Modes & UI', 'Other'];
    rows.sort((a, b) => {
      const ca = categoryOrder.indexOf(a.category);
      const cb = categoryOrder.indexOf(b.category);
      if (ca !== cb) return (ca === -1 ? 999 : ca) - (cb === -1 ? 999 : cb);
      if (a.sortRow !== b.sortRow) return a.sortRow - b.sortRow;
      const k = String(a.keys).localeCompare(String(b.keys));
      if (k !== 0) return k;
      return String(a.id).localeCompare(String(b.id));
    });

    const byCategory = new Map();
    for (const r of rows) {
      if (!byCategory.has(r.category)) byCategory.set(r.category, []);
      byCategory.get(r.category).push(r);
    }

    const globalRows = [];
    const commands = (manifest && manifest.commands) || {};
    for (const [commandId, cmd] of Object.entries(commands)) {
      const suggested = cmd && cmd.suggested_key && cmd.suggested_key.default;
      const keys = suggested ? formatInlineCode(suggested) : '';
      const action = cmd && cmd.description ? String(cmd.description) : `Command: ${commandId}`;
      if (keys) globalRows.push({ keys, action });
    }

    let out = '';
    out += `${README_MARKER_START}\n`;
    out += `> Generated by \`extension/build.js\` from \`extension/src/config/constants.js\` and \`extension/manifest.json\`. Do not edit by hand.\n\n`;

    for (const category of categoryOrder) {
      const catRows = byCategory.get(category);
      if (!catRows || catRows.length === 0) continue;
      out += `#### ${category}\n\n`;
      out += `| Keys | Action |\n`;
      out += `| --- | --- |\n`;
      for (const r of catRows) {
        out += `| ${r.keys} | ${r.action} |\n`;
      }
      out += `\n`;
    }

    if (globalRows.length) {
      out += `#### Global shortcuts\n\n`;
      out += `| Keys | Action |\n`;
      out += `| --- | --- |\n`;
      for (const r of globalRows) {
        out += `| ${r.keys} | ${r.action} |\n`;
      }
      out += `\n`;
    }

    out += `${README_MARKER_END}\n`;
    return out;
  }

  function replaceMarkedSection(fileContent, newSection) {
    const startIdx = fileContent.indexOf(README_MARKER_START);
    const endIdx = fileContent.indexOf(README_MARKER_END);
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      return (
        fileContent.slice(0, startIdx) +
        newSection +
        fileContent.slice(endIdx + README_MARKER_END.length) // marker already included in newSection
      );
    }
    return null;
  }

  function ensureKeyMappingsSectionExists(readmeContent) {
    // Insert a "Key Mappings" header with empty markers under "Key Features" if possible.
    const header = '### ⌨️ Key Mappings';
    if (readmeContent.includes(README_MARKER_START) && readmeContent.includes(README_MARKER_END)) return readmeContent;
    if (readmeContent.includes(header)) {
      return readmeContent.replace(
        header,
        `${header}\n\n${README_MARKER_START}\n${README_MARKER_END}\n`
      );
    }

    const keyFeaturesIdx = readmeContent.indexOf('## ✨ Key Features');
    if (keyFeaturesIdx !== -1) {
      const insertAt = readmeContent.indexOf('\n', keyFeaturesIdx);
      if (insertAt !== -1) {
        return (
          readmeContent.slice(0, insertAt + 1) +
          `\n${header}\n\n${README_MARKER_START}\n${README_MARKER_END}\n\n` +
          readmeContent.slice(insertAt + 1)
        );
      }
    }

    // Fallback: append to end.
    return (
      `${readmeContent.trimEnd()}\n\n${header}\n\n${README_MARKER_START}\n${README_MARKER_END}\n`
    );
  }

  function updateReadmeFile({ readmePath, keybindings, manifest }) {
    try {
      if (!fs.existsSync(readmePath)) return;
      let content = fs.readFileSync(readmePath, 'utf8');
      content = ensureKeyMappingsSectionExists(content);
      const section = buildKeyMappingsMarkdown({ keybindings, manifest });

      const replaced = replaceMarkedSection(content, section);
      if (replaced === null) {
        console.warn(`WARN: Could not find markers in README to replace: ${readmePath}`);
        return;
      }
      if (replaced !== content) {
        fs.writeFileSync(readmePath, replaced, 'utf8');
        console.log(`✓ Updated README key mappings: ${readmePath}`);
      } else {
        console.log(`README key mappings already up-to-date: ${readmePath}`);
      }
    } catch (err) {
      console.warn(`WARN: Failed to update README key mappings for ${readmePath}:`, err && err.message ? err.message : err);
    }
  }

  /**
   * Website index.html generator
   *
   * Stamps:
   * - Build timestamp (under the download button)
   * - Key bindings tiles (between markers)
   * - Interactive keyboard JS (KEY_INFO + KEYBOARD_LAYOUT) in `website/js/script.js`
   */
  const WEBSITE_TS_MARKER_START = '<!-- KP_WEBSITE_BUILD_TIMESTAMP_START -->';
  const WEBSITE_TS_MARKER_END = '<!-- KP_WEBSITE_BUILD_TIMESTAMP_END -->';
  const WEBSITE_VERSION_MARKER_START = '<!-- KP_WEBSITE_VERSION_START -->';
  const WEBSITE_VERSION_MARKER_END = '<!-- KP_WEBSITE_VERSION_END -->';
  const WEBSITE_KEYS_MARKER_START = '<!-- KP_WEBSITE_KEY_BINDINGS_START -->';
  const WEBSITE_KEYS_MARKER_END = '<!-- KP_WEBSITE_KEY_BINDINGS_END -->';
  const WEBSITE_KEY_INFO_MARKER_START = '// KP_WEBSITE_KEY_INFO_START';
  const WEBSITE_KEY_INFO_MARKER_END = '// KP_WEBSITE_KEY_INFO_END';
  const WEBSITE_KEYBOARD_LAYOUT_MARKER_START = '// KP_WEBSITE_KEYBOARD_LAYOUT_START';
  const WEBSITE_KEYBOARD_LAYOUT_MARKER_END = '// KP_WEBSITE_KEYBOARD_LAYOUT_END';
  const WEBSITE_BINDINGS_ATTR_RE = /data-kp-website-bindings\s*=\s*"([^"]*)"/i;
  const POPUP_VERSION_RE = /(<span[^>]*class=["']version["'][^>]*>)([\s\S]*?)(<\/span>)/i;

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function replaceInnerBetweenMarkers(fileContent, startMarker, endMarker, newInner) {
    const startIdx = fileContent.indexOf(startMarker);
    const endIdx = fileContent.indexOf(endMarker);
    if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return null;
    const innerStart = startIdx + startMarker.length;
    return fileContent.slice(0, innerStart) + String(newInner) + fileContent.slice(endIdx);
  }

  /**
   * early-inject.js UI sync generator
   *
   * `early-inject.js` is loaded directly by the manifest at `document_start`,
   * so it cannot import ESM. We keep its duplicated UI constants in sync by
   * stamping a generated block between markers.
   */
  const EARLY_UI_MARKER_START = '// KP_EARLY_INJECT_UI_START';
  const EARLY_UI_MARKER_END = '// KP_EARLY_INJECT_UI_END';

  function parseOnboardingXmlForEarlyInject(xmlText) {
    // Strip comments so commented-out <task> examples are not stamped into early-inject.
    const xml = String(xmlText || '').replace(/<!--[\s\S]*?-->/g, '');
    const slides = [];

    // Extremely small/controlled XML file in this repo; keep parsing dependency-free.
    const slideRe = /<slide\b([^>]*)>([\s\S]*?)<\/slide>/g;
    const taskRe = /<task\b([^>]*)>([\s\S]*?)<\/task>/g;
    const whenRe = /<when\b([^\/>]*)\/>/g;
    // Self-closing onEnter (may span lines): <onEnter type="overlay" ... />
    const onEnterRe = /<onEnter\b([\s\S]*?)\/>/g;
    const bodyRe = /<body\b[^>]*>([\s\S]*?)<\/body>/i;
    const attrRe = /(\w+)\s*=\s*"([^"]*)"/g;

    const readAttrs = (raw) => {
      const attrs = {};
      if (!raw) return attrs;
      let m;
      attrRe.lastIndex = 0;
      while ((m = attrRe.exec(raw))) {
        const k = m[1];
        const v = m[2];
        if (k) attrs[k] = v;
      }
      return attrs;
    };

    let slideMatch;
    while ((slideMatch = slideRe.exec(xml))) {
      const slideAttrs = readAttrs(slideMatch[1]);
      const slideBody = slideMatch[2] || '';
      const id = String(slideAttrs.id || '').trim();
      if (!id) continue;

      const title = String(slideAttrs.title || '').trim();
      const tasks = [];
      const onEnter = [];

      let bodyText = '';
      const bodyMatch = bodyRe.exec(slideBody);
      if (bodyMatch) {
        bodyText = String(bodyMatch[1] || '').trim();
      }
      bodyRe.lastIndex = 0;

      let onEnterMatch;
      onEnterRe.lastIndex = 0;
      while ((onEnterMatch = onEnterRe.exec(slideBody))) {
        const oeAttrs = readAttrs(onEnterMatch[1]);
        const type = String(oeAttrs.type || '').trim();
        if (!type) continue;
        const entry = { type };
        for (const [k, v] of Object.entries(oeAttrs)) {
          if (k === 'type') continue;
          entry[k] = v;
        }
        onEnter.push(entry);
      }

      let taskMatch;
      taskRe.lastIndex = 0;
      while ((taskMatch = taskRe.exec(slideBody))) {
        const taskAttrs = readAttrs(taskMatch[1]);
        const taskBody = taskMatch[2] || '';
        const taskId = String(taskAttrs.id || '').trim();
        if (!taskId) continue;

        const label = String(taskAttrs.label || '').trim();

        // Take the first <when .../> inside the task (the authoring format here uses one).
        let when = { type: '' };
        whenRe.lastIndex = 0;
        const whenMatch = whenRe.exec(taskBody);
        if (whenMatch) {
          const wAttrs = readAttrs(whenMatch[1]);
          when = {
            type: String(wAttrs.type || '').trim(),
            action: String(wAttrs.action || '').trim(),
            target: String(wAttrs.target || '').trim(),
            mode: String(wAttrs.mode || '').trim(),
            change: String(wAttrs.change || '').trim()
          };
        }

        tasks.push({ id: taskId, label, when });
      }

      slides.push({ id, title, tasks, onEnter, bodyText });
    }

    return { slides };
  }

  function pickEarlyBindingFields(binding) {
    if (!binding) return null;
    return {
      label: binding.label,
      description: binding.description,
      keyLabel: binding.keyLabel,
      displayKey: binding.displayKey,
      keyboardClass: binding.keyboardClass
    };
  }

  function collectActionIdsFromLayout(layout) {
    const ids = new Set();
    for (const row of layout || []) {
      for (const item of row || []) {
        if (item && item.type === 'action' && item.id) ids.add(String(item.id));
      }
    }
    return ids;
  }

  function updateEarlyInjectUiBlock() {
    const earlyPath = path.resolve(process.cwd(), 'early-inject.js');
    if (!fs.existsSync(earlyPath)) {
      console.warn(`WARN: early-inject.js not found at: ${earlyPath}`);
      return;
    }

    // Keep early onboarding from flashing by stamping the walkthrough model into early-inject.
    let earlyOnboardingModel = { slides: [] };
    try {
      const onboardingPath = path.resolve(process.cwd(), 'pages', 'onboarding.xml');
      if (fs.existsSync(onboardingPath)) {
        const xml = fs.readFileSync(onboardingPath, 'utf8');
        earlyOnboardingModel = parseOnboardingXmlForEarlyInject(xml);
      } else {
        console.warn(`WARN: onboarding.xml not found at: ${onboardingPath}`);
      }
    } catch (e) {
      console.warn('WARN: Failed to parse onboarding.xml for early-inject:', e && e.message ? e.message : e);
    }

    // Stamp all built-in layouts so early-inject can render the correct keyboard layout
    // before the bundled content script loads (prevents a right->left flash).
    const builtinLayoutIds = Array.from(new Set((BUILTIN_KEYBOARD_LAYOUT_META || []).map((m) => m && m.id).filter(Boolean)));
    if (builtinLayoutIds.length === 0) builtinLayoutIds.push(DEFAULT_KEYBOARD_LAYOUT_ID);

    const earlyLayoutFamilyOptions = (BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META || [])
      .filter((m) => m && m.id)
      .map((m) => [`builtin:${m.id}`, m.label || m.id]);

    const keyboardLayoutsById = {};
    const earlyKeybindingsById = {};

    // Union of all action IDs across all stamped layouts.
    const actionIds = new Set();
    for (const layoutId of builtinLayoutIds) {
      const layout = getKeyboardUiLayoutForLayout(layoutId);
      keyboardLayoutsById[layoutId] = layout;
      for (const id of collectActionIdsFromLayout(layout)) actionIds.add(id);
    }
    // System-layer actions (KB Reference, Settings, Cancel) live outside layout
    // assignments. Stamp them too so early-inject paints class + letter on first frame.
    for (const id of SYSTEM_LAYER_ACTION_IDS || []) actionIds.add(id);

    for (const layoutId of builtinLayoutIds) {
      const { handedness } = inferFamilyAndHandednessFromLayoutId(layoutId);
      const kb = buildEffectiveKeybindings(layoutId, handedness);
      const picked = {};
      for (const id of actionIds) {
        const p = pickEarlyBindingFields(kb[id]);
        if (p) picked[id] = p;
      }
      earlyKeybindingsById[layoutId] = picked;
    }

    // Backwards compatibility: keep the old names pointing at the default layout.
    const layout = keyboardLayoutsById[DEFAULT_KEYBOARD_LAYOUT_ID] || KEYBINDINGS_KEYBOARD_LAYOUT;
    const earlyKeybindings = earlyKeybindingsById[DEFAULT_KEYBOARD_LAYOUT_ID] || {};

    // Slim Function paint map so early-inject can color/label custom-layout slots
    // without shipping handlers or the full function-library module.
    const earlyFunctionPaint = {};
    for (const [id, def] of Object.entries(FUNCTION_LIBRARY || {})) {
      if (!id || !def || typeof def !== 'object') continue;
      earlyFunctionPaint[id] = {
        label: String(def.label || id),
        keyboardClass: def.keyboardClass ? String(def.keyboardClass) : null
      };
    }

    const css = getKeybindingsUiCss({ zKeybindingsPopover: Z_INDEX.KEYBINDINGS_POPOVER });
    const escapedCss = String(css).replaceAll('`', '\\`');
    const themeCss = getAllThemesCss();
    const escapedThemeCss = String(themeCss).replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
    /** @type {Record<string, 'cut' | 'radius'>} */
    const themeCornerById = {};
    for (const themeId of THEME_IDS) {
      themeCornerById[themeId] =
        getTheme(themeId)?.shape?.cornerMode === 'cut' ? 'cut' : 'radius';
    }

    // Stamp onboarding-shared.js (export-stripped) so early-inject uses the same shell/progress helpers.
    let onboardingSharedIndented = '';
    try {
      const sharedPath = path.resolve(process.cwd(), 'src', 'ui', 'onboarding-shared.js');
      if (fs.existsSync(sharedPath)) {
        let sharedSrc = fs.readFileSync(sharedPath, 'utf8');
        // Drop ESM exports so the body is valid inside early-inject's IIFE.
        sharedSrc = sharedSrc
          .replace(/^export\s+const\s+/gm, 'const ')
          .replace(/^export\s+function\s+/gm, 'function ')
          .replace(/^export\s+\{[\s\S]*?\}\s*;?\s*$/gm, '')
          .replace(/^export\s+default\s+/gm, '');
        onboardingSharedIndented = sharedSrc
          .split('\n')
          .map((line) => (line.length ? `  ${line}` : ''))
          .join('\n');
      } else {
        console.warn(`WARN: onboarding-shared.js not found at: ${sharedPath}`);
      }
    } catch (e) {
      console.warn('WARN: Failed to stamp onboarding-shared.js into early-inject:', e && e.message ? e.message : e);
    }

    const generatedInner =
      `\n` +
      `  // NOTE: This block is auto-generated by \`extension/build.js\` from:\n` +
      `  // - \`extension/src/config/constants.js\` (KEYBINDINGS, Z_INDEX)\n` +
      `  // - \`extension/src/config/keyboard-layouts.js\` (built-in layout data)\n` +
      `  // - \`extension/src/config/function-library.js\` (slot paint: label + keyboardClass)\n` +
      `  // - \`extension/src/ui/keybindings-ui-shared.js\` (CSS + layout + style attr)\n` +
      `  // - \`extension/pages/onboarding.xml\` (early onboarding model)\n` +
      `  // - \`extension/src/ui/onboarding-shared.js\` (shell / progress / checklist DOM)\n` +
      `  // Do not edit by hand.\n` +
      `  const Z_FLOATING_KEYBOARD_HELP = ${Number(Z_INDEX.FLOATING_KEYBOARD_HELP)};\n` +
      `  const Z_KEYBINDINGS_POPOVER = ${Number(Z_INDEX.KEYBINDINGS_POPOVER)};\n` +
      `  const KEYBINDINGS_UI_STYLE_ATTR = ${JSON.stringify(KEYBINDINGS_UI_STYLE_ATTR)};\n` +
      `  const DEFAULT_KEYBOARD_LAYOUT_ID = ${JSON.stringify(DEFAULT_KEYBOARD_LAYOUT_ID)};\n` +
      `  const DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID = ${JSON.stringify(DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID)};\n` +
      `  const KNOWN_BUILTIN_LAYOUT_IDS = ${JSON.stringify(builtinLayoutIds)};\n` +
      `  const EARLY_LAYOUT_FAMILY_OPTIONS = ${JSON.stringify(earlyLayoutFamilyOptions)};\n` +
      `  const KEYBOARD_LAYOUTS_BY_ID = ${JSON.stringify(keyboardLayoutsById, null, 2)};\n` +
      `  const EARLY_KEYBINDINGS_BY_ID = ${JSON.stringify(earlyKeybindingsById, null, 2)};\n` +
      `  const KEYBINDINGS_KEYBOARD_LAYOUT = ${JSON.stringify(layout, null, 2)};\n` +
      `  const EARLY_KEYBINDINGS = ${JSON.stringify(earlyKeybindings, null, 2)};\n` +
      `  const EARLY_FUNCTION_PAINT = ${JSON.stringify(earlyFunctionPaint, null, 2)};\n` +
      `  const EARLY_ONBOARDING_MODEL = ${JSON.stringify(earlyOnboardingModel, null, 2)};\n` +
      `  const POPUP_THEME_VARS = ${JSON.stringify(POPUP_THEME_VARS, null, 2)};\n` +
      `  function applyPopupThemeVars(targetEl) {\n` +
      `    if (!targetEl || !targetEl.style) return;\n` +
      `    try {\n` +
      `      for (const [k, v] of Object.entries(POPUP_THEME_VARS)) {\n` +
      `        targetEl.style.setProperty(k, v);\n` +
      `      }\n` +
      `    } catch { /* ignore */ }\n` +
      `  }\n` +
      `  // Shared early-compatible subset of kp-chrome-shadow.js. This script cannot import ESM.\n` +
      `  const KP_THEME_CACHE_KEY = 'kp_theme_id_v1';\n` +
      `  function peekCachedThemeId() {\n` +
      `    try {\n` +
      `      const id = localStorage.getItem(KP_THEME_CACHE_KEY);\n` +
      `      if (id && KP_THEME_IDS.indexOf(id) >= 0) return id;\n` +
      `    } catch { /* ignore */ }\n` +
      `    return null;\n` +
      `  }\n` +
      `  function cacheThemeId(id) {\n` +
      `    if (!id || KP_THEME_IDS.indexOf(id) < 0) return;\n` +
      `    try { localStorage.setItem(KP_THEME_CACHE_KEY, id); } catch { /* ignore */ }\n` +
      `  }\n` +
      `  function getEarlyThemeFontFaceCss() {\n` +
      `    function fontUrl(file) {\n` +
      `      try {\n` +
      `        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {\n` +
      `          return chrome.runtime.getURL('fonts/' + file);\n` +
      `        }\n` +
      `      } catch { /* ignore */ }\n` +
      `      return '';\n` +
      `    }\n` +
      `    const faces = [\n` +
      `      ['ROBOTECHGPRegular', 'ROBOTECHGPRegular.ttf', 'truetype'],\n` +
      `      ['TitilliumText', 'TitilliumTextRegular.otf', 'opentype'],\n` +
      `      ['Cubellan', 'CubellanRegular.ttf', 'truetype'],\n` +
      `      ['Ezarion', 'EzarionRegular.ttf', 'truetype'],\n` +
      `      ['Dosis', 'DosisBook.ttf', 'truetype']\n` +
      `    ];\n` +
      `    let out = '';\n` +
      `    for (const [family, file, format] of faces) {\n` +
      `      const url = fontUrl(file);\n` +
      `      if (!url) continue;\n` +
      `      out += "@font-face{font-family:'" + family + "';src:url('" + url + "') format('" + format + "');font-weight:normal;font-style:normal;font-display:block;}" ;\n` +
      `    }\n` +
      `    return out;\n` +
      `  }\n` +
      `  function ensureEarlyThemeStyles() {\n` +
      `    try {\n` +
      `      const fontCss = getEarlyThemeFontFaceCss();\n` +
      `      if (fontCss) {\n` +
      `        let fonts = document.getElementById('kp-early-theme-fonts');\n` +
      `        if (!fonts) {\n` +
      `          fonts = document.createElement('style');\n` +
      `          fonts.id = 'kp-early-theme-fonts';\n` +
      `          (document.head || document.documentElement).appendChild(fonts);\n` +
      `        }\n` +
      `        if (fonts.textContent !== fontCss) fonts.textContent = fontCss;\n` +
      `      }\n` +
      `    } catch { /* ignore */ }\n` +
      `    try {\n` +
      `      let style = document.getElementById('kp-early-theme');\n` +
      `      if (!style) {\n` +
      `        style = document.createElement('style');\n` +
      `        style.id = 'kp-early-theme';\n` +
      `        (document.head || document.documentElement).appendChild(style);\n` +
      `      }\n` +
      `      if (style.textContent !== KP_ALL_THEMES_CSS) style.textContent = KP_ALL_THEMES_CSS;\n` +
      `    } catch { /* ignore */ }\n` +
      `  }\n` +
      `  function resolveEarlyThemeId(themeId) {\n` +
      `    if (themeId && KP_THEME_IDS.indexOf(themeId) >= 0) return themeId;\n` +
      `    return peekCachedThemeId() || 'dark-pro';\n` +
      `  }\n` +
      `  function applyEarlyTheme(themeId) {\n` +
      `    const id = resolveEarlyThemeId(themeId);\n` +
      `    const cut = KP_THEME_CORNER[id] === 'cut';\n` +
      `    ensureEarlyThemeStyles();\n` +
      `    try { document.documentElement.setAttribute('data-kp-theme', id); } catch { /* ignore */ }\n` +
      `    try {\n` +
      `      if (cut) document.documentElement.setAttribute('data-kp-corner', 'cut');\n` +
      `      else document.documentElement.removeAttribute('data-kp-corner');\n` +
      `    } catch { /* ignore */ }\n` +
      `    try {\n` +
      `      document.querySelectorAll('.kp-chrome-window, [data-kp-ui-shadow]').forEach((el) => {\n` +
      `        try {\n` +
      `          el.setAttribute('data-kp-theme', id);\n` +
      `          if (cut) el.setAttribute('data-kp-corner', 'cut');\n` +
      `          else el.removeAttribute('data-kp-corner');\n` +
      `        } catch { /* ignore */ }\n` +
      `      });\n` +
      `    } catch { /* ignore */ }\n` +
      `    cacheThemeId(id);\n` +
      `  }\n` +
      `  function ensureEarlyOpenChromeShadow(host, id) {\n` +
      `    if (!host) return null;\n` +
      `    try { host.setAttribute('data-kp-ui-shadow', String(id || 'chrome')); } catch { /* ignore */ }\n` +
      `    try { host.classList.add('kp-chrome-window'); } catch { /* ignore */ }\n` +
      `    try {\n` +
      `      const themeId = document.documentElement.getAttribute('data-kp-theme') || peekCachedThemeId() || 'dark-pro';\n` +
      `      host.setAttribute('data-kp-theme', themeId);\n` +
      `      const cut = document.documentElement.getAttribute('data-kp-corner') === 'cut' || KP_THEME_CORNER[themeId] === 'cut';\n` +
      `      if (cut) host.setAttribute('data-kp-corner', 'cut');\n` +
      `      else host.removeAttribute('data-kp-corner');\n` +
      `    } catch { /* ignore */ }\n` +
      `    try { return host.shadowRoot || host.attachShadow({ mode: 'open' }); } catch { return host.shadowRoot || null; }\n` +
      `  }\n` +
      `  const KEYBINDINGS_UI_EARLY_CSS = \`${escapedCss}\`;\n` +
      `  const KP_ALL_THEMES_CSS = \`${escapedThemeCss}\`;\n` +
      `  const KP_THEME_IDS = ${JSON.stringify([...THEME_IDS])};\n` +
      `  const KP_THEME_CORNER = ${JSON.stringify(themeCornerById)};\n` +
      (onboardingSharedIndented
        ? `\n  // --- begin stamped onboarding-shared.js ---\n${onboardingSharedIndented}\n  // --- end stamped onboarding-shared.js ---\n`
        : '');

    const content = fs.readFileSync(earlyPath, 'utf8');
    const next = replaceInnerBetweenMarkers(content, EARLY_UI_MARKER_START, EARLY_UI_MARKER_END, generatedInner);
    if (next === null) {
      throw new Error(
        `early-inject.js is missing UI markers (${EARLY_UI_MARKER_START} / ${EARLY_UI_MARKER_END}).`
      );
    }

    if (next !== content) {
      fs.writeFileSync(earlyPath, next, 'utf8');
      console.log(`✓ Updated early-inject.js UI block: ${earlyPath}`);
    } else {
      console.log('early-inject.js UI block already up-to-date');
    }
  }

  function formatWebsiteKeyLabel(text) {
    const str = String(text || '').trim();
    return str || '';
  }

  function buildWebsiteBindingItemHtml({ keys, title, subtitle, indent = '                    ' }) {
    const k = escapeHtml(keys);
    const t = escapeHtml(title);
    const s = escapeHtml(subtitle);
    return (
      `${indent}<div class="binding-item">\n` +
      `${indent}    <span class="key">${k}</span>\n` +
      `${indent}    <div class="binding-description">\n` +
      `${indent}        <strong>${t}</strong><br>\n` +
      `${indent}        <small>${s}</small>\n` +
      `${indent}    </div>\n` +
      `${indent}</div>`
    );
  }

  function buildWebsiteKeyBindingsInnerHtml({ keybindings, manifest, ids }) {
    const out = [];
    const commands = (manifest && manifest.commands) || {};

    for (const rawId of ids || []) {
      const id = String(rawId || '').trim();
      if (!id) continue;

      if (id.startsWith('command:')) {
        const commandId = id.slice('command:'.length).trim();
        const cmd = commands[commandId];
        if (!cmd) {
          // The website can list pseudo-commands that are implemented as content-script hotkeys
          // (not `manifest.json` commands). Keep these stable for the landing page.
          if (commandId === 'toggle-extension') {
            out.push(buildWebsiteBindingItemHtml({
              keys: 'Alt+K',
              title: 'Toggle KeyPilot extension on/off',
              subtitle: 'Global shortcut'
            }));
            continue;
          }

          console.warn(`WARN: Website key bindings requested unknown command: ${commandId}`);
          continue;
        }
        const keys = formatWebsiteKeyLabel(cmd && cmd.suggested_key && cmd.suggested_key.default);
        const title = (cmd && cmd.description) ? String(cmd.description) : `Command: ${commandId}`;
        const subtitle = 'Global shortcut';
        out.push(buildWebsiteBindingItemHtml({ keys, title, subtitle }));
        continue;
      }

      const binding = keybindings && keybindings[id];
      if (!binding) {
        console.warn(`WARN: Website key bindings requested unknown KEYBINDINGS id: ${id}`);
        continue;
      }

      const keys = formatWebsiteKeyLabel(binding.displayKey || binding.keyLabel || (Array.isArray(binding.keys) ? binding.keys.join(' / ') : ''));
      const title = String(binding.label || id);
      const subtitle = String(binding.description || binding.label || id);
      out.push(buildWebsiteBindingItemHtml({ keys, title, subtitle }));
    }

    // Keep a trailing newline so the closing marker stays on its own line.
    return `\n${out.join('\n')}\n                    `;
  }

  const WEBSITE_INTERACTIVE_KEYBOARD_KEYS = [
    'Q', 'W', 'E', 'R', 'T', 'S', 'D', 'F', 'G', 'H', 'K', 'Z', 'X', 'C', 'V', 'B', 'N', '/', 'Bksp'
  ];

  function normalizeWebsiteKey(rawKey) {
    if (!rawKey) return null;
    const s = String(rawKey).trim();
    if (!s) return null;
    if (s === 'Backspace') return 'Bksp';
    if (s === 'Escape') return 'Esc';
    if (s.length === 1) {
      // Letters should render uppercase; leave symbols as-is.
      return /[a-z]/i.test(s) ? s.toUpperCase() : s;
    }
    return s;
  }

  function buildWebsiteKeyInfoObject({ keybindings }) {
    const byKey = new Map(); // key -> [binding]

    for (const binding of Object.values(keybindings || {})) {
      const rawKeys = (binding && Array.isArray(binding.keys)) ? binding.keys : [];
      for (const rawKey of rawKeys) {
        const k = normalizeWebsiteKey(rawKey);
        if (!k) continue;
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k).push(binding);
      }
    }

    const out = {};
    for (const key of WEBSITE_INTERACTIVE_KEYBOARD_KEYS) {
      const candidates = byKey.get(key) || [];
      if (!candidates.length) continue;

      // If multiple bindings map to the same physical key, prefer the one whose keyLabel matches.
      const picked =
        candidates.find((b) => normalizeWebsiteKey(b && b.keyLabel) === key) ||
        candidates.find((b) => String(b && b.displayKey || '').toUpperCase().includes(String(key).toUpperCase())) ||
        candidates[0];

      out[key] = {
        label: String(picked && picked.label ? picked.label : key),
        description: String(picked && picked.description ? picked.description : picked && picked.label ? picked.label : key),
        keyDisplay: String(picked && (picked.displayKey || picked.keyLabel) ? (picked.displayKey || picked.keyLabel) : key)
      };
    }

    // Stable key order.
    const ordered = {};
    for (const k of WEBSITE_INTERACTIVE_KEYBOARD_KEYS) {
      if (Object.prototype.hasOwnProperty.call(out, k)) ordered[k] = out[k];
    }
    return ordered;
  }

  function buildWebsiteKeyInfoInnerJs({ keybindings, indent = '        ' }) {
    const obj = buildWebsiteKeyInfoObject({ keybindings });
    const json = JSON.stringify(obj, null, 4);
    // Keep the end marker on its own line with matching indentation.
    return `\n${indent}const KEY_INFO = ${json.replace(/\n/g, `\n${indent}`)};\n`;
  }

  function websiteLayoutKeyFromDisplay(displayKey, fallbackKey) {
    const raw = String(displayKey || fallbackKey || '').trim();
    if (!raw) return '';
    if (raw === 'Backspace') return 'Bksp';
    return raw.length === 1 ? raw.toUpperCase() : raw;
  }

  function websiteActionColor({ actionId, binding }) {
    const id = String(actionId || '').trim();
    const cls = String(binding && binding.keyboardClass ? binding.keyboardClass : '');

    // Red: destructive/tab close/delete.
    if (id === 'DELETE' || id === 'CLOSE_TAB' || cls.includes('key-delete') || cls.includes('key-close-tab')) return 'action-red';

    // Blue: history + scroll.
    if (
      id === 'BACK' || id === 'BACK2' || id === 'FORWARD' || id === 'PAGE_TOP' || id === 'PAGE_BOTTOM' ||
      cls.includes('key-back') || cls.includes('key-forward') || cls.includes('key-scroll')
    ) return 'action-blue';

    // Green: everything else (activation, tabs, page up/down, UI toggles).
    return 'action-green';
  }

  function buildWebsiteKeyboardLayoutObject({ keybindings, layout }) {
    const out = [];

    for (const row of layout || []) {
      const outRow = [];
      for (const item of row || []) {
        if (!item) continue;

        if (item.type === 'special') {
          outRow.push({
            type: 'special',
            text: item.text,
            className: item.className
          });
          continue;
        }

        if (item.type === 'key') {
          const t = String(item.text || '').trim();
          if (!t) continue;
          outRow.push({ label: t, key: t });
          continue;
        }

        if (item.type === 'action') {
          const id = String(item.id || '').trim();
          const binding = keybindings && keybindings[id];
          const label = String((binding && binding.label) || item.fallbackText || id);
          const key = websiteLayoutKeyFromDisplay(binding && (binding.keyLabel || binding.displayKey), id);
          const color = websiteActionColor({ actionId: id, binding });

          const next = { label, key, color };
          if (item.className) next.className = item.className;
          outRow.push(next);
          continue;
        }
      }
      out.push(outRow);
    }

    return out;
  }

  function buildWebsiteKeyboardLayoutInnerJs({ keybindings, layout, indent = '        ' }) {
    const obj = buildWebsiteKeyboardLayoutObject({ keybindings, layout });
    const json = JSON.stringify(obj, null, 4);
    return `\n${indent}const KEYBOARD_LAYOUT = ${json.replace(/\n/g, `\n${indent}`)};\n`;
  }

  function updateWebsiteIndexFile({ timestamp, version, keybindings, manifest }) {
    const websiteIndexPath = path.resolve(process.cwd(), '..', '..', 'website', 'index.html');
    const websiteScriptPath = path.resolve(process.cwd(), '..', '..', 'website', 'js', 'script.js');
    try {
      if (!fs.existsSync(websiteIndexPath)) return;
      let content = fs.readFileSync(websiteIndexPath, 'utf8');

      // Version
      if (version) {
        const stampedVersion = replaceInnerBetweenMarkers(
          content,
          WEBSITE_VERSION_MARKER_START,
          WEBSITE_VERSION_MARKER_END,
          escapeHtml(String(version))
        );
        if (stampedVersion === null) {
          console.warn(`WARN: Could not find website version markers in: ${websiteIndexPath}`);
        } else {
          content = stampedVersion;
        }
      }

      // Timestamp
      const stampedTs = replaceInnerBetweenMarkers(content, WEBSITE_TS_MARKER_START, WEBSITE_TS_MARKER_END, timestamp);
      if (stampedTs === null) {
        console.warn(`WARN: Could not find website timestamp markers in: ${websiteIndexPath}`);
      } else {
        content = stampedTs;
      }

      // Key bindings tiles
      const attrMatch = content.match(WEBSITE_BINDINGS_ATTR_RE);
      const ids = attrMatch && attrMatch[1]
        ? attrMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
        : ['DELETE', 'ACTIVATE', 'BACK', 'FORWARD', 'CANCEL', 'command:toggle-extension'];

      const bindingsInner = buildWebsiteKeyBindingsInnerHtml({ keybindings, manifest, ids });
      const stampedBindings = replaceInnerBetweenMarkers(content, WEBSITE_KEYS_MARKER_START, WEBSITE_KEYS_MARKER_END, bindingsInner);
      if (stampedBindings === null) {
        console.warn(`WARN: Could not find website key bindings markers in: ${websiteIndexPath}`);
      } else {
        content = stampedBindings;
      }

      fs.writeFileSync(websiteIndexPath, content, 'utf8');
      console.log(`✓ Updated website index: ${websiteIndexPath}`);

      // Interactive keyboard reference JS (KEY_INFO + KEYBOARD_LAYOUT) lives in website/js/script.js
      if (!fs.existsSync(websiteScriptPath)) {
        console.warn(`WARN: Website script.js not found (skipping KEY_INFO/KEYBOARD_LAYOUT stamping): ${websiteScriptPath}`);
        return;
      }

      let scriptContent = fs.readFileSync(websiteScriptPath, 'utf8');

      const keyInfoInner = buildWebsiteKeyInfoInnerJs({ keybindings });
      const stampedKeyInfo = replaceInnerBetweenMarkers(
        scriptContent,
        WEBSITE_KEY_INFO_MARKER_START,
        WEBSITE_KEY_INFO_MARKER_END,
        keyInfoInner
      );
      if (stampedKeyInfo === null) {
        console.warn(`WARN: Could not find website KEY_INFO markers in: ${websiteScriptPath}`);
      } else {
        scriptContent = stampedKeyInfo;
      }

      const keyboardLayoutInner = buildWebsiteKeyboardLayoutInnerJs({ keybindings, layout: KEYBINDINGS_KEYBOARD_LAYOUT });
      const stampedKeyboardLayout = replaceInnerBetweenMarkers(
        scriptContent,
        WEBSITE_KEYBOARD_LAYOUT_MARKER_START,
        WEBSITE_KEYBOARD_LAYOUT_MARKER_END,
        keyboardLayoutInner
      );
      if (stampedKeyboardLayout === null) {
        console.warn(`WARN: Could not find website KEYBOARD_LAYOUT markers in: ${websiteScriptPath}`);
      } else {
        scriptContent = stampedKeyboardLayout;
      }

      fs.writeFileSync(websiteScriptPath, scriptContent, 'utf8');
      console.log(`✓ Updated website script: ${websiteScriptPath}`);
    } catch (err) {
      console.warn(`WARN: Failed to update website index ${websiteIndexPath}:`, err && err.message ? err.message : err);
    }
  }

  function stampPopupVersion(popupPath, version) {
    try {
      if (!fs.existsSync(popupPath)) return;
      const content = fs.readFileSync(popupPath, 'utf8');
      if (!POPUP_VERSION_RE.test(content)) {
        console.warn(`WARN: Could not find <span class="version">…</span> in: ${popupPath}`);
        return;
      }
      const next = content.replace(POPUP_VERSION_RE, (_m, open, _inner, close) => `${open}${escapeHtml(version)}${close}`);
      if (next !== content) {
        fs.writeFileSync(popupPath, next, 'utf8');
        console.log(`✓ Updated popup version: ${popupPath} -> ${version}`);
      } else {
        console.log(`Popup version already up-to-date: ${popupPath}`);
      }
    } catch (err) {
      console.warn(`WARN: Failed to update popup version in ${popupPath}:`, err && err.message ? err.message : err);
    }
  }

  function updatePopupHtmlFile({ version }) {
    stampPopupVersion(path.resolve(process.cwd(), 'popup.html'), version);
    stampPopupVersion(path.resolve(process.cwd(), 'popup-v1.html'), version);
  }

  // Update manifest.json description with build date/time
  console.log('Updating manifest.json with build timestamp...');
  const manifestPath = 'manifest.json';
  let manifestForDocs = null;

  try {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);

    // Validate required fields exist
    if (!manifest.version) {
      throw new Error('manifest.json is missing required "version" field');
    }
    if (typeof manifest.version !== 'string') {
      throw new Error('manifest.json "version" field must be a string');
    }

    // Store original values for safety
    const originalVersion = manifest.version;
    const originalName = manifest.name;

    const timestamp = getBuildTimestamp(new Date());

    // Get original description and strip any existing timestamp
    // Timestamp pattern: "MMM-DD-YYYY-HH:MMAM/PM " at the start
    let originalDescription = manifest.description || '';
    // Remove any existing timestamp pattern at the beginning
    originalDescription = originalDescription.replace(/^[A-Z][a-z]{2}-\d{1,2}-\d{4}-\d{1,2}:\d{2}(AM|PM)\s+/, '');

    // ONLY modify description field
    manifest.description = `${timestamp} ${originalDescription}`;

    // Ensure version and name are not accidentally modified
    manifest.version = originalVersion;
    manifest.name = originalName;

    // Write updated manifest with proper formatting (4 spaces indentation)
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + '\n');
    console.log(`✓ Updated manifest.json description with timestamp: ${timestamp}`);
    manifestForDocs = manifest;

    // Keep the website landing page in sync with the build + keybindings
    console.log('Updating website index.html...');
    updateWebsiteIndexFile({ timestamp, version: manifestForDocs && manifestForDocs.version, keybindings: KEYBINDINGS, manifest: manifestForDocs });

    console.log('Updating popup.html version...');
    updatePopupHtmlFile({ version: manifestForDocs.version });
  } catch (error) {
    console.error('ERROR: Failed to update manifest.json:', error.message);
    process.exit(1);
  }

  // Update README key mappings (project README only)
  console.log('Updating README key mappings...');
  {
    const projectReadme = path.resolve(process.cwd(), '..', 'README.md');
    updateReadmeFile({ readmePath: projectReadme, keybindings: KEYBINDINGS, manifest: manifestForDocs });
  }

  // Keep early-inject.js UI constants in sync with the canonical sources
  console.log('Updating early-inject.js UI block...');
  updateEarlyInjectUiBlock();

  console.log('Build complete! Extension files ready:');
  console.log('  - content-bundled.js (content script)');
  if (shouldMinifyFlag) {
    console.log('  - content-bundled.min.js (minified content script)');
  }
  console.log('  - background.js (service worker)');
  console.log('  - manifest.json (updated with build timestamp)');
}
