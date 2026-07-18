import { describe, it, expect } from 'vitest';
import { cosineTopK } from '../../src/hubs/ai0/lib/vec';

describe('cosineTopK', () => {
  const docs = [
    new Float32Array([1, 0]), new Float32Array([0, 1]), new Float32Array([0.9, 0.1]),
  ];
  it('ranks by cosine similarity', () => {
    const top = cosineTopK(new Float32Array([1, 0]), docs, 2);
    expect(top.map((t) => t.index)).toEqual([0, 2]);
    expect(top[0]!.score).toBeCloseTo(1);
  });
  it('clamps k to corpus size', () => {
    expect(cosineTopK(new Float32Array([1, 0]), docs, 10)).toHaveLength(3);
  });
});
