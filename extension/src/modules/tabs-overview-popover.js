/**
 * TabsOverviewPopover
 * Grid of browser windows; each window lists its tabs.
 * Key-click a tab to activate it. Key-click a window header to focus that window.
 */
import { getMessage } from '../utils/i18n.js';
import { createFaviconImg } from '../ui/url-listing.js';
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
import { MSG } from '../messaging/types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
let shadeSeq = 0;

/**
 * @param {Document} doc
 * @param {string} name
 * @param {Record<string, string>} attrs
 * @returns {SVGElement}
 */
function svgEl(doc, name, attrs) {
  const node = doc.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

/**
 * Dark GUI Pro vertical bevel. Each glyph owns its gradient so the fill
 * resolves inside that SVG.
 * @param {Document} doc
 * @param {string} id
 * @param {Array<[string, string]>} stops
 * @returns {SVGElement}
 */
function shadeGradient(doc, id, stops) {
  const grad = svgEl(doc, 'linearGradient', {
    id,
    x1: '0',
    y1: '0',
    x2: '0',
    y2: '1'
  });
  for (const [offset, color] of stops) {
    grad.append(svgEl(doc, 'stop', { offset, 'stop-color': color }));
  }
  return grad;
}

/** @returns {{ body: string, bar: string, defs: SVGElement }} */
function shadeIds(doc) {
  const n = ++shadeSeq;
  const bodyId = `kpTabsOverviewShade${n}`;
  const barId = `kpTabsOverviewShadeBar${n}`;
  const defs = svgEl(doc, 'defs', {});
  defs.append(
    shadeGradient(doc, bodyId, [
      ['0', '#4c4c4c'],
      ['0.45', '#353535'],
      ['1', '#252525']
    ]),
    shadeGradient(doc, barId, [
      ['0', '#5a5a5a'],
      ['0.5', '#404040'],
      ['1', '#323232']
    ])
  );
  return { body: `url(#${bodyId})`, bar: `url(#${barId})`, defs };
}

/**
 * @param {Document} doc
 * @returns {SVGElement}
 */
function windowIcon(doc) {
  const shade = shadeIds(doc);
  const svg = svgEl(doc, 'svg', {
    class: 'kpv2-tabs-overview-window-icon',
    viewBox: '0 0 16 16',
    'aria-hidden': 'true'
  });
  svg.append(shade.defs);
  svg.append(svgEl(doc, 'rect', {
    x: '1.15',
    y: '2.15',
    width: '13.7',
    height: '11.7',
    rx: '1.6',
    fill: shade.body,
    stroke: '#111',
    'stroke-width': '0.85'
  }));
  svg.append(svgEl(doc, 'path', {
    d: 'M1.15 3.75c0-.88.72-1.6 1.6-1.6h10.5c.88 0 1.6.72 1.6 1.6V6.05H1.15V3.75z',
    fill: shade.bar,
    stroke: '#111',
    'stroke-width': '0.85'
  }));
  return svg;
}

/**
 * Browser-tab silhouette: low shoulder, raised tab, low shoulder.
 * @param {Document} doc
 * @returns {SVGElement}
 */
function tabIcon(doc) {
  const shade = shadeIds(doc);
  const svg = svgEl(doc, 'svg', {
    class: 'kpv2-tabs-overview-tab-glyph',
    viewBox: '0 0 26 14',
    'aria-hidden': 'true'
  });
  svg.append(shade.defs);
  svg.append(svgEl(doc, 'path', {
    d: 'M0.7 12.55H5.15Q6.35 12.55 7.45 8.15Q8.45 4.15 10.35 4.15H15.65Q17.55 4.15 18.55 8.15Q19.65 12.55 20.85 12.55H25.3V13.4H0.7Z',
    fill: shade.body,
    stroke: '#111',
    'stroke-width': '0.85',
    'stroke-linejoin': 'round'
  }));
  return svg;
}

/**
 * @param {string} url
 * @returns {string}
 */
function hostLabel(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).hostname.replace(/^www\./i, '');
  } catch {
    return raw;
  }
}

/**
 * @param {number} count
 * @returns {string}
 */
function tabCountLabel(count) {
  const n = Number(count) || 0;
  if (n === 1) return getMessage('tabs_overview_tab_count_one');
  return getMessage('tabs_overview_tab_count', String(n));
}

