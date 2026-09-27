/**
 * Font Info result popover — structured font details for the run under the cursor.
 */
import { getMessage } from '../utils/i18n.js';
import { NCT_DARK_UI_BTN_RADIUS, NCT_DARK_UI_COLORS } from './nct-dark-ui.js';
import {
  ANCHORED_INSPECT_ROOT_CLASS,
  createInspectActionButton,
  disposeAnchoredInspectPopover,
  hideAnchoredInspectPopover,
  isAnchoredInspectPopoverOpen,
  showAnchoredInspectPopover
} from './anchored-inspect-popover.js';

const STYLE_ATTR = 'data-kp-font-info-style';
const ROOT_CLASS = ANCHORED_INSPECT_ROOT_CLASS;

const EXTRA_CSS = `
.${ROOT_CLASS}__rows {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 6px 10px;
  align-items: start;
}
.${ROOT_CLASS}__label {
  color: ${NCT_DARK_UI_COLORS.fgMute};
  font-size: 11px;
  padding-top: 1px;
}
.${ROOT_CLASS}__value {
  word-break: break-word;
  min-width: 0;
}
.${ROOT_CLASS}__sample {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  background: rgba(0,0,0,0.22);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.${ROOT_CLASS}__url {
  display: block;
  color: inherit;
  text-decoration: underline;
  word-break: break-all;
}
`;

function filenameFromUrl(url, fileType) {
  try {
    const path = new URL(url, location.href).pathname || '';
    const base = path.split('/').filter(Boolean).pop() || '';
    if (base) return decodeURIComponent(base);
  } catch { /* ignore */ }
  const ext = fileType && fileType.startsWith('.') ? fileType : '.woff2';
  return `font${ext}`;
}

function summaryText(info) {
  const lines = [
    `Name: ${info.usedFamily || ''}`,
    `Family: ${info.familyStack || ''}`,
    `Size: ${info.size || ''}`,
    `Weight: ${info.weight || ''}`,
    `Style: ${info.style || ''}`,
    `Stretch: ${info.stretch || ''}`,
    `File type: ${info.fileType || (info.sourceKind === 'local' ? 'local' : '')}`,
    `URL: ${info.resourceUrl || '(local / system font)'}`
  ];
  return lines.join('\n');
}

/**
 * @param {object} info
 * @param {() => void} [info.onClose]
 * @param {{ left?: number, top?: number }|null} [anchor]
 */
export function showFontInfoPopover(info = {}, anchor = null) {
  const doc = document;
  showAnchoredInspectPopover({
    title: getMessage('font_info_title'),
    ariaLabel: getMessage('font_info_aria'),
    kind: 'font-info',
    extraStyleAttr: STYLE_ATTR,
    extraCss: EXTRA_CSS,
    anchor,
    onClose: typeof info.onClose === 'function' ? info.onClose : null,
    renderBody(body) {
      if (info.sampleText) {
        const sample = doc.createElement('div');
        sample.className = `${ROOT_CLASS}__sample`;
        sample.textContent = info.sampleText;
        try {
          sample.style.fontFamily = info.familyStack || 'inherit';
          sample.style.fontSize = '16px';
          sample.style.fontWeight = info.weight || 'inherit';
          sample.style.fontStyle = info.style || 'inherit';
        } catch { /* ignore */ }
        body.appendChild(sample);
      }

      const rows = doc.createElement('div');
      rows.className = `${ROOT_CLASS}__rows`;
      const sizeValue = info.size && info.specifiedSize && info.specifiedSize !== info.size
        ? `${info.size} (${info.specifiedSize})`
        : (info.size || '');
      const fileType = info.fileType || (info.sourceKind === 'local' ? 'local' : '');
      const pairs = [
        [getMessage('font_info_label_name'), info.usedFamily || ''],
        [getMessage('font_info_label_family'), info.familyStack || ''],
        [getMessage('font_info_label_size'), sizeValue],
        [getMessage('font_info_label_weight'), info.weight || ''],
        [getMessage('font_info_label_style'), info.style || ''],
        [getMessage('font_info_label_stretch'), info.stretch || ''],
        [getMessage('font_info_label_file_type'), fileType]
      ];
      for (const [label, value] of pairs) {
        const l = doc.createElement('div');
        l.className = `${ROOT_CLASS}__label`;
        l.textContent = label;
        const v = doc.createElement('div');
        v.className = `${ROOT_CLASS}__value`;
        v.textContent = value;
        rows.appendChild(l);
        rows.appendChild(v);
      }

      const urlLabel = doc.createElement('div');
      urlLabel.className = `${ROOT_CLASS}__label`;
      urlLabel.textContent = getMessage('font_info_url');
      const urlVal = doc.createElement('div');
      urlVal.className = `${ROOT_CLASS}__value`;
      if (info.resourceUrl) {
        const a = doc.createElement('a');
        a.className = `${ROOT_CLASS}__url`;
        a.href = info.resourceUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = info.resourceUrl;
        urlVal.appendChild(a);
      } else {
        urlVal.textContent = getMessage('font_info_local');
      }
      rows.appendChild(urlLabel);
      rows.appendChild(urlVal);
      body.appendChild(rows);
    },
    renderActions(actions, _d, btnClass) {
      const canDownload = !!info.resourceUrl && info.sourceKind !== 'local';
      const dlBtn = createInspectActionButton(doc, {
        label: getMessage('font_info_download'),
        className: btnClass
      });
      dlBtn.disabled = !canDownload;
      dlBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!canDownload) return;
        dlBtn.disabled = true;
        dlBtn.textContent = getMessage('font_info_downloading');
        let ok = false;
        try {
          const res = await fetch(info.resourceUrl);
          if (!res.ok) throw new Error(String(res.status));
          const blob = await res.blob();
          const href = URL.createObjectURL(blob);
          const a = doc.createElement('a');
          a.href = href;
          a.download = filenameFromUrl(info.resourceUrl, info.fileType);
          a.rel = 'noopener';
          doc.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => { try { URL.revokeObjectURL(href); } catch { /* ignore */ } }, 4000);
          ok = true;
        } catch {
          ok = false;
        }
        dlBtn.textContent = getMessage(ok ? 'font_info_downloaded' : 'font_info_download_failed');
        dlBtn.disabled = !ok && canDownload ? false : !canDownload;
        if (ok) {
          setTimeout(() => {
            try {
              dlBtn.textContent = getMessage('font_info_download');
              dlBtn.disabled = !canDownload;
            } catch { /* ignore */ }
          }, 1400);
        }
      };

      const copyBtn = createInspectActionButton(doc, {
        label: getMessage('font_info_copy'),
        className: btnClass
      });
      copyBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        let ok = false;
        try {
          await navigator.clipboard.writeText(summaryText(info));
          ok = true;
        } catch { /* ignore */ }
        copyBtn.textContent = getMessage(ok ? 'docs_copy_copied' : 'docs_copy_failed');
        setTimeout(() => { try { copyBtn.textContent = getMessage('font_info_copy'); } catch { /* ignore */ } }, 1200);
      };

      const doneBtn = createInspectActionButton(doc, {
        label: getMessage('font_info_done'),
        primary: true,
        className: btnClass
      });
      doneBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideFontInfoPopover();
      };

      actions.append(dlBtn, copyBtn, doneBtn);
    }
  });
}

export function hideFontInfoPopover() {
  hideAnchoredInspectPopover();
}

export function isFontInfoPopoverOpen() {
  return isAnchoredInspectPopoverOpen();
}

export function disposeFontInfoPopover() {
  disposeAnchoredInspectPopover();
}
