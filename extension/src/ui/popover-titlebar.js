/**
 * Standard KeyPilot popover titlebar chrome.
 *
 * Used by modal iframe popovers (Settings, Guide, Open Popover) and preview
 * popovers so close buttons, title layout, and optional action slots stay uniform.
 *
 * Layout (left → right):
 *   [ title  · optional hint ]     [ actions… ]  [ × close ]
 */

const VARIANT_STYLES = {
  modal: {
    titlebar: `
      padding: 10px 14px;
      background: linear-gradient(180deg, #232323 0%, #151515 100%);
      border-bottom: 1px solid #2b2b2b;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
      min-height: 40px;
      box-sizing: border-box;
    `,
    title: `
      font-size: 14px;
      font-weight: 500;
      color: #e8e8e8;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex: 0 1 auto;
    `,
    hint: `
      color: #999;
      font-weight: normal;
      font-size: 12px;
      margin-left: 10px;
      flex-shrink: 0;
    `,
    close: `
      background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%);
      border: 1px solid #3a3a3a;
      font-size: 18px;
      cursor: pointer;
      color: #e8e8e8;
      padding: 2px 8px;
      line-height: 1;
      border-radius: 4px;
      flex-shrink: 0;
    `
  },
  preview: {
    titlebar: `
      padding: 6px 10px;
      background: linear-gradient(180deg, #232323 0%, #151515 100%);
      border-bottom: 1px solid #2b2b2b;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      min-height: 34px;
      box-sizing: border-box;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    `,
    title: `
      font-size: 12px;
      font-weight: 500;
      color: #e8e8e8;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex: 0 1 auto;
    `,
    hint: `
      color: #999;
      font-weight: normal;
      font-size: 12px;
      margin-left: 8px;
      flex-shrink: 0;
    `,
    close: `
      background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%);
      border: 1px solid #3a3a3a;
      font-size: 16px;
      cursor: pointer;
      color: #e8e8e8;
      padding: 2px 6px;
      line-height: 1;
      border-radius: 4px;
      flex-shrink: 0;
    `
  }
};

const KBD_STYLE = `
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 11px;
  padding: 1px 6px;
  border: 1px solid #3a3a3a;
  border-bottom-color: #2a2a2a;
  border-radius: 4px;
  background: linear-gradient(180deg, #2b2b2b 0%, #1a1a1a 100%);
  color: #f1f1f1;
`;

/**
 * Compact key chip for titlebar hints.
 * @param {Document} [doc]
 * @param {string} label
 * @returns {HTMLElement}
 */
export function createTitlebarKbd(doc = document, label = '') {
  const kbd = doc.createElement('kbd');
  kbd.style.cssText = KBD_STYLE;
  kbd.textContent = String(label || '');
  return kbd;
}

/**
 * Build a fragment: "Press" + kbd keys (joined by " / ") + optional trailing text.
 *
 * @param {object} opts
 * @param {Document} [opts.doc]
 * @param {string[]} [opts.keys]
 * @param {string} [opts.prefix='Press']
 * @param {string} [opts.suffix]
 * @param {boolean} [opts.useKbdChips=true]
 * @returns {DocumentFragment}
 */
export function createTitlebarCloseHint({
  doc = document,
  keys = ['Esc'],
  prefix = 'Press',
  suffix = '',
  useKbdChips = true
} = {}) {
  const frag = doc.createDocumentFragment();
  if (prefix) {
    frag.appendChild(doc.createTextNode(`${prefix} `));
  }
  const list = Array.isArray(keys) ? keys.filter((k) => k != null && String(k).length) : [];
  list.forEach((key, i) => {
    if (i > 0) frag.appendChild(doc.createTextNode(' / '));
    if (useKbdChips) {
      frag.appendChild(createTitlebarKbd(doc, String(key)));
    } else {
      frag.appendChild(doc.createTextNode(String(key)));
    }
  });
  if (suffix) {
    const needsSpace = !/^\s/.test(suffix);
    frag.appendChild(doc.createTextNode(needsSpace ? ` ${suffix}` : suffix));
  }
  return frag;
}

/**
 * @typedef {object} PopoverTitlebarConfig
 * @property {Document} [doc]
 * @property {string} [title]
 * @property {string|Node|null} [hint] - plain text, or a Node/DocumentFragment for rich hints
 * @property {boolean} [showClose=true]
 * @property {() => void} [onClose]
 * @property {string} [closeTitle='Close (Esc)']
 * @property {string} [closeLabel='×']
 * @property {HTMLElement|HTMLElement[]|null} [actions] - nodes placed before the close button
 * @property {'modal'|'preview'} [variant='modal']
 * @property {boolean} [draggable=false]
 * @property {string} [className='kpv2-popover-titlebar']
 * @property {string} [ariaLabel]
 * @property {string} [titleAttr] - HTML title attribute on the bar (e.g. "Drag to move")
 */

