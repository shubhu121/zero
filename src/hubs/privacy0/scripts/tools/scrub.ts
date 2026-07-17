import { detectPII } from '../../lib/detect';
import { applyRedactions } from '../../lib/apply';
import type { Span } from '../../lib/detect';
import type { Style } from '../../lib/apply';

let currentSpans: Span[] = [];
let enabledSet = new Set<number>();

function buildHighlightDOM(text: string, spans: Span[], enabled: Set<number>): DocumentFragment {
  const frag = document.createDocumentFragment();
  let cursor = 0;
  for (const [i, s] of spans.entries()) {
    if (cursor < s.start) {
      frag.appendChild(document.createTextNode(text.slice(cursor, s.start)));
    }
    const mark = document.createElement('mark');
    mark.className = enabled.has(i) ? 'pii' : 'pii disabled';
    mark.dataset.idx = String(i);
    mark.appendChild(document.createTextNode(s.text));
    mark.addEventListener('click', () => toggleSpan(i));
    frag.appendChild(mark);
    cursor = s.end;
  }
  if (cursor < text.length) {
    frag.appendChild(document.createTextNode(text.slice(cursor)));
  }
  return frag;
}

function buildSidebar(spans: Span[], enabled: Set<number>): void {
  const sidebar = document.getElementById('pii-sidebar')!;
  sidebar.innerHTML = '';
  if (spans.length === 0) {
    sidebar.innerHTML = '<p class="text-muted text-sm">No PII detected.</p>';
    return;
  }
  const grouped = new Map<string, number[]>();
  for (const [i, s] of spans.entries()) {
    const g = grouped.get(s.kind) ?? [];
    g.push(i);
    grouped.set(s.kind, g);
  }
  for (const [kind, idxs] of grouped) {
    const section = document.createElement('div');
    section.className = 'mb-4';
    const header = document.createElement('div');
    header.className = 'flex items-center gap-2 mb-1';
    const label = document.createElement('span');
    label.className = 'text-xs font-medium uppercase tracking-widest text-muted';
    label.textContent = kind;
    const toggleAll = document.createElement('button');
    toggleAll.className = 'text-xs text-accent underline ml-auto';
    const allOn = idxs.every((i) => enabled.has(i));
    toggleAll.textContent = allOn ? 'disable all' : 'enable all';
    toggleAll.addEventListener('click', () => {
      if (allOn) idxs.forEach((i) => enabledSet.delete(i));
      else idxs.forEach((i) => enabledSet.add(i));
      render();
    });
    header.appendChild(label);
    header.appendChild(toggleAll);
    section.appendChild(header);
    for (const idx of idxs) {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2 py-0.5';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = enabled.has(idx);
      cb.className = 'accent-[--accent]';
      cb.addEventListener('change', () => toggleSpan(idx));
      const val = document.createElement('code');
      val.className = 'text-xs truncate text-ink';
      val.textContent = spans[idx]!.text;
      row.appendChild(cb);
      row.appendChild(val);
      section.appendChild(row);
    }
    sidebar.appendChild(section);
  }
}

function render(): void {
  const preview = document.getElementById('scrub-preview')!;
  const input = (document.getElementById('scrub-input') as HTMLTextAreaElement).value;
  preview.innerHTML = '';
  preview.appendChild(buildHighlightDOM(input, currentSpans, enabledSet));
  buildSidebar(currentSpans, enabledSet);
  updateCountBadge();
}

function toggleSpan(idx: number): void {
  if (enabledSet.has(idx)) enabledSet.delete(idx);
  else enabledSet.add(idx);
  render();
}

function updateCountBadge(): void {
  const badge = document.getElementById('pii-count');
  if (badge) badge.textContent = String(enabledSet.size);
}

export function initScrub(): void {
  const input = document.getElementById('scrub-input') as HTMLTextAreaElement;
  const preview = document.getElementById('scrub-preview')!;
  const applyBtn = document.getElementById('scrub-apply')!;
  const copyBtn = document.getElementById('scrub-copy')!;
  const styleSelect = document.getElementById('scrub-style') as HTMLSelectElement;

  input.addEventListener('input', () => {
    const text = input.value;
    currentSpans = detectPII(text);
    enabledSet = new Set(currentSpans.map((_, i) => i));
    render();
  });

  applyBtn.addEventListener('click', () => {
    const style = (styleSelect.value as Style) ?? 'placeholder';
    const redacted = applyRedactions(input.value, currentSpans, enabledSet, style);
    input.value = redacted;
    preview.innerHTML = '';
    preview.appendChild(document.createTextNode(redacted));
    currentSpans = [];
    enabledSet = new Set();
    buildSidebar([], new Set());
    updateCountBadge();
  });

  copyBtn.addEventListener('click', async () => {
    const style = (styleSelect.value as Style) ?? 'placeholder';
    const redacted = applyRedactions(input.value, currentSpans, enabledSet, style);
    await navigator.clipboard.writeText(redacted);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy redacted'; }, 1500);
  });
}
