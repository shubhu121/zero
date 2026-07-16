// SHA hash generator — SHA-1/256/384/512 over text, hex or Base64 output.
// Uses the browser's Web Crypto (crypto.subtle); the bytes never leave the page.

type Algo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
type Enc = 'hex' | 'base64';

const SAMPLE = 'The quick brown fox jumps over the lazy dog';

function $(id: string) { return document.getElementById(id)!; }

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

let algo: Algo = 'SHA-256';
let enc: Enc = 'hex';

export function hashSection() {
  const input = $('hash-input') as HTMLTextAreaElement;
  const output = $('hash-output');
  const lenEl = $('hash-len');
  const bytesIn = $('hash-bytes-in');
  const errEl = $('hash-error');
  const copyBtn = $('hash-copy');

  const supported = typeof crypto !== 'undefined' && !!crypto.subtle;

  async function run() {
    errEl.classList.add('hidden');
    const text = input.value;
    bytesIn.textContent = `${new TextEncoder().encode(text).byteLength} bytes`;
    if (!text) { output.textContent = ''; lenEl.textContent = ''; return; }
    if (!supported) {
      errEl.textContent = 'Web Crypto is unavailable — this needs a secure context (https or localhost).';
      errEl.classList.remove('hidden');
      output.textContent = '';
      return;
    }
    try {
      const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
      const digest = enc === 'hex' ? toHex(buf) : toB64(buf);
      output.textContent = digest;
      lenEl.textContent = `${buf.byteLength * 8}-bit · ${digest.length} chars`;
    } catch (e) {
      errEl.textContent = (e as Error).message;
      errEl.classList.remove('hidden');
      output.textContent = '';
    }
  }

  function setActive(selector: string, dataKey: string, value: string) {
    for (const b of document.querySelectorAll<HTMLButtonElement>(selector)) {
      const active = b.dataset[dataKey] === value;
      b.classList.toggle('bg-bg', active);
      b.classList.toggle('text-accent', active);
      b.classList.toggle('text-muted', !active);
    }
  }

  for (const b of document.querySelectorAll<HTMLButtonElement>('.hash-algo-btn')) {
    b.addEventListener('click', () => {
      algo = b.dataset.hashAlgo as Algo;
      setActive('.hash-algo-btn', 'hashAlgo', algo);
      run();
    });
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>('.hash-enc-btn')) {
    b.addEventListener('click', () => {
      enc = b.dataset.hashEnc as Enc;
      setActive('.hash-enc-btn', 'hashEnc', enc);
      run();
    });
  }
  input.addEventListener('input', run);
  copyBtn.addEventListener('click', async () => {
    const v = output.textContent || '';
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
    } catch { /* ignore */ }
  });

  input.value = SAMPLE;
  run();
}
