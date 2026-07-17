// Color picker & converter — HEX / RGB / HSL / HSV plus a WCAG contrast check
// against black and white. All local.

import { normalizeHex, hexToRgb, rgbToHsl, rgbToHsv, contrastRatio } from '../../lib/color';

function $(id: string) { return document.getElementById(id)!; }

function fmtAA(ratio: number): string {
  const r = ratio.toFixed(2);
  if (ratio >= 7) return `${r} · AAA`;
  if (ratio >= 4.5) return `${r} · AA`;
  if (ratio >= 3) return `${r} · AA large`;
  return `${r} · fail`;
}

export function initColor() {
  const picker = $('co-picker') as HTMLInputElement;
  const hexIn = $('co-hex') as HTMLInputElement;
  const swatch = $('co-swatch');
  const rgbEl = $('co-rgb');
  const hslEl = $('co-hsl');
  const hsvEl = $('co-hsv');
  const cWhite = $('co-contrast-white');
  const cBlack = $('co-contrast-black');

  function apply(hex: string) {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    const [r, g, b] = rgb;
    swatch.style.background = hex;
    rgbEl.textContent = `rgb(${r}, ${g}, ${b})`;
    const [h, s, l] = rgbToHsl(r, g, b);
    hslEl.textContent = `hsl(${h}, ${s}%, ${l}%)`;
    const [hh, ss, vv] = rgbToHsv(r, g, b);
    hsvEl.textContent = `hsv(${hh}, ${ss}%, ${vv}%)`;
    cWhite.textContent = fmtAA(contrastRatio(rgb, [255, 255, 255]));
    cBlack.textContent = fmtAA(contrastRatio(rgb, [0, 0, 0]));
  }

  picker.addEventListener('input', () => {
    hexIn.value = picker.value;
    apply(picker.value);
  });
  hexIn.addEventListener('input', () => {
    const norm = normalizeHex(hexIn.value);
    if (norm) { picker.value = norm; apply(norm); }
  });

  for (const btn of document.querySelectorAll<HTMLButtonElement>('.co-copy')) {
    btn.addEventListener('click', async () => {
      const el = document.getElementById(btn.dataset.coCopy!);
      const v = (btn.dataset.coCopy === 'co-hex' ? hexIn.value : el?.textContent) || '';
      if (!v) return;
      try {
        await navigator.clipboard.writeText(v);
        btn.textContent = '✓';
        setTimeout(() => (btn.textContent = 'copy'), 1000);
      } catch { /* ignore */ }
    });
  }

  picker.value = '#c2410c';
  hexIn.value = '#c2410c';
  apply('#c2410c');
}
