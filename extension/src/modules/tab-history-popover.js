/**
 * TabHistoryPopover
 * - Renders a branching, per-tab navigation history (tracked by service worker).
 * - Full-width panel with two stacked horizontal card rails (Tab + Browser).
 * - Uses PopupManager to keep z-index below click overlays and to enable View Transitions.
 */
import {
  createUrlListingContainer,
  renderUrlListing,
  parseUrlForThreeLineDisplay
} from '../ui/url-listing.js';
import { applyCardBackground } from '../ui/page-thumb-ui.js';
import {
  NCT_DARK_UI_PANEL_RADIUS,
  NCT_DARK_UI_PANEL_BOX_SHADOW,
  NCT_DARK_UI_TITLEBAR_GRADIENT,
  NCT_DARK_UI_BTN_GRADIENT,
  NCT_DARK_UI_BTN_BORDER,
  NCT_DARK_UI_BTN_RADIUS,
  NCT_DARK_UI_COLORS
} from '../ui/nct-dark-ui.js';
import { ensureOpenChromeShadow, injectChromeStyles } from '../ui/kp-chrome-shadow.js';

/**
 * Visit stamp for history cards: time only when today; date + time otherwise.
 * @param {number|string|null|undefined} timestamp
 * @returns {string|null}
 */
function formatVisitDateTime(timestamp) {
  const n = Number(timestamp);
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    const d = new Date(n);
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    });
    if (isToday) return time;
    const sameYear = d.getFullYear() === now.getFullYear();
    const date = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' })
    });
    return `${date}, ${time}`;
  } catch {
    return null;
  }
}

/**
 * @param {{ url?: string, title?: string, lastVisitTime?: number }} item
 * @param {{
 *   titleEl: HTMLElement,
 *   metaEl: HTMLElement,
 *   urlEl: HTMLElement,
 *   text?: HTMLElement,
 *   visitedEl?: HTMLElement|null
 * }} parts
 */
function renderThreeLineUrlListingEntry({ item, parts }) {
  const url = String(item?.url || '').trim();
  const title = String(item?.title || '').trim();
  const { domain, path } = parseUrlForThreeLineDisplay(url);

  // Order requirement:
  // 1) domain
  // 2) page title
  // 3) path
  // 4) visit date/time (pinned to card bottom)
  parts.titleEl.textContent = domain || url || '';
  parts.metaEl.textContent = title;
  parts.urlEl.textContent = path;

  const visitedLabel = formatVisitDateTime(item?.lastVisitTime);
  let visitedEl = parts.visitedEl;
  if (!visitedEl && parts.text) {
    const doc = parts.text.ownerDocument || document;
    visitedEl = doc.createElement('div');
    visitedEl.className = 'kp-url-visited';
    parts.text.appendChild(visitedEl);
    parts.visitedEl = visitedEl;
  }
  if (visitedEl) {
    if (visitedLabel) {
      visitedEl.textContent = visitedLabel;
      visitedEl.hidden = false;
      visitedEl.removeAttribute('aria-hidden');
    } else {
      visitedEl.textContent = '';
      visitedEl.hidden = true;
      visitedEl.setAttribute('aria-hidden', 'true');
    }
  }
}

/**
 * Darkened page-preview background on history cards (same pattern as New Tab grid).
 * @param {HTMLElement} row
 * @param {string} url
 */
function attachPageThumbToHistoryCard(row, url) {
  const pageUrl = String(url || '').trim();
  if (!row || !pageUrl) return;
  applyCardBackground(row, pageUrl, {
    fallbackSolid: '',
    hoverSolid: '',
    manageHover: false,
    youtubePrefer: true,
    useCssVar: true,
    cssVarName: '--kp-page-thumb',
    readyClass: 'kp-has-page-thumb'
  });
}

/** Shared classNames for horizontal history card rails. */
const HISTORY_CARD_CLASS_NAMES = {
  row: 'kp-url-row',
  rowSelected: 'kp-url-row--selected',
  content: 'kp-url-content',
  text: 'kp-url-text',
  title: 'kp-url-domain',
  meta: 'kp-url-title',
  url: 'kp-url-path',
  favicon: 'kp-url-favicon'
};

