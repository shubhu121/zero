// Base64 / URL / Hex encoder-decoder with auto-detect.

type Mode = 'encode' | 'decode' | 'auto';
type Enc = 'base64' | 'url' | 'hex';

const SAMPLE_B64 = 'SGVsbG8sIHdvcmxkIQ==';

function $(id: string) { return document.getElementById(id)!; }

function utf8Bytes(s: string): Uint8Array { return new TextEncoder().encode(s); }
function bytesToUtf8(b: Uint8Array): string { return new TextDecoder().decode(b); }

function b64Encode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}
function b64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function urlDecode(s: string): Uint8Array {
  let p = s.replace(/-/g, '+').replace(/_/g, '/');
  while (p.length % 4) p += '=';
  return b64Decode(p);
}

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexDecode(s: string): Uint8Array {
  const clean = s.replace(/\s+/g, '').toLowerCase();
  if (clean.length % 2) throw new Error('hex string has odd length');
  if (!/^[0-9a-f]*$/.test(clean)) throw new Error('hex string contains non-hex chars');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function looksLikeBase64(s: string): boolean {
  const t = s.trim();
  if (t.length < 4) return false;
  if (t.length % 4 !== 0 && !/^[A-Za-z0-9+/=_-]+$/.test(t)) return false;
  return /^[A-Za-z0-9+/=_-]+$/.test(t) && t.length >= 4 && t.length % 4 === 0;
}
function looksLikeHex(s: string): boolean {
  const t = s.trim().replace(/\s+/g, '');
  return t.length > 0 && t.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(t) && t.length >= 4;
}

function autoDetect(s: string): { enc: Enc; mode: Mode } {
  if (looksLikeBase64(s)) return { enc: 'base64', mode: 'decode' };
  if (looksLikeHex(s)) return { enc: 'hex', mode: 'decode' };
  return { enc: 'base64', mode: 'encode' };
}

function showError(msg: string) {
  const el = $('b64-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function clearError() {
  const el = $('b64-error');
  el.textContent = '';
  el.classList.add('hidden');
}

let mode: Mode = 'auto';
let enc: Enc = 'base64';

export function b64Section() {
  const input = $('b64-input') as HTMLTextAreaElement;
  const output = $('b64-output') as HTMLTextAreaElement;
  const inLabel = $('b64-input-label');
  const outLabel = $('b64-output-label');
  const inBytes = $('b64-bytes-in');
  const outBytes = $('b64-bytes-out');
  const copyBtn = $('b64-copy');
  const errEl = $('b64-error');

  function setMode(m: Mode) {
    mode = m;
    for (const b of document.querySelectorAll<HTMLButtonElement>('.b64-mode-btn')) {
      const isActive = b.dataset.b64Mode === m;
      b.classList.toggle('bg-bg', isActive);
      b.classList.toggle('text-accent', isActive);
      b.classList.toggle('text-muted', !isActive);
    }
    updateLabels();
    run();
  }
  function setEnc(e: Enc) {
    enc = e;
    for (const b of document.querySelectorAll<HTMLButtonElement>('.b64-enc-btn')) {
      const isActive = b.dataset.b64Enc === e;
      b.classList.toggle('bg-bg', isActive);
      b.classList.toggle('text-accent', isActive);
      b.classList.toggle('text-muted', !isActive);
    }
    updateLabels();
    run();
  }
  function updateLabels() {
    if (mode === 'encode') {
      inLabel.textContent = 'Plaintext';
      outLabel.textContent = enc === 'base64' ? 'Base64' : enc === 'url' ? 'URL-safe Base64' : 'Hex';
    } else if (mode === 'decode') {
      inLabel.textContent = enc === 'base64' ? 'Base64' : enc === 'url' ? 'URL-safe Base64' : 'Hex';
      outLabel.textContent = 'Plaintext';
    } else {
      inLabel.textContent = 'Input';
      outLabel.textContent = 'Output';
    }
  }

  function run() {
    clearError();
    const effective = mode === 'auto' ? autoDetect(input.value) : { enc, mode: mode as 'encode' | 'decode' };
    if (mode === 'auto') {
      // Reflect detected state in UI
      for (const b of document.querySelectorAll<HTMLButtonElement>('.b64-mode-btn')) {
        const isActive = b.dataset.b64Mode === effective.mode;
        b.classList.toggle('bg-bg', isActive);
        b.classList.toggle('text-accent', isActive);
        b.classList.toggle('text-muted', !isActive);
      }
      for (const b of document.querySelectorAll<HTMLButtonElement>('.b64-enc-btn')) {
        const isActive = b.dataset.b64Enc === effective.enc;
        b.classList.toggle('bg-bg', isActive);
        b.classList.toggle('text-accent', isActive);
        b.classList.toggle('text-muted', !isActive);
      }
      updateLabels();
    }
    if (!input.value) {
      output.value = '';
      inBytes.textContent = '0 bytes';
      outBytes.textContent = '0 bytes';
      return;
    }
    try {
      let outBytesVal: Uint8Array;
      let outStr: string;
      let inByteCount: number;
      if (effective.mode === 'encode') {
        inByteCount = utf8Bytes(input.value).byteLength;
        const bytes = utf8Bytes(input.value);
        outStr = effective.enc === 'base64' ? b64Encode(bytes)
                : effective.enc === 'url' ? urlEncode(bytes)
                : hexEncode(bytes);
        outBytesVal = utf8Bytes(outStr);
      } else {
        const bytes = effective.enc === 'base64' ? b64Decode(input.value)
                     : effective.enc === 'url' ? urlDecode(input.value)
                     : hexDecode(input.value);
        outStr = bytesToUtf8(bytes);
        inByteCount = input.value.length;
        outBytesVal = bytes;
      }
      output.value = outStr;
      inBytes.textContent = `${inByteCount} bytes`;
      outBytes.textContent = `${outBytesVal.byteLength} bytes`;
    } catch (e) {
      showError((e as Error).message);
      output.value = '';
    }
  }

  input.addEventListener('input', run);
  document.querySelectorAll<HTMLButtonElement>('.b64-mode-btn').forEach(b => b.addEventListener('click', () => setMode(b.dataset.b64Mode as Mode)));
  document.querySelectorAll<HTMLButtonElement>('.b64-enc-btn').forEach(b => b.addEventListener('click', () => setEnc(b.dataset.b64Enc as Enc)));
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(output.value);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
    } catch {
      // Fallback: select the textarea
      output.select();
    }
  });

  // Initial
  input.value = SAMPLE_B64;
  run();
}
