// QR code generator (qrcode-generator). Renders crisp SVG with a quiet zone and
// custom colors; exports SVG or PNG. The encoded text never leaves the page.

import qrcode from 'qrcode-generator';

type Ecc = 'L' | 'M' | 'Q' | 'H';
const QUIET = 4; // modules of margin, per the QR spec
const SAMPLE = 'https://tabzero.example';

function $(id: string) { return document.getElementById(id)!; }

let ecc: Ecc = 'M';

function buildSvg(text: string, fg: string, bg: string): string {
  const qr = qrcode(0, ecc);
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const size = n + QUIET * 2;
  let path = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) path += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * 8}" height="${size * 8}" shape-rendering="crispEdges" style="max-width:100%;height:auto"><rect width="${size}" height="${size}" fill="${bg}"/><path d="${path}" fill="${fg}"/></svg>`;
}

export function initQr() {
  const input = $('qr-input') as HTMLTextAreaElement;
  const fg = $('qr-fg') as HTMLInputElement;
  const bg = $('qr-bg') as HTMLInputElement;
  const holder = $('qr-svg');
  const errEl = $('qr-error');
  const dlSvg = $('qr-dl-svg');
  const dlPng = $('qr-dl-png');

  function run() {
    errEl.classList.add('hidden');
    if (!input.value) { holder.innerHTML = ''; return; }
    try {
      holder.innerHTML = buildSvg(input.value, fg.value, bg.value);
    } catch (e) {
      holder.innerHTML = '';
      errEl.textContent = `Could not encode: ${(e as Error).message}. Try less text or a lower error-correction level.`;
      errEl.classList.remove('hidden');
    }
  }

  for (const b of document.querySelectorAll<HTMLButtonElement>('.qr-ecc-btn')) {
    b.addEventListener('click', () => {
      ecc = b.dataset.qrEcc as Ecc;
      for (const x of document.querySelectorAll<HTMLButtonElement>('.qr-ecc-btn')) {
        const active = x.dataset.qrEcc === ecc;
        x.classList.toggle('bg-bg', active);
        x.classList.toggle('text-accent', active);
        x.classList.toggle('text-muted', !active);
      }
      run();
    });
  }
  input.addEventListener('input', run);
  fg.addEventListener('input', run);
  bg.addEventListener('input', run);

  dlSvg.addEventListener('click', () => {
    const svg = holder.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'qr.svg'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  dlPng.addEventListener('click', () => {
    const svg = holder.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const px = 512;
      const canvas = document.createElement('canvas');
      canvas.width = px; canvas.height = px;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, px, px);
      canvas.toBlob((png) => {
        if (!png) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(png); a.download = 'qr.png'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, 'image/png');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

  input.value = SAMPLE;
  run();
}
