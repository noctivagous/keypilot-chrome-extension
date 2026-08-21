/**
 * KeyPilot Docs popover page.
 * Loads userdocs/index.json + markdown files; client-side search; GFM rendering.
 * Topics may nest via `children` in the catalog.
 */

import MarkdownIt from 'markdown-it';
import { getSettings, SETTINGS_STORAGE_KEY } from '../src/modules/settings-manager.js';
import { applyThemeToRoots, resolveThemeFromSettings } from '../src/modules/theme-manager.js';
import { BUILD_ENABLE_MACRO_BUILDER } from '../src/config/keyboard-layouts.js';
import { isKpDeepLink, parseKpDeepLink } from '../src/utils/kp-deep-link.js';
import { MSG } from '../src/messaging/types.js';

let docsThemeStorageInstalled = false;
/** @type {Document|ShadowRoot|null} */
let docsThemeRoot = null;

function paintDocsTheme(settings) {
  const root = docsThemeRoot;
  if (!root) return;
  const roots = root.nodeType === 9 ? [root] : [document, root];
  applyThemeToRoots(resolveThemeFromSettings(settings), {
    roots,
    hosts: [
      root.nodeType === 9
        ? root.documentElement
        : (root.host || document.documentElement)
    ]
  });
}

function installDocsThemeStorageSync() {
  if (docsThemeStorageInstalled) return;
  docsThemeStorageInstalled = true;
  try {
    chrome.storage?.onChanged?.addListener((changes, area) => {
      if (area !== 'sync' && area !== 'local') return;
      const entry = changes?.[SETTINGS_STORAGE_KEY];
      if (!entry) return;
      const raw = entry.newValue;
      if (raw && typeof raw === 'object') {
        try { paintDocsTheme(raw); } catch { /* ignore */ }
      }
      void getSettings().then(paintDocsTheme).catch(() => { /* ignore */ });
    });
  } catch { /* ignore */ }
}

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   file?: string,
 *   placeholder?: boolean,
 *   icon?: string,
 *   shortcut?: string,
 *   accent?: string,
 *   children?: TopicMeta[]
 * }} TopicMeta
 */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   file: string|null,
 *   placeholder: boolean,
 *   depth: number,
 *   parentId: string|null,
 *   childIds: string[],
 *   bodyText: string,
 *   html: string,
 *   selectable: boolean,
 *   icon: string|null,
 *   shortcut: string|null,
 *   accent: string|null
 * }} DocEntry
 */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   placeholder: boolean,
 *   depth: number,
 *   selectable: boolean,
 *   icon: string|null,
 *   shortcut: string|null,
 *   accent: string|null,
 *   children: NavNode[]
 * }} NavNode
 */

const INDEX_URL = () => chrome.runtime.getURL('userdocs/index.json');
const docUrl = (file) => chrome.runtime.getURL(`userdocs/${file}`);

/** @type {DocEntry[]} */
let allDocs = [];
/** @type {TopicMeta[]} */
let topicTree = [];
/** @type {string|null} */
let activeId = null;

/** @type {ParentNode|null} */
let docsRoot = null;
/** @type {HTMLElement|null} */
let topicListEl = null;
/** @type {HTMLElement|null} */
let emptyEl = null;
/** @type {HTMLElement|null} */
let articleEl = null;
/** @type {HTMLInputElement|null} */
let searchEl = null;
/** @type {HTMLElement|null} */
let closeBtn = null;
/** @type {HTMLElement|null} */
let docsAppEl = null;
/** Preferred topic for the next catalog load (from mount options or location.hash). */
let pendingInitialTopic = null;
/** In-article hash to scroll after selectDoc (without leading #). */
let pendingArticleHash = null;
/** @type {((target: import('../src/utils/kp-deep-link.js').KpDeepLinkTarget) => void)|null} */
let onNavigateDeepLink = null;
/** True once catalog load finished for the current mount. */
let docsCatalogReady = false;

