// Cron parser: human-readable explanation. Occurrence finding via croner (src/lib/cronx).
// Supports 5-field standard cron, @-aliases, IANA timezones, and 6-field (seconds).
import { nextRunsTz, normalizeExpr } from '../../lib/cronx';

const FIELD_NAMES = ['minute', 'hour', 'day of month', 'month', 'day of week'] as const;
const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface CronField {
  values: number[];   // sorted unique
  raw: string;        // original text
  step?: number;      // if `*/N`
}

const MAX_VALUES = [59, 23, 31, 12, 7]; // inclusive max for each field (0-based for DOW: 0=Sun)

function parseField(raw: string, min: number, max: number): CronField {
  const trimmed = raw.trim();
  let step = 1;
  let body = trimmed;
  if (trimmed.includes('/')) {
    const [b, s] = trimmed.split('/');
    body = b!;
    step = Math.max(1, parseInt(s || '1', 10));
  }
  const out = new Set<number>();
  for (const part of body.split(',')) {
    const p = part.trim();
    if (p === '*') {
      for (let v = min; v <= max; v++) out.add(v);
    } else if (p.includes('-')) {
      const [lo, hi] = p.split('-').map(x => parseInt(x, 10));
      if (isNaN(lo!) || isNaN(hi!)) throw new Error(`bad range: ${p}`);
      for (let v = lo!; v <= hi!; v++) out.add(v);
    } else {
      const v = parseInt(p, 10);
      if (isNaN(v)) throw new Error(`bad value: ${p}`);
      out.add(v);
    }
  }
  if (step > 1) {
    const minVal = Math.min(...out);
    const stepped = new Set<number>();
    for (let v = minVal; v <= max; v += step) stepped.add(v);
    return { values: [...stepped].sort((a, b) => a - b), raw: trimmed, step };
  }
  return { values: [...out].sort((a, b) => a - b), raw: trimmed };
}

export interface ParsedCron {
  fields: [CronField, CronField, CronField, CronField, CronField];
  raw: string;
}

export function parseCron(expr: string): ParsedCron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`expected 5 fields, got ${parts.length}`);
  }
  const mins = parseField(parts[0]!, 0, MAX_VALUES[0]!);
  const hours = parseField(parts[1]!, 0, MAX_VALUES[1]!);
  const doms = parseField(parts[2]!, 1, MAX_VALUES[2]!);
  const months = parseField(parts[3]!, 1, MAX_VALUES[3]!);
  const dows = parseField(parts[4]!, 0, MAX_VALUES[4]!);
  return { fields: [mins, hours, doms, months, dows], raw: expr.trim() };
}

function fieldDescription(f: CronField, max: number, isDow: boolean): string {
  if (f.raw === '*') return 'every';
  if (f.raw.startsWith('*/')) return `every ${f.raw.slice(2)}`;
  if (f.raw.includes(',')) return `on ${f.raw}`;
  if (f.raw.includes('-')) {
    const [lo, hi] = f.raw.split('-');
    if (isDow) return `on ${DOW_NAMES[parseInt(lo!, 10)]}-${DOW_NAMES[parseInt(hi!, 10)]}`;
    if (max === 12) return `in months ${lo}-${hi}`;
    if (max === 31) return `on day ${lo}-${hi} of the month`;
    if (max === 23) return `during hours ${lo}-${hi}`;
    return `values ${lo}-${hi}`;
  }
  const v = parseInt(f.raw, 10);
  if (isNaN(v)) return f.raw;
  if (isDow) return `on ${DOW_NAMES[v]}`;
  if (max === 12) return `in ${MONTH_NAMES[v]}`;
  return `at ${v}`;
}

export function explain(parsed: ParsedCron): string {
  const [mins, hours, doms, months, dows] = parsed.fields;
  return `Runs ${fieldDescription(mins, 60, false)} minute, ${fieldDescription(hours, 23, false)}, ${fieldDescription(doms, 31, false)}, ${fieldDescription(months, 12, false)}, ${fieldDescription(dows, 7, true)}.`;
}

function $(id: string) { return document.getElementById(id)!; }

const CURATED_ZONES = [
  'Asia/Kolkata', 'America/New_York', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney',
];

function populateTz(tz: HTMLSelectElement) {
  // Only build once; the .astro markup may ship a stub select.
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  tz.innerHTML = '';
  const opts: [string, string][] = [
    ['local', `Local (${local})`],
    ['UTC', 'UTC'],
    ...CURATED_ZONES.map((z) => [z, z] as [string, string]),
  ];
  for (const [value, label] of opts) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    tz.appendChild(o);
  }
}

// Plain-English line. Handles @-aliases and 6-field (seconds-first) exprs.
function explainLine(rawExpr: string): string {
  const normalized = normalizeExpr(rawExpr);
  const tokens = normalized.split(/\s+/);
  try {
    if (tokens.length === 6) {
      // 6-field croner is `s m h dom mon dow` — explain the minute-level fields.
      const base = explain(parseCron(tokens.slice(1).join(' ')));
      return `${base} (seconds field handled separately.)`;
    }
    return explain(parseCron(normalized));
  } catch {
    return '—';
  }
}

export function cronSection() {
  const input = $('cron-input') as HTMLInputElement;
  const tz = $('cron-tz') as HTMLSelectElement;
  const errEl = $('cron-error');
  const nextList = $('cron-next');
  const explainEl = $('cron-explain');

  populateTz(tz);

  function run() {
    errEl.classList.add('hidden');
    nextList.innerHTML = '';
    const isUtc = tz.value === 'UTC';
    try {
      const runs = nextRunsTz(input.value, 10, tz.value);
      const frag = document.createDocumentFragment();
      for (const r of runs) {
        const li = document.createElement('li');
        li.className = 'px-4 py-2 flex items-center justify-between hover:bg-bg transition-colors';
        const left = document.createElement('span');
        left.className = 'text-ink';
        left.textContent = (isUtc ? r.toISOString() : r.toLocaleString()).replace('T', ' ').slice(0, 19);
        const right = document.createElement('span');
        const diff = r.getTime() - Date.now();
        right.className = 'text-xs text-muted';
        if (diff < 60_000) right.textContent = 'in <1 min';
        else if (diff < 3_600_000) right.textContent = `in ${Math.round(diff / 60_000)} min`;
        else if (diff < 86_400_000) right.textContent = `in ${Math.round(diff / 3_600_000)} h`;
        else right.textContent = `in ${Math.round(diff / 86_400_000)} d`;
        li.append(left, right);
        frag.appendChild(li);
      }
      nextList.appendChild(frag);
      explainEl.textContent = explainLine(input.value);
    } catch (e) {
      errEl.textContent = (e as Error).message;
      errEl.classList.remove('hidden');
      explainEl.textContent = explainLine(input.value);
    }
  }

  input.addEventListener('input', run);
  tz.addEventListener('change', run);

  if (!input.value) input.value = '*/15 9-17 * * 1-5';
  run();
}
