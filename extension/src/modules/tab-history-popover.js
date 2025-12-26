/**
 * TabHistoryPopover
 * - Renders a branching, per-tab navigation history (tracked by service worker).
 * - Uses PopupManager to keep z-index below click overlays and to enable View Transitions.
 */
import { createUrlListingContainer, renderUrlListing } from '../ui/url-listing.js';

export class TabHistoryPopover {
  /**
   * @param {object} opts
   * @param {import('./popup-manager.js').PopupManager} opts.popupManager
   */
  constructor({ popupManager } = {}) {
    this.popupManager = popupManager || null;
    this._popupId = 'kpv2-tab-history-popover';

    /** @type {HTMLElement|null} */
    this._panel = null;
    /** @type {HTMLElement|null} */
    this._tabList = null;
    /** @type {HTMLElement|null} */
    this._tabStatus = null;
    /** @type {HTMLElement|null} */
    this._browserList = null;
    /** @type {HTMLElement|null} */
    this._browserStatus = null;

    this._open = false;
    this._lastGraph = null;
  }

  isOpen() {
    return this._open;
  }

  toggle() {
    if (this._open) this.hide();
    else this.show();
  }

  show() {
    if (!this.popupManager) return;
    if (this._open) return;
    this._open = true;

    this._ensureDom();
    this.popupManager.showModal({
      id: this._popupId,
      panel: this._panel,
      onRequestClose: () => this.hide()
    });

    this._loadAndRender();
  }

  hide() {
    if (!this.popupManager) return;
    if (!this._open) return;
    this._open = false;
    try {
      this.popupManager.hideModal(this._popupId);
    } catch {
      // ignore
    }
  }