export class TabsOverviewPopover {
  /**
   * @param {object} opts
   * @param {import('./popup-manager.js').PopupManager} opts.popupManager
   * @param {(open: boolean) => void} [opts.onStateChange]
   */
  constructor({ popupManager, onStateChange } = {}) {
    this.popupManager = popupManager || null;
    this._onStateChange = typeof onStateChange === 'function' ? onStateChange : null;
    this._popupId = 'kpv2-tabs-overview-popover';

    /** @type {HTMLElement|null} */
    this._panel = null;
    /** @type {HTMLElement|null} */
    this._grid = null;
    /** @type {HTMLElement|null} */
    this._status = null;

    this._open = false;
    this._loadToken = 0;
    this._currentWindowId = null;
    this._currentTabId = null;
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
    this.popupManager.showModal({
      id: this._popupId,
      panel: this._panel,
      onRequestClose: () => this.hide(),
      resizable: false
    });

    this._onStateChange?.(true);
    void this._loadAndRender();
  }

  hide() {
    if (!this.popupManager) return;
    if (!this._open) return;
    this._open = false;
    this._loadToken += 1;
    this._onStateChange?.(false);
    try {
      this.popupManager.hideModal(this._popupId);
    } catch {
      // ignore
    }
  }

  _injectStyles() {
    const css = `
      .kpv2-tabs-overview-panel {
        box-sizing: border-box;
        position: fixed;
        left: 50%;
        top: 8vh;
        transform: translateX(-50%);
        width: min(1120px, calc(100vw - 48px));
        max-height: 84vh;
        display: flex;
        flex-direction: column;
        border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
        border: 1px solid ${NCT_DARK_UI_COLORS.panelEdgeDark};
        background: ${NCT_DARK_UI_COLORS.panel};
        box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
        overflow: hidden;
        outline: none;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        color: rgba(255,255,255,0.92);
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255,140,0,0.14);
        background: ${NCT_DARK_UI_TITLEBAR_GRADIENT};
        flex: 0 0 auto;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-title-wrap {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-title {
        font-size: 14px;
        font-weight: 700;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-subtitle {
        font-size: 12px;
        font-weight: 600;
        color: rgba(255,140,0,0.85);
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-close {
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
        padding: 0;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        padding: 12px;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-status {
        padding: 8px 4px 12px;
        font-size: 13px;
        color: rgba(255,255,255,0.72);
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 12px;
        align-items: start;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-window {
        display: flex;
        flex-direction: column;
        min-width: 0;
        max-height: 420px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(0,0,0,0.22);
        overflow: hidden;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-window--current {
        border-color: rgba(255,140,0,0.55);
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-window-header {
        margin: 0;
        appearance: none;
        -webkit-appearance: none;
        box-sizing: border-box;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 12px;
        border: 0;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.04);
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-window-header:hover,
      .kpv2-tabs-overview-panel .kpv2-tabs-overview-window-header:focus-visible {
        background: rgba(255,140,0,0.16);
        outline: none;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-window-title {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1 1 auto;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-window-icon {
        width: 16px;
        height: 16px;
        flex: 0 0 auto;
        display: block;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-window-name {
        font-size: 13px;
        font-weight: 700;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-window-meta {
        flex: 0 0 auto;
        font-size: 11px;
        font-weight: 600;
        color: rgba(255,255,255,0.62);
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-list {
        overflow: auto;
        min-height: 0;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-tab {
        margin: 0;
        appearance: none;
        -webkit-appearance: none;
        box-sizing: border-box;
        width: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border: 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-tab:hover,
      .kpv2-tabs-overview-panel .kpv2-tabs-overview-tab:focus-visible {
        background: rgba(255,255,255,0.06);
        outline: none;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-tab--active {
        background: rgba(255,140,0,0.12);
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-tab--current {
        background: rgba(255,140,0,0.22);
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-favicon {
        width: 16px;
        height: 16px;
        flex: 0 0 auto;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-tab-text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-tab-title-row {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-tab-title {
        font-size: 13px;
        font-weight: 600;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-tab-glyph {
        width: 22px;
        height: 12px;
        flex: 0 0 auto;
        display: block;
      }

      .kpv2-tabs-overview-panel .kpv2-tabs-overview-tab-url {
        font-size: 11px;
        color: rgba(255,255,255,0.55);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;
    const shadowRoot = this._panel?.shadowRoot || null;
    const localCss = shadowRoot
      ? css
        .replace('.kpv2-tabs-overview-panel {', ':host {')
        .replaceAll('.kpv2-tabs-overview-panel ', '')
      : css;
    injectChromeStyles(shadowRoot || document, {
      attr: 'data-kp-tabs-overview-styles',
      css: localCss
    });
  }

  _ensureDom() {
    if (this._panel && this._grid && this._status) return;

    const doc = document;
    const panel = doc.createElement('div');
    panel.className = 'kpv2-tabs-overview-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', getMessage('tabs_overview_title'));
    const shadowRoot = ensureOpenChromeShadow(panel, { id: 'tabs-overview' });
    const shell = shadowRoot || panel;

    const header = doc.createElement('div');
    header.className = 'kpv2-tabs-overview-header';

    const titleWrap = doc.createElement('div');
    titleWrap.className = 'kpv2-tabs-overview-title-wrap';

    const title = doc.createElement('div');
    title.className = 'kpv2-tabs-overview-title';
    title.textContent = getMessage('tabs_overview_title');

    const subtitle = doc.createElement('div');
    subtitle.className = 'kpv2-tabs-overview-subtitle';
    subtitle.textContent = getMessage('tabs_overview_hint');

    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);

    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'kpv2-tabs-overview-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', getMessage('overlay_close'));
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
    }, true);

    header.appendChild(titleWrap);
    header.appendChild(closeBtn);

    const body = doc.createElement('div');
    body.className = 'kpv2-tabs-overview-body';

    const status = doc.createElement('div');
    status.className = 'kpv2-tabs-overview-status';
    status.textContent = getMessage('tabs_overview_loading');

    const grid = doc.createElement('div');
    grid.className = 'kpv2-tabs-overview-grid';

    body.appendChild(status);
    body.appendChild(grid);
    shell.appendChild(header);
    shell.appendChild(body);

    this._panel = panel;
    this._status = status;
    this._grid = grid;
  }

  async _loadAndRender() {
    const token = ++this._loadToken;
    if (this._status) {
      this._status.hidden = false;
      this._status.textContent = getMessage('tabs_overview_loading');
    }
    if (this._grid) this._grid.replaceChildren();

    let resp = null;
    try {
      resp = await chrome.runtime.sendMessage({ type: MSG.TABS_OVERVIEW_GET });
    } catch {
      resp = null;
    }
    if (!this._open || token !== this._loadToken) return;

    if (!resp || resp.type !== MSG.TABS_OVERVIEW_RESULT || !Array.isArray(resp.windows)) {
      if (this._status) this._status.textContent = getMessage('tabs_overview_unavailable');
      return;
    }

    this._currentWindowId = Number.isFinite(resp.currentWindowId) ? resp.currentWindowId : null;
    this._currentTabId = Number.isFinite(resp.currentTabId) ? resp.currentTabId : null;
    this._render(resp.windows);
  }

  /**
   * @param {Array<{ id: number, tabs: any[] }>} windows
   */
  _render(windows) {
    if (!this._grid || !this._status) return;

    const currentWindowId = this._currentWindowId;
    const ordered = windows.slice().sort((a, b) => {
      const aCurrent = a?.id === currentWindowId;
      const bCurrent = b?.id === currentWindowId;
      if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
      return (Number(a?.id) || 0) - (Number(b?.id) || 0);
    });

    this._grid.replaceChildren();
    if (!ordered.length) {
      this._status.hidden = false;
      this._status.textContent = getMessage('tabs_overview_empty');
      return;
    }
    this._status.hidden = true;
    this._status.textContent = '';

    const doc = this._grid.ownerDocument || document;
    /** @type {HTMLElement|null} */
    let currentRow = null;

    ordered.forEach((win, index) => {
      const isCurrentWindow = win?.id === currentWindowId;
      const card = doc.createElement('section');
      card.className = 'kpv2-tabs-overview-window';
      if (isCurrentWindow) card.classList.add('kpv2-tabs-overview-window--current');

      const name = isCurrentWindow
        ? getMessage('tabs_overview_this_window')
        : getMessage('tabs_overview_window', String(index + 1));
      const tabs = Array.isArray(win?.tabs) ? win.tabs : [];

      const headerBtn = doc.createElement('button');
      headerBtn.type = 'button';
      headerBtn.className = 'kpv2-tabs-overview-window-header';
      headerBtn.setAttribute('aria-label', `${name}. ${getMessage('tabs_overview_focus_window')}`);

      const titleCluster = doc.createElement('span');
      titleCluster.className = 'kpv2-tabs-overview-window-title';

      const nameEl = doc.createElement('span');
      nameEl.className = 'kpv2-tabs-overview-window-name';
      nameEl.textContent = name;

      titleCluster.append(windowIcon(doc), nameEl);

      const metaEl = doc.createElement('span');
      metaEl.className = 'kpv2-tabs-overview-window-meta';
      metaEl.textContent = tabCountLabel(tabs.length);

      headerBtn.append(titleCluster, metaEl);
      headerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void this._focusWindow(win);
      }, true);

      const list = doc.createElement('div');
      list.className = 'kpv2-tabs-overview-list';
      list.setAttribute('role', 'list');

      for (const tab of tabs) {
        const isCurrentTab = isCurrentWindow && tab?.id === this._currentTabId;
        const row = doc.createElement('button');
        row.type = 'button';
        row.className = 'kpv2-tabs-overview-tab';
        row.setAttribute('role', 'listitem');
        if (tab?.active) row.classList.add('kpv2-tabs-overview-tab--active');
        if (isCurrentTab) row.classList.add('kpv2-tabs-overview-tab--current');

        const title = String(tab?.title || '').trim() || getMessage('tabs_overview_untitled');
        const url = String(tab?.url || '').trim();
        const host = hostLabel(url);
        row.setAttribute('aria-label', host ? `${title}, ${host}` : title);

        const icon = createFaviconImg(doc, url, {
          size: 16,
          faviconUrl: typeof tab?.favIconUrl === 'string' ? tab.favIconUrl : ''
        });
        icon.className = 'kpv2-tabs-overview-favicon';

        const text = doc.createElement('span');
        text.className = 'kpv2-tabs-overview-tab-text';

        const titleRow = doc.createElement('span');
        titleRow.className = 'kpv2-tabs-overview-tab-title-row';

        const titleEl = doc.createElement('span');
        titleEl.className = 'kpv2-tabs-overview-tab-title';
        titleEl.textContent = title;

        titleRow.append(titleEl, tabIcon(doc));

        const urlEl = doc.createElement('span');
        urlEl.className = 'kpv2-tabs-overview-tab-url';
        urlEl.textContent = host || url;

        text.appendChild(titleRow);
        if (urlEl.textContent) text.appendChild(urlEl);
        row.appendChild(icon);
        row.appendChild(text);
        row.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          void this._activateTab(win, tab);
        }, true);

        list.appendChild(row);
        if (isCurrentTab) currentRow = row;
      }

      card.appendChild(headerBtn);
      card.appendChild(list);
      this._grid.appendChild(card);
    });

    if (currentRow && typeof currentRow.scrollIntoView === 'function') {
      try {
        currentRow.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } catch {
        try { currentRow.scrollIntoView(); } catch { /* ignore */ }
      }
    }
  }

  /**
   * @param {{ id?: number }} win
   */
  async _focusWindow(win) {
    const windowId = Number(win?.id);
    const alreadyHere = windowId === this._currentWindowId;
    this.hide();
    if (!Number.isFinite(windowId) || alreadyHere) return;
    try {
      await chrome.runtime.sendMessage({ type: MSG.FOCUS_WINDOW, windowId });
    } catch {
      // ignore
    }
  }

  /**
   * @param {{ id?: number }} win
   * @param {{ id?: number }} tab
   */
  async _activateTab(win, tab) {
    const windowId = Number(win?.id);
    const tabId = Number(tab?.id);
    const alreadyHere = tabId === this._currentTabId && windowId === this._currentWindowId;
    this.hide();
    if (!Number.isFinite(tabId) || alreadyHere) return;
    try {
      await chrome.runtime.sendMessage({
        type: MSG.ACTIVATE_TAB,
        tabId,
        ...(Number.isFinite(windowId) ? { windowId } : {})
      });
    } catch {
      // ignore
    }
  }
}
