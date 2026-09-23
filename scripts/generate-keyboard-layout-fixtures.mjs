/**
 * Write or verify deterministic SVG fixtures for the Keyboard Reference's
 * physical hardware models.
 *
 * Usage:
 *   npm run fixtures:keyboard-layouts
 *   npm run fixtures:keyboard-layouts -- --check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildKeyboardReferenceUiLayout,
  listKeyboardHardwareLayouts
} from '../extension/src/config/keyboard-hardware-layouts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.join(__dirname, '..', 'test', 'fixtures', 'keyboard-hardware-layouts');
const cellWidth = 66;
const cellHeight = 50;
const gap = 4;
const padding = 24;

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function labelForCell(cell) {
  return String(cell.legend || cell.text || cell.fallbackText || '').trim();
}

function renderFixture(layout) {
  const rows = buildKeyboardReferenceUiLayout({
    hardwareLayoutId: layout.id,
    includeNumberRow: true
  });
  const longestRow = Math.max(...rows.map((row) => row.length));
  const width = padding * 2 + longestRow * (cellWidth + gap) - gap;
  const height = 72 + padding * 2 + rows.length * (cellHeight + gap) - gap;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    `  <title id="title">${escapeXml(layout.id)} Keyboard Reference fixture</title>`,
    `  <desc id="desc">Compact Keyboard Reference geometry for ${escapeXml(layout.id)}.</desc>`,
    '  <style>',
    '    .canvas { fill: #101827; } .caption { fill: #eef4ff; font: 600 18px system-ui, sans-serif; }',
    '    .key { fill: #243049; stroke: #5e7197; stroke-width: 1; } .special { fill: #314466; }',
    '    .legend { fill: #f7faff; font: 600 15px system-ui, sans-serif; text-anchor: middle; dominant-baseline: middle; }',
    '    .code { fill: #b7c7e6; font: 10px ui-monospace, monospace; text-anchor: middle; }',
    '  </style>',
    `  <rect class="canvas" width="${width}" height="${height}" rx="12"/>`,
    `  <text class="caption" x="${padding}" y="38">${escapeXml(layout.id)} — ${escapeXml(layout.formFactor)}</text>`
  ];

  rows.forEach((row, rowIndex) => {
    const y = 72 + padding + rowIndex * (cellHeight + gap);
    lines.push(`  <g data-row="${rowIndex}">`);
    row.forEach((cell, columnIndex) => {
      const x = padding + columnIndex * (cellWidth + gap);
      const special = cell.type === 'special' ? ' special' : '';
      const legend = labelForCell(cell);
      lines.push(`    <g data-code="${escapeXml(cell.code)}">`);
      lines.push(`      <rect class="key${special}" x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" rx="6"/>`);
      lines.push(`      <text class="legend" x="${x + cellWidth / 2}" y="${y + 21}">${escapeXml(legend)}</text>`);
      lines.push(`      <text class="code" x="${x + cellWidth / 2}" y="${y + 42}">${escapeXml(cell.code)}</text>`);
      lines.push('    </g>');
    });
    lines.push('  </g>');
  });
  lines.push('</svg>', '');
  return lines.join('\n');
}

function fixturePath(layoutId) {
  return path.join(outputDirectory, `${layoutId}.svg`);
}

function main() {
  const check = process.argv.includes('--check');
  const mismatches = [];
  if (!check) fs.mkdirSync(outputDirectory, { recursive: true });

  for (const layout of listKeyboardHardwareLayouts()) {
    const file = fixturePath(layout.id);
    const expected = renderFixture(layout);
    const actual = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (actual === expected) continue;
    if (check) {
      mismatches.push(path.relative(process.cwd(), file));
    } else {
      fs.writeFileSync(file, expected);
      console.log(`Wrote ${path.relative(process.cwd(), file)}`);
    }
  }

  if (mismatches.length) {
    throw new Error(`Keyboard hardware fixtures are stale:\n${mismatches.join('\n')}`);
  }
}

main();