  _ensureDom() {
    if (this._panel && this._tabList && this._tabStatus && this._browserList && this._browserStatus) return;

    const doc = document;
    const panel = doc.createElement('div');
    panel.className = 'kpv2-tab-history-panel';
    Object.assign(panel.style, {
      position: 'fixed',
      left: '50%',
      top: '14vh',
      transform: 'translateX(-50%)',
      width: 'min(980px, calc(100vw - 32px))',
      maxHeight: '72vh',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: '14px',
      border: '1px solid rgba(255,140,0,0.25)',
      background: 'rgba(18, 18, 18, 0.92)',
      boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
      overflow: 'hidden',
      outline: 'none'
    });

    const header = doc.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 14px',
      borderBottom: '1px solid rgba(255,140,0,0.14)',
      background: 'linear-gradient(180deg, rgba(28,28,28,0.95) 0%, rgba(16,16,16,0.95) 100%)'
    });

    const titleWrap = doc.createElement('div');
    Object.assign(titleWrap.style, {
      display: 'flex',
      alignItems: 'baseline',
      gap: '10px',
      minWidth: '0'
    });

    const title = doc.createElement('div');
    title.textContent = 'History';
    Object.assign(title.style, {
      fontSize: '14px',
      fontWeight: '700',
      color: 'rgba(255,255,255,0.92)',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    });

    const subtitle = doc.createElement('div');
    subtitle.textContent = 'Tab (left) + Browser (right)';
    Object.assign(subtitle.style, {
      fontSize: '12px',
      fontWeight: '600',
      color: 'rgba(255,140,0,0.85)',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      whiteSpace: 'nowrap'
    });

    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);

    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close');
    Object.assign(closeBtn.style, {
      width: '34px',
      height: '34px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(0,0,0,0.25)',
      color: 'rgba(255,255,255,0.9)',
      fontSize: '22px',
      lineHeight: '1',
      cursor: 'pointer',
      flex: '0 0 auto'
    });
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
    }, true);

    header.appendChild(titleWrap);
    header.appendChild(closeBtn);

    const body = doc.createElement('div');
    Object.assign(body.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
      padding: '10px',
      flex: '1 1 auto',
      minHeight: '0',
      overflow: 'hidden'
    });

    const makeColumn = ({ titleText }) => {
      const col = doc.createElement('div');
      Object.assign(col.style, {
        flex: '1 1 420px',
        minWidth: '0',
        minHeight: '0',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'rgba(0,0,0,0.18)'
      });

      const colHeader = doc.createElement('div');
      Object.assign(colHeader.style, {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: '10px',
        padding: '10px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.18)'
      });

      const colTitle = doc.createElement('div');
      colTitle.textContent = titleText;
      Object.assign(colTitle.style, {
        fontSize: '13px',
        fontWeight: '800',
        color: 'rgba(255,255,255,0.9)',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      });

      const colHint = doc.createElement('div');
      colHint.textContent = 'Click to navigate';
      Object.assign(colHint.style, {
        fontSize: '11px',
        fontWeight: '600',
        color: 'rgba(255,255,255,0.55)',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        whiteSpace: 'nowrap'
      });

      colHeader.appendChild(colTitle);
      colHeader.appendChild(colHint);

      const colStatus = doc.createElement('div');
      Object.assign(colStatus.style, {
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.65)',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      });
      colStatus.textContent = 'Loading…';

      const colList = createUrlListingContainer({
        doc,
        view: 'list',
        useInlineStyles: true,
        scrollY: true,
        style: {
          overflowY: 'auto',
          padding: '8px 6px',
          flex: '1 1 auto',
          minHeight: '0'
        }
      });

      col.appendChild(colHeader);
      col.appendChild(colStatus);
      col.appendChild(colList);
      return { col, colStatus, colList };
    };

    const tabCol = makeColumn({ titleText: 'Tab history' });
    const browserCol = makeColumn({ titleText: 'Browser history' });

    panel.appendChild(header);
    body.appendChild(tabCol.col);
    body.appendChild(browserCol.col);
    panel.appendChild(body);

    this._panel = panel;
    this._tabStatus = tabCol.colStatus;
    this._tabList = tabCol.colList;
    this._browserStatus = browserCol.colStatus;
    this._browserList = browserCol.colList;
  }

  async _loadAndRender() {
    if (!this._open) return;
    if (!this._tabStatus || !this._tabList || !this._browserStatus || !this._browserList) return;

    this._tabStatus.textContent = 'Loading tab history…';
    this._tabList.textContent = '';
    this._browserStatus.textContent = 'Loading browser history…';
    this._browserList.textContent = '';

    await Promise.allSettled([
      this._loadAndRenderTabHistory(),
      this._loadAndRenderBrowserHistory()
    ]);
  }

  async _loadAndRenderTabHistory() {
    if (!this._open) return;
    if (!this._tabStatus || !this._tabList) return;

    let resp = null;
    try {
      resp = await chrome.runtime.sendMessage({ type: 'KP_NAVGRAPH_GET' });
    } catch {
      resp = null;
    }

    if (!this._open) return;

    if (!resp || resp.type !== 'KP_NAVGRAPH_GRAPH' || !resp.graph) {
      this._tabStatus.textContent = 'Tab history unavailable.';
      return;
    }

    this._lastGraph = resp.graph;
    this._renderGraph(resp.graph);
  }

  async _loadAndRenderBrowserHistory() {
    if (!this._open) return;
    if (!this._browserStatus || !this._browserList) return;

    let resp = null;
    try {
      // Recent history; background uses chrome.history (not available in content scripts).
      resp = await chrome.runtime.sendMessage({
        type: 'KP_BROWSER_HISTORY_GET',
        query: '',
        maxResults: 40,
        days: 14
      });
    } catch {
      resp = null;
    }

    if (!this._open) return;

    const items = Array.isArray(resp?.items) ? resp.items : [];
    if (!resp || resp.type !== 'KP_BROWSER_HISTORY_RESULT') {
      this._browserStatus.textContent = 'Browser history unavailable.';
      return;
    }

    if (!items.length) {
      this._browserStatus.textContent = 'No recent browser history.';
      this._browserList.textContent = '';
      return;
    }

    this._browserStatus.textContent = 'Click an entry to navigate. Press Esc to close.';
    this._renderBrowserHistory(items);
  }

  _renderGraph(graph) {
    if (!this._tabStatus || !this._tabList) return;

    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph.edges) ? graph.edges : [];
    const cursorId = graph.cursorId;

    if (!nodes.length) {
      this._tabStatus.textContent = 'No tab history yet.';
      return;
    }

    this._tabStatus.textContent = 'Click an entry to navigate. Press Esc to close.';

    const nodeById = new Map();
    for (const n of nodes) {
      if (n && typeof n.id === 'number') nodeById.set(n.id, n);
    }

    const structuralKinds = new Set(['navigate', 'programmatic', 'reload']);
    const children = new Map();
    const incoming = new Map();

    for (const e of edges) {
      if (!e || !structuralKinds.has(e.kind)) continue;
      const fromId = e.fromId;
      const toId = e.toId;
      if (typeof fromId !== 'number' || typeof toId !== 'number') continue;
      if (!nodeById.has(fromId) || !nodeById.has(toId)) continue;
      if (!children.has(fromId)) children.set(fromId, []);
      children.get(fromId).push(toId);
      incoming.set(toId, (incoming.get(toId) || 0) + 1);
    }

    // Roots are nodes with no incoming structural edge.
    const roots = [];
    for (const n of nodes) {
      if (!n || typeof n.id !== 'number') continue;
      if (!incoming.get(n.id)) roots.push(n.id);
    }

    const getLastSeen = (id) => {
      const n = nodeById.get(id);
      return Number(n?.tsLastSeen) || Number(n?.tsCreated) || 0;
    };

    // Score roots by most recent activity in their subtree.
    const subtreeScoreCache = new Map();
    const computeSubtreeScore = (id, seen = new Set()) => {
      if (subtreeScoreCache.has(id)) return subtreeScoreCache.get(id);
      if (seen.has(id)) return getLastSeen(id);
      seen.add(id);
      let best = getLastSeen(id);
      const kids = children.get(id) || [];
      for (const k of kids) {
        best = Math.max(best, computeSubtreeScore(k, seen));
      }
      subtreeScoreCache.set(id, best);
      return best;
    };

    roots.sort((a, b) => computeSubtreeScore(b) - computeSubtreeScore(a));

    const rows = [];
    const visited = new Set();
    const walk = (id, depth) => {
      if (visited.has(id)) return;
      visited.add(id);
      rows.push({ id, depth: Math.min(depth, 12) });
      const kids = (children.get(id) || []).slice();
      kids.sort((a, b) => getLastSeen(b) - getLastSeen(a));
      for (const k of kids) walk(k, depth + 1);
    };

    for (const r of roots) walk(r, 0);

    // If graph has nodes not reachable via structural edges (rare), append them by recency.
    if (rows.length < nodeById.size) {
      const remaining = [];
      for (const id of nodeById.keys()) {
        if (!visited.has(id)) remaining.push(id);
      }
      remaining.sort((a, b) => getLastSeen(b) - getLastSeen(a));
      for (const id of remaining) rows.push({ id, depth: 0 });
    }

    /** @type {Array<{id: number, depth: number, node: any, branchCount: number}>} */
    const renderItems = [];
    for (const r of rows) {
      const n = nodeById.get(r.id);
      if (!n) continue;
      renderItems.push({
        id: r.id,
        depth: r.depth,
        node: n,
        branchCount: (children.get(r.id) || []).length
      });
    }

    const doRender = () => {
      renderUrlListing({
        container: this._tabList,
        items: renderItems,
        view: 'list',
        useInlineStyles: true,
        getTitle: (it) => (it.node?.title || it.node?.url || '').toString(),
        getUrl: (it) => String(it.node?.url || ''),
        showFavicon: true,
        showMetaLine: false,
        showUrlLine: true,
        isSelected: (it) => it.id === cursorId,
        onRowClick: async ({ item, event }) => {
          event.preventDefault();
          event.stopPropagation();
          const url = typeof item?.node?.url === 'string' ? item.node.url : '';
          if (!url) return;
          try {
            await chrome.runtime.sendMessage({ type: 'KP_NAVGRAPH_JUMP', url });
          } catch {
            // ignore
          }
          this.hide();
        },
        decorateRow: ({ row, item, idx, parts }) => {
          row.dataset.kpTabHistoryId = String(item.id);

          // Hover highlight (keep selected highlight stable).
          row.addEventListener('mouseenter', () => {
            row.style.background = item.id === cursorId ? 'rgba(255,140,0,0.2)' : 'rgba(255,255,255,0.06)';
          }, { passive: true });
          row.addEventListener('mouseleave', () => {
            row.style.background = item.id === cursorId ? 'rgba(255,140,0,0.18)' : 'rgba(0,0,0,0)';
          }, { passive: true });

          // Indent gutter + favicon.
          const gutter = document.createElement('div');
          Object.assign(gutter.style, {
            width: `${Math.max(0, item.depth) * 14}px`,
            flex: '0 0 auto'
          });

          if (parts.faviconEl) {
            parts.content.insertBefore(gutter, parts.faviconEl);
          } else {
            parts.content.insertBefore(gutter, parts.text);
          }

          // Branch badge (+N)
          const badge = document.createElement('div');
          if (item.branchCount > 1) {
            badge.textContent = `+${item.branchCount - 1}`;
            Object.assign(badge.style, {
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '999px',
              border: '1px solid rgba(255,140,0,0.35)',
              background: 'rgba(255,140,0,0.12)',
              color: 'rgba(255,140,0,0.92)',
              flex: '0 0 auto',
              fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
            });
            parts.content.appendChild(badge);
          }

          // Keep dataset index for debugging/consistency.
          row.dataset.kpUrlListingIndex = String(idx);
        }
      });
    };

    try {
      if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
        document.startViewTransition(() => doRender());
      } else {
        doRender();
      }
    } catch {
      doRender();
    }
  }

  _renderBrowserHistory(items) {
    if (!this._browserList) return;
    /** @type {Set<string>} */
    const seen = new Set();
    /** @type {Array<{url: string, title: string, lastVisitTime: number}>} */
    const deduped = [];
    for (const it of items) {
      const url = typeof it?.url === 'string' ? it.url.trim() : '';
      if (!url) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      deduped.push({
        url,
        title: (it?.title || url || '').toString(),
        lastVisitTime: Number(it?.lastVisitTime) || 0
      });
    }

    const doRender = () => {
      renderUrlListing({
        container: this._browserList,
        items: deduped,
        view: 'list',
        useInlineStyles: true,
        getTitle: (it) => it.title,
        getUrl: (it) => it.url,
        getMeta: (it) => {
          const when = it.lastVisitTime ? new Date(it.lastVisitTime).toLocaleString() : '';
          return when ? `${it.url} • ${when}` : it.url;
        },
        showFavicon: true,
        showMetaLine: true,
        showUrlLine: false,
        onRowClick: async ({ item, event }) => {
          event.preventDefault();
          event.stopPropagation();
          try {
            await chrome.runtime.sendMessage({ type: 'KP_NAVGRAPH_JUMP', url: item.url });
          } catch {
            try { window.location.assign(item.url); } catch { /* ignore */ }
          }
          this.hide();
        },
        decorateRow: ({ row }) => {
          row.addEventListener('mouseenter', () => {
            row.style.background = 'rgba(255,255,255,0.06)';
          }, { passive: true });
          row.addEventListener('mouseleave', () => {
            row.style.background = 'rgba(0,0,0,0)';
          }, { passive: true });
        }
      });
    };

    try {
      if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
        document.startViewTransition(() => doRender());
      } else {
        doRender();
      }
    } catch {
      doRender();
    }
  }
}


