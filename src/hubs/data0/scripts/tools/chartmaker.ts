// Chart maker — paste CSV/TSV (first column = labels, other columns = numeric
// series) and render a bar, line or pie chart as inline SVG, exportable to SVG
// or PNG. Hand-rolled SVG (no chart library); everything runs in the browser.

import { parseDelimited, detectDelimiter } from '../../lib/csv';

type Kind = 'bar' | 'line' | 'pie';
interface Series { name: string; values: number[]; }
interface Data { labels: string[]; series: Series[]; }

const PALETTE = ['#7c3aed', '#0891b2', '#16a34a', '#d97706', '#db2777', '#2563eb', '#9333ea', '#0d9488'];
const W = 720, H = 420, mL = 56, mR = 16, mT = 40, mB = 70;
const SAMPLE = 'Quarter,Revenue,Costs\nQ1,120,80\nQ2,150,90\nQ3,170,100\nQ4,210,120';

function $(id: string) { return document.getElementById(id)!; }
function esc(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function parseData(text: string): Data {
  const rows = parseDelimited(text, detectDelimiter(text)).filter((r) => !(r.length === 1 && r[0] === ''));
  if (rows.length < 2) throw new Error('Paste a header row and at least one data row.');
  const headers = rows[0]!;
  const labels = rows.slice(1).map((r) => r[0] ?? '');
  const series: Series[] = [];
  for (let c = 1; c < headers.length; c++) {
    const values = rows.slice(1).map((r) => {
      const n = Number(String(r[c] ?? '').replace(/[, ]/g, ''));
      return Number.isFinite(n) ? n : 0;
    });
    series.push({ name: headers[c] || `series ${c}`, values });
  }
  if (!series.length) throw new Error('Need at least one numeric column besides the labels.');
  return { labels, series };
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const err = (span / count) / step;
  const mult = err >= 7.5 ? 10 : err >= 3 ? 5 : err >= 1.5 ? 2 : 1;
  const niceStep = mult * step;
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + niceStep / 2; v += niceStep) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

function legend(names: string[]): string {
  let x = mL;
  return names.map((n, i) => {
    const item = `<rect x="${x}" y="14" width="11" height="11" rx="2" fill="${PALETTE[i % PALETTE.length]}"/><text x="${x + 16}" y="23" font-size="12" fill="currentColor">${esc(n)}</text>`;
    x += 28 + n.length * 7;
    return item;
  }).join('');
}

function axesAndCartesian(d: Data, kind: 'bar' | 'line'): string {
  const all = d.series.flatMap((s) => s.values);
  const yMax = Math.max(0, ...all);
  const yMin = Math.min(0, ...all);
  const ticks = niceTicks(yMin, yMax);
  const lo = ticks[0]!, hi = ticks[ticks.length - 1]!;
  const plotH = H - mT - mB, plotW = W - mL - mR;
  const y = (v: number) => mT + plotH - ((v - lo) / (hi - lo)) * plotH;

  let svg = '';
  // y gridlines + labels
  for (const t of ticks) {
    const yy = y(t);
    svg += `<line x1="${mL}" y1="${yy}" x2="${W - mR}" y2="${yy}" stroke="currentColor" stroke-opacity="0.12"/>`;
    svg += `<text x="${mL - 8}" y="${yy + 4}" font-size="11" text-anchor="end" fill="currentColor" fill-opacity="0.7">${t}</text>`;
  }
  // x labels
  const n = d.labels.length;
  const band = plotW / n;
  const rotate = n > 8;
  d.labels.forEach((lab, i) => {
    const cx = mL + band * (i + 0.5);
    const ty = H - mB + 16;
    svg += `<text x="${cx}" y="${ty}" font-size="11" text-anchor="${rotate ? 'end' : 'middle'}" fill="currentColor" fill-opacity="0.7" ${rotate ? `transform="rotate(-35 ${cx} ${ty})"` : ''}>${esc(lab)}</text>`;
  });

  if (kind === 'bar') {
    const groupW = band * 0.8;
    const barW = groupW / d.series.length;
    d.series.forEach((s, si) => {
      s.values.forEach((v, i) => {
        const x = mL + band * i + band * 0.1 + barW * si;
        const yy = y(v), y0 = y(0);
        const top = Math.min(yy, y0), hgt = Math.abs(yy - y0);
        svg += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}" height="${hgt.toFixed(1)}" fill="${PALETTE[si % PALETTE.length]}"><title>${esc(s.name)} · ${esc(d.labels[i] ?? '')}: ${v}</title></rect>`;
      });
    });
  } else {
    d.series.forEach((s, si) => {
      const pts = s.values.map((v, i) => `${(mL + band * (i + 0.5)).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      svg += `<polyline points="${pts}" fill="none" stroke="${PALETTE[si % PALETTE.length]}" stroke-width="2"/>`;
      s.values.forEach((v, i) => {
        svg += `<circle cx="${(mL + band * (i + 0.5)).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="${PALETTE[si % PALETTE.length]}"><title>${esc(s.name)} · ${esc(d.labels[i] ?? '')}: ${v}</title></circle>`;
      });
    });
  }
  svg += `<line x1="${mL}" y1="${mT}" x2="${mL}" y2="${H - mB}" stroke="currentColor" stroke-opacity="0.4"/>`;
  svg += `<line x1="${mL}" y1="${H - mB}" x2="${W - mR}" y2="${H - mB}" stroke="currentColor" stroke-opacity="0.4"/>`;
  return svg + legend(d.series.map((s) => s.name));
}