function bindDocsElements(root) {
  const scope = root && root.querySelector ? root : document;
  topicListEl = scope.querySelector('#docs-topic-list');
  emptyEl = scope.querySelector('#docs-empty');
  articleEl = scope.querySelector('#docs-article');
  searchEl = scope.querySelector('#docs-search');
  closeBtn = scope.querySelector('#close');
  docsAppEl = scope.querySelector('.docs-app');
}

function docsAppMarkup() {
  return `
    <div class="docs-app">
      <header class="header">
        <div class="header-text">
          <h1>KeyPilot Docs</h1>
          <p class="sub">How to use KeyPilot — search topics or browse the list.</p>
        </div>
        <div class="header-actions">
          <button id="close" class="btn" type="button">Close</button>
        </div>
      </header>
      <div class="docs-shell">
        <aside class="docs-nav" aria-label="Documentation topics">
          <label class="search-label" for="docs-search">Search</label>
          <input
            id="docs-search"
            class="docs-search"
            type="search"
            placeholder="Search docs…"
            autocomplete="off"
            spellcheck="false"
          />
          <nav id="docs-topic-list" class="topic-list" aria-label="Topics"></nav>
          <p id="docs-empty" class="docs-empty" hidden>No matching topics.</p>
        </aside>
        <main class="docs-main">
          <article id="docs-article" class="docs-article" aria-live="polite">
            <p class="muted">Loading documentation…</p>
          </article>
        </main>
      </div>
    </div>
  `.trim();
}

// ---------------------------------------------------------------------------
// Markdown → HTML
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

