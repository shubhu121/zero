// Markdown table generator — paste CSV/TSV (or JSON array of objects) and get a
// GitHub-flavoured Markdown table, optionally column-aligned for readability.

import { parseDelimited, detectDelimiter, csvEscape } from '../../lib/csv';

type Align = 'left' | 'center' | 'right';

const SAMPLE = 'Tool,Hub,Client-side\nJWT decoder,dev0,yes\nSQL engine,data0,yes\nPassword gen,privacy0,yes';

function $(id: string) { return document.getElementById(id)!; }

let align: Align = 'left';
let pad = true;

function rowsFromInput(text: string): string[][] {
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) {
    // JSON array of objects → header + rows.
    const data = JSON.parse(trimmed);
    if (!Array.isArray(data) || !data.length) return [];
    const keys: string[] = [];
    for (const o of data) for (const k of Object.keys(o ?? {})) if (!keys.includes(k)) keys.push(k);
    return [keys, ...data.map((o: Record<string, unknown>) =>
      keys.map((k) => (o?.[k] == null ? '' : typeof o[k] === 'object' ? JSON.stringify(o[k]) : String(o[k]))))];
  }
  return parseDelimited(text, detectDelimiter(text)).filter((r) => !(r.length === 1 && r[0] === ''));
}

function toMarkdown(rows: string[][]): string {
  if (!rows.length) return '';
  const cols = Math.max(...rows.map((r) => r.length));
  const grid = rows.map((r) => Array.from({ length: cols }, (_, i) => (r[i] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')));
  const widths = Array.from({ length: cols }, (_, c) =>
    pad ? Math.max(3, ...grid.map((r) => r[c]!.length)) : 0);

  const sep = (w: number): string => {
    const width = Math.max(3, w);
    if (align === 'center') return `:${'-'.repeat(width - 2)}:`;
    if (align === 'right') return `${'-'.repeat(width - 1)}:`;
    return '-'.repeat(width);
  };
  const cell = (s: string, w: number): string => {
    if (!pad) return s;
    const fill = w - s.length;
    if (align === 'right') return ' '.repeat(fill) + s;
    if (align === 'center') { const l = Math.floor(fill / 2); return ' '.repeat(l) + s + ' '.repeat(fill - l); }
    return s + ' '.repeat(fill);
  };

  const line = (r: string[]): string => `| ${r.map((c, i) => cell(c, widths[i]!)).join(' | ')} |`;
  const header = grid[0]!;
  const body = grid.slice(1);
  const out = [line(header), `| ${widths.map((w) => sep(w)).join(' | ')} |`, ...body.map(line)];
  return out.join('\n');
}

export function initMdTable() {
  const input = $('md-input') as HTMLTextAreaElement;
  const output = $('md-output') as HTMLTextAreaElement;
  const errEl = $('md-error');
  const copyBtn = $('md-copy');

  function run() {
    errEl.classList.add('hidden');
    if (!input.value.trim()) { output.value = ''; return; }
    try {
      output.value = toMarkdown(rowsFromInput(input.value));
    } catch (e) {
      output.value = '';
      errEl.textContent = (e as Error).message;
      errEl.classList.remove('hidden');
    }
  }

  ($('md-align') as HTMLSelectElement).addEventListener('change', (e) => {
    align = (e.target as HTMLSelectElement).value as Align; run();
  });
  ($('md-pad') as HTMLInputElement).addEventListener('change', (e) => {
    pad = (e.target as HTMLInputElement).checked; run();
  });
  input.addEventListener('input', run);
  copyBtn.addEventListener('click', async () => {
    if (!output.value) return;
    try {
      await navigator.clipboard.writeText(output.value);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
    } catch { output.select(); }
  });

  void csvEscape;
  input.value = SAMPLE;
  run();
}
