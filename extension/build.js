/**
 * Build script for KeyPilot extension
 */
import fs from 'fs';
import path from 'path';
import { minify } from 'terser';
import { KEYBINDINGS, Z_INDEX } from './src/config/constants.js';
import {
  KEYBINDINGS_KEYBOARD_LAYOUT,
  KEYBINDINGS_UI_STYLE_ATTR,
  getKeybindingsUiCss
} from './src/ui/keybindings-ui-shared.js';
import { POPUP_THEME_VARS } from './src/ui/popup-theme-vars.js';

console.log('Starting build...');

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

const modules = [
  'src/config/constants.js',
  // Shared UI helpers used by multiple modules (must be defined before import-stripped consumers).
  'src/ui/url-listing.js',
  'src/modules/state-manager.js',
  'src/modules/event-manager.js',
  'src/modules/cursor.js',
  'src/modules/element-detector.js',
  'src/modules/activation-handler.js',
  'src/modules/focus-detector.js',
  'src/modules/mouse-coordinate-manager.js',
  'src/modules/highlight-manager.js',
  'src/modules/popup-manager.js',
  'src/modules/overlay-manager.js',
  'src/modules/style-manager.js',
  'src/modules/shadow-dom-manager.js',
  'src/modules/intersection-observer-manager.js',
  'src/modules/optimized-scroll-manager.js',
  'src/modules/keypilot-toggle-handler.js',
  'src/modules/settings-manager.js',
  'src/modules/omnibox-manager.js',
  'src/modules/tab-history-popover.js',
  'src/modules/text-element-filter.js',
  'src/modules/edge-character-detector.js',
  'src/modules/rectangle-intersection-observer.js',
  // UI modules used by the content script (must appear before keypilot.js so symbols exist after imports are stripped)
  'src/ui/keybindings-ui-shared.js',
  'src/ui/keybindings-ui.js',
  'src/ui/popup-theme-vars.js',
  'src/ui/floating-keyboard-help.js',
  'src/ui/onboarding-panel.js',
  'src/ui/practice-popover-panel.js',
  'src/modules/onboarding-manager.js',
  'src/keypilot.js',
  'src/content-script.js'
];

// Validate all source files exist before bundling
console.log('Validating source files...');
for (const modulePath of modules) {
  if (!fs.existsSync(modulePath)) {
    console.error(`ERROR: Source file not found: ${modulePath}`);
    process.exit(1);
  }
}
console.log('All source files validated successfully.');

let bundledContent = `/**
 * KeyPilot Chrome Extension - Bundled Version
 * Generated on ${new Date().toISOString()}
 */

(() => {
  // Global scope for bundled modules

`;

for (const modulePath of modules) {
  console.log(`Processing ${modulePath}...`);
  let moduleContent = fs.readFileSync(modulePath, 'utf8');
  
  // Remove imports and exports
  moduleContent = moduleContent
    // Remove ESM imports (single-line and multi-line) because we bundle into one IIFE.
    // Note: `.*?` doesn't cross newlines, so use `[\s\S]*?` to handle multi-line imports.
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]*['"];?\s*\n?/g, '')
    // Remove side-effect imports: `import './x.js';`
    .replace(/import\s+['"][^'"]*['"];?\s*\n?/g, '')
    .replace(/^export\s+(class|function|const|let|var)\s+/gm, '$1 ')
    // Handle re-export syntax: `export { X } from './mod.js';`
    .replace(/export\s*\{[^}]*\}\s*from\s+['"][^'"]*['"];?\s*\n?/g, '')
    .replace(/export\s*\{[^}]*\}\s*;?\s*\n?/g, '')
    .replace(/^export\s+/gm, '');
  
  bundledContent += `
  // Module: ${modulePath}
${moduleContent}

`;
}

bundledContent += `
})();
`;

// Generate content-bundled.js in extension directory
fs.writeFileSync('content-bundled.js', bundledContent);
console.log('Generated content-bundled.js in extension directory');

// Check for minification flag
const shouldMinify = process.argv.includes('--minify') || process.argv.includes('-m');

