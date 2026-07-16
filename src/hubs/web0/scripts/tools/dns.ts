// DNS lookup via Cloudflare DNS-over-HTTPS. Pure browser fetch, no backend.

type DnsType = 'A' | 'AAAA' | 'MX' | 'TXT' | 'NS' | 'CNAME' | 'CAA';

function $(id: string) { return document.getElementById(id)!; }

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function showStatus(text: string, kind: 'info' | 'error' = 'info') {
  const el = $('dns-status');
  el.textContent = text;
  el.classList.remove('hidden', 'text-muted', 'text-err');
  el.classList.add(kind === 'error' ? 'text-err' : 'text-muted');
}

interface DnsAnswer { name: string; type: number; TTL: number; data: string; }

const TYPE_NAMES: Record<number, string> = {
  1: 'A', 2: 'NS', 5: 'CNAME', 15: 'MX', 16: 'TXT', 28: 'AAAA', 257: 'CAA',
};

export function dnsSection() {
  const domain = $('dns-domain') as HTMLInputElement;
  const typeSel = $('dns-type') as HTMLSelectElement;
  const goBtn = $('dns-lookup-btn');
  const listEl = $('dns-records');

  async function run() {
    const d = domain.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!d) { showStatus('Enter a domain first', 'error'); return; }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)) { showStatus('Invalid domain', 'error'); return; }
    const t = typeSel.value as DnsType;
    goBtn.setAttribute('disabled', 'true');
    listEl.innerHTML = `<li class="p-4 text-muted text-sm">Looking up ${t} records…</li>`;
    showStatus(`Querying Cloudflare DoH for ${d} ${t}…`);
    const t0 = performance.now();
    try {
      const url = `https://1.1.1.1/dns-query?name=${encodeURIComponent(d)}&type=${t}`;
      const res = await fetch(url, { headers: { Accept: 'application/dns-json' } });
      if (!res.ok) throw new Error(`Cloudflare returned ${res.status}`);
      const data = await res.json();
      const dt = Math.round(performance.now() - t0);
      if (data.Status !== 0) {
        const rcode: Record<number, string> = { 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED' };
        showStatus(`DNS error: ${rcode[data.Status] || `code ${data.Status}`}`, 'error');
        listEl.innerHTML = `<li class="p-4 text-err text-sm">Query failed: ${rcode[data.Status] || `rcode ${data.Status}`}</li>`;
        return;
      }
      const answers: DnsAnswer[] = data.Answer || [];
      if (answers.length === 0) {
        listEl.innerHTML = `<li class="p-4 text-muted text-sm">No ${t} records found for ${escapeHtml(d)}.</li>`;
        showStatus(`Done in ${dt}ms · 0 records`);
        return;
      }
      const html = answers.map(a => {
        const tName = TYPE_NAMES[a.type] || `T${a.type}`;
        const cls = tName === t ? 'text-accent' : 'text-warn';
        return `<li class="px-4 py-2.5 font-mono text-sm">
          <div class="flex items-baseline gap-2 flex-wrap">
            <span class="label ${cls}">${tName}</span>
            <span class="text-ink break-all flex-1 min-w-0">${escapeHtml(a.data)}</span>
            <span class="label text-muted">TTL ${a.TTL}s</span>
          </div>
        </li>`;
      }).join('');
      listEl.innerHTML = html;
      showStatus(`Done in ${dt}ms · ${answers.length} record${answers.length === 1 ? '' : 's'}`);
    } catch (e) {
      showStatus(`Lookup failed: ${(e as Error).message}`, 'error');
      listEl.innerHTML = `<li class="p-4 text-err text-sm">${escapeHtml((e as Error).message)}</li>`;
    } finally {
      goBtn.removeAttribute('disabled');
    }
  }

  goBtn.addEventListener('click', run);
  domain.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
  typeSel.addEventListener('change', run);
}
