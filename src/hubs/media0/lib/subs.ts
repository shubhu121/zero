export interface Segment { start: number; end: number; text: string; }

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
function clock(s: number): { h: string; m: string; sec: string; ms: string } {
  return {
    h: pad(Math.floor(s / 3600)), m: pad(Math.floor((s % 3600) / 60)),
    sec: pad(Math.floor(s % 60)), ms: pad(Math.round((s % 1) * 1000), 3),
  };
}
export const srtTime = (s: number) => { const c = clock(s); return `${c.h}:${c.m}:${c.sec},${c.ms}`; };
export const vttTime = (s: number) => { const c = clock(s); return `${c.h}:${c.m}:${c.sec}.${c.ms}`; };

export const toSrt = (segs: Segment[]) =>
  segs.map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text.trim()}\n`).join('\n');

export const toVtt = (segs: Segment[]) =>
  'WEBVTT\n\n' + segs.map((s) => `${vttTime(s.start)} --> ${vttTime(s.end)}\n${s.text.trim()}\n`).join('\n');
