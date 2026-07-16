// Email header parser. Extracts SPF / DKIM / DMARC verdicts from
// Authentication-Results headers, parses the Received chain, and shows the path.

const SAMPLE = `Delivered-To: alice@example.com
Received: by 2002:a25:8ec1:0:0:0:0:0 with SMTP id e1csp1234567ybr;
        Wed, 5 Jun 2024 09:23:11 -0700 (PDT)
Authentication-Results: mx.google.com;
        dkim=pass header.i=@sender.example.org header.s=default;
        spf=pass (google.com: domain of bounce@sender.example.org designates 192.0.2.1 as permitted sender) smtp.mailfrom=bounce@sender.example.org;
        dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=sender.example.org
Return-Path: <bounce@sender.example.org>
Received: from mail.sender.example.org (mail.sender.example.org. [192.0.2.1])
        by mx.google.com with ESMTPS id u14si12345678eju.123.2024.06.05.09.23.11
        for <alice@example.com>
        (version=TLS1_3 cipher=TLS_AES_128_GCM_SHA256 bits=128/128);
        Wed, 5 Jun 2024 09:23:11 -0700 (PDT)
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=sender.example.org;
        s=default; t=1717597391; h=from:subject;
        bh=2jUSOH9NhtVGCQWNr9BrIAPreKQbU8iGix9...
        b=...
From: "Sender" <news@sender.example.org>
Subject: Your weekly digest
To: alice@example.com
Date: Wed, 5 Jun 2024 16:23:08 +0000
Message-ID: <abc123@sender.example.org>
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8`;

interface AuthResult {
  spf?: { result: string; detail: string };
  dkim?: { result: string; detail: string };
  dmarc?: { result: string; detail: string };
}

function $(id: string) { return document.getElementById(id)!; }

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function unwrapAuthResults(block: string): string {
  return block.replace(/\r?\n[ \t]+/g, ' ');
}

function parseAuthResults(headers: string): AuthResult {
  const arBlocks: string[] = [];
  const re = /^Authentication-Results:\s*(.*(?:\n[ \t]+.*)*)/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(headers)) !== null) arBlocks.push(unwrapAuthResults(m[0]));
  const out: AuthResult = {};
  for (const block of arBlocks) {
    const spf = block.match(/spf=([a-z]+)\s*(\([^)]*\))?/i);
    if (spf && !out.spf) out.spf = { result: spf[1]!, detail: spf[2] ? spf[2].slice(1, -1) : '' };
    const dkim = block.match(/dkim=([a-z]+)\s*(header\.i=[^\s;]+)/i);
    if (dkim && !out.dkim) out.dkim = { result: dkim[1]!, detail: dkim[2]! };
    const dmarc = block.match(/dmarc=([a-z]+)\s*(\([^)]*\))?/i);
    if (dmarc && !out.dmarc) out.dmarc = { result: dmarc[1]!, detail: dmarc[2] ? dmarc[2].slice(1, -1) : '' };
  }
  return out;
}

function parseReceivedChain(headers: string): { from: string; by: string; when: string; ip?: string; tls?: string }[] {
  const re = /^Received:\s*(.*(?:\n[ \t]+.*)*)/gim;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(headers)) !== null) blocks.push(unwrapAuthResults(m[0]));
  return blocks.map(block => {
    const from = block.match(/from\s+([^\s\(\);]+)/i)?.[1] ?? '?';
    const by = block.match(/by\s+([^\s\(\);]+)/i)?.[1] ?? '?';
    const when = block.match(/;\s*(.+)$/m)?.[1]?.trim() ?? '?';
    const ip = block.match(/\[(\d+\.\d+\.\d+\.\d+|[\da-fA-F:]+)\]/)?.[1];
    const tls = block.match(/\(version=(TLS[\w_]+)/i)?.[1];
    return { from, by, when, ip, tls };
  }).reverse();
}

function badgeColor(result: string): string {
  if (result === 'pass') return 'text-ok border-ok';
  if (result === 'fail' || result === 'hardfail' || result === 'softfail') return 'text-err border-err';
  if (result === 'neutral' || result === 'none' || result === 'temperror' || result === 'permerror') return 'text-warn border-warn';
  return 'text-muted border-rule';
}

function renderAuth(id: string, label: string, result: AuthResult['spf']) {
  const el = $(id);
  const body = el.querySelector('div:last-child')!;
  if (!result) {
    body.innerHTML = `<div class="text-muted text-sm">No ${label} result found in headers.</div>`;
    return;
  }
  body.innerHTML = `
    <div class="flex items-center gap-2 mb-2">
      <span class="px-2 py-0.5 text-xs font-mono rounded border bg-bg ${badgeColor(result.result)}">${result.result}</span>
      <span class="label">${label}</span>
    </div>
    <div class="text-xs font-mono text-ink break-words">${escapeHtml(result.detail) || '—'}</div>
  `;
}

export function emailSection() {
  const input = $('email-input') as HTMLTextAreaElement;
  const loadSample = $('email-load-sample');
  const hopsEl = $('email-hops');

  function run() {
    const headers = input.value;
    if (!headers.trim()) return;
    const auth = parseAuthResults(headers);
    renderAuth('email-spf', 'SPF', auth.spf);
    renderAuth('email-dkim', 'DKIM', auth.dkim);
    renderAuth('email-dmarc', 'DMARC', auth.dmarc);
    const hops = parseReceivedChain(headers);
    hopsEl.innerHTML = hops.length === 0
      ? '<li class="p-4 text-muted">No Received headers found.</li>'
      : hops.map((h, i) => `
        <li class="px-4 py-2.5">
          <div class="text-accent mb-0.5">${i + 1}. from <span class="text-ink">${escapeHtml(h.from)}</span></div>
          <div class="text-muted text-[11px]">to <span class="text-ink">${escapeHtml(h.by)}</span>${h.ip ? ` · ${escapeHtml(h.ip)}` : ''}${h.tls ? ` · ${escapeHtml(h.tls)}` : ''}</div>
          <div class="text-muted text-[11px] mt-0.5">${escapeHtml(h.when)}</div>
        </li>
      `).join('');
  }

  input.addEventListener('input', run);
  loadSample.addEventListener('click', () => { input.value = SAMPLE; run(); });

  if (!input.value) { input.value = SAMPLE; run(); }
}
