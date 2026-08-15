/**
 * Generic hierarchical (group / leaf) table for KeyPilot panels.
 *
 * Used by:
 * - Actions Library (keyboard layout config)
 * - Page Media URLs tab
 *
 * DOM-only (TrustedHTML-safe). Class prefix: kp-hier-*.
 */

/**
 * @typedef {object} HierarchicalTableColumn
 * @property {string} key
 * @property {string} label
 * @property {string} [className] - optional <col> class
 * @property {string} [width] - CSS width for <col>
 */

/**
 * @typedef {object} HierarchicalTableClassNames
 * @property {string} [wrap]
 * @property {string} [table]
 * @property {string} [rowGroup]
 * @property {string} [rowLeaf]
 * @property {string} [twisty]
 * @property {string} [labelCell]
 * @property {string} [labelText]
 */

/**
 * @typedef {string|Node|null|undefined} HierarchicalTableCellContent
 */

const DEFAULT_CLASS_NAMES = Object.freeze({
  wrap: 'kp-hier-table-wrap',
  table: 'kp-hier-table',
  rowGroup: 'kp-hier-row-group',
  rowLeaf: 'kp-hier-row-leaf',
  twisty: 'kp-hier-twisty',
  labelCell: 'kp-hier-label-cell',
  labelText: 'kp-hier-label-text'
});

/**
 * Base CSS for hierarchical tables. Pass `rootSelector` to scope under a host
 * (e.g. `.kp-layout-config-panel` or `.kpv2-page-media-overlay`).
 * @param {{ rootSelector?: string }} [opts]
 * @returns {string}
 */
export function getHierarchicalTableCss(opts = {}) {
  const root = typeof opts.rootSelector === 'string' && opts.rootSelector.trim()
    ? opts.rootSelector.trim()
    : '';
  const p = root ? `${root} ` : '';
  return `
${p}.kp-hier-table-wrap {
  width: 100%;
  overflow: auto;
  border: 1px solid rgba(120, 140, 100, 0.12);
  border-radius: 2px;
  background: rgba(8, 10, 8, 0.35);
}
${p}.kp-hier-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  table-layout: fixed;
}
${p}.kp-hier-table th {
  text-align: left;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #8a9a78;
  padding: 6px 8px;
  border-bottom: 1px solid rgba(120, 140, 100, 0.18);
  background: #121410;
  position: sticky;
  top: 0;
  z-index: 1;
}
${p}.kp-hier-table td {
  padding: 5px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  vertical-align: middle;
  color: #c8d4e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
${p}.kp-hier-table tr.kp-hier-row-group {
  background: rgba(255,255,255,0.03);
  cursor: pointer;
}
${p}.kp-hier-table tr.kp-hier-row-group td {
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #9a8aaa;
}
${p}.kp-hier-table tr.kp-hier-row-leaf:hover {
  background: rgba(74, 144, 200, 0.12);
}
${p}.kp-hier-twisty {
  appearance: none;
  width: 18px;
  height: 18px;
  padding: 0;
  margin: 0 4px 0 0;
  border: 0;
  background: transparent;
  color: #9aacbe;
  cursor: pointer;
  font-size: 10px;
  line-height: 18px;
  flex: 0 0 auto;
}
${p}.kp-hier-label-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
${p}.kp-hier-label-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
`.trim();
}

/**
 * @param {HierarchicalTableClassNames} [overrides]
 * @returns {Required<HierarchicalTableClassNames>}
 */
function resolveClassNames(overrides = {}) {
  return {
    wrap: overrides.wrap || DEFAULT_CLASS_NAMES.wrap,
    table: overrides.table || DEFAULT_CLASS_NAMES.table,
    rowGroup: overrides.rowGroup || DEFAULT_CLASS_NAMES.rowGroup,
    rowLeaf: overrides.rowLeaf || DEFAULT_CLASS_NAMES.rowLeaf,
    twisty: overrides.twisty || DEFAULT_CLASS_NAMES.twisty,
    labelCell: overrides.labelCell || DEFAULT_CLASS_NAMES.labelCell,
    labelText: overrides.labelText || DEFAULT_CLASS_NAMES.labelText
  };
}

/**
 * @param {Document} doc
 * @param {HTMLElement} cell
 * @param {HierarchicalTableCellContent} content
 */
function fillCell(doc, cell, content) {
  if (content == null || content === '') {
    cell.textContent = '';
    return;
  }
  if (typeof content === 'string' || typeof content === 'number') {
    cell.textContent = String(content);
    return;
  }
  if (content instanceof Node) {
    cell.appendChild(content);
    return;
  }
  cell.textContent = String(content);
}

