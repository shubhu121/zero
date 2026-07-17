// MiniLM embeddings via Transformers.js. WebGPU if available, WASM otherwise (~25 MB model).
let pipePromise: Promise<any> | null = null;

async function getPipe() {
  pipePromise ??= (async () => {
    const { pipeline } = await import('@huggingface/transformers');
    const device = (navigator as any).gpu ? 'webgpu' : 'wasm';
    return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { device });
  })();
  return pipePromise;
}

export async function embed(texts: string[]): Promise<Float32Array[]> {
  const pipe = await getPipe();
  const out: Float32Array[] = [];
  const BATCH = 16;
  for (let i = 0; i < texts.length; i += BATCH) {
    const res = await pipe(texts.slice(i, i + BATCH), { pooling: 'mean', normalize: true });
    const [n, dim] = res.dims as [number, number];
    const data = res.data as Float32Array;
    for (let r = 0; r < n; r++) out.push(data.slice(r * dim, (r + 1) * dim));
  }
  return out;
}
