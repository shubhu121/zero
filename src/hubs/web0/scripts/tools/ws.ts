interface Frame { dir: 'in' | 'out' | 'sys'; text: string; ts: number; }

export function wsSection() {
  const $ = (id: string) => document.getElementById(id)!;
  const urlInput = $('ws-url') as HTMLInputElement;
  const connectBtn = $('ws-connect') as HTMLButtonElement;
  const sendInput = $('ws-send') as HTMLTextAreaElement;
  const sendBtn = $('ws-send-btn') as HTMLButtonElement;
  const log = $('ws-log');
  const status = $('ws-status');
  const presetsEl = $('ws-presets');
  let sock: WebSocket | null = null;
  const frames: Frame[] = [];

  const PRESETS_KEY = 'web0-ws-presets';
  const presets = (): string[] => { try { return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]'); } catch { return []; } };
  const savePreset = (u: string) => {
    localStorage.setItem(PRESETS_KEY, JSON.stringify([...new Set([u, ...presets()])].slice(0, 8)));
    renderPresets();
  };

  function renderPresets() {
    presetsEl.innerHTML = '';
    for (const u of presets()) {
      const chip = document.createElement('button');
      chip.className = 'label text-muted hover:text-accent border border-rule rounded px-2 py-1';
      chip.textContent = u;
      chip.addEventListener('click', () => { urlInput.value = u; });
      presetsEl.append(chip);
    }
  }

  function push(dir: Frame['dir'], text: string) {
    frames.push({ dir, text, ts: Date.now() });
    const row = document.createElement('div');
    row.className = 'py-1.5 border-b border-rule flex gap-3 font-mono text-sm';
    const arrow = dir === 'in' ? '←' : dir === 'out' ? '→' : '·';
    const cls = dir === 'in' ? 'text-accent' : dir === 'out' ? 'text-ink' : 'text-muted';
    const ts = document.createElement('span'); ts.className = 'text-muted shrink-0'; ts.textContent = new Date().toLocaleTimeString();
    const ar = document.createElement('span'); ar.className = `${cls} shrink-0`; ar.textContent = arrow;
    const body = document.createElement('span'); body.className = `${cls} break-all`;
    body.textContent = text;                    // textContent — never innerHTML for frame data
    row.append(ts, ar, body);
    log.prepend(row);
  }

  function setState(s: 'idle' | 'connecting' | 'open' | 'closed') {
    status.textContent = s;
    status.className = `label ${s === 'open' ? 'text-ok' : s === 'connecting' ? 'text-warn' : 'text-muted'}`;
    connectBtn.textContent = s === 'open' || s === 'connecting' ? 'Disconnect' : 'Connect';
    sendBtn.toggleAttribute('disabled', s !== 'open');
  }

  connectBtn.addEventListener('click', () => {
    if (sock && sock.readyState <= WebSocket.OPEN) { sock.close(); return; }
    let url = urlInput.value.trim();
    if (!url) { push('sys', 'enter a ws:// or wss:// URL first'); return; }
    if (!/^wss?:\/\//.test(url)) url = 'wss://' + url;
    try { sock = new WebSocket(url); } catch (e) { push('sys', `invalid URL: ${(e as Error).message}`); return; }
    setState('connecting');
    push('sys', `connecting to ${url}`);
    sock.onopen = () => { setState('open'); push('sys', 'connected'); savePreset(url); };
    sock.onmessage = (ev) => push('in', typeof ev.data === 'string' ? ev.data : `[binary ${(ev.data as Blob).size}B]`);
    sock.onerror = () => push('sys', 'error (see console; browsers hide WS error details)');
    sock.onclose = (ev) => { setState('closed'); push('sys', `closed · code ${ev.code}${ev.reason ? ` · ${ev.reason}` : ''}`); };
  });

  sendBtn.addEventListener('click', () => {
    if (sock?.readyState === WebSocket.OPEN && sendInput.value) {
      sock.send(sendInput.value);
      push('out', sendInput.value);
      sendInput.value = '';
    }
  });
  sendInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') sendBtn.click();
  });
  setState('idle');
  renderPresets();
}
