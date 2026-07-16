// DOM wiring for the header audit. Pure audit logic lives in src/lib/headerAudit.ts.
// Primary input = paste (complete audit); secondary = live URL fetch (CORS-limited).
import { parsePastedHeaders, auditHeaders, type Grade } from '../../lib/headerAudit';

export function headersSection() {
  const $ = (id: string) => document.getElementById(id)!;
  const modePaste = $('mode-paste') as HTMLButtonElement;
  const modeFetch = $('mode-fetch') as HTMLButtonElement;
  const pastePanel = $('paste-panel');
  const fetchPanel = $('fetch-panel');
  const pasteInput = $('headers-paste') as HTMLTextAreaElement;
  const auditBtn = $('headers-audit-btn');
  const urlInput = $('headers-url') as HTMLInputElement;
  const fetchBtn = $('headers-fetch-btn');
  const status = $('headers-status');
  const gradeEl = $('headers-grade');
  const findingsEl = $('headers-findings');

  function setMode(mode: 'paste' | 'fetch') {
    const paste = mode === 'paste';
    pastePanel.classList.toggle('hidden', !paste);
    fetchPanel.classList.toggle('hidden', paste);
    modePaste.classList.toggle('text-accent', paste);
    modeFetch.classList.toggle('text-accent', !paste);
    modePaste.setAttribute('aria-selected', String(paste));
    modeFetch.setAttribute('aria-selected', String(!paste));
  }
  modePaste.addEventListener('click', () => setMode('paste'));
  modeFetch.addEventListener('click', () => setMode('fetch'));

  function showStatus(text: string, kind: 'info' | 'ok' | 'err' = 'info') {
    status.textContent = text;
    status.className = `label mt-4 min-h-[1.2em] ${kind === 'err' ? 'text-err' : kind === 'ok' ? 'text-ok' : 'text-muted'}`;
  }

  function render(g: Grade) {
    gradeEl.classList.remove('hidden');
    gradeEl.innerHTML = '';
    const color = g.letter === 'A' || g.letter === 'B' ? 'text-ok' : g.letter === 'C' || g.letter === 'D' ? 'text-warn' : 'text-err';
    const head = document.createElement('div');
    head.className = 'flex items-center gap-4';
    const letter = document.createElement('div');
    letter.className = `text-5xl font-bold ${color}`;
    letter.textContent = g.letter;
    const meta = document.createElement('div');
    const d = document.createElement('div'); d.className = 'text-sm font-medium text-ink'; d.textContent = g.desc;
    const s = document.createElement('div'); s.className = 'label mt-0.5'; s.textContent = `${Math.round(g.score * 10) / 10}/${g.total} checks`;
    meta.append(d, s);
    head.append(letter, meta);
    gradeEl.append(head);

    findingsEl.innerHTML = '';
    for (const f of g.findings) {
      const row = document.createElement('div');
      row.className = 'flex items-start gap-2 py-1.5 border-b border-rule';
      const dot = document.createElement('span');
      const dc = f.status === 'pass' ? 'bg-ok' : f.status === 'warn' ? 'bg-warn' : f.status === 'fail' ? 'bg-err' : 'bg-muted';
      dot.className = `w-1.5 h-1.5 rounded-full ${dc} mt-2 shrink-0`;
      const body = document.createElement('div'); body.className = 'flex-1 min-w-0';
      const nm = document.createElement('div'); nm.className = 'font-mono text-xs text-ink'; nm.textContent = `${f.name} · ${f.severity}`;
      body.append(nm);
      if (f.msg) { const m = document.createElement('div'); m.className = 'text-xs text-muted mt-0.5'; m.textContent = f.msg; body.append(m); }
      row.append(dot, body);
      findingsEl.append(row);
    }
  }

  auditBtn.addEventListener('click', () => {
    const raw = pasteInput.value.trim();
    if (!raw) { showStatus('Paste some response headers first', 'err'); return; }
    const headers = parsePastedHeaders(raw);
    const n = Object.keys(headers).length;
    if (n === 0) { showStatus('No header lines found. Paste raw "name: value" lines', 'err'); return; }
    render(auditHeaders(headers));
    showStatus(`Audited ${n} header${n === 1 ? '' : 's'}`, 'ok');
  });

  async function runFetch() {
    let target = urlInput.value.trim();
    if (!target) { showStatus('Enter a URL first', 'err'); return; }
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
    try { new URL(target); } catch { showStatus('Invalid URL', 'err'); return; }
    fetchBtn.setAttribute('disabled', 'true');
    showStatus(`Fetching ${target}…`);
    const t0 = performance.now();
    try {
      const res = await fetch(target, { method: 'GET', mode: 'cors', redirect: 'follow' });
      const dt = Math.round(performance.now() - t0);
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
      const n = Object.keys(headers).length;
      if (n === 0) {
        gradeEl.classList.add('hidden');
        findingsEl.innerHTML = '';
        const note = document.createElement('p');
        note.className = 'text-sm text-muted';
        note.textContent = 'Browsers only reveal cross-origin headers the server exposes via CORS. For a real audit, paste the headers from DevTools → Network → Response Headers, or `curl -I <url>`; switch to Paste mode above.';
        findingsEl.append(note);
        showStatus(`${res.status} · ${dt}ms · no readable headers`, 'err');
        return;
      }
      render(auditHeaders(headers));
      showStatus(`${res.status} · ${dt}ms · ${n} readable header${n === 1 ? '' : 's'}`, 'ok');
    } catch (e) {
      showStatus(`Fetch failed: ${(e as Error).message}; likely CORS. Switch to Paste mode.`, 'err');
    } finally {
      fetchBtn.removeAttribute('disabled');
    }
  }
  fetchBtn.addEventListener('click', runFetch);
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runFetch(); });

  setMode('paste');
}
