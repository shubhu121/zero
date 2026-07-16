// CSV ⇄ JSON converter. CSV→JSON makes an array of objects (header row as keys);
// JSON→CSV flattens an array of objects to rows. All in-browser.

import { parseDelimited, inferType, csvEscape } from '../../lib/csv';

const SAMPLE_CSV = 'name,role,active,score\nAda,engineer,true,9.5\nGrace,admiral,true,10\nAlan,theorist,false,8';

function $(id: string) { return document.getElementById(id)!; }

const DELIMS: Record<string, string> = { comma: ',', tab: '\t', semicolon: ';' };

let dir: 'csv2json' | 'json2csv' = 'csv2json';
let delimKey = 'comma';
let header = true;
let infer = true;

function csvToJson(text: string, delim: string): string {
  const rows = parseDelimited(text, delim).filter((r) => !(r.length === 1 && r[0] === ''));
  if (!rows.length) return '[]';
  const coerce = (v: string) => (infer ? inferType(v) : v);
  if (header) {
    const keys = rows[0]!;
    const out = rows.slice(1).map((r) => {
      const obj: Record<string, unknown> = {};
      keys.forEach((k, i) => { obj[k] = coerce(r[i] ?? ''); });
      return obj;
    });
    return JSON.stringify(out, null, 2);
  }
  return JSON.stringify(rows.map((r) => r.map(coerce)), null, 2);
}

function jsonToCsv(text: string, delim: string): string {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('JSON must be an array (of objects or arrays).');
  if (!data.length) return '';
  // Array of arrays → straight rows.
  if (Array.isArray(data[0])) {
    return data.map((row: unknown[]) => row.map((c) => csvEscape(c, delim)).join(delim)).join('\n');
  }
  // Array of objects → union of keys, preserving first-seen order.
  const keys: string[] = [];
  for (const obj of data) for (const k of Object.keys(obj ?? {})) if (!keys.includes(k)) keys.push(k);
  const head = header ? [keys.map((k) => csvEscape(k, delim)).join(delim)] : [];
  const body = data.map((obj: Record<string, unknown>) =>
    keys.map((k) => {
      const v = obj?.[k];
      return csvEscape(v !== null && typeof v === 'object' ? JSON.stringify(v) : v, delim);
    }).join(delim),
  );
  return [...head, ...body].join('\n');
}

export function initCsvJson() {
  const input = $('cj-input') as HTMLTextAreaElement;
  const output = $('cj-output') as HTMLTextAreaElement;
  const errEl = $('cj-error');
  const inLabel = $('cj-in-label');
  const outLabel = $('cj-out-label');
  const headerWrap = $('cj-header-wrap');
  const inferWrap = $('cj-infer-wrap');
  const copyBtn = $('cj-copy');

  function updateLabels() {
    inLabel.textContent = dir === 'csv2json' ? 'CSV' : 'JSON';
    outLabel.textContent = dir === 'csv2json' ? 'JSON' : 'CSV';
    inferWrap.style.display = dir === 'csv2json' ? '' : 'none';
  }

  function run() {
    errEl.classList.add('hidden');
    const text = input.value;
    if (!text.trim()) { output.value = ''; return; }
    try {
      output.value = dir === 'csv2json'
        ? csvToJson(text, DELIMS[delimKey]!)
        : jsonToCsv(text, DELIMS[delimKey]!);
    } catch (e) {
      output.value = '';
      errEl.textContent = (e as Error).message;
      errEl.classList.remove('hidden');
    }
  }

  for (const b of document.querySelectorAll<HTMLButtonElement>('.cj-dir-btn')) {
    b.addEventListener('click', () => {
      dir = b.dataset.cjDir as 'csv2json' | 'json2csv';
      for (const x of document.querySelectorAll<HTMLButtonElement>('.cj-dir-btn')) {
        const active = x.dataset.cjDir === dir;
        x.classList.toggle('bg-bg', active);
        x.classList.toggle('text-accent', active);
        x.classList.toggle('text-muted', !active);
      }
      // Swap input/output so a round-trip is one click.
      const tmp = input.value; input.value = output.value || tmp;
      updateLabels(); run();
    });
  }
  ($('cj-delim') as HTMLSelectElement).addEventListener('change', (e) => {
    delimKey = (e.target as HTMLSelectElement).value; run();
  });
  ($('cj-header') as HTMLInputElement).addEventListener('change', (e) => {
    header = (e.target as HTMLInputElement).checked; run();
  });
  ($('cj-infer') as HTMLInputElement).addEventListener('change', (e) => {
    infer = (e.target as HTMLInputElement).checked; run();
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

  void headerWrap;
  updateLabels();
  input.value = SAMPLE_CSV;
  run();
}
