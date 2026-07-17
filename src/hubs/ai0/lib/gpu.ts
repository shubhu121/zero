export interface GpuStatus { ok: boolean; reason?: string; }

export async function checkWebGPU(): Promise<GpuStatus> {
  const gpu = (navigator as any).gpu;
  if (!gpu) return { ok: false, reason: 'WebGPU is not available in this browser. Chrome/Edge 113+ or Safari 18+ required.' };
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { ok: false, reason: 'No WebGPU adapter found — likely no compatible GPU or it is disabled.' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `WebGPU error: ${(e as Error).message}` };
  }
}