/**
 * Create a standard popover titlebar.
 *
 * @param {PopoverTitlebarConfig} [config]
 * @returns {{
 *   titlebar: HTMLElement,
 *   closeButton: HTMLButtonElement|null,
 *   titleEl: HTMLElement,
 *   hintEl: HTMLElement,
 *   titleContainer: HTMLElement,
 *   actionsSlot: HTMLElement,
 *   setTitle: (text: string) => void,
 *   setHint: (hint: string|Node|null|undefined) => void,
 *   getInteractiveElements: () => HTMLElement[]
 * }}
 */
export function createPopoverTitlebar(config = {}) {
  const doc = config.doc || document;
  const variant = config.variant === 'preview' ? 'preview' : 'modal';
  const styles = VARIANT_STYLES[variant];
  const showClose = config.showClose !== false;
  const className = typeof config.className === 'string' && config.className.trim()
    ? config.className.trim()
    : 'kpv2-popover-titlebar';

  const titlebar = doc.createElement('div');
  titlebar.className = className;
  titlebar.setAttribute('data-kp-popover-titlebar', 'true');
  titlebar.setAttribute('data-kp-titlebar-variant', variant);
  titlebar.style.cssText = styles.titlebar;

  if (config.draggable) {
    titlebar.style.cursor = 'grab';
  }
  if (config.titleAttr) {
    titlebar.title = config.titleAttr;
  }
  if (config.ariaLabel) {
    titlebar.setAttribute('aria-label', config.ariaLabel);
  }

  const titleContainer = doc.createElement('div');
  titleContainer.className = 'kpv2-popover-titlebar-title-wrap';
  titleContainer.style.cssText = `
    display: flex;
    align-items: baseline;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
    margin-right: 4px;
    ${config.draggable ? 'pointer-events: none;' : ''}
  `;

  const titleEl = doc.createElement('span');
  titleEl.className = 'kpv2-popover-titlebar-title';
  titleEl.style.cssText = styles.title;
  titleEl.textContent = typeof config.title === 'string' ? config.title : '';

  const hintEl = doc.createElement('span');
  hintEl.className = 'kpv2-popover-titlebar-hint';
  hintEl.style.cssText = styles.hint;

  titleContainer.appendChild(titleEl);
  titleContainer.appendChild(hintEl);
  titlebar.appendChild(titleContainer);

  const actionsSlot = doc.createElement('div');
  actionsSlot.className = 'kpv2-popover-titlebar-actions';
  actionsSlot.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  `;

  const actionNodes = [];
  if (Array.isArray(config.actions)) {
    for (const node of config.actions) {
      if (node) {
        actionsSlot.appendChild(node);
        actionNodes.push(node);
      }
    }
  } else if (config.actions) {
    actionsSlot.appendChild(config.actions);
    actionNodes.push(config.actions);
  }

  if (actionsSlot.childNodes.length > 0) {
    titlebar.appendChild(actionsSlot);
  }

  /** @type {HTMLButtonElement|null} */
  let closeButton = null;
  if (showClose) {
    closeButton = doc.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'kpv2-popover-titlebar-close';
    closeButton.style.cssText = styles.close;
    closeButton.textContent = config.closeLabel != null ? String(config.closeLabel) : '×';
    closeButton.title = config.closeTitle || 'Close (Esc)';
    closeButton.setAttribute('aria-label', config.closeTitle || 'Close (Esc)');
    closeButton.addEventListener('click', (e) => {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch { /* ignore */ }
      try {
        config.onClose?.();
      } catch { /* ignore */ }
    });
    titlebar.appendChild(closeButton);
  }

  const setHint = (hint) => {
    while (hintEl.firstChild) hintEl.removeChild(hintEl.firstChild);
    if (hint == null || hint === '') {
      hintEl.style.display = 'none';
      return;
    }
    hintEl.style.display = '';
    if (typeof hint === 'string') {
      hintEl.textContent = hint;
    } else if (hint instanceof Node) {
      hintEl.appendChild(hint);
    } else {
      hintEl.textContent = String(hint);
    }
  };

  const setTitle = (text) => {
    titleEl.textContent = text != null ? String(text) : '';
  };

  setHint(config.hint);

  const getInteractiveElements = () => {
    const els = [];
    if (closeButton) els.push(closeButton);
    for (const node of actionNodes) {
      if (!node) continue;
      if (node.matches?.('button, a, input, select, textarea, [role="button"]')) {
        els.push(node);
      } else if (typeof node.querySelectorAll === 'function') {
        node.querySelectorAll('button, a, input, select, textarea, [role="button"]').forEach((el) => {
          els.push(el);
        });
      }
    }
    return els;
  };

  return {
    titlebar,
    closeButton,
    titleEl,
    hintEl,
    titleContainer,
    actionsSlot,
    setTitle,
    setHint,
    getInteractiveElements
  };
}