/**
 * Indent + optional leading control + label text cell contents.
 * @param {{
 *   doc?: Document,
 *   depth?: number,
 *   indentPx?: number,
 *   leading?: HTMLElement|null,
 *   text?: string,
 *   classNames?: HierarchicalTableClassNames
 * }} [opts]
 * @returns {HTMLElement}
 */
export function createHierarchicalLabelCell(opts = {}) {
  const doc = opts.doc || document;
  const cn = resolveClassNames(opts.classNames);
  const depth = Math.max(0, Number(opts.depth) || 0);
  const indentPx = Number.isFinite(opts.indentPx) ? Number(opts.indentPx) : 14;

  const cell = doc.createElement('div');
  cell.className = cn.labelCell;
  cell.style.paddingLeft = `${depth * indentPx}px`;

  if (opts.leading instanceof HTMLElement) {
    cell.appendChild(opts.leading);
  }

  const text = doc.createElement('span');
  text.className = cn.labelText;
  text.textContent = opts.text != null ? String(opts.text) : '';
  cell.appendChild(text);
  return cell;
}

/**
 * @typedef {object} CreateHierarchicalTableConfig
 * @property {Document} [doc]
 * @property {HierarchicalTableColumn[]} columns
 * @property {string} [ariaLabel]
 * @property {string} [wrapClassName] - extra classes on wrap
 * @property {string} [tableClassName] - extra classes on table
 * @property {HierarchicalTableClassNames} [classNames]
 * @property {number} [indentPx]
 * @property {(groupKey: string) => boolean} [isGroupExpanded]
 * @property {(groupKey: string) => void} [onToggleGroup]
 */

/**
 * Build an empty hierarchical table shell and row helpers.
 * Caller fills rows via appendGroupRow / appendLeafRow / appendHintRow, then
 * appends `root` into the DOM.
 *
 * @param {CreateHierarchicalTableConfig} [config]
 * @returns {{
 *   root: HTMLElement,
 *   wrap: HTMLElement,
 *   table: HTMLTableElement,
 *   thead: HTMLTableSectionElement,
 *   tbody: HTMLTableSectionElement,
 *   columns: HierarchicalTableColumn[],
 *   createLabelCell: (opts?: {
 *     depth?: number,
 *     leading?: HTMLElement|null,
 *     text?: string
 *   }) => HTMLElement,
 *   appendGroupRow: (opts: {
 *     groupKey: string,
 *     label: string,
 *     depth?: number,
 *     count?: number,
 *     cells?: HierarchicalTableCellContent[],
 *     trailing?: HTMLElement|null,
 *     className?: string,
 *     dataset?: Record<string, string>
 *   }) => boolean,
 *   appendLeafRow: (opts: {
 *     cells: HierarchicalTableCellContent[],
 *     depth?: number,
 *     className?: string,
 *     dataset?: Record<string, string>,
 *     title?: string,
 *     onClick?: (e: MouseEvent) => void
 *   }) => HTMLTableRowElement,
 *   appendHintRow: (text: string, depth?: number) => HTMLTableRowElement
 * }}
 */
