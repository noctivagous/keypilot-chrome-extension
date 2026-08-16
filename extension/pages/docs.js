/**
 * KeyPilot Docs popover page.
 * Loads userdocs/index.json + markdown files; client-side search; subset markdown renderer.
 * Topics may nest via `children` in the catalog.
 */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   file?: string,
 *   placeholder?: boolean,
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
 *   selectable: boolean
 * }} DocEntry
 */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   placeholder: boolean,
 *   depth: number,
 *   selectable: boolean,
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

const topicListEl = document.getElementById('docs-topic-list');
const emptyEl = document.getElementById('docs-empty');
const articleEl = document.getElementById('docs-article');
const searchEl = document.getElementById('docs-search');
const closeBtn = document.getElementById('close');

// ---------------------------------------------------------------------------
// Minimal markdown subset → HTML
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(text) {
  let s = escapeHtml(text);
  // Links: [label](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
    const safeHref = String(href).replace(/"/g, '');
    if (!/^(https?:|chrome-extension:|mailto:|#)/i.test(safeHref)) {
      return escapeHtml(`[${label}](${href})`);
    }
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  // Inline code
  s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  // Bold then italic
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return s;
}

/**
 * Very small markdown renderer: headings, paragraphs, ul/ol, inline styles.
 * @param {string} md
 * @returns {string}
 */
function renderMarkdown(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let listType = null; // 'ul' | 'ol' | null

  const closeList = () => {
    if (listType) {
      out.push(listType === 'ol' ? '</ol>' : '</ul>');
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      i += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    const ul = /^[-*]\s+(.+)$/.exec(trimmed);
    if (ul) {
      if (listType !== 'ul') {
        closeList();
        out.push('<ul>');
        listType = 'ul';
      }
      out.push(`<li>${renderInline(ul[1])}</li>`);
      i += 1;
      continue;
    }

    const ol = /^(\d+)\.\s+(.+)$/.exec(trimmed);
    if (ol) {
      if (listType !== 'ol') {
        closeList();
        out.push('<ol>');
        listType = 'ol';
      }
      out.push(`<li>${renderInline(ol[2])}</li>`);
      i += 1;
      continue;
    }

    closeList();
    // Paragraph: gather consecutive non-blank, non-special lines
    const para = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next || /^(#{1,3})\s+/.test(next) || /^[-*]\s+/.test(next) || /^\d+\.\s+/.test(next)) {
        break;
      }
      para.push(next);
      i += 1;
    }
    out.push(`<p>${renderInline(para.join(' '))}</p>`);
  }

  closeList();
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

/**
 * Flatten topic tree into loadable nodes (depth-first).
 * Group-only nodes (no file) are kept so they can appear as section headers.
 * @param {TopicMeta[]} topics
 * @param {number} [depth]
 * @param {string|null} [parentId]
 * @returns {Array<{ id: string, title: string, file: string|null, placeholder: boolean, depth: number, parentId: string|null, childIds: string[] }>}
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
    out.push({
      id: topic.id,
      title: topic.title,
      file,
      placeholder: !!topic.placeholder,
      depth,
      parentId,
      childIds
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
        selectable
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
 * @param {NavNode} node
 * @param {HTMLElement} parentEl
 */
function appendNavNode(node, parentEl) {
  const row = document.createElement(node.selectable ? 'button' : 'div');
  if (node.selectable) {
    /** @type {HTMLButtonElement} */ (row).type = 'button';
  }
  row.className = node.selectable ? 'topic-btn' : 'topic-group';
  row.dataset.id = node.id;
  row.style.setProperty('--topic-depth', String(node.depth));
  if (node.selectable && node.id === activeId) {
    row.setAttribute('aria-current', 'page');
  }

  const titleSpan = document.createElement('span');
  titleSpan.className = 'topic-title';
  titleSpan.textContent = node.title;
  row.appendChild(titleSpan);

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

function selectDoc(id) {
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
}

function requestClose() {
  try {
    window.parent.postMessage({ type: 'KP_POPOVER_REQUEST_CLOSE', key: 'Escape' }, '*');
  } catch {
    /* ignore */
  }
}

/**
 * When Docs is embedded in the KeyPilot iframe popover, the outer chrome
 * already provides a standard titlebar + × close. Hide the in-page header.
 */
function adaptHeaderForPopoverEmbed() {
  try {
    const embedded = window.parent && window.parent !== window;
    if (!embedded) return;
    document.documentElement.classList.add('kp-popover-embed');
    document.body?.classList?.add('kp-popover-embed');
    const header = document.querySelector('.docs-app > .header, .header');
    if (header) {
      header.hidden = true;
      header.setAttribute('aria-hidden', 'true');
    }
  } catch {
    // ignore
  }
}

async function init() {
  adaptHeaderForPopoverEmbed();
  closeBtn?.addEventListener('click', requestClose);
  searchEl?.addEventListener('input', () => {
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
  });

  try {
    const res = await fetch(INDEX_URL());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const index = await res.json();
    topicTree = Array.isArray(index?.topics) ? index.topics : [];
    const flat = flattenTopics(topicTree);
    allDocs = await loadDocs(flat);
    const firstSelectable = allDocs.find((d) => d.selectable);
    if (!firstSelectable) {
      if (articleEl) {
        articleEl.innerHTML = '<p class="error">No documentation topics found.</p>';
      }
      renderNav();
      return;
    }
    selectDoc(firstSelectable.id);
    searchEl?.focus();
  } catch (err) {
    console.warn('[KeyPilot Docs] Failed to load index:', err);
    if (articleEl) {
      articleEl.innerHTML =
        '<p class="error">Could not load documentation catalog.</p>';
    }
  }
}

init();
