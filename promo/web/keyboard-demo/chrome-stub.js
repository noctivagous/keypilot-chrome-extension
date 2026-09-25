/**
 * Minimal chrome.i18n / chrome.runtime for the marketing-site keyboard window.
 * Message catalogs are filled by loadMessages() before the keyboard paints.
 */

const messages = { current: {} };

function substitute(entry, substitutions) {
  if (!entry || typeof entry.message !== "string") return "";
  let message = entry.message;
  const subs = substitutions == null
    ? []
    : (Array.isArray(substitutions) ? substitutions : [substitutions]);
  const placeholders = entry.placeholders && typeof entry.placeholders === "object"
    ? entry.placeholders
    : {};
  for (const [name, placeholder] of Object.entries(placeholders)) {
    const content = placeholder && typeof placeholder.content === "string"
      ? placeholder.content
      : "";
    const index = /^\$(\d+)$/.exec(content);
    const value = index ? (subs[Number(index[1]) - 1] ?? "") : content;
    message = message.split(`$${name}$`).join(String(value));
  }
  subs.forEach((value, index) => {
    message = message.split(`$${index + 1}`).join(value == null ? "" : String(value));
  });
  return message;
}

function assetPrefix() {
  const locale = document.documentElement.getAttribute("data-locale") || "en";
  return locale === "en" ? "" : "../";
}

const chromeApi = globalThis.chrome && typeof globalThis.chrome === "object"
  ? globalThis.chrome
  : {};
chromeApi.i18n = {
  getMessage(key, substitutions) {
    const entry = messages.current[key];
    if (!entry) return "";
    return substitute(entry, substitutions);
  },
  getUILanguage() {
    return document.documentElement.lang || "en";
  }
};
chromeApi.runtime = {
  getURL(relativePath) {
    const clean = String(relativePath || "").replace(/^\//, "");
    return `${assetPrefix()}assets/${clean}`;
  }
};
globalThis.chrome = chromeApi;

export async function loadMessages() {
  const locale = document.documentElement.getAttribute("data-locale") || "en";
  const response = await fetch(`${assetPrefix()}messages/${locale}.json`);
  if (!response.ok) {
    throw new Error(`Missing keyboard messages for ${locale}`);
  }
  messages.current = await response.json();
}
