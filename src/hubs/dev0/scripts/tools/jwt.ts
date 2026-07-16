// JWT decoder + (optional) verifier.
// Supports HS256/384/512 (HMAC) and RS256/ES256 (PEM public key) verify via Web Crypto.

type Algo = 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'ES256' | 'none';

function $(id: string) { return document.getElementById(id)!; }

function base64UrlDecode(input: string): Uint8Array {
  // Convert URL-safe base64 to standard, then decode.
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function parseJwt(token: string): { header: any; payload: any; signature: string; signingInput: string; alg: Algo } {
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new Error(`Invalid JWT: expected 3 parts, got ${parts.length}`);
  const [h, p, s] = parts;
  if (!h || !p || !s) throw new Error('Invalid JWT: empty segment');
  const headerBytes = base64UrlDecode(h);
  const payloadBytes = base64UrlDecode(p);
  const header = JSON.parse(new TextDecoder().decode(headerBytes));
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  const alg = (header.alg || 'none') as Algo;
  return { header, payload, signature: s, signingInput: `${h}.${p}`, alg };
}

function showError(msg: string) {
  const el = $('jwt-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function clearError() {
  const el = $('jwt-error');
  el.textContent = '';
  el.classList.add('hidden');
}

function fmtJson(o: any): string {
  return JSON.stringify(o, null, 2);
}

function relativeTime(unixSec: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = unixSec - now;
  const past = diff < 0;
  let abs = Math.abs(diff);
  const units: [number, string][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [604800, 'day'],
    [2592000, 'week'],
    [31536000, 'month'],
    [Number.MAX_SAFE_INTEGER, 'year'],
  ];
  let value = abs;
  let unit = 'second';
  for (let i = 0; i < units.length; i++) {
    const [limit, label] = units[i]!;
    if (abs < limit) {
      unit = label;
      value = abs;
      break;
    }
    // Convert to next unit
    const prevLimit = i === 0 ? 1 : units[i - 1]![0];
    value = abs / prevLimit;
    unit = label;
  }
  const rounded = Math.floor(value);
  return past ? `${rounded} ${unit}${rounded === 1 ? '' : 's'} ago` : `in ${rounded} ${unit}${rounded === 1 ? '' : 's'}`;
}

function renderClaims(payload: any) {
  const wrap = $('jwt-claims');
  wrap.innerHTML = '';
  const claims: { key: string; value: number; label: string }[] = [
    { key: 'exp', value: payload.exp, label: 'exp' },
    { key: 'nbf', value: payload.nbf, label: 'nbf' },
    { key: 'iat', value: payload.iat, label: 'iat' },
  ];
  for (const c of claims) {
    if (typeof c.value !== 'number') continue;
    const now = Math.floor(Date.now() / 1000);
    let cls = 'bg-bg text-muted';
    let title = relativeTime(c.value);
    if (c.key === 'exp') {
      if (c.value < now) cls = 'bg-bg text-err border border-err';
      else if (c.value < now + 86400) cls = 'bg-bg text-warn border border-warn';
      else cls = 'bg-bg text-ok border border-ok';
    }
    if (c.key === 'nbf' && c.value > now) cls = 'bg-bg text-warn border border-warn';
    const span = document.createElement('span');
    span.className = `text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${cls}`;
    span.textContent = c.label;
    span.title = `${new Date(c.value * 1000).toISOString()} (${title})`;
    wrap.appendChild(span);
  }
}

async function importHmacKey(secret: string, alg: 'HS256' | 'HS384' | 'HS512'): Promise<CryptoKey> {
  const hash = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' }[alg];
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash },
    false,
    ['verify'],
  );
}

async function importRsaPubKey(pem: string, alg: 'RS256' | 'ES256'): Promise<CryptoKey> {
  // Strip PEM headers/footers, decode base64, import as SPKI.
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const algo = alg === 'RS256'
    ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
    : { name: 'ECDSA', namedCurve: 'P-256' };
  return crypto.subtle.importKey('spki', der, algo, false, ['verify']);
}

async function verifyJwt(token: string, secret: string, alg: Algo): Promise<{ valid: boolean; reason?: string }> {
  if (alg === 'none') return { valid: false, reason: 'alg=none cannot be verified' };
  const parts = token.trim().split('.');
  if (parts.length !== 3 || !parts[2]) return { valid: false, reason: 'malformed token' };
  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const sig = base64UrlDecode(parts[2]);
  try {
    let key: CryptoKey;
    let verified: boolean;
    if (alg.startsWith('HS')) {
      if (!secret) return { valid: false, reason: 'HMAC secret required' };
      key = await importHmacKey(secret, alg as 'HS256');
      verified = await crypto.subtle.verify('HMAC', key, sig, signingInput);
    } else if (alg === 'RS256') {
      if (!secret) return { valid: false, reason: 'PEM public key required' };
      key = await importRsaPubKey(secret, 'RS256');
      verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, signingInput);
    } else if (alg === 'ES256') {
      if (!secret) return { valid: false, reason: 'PEM public key required' };
      key = await importRsaPubKey(secret, 'ES256');
      verified = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, signingInput);
    } else {
      return { valid: false, reason: `unsupported alg: ${alg}` };
    }
    return { valid: verified, reason: verified ? undefined : 'signature mismatch' };
  } catch (e) {
    return { valid: false, reason: (e as Error).message };
  }
}

function showVerifyResult(valid: boolean, reason?: string) {
  const el = $('jwt-verify-result');
  el.classList.remove('hidden');
  if (valid) {
    el.className = 'rounded-sm border p-3 text-sm border-ok bg-bg text-ok';
    el.textContent = '✓ Signature valid';
  } else {
    el.className = 'rounded-sm border p-3 text-sm border-err bg-bg text-err';
    el.textContent = `✗ Signature invalid: ${reason ?? 'unknown reason'}`;
  }
}

export function jwtSection() {
  const input = $('jwt-input') as HTMLTextAreaElement;
  const secret = $('jwt-secret') as HTMLTextAreaElement;
  const algoBadge = $('jwt-algo-badge');
  const headerEl = $('jwt-header');
  const payloadEl = $('jwt-payload');
  const verifyBtn = $('jwt-verify-btn');

  function decode() {
    clearError();
    const token = input.value.trim();
    if (!token) {
      headerEl.textContent = '—';
      payloadEl.textContent = '—';
      algoBadge.textContent = '—';
      $('jwt-claims').innerHTML = '';
      $('jwt-verify-result').classList.add('hidden');
      return;
    }
    try {
      const { header, payload, alg } = parseJwt(token);
      headerEl.textContent = fmtJson(header);
      payloadEl.textContent = fmtJson(payload);
      algoBadge.textContent = alg;
      algoBadge.className = `text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
        alg === 'none' ? 'bg-bg text-err border border-err' :
        alg.startsWith('HS') ? 'bg-bg text-warn border border-warn' :
        'bg-bg text-accent border border-accent'
      }`;
      renderClaims(payload);
      $('jwt-verify-result').classList.add('hidden');
    } catch (e) {
      showError((e as Error).message);
    }
  }

  input.addEventListener('input', decode);

  verifyBtn.addEventListener('click', async () => {
    clearError();
    const token = input.value.trim();
    if (!token) { showError('paste a token first'); return; }
    try {
      const { alg } = parseJwt(token);
      const result = await verifyJwt(token, secret.value, alg);
      showVerifyResult(result.valid, result.reason);
    } catch (e) {
      showError((e as Error).message);
    }
  });

  // Initial render with the famous JWT.io example token
  if (!input.value) {
    input.value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    decode();
  } else {
    decode();
  }
}