export function createHierarchicalTable(config = {}) {
  const doc = config.doc || document;
  const columns = Array.isArray(config.columns) ? config.columns.filter(Boolean) : [];
  if (!columns.length) {
    throw new Error('createHierarchicalTable: columns required');
  }
  const cn = resolveClassNames(config.classNames);
  const indentPx = Number.isFinite(config.indentPx) ? Number(config.indentPx) : 14;
  const isGroupExpanded = typeof config.isGroupExpanded === 'function'
    ? config.isGroupExpanded
    : () => true;
  const onToggleGroup = typeof config.onToggleGroup === 'function'
    ? config.onToggleGroup
    : () => {};

  const wrap = doc.createElement('div');
  wrap.className = [cn.wrap, config.wrapClassName].filter(Boolean).join(' ');

  const table = doc.createElement('table');
  table.className = [cn.table, config.tableClassName].filter(Boolean).join(' ');
  if (config.ariaLabel) table.setAttribute('aria-label', config.ariaLabel);

  const colgroup = doc.createElement('colgroup');
  for (const col of columns) {
    const el = doc.createElement('col');
    if (col.className) el.className = col.className;
    if (col.width) el.style.width = String(col.width);
    colgroup.appendChild(el);
  }
  table.appendChild(colgroup);

  const thead = doc.createElement('thead');
  const hr = doc.createElement('tr');
  for (const col of columns) {
    const th = doc.createElement('th');
    th.textContent = col.label != null ? String(col.label) : '';
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = doc.createElement('tbody');
  table.appendChild(tbody);
  wrap.appendChild(table);

  /**
   * @param {{ depth?: number, leading?: HTMLElement|null, text?: string }} [opts]
   */
  const createLabelCell = (opts = {}) => createHierarchicalLabelCell({
    doc,
    depth: opts.depth,
    indentPx,
    leading: opts.leading,
    text: opts.text,
    classNames: cn
  });

  /**
   * @param {{
   *   groupKey: string,
   *   label: string,
   *   depth?: number,
   *   count?: number,
   *   cells?: HierarchicalTableCellContent[],
   *   trailing?: HTMLElement|null,
   *   className?: string,
   *   dataset?: Record<string, string>
   * }} opts
   * @returns {boolean} whether the group is expanded
   */
  const appendGroupRow = (opts) => {
    const groupKey = String(opts.groupKey || '');
    const label = opts.label != null ? String(opts.label) : '';
    const depth = Math.max(0, Number(opts.depth) || 0);
    const count = Number(opts.count) || 0;
    const expanded = !!isGroupExpanded(groupKey);

    const tr = doc.createElement('tr');
    tr.className = [cn.rowGroup, opts.className].filter(Boolean).join(' ');
    tr.dataset.kpGroupKey = groupKey;
    if (opts.dataset) {
      for (const [k, v] of Object.entries(opts.dataset)) {
        if (v != null) tr.dataset[k] = String(v);
      }
    }

    const tdLabel = doc.createElement('td');
    const twisty = doc.createElement('button');
    twisty.type = 'button';
    twisty.className = cn.twisty;
    twisty.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    twisty.setAttribute('aria-label', expanded ? `Collapse ${label}` : `Expand ${label}`);
    twisty.textContent = expanded ? '▾' : '▸';
    twisty.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onToggleGroup(groupKey);
    }, true);

    tdLabel.appendChild(createLabelCell({
      depth,
      leading: twisty,
      text: count > 0 ? `${label} (${count})` : label
    }));
    tr.appendChild(tdLabel);

    const extra = Array.isArray(opts.cells) ? opts.cells : [];
    for (let i = 1; i < columns.length; i++) {
      const td = doc.createElement('td');
      const isLast = i === columns.length - 1;
      if (isLast && opts.trailing instanceof HTMLElement) {
        td.appendChild(opts.trailing);
      } else {
        fillCell(doc, td, extra[i - 1]);
      }
      tr.appendChild(td);
    }

    tr.addEventListener('click', (e) => {
      if (e.target?.closest?.('button, a, input, select, textarea')) return;
      onToggleGroup(groupKey);
    }, true);

    tbody.appendChild(tr);
    return expanded;
  };

  /**
   * @param {{
   *   cells: HierarchicalTableCellContent[],
   *   depth?: number,
   *   className?: string,
   *   dataset?: Record<string, string>,
   *   title?: string,
   *   onClick?: (e: MouseEvent) => void
   * }} opts
   */
  const appendLeafRow = (opts) => {
    const tr = doc.createElement('tr');
    tr.className = [cn.rowLeaf, opts.className].filter(Boolean).join(' ');
    if (opts.title) tr.title = String(opts.title);
    if (opts.dataset) {
      for (const [k, v] of Object.entries(opts.dataset)) {
        if (v != null) tr.dataset[k] = String(v);
      }
    }

    const cells = Array.isArray(opts.cells) ? opts.cells : [];
    const depth = opts.depth;
    for (let i = 0; i < columns.length; i++) {
      const td = doc.createElement('td');
      let content = cells[i];
      // Plain first-column strings get indented label chrome when depth is set.
      if (i === 0 && depth != null && (typeof content === 'string' || content == null)) {
        content = createLabelCell({
          depth,
          text: content != null ? String(content) : ''
        });
      }
      fillCell(doc, td, content);
      tr.appendChild(td);
    }

    if (typeof opts.onClick === 'function') {
      tr.addEventListener('click', (e) => {
        if (e.target?.closest?.('button, a, input, select, textarea')) return;
        opts.onClick(e);
      }, true);
    }

    tbody.appendChild(tr);
    return tr;
  };

  /**
   * @param {string} text
   * @param {number} [depth]
   */
  const appendHintRow = (text, depth = 1) => {
    const tr = doc.createElement('tr');
    tr.className = cn.rowLeaf;
    const td = doc.createElement('td');
    td.colSpan = columns.length;
    td.style.paddingLeft = `${8 + Math.max(0, depth) * indentPx}px`;
    td.style.color = '#6a7a58';
    td.style.whiteSpace = 'normal';
    td.textContent = text != null ? String(text) : '';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return tr;
  };

  return {
    root: wrap,
    wrap,
    table,
    thead,
    tbody,
    columns,
    createLabelCell,
    appendGroupRow,
    appendLeafRow,
    appendHintRow
  };
}