export class TabHistoryPopover {
  /**
   * @param {object} opts
   * @param {import('./popup-manager.js').PopupManager} opts.popupManager
   * @param {(open: boolean) => void} [opts.onStateChange] - Called when popover opens/closes
   */
  constructor({ popupManager, onStateChange } = {}) {
    this.popupManager = popupManager || null;
    this._onStateChange = typeof onStateChange === 'function' ? onStateChange : null;
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
    this._injectStyles();
    // Full-width rails: disable free-form resize so layout stays intentional.
    this.popupManager.showModal({
      id: this._popupId,
      panel: this._panel,
      onRequestClose: () => this.hide(),
      resizable: false
    });

    // Notify that popover opened
    this._onStateChange?.(true);

    this._loadAndRender();
  }

  hide() {
    if (!this.popupManager) return;
    if (!this._open) return;
    this._open = false;

    // Notify that popover closed
    this._onStateChange?.(false);

    try {
      this.popupManager.hideModal(this._popupId);
    } catch {
      // ignore
    }
  }

  _injectStyles() {
    const css = `
      .kpv2-tab-history-panel {
        --kp-history-side-margin: 24px;
        --kp-history-card-w: 140px;
        box-sizing: border-box;
        position: fixed;
        left: 50%;
        top: 12vh;
        transform: translateX(-50%);
        width: calc(100vw - (2 * var(--kp-history-side-margin)));
        max-width: none;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
        border: 1px solid ${NCT_DARK_UI_COLORS.panelEdgeDark};
        background: ${NCT_DARK_UI_COLORS.panel};
        box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
        overflow: hidden;
        outline: none;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }

      .kpv2-tab-history-panel .kpv2-history-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255,140,0,0.14);
        background: ${NCT_DARK_UI_TITLEBAR_GRADIENT};
        flex: 0 0 auto;
      }

      .kpv2-tab-history-panel .kpv2-history-title-wrap {
        display: flex;
        align-items: baseline;
        gap: 10px;
        min-width: 0;
      }

      .kpv2-tab-history-panel .kpv2-history-title {
        font-size: 14px;
        font-weight: 700;
        color: rgba(255,255,255,0.92);
      }

      .kpv2-tab-history-panel .kpv2-history-subtitle {
        font-size: 12px;
        font-weight: 600;
        color: rgba(255,140,0,0.85);
        white-space: nowrap;
      }

      .kpv2-tab-history-panel .kpv2-history-close {
        margin: 0;
        appearance: none;
        -webkit-appearance: none;
        box-sizing: border-box;
        width: 34px;
        height: 34px;
        border-radius: ${NCT_DARK_UI_BTN_RADIUS};
        border: ${NCT_DARK_UI_BTN_BORDER};
        background: ${NCT_DARK_UI_BTN_GRADIENT};
        color: ${NCT_DARK_UI_COLORS.fg};
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
        flex: 0 0 auto;
        box-shadow: none;
        text-shadow: none;
        padding: 0;
      }

      .kpv2-tab-history-panel .kpv2-history-body {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
      }

      .kpv2-tab-history-panel .kpv2-history-section {
        display: flex;
        flex-direction: column;
        min-width: 0;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        overflow: hidden;
        background: rgba(0,0,0,0.18);
        flex: 0 0 auto;
      }

      .kpv2-tab-history-panel .kpv2-history-section-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        background: rgba(0,0,0,0.18);
      }

      .kpv2-tab-history-panel .kpv2-history-section-title {
        font-size: 13px;
        font-weight: 800;
        color: rgba(255,255,255,0.9);
      }

      .kpv2-tab-history-panel .kpv2-history-section-hint {
        font-size: 11px;
        font-weight: 600;
        color: rgba(255,255,255,0.55);
        white-space: nowrap;
      }

      .kpv2-tab-history-panel .kpv2-history-section-status {
        padding: 6px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        font-size: 12px;
        color: rgba(255,255,255,0.65);
      }

      /* Horizontal card rail */
      .kpv2-tab-history-panel .kpv2-history-rail {
        display: flex !important;
        flex-direction: row;
        flex-wrap: nowrap;
        align-items: stretch;
        gap: 10px;
        overflow-x: auto;
        overflow-y: hidden;
        padding: 10px 10px 12px;
        scroll-snap-type: x proximity;
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.2) rgba(0,0,0,0.1);
        min-height: calc(var(--kp-history-card-w) * 4 / 3 + 22px);
      }

      /* Vertical history cards */
      .kpv2-tab-history-panel .kp-url-row {
        box-sizing: border-box;
        display: block;
        position: relative;
        flex: 0 0 auto;
        width: var(--kp-history-card-w);
        aspect-ratio: 3 / 4;
        height: auto;
        padding: 12px 10px;
        border-radius: 12px;
        cursor: pointer;
        text-decoration: none;
        color: inherit;
        user-select: none;
        scroll-snap-align: start;
        background: linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 100%);
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 4px 12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15);
        margin: 0;
        min-width: 0;
        overflow: hidden;
        transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease, background 0.12s ease;
      }

      .kpv2-tab-history-panel .kp-url-row:hover {
        background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%);
        box-shadow: 0 8px 18px rgba(0,0,0,0.38), 0 3px 6px rgba(0,0,0,0.20);
        transform: translateY(-2px);
      }

      .kpv2-tab-history-panel .kp-url-row:focus-visible {
        outline: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15), 0 0 0 3px rgba(255,140,0,0.22);
        border-color: rgba(255,140,0,0.55);
      }

      .kpv2-tab-history-panel .kp-url-row--selected {
        background: linear-gradient(180deg, rgba(255,140,0,0.22) 0%, rgba(255,140,0,0.10) 100%);
        border-color: rgba(255,140,0,0.55);
        box-shadow: 0 4px 14px rgba(255,140,0,0.18), 0 2px 4px rgba(0,0,0,0.15);
      }

      .kpv2-tab-history-panel .kp-url-row--selected:hover {
        background: linear-gradient(180deg, rgba(255,140,0,0.28) 0%, rgba(255,140,0,0.12) 100%);
      }

      /*
       * Page thumbs paint via ::before so the media layer is full-bleed under the
       * 1px border (same pattern as New Tab cards).
       */
      .kpv2-tab-history-panel .kp-url-row.kp-has-page-thumb {
        background-color: #0a0a0a;
        background-image: none;
        border-color: rgba(255, 255, 255, 0.1);
        isolation: isolate;
      }

      .kpv2-tab-history-panel .kp-url-row.kp-has-page-thumb::before {
        content: "";
        position: absolute;
        inset: -1px;
        z-index: 0;
        pointer-events: none;
        border-radius: inherit;
        background-color: #0a0a0a;
        background-image:
          linear-gradient(to bottom, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.78) 100%),
          var(--kp-page-thumb);
        background-size: 100% 100%, cover;
        background-position: center, center;
        background-repeat: no-repeat, no-repeat;
      }

      .kpv2-tab-history-panel .kp-url-row.kp-has-page-thumb:hover {
        background-color: #0a0a0a;
        background-image: none;
      }

      .kpv2-tab-history-panel .kp-url-row.kp-has-page-thumb:hover::before {
        background-image:
          linear-gradient(to bottom, rgba(0, 0, 0, 0.32) 0%, rgba(0, 0, 0, 0.52) 100%),
          var(--kp-page-thumb);
      }

      .kpv2-tab-history-panel .kp-url-row.kp-has-page-thumb.kp-url-row--selected::before {
        background-image:
          linear-gradient(to bottom, rgba(255, 140, 0, 0.35) 0%, rgba(0, 0, 0, 0.72) 100%),
          var(--kp-page-thumb);
      }

      .kpv2-tab-history-panel .kp-url-row.kp-has-page-thumb.kp-url-row--selected:hover::before {
        background-image:
          linear-gradient(to bottom, rgba(255, 140, 0, 0.28) 0%, rgba(0, 0, 0, 0.55) 100%),
          var(--kp-page-thumb);
      }

      .kpv2-tab-history-panel .kp-url-row.kp-has-page-thumb > * {
        position: relative;
        z-index: 1;
      }

      .kpv2-tab-history-panel .kp-url-row.kp-has-page-thumb .kp-url-domain,
      .kpv2-tab-history-panel .kp-url-row.kp-has-page-thumb .kp-url-title,
      .kpv2-tab-history-panel .kp-url-row.kp-has-page-thumb .kp-url-path,
      .kpv2-tab-history-panel .kp-url-row.kp-has-page-thumb .kp-url-visited {
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
      }

      .kpv2-tab-history-panel .kp-url-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        min-width: 0;
        height: 100%;
      }

      .kpv2-tab-history-panel .kp-url-favicon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: rgba(255,255,255,0.08);
        flex: 0 0 auto;
      }

      .kpv2-tab-history-panel .kp-url-text {
        min-width: 0;
        width: 100%;
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: 3px;
        overflow: hidden;
      }

      .kpv2-tab-history-panel .kp-url-domain {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.15px;
        color: rgba(255, 200, 130, 0.92);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }

      .kpv2-tab-history-panel .kp-url-title {
        font-size: 12px;
        font-weight: 650;
        color: rgba(255,255,255,0.92);
        overflow: hidden;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        white-space: normal;
        word-break: break-word;
        max-width: 100%;
        line-height: 1.25;
      }

      .kpv2-tab-history-panel .kp-url-path {
        font-size: 10px;
        color: rgba(255,255,255,0.55);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }

      .kpv2-tab-history-panel .kp-url-visited {
        font-size: 10px;
        font-weight: 550;
        color: rgba(255,255,255,0.62);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
        margin-top: auto;
        padding-top: 4px;
        letter-spacing: 0.01em;
      }

      .kpv2-tab-history-panel .kp-url-branch-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 999px;
        border: 1px solid rgba(255,140,0,0.35);
        background: rgba(255,140,0,0.16);
        color: rgba(255,140,0,0.95);
        line-height: 1.2;
        pointer-events: none;
      }

      /* Scrollbars (vertical body + horizontal rails) */
      .kpv2-tab-history-panel ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .kpv2-tab-history-panel ::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.1);
      }
      .kpv2-tab-history-panel ::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }
      .kpv2-tab-history-panel ::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    `;
    const shadowRoot = this._panel?.shadowRoot || null;
    const localCss = shadowRoot
      ? css
        .replace('.kpv2-tab-history-panel {', ':host {')
        .replaceAll('.kpv2-tab-history-panel ', '')
      : css;
    injectChromeStyles(shadowRoot || document, {
      attr: 'data-kp-tab-history-styles',
      css: localCss
    });
  }

