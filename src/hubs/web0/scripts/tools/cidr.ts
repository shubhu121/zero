import { parseCidr, cidrContains, type CidrInfo } from '../../lib/cidr';

export function cidrSection() {
  const $ = (id: string) => document.getElementById(id)!;
  const input = $('cidr-input') as HTMLInputElement;
  const slider = $('cidr-prefix') as HTMLInputElement;
  const prefixOut = $('cidr-prefix-val');
  const out = $('cidr-out');
  const containsIp = $('cidr-contains-ip') as HTMLInputElement;
  const containsRes = $('cidr-contains-result');

  const FIELDS: [keyof CidrInfo, string][] = [
    ['network', 'Network'], ['broadcast', 'Broadcast'],
    ['firstHost', 'First host'], ['lastHost', 'Last host'],
    ['mask', 'Netmask'], ['wildcard', 'Wildcard'],
    ['totalAddresses', 'Total addresses'], ['usableHosts', 'Usable hosts'],
  ];

  function row(label: string, value: string): HTMLElement {
    const tr = document.createElement('div');
    tr.className = 'flex items-center gap-3 py-1.5 border-b border-rule';
    const l = document.createElement('span');
    l.className = 'label w-36 shrink-0';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'font-mono text-sm text-ink flex-1 break-all';
    v.textContent = value;
    const copy = document.createElement('button');
    copy.className = 'label text-muted hover:text-accent shrink-0';
    copy.textContent = 'copy';
    copy.addEventListener('click', () => {
      navigator.clipboard?.writeText(value);
      copy.textContent = 'copied';
      setTimeout(() => (copy.textContent = 'copy'), 1000);
    });
    tr.append(l, v, copy);
    return tr;
  }

  function checkContains() {
    const ip = containsIp.value.trim();
    if (!ip) { containsRes.textContent = ''; containsRes.className = 'label'; return; }
    const r = cidrContains(input.value, ip);
    if (r === null) { containsRes.textContent = 'invalid'; containsRes.className = 'label text-warn'; return; }
    containsRes.textContent = r ? `${ip} is inside the block` : `${ip} is NOT in the block`;
    containsRes.className = `label ${r ? 'text-ok' : 'text-err'}`;
  }

  function render() {
    const info = parseCidr(input.value);
    out.innerHTML = '';
    if (!info) {
      const e = document.createElement('p');
      e.className = 'text-err font-mono text-sm py-2';
      e.textContent = input.value.trim() ? 'Invalid CIDR. Try e.g. 10.0.0.0/16' : 'Enter a CIDR block above.';
      out.append(e);
      return;
    }
    for (const [k, label] of FIELDS) out.append(row(label, String(info[k])));
    checkContains();
  }

  function syncSliderToInput() {
    const m = input.value.trim().match(/^([\d.]+)\/(\d{1,2})$/);
    if (m) { slider.value = m[2]!; prefixOut.textContent = '/' + m[2]; }
  }

  slider.addEventListener('input', () => {
    prefixOut.textContent = '/' + slider.value;
    const ipMatch = input.value.trim().match(/^([\d.]+)/);
    const ipPart = ipMatch ? ipMatch[1] : '10.0.0.0';
    input.value = `${ipPart}/${slider.value}`;
    render();
  });
  input.addEventListener('input', () => { syncSliderToInput(); render(); });
  containsIp.addEventListener('input', checkContains);

  syncSliderToInput();
  render();
}
