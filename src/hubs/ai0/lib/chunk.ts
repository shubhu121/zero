export interface Chunk { text: string; page: number; }
const MAX = 1500;       // chars ≈ 350–400 tokens
const OVERLAP = 200;

export function chunkText(text: string, meta: { page: number }): Chunk[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX) return clean ? [{ text: clean, page: meta.page }] : [];
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [clean];
  const chunks: Chunk[] = [];
  let cur = '';
  for (const s of sentences) {
    if (cur.length + s.length > MAX && cur) {
      chunks.push({ text: cur.trim(), page: meta.page });
      cur = cur.slice(-OVERLAP);            // carry overlap into next chunk
    }
    cur += s;
  }
  if (cur.trim()) chunks.push({ text: cur.trim(), page: meta.page });
  return chunks;
}
