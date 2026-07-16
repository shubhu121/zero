const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function decodeUlidTime(ulid: string): number | null {
  const s = ulid.trim().toUpperCase();
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(s)) return null;
  let ms = 0;
  for (const ch of s.slice(0, 10)) ms = ms * 32 + CROCKFORD.indexOf(ch);
  return ms;
}

export function decodeUuidV7Time(uuid: string): number | null {
  const m = uuid.trim().toLowerCase()
    .match(/^([0-9a-f]{8})-([0-9a-f]{4})-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  if (!m) return null;
  return parseInt(m[1]! + m[2]!, 16);
}

export type IdKind = 'uuidv7' | 'uuidv4' | 'uuid' | 'ulid' | 'unknown';
export function detectIdKind(s: string): IdKind {
  const t = s.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) return 'uuidv7';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) return 'uuidv4';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return 'uuid';
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(t)) return 'ulid';
  return 'unknown';
}
