#!/usr/bin/env node
/**
 * Build static locale folders for promo/web from tagged English
 * source (index.html and assets/keyclick-*.svg) plus JSON catalogs.
 *
 *   node promo/web/locales/generate.mjs
 *   node promo/web/locales/generate.mjs --check
 *
 * PNG/MP4 binaries stay in promo-materials/web/assets and are copied into
 * the published site's assets/ folder at deploy time.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { mergeLocaleCatalog, parentCatalogLocale } from "../../../scripts/locale-catalogs.mjs";
import {
  DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID,
  KEYBOARD_HARDWARE_LAYOUTS
} from "../../../extension/src/config/keyboard-hardware-layouts.js";

const CATALOG_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(CATALOG_DIR, "..");
const ROOT = path.resolve(WEB, "../..");
const CHECK = process.argv.includes("--check");

const SITE = "https://noctivagous.com";
const SOURCE_LOCALE = "en";
const LOCALES = ["de", "es", "es_419", "sk", "zh_CN", "zh_TW"];
const HTML_LANG = {
  en: "en",
  de: "de",
  es: "es",
  es_419: "es-419",
  sk: "sk",
  zh_CN: "zh-CN",
  zh_TW: "zh-TW"
};
const LOCALE_META = {
  en: { native: "English", flag: "us" },
  de: { native: "Deutsch", flag: "de" },
  es: { native: "Español", flag: "es" },
  es_419: { native: "Español (Latinoamérica)", flag: "mx" },
  sk: { native: "Slovenčina", flag: "sk" },
  zh_CN: { native: "简体中文", flag: "cn" },
  zh_TW: { native: "繁體中文", flag: "tw" }
};
const HARDWARE_BY_LOCALE = {
  en: "us-ansi-qwerty",
  de: "de-de-qwertz-iso",
  es: "es-es-qwerty-iso",
  es_419: "us-ansi-qwerty",
  sk: "sk-sk-qwertz-iso",
  zh_CN: "us-ansi-qwerty",
  zh_TW: "us-ansi-qwerty"
};
const SCREENSHOTS = [
  "01-key-click-browsing.png",
  "02-keyboard-map.png",
  "03-customize-workflow.png",
  "04-walkthrough.png",
  "05-context-menu.png"
];
const MESSAGE_KEY = /^(fn_.+_(label|description)|keycap_.+|keyboard_help_.+|key_info_.+|keyboard_hardware_layout_.+|layout_family_browsing_.+|control_strip_(collapse|expand))$/;
const GENERATED_ATTRS = [
  "data-i18n",
  "data-i18n-alt",
  "data-i18n-src",
  "data-i18n-aria-label",
  "data-i18n-letter-spacing",
  "data-hardware-code",
  "data-from-web",
  "data-locale-path",
  "data-locale-current"
];
const GENERATED_COMMENT =
  "<!-- Generated from promo/web/index.html + promo/web/locales/<locale>.json. Do not edit. -->\n";

function readJson(locale) {
  const file = path.join(CATALOG_DIR, `${locale}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function expandKbd(message) {
  return String(message).replace(/\$([A-Z])\$/g, "<kbd>$1</kbd>");
}

function requireKey(catalog, key, locale) {
  if (!Object.prototype.hasOwnProperty.call(catalog, key)) {
    throw new Error(`Missing key "${key}" in ${locale}.json`);
  }
  const value = catalog[key];
  if (value == null || String(value).trim() === "") {
    throw new Error(`Empty key "${key}" in ${locale}.json`);
  }
  return String(value);
}

function checkCatalogs(en) {
  const keys = Object.keys(en);
  for (const locale of LOCALES) {
    const catalog = readJson(locale);
    const extra = Object.keys(catalog).filter((key) => !keys.includes(key));
    const missing = keys.filter((key) => !Object.prototype.hasOwnProperty.call(catalog, key));
    if (missing.length || extra.length) {
      throw new Error(
        `${locale}.json key mismatch.` +
          (missing.length ? ` Missing: ${missing.join(", ")}.` : "") +
          (extra.length ? ` Extra: ${extra.join(", ")}.` : "")
      );
    }
  }
}

function setAttr(openTag, name, value) {
  const assign = ` ${name}="${value.replace(/"/g, "&quot;")}"`;
  if (new RegExp(`\\s${name}="[^"]*"`).test(openTag)) {
    return openTag.replace(new RegExp(`\\s${name}="[^"]*"`), assign);
  }
  return openTag.replace(/>$/, `${assign}>`);
}

function removeAttr(openTag, name) {
  return openTag.replace(new RegExp(`\\s${name}="[^"]*"`), "");
}

function getAttr(openTag, name) {
  const match = openTag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return match ? match[1] : null;
}

function stripGeneratedAttrs(html) {
  let out = html;
  for (const attr of GENERATED_ATTRS) {
    out = out.replace(new RegExp(`\\s${attr}="[^"]*"`, "g"), "");
  }
  return out;
}

function leadingMarkup(inner) {
  const match = inner.match(
    /^(\s*(?:<span><\/span>\s*|<span\b[^>]*>[\s\S]*?<\/span>\s*)+)/
  );
  return match ? match[1] : "";
}

function trailingWhitespace(inner) {
  const match = inner.match(/(\s*)$/);
  return match ? match[1] : "";
}

function localizeInner(inner, message) {
  const expanded = expandKbd(message);
  const trail = trailingWhitespace(inner);
  if (inner.includes("<kbd>")) return expanded + trail;
  const prefix = leadingMarkup(inner);
  return (prefix ? prefix + expanded : expanded) + trail;
}

function replaceTaggedElements(html, catalog, locale) {
  return html.replace(
    /<([a-zA-Z][\w:-]*)([^>]*?\sdata-i18n="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g,
    (match, tag, openInner, key, inner) => {
      const value = requireKey(catalog, key, locale);
      return `<${tag}${openInner}>${localizeInner(inner, value)}</${tag}>`;
    }
  );
}

function replaceTaggedAttrs(html, catalog, locale) {
  return html.replace(/<[^>]+>/g, (tag) => {
    let out = tag;
    const altKey = getAttr(out, "data-i18n-alt");
    if (altKey) out = setAttr(out, "alt", requireKey(catalog, altKey, locale));
    const srcKey = getAttr(out, "data-i18n-src");
    if (srcKey) out = setAttr(out, "src", requireKey(catalog, srcKey, locale));
    const ariaKey = getAttr(out, "data-i18n-aria-label");
    if (ariaKey) {
      out = setAttr(out, "aria-label", requireKey(catalog, ariaKey, locale));
    }
    const spacingKey = getAttr(out, "data-i18n-letter-spacing");
    if (spacingKey) {
      out = setAttr(out, "letter-spacing", requireKey(catalog, spacingKey, locale));
    }
    return out;
  });
}

function applyFromWeb(html, prefix) {
  return html.replace(/<[^>]+>/g, (tag) => {
    const attr = getAttr(tag, "data-from-web");
    if (!attr) return tag;
    const value = getAttr(tag, attr);
    if (value == null) {
      throw new Error(`data-from-web="${attr}" missing ${attr}`);
    }
    return setAttr(tag, attr, prefix + value);
  });
}

function localeHref(current, target) {
  if (current === SOURCE_LOCALE) {
    return target === SOURCE_LOCALE ? "./" : `${target}/`;
  }
  if (current === target) return "./";
  if (target === SOURCE_LOCALE) return "../";
  return `../${target}/`;
}

function applyLocalePaths(html, locale) {
  return html.replace(/<a\b[^>]*>/g, (tag) => {
    const target = getAttr(tag, "data-locale-path");
    if (!target) return tag;
    let out = setAttr(tag, "href", localeHref(locale, target));
    if (locale === target) out = setAttr(out, "aria-current", "page");
    else out = removeAttr(out, "aria-current");
    return out;
  });
}

function localeCurrentMarkup(locale) {
  const meta = LOCALE_META[locale];
  if (!meta) {
    throw new Error(`Missing LOCALE_META for ${locale}`);
  }
  return (
    `<img class="lang-flag" src="assets/flags/${meta.flag}.svg" alt="" width="16" height="12" data-from-web="src">` +
    `<span class="lang-name">${meta.native}</span>`
  );
}

function applyLocaleCurrent(html, locale) {
  const marker = "data-locale-current=";
  const markerAt = html.indexOf(marker);
  if (markerAt === -1) {
    throw new Error("Missing data-locale-current on language switcher");
  }
  const openStart = html.lastIndexOf("<span", markerAt);
  const openEnd = html.indexOf(">", markerAt);
  if (openStart === -1 || openEnd === -1) {
    throw new Error("Malformed data-locale-current span");
  }
  let depth = 1;
  let i = openEnd + 1;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf("<span", i);
    const nextClose = html.indexOf("</span>", i);
    if (nextClose === -1) {
      throw new Error("Unclosed data-locale-current span");
    }
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 5;
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return (
        html.slice(0, openEnd + 1) +
        localeCurrentMarkup(locale) +
        html.slice(nextClose)
      );
    }
    i = nextClose + 7;
  }
  throw new Error("Unclosed data-locale-current span");
}

function applyDocumentMeta(html, locale) {
  const lang = HTML_LANG[locale];
  const canonical = locale === SOURCE_LOCALE ? `${SITE}/` : `${SITE}/${locale}/`;
  let out = html.replace(
    /<html\b[^>]*>/,
    `<html lang="${lang}" data-locale="${locale}">`
  );
  out = out.replace(
    /<link rel="canonical" href="[^"]*"/,
    `<link rel="canonical" href="${canonical}"`
  );
  return out;
}

function hardwareIdForLocale(locale) {
  const id = HARDWARE_BY_LOCALE[locale];
  if (!id) throw new Error(`Missing hardware layout for ${locale}`);
  if (!KEYBOARD_HARDWARE_LAYOUTS[id]) {
    throw new Error(`Unknown hardware layout "${id}" for ${locale}`);
  }
  return id;
}

function hardwareLegendByCode(hardwareId) {
  const layout = KEYBOARD_HARDWARE_LAYOUTS[hardwareId];
  const legends = new Map();
  for (const physicalRow of layout.rows) {
    for (const physicalKey of physicalRow.keys) {
      legends.set(physicalKey.code, physicalKey.legends.base);
    }
  }
  return legends;
}

function hardwareCodeTag() {
  return /<([a-zA-Z][\w:-]*)([^>]*?\sdata-hardware-code="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g;
}

function applyHardwareCodes(markup, locale, sourceName) {
  const legends = hardwareLegendByCode(hardwareIdForLocale(locale));
  return markup.replace(hardwareCodeTag(), (match, tag, openInner, code, inner) => {
    if (!legends.has(code)) {
      throw new Error(`${sourceName}: unknown data-hardware-code="${code}"`);
    }
    return `<${tag}${openInner}>${legends.get(code)}</${tag}>`;
  });
}

function checkHardwareSource(html, svgFiles) {
  const errors = [];
  const legends = hardwareLegendByCode(DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID);
  const check = (name, source) => {
    source.replace(hardwareCodeTag(), (match, tag, openInner, code, inner) => {
      if (!legends.has(code)) {
        errors.push(`${name}: unknown data-hardware-code="${code}"`);
        return match;
      }
      const actual = comparable(inner);
      const expected = legends.get(code);
      if (actual !== expected) {
        errors.push(`${name} ${code}: source "${actual}" != ${DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID} "${expected}"`);
      }
      return match;
    });
  };
  check("index.html", html);
  for (const svg of svgFiles) check(svg.name, svg.source);
  if (errors.length) {
    throw new Error(`Hardware legend drift:\n- ${errors.join("\n- ")}`);
  }
}

function applyHardware(html, locale) {
  const id = hardwareIdForLocale(locale);
  if (!html.includes("data-hardware=")) {
    throw new Error("Missing data-hardware on the keyboard stage");
  }
  return html.replace(/data-hardware="[^"]*"/g, `data-hardware="${id}"`);
}

function insertGeneratedComment(html) {
  if (html.startsWith("<!DOCTYPE html>\n")) {
    return html.replace("<!DOCTYPE html>\n", `<!DOCTYPE html>\n${GENERATED_COMMENT}`);
  }
  return GENERATED_COMMENT + html;
}

function renderHtml(source, catalog, locale) {
  let html = source;
  html = replaceTaggedElements(html, catalog, locale);
  html = replaceTaggedAttrs(html, catalog, locale);
  html = applyLocaleCurrent(html, locale);
  html = applyFromWeb(html, locale === SOURCE_LOCALE ? "" : "../");
  html = applyLocalePaths(html, locale);
  html = applyHardware(html, locale);
  html = applyHardwareCodes(html, locale, "index.html");
  html = applyDocumentMeta(html, locale);
  html = stripGeneratedAttrs(html);
  return insertGeneratedComment(html);
}

function renderSvg(source, catalog, locale) {
  let svg = replaceTaggedElements(source, catalog, locale);
  svg = replaceTaggedAttrs(svg, catalog, locale);
  svg = applyHardwareCodes(svg, locale, "keyclick svg");
  return stripGeneratedAttrs(svg);
}

function comparable(text) {
  return expandKbd(text)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function checkEnglishSource(html, svgFiles, catalog) {
  const errors = [];
  const seen = new Set();
  html.replace(
    /<([a-zA-Z][\w:-]*)([^>]*?\sdata-i18n="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g,
    (match, tag, openInner, key, inner) => {
      seen.add(key);
      const expected = comparable(catalog[key]);
      const prefix = inner.includes("<kbd>") ? "" : leadingMarkup(inner);
      const actual = comparable(inner.slice(prefix.length));
      if (actual !== expected) {
        errors.push(`index.html ${key}: source "${actual}" != en.json "${expected}"`);
      }
      return match;
    }
  );
  html.replace(/<[^>]+>/g, (tag) => {
    const srcKey = getAttr(tag, "data-i18n-src");
    if (srcKey) {
      seen.add(srcKey);
      const actual = getAttr(tag, "src");
      const expected = catalog[srcKey];
      if (actual !== expected) {
        errors.push(`index.html ${srcKey}: src != en.json`);
      }
    }
    const altKey = getAttr(tag, "data-i18n-alt");
    if (altKey) {
      seen.add(altKey);
      const actual = getAttr(tag, "alt");
      const expected = catalog[altKey];
      if (actual !== expected) {
        errors.push(`index.html ${altKey}: alt "${actual}" != en.json "${expected}"`);
      }
    }
    return tag;
  });
  for (const { name, source } of svgFiles) {
    source.replace(
      /<([a-zA-Z][\w:-]*)([^>]*?\sdata-i18n="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g,
      (match, tag, openInner, key, inner) => {
        seen.add(key);
        const expected = comparable(catalog[key]);
        const actual = comparable(inner);
        if (actual !== expected) {
          errors.push(`${name} ${key}: source "${actual}" != en.json "${expected}"`);
        }
        return match;
      }
    );
  }
  for (const key of Object.keys(catalog)) {
    if (key.endsWith("_spacing")) continue;
    if (!seen.has(key) && !html.includes(`data-i18n-alt="${key}"`) &&
        !html.includes(`data-i18n-src="${key}"`) &&
        !html.includes(`data-i18n-aria-label="${key}"`) &&
        !svgFiles.some(({ source }) => source.includes(`data-i18n-aria-label="${key}"`))) {
      errors.push(`en.json key "${key}" is not referenced in tagged source`);
    }
  }
  if (errors.length) {
    throw new Error(`English source/catalog drift:\n- ${errors.join("\n- ")}`);
  }
}

function writeOrCheck(file, contents) {
  if (CHECK) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing generated file: ${file}`);
    }
    const existing = fs.readFileSync(file, "utf8");
    if (existing !== contents) {
      throw new Error(`Out of date: ${path.relative(ROOT, file)}`);
    }
    return false;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
  return true;
}

function writeOrCheckBuffer(file, contents) {
  if (CHECK) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing generated file: ${path.relative(ROOT, file)}`);
    }
    const existing = fs.readFileSync(file);
    if (!existing.equals(contents)) {
      throw new Error(`Out of date: ${path.relative(ROOT, file)}`);
    }
    return false;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
  return true;
}

function copyTree(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Missing ${path.relative(ROOT, srcDir)}`);
  }
  const walk = (rel) => {
    const abs = path.join(srcDir, rel);
    if (fs.statSync(abs).isDirectory()) {
      for (const name of fs.readdirSync(abs)) walk(path.join(rel, name));
      return;
    }
    writeOrCheckBuffer(path.join(destDir, rel), fs.readFileSync(abs));
  };
  walk("");
}

function extensionCatalog(locale) {
  const file = path.join(ROOT, "extension", "_locales", locale, "messages.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function shippedExtensionLocales() {
  const dir = path.join(ROOT, "extension", "_locales");
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((locale) => fs.existsSync(path.join(dir, locale, "messages.json")));
}

function slimMessages(locale) {
  const parentId = parentCatalogLocale(locale, shippedExtensionLocales());
  const catalog = mergeLocaleCatalog(
    parentId ? extensionCatalog(parentId) : null,
    extensionCatalog(locale)
  );
  const out = {};
  for (const [key, value] of Object.entries(catalog)) {
    if (MESSAGE_KEY.test(key)) out[key] = value;
  }
  if (!out.keyboard_help_title || !out.layout_family_browsing_label) {
    throw new Error(`Slim keyboard catalog for ${locale} is missing window strings`);
  }
  return `${JSON.stringify(out, null, 2)}\n`;
}

function screenshotDir(locale) {
  return locale === SOURCE_LOCALE
    ? path.join(WEB, "assets", "screenshots")
    : path.join(WEB, locale, "assets", "screenshots");
}

function syncScreenshots() {
  const errors = [];
  for (const locale of [SOURCE_LOCALE, ...LOCALES]) {
    for (const name of SCREENSHOTS) {
      const src = path.join(ROOT, "online-stores", "generated", "chrome", locale, name);
      if (!fs.existsSync(src)) {
        errors.push(`${locale}/${name}`);
        continue;
      }
      writeOrCheckBuffer(path.join(screenshotDir(locale), name), fs.readFileSync(src));
    }
  }
  if (errors.length) {
    throw new Error(
      `Missing store screenshots (run npm run store:screenshots -- --locale=<id>):\n- ${errors.join("\n- ")}`
    );
  }
}

async function buildKeyboardDemo() {
  const result = await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: [path.join(WEB, "keyboard-demo", "entry.js")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    write: false,
    legalComments: "none",
    logLevel: "silent"
  });
  const js = result.outputFiles[0].text;
  writeOrCheck(path.join(WEB, "keyboard-demo.js"), js.endsWith("\n") ? js : `${js}\n`);
}

async function main() {
  const en = readJson(SOURCE_LOCALE);
  checkCatalogs(en);

  const htmlSource = fs.readFileSync(path.join(WEB, "index.html"), "utf8");
  const svgFiles = ["keyclick-landscape.svg", "keyclick-portrait.svg"].map((name) => ({
    name,
    source: fs.readFileSync(path.join(WEB, "assets", name), "utf8")
  }));
  checkEnglishSource(htmlSource, svgFiles, en);
  checkHardwareSource(htmlSource, svgFiles);

  let wrote = 0;
  for (const locale of LOCALES) {
    const catalog = readJson(locale);
    const html = renderHtml(htmlSource, catalog, locale);
    if (writeOrCheck(path.join(WEB, locale, "index.html"), html)) wrote += 1;
    for (const svg of svgFiles) {
      const rendered = renderSvg(svg.source, catalog, locale);
      if (writeOrCheck(path.join(WEB, locale, "assets", svg.name), rendered)) wrote += 1;
    }
  }

  for (const locale of [SOURCE_LOCALE, ...LOCALES]) {
    if (writeOrCheck(path.join(WEB, "messages", `${locale}.json`), slimMessages(locale))) wrote += 1;
  }
  copyTree(
    path.join(ROOT, "extension", "fonts"),
    path.join(WEB, "assets", "fonts")
  );
  copyTree(
    path.join(ROOT, "extension", "themes", "shared", "icons", "chrome"),
    path.join(WEB, "assets", "themes", "shared", "icons", "chrome")
  );
  await buildKeyboardDemo();
  syncScreenshots();

  if (CHECK) {
    console.log("web locales up to date");
  } else {
    console.log(`wrote ${wrote} locale files`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
