// URL encoder / decoder with a parsed-parts breakdown. encodeURIComponent for
// "component" mode, encodeURI for "full URI" mode. All local.

type Mode = 'encode' | 'decode';
type Kind = 'component' | 'uri';

const SAMPLE = 'https://example.com/search?q=hello world&lang=en#top';

function $(id: string) { return document.getElementById(id)!; }

let mode: Mode = 'encode';
let kind: Kind = 'component';

export function initUrl() {
  const input = $('ur-input') as HTMLTextAreaElement;
  const output = $('ur-output') as HTMLTextAreaElement;
  const errEl = $('ur-error');
  const copyBtn = $('ur-copy');
  const partsBox = $('ur-parts');

  function run() {
    errEl.classList.add('hidden');
    const text = input.value;
    if (!text) { output.value = ''; renderParts(''); return; }
    try {
      if (mode === 'encode') {
        output.value = kind === 'component' ? encodeURIComponent(text) : encodeURI(text);
      } else {
        output.value = kind === 'component' ? decodeURIComponent(text) : decodeURI(text);
      }
    } catch (e) {
      output.value = '';
      errEl.textContent = (e as Error).message;
      errEl.classList.remove('hidden');
    }
    renderParts(text);
  }

  function renderParts(text: string) {
    let url: URL | null = null;
    try { url = new URL(text); } catch { url = null; }
    if (!url) { partsBox.innerHTML = '<p class="text-xs text-muted">Enter a full URL to see its parts.</p>'; return; }
    const rows: [string, string][] = [
      ['protocol', url.protocol],
      ['host', url.host],
      ['pathname', url.pathname],
      ['hash', url.hash || '—'],
    ];
    const params = [...url.searchParams.entries()];
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    let html = '<div class="space-y-1">';
    for (const [k, v] of rows) html += `<div class="flex gap-3 text-xs"><span class="label w-20 shrink-0">${k}</span><span class="font-mono text-ink break-all">${esc(v)}</span></div>`;
    if (params.length) {
      html += '<div class="pt-2 mt-2 border-t border-rule"><span class="label">query params</span></div>';
      for (const [k, v] of params) html += `<div class="flex gap-3 text-xs"><span class="font-mono text-accent w-20 shrink-0 break-all">${esc(k)}</span><span class="font-mono text-ink break-all">${esc(v)}</span></div>`;
    }
    html += '</div>';
    partsBox.innerHTML = html;
  }

  function setActive(sel: string, dataKey: string, val: string) {
    for (const b of document.querySelectorAll<HTMLButtonElement>(sel)) {
      const active = b.dataset[dataKey] === val;
      b.classList.toggle('bg-bg', active);
      b.classList.toggle('text-accent', active);
      b.classList.toggle('text-muted', !active);
    }
  }

  for (const b of document.querySelectorAll<HTMLButtonElement>('.ur-mode-btn')) {
    b.addEventListener('click', () => { mode = b.dataset.urMode as Mode; setActive('.ur-mode-btn', 'urMode', mode); run(); });
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>('.ur-kind-btn')) {
    b.addEventListener('click', () => { kind = b.dataset.urKind as Kind; setActive('.ur-kind-btn', 'urKind', kind); run(); });
  }
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
