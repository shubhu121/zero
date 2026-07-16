// DOM wiring for the UUID/ULID toolbox. All decoding lives in src/lib/ulid.ts,
// date rendering is reused from src/lib/epoch.ts.
import { v4, v7 } from 'uuid';
import { detectIdKind, decodeUlidTime, decodeUuidV7Time } from '../../lib/ulid';
import { formatAll } from '../../lib/epoch';

function $(id: string) { return document.getElementById(id)!; }

const KIND_LABELS: Record<string, string> = {
  uuidv7: 'UUID v7', uuidv4: 'UUID v4', uuid: 'UUID', ulid: 'ULID', unknown: 'unknown',
};

export function uuidSection() {
  // ── Generate panel ──────────────────────────────────────────────
  const kindSel = $('uuid-kind') as HTMLSelectElement;
  const countInput = $('uuid-count') as HTMLInputElement;
  const genBtn = $('uuid-gen') as HTMLButtonElement;
  const list = $('uuid-list');
  const copyAll = $('uuid-copyall') as HTMLButtonElement;

  function generate() {
    let count = Math.floor(Number(countInput.value));
    if (!Number.isFinite(count) || count < 1) count = 1;
    if (count > 1000) count = 1000;
    countInput.value = String(count);
    const make = kindSel.value === 'v7' ? v7 : v4;
    const ids: string[] = [];
    for (let i = 0; i < count; i++) ids.push(make());
    list.innerHTML = '';
    for (const id of ids) {
      const li = document.createElement('div');
      li.className = 'px-4 py-1.5 text-sm font-mono text-ink border-b border-rule last:border-b-0 break-all';
      li.textContent = id;
      list.appendChild(li);
    }
    copyAll.dataset.ids = ids.join('\n');
  }

  genBtn.addEventListener('click', generate);

  copyAll.addEventListener('click', () => {
    const text = copyAll.dataset.ids ?? '';
    if (!text) return;
    navigator.clipboard.writeText(text);
    const orig = copyAll.textContent;
    copyAll.textContent = 'copied';
    copyAll.classList.add('text-ok', 'border-ok');
    setTimeout(() => {
      copyAll.textContent = orig;
      copyAll.classList.remove('text-ok', 'border-ok');
    }, 1000);
  });

  // ── Decode panel ────────────────────────────────────────────────
  const decodeInput = $('uuid-decode-input') as HTMLInputElement;
  const kindBadge = $('uuid-kind-badge');
  const timeOut = $('uuid-decode-time');

  function decode() {
    const raw = decodeInput.value.trim();
    if (!raw) {
      kindBadge.textContent = '—';
      timeOut.innerHTML = '<p class="text-sm text-muted">paste an id to inspect it…</p>';
      return;
    }
    const kind = detectIdKind(raw);
    kindBadge.textContent = KIND_LABELS[kind] ?? kind;

    let ms: number | null = null;
    if (kind === 'uuidv7') ms = decodeUuidV7Time(raw);
    else if (kind === 'ulid') ms = decodeUlidTime(raw);

    if (ms === null) {
      const note = kind === 'unknown'
        ? 'not a recognised UUID or ULID.'
        : `${KIND_LABELS[kind]} carries no embedded timestamp.`;
      timeOut.innerHTML = `<p class="text-sm text-muted">${note}</p>`;
      return;
    }

    const f = formatAll(ms);
    const dl = document.createElement('dl');
    dl.className = 'divide-y divide-rule';
    dl.append(
      row('ISO 8601', f.iso),
      row('Relative', f.relative),
    );
    timeOut.innerHTML = '';
    timeOut.appendChild(dl);
  }

  function row(label: string, value: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'flex items-center justify-between gap-4 px-4 py-2.5 border-b border-rule last:border-b-0';
    const dt = document.createElement('dt');
    dt.className = 'label shrink-0';
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.className = 'text-sm font-mono text-ink truncate';
    dd.textContent = value;
    wrap.append(dt, dd);
    return wrap;
  }

  decodeInput.addEventListener('input', decode);

  // initial state
  generate();
  decode();
}
