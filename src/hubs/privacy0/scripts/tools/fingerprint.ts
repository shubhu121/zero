export interface FpAttribute {
  label: string;
  value: string;
  mitigation: string;
  risk: 'low' | 'medium' | 'high';
}

async function canvasHash(): Promise<string> {
  const c = document.createElement('canvas');
  c.width = 200; c.height = 50;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f60';
  ctx.fillRect(0, 0, 200, 50);
  ctx.fillStyle = '#069';
  ctx.font = '14px sans-serif';
  ctx.fillText('privacy0 fingerprint', 4, 32);
  const data = c.toDataURL();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function collectFingerprint(): Promise<FpAttribute[]> {
  const attrs: FpAttribute[] = [];

  attrs.push({
    label: 'User Agent',
    value: navigator.userAgent,
    mitigation: 'Use a user agent randomizer extension.',
    risk: 'high',
  });

  attrs.push({
    label: 'Platform',
    value: navigator.platform,
    mitigation: 'Partially masked in modern browsers; Tor Browser returns "Win32".',
    risk: 'medium',
  });

  attrs.push({
    label: 'Language',
    value: navigator.language + (navigator.languages ? ' (' + navigator.languages.join(', ') + ')' : ''),
    mitigation: 'Set browser language to "en-US" to blend in.',
    risk: 'medium',
  });

  attrs.push({
    label: 'Screen',
    value: `${screen.width}×${screen.height} @ ${window.devicePixelRatio}x (avail: ${screen.availWidth}×${screen.availHeight})`,
    mitigation: 'Use a browser set to a common resolution (1920×1080).',
    risk: 'high',
  });

  attrs.push({
    label: 'Timezone',
    value: Intl.DateTimeFormat().resolvedOptions().timeZone + ` (UTC${-new Date().getTimezoneOffset() / 60 >= 0 ? '+' : ''}${-new Date().getTimezoneOffset() / 60})`,
    mitigation: 'Use a VPN and set browser timezone to UTC.',
    risk: 'medium',
  });

  attrs.push({
    label: 'Color Depth',
    value: `${screen.colorDepth}-bit`,
    mitigation: 'Low uniqueness; most screens report 24-bit.',
    risk: 'low',
  });

  attrs.push({
    label: 'Hardware Concurrency',
    value: String(navigator.hardwareConcurrency ?? 'unknown'),
    mitigation: 'Firefox reports 2 by default for fingerprint resistance.',
    risk: 'medium',
  });

  attrs.push({
    label: 'Device Memory',
    value: ('deviceMemory' in navigator ? (navigator as { deviceMemory: number }).deviceMemory + ' GB' : 'not exposed'),
    mitigation: 'Firefox does not expose this value.',
    risk: 'low',
  });

  attrs.push({
    label: 'Do Not Track',
    value: navigator.doNotTrack ?? 'not set',
    mitigation: 'Setting DNT can paradoxically make you more unique.',
    risk: 'low',
  });

  attrs.push({
    label: 'Cookie Enabled',
    value: String(navigator.cookieEnabled),
    mitigation: 'Block third-party cookies; enable first-party isolation.',
    risk: 'low',
  });

  const hash = await canvasHash();
  attrs.push({
    label: 'Canvas Hash',
    value: hash,
    mitigation: 'Enable canvas fingerprint blocking (Brave, Firefox RFP, or extensions).',
    risk: 'high',
  });

  const gpuInfo = (() => {
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      if (!gl) return 'WebGL unavailable';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (!ext) return 'WEBGL_debug_renderer_info unavailable';
      return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
    } catch { return 'error'; }
  })();
  attrs.push({
    label: 'WebGL Renderer',
    value: gpuInfo,
    mitigation: 'Firefox RFP and Brave block this. Tor Browser returns generic string.',
    risk: 'high',
  });

  return attrs;
}

export function initFingerprint(): void {
  const container = document.getElementById('fp-results')!;
  const scanBtn = document.getElementById('fp-scan')!;

  scanBtn.addEventListener('click', async () => {
    scanBtn.setAttribute('disabled', 'true');
    scanBtn.textContent = 'Scanning…';
    container.innerHTML = '';
    try {
      const attrs = await collectFingerprint();
      const grid = document.createElement('div');
      grid.className = 'space-y-3';
      for (const attr of attrs) {
        const card = document.createElement('div');
        card.className = 'p-3 rounded border border-rule bg-raised';
        const header = document.createElement('div');
        header.className = 'flex items-baseline gap-2 mb-1';
        const lbl = document.createElement('span');
        lbl.className = 'text-xs font-medium uppercase tracking-widest text-muted';
        lbl.textContent = attr.label;
        const risk = document.createElement('span');
        risk.className = `text-xs px-1.5 py-0.5 rounded risk-${attr.risk}`;
        risk.textContent = attr.risk;
        header.appendChild(lbl);
        header.appendChild(risk);
        const val = document.createElement('p');
        val.className = 'text-sm font-mono text-ink break-all mb-1';
        val.textContent = attr.value;
        const tip = document.createElement('p');
        tip.className = 'text-xs text-muted';
        tip.textContent = attr.mitigation;
        card.appendChild(header);
        card.appendChild(val);
        card.appendChild(tip);
        grid.appendChild(card);
      }
      container.appendChild(grid);
    } catch (e) {
      container.innerHTML = `<p class="text-err text-sm">${(e as Error).message}</p>`;
    } finally {
      scanBtn.removeAttribute('disabled');
      scanBtn.textContent = 'Scan again';
    }
  });
}
