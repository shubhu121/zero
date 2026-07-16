// RDAP: registration data over HTTPS+JSON. ICANN's gTLD RDAP profile requires
// Access-Control-Allow-Origin: * — so this works fully client-side for gTLDs.
// Some ccTLDs (.de, .uk, …) run non-CORS or no RDAP — fail honestly for those.

interface RdapEvent { eventAction: string; eventDate: string; }

export async function lookup(query: string): Promise<any> {
  const q = query.trim().toLowerCase();
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+:[0-9a-f:]*$/i.test(q);
  const url = isIp
    ? `https://rdap.org/ip/${q}`
    : `https://rdap.org/domain/${q.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}`;
  const res = await fetch(url, { headers: { Accept: 'application/rdap+json' } });
  if (res.status === 404) throw new Error('not found in any RDAP registry');
  if (!res.ok) throw new Error(`registry returned ${res.status}`);
  return res.json();
}

export function summarize(data: any) {
  const events: RdapEvent[] = data.events ?? [];
  const ev = (action: string) => events.find((e) => e.eventAction === action)?.eventDate;
  const registrar = (data.entities ?? []).find((e: any) => (e.roles ?? []).includes('registrar'));
  const registrarName = registrar?.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3];
  return {
    handle: data.handle ?? data.ldhName ?? '—',
    name: data.ldhName ?? data.name ?? '—',
    status: (data.status ?? []).join(', ') || '—',
    registered: ev('registration'), expires: ev('expiration'), updated: ev('last changed'),
    registrar: registrarName ?? '—',
    nameservers: (data.nameservers ?? []).map((n: any) => n.ldhName).filter(Boolean) as string[],
  };
}

export function rdapSection() {
  const $ = (id: string) => document.getElementById(id)!;
  const input = $('rdap-input') as HTMLInputElement;
  const btn = $('rdap-btn') as HTMLButtonElement;
  const status = $('rdap-status');
  const out = $('rdap-out');
  const rawWrap = $('rdap-raw-wrap');
  const raw = $('rdap-raw');

  function showStatus(text: string, kind: 'info' | 'ok' | 'err' = 'info') {
    status.textContent = text;
    status.className = `label ${kind === 'err' ? 'text-err' : kind === 'ok' ? 'text-ok' : 'text-muted'}`;
  }

  function field(label: string, value: string, cls = 'text-ink'): HTMLElement {
    const tr = document.createElement('div');
    tr.className = 'flex items-baseline gap-3 py-1.5 border-b border-rule';
    const l = document.createElement('span'); l.className = 'label w-32 shrink-0'; l.textContent = label;
    const v = document.createElement('span'); v.className = `font-mono text-sm ${cls} flex-1 break-all`; v.textContent = value;
    tr.append(l, v); return tr;
  }

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(+dt) ? d : dt.toISOString().slice(0, 10);
  };

  async function run() {
    const q = input.value.trim();
    if (!q) { showStatus('Enter a domain or IP', 'err'); return; }
    btn.setAttribute('disabled', 'true');
    out.innerHTML = ''; rawWrap.classList.add('hidden');
    showStatus(`Looking up ${q}…`);
    const t0 = performance.now();
    try {
      const data = await lookup(q);
      const dt = Math.round(performance.now() - t0);
      const s = summarize(data);
      out.append(field('Handle', s.handle));
      out.append(field('Name', s.name));
      out.append(field('Status', s.status));
      out.append(field('Registrar', s.registrar));
      out.append(field('Registered', fmtDate(s.registered)));
      let expCls = 'text-ink';
      if (s.expires) {
        const days = (new Date(s.expires).getTime() - Date.now()) / 86400000;
        expCls = days < 0 ? 'text-err' : days < 30 ? 'text-warn' : 'text-ink';
      }
      out.append(field('Expires', fmtDate(s.expires), expCls));
      out.append(field('Updated', fmtDate(s.updated)));
      if (s.nameservers.length) out.append(field('Nameservers', s.nameservers.join(', ')));
      raw.textContent = JSON.stringify(data, null, 2);
      rawWrap.classList.remove('hidden');
      showStatus(`Done in ${dt}ms`, 'ok');
    } catch (e) {
      const msg = (e as Error).message;
      const friendly = /Failed to fetch|NetworkError|load failed/i.test(msg)
        ? "this registry doesn't allow browser access (no CORS); RDAP works best for gTLDs (.com .org .dev .io …)"
        : msg;
      showStatus(friendly, 'err');
    } finally {
      btn.removeAttribute('disabled');
    }
  }
  btn.addEventListener('click', run);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
}
