// X.509 / PEM certificate decoder — runs entirely in the browser via @peculiar/x509.
// @peculiar/x509 v2's build pulls in tsyringe, which requires a reflect-metadata
// polyfill loaded BEFORE the library, or it throws at module-init time.
import 'reflect-metadata';
import * as x509 from '@peculiar/x509';

export interface CertInfo {
  subject: string;
  issuer: string;
  serial: string;
  notBefore: Date;
  notAfter: Date;
  daysLeft: number;
  sans: string[];
  keyAlg: string;
  sigAlg: string;
  sha256: string;
  sha1: string;
  selfSigned: boolean;
}

export async function decodeCert(pem: string): Promise<CertInfo> {
  const cert = new x509.X509Certificate(pem.trim()); // accepts PEM or base64 DER
  const der = cert.rawData;
  const digest = async (alg: string) =>
    [...new Uint8Array(await crypto.subtle.digest(alg, der))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(':');
  const sanExt = cert.getExtension(x509.SubjectAlternativeNameExtension);
  const sig = cert.signatureAlgorithm as { name?: string; hash?: { name?: string } };
  return {
    subject: cert.subject,
    issuer: cert.issuer,
    serial: cert.serialNumber,
    notBefore: cert.notBefore,
    notAfter: cert.notAfter,
    daysLeft: Math.floor((cert.notAfter.getTime() - Date.now()) / 86400000),
    sans: sanExt?.names.items.map((n) => `${n.type}:${n.value}`) ?? [],
    keyAlg: (cert.publicKey.algorithm as { name?: string }).name ?? 'unknown',
    sigAlg: sig.hash?.name ? `${sig.name}-${sig.hash.name}` : sig.name ?? 'unknown',
    sha256: await digest('SHA-256'),
    sha1: await digest('SHA-1'),
    selfSigned: cert.subject === cert.issuer,
  };
}

// A real, parseable self-signed certificate that is intentionally EXPIRED
// (valid 2019-01-01 .. 2020-01-01) so the expiry badge renders red by default.
// Generated with @peculiar/x509's X509CertificateGenerator and round-trip-verified
// to decode (subject, issuer, serial, SANs, key/sig alg) with this exact library.
export const SAMPLE_CERT = `-----BEGIN CERTIFICATE-----
MIIDfzCCAmegAwIBAgIGChssPU5fMA0GCSqGSIb3DQEBCwUAMDwxGTAXBgNVBAMT
EGV4cGlyZWQuZGV2MC5kZXYxEjAQBgNVBAoTCWRldjAgVGVzdDELMAkGA1UEBhMC
VVMwHhcNMTkwMTAxMDAwMDAwWhcNMjAwMTAxMDAwMDAwWjA8MRkwFwYDVQQDExBl
eHBpcmVkLmRldjAuZGV2MRIwEAYDVQQKEwlkZXYwIFRlc3QxCzAJBgNVBAYTAlVT
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs1Q5J0Ne18PKEph9pD2D
Hj+y1bqi/rT5I1ahcS1NARVruUDXprKLCg2WJoKjYvWEy8MD2YxkQulwPy9TNvKk
hl/qjLdeqftLR0llsCzPGk5Fh4GZeFa4Nsv0OhiCvD62jXPtNQApjr0WxEkUEyB8
sXhQgULNmLN6aAXf73UEldF004uINI5S5j6l5n+rlz3BDsMW1Ahy/+Z9T+TXSP7M
quXq0jo7wf5EXeQPgvxWK+JH9BHkWaDPGoVvrlJaw5ZRmKpG/jsfwR3vgr1vBbpW
NwKC3HyYQR0Fx4kU+7QGMA1DmurLsslr5QnY7jWsrxYFP+v8Vw3Dm1Jnobnzs6NX
GwIDAQABo4GGMIGDMBIGA1UdEwEB/wQIMAYBAf8CAQIwDgYDVR0PAQH/BAQDAgKE
MB0GA1UdDgQWBBSY7FFdUO8g5TkHWDPxZKIWZyRzHzA+BgNVHREENzA1ghBleHBp
cmVkLmRldjAuZGV2ghIqLmV4cGlyZWQuZGV2MC5kZXaBDXRlc3RAZGV2MC5kZXYw
DQYJKoZIhvcNAQELBQADggEBAFQt7k6+Cxstc2nJ7hrDRcvsm7cinakCfMyQ1LE+
ktUlFW/hA8k6dSVhSb6drqqkxGLjYIToyJ+4lRk0ZwM0Q62F83SYgD+xLPFocRBU
4zVT31FQ7f3mdNsG41NmVcfCD41rznGwUYjKUp2z/6QEQxHWu/xdvmbpBEw6NCbh
PeNBN8nX9cqE1wjQU0K/sfktxO8Mk8dbrfajzhXovDz+0OgLvZw7BGajAvZ4XTPA
OkHtWWVJGuDKLdKJJjGopfBfktwfmtibltjLm+kPBHL+Il8/vlZxYmfoI5W/6kil
ccxfLKT9SiFnPTTAwCzUGDT/hRARszDFAmVAgU3OA1Qcfg4=
-----END CERTIFICATE-----`;

function $(id: string) {
  return document.getElementById(id)!;
}

function fmtDate(d: Date): string {
  return `${d.toISOString().replace('.000Z', 'Z')} (${d.toUTCString()})`;
}

export function certSection() {
  const input = $('cert-input') as HTMLTextAreaElement;
  const fields = $('cert-fields');
  const expiry = $('cert-expiry');
  const sansWrap = $('cert-sans');
  const sha256El = $('cert-sha256');
  const sha1El = $('cert-sha1');
  const errorEl = $('cert-error');
  const sampleBtn = $('cert-sample') as HTMLButtonElement;

  const fieldRow = (label: string, id: string) => {
    const row = document.createElement('div');
    row.className = 'flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 py-1.5 border-b border-rule last:border-b-0';
    const k = document.createElement('span');
    k.className = 'label shrink-0 sm:w-28';
    k.textContent = label;
    const v = document.createElement('span');
    v.id = id;
    v.className = 'text-sm font-mono text-ink break-all';
    v.textContent = '—';
    row.appendChild(k);
    row.appendChild(v);
    return row;
  };

  // Build the static field rows once.
  fields.innerHTML = '';
  const rows: Record<string, string> = {
    subject: 'Subject',
    issuer: 'Issuer',
    serial: 'Serial',
    keyAlg: 'Key alg',
    sigAlg: 'Sig alg',
    notBefore: 'Valid from',
    notAfter: 'Valid to',
  };
  for (const [id, label] of Object.entries(rows)) {
    fields.appendChild(fieldRow(label, `cert-field-${id}`));
  }

  function clearError() {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  function showError() {
    errorEl.textContent = 'not a valid certificate (PEM or base64 DER)';
    errorEl.classList.remove('hidden');
  }

  function resetFields() {
    for (const id of Object.keys(rows)) $(`cert-field-${id}`).textContent = '—';
    expiry.textContent = '—';
    expiry.className = 'text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-bg text-muted';
    sansWrap.innerHTML = '';
    sha256El.textContent = '—';
    sha1El.textContent = '—';
  }

  function setExpiry(daysLeft: number) {
    let cls: string;
    let text: string;
    if (daysLeft < 0) {
      cls = 'bg-bg text-err border border-err';
      text = `expired ${Math.abs(daysLeft)}d ago`;
    } else if (daysLeft < 30) {
      cls = 'bg-bg text-warn border border-warn';
      text = `expires in ${daysLeft}d`;
    } else {
      cls = 'bg-bg text-ok border border-ok';
      text = `valid · ${daysLeft}d left`;
    }
    expiry.textContent = text;
    expiry.className = `text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${cls}`;
  }

  function renderSans(sans: string[]) {
    sansWrap.innerHTML = '';
    if (!sans.length) {
      const none = document.createElement('span');
      none.className = 'text-xs text-muted';
      none.textContent = 'no subject alternative names';
      sansWrap.appendChild(none);
      return;
    }
    for (const s of sans) {
      const chip = document.createElement('span');
      chip.className = 'text-[11px] font-mono px-2 py-0.5 rounded-sm bg-bg border border-rule text-ink';
      chip.textContent = s;
      sansWrap.appendChild(chip);
    }
  }

  async function decode() {
    const raw = input.value.trim();
    if (!raw) {
      clearError();
      resetFields();
      return;
    }
    // Only flag an error after the user has typed something non-trivial.
    const nonTrivial = raw.length > 24;
    try {
      const info = await decodeCert(raw);
      clearError();
      $('cert-field-subject').textContent = info.subject;
      $('cert-field-issuer').textContent = info.issuer + (info.selfSigned ? '  (self-signed)' : '');
      $('cert-field-serial').textContent = info.serial;
      $('cert-field-keyAlg').textContent = info.keyAlg;
      $('cert-field-sigAlg').textContent = info.sigAlg;
      $('cert-field-notBefore').textContent = fmtDate(info.notBefore);
      $('cert-field-notAfter').textContent = fmtDate(info.notAfter);
      setExpiry(info.daysLeft);
      renderSans(info.sans);
      sha256El.textContent = info.sha256;
      sha1El.textContent = info.sha1;
    } catch {
      resetFields();
      if (nonTrivial) showError();
      else clearError();
    }
  }

  let timer: number | undefined;
  input.addEventListener('input', () => {
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(decode, 300);
  });

  function wireCopy(btn: HTMLButtonElement, source: HTMLElement) {
    btn.addEventListener('click', () => {
      const text = source.textContent ?? '';
      if (!text || text === '—') return;
      navigator.clipboard.writeText(text);
      const orig = btn.textContent;
      btn.textContent = 'copied';
      btn.classList.add('text-ok', 'border-ok');
      setTimeout(() => {
        btn.textContent = orig;
        btn.classList.remove('text-ok', 'border-ok');
      }, 1200);
    });
  }
  wireCopy($('cert-sha256-copy') as HTMLButtonElement, sha256El);
  wireCopy($('cert-sha1-copy') as HTMLButtonElement, sha1El);

  sampleBtn.addEventListener('click', () => {
    input.value = SAMPLE_CERT;
    decode();
  });
}