function pie(d: Data): string {
  const s = d.series[0]!;
  const vals = s.values.map((v) => Math.abs(v));
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const cx = W / 2, cy = mT + (H - mT - mB) / 2, r = Math.min(W, H - mT - mB) / 2 - 10;
  let angle = -Math.PI / 2;
  let svg = '';
  vals.forEach((v, i) => {
    const slice = (v / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    angle += slice;
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle);
    const large = slice > Math.PI ? 1 : 0;
    const pct = ((v / total) * 100).toFixed(1);
    svg += `<path d="M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${PALETTE[i % PALETTE.length]}"><title>${esc(d.labels[i] ?? '')}: ${vals[i]} (${pct}%)</title></path>`;
  });
  return svg + legend(d.labels);
}

function buildSvg(d: Data, kind: Kind, ink: string): string {
  const body = kind === 'pie' ? pie(d) : axesAndCartesian(d, kind);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, sans-serif" style="color:${ink};max-width:100%;height:auto">${body}</svg>`;
}

let kind: Kind = 'bar';

export function initChart() {
  const input = $('ch-input') as HTMLTextAreaElement;
  const holder = $('ch-svg');
  const errEl = $('ch-error');
  const dlSvg = $('ch-dl-svg');
  const dlPng = $('ch-dl-png');

  function inkColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#18181b';
  }

  function run() {
    errEl.classList.add('hidden');
    if (!input.value.trim()) { holder.innerHTML = ''; return; }
    try {
      const data = parseData(input.value);
      holder.innerHTML = buildSvg(data, kind, inkColor());
    } catch (e) {
      holder.innerHTML = '';
      errEl.textContent = (e as Error).message;
      errEl.classList.remove('hidden');
    }
  }

  for (const b of document.querySelectorAll<HTMLButtonElement>('.ch-kind-btn')) {
    b.addEventListener('click', () => {
      kind = b.dataset.chKind as Kind;
      for (const x of document.querySelectorAll<HTMLButtonElement>('.ch-kind-btn')) {
        const active = x.dataset.chKind === kind;
        x.classList.toggle('bg-bg', active);
        x.classList.toggle('text-accent', active);
        x.classList.toggle('text-muted', !active);
      }
      run();
    });
  }
  input.addEventListener('input', run);

  dlSvg.addEventListener('click', () => {
    const svg = holder.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'chart.svg'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  dlPng.addEventListener('click', () => {
    const svg = holder.querySelector('svg');
    if (!svg) return;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#fff';
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = W * scale; canvas.height = H * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((png) => {
        if (!png) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(png); a.download = 'chart.png'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, 'image/png');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

  input.value = SAMPLE;
  run();
}