if (shouldMinify) {
  console.log('Minifying bundle with Terser...');

  try {
    const minifyOptions = {
      compress: {
        drop_console: false, // Keep console.log for debugging
        drop_debugger: true,
        pure_funcs: [], // Don't remove any functions
      },
      mangle: {
        reserved: ['KeyPilot', 'chrome', 'document', 'window'], // Don't mangle these names
      },
      format: {
        comments: false, // Remove comments
      },
    };

    const minifiedResult = await minify(bundledContent, minifyOptions);

    if (minifiedResult.error) {
      console.error('Terser minification error:', minifiedResult.error);
      process.exit(1);
    }

    // Write minified version
    fs.writeFileSync('content-bundled.min.js', minifiedResult.code);

    const originalSize = (bundledContent.length / 1024).toFixed(1);
    const minifiedSize = (minifiedResult.code.length / 1024).toFixed(1);
    const compressionRatio = (((bundledContent.length - minifiedResult.code.length) / bundledContent.length) * 100).toFixed(1);

    console.log(`✓ Generated content-bundled.min.js (${minifiedSize}KB, ${compressionRatio}% reduction from ${originalSize}KB)`);

  } catch (error) {
    console.error('Minification failed:', error.message);
    process.exit(1);
  }
}

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
  const xml = String(xmlText || '');
  const slides = [];

  // Extremely small/controlled XML file in this repo; keep parsing dependency-free.
  const slideRe = /<slide\b([^>]*)>([\s\S]*?)<\/slide>/g;
  const taskRe = /<task\b([^>]*)>([\s\S]*?)<\/task>/g;
  const whenRe = /<when\b([^\/>]*)\/>/g;
  const attrRe = /(\w+)\s*=\s*"([^"]*)"/g;

  const readAttrs = (raw) => {
    const attrs = {};
    if (!raw) return attrs;
    let m;
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

    let taskMatch;
    while ((taskMatch = taskRe.exec(slideBody))) {
      const taskAttrs = readAttrs(taskMatch[1]);
      const taskBody = taskMatch[2] || '';
      const taskId = String(taskAttrs.id || '').trim();
      if (!taskId) continue;

      const label = String(taskAttrs.label || '').trim();

      // Take the first <when .../> inside the task (the authoring format here uses one).
      let when = { type: '' };
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
      // Reset stateful regex for next task.
      whenRe.lastIndex = 0;

      tasks.push({ id: taskId, label, when });
    }

    slides.push({ id, title, tasks, onEnter: [] });
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

  const layout = KEYBINDINGS_KEYBOARD_LAYOUT;
  const actionIds = collectActionIdsFromLayout(layout);
  // Keep legacy/non-layout entries too (used elsewhere / future-proofing).
  actionIds.add('TOGGLE_KEYBOARD_HELP');

  const earlyKeybindings = {};
  for (const id of actionIds) {
    const picked = pickEarlyBindingFields(KEYBINDINGS[id]);
    if (picked) earlyKeybindings[id] = picked;
  }

  const css = getKeybindingsUiCss({ zKeybindingsPopover: Z_INDEX.KEYBINDINGS_POPOVER });
  const escapedCss = String(css).replaceAll('`', '\\`');

  const generatedInner =
    `\n` +
    `  // NOTE: This block is auto-generated by \`extension/build.js\` from:\n` +
    `  // - \`extension/src/config/constants.js\` (KEYBINDINGS, Z_INDEX)\n` +
    `  // - \`extension/src/ui/keybindings-ui-shared.js\` (CSS + layout + style attr)\n` +
    `  // - \`extension/pages/onboarding.xml\` (early onboarding model)\n` +
    `  // Do not edit by hand.\n` +
    `  const Z_FLOATING_KEYBOARD_HELP = ${Number(Z_INDEX.FLOATING_KEYBOARD_HELP)};\n` +
    `  const Z_KEYBINDINGS_POPOVER = ${Number(Z_INDEX.KEYBINDINGS_POPOVER)};\n` +
    `  const KEYBINDINGS_UI_STYLE_ATTR = ${JSON.stringify(KEYBINDINGS_UI_STYLE_ATTR)};\n` +
    `  const KEYBINDINGS_KEYBOARD_LAYOUT = ${JSON.stringify(layout, null, 2)};\n` +
    `  const EARLY_KEYBINDINGS = ${JSON.stringify(earlyKeybindings, null, 2)};\n` +
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
    `  const KEYBINDINGS_UI_EARLY_CSS = \`${escapedCss}\`;\n`;

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

function updatePopupHtmlFile({ version }) {
  const popupPath = path.resolve(process.cwd(), 'popup.html');
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

// Update README key mappings (extension README + project README)
console.log('Updating README key mappings...');
{
  const extensionReadme = path.resolve(process.cwd(), 'README.md');
  const projectReadme = path.resolve(process.cwd(), '..', 'README.md');
  updateReadmeFile({ readmePath: extensionReadme, keybindings: KEYBINDINGS, manifest: manifestForDocs });
  updateReadmeFile({ readmePath: projectReadme, keybindings: KEYBINDINGS, manifest: manifestForDocs });
}

// Keep early-inject.js UI constants in sync with the canonical sources
console.log('Updating early-inject.js UI block...');
updateEarlyInjectUiBlock();

console.log('Build complete! Extension files ready:');
console.log('  - content-bundled.js (content script)');
if (shouldMinify) {
  console.log('  - content-bundled.min.js (minified content script)');
}
console.log('  - background.js (service worker)');
console.log('  - manifest.json (updated with build timestamp)');