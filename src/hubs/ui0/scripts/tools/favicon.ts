// Favicon generator — render a letter or emoji on a colored shape to a canvas,
// preview it, and download PNGs at common sizes. All local (Canvas).

type Shape = 'square' | 'rounded' | 'circle';

function $(id: string) { return document.getElementById(id)!; }

let shape: Shape = 'rounded';

function draw(canvas: HTMLCanvasElement, size: number, text: string, bg: string, fg: string) {
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = bg;
  if (shape === 'circle') {
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.fill();
  } else if (shape === 'rounded') {
    const r = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.arcTo(size, 0, size, size, r); ctx.arcTo(size, size, 0, size, r);
    ctx.arcTo(0, size, 0, 0, r); ctx.arcTo(0, 0, size, 0, r); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillRect(0, 0, size, size);
  }
  const chars = [...text];
  if (chars.length) {
    const label = chars.slice(0, 2).join('');
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const scale = label.length > 1 ? 0.46 : 0.6;
    ctx.font = `700 ${Math.round(size * scale)}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    ctx.fillText(label, size / 2, size * 0.54);
  }
}

export function initFavicon() {
  const text = $('fv-text') as HTMLInputElement;
  const bg = $('fv-bg') as HTMLInputElement;
  const fg = $('fv-fg') as HTMLInputElement;
  const preview = $('fv-preview') as HTMLCanvasElement;

  function run() {
    draw(preview, 256, text.value, bg.value, fg.value);
  }

  for (const b of document.querySelectorAll<HTMLButtonElement>('.fv-shape-btn')) {
    b.addEventListener('click', () => {
      shape = b.dataset.fvShape as Shape;
      for (const x of document.querySelectorAll<HTMLButtonElement>('.fv-shape-btn')) {
        const active = x.dataset.fvShape === shape;
        x.classList.toggle('bg-bg', active);
        x.classList.toggle('text-accent', active);
        x.classList.toggle('text-muted', !active);
      }
      run();
    });
  }
  [text, bg, fg].forEach((el) => el.addEventListener('input', run));

  for (const b of document.querySelectorAll<HTMLButtonElement>('.fv-dl')) {
    b.addEventListener('click', () => {
      const size = Number(b.dataset.fvDl);
      const c = document.createElement('canvas');
      draw(c, size, text.value, bg.value, fg.value);
      c.toBlob((png) => {
        if (!png) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(png); a.download = `favicon-${size}.png`; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, 'image/png');
    });
  }

  text.value = 'ui';
  bg.value = '#c2410c';
  fg.value = '#ffffff';
  run();
}