function isAllowedDocsHref(url) {
  const s = String(url || '').trim();
  if (/^(https?:|chrome-extension:|mailto:|kp:|#|data:)/i.test(s)) return true;
  // Docs screenshot slots: ![…](images/foo.png)
  if (/^(\.\/)?(userdocs\/)?images\//i.test(s)) return true;
  return false;
}

markdown.validateLink = (url) => isAllowedDocsHref(url);

const defaultLinkOpen =
  markdown.renderer.rules.link_open ||
  ((tokens, idx, options, _env, renderer) =>
    renderer.renderToken(tokens, idx, options));

markdown.renderer.rules.link_open = (tokens, idx, options, env, renderer) => {
  const href = tokens[idx].attrGet('href') || '';
  if (!href.startsWith('#') && !isKpDeepLink(href)) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
  }
  return defaultLinkOpen(tokens, idx, options, env, renderer);
};

markdown.renderer.rules.table_open = () => '<div class="table-scroll"><table>\n';
markdown.renderer.rules.table_close = () => '</table></div>\n';

const defaultImage =
  markdown.renderer.rules.image ||
  ((tokens, idx, options, env, renderer) => renderer.renderToken(tokens, idx, options));

markdown.renderer.rules.image = (tokens, idx, options, env, renderer) => {
  const token = tokens[idx];
  const src = String(token.attrGet('src') || '').trim();
  if (src && !/^(https?:|chrome-extension:|data:)/i.test(src)) {
    const cleaned = src.replace(/^\.\//, '').replace(/^userdocs\//, '');
    const rel = cleaned.startsWith('images/') ? `userdocs/${cleaned}` : `userdocs/images/${cleaned}`;
    try {
      token.attrSet('src', chrome.runtime.getURL(rel));
    } catch {
      token.attrSet('src', rel);
    }
  }
  token.attrSet('class', [token.attrGet('class') || '', 'docs-shot'].filter(Boolean).join(' ').trim());
  return defaultImage(tokens, idx, options, env, renderer);
};

function slugifyHeading(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const defaultHeadingOpen =
  markdown.renderer.rules.heading_open ||
  ((tokens, idx, options, _env, renderer) =>
    renderer.renderToken(tokens, idx, options));

markdown.renderer.rules.heading_open = (tokens, idx, options, env, renderer) => {
  const token = tokens[idx];
  if (token && !token.attrGet('id')) {
    let title = '';
    for (let i = idx + 1; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === 'heading_close') break;
      if (t.type === 'inline') title += t.content || '';
    }
    const id = slugifyHeading(title);
    if (id) token.attrSet('id', id);
  }
  return defaultHeadingOpen(tokens, idx, options, env, renderer);
};

/**
 * @param {string} md
 * @returns {string}
 */
function renderMarkdown(md) {
  return markdown.render(String(md || ''));
}

const NAV_ACCENTS = new Set(['green', 'blue', 'amber', 'indigo', 'rose', 'cyan', 'violet']);

/** Allow-listed, Lucide-style paths rendered locally with currentColor. */
const NAV_ICON_PATHS = Object.freeze({
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z'],
  pointer: ['m9 9 5 12 2.2-5.2L21 14Z', 'M7.2 2.2 9 9l-6.8-1.8Z'],
  tabs: ['M8 6h13v13H8z', 'M3 5V3h13v3', 'M5 8H3v8h5'],
  scroll: ['M8 2h8a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Z', 'M12 6v12', 'm9 9 3-3 3 3', 'm9 15 3 3 3-3'],
  select: ['M3 3h6v2H5v4H3Z', 'M15 3h6v6h-2V5h-4Z', 'M3 15h2v4h4v2H3Z', 'M19 15h2v6h-6v-2h4Z'],
  layers: ['m12 2 9 5-9 5-9-5Z', 'm3 12 9 5 9-5', 'm3 17 9 5 9-5'],
  keyboard: ['M3 5h18v14H3z', 'M7 9h.01M11 9h.01M15 9h.01M19 9h.01M7 13h.01M11 13h.01M15 13h.01M19 13h.01M8 17h8'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z', 'm9 12 2 2 4-4'],
  settings: ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V20h-3v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.55-1H5v-3h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.55V4h3v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19 9.3a1.7 1.7 0 0 0 1.55 1H21v3h-.09a1.7 1.7 0 0 0-1.51 1.7Z'],
  search: ['m21 21-4.35-4.35', 'M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z'],
  rocket: ['M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2', 'm9 15-3-3s3.5-7.5 9-9c3 0 6 0 6 0s0 3 0 6c-1.5 5.5-9 9-9 9Z', 'M9 15H4s.55-3.03 2-4.5M12 18v5s3.03-.55 4.5-2'],
  grid: ['M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'],
  history: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5', 'M12 7v5l3 2'],
  controls: ['M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3', 'M1 14h6M9 8h6M17 16h6'],
  preview: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  image: ['M3 3h18v18H3z', 'm3 16 5-5 4 4 2-2 7 7', 'M16 8h.01'],
  library: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z', 'M8 7h8M8 11h8'],
  copy: ['M8 8h13v13H8z', 'M16 8V3H3v13h5'],
  layout: ['M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z', 'M14 17h7M17.5 13.5v7'],
  functions: ['M18 16.98h-5.99c-1.1 0-1.93-.94-1.73-2.02l1.44-7.92A2.5 2.5 0 0 1 14.18 5H16', 'M7 9h8'],
  macros: ['M8 6h13M8 12h13M8 18h13', 'm3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2'],
  code: ['m8 9-3 3 3 3M16 9l3 3-3 3', 'm14 5-4 14']
});

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

/**
 * Flatten topic tree into loadable nodes (depth-first).
 * Group-only nodes (no file) are kept so they can appear as section headers.
 * @param {TopicMeta[]} topics
 * @param {number} [depth]
 * @param {string|null} [parentId]
 * @returns {Array<{ id: string, title: string, file: string|null, placeholder: boolean, depth: number, parentId: string|null, childIds: string[], icon: string|null, shortcut: string|null, accent: string|null }>}
 */
function filterTopicsForBuild(topics) {
  if (BUILD_ENABLE_MACRO_BUILDER) return topics;
  const hide = new Set(['macros-overview', 'macro-builder']);
  const walk = (list) => (list || [])
    .filter((t) => t && !hide.has(t.id))
    .map((t) => {
      const children = Array.isArray(t.children) ? walk(t.children) : undefined;
      return children && children.length ? { ...t, children } : { ...t, children: undefined };
    });
  return walk(topics);
}

/**
 * Flatten topic tree into loadable nodes (depth-first).
 * Group-only nodes (no file) are kept so they can appear as section headers.
 * @param {TopicMeta[]} topics
 * @param {number} [depth]
 * @param {string|null} [parentId]
 * @returns {Array<{ id: string, title: string, file: string|null, placeholder: boolean, depth: number, parentId: string|null, childIds: string[], icon: string|null, shortcut: string|null, accent: string|null }>}
 */
function flattenTopics(topics, depth = 0, parentId = null) {
  /** @type {ReturnType<typeof flattenTopics>} */
  const out = [];
  for (const topic of topics || []) {
    if (!topic || typeof topic.id !== 'string' || typeof topic.title !== 'string') continue;
    const children = Array.isArray(topic.children) ? topic.children : [];
    const childIds = children
      .filter((c) => c && typeof c.id === 'string')
      .map((c) => c.id);
    const file = typeof topic.file === 'string' && topic.file.trim() ? topic.file.trim() : null;
    const icon = typeof topic.icon === 'string' && NAV_ICON_PATHS[topic.icon] ? topic.icon : null;
    const shortcut = typeof topic.shortcut === 'string' && topic.shortcut.trim()
      ? topic.shortcut.trim().slice(0, 12)
      : null;
    const accent = typeof topic.accent === 'string' && NAV_ACCENTS.has(topic.accent)
      ? topic.accent
      : null;
    out.push({
      id: topic.id,
      title: topic.title,
      file,
      placeholder: !!topic.placeholder,
      depth,
      parentId,
      childIds,
      icon,
      shortcut,
      accent
    });
    if (children.length) {
      out.push(...flattenTopics(children, depth + 1, topic.id));
    }
  }
  return out;
}

/**
 * @param {ReturnType<typeof flattenTopics>} flat
 * @returns {Promise<DocEntry[]>}
 */
async function loadDocs(flat) {
  const entries = await Promise.all(
    flat.map(async (topic) => {
      let bodyText = '';
      let html = '';
      const selectable = !!topic.file;

      if (topic.file) {
        try {
          const res = await fetch(docUrl(topic.file));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          bodyText = await res.text();
        } catch (err) {
          console.warn('[KeyPilot Docs] Failed to load', topic.file, err);
          bodyText = `# ${topic.title}\n\nFailed to load this document.`;
        }
        html = renderMarkdown(bodyText);
      }

      return {
        id: topic.id,
        title: topic.title,
        file: topic.file,
        placeholder: topic.placeholder,
        depth: topic.depth,
        parentId: topic.parentId,
        childIds: topic.childIds,
        bodyText,
        html,
        selectable,
        icon: topic.icon,
        shortcut: topic.shortcut,
        accent: topic.accent
      };
    })
  );
  return entries;
}

function matchesQuery(doc, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    doc.title.toLowerCase().includes(q) ||
    doc.bodyText.toLowerCase().includes(q)
  );
}

/**
 * Build a filtered nav tree. A node is kept if it matches, or any descendant matches.
 * Ancestors of matches stay visible so hierarchy remains readable.
 * @param {TopicMeta[]} topics
 * @param {string} query
 * @param {number} [depth]
 * @returns {NavNode[]}
 */
function buildNavTree(topics, query, depth = 0) {
  /** @type {NavNode[]} */
  const out = [];
  for (const topic of topics || []) {
    if (!topic || typeof topic.id !== 'string') continue;
    const doc = allDocs.find((d) => d.id === topic.id);
    if (!doc) continue;

    const childTopics = Array.isArray(topic.children) ? topic.children : [];
    const children = buildNavTree(childTopics, query, depth + 1);
    const selfMatch = matchesQuery(doc, query);
    if (query && !selfMatch && !children.length) continue;

    out.push({
      id: doc.id,
      title: doc.title,
      placeholder: doc.placeholder,
      depth,
      selectable: doc.selectable,
      icon: doc.icon,
      shortcut: doc.shortcut,
      accent: doc.accent,
      children
    });
  }
  return out;
}

/** @returns {DocEntry[]} selectable docs that match the current query (leaf/file pages) */
function filteredSelectableDocs() {
  const q = (searchEl?.value || '').trim();
  return allDocs.filter((d) => d.selectable && matchesQuery(d, q));
}

/**
 * Prefer first selectable descendant (depth-first), else the node itself if selectable.
 * @param {string} id
 * @returns {string|null}
 */
function resolveSelectableId(id) {
  const doc = allDocs.find((d) => d.id === id);
  if (!doc) return null;
  if (doc.selectable) return doc.id;
  for (const childId of doc.childIds || []) {
    const resolved = resolveSelectableId(childId);
    if (resolved) return resolved;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/**
 * @param {string} iconName
 * @returns {SVGSVGElement|null}
 */
function createNavIcon(iconName) {
  const paths = NAV_ICON_PATHS[iconName];
  if (!paths) return null;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.classList.add('topic-icon-svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const pathData of paths) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', pathData);
    svg.appendChild(path);
  }
  return svg;
}

/**
 * @param {NavNode} node
 * @param {HTMLElement} parentEl
 */
function appendNavNode(node, parentEl) {
  const row = document.createElement(node.selectable ? 'button' : 'div');
  if (node.selectable) {
    /** @type {HTMLButtonElement} */ (row).type = 'button';
  } else {
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
  }
  row.className = node.selectable ? 'topic-btn' : 'topic-group';
  row.dataset.id = node.id;
  row.style.setProperty('--topic-depth', String(node.depth));
  if (node.accent) row.dataset.accent = node.accent;
  if (node.selectable && node.id === activeId) {
    row.setAttribute('aria-current', 'page');
  }

  const labelWrap = document.createElement('span');
  labelWrap.className = 'topic-label';

  if (node.shortcut) {
    const shortcut = document.createElement('kbd');
    shortcut.className = 'topic-visual topic-shortcut';
    shortcut.textContent = node.shortcut;
    shortcut.setAttribute('aria-hidden', 'true');
    labelWrap.appendChild(shortcut);
  } else if (node.icon) {
    const iconWrap = document.createElement('span');
    iconWrap.className = 'topic-visual topic-icon';
    iconWrap.setAttribute('aria-hidden', 'true');
    const icon = createNavIcon(node.icon);
    if (icon) iconWrap.appendChild(icon);
    labelWrap.appendChild(iconWrap);
  }

  const titleSpan = document.createElement('span');
  titleSpan.className = 'topic-title';
  titleSpan.textContent = node.title;
  labelWrap.appendChild(titleSpan);
  row.appendChild(labelWrap);

  if (node.placeholder) {
    const badge = document.createElement('span');
    badge.className = 'topic-placeholder';
    badge.textContent = 'Soon';
    row.appendChild(badge);
  }

  if (node.selectable) {
    row.addEventListener('click', () => selectDoc(node.id));
  } else {
    row.addEventListener('click', () => {
      const next = resolveSelectableId(node.id);
      if (next) selectDoc(next);
    });
  }

  parentEl.appendChild(row);

  if (node.children.length) {
    const childWrap = document.createElement('div');
    childWrap.className = 'topic-children';
    childWrap.setAttribute('role', 'group');
    childWrap.setAttribute('aria-label', node.title);
    for (const child of node.children) {
      appendNavNode(child, childWrap);
    }
    parentEl.appendChild(childWrap);
  }
}

function renderNav() {
  if (!topicListEl || !emptyEl) return;
  const q = (searchEl?.value || '').trim();
  const tree = buildNavTree(topicTree, q);
  topicListEl.replaceChildren();

  if (!tree.length) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  for (const node of tree) {
    appendNavNode(node, topicListEl);
  }
}

function selectDoc(id, articleHash) {
  const resolved = resolveSelectableId(id) || id;
  const doc = allDocs.find((d) => d.id === resolved);
  if (!doc || !articleEl) return;
  if (!doc.selectable) {
    // Group with no loadable descendants
    activeId = null;
    articleEl.innerHTML = `<p class="muted">${escapeHtml(doc.title)}</p>`;
    renderNav();
    return;
  }
  activeId = doc.id;
  articleEl.innerHTML = doc.html || '<p class="muted">Empty document.</p>';
  renderNav();
  bindDocsCopyPrompts(articleEl);
  scrollDocsArticleToHash(articleHash);
}

/**
 * Readonly AI-prompt textareas: select all on focus so copy is one shortcut.
 * @param {HTMLElement|null} article
 */
function bindDocsCopyPrompts(article) {
  if (!article) return;
  article.querySelectorAll('textarea.kp-docs-copy-prompt').forEach((el) => {
    el.addEventListener('focus', () => {
      try { el.select(); } catch { /* ignore */ }
    });
  });
}

/**
 * Scroll the article to an in-document heading/id after topic select.
 * @param {string|null|undefined} hash
 */
function scrollDocsArticleToHash(hash) {
  const id = String(hash || '').replace(/^#/, '').trim();
  if (!id || !articleEl) return;
  try {
    const el =
      articleEl.querySelector(`#${CSS.escape(id)}`) ||
      articleEl.querySelector(`[name="${CSS.escape(id)}"]`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'start', behavior: 'auto' });
      return;
    }
  } catch { /* ignore */ }
  try {
    articleEl.scrollTop = 0;
  } catch { /* ignore */ }
}

/**
 * Navigate the mounted Docs app to a topic (and optional in-article hash).
 * @param {string} topicId
 * @param {string} [hash]
 * @returns {boolean}
 */
export function navigateDocsApp(topicId, hash) {
  if (!docsCatalogReady || !articleEl) return false;
  const id = String(topicId || '').trim();
  if (!id) return false;
  const resolved = resolveSelectableId(id);
  if (!resolved) {
    const first = allDocs.find((d) => d.selectable);
    if (!first) return false;
    selectDoc(first.id);
    return false;
  }
  selectDoc(resolved, hash);
  return true;
}

/**
 * Default deep-link navigation when no host callback is provided
 * (standalone docs.html / newtab iframe).
 * @param {import('../src/utils/kp-deep-link.js').KpDeepLinkTarget} target
 */
function defaultNavigateDeepLink(target) {
  if (!target || (target.kind !== 'settings' && target.kind !== 'docs')) return;

  if (target.kind === 'docs') {
    if (navigateDocsApp(target.id, target.hash)) return;
  }

  try {
    const kp =
      (typeof window !== 'undefined' && (window.__KeyPilotInstance || window.keyPilot)) ||
      null;
    if (kp && typeof kp.navigateKpDeepLink === 'function') {
      kp.navigateKpDeepLink(target);
      return;
    }
  } catch { /* ignore */ }

  // New Tab / Guide iframe: parent page owns KeyPilot.
  try {
    const parentKp =
      (typeof window !== 'undefined' &&
        window.parent &&
        window.parent !== window &&
        (window.parent.__KeyPilotInstance || window.parent.keyPilot)) ||
      null;
    if (parentKp && typeof parentKp.navigateKpDeepLink === 'function') {
      try {
        window.parent.postMessage({ type: MSG.POPOVER_REQUEST_CLOSE, key: 'Escape' }, '*');
      } catch { /* ignore */ }
      parentKp.navigateKpDeepLink(target);
      return;
    }
  } catch { /* ignore cross-origin */ }

  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      if (target.kind === 'settings') {
        void chrome.runtime.sendMessage({
          type: MSG.OPEN_SETTINGS_POPOVER,
          panelId: target.id
        });
      } else {
        void chrome.runtime.sendMessage({
          type: MSG.OPEN_DOCS_POPOVER,
          topicId: target.id,
          hash: target.hash
        });
      }
    }
  } catch { /* ignore */ }
}

/**
 * @param {MouseEvent} e
 */
function onDocsDeepLinkClick(e) {
  if (!e || e.defaultPrevented) return;
  if (e.button != null && e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
  /** @type {Element|null} */
  let el = null;
  for (const node of path) {
    if (node && node.nodeType === 1 && /** @type {Element} */ (node).tagName === 'A') {
      el = /** @type {Element} */ (node);
      break;
    }
  }
  if (!el) {
    const t = e.target;
    el = t && /** @type {Element} */ (t).closest ? /** @type {Element} */ (t).closest('a[href]') : null;
  }
  if (!el) return;
  const href = el.getAttribute('href') || '';
  const parsed = parseKpDeepLink(href);
  if (!parsed) return;
  e.preventDefault();
  e.stopPropagation();

  if (parsed.kind === 'docs') {
    navigateDocsApp(parsed.id, parsed.hash);
    return;
  }

  const nav = onNavigateDeepLink || defaultNavigateDeepLink;
  try {
    nav(parsed);
  } catch { /* ignore */ }
}

/**
 * Resolve initial topic from mount option, then location.hash (standalone).
 * @param {string|null|undefined} fromOptions
 * @returns {{ topicId: string|null, hash: string|null }}
 */
function resolveInitialDocsTarget(fromOptions) {
  const opt = String(fromOptions || '').trim();
  if (opt) return { topicId: opt, hash: pendingArticleHash };

  try {
    const raw = (location.hash || '').replace(/^#/, '').trim();
    if (!raw) return { topicId: null, hash: null };
    // docs.html#browsing-click or docs.html#browsing-click/section
    const slash = raw.indexOf('/');
    if (slash > 0) {
      return { topicId: raw.slice(0, slash), hash: raw.slice(slash + 1) || null };
    }
    return { topicId: raw, hash: null };
  } catch {
    return { topicId: null, hash: null };
  }
}

function applyFontScale(scale) {
  const n = Number(scale);
  if (!Number.isFinite(n) || n < 0.8 || n > 1.75) return;
  const value = String(n);
  if (docsAppEl) docsAppEl.style.setProperty('--docs-font-scale', value);
  if (docsRoot instanceof ShadowRoot && docsRoot.host) {
    docsRoot.host.style.setProperty('--docs-font-scale', value);
  }
  if (docsRoot?.nodeType === 9) {
    try { document.documentElement.style.setProperty('--docs-font-scale', value); } catch { /* ignore */ }
  }
}

/**
 * Mount the docs UI into a document or open ShadowRoot.
 * @param {Document|ShadowRoot|Element} root
 * @param {{
 *   embedded?: boolean,
 *   onClose?: () => void,
 *   fontScale?: number,
 *   initialTopic?: string,
 *   initialHash?: string,
 *   onNavigateDeepLink?: (target: import('../src/utils/kp-deep-link.js').KpDeepLinkTarget) => void
 * }} [options]
 * @returns {() => void}
 */
export function mountDocsApp(root, options = {}) {
  const embedded = options.embedded === true;
  const onClose = typeof options.onClose === 'function' ? options.onClose : null;
  onNavigateDeepLink =
    typeof options.onNavigateDeepLink === 'function' ? options.onNavigateDeepLink : null;
  pendingInitialTopic = String(options.initialTopic || '').trim() || null;
  pendingArticleHash = String(options.initialHash || '').replace(/^#/, '').trim() || null;
  docsCatalogReady = false;
  docsRoot = root;

  const mountNode = root.nodeType === 9
    ? /** @type {Document} */ (root).body
    : root;
  if (!mountNode) return () => {};

  if (!mountNode.querySelector?.('.docs-app')) {
    const holder = document.createElement('div');
    holder.innerHTML = docsAppMarkup();
    const app = holder.firstElementChild;
    if (app) mountNode.appendChild(app);
  }

  bindDocsElements(mountNode);

  docsThemeRoot = root;
  const paint = (settings) => {
    try { paintDocsTheme(settings); } catch { /* ignore */ }
  };
  try {
    void getSettings().then(paint).catch(() => { /* ignore */ });
  } catch { /* ignore */ }
  installDocsThemeStorageSync();

  if (embedded && docsAppEl) {
    docsAppEl.classList.add('kp-popover-embed');
    const header = docsAppEl.querySelector('.header');
    if (header) {
      header.hidden = true;
      header.setAttribute('aria-hidden', 'true');
    }
  }

  if (Number.isFinite(Number(options.fontScale))) {
    applyFontScale(options.fontScale);
  }

  const requestClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    try {
      window.parent.postMessage({ type: MSG.POPOVER_REQUEST_CLOSE, key: 'Escape' }, '*');
    } catch {
      /* ignore */
    }
  };

  const onSearchInput = () => {
    renderNav();
    const visible = filteredSelectableDocs();
    if (!visible.length) {
      if (articleEl) {
        articleEl.innerHTML = '<p class="muted">No matching topics.</p>';
      }
      activeId = null;
      return;
    }
    if (!visible.some((d) => d.id === activeId)) {
      selectDoc(visible[0].id);
    } else {
      renderNav();
    }
  };

  closeBtn?.addEventListener('click', requestClose);
  searchEl?.addEventListener('input', onSearchInput);
  // Capture so KeyPilot F-click / page handlers do not steal kp:// navigation.
  mountNode.addEventListener?.('click', onDocsDeepLinkClick, true);

  void (async () => {
    try {
      const res = await fetch(INDEX_URL());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const index = await res.json();
      topicTree = filterTopicsForBuild(Array.isArray(index?.topics) ? index.topics : []);
      const flat = flattenTopics(topicTree);
      allDocs = await loadDocs(flat);
      docsCatalogReady = true;

      const firstSelectable = allDocs.find((d) => d.selectable);
      if (!firstSelectable) {
        if (articleEl) {
          articleEl.innerHTML = '<p class="error">No documentation topics found.</p>';
        }
        renderNav();
        return;
      }

      const { topicId, hash } = resolveInitialDocsTarget(pendingInitialTopic);
      pendingInitialTopic = null;
      const articleHash = hash || pendingArticleHash;
      pendingArticleHash = null;

      if (topicId && resolveSelectableId(topicId)) {
        selectDoc(topicId, articleHash);
      } else {
        selectDoc(firstSelectable.id);
      }
      // Standalone page: land in the search box. Embedded popover: wait for F-click
      // so KeyPilot stays in browse mode (hover outlines / topic activation).
      if (!embedded) searchEl?.focus();
    } catch (err) {
      console.warn('[KeyPilot Docs] Failed to load index:', err);
      docsCatalogReady = false;
      if (articleEl) {
        articleEl.innerHTML =
          '<p class="error">Could not load documentation catalog.</p>';
      }
    }
  })();

  return () => {
    closeBtn?.removeEventListener('click', requestClose);
    searchEl?.removeEventListener('input', onSearchInput);
    try { mountNode.removeEventListener?.('click', onDocsDeepLinkClick, true); } catch { /* ignore */ }
    topicListEl = null;
    emptyEl = null;
    articleEl = null;
    searchEl = null;
    closeBtn = null;
    docsAppEl = null;
    docsRoot = null;
    onNavigateDeepLink = null;
    pendingInitialTopic = null;
    pendingArticleHash = null;
    docsCatalogReady = false;
  };
}

if (typeof document !== 'undefined' && document.documentElement?.hasAttribute('data-kp-docs-page')) {
  mountDocsApp(document, { embedded: false });
}
