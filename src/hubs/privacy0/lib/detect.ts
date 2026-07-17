import { luhnValid, verhoeffValid } from './checksums';

export type PiiKind = 'email' | 'phone' | 'ssn' | 'card' | 'aadhaar' | 'pan' | 'ip' | 'iban';
export interface Span { kind: PiiKind; text: string; start: number; end: number; }

interface Rule { kind: PiiKind; re: RegExp; validate?: (s: string) => boolean; }

const RULES: Rule[] = [
  { kind: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // cards before phone (16 digits would otherwise partially match phone)
  { kind: 'card', re: /\b(?:\d[ -]?){12,19}\b/g,
    validate: (s) => luhnValid(s) },
  { kind: 'aadhaar', re: /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g,
    validate: (s) => verhoeffValid(s.replace(/[ -]/g, '')) && s.replace(/[ -]/g, '').length === 12 },
  { kind: 'ssn', re: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g },
  { kind: 'pan', re: /\b[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]\b/g },
  { kind: 'phone', re: /(?:\+\d{1,3}[ -]?)?(?:\(\d{2,4}\)[ -]?)?\d{3,5}[ -]?\d{3,5}(?:[ -]?\d{2,4})?/g,
    validate: (s) => { const d = s.replace(/\D/g, ''); return d.length >= 10 && d.length <= 13 && /[+()\- ]/.test(s); } },
  { kind: 'ip', re: /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g,
    validate: (s) => !/^v?\d+\.\d+\.\d+$/.test(s) },
  { kind: 'iban', re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
];

export function detectPII(text: string): Span[] {
  const spans: Span[] = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(text)) !== null) {
      const candidate = m[0];
      if (rule.validate && !rule.validate(candidate)) continue;
      const start = m.index, end = m.index + candidate.length;
      if (spans.some((s) => start < s.end && end > s.start)) continue; // earlier rules win
      spans.push({ kind: rule.kind, text: candidate, start, end });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}
