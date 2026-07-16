// Line diff checker — an LCS-based unified diff between two blocks of text.
// Optional ignore-whitespace / ignore-case. Runs entirely in the browser.

interface Row { t: 'eq' | 'add' | 'del'; text: string; }

const SAMPLE_A = `function greet(name) {
  console.log("Hi " + name);
  return true;
}`;
const SAMPLE_B = `function greet(name) {
  console.log("Hello, " + name + "!");
  return true;
}`;

// Guard: the LCS table is O(n·m); refuse pathologically large inputs gracefully.
const MAX_CELLS = 6_000_000;

function $(id: string) { return document.getElementById(id)!; }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let ignoreWs = false;
let ignoreCase = false;

function normalize(line: string): string {
  let s = line;
  if (ignoreCase) s = s.toLowerCase();
  if (ignoreWs) s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function diffLines(a: string[], b: string[]): Row[] | null {
  const ca = a.map(normalize);
  const cb = b.map(normalize);
  const n = ca.length, m = cb.length;
  if ((n + 1) * (m + 1) > MAX_CELLS) return null;

  // dp[i][j] = LCS length of ca[i..] / cb[j..], stored row-major in a flat array.
  const w = m + 1;
  const dp = new Int32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = ca[i] === cb[j]
        ? dp[(i + 1) * w + (j + 1)] + 1
        : Math.max(dp[(i + 1) * w + j], dp[i * w + (j + 1)]);
    }
  }

  const rows: Row[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (ca[i] === cb[j]) { rows.push({ t: 'eq', text: a[i]! }); i++; j++; }
    else if (dp[(i + 1) * w + j] >= dp[i * w + (j + 1)]) { rows.push({ t: 'del', text: a[i]! }); i++; }
    else { rows.push({ t: 'add', text: b[j]! }); j++; }
  }
  while (i < n) { rows.push({ t: 'del', text: a[i]! }); i++; }
  while (j < m) { rows.push({ t: 'add', text: b[j]! }); j++; }
  return rows;
}

export function diffSection() {
  const left = $('diff-a') as HTMLTextAreaElement;
  const right = $('diff-b') as HTMLTextAreaElement;
  const out = $('diff-out');
  const summary = $('diff-summary');
  const wsBtn = $('diff-ws');
  const caseBtn = $('diff-case');

  function run() {
    const a = left.value === '' ? [] : left.value.split('\n');
    const b = right.value === '' ? [] : right.value.split('\n');
    const rows = diffLines(a, b);
    if (rows === null) {
      out.innerHTML = '';
      summary.textContent = 'Inputs too large for a full diff.';
      return;
    }
    let added = 0, removed = 0;
    const html = rows.map((r) => {
      const sign = r.t === 'add' ? '+' : r.t === 'del' ? '-' : ' ';
      if (r.t === 'add') added++;
      if (r.t === 'del') removed++;
      const style = r.t === 'add'
        ? 'background:color-mix(in srgb,var(--ok) 14%,transparent);color:var(--ink)'
        : r.t === 'del'
        ? 'background:color-mix(in srgb,var(--err) 14%,transparent);color:var(--ink)'
        : '';
      const cls = r.t === 'eq' ? 'text-muted' : '';
      return `<div class="px-3 py-px whitespace-pre-wrap break-words ${cls}" style="${style}"><span class="select-none opacity-50">${sign} </span>${esc(r.text) || '&nbsp;'}</div>`;
    }).join('');
    out.innerHTML = html;
    if (added === 0 && removed === 0) {
      summary.textContent = a.length === 0 && b.length === 0 ? '' : 'Identical — no differences.';
    } else {
      summary.innerHTML = `<span class="text-ok">+${added} added</span> · <span class="text-err">−${removed} removed</span>`;
    }
  }

  left.addEventListener('input', run);
  right.addEventListener('input', run);
  wsBtn.addEventListener('click', () => {
    ignoreWs = !ignoreWs;
    wsBtn.setAttribute('aria-pressed', String(ignoreWs));
    wsBtn.classList.toggle('bg-bg', ignoreWs);
    wsBtn.classList.toggle('text-accent', ignoreWs);
    run();
  });
  caseBtn.addEventListener('click', () => {
    ignoreCase = !ignoreCase;
    caseBtn.setAttribute('aria-pressed', String(ignoreCase));
    caseBtn.classList.toggle('bg-bg', ignoreCase);
    caseBtn.classList.toggle('text-accent', ignoreCase);
    run();
  });

  left.value = SAMPLE_A;
  right.value = SAMPLE_B;
  run();
}
