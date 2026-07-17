// File hasher — compute SHA-1/256/384/512 of any local file and (optionally)
// verify it against an expected digest. The file is read with FileReader and
// hashed via Web Crypto in the browser; it is never uploaded.

type Algo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

function $(id: string) { return document.getElementById(id)!; }

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

let algo: Algo = 'SHA-256';
let lastBuffer: ArrayBuffer | null = null;
let lastName = '';

export function initFileHash() {
  const drop = $('fh-drop');
  const fileInput = $('fh-file') as HTMLInputElement;
  const meta = $('fh-meta');
  const out = $('fh-output');
  const copyBtn = $('fh-copy');
  const expected = $('fh-expected') as HTMLInputElement;
  const verdict = $('fh-verdict');
  const errEl = $('fh-error');

  const supported = typeof crypto !== 'undefined' && !!crypto.subtle;

  function checkMatch() {
    const want = expected.value.trim().toLowerCase().replace(/\s+/g, '');
    const got = (out.textContent || '').toLowerCase();
    if (!want || !got) { verdict.textContent = ''; verdict.className = 'text-xs font-mono'; return; }
    if (want === got) {
      verdict.textContent = '✓ Match — the file matches the expected hash.';
      verdict.className = 'text-xs font-mono text-ok';
    } else {
      verdict.textContent = '✗ No match — the file does NOT match the expected hash.';
      verdict.className = 'text-xs font-mono text-err';
    }
  }

  async function hashCurrent() {
    errEl.classList.add('hidden');
    if (!lastBuffer) return;
    if (!supported) {
      errEl.textContent = 'Web Crypto is unavailable — this needs a secure context (https or localhost).';
      errEl.classList.remove('hidden');
      return;
    }
    out.textContent = 'Hashing…';
    try {
      const buf = await crypto.subtle.digest(algo, lastBuffer);
      out.textContent = toHex(buf);
      checkMatch();
    } catch (e) {
      errEl.textContent = (e as Error).message;
      errEl.classList.remove('hidden');
      out.textContent = '';
    }
  }

  async function loadFile(file: File) {
    lastName = file.name;
    meta.textContent = `${file.name} · ${fmtSize(file.size)}`;
    lastBuffer = await file.arrayBuffer();
    await hashCurrent();
  }

  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) loadFile(f);
  });
  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('border-accent'); }),
  );
  ['dragleave', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('border-accent'); }),
  );
  drop.addEventListener('drop', (e) => {
    const f = (e as DragEvent).dataTransfer?.files?.[0];
    if (f) loadFile(f);
  });

  for (const b of document.querySelectorAll<HTMLButtonElement>('.fh-algo-btn')) {
    b.addEventListener('click', () => {
      algo = b.dataset.fhAlgo as Algo;
      for (const x of document.querySelectorAll<HTMLButtonElement>('.fh-algo-btn')) {
        const active = x.dataset.fhAlgo === algo;
        x.classList.toggle('bg-bg', active);
        x.classList.toggle('text-accent', active);
        x.classList.toggle('text-muted', !active);
      }
      hashCurrent();
    });
  }
  expected.addEventListener('input', checkMatch);
  copyBtn.addEventListener('click', async () => {
    const v = out.textContent || '';
    if (!v || v === 'Hashing…') return;
    try {
      await navigator.clipboard.writeText(v);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
    } catch { /* ignore */ }
  });
}
