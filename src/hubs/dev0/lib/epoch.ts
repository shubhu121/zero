export interface ParsedTs { ms: number; unit: 's' | 'ms' | 'µs' | 'ns' | 'iso' | 'date'; }

/** Auto-detect numeric epoch unit by digit count, else try ISO/Date.parse. */
export function parseTimestampInput(raw: string): ParsedTs | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    const digits = s.replace('-', '').length;
    if (digits <= 11) return { ms: n * 1000, unit: 's' };
    if (digits <= 14) return { ms: n, unit: 'ms' };
    if (digits <= 17) return { ms: n / 1000, unit: 'µs' };
    return { ms: n / 1e6, unit: 'ns' };
  }
  const isIso = /^\d{4}-\d{2}-\d{2}/.test(s);
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return { ms: t, unit: isIso ? 'iso' : 'date' };
  return null;
}

export interface EpochFormats {
  unixSeconds: number; unixMillis: number; iso: string; utc: string;
  local: string; relative: string;
}

export function formatAll(ms: number, now = Date.now()): EpochFormats {
  const d = new Date(ms);
  const diff = ms - now;
  const abs = Math.abs(diff);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [1000 * 60, 'second'], [1000 * 3600, 'minute'], [1000 * 86400, 'hour'],
    [1000 * 86400 * 30, 'day'], [1000 * 86400 * 365, 'month'], [Infinity, 'year'],
  ];
  const divs = [1000, 60_000, 3_600_000, 86_400_000, 2_592_000_000, 31_536_000_000];
  let rel = 'now';
  for (let i = 0; i < units.length; i++) {
    if (abs < units[i]![0]) {
      rel = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
        .format(Math.round(diff / divs[i]!), units[i]![1]);
      break;
    }
  }
  return {
    unixSeconds: Math.floor(ms / 1000), unixMillis: Math.round(ms),
    iso: d.toISOString(), utc: d.toUTCString(),
    local: d.toLocaleString(undefined, { timeZoneName: 'short' }), relative: rel,
  };
}
