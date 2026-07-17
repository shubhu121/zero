import type { Span } from './detect';

export type Style = 'placeholder' | 'mask';

export function applyRedactions(text: string, spans: Span[], enabled: Set<number>, style: Style): string {
  const valueIndex = new Map<string, number>();
  const counter: Record<string, number> = {};
  // assign consistent placeholder numbers per (kind, value), in span order
  for (const [i, s] of spans.entries()) {
    if (!enabled.has(i)) continue;
    const k = `${s.kind}:${s.text}`;
    if (!valueIndex.has(k)) {
      counter[s.kind] = (counter[s.kind] ?? 0) + 1;
      valueIndex.set(k, counter[s.kind]!);
    }
  }
  let out = '';
  let cursor = 0;
  for (const [i, s] of spans.entries()) {
    if (!enabled.has(i)) continue;
    out += text.slice(cursor, s.start);
    out += style === 'mask'
      ? '█'.repeat(s.text.length)
      : `[${s.kind.toUpperCase()}-${valueIndex.get(`${s.kind}:${s.text}`)}]`;
    cursor = s.end;
  }
  return out + text.slice(cursor);
}
