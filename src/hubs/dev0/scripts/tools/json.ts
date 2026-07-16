// JSON formatter / validator — pretty-print, minify, optional key sort, with
// precise error location. Pure JSON.parse/stringify; nothing leaves the page.

type Indent = '2' | '4' | 'tab';

const SAMPLE = '{"name":"TabZero","private":true,"hubs":["dev0","web0","data0"],"servers":0}';

function $(id: string) { return document.getElementById(id)!; }

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = sortKeys((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

function indentValue(i: Indent): string | number {
  return i === 'tab' ? '\t' : Number(i);
}

// Map a character offset (from "position N" in V8 errors) to line/column.
function locate(text: string, msg: string): string {
  const m = /position (\d+)/.exec(msg);
  if (!m) return msg;
  const pos = Number(m[1]);
  let line = 1, col = 1;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text[i] === '\n') { line++; col = 1; } else col++;
  }
  // Strip the raw "at position N" tail; we give friendlier line/column instead.
  const clean = msg.replace(/\s*at position \d+.*/, '').replace(/^JSON\.parse:?\s*/i, '');
  return `${clean} — line ${line}, column ${col}`;
}

let mode: 'format' | 'minify' = 'format';
let indent: Indent = '2';
let sort = false;

export function jsonSection() {
  const input = $('json-input') as HTMLTextAreaElement;
  const output = $('json-output') as HTMLTextAreaElement;
  const status = $('json-status');
  const errEl = $('json-error');
  const bytesIn = $('json-bytes-in');
  const bytesOut = $('json-bytes-out');
  const indentSel = $('json-indent') as HTMLSelectElement;
  const sortBtn = $('json-sort');
  const copyBtn = $('json-copy');

  function setOk(label: string) {
    status.textContent = label;
    status.classList.remove('text-err');
    status.classList.add('text-ok');
    errEl.classList.add('hidden');
    errEl.textContent = '';
  }
  function setErr(msg: string) {
    status.textContent = 'Invalid';
    status.classList.remove('text-ok');
    status.classList.add('text-err');
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
    output.value = '';
    bytesOut.textContent = '0 bytes';
  }

  function run() {
    const text = input.value;
    bytesIn.textContent = `${new TextEncoder().encode(text).byteLength} bytes`;
    if (!text.trim()) {
      output.value = '';
      status.textContent = '';
      status.classList.remove('text-ok', 'text-err');
      errEl.classList.add('hidden');
      bytesOut.textContent = '0 bytes';
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setErr(locate(text, (e as Error).message));
      return;
    }
    const value = sort ? sortKeys(parsed) : parsed;
    const out = mode === 'minify'
      ? JSON.stringify(value)
      : JSON.stringify(value, null, indentValue(indent));
    output.value = out;
    bytesOut.textContent = `${new TextEncoder().encode(out).byteLength} bytes`;
    setOk('Valid');
  }

  function setMode(m: 'format' | 'minify') {
    mode = m;
    for (const b of document.querySelectorAll<HTMLButtonElement>('.json-mode-btn')) {
      const active = b.dataset.jsonMode === m;
      b.classList.toggle('bg-bg', active);
      b.classList.toggle('text-accent', active);
      b.classList.toggle('text-muted', !active);
    }
    run();
  }

  for (const b of document.querySelectorAll<HTMLButtonElement>('.json-mode-btn')) {
    b.addEventListener('click', () => setMode(b.dataset.jsonMode as 'format' | 'minify'));
  }
  indentSel.addEventListener('change', () => { indent = indentSel.value as Indent; run(); });
  sortBtn.addEventListener('click', () => {
    sort = !sort;
    sortBtn.setAttribute('aria-pressed', String(sort));
    sortBtn.classList.toggle('bg-bg', sort);
    sortBtn.classList.toggle('text-accent', sort);
    run();
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

  input.value = SAMPLE;
  run();
}
