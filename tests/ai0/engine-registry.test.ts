import { describe, it, expect } from 'vitest';
import { MODELS, defaultModelId, fmtBytes } from '../../src/hubs/ai0/lib/engine';

describe('model registry', () => {
  it('has at least 3 models with required fields', () => {
    expect(MODELS.length).toBeGreaterThanOrEqual(3);
    for (const m of MODELS) {
      expect(m.id).toMatch(/-MLC$/);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.sizeBytes).toBeGreaterThan(100_000_000);
    }
  });
  it('default model is the smallest (fastest first experience)', () => {
    const smallest = [...MODELS].sort((a, b) => a.sizeBytes - b.sizeBytes)[0]!;
    expect(defaultModelId()).toBe(smallest.id);
  });
  it('formats bytes', () => {
    expect(fmtBytes(1_900_000_000)).toBe('1.9 GB');
    expect(fmtBytes(650_000_000)).toBe('650 MB');
  });
});
