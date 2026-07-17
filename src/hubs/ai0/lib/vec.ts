export interface Scored { index: number; score: number; }

/** Vectors are expected L2-normalized (the embed pipeline normalizes), so dot = cosine. */
export function cosineTopK(query: Float32Array, docs: Float32Array[], k: number): Scored[] {
  const scores: Scored[] = docs.map((d, index) => {
    let dot = 0;
    for (let i = 0; i < query.length; i++) dot += query[i]! * d[i]!;
    return { index, score: dot };
  });
  return scores.sort((a, b) => b.score - a.score).slice(0, Math.min(k, docs.length));
}