  _ensureDom() {
    if (this._panel && this._tabList && this._tabStatus && this._browserList && this._browserStatus) return;

    const doc = document;
    const panel = doc.createElement('div');
    panel.className = 'kpv2-tab-history-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'History');
    const shadowRoot = ensureOpenChromeShadow(panel, { id: 'tab-history' });
    const shell = shadowRoot || panel;

    const header = doc.createElement('div');
    header.className = 'kpv2-history-header';

    const titleWrap = doc.createElement('div');
    titleWrap.className = 'kpv2-history-title-wrap';

    const title = doc.createElement('div');
    title.className = 'kpv2-history-title';
    title.textContent = 'History';

    const subtitle = doc.createElement('div');
    subtitle.className = 'kpv2-history-subtitle';
    subtitle.textContent = 'Browser history · Tab history';

    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);

    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'kpv2-history-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
    }, true);

    header.appendChild(titleWrap);
    header.appendChild(closeBtn);

    const body = doc.createElement('div');
    body.className = 'kpv2-history-body';

    const makeSection = ({ titleText }) => {
      const section = doc.createElement('section');
      section.className = 'kpv2-history-section';

      const sectionHeader = doc.createElement('div');
      sectionHeader.className = 'kpv2-history-section-header';

      const sectionTitle = doc.createElement('div');
      sectionTitle.className = 'kpv2-history-section-title';
      sectionTitle.textContent = titleText;

      const sectionHint = doc.createElement('div');
      sectionHint.className = 'kpv2-history-section-hint';
      sectionHint.textContent = 'Click to navigate';

      sectionHeader.appendChild(sectionTitle);
      sectionHeader.appendChild(sectionHint);

      const sectionStatus = doc.createElement('div');
      sectionStatus.className = 'kpv2-history-section-status';
      sectionStatus.textContent = 'Loading…';

      const rail = createUrlListingContainer({
        doc,
        view: 'list',
        useInlineStyles: false,
        scrollY: false,
        className: 'kpv2-history-rail',
        style: {
          // Rail layout is owned by CSS; keep a minimal fallback if styles lag.
          display: 'flex',
          flexDirection: 'row',
          overflowX: 'auto',
          overflowY: 'hidden'
        }
      });
      rail.setAttribute('role', 'list');

      section.appendChild(sectionHeader);
      section.appendChild(sectionStatus);
      section.appendChild(rail);
      return { section, sectionStatus, rail };
    };

    const tabSection = makeSection({ titleText: 'Tab history' });
    const browserSection = makeSection({ titleText: 'Browser history' });

    shell.appendChild(header);
    // Browser history above Tab history
    body.appendChild(browserSection.section);
    body.appendChild(tabSection.section);
    shell.appendChild(body);

    this._panel = panel;
    this._tabStatus = tabSection.sectionStatus;
    this._tabList = tabSection.rail;
    this._browserStatus = browserSection.sectionStatus;
    this._browserList = browserSection.rail;
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
        useInlineStyles: false,
        classNames: HISTORY_CARD_CLASS_NAMES,
        rowTag: 'a',
        getTitle: (it) => (it.node?.title || it.node?.url || '').toString(),
        getUrl: (it) => String(it.node?.url || ''),
        showFavicon: true,
        showMetaLine: true,
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
          row.setAttribute('role', 'listitem');

          // Use three-line layout like newtab
          const visitTs =
            Number(item.node?.tsLastSeen) ||
            Number(item.node?.tsCreated) ||
            0;
          renderThreeLineUrlListingEntry({
            item: {
              url: item.node?.url,
              title: item.node?.title,
              lastVisitTime: visitTs
            },
            parts
          });
          attachPageThumbToHistoryCard(row, item.node?.url);

          // Branch badge (+N) — corner of card
          if (item.branchCount > 1) {
            const badge = document.createElement('div');
            badge.className = 'kp-url-branch-badge';
            badge.textContent = `+${item.branchCount - 1}`;
            badge.setAttribute('aria-label', `${item.branchCount - 1} more branches`);
            row.appendChild(badge);
          }

          // Keep dataset index for debugging/consistency.
          row.dataset.kpUrlListingIndex = String(idx);
        }
      });

      // Keep rail flex layout after renderUrlListing.
      if (this._tabList) {
        this._tabList.classList.add('kpv2-history-rail');
        // Scroll selected card into view when present.
        const selected = this._tabList.querySelector('.kp-url-row--selected');
        if (selected && typeof selected.scrollIntoView === 'function') {
          try {
            selected.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
          } catch {
            try { selected.scrollIntoView(); } catch { /* ignore */ }
          }
        }
      }
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
        useInlineStyles: false,
        classNames: HISTORY_CARD_CLASS_NAMES,
        rowTag: 'a',
        getTitle: (it) => it.title,
        getUrl: (it) => it.url,
        showFavicon: true,
        showMetaLine: true,
        showUrlLine: true,
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
        decorateRow: ({ row, item, parts }) => {
          row.setAttribute('role', 'listitem');
          renderThreeLineUrlListingEntry({ item, parts });
          attachPageThumbToHistoryCard(row, item.url);
        }
      });

      if (this._browserList) {
        this._browserList.classList.add('kpv2-history-rail');
      }
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
