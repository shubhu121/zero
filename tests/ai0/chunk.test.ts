import { describe, it, expect } from 'vitest';
import { chunkText } from '../../src/hubs/ai0/lib/chunk';

describe('chunkText', () => {
  const para = (n: number) => `Sentence ${'x'.repeat(40)} number ${n}. `;
  it('splits long text into overlapping chunks under the max size', () => {
    const text = Array.from({ length: 60 }, (_, i) => para(i)).join('');
    const chunks = chunkText(text, { page: 1 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(1600);
  });
  it('keeps overlap so context straddles boundaries', () => {
    const text = Array.from({ length: 60 }, (_, i) => para(i)).join('');
    const [a, b] = chunkText(text, { page: 1 });
    const tailOfA = a!.text.slice(-100);
    expect(b!.text.includes(tailOfA.slice(0, 50))).toBe(true);
  });
  it('returns single chunk for short text and preserves metadata', () => {
    const c = chunkText('short text.', { page: 7 });
    expect(c).toHaveLength(1);
    expect(c[0]!.page).toBe(7);
  });
  it('splits on sentence boundaries, not mid-word', () => {
    const text = Array.from({ length: 60 }, (_, i) => para(i)).join('');
    for (const c of chunkText(text, { page: 1 })) expect(c.text.trim()).toMatch(/[.!?]$/);
  });
});
