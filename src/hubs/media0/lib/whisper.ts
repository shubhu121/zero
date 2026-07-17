import type { Segment } from './subs';

// Whisper ASR via Transformers.js. Lazy singleton — the model (~150 MB) downloads
// once and is cached. WebGPU when available, WASM otherwise.
let asrPromise: Promise<any> | null = null;
async function getAsr(onStatus: (s: string) => void) {
  asrPromise ??= (async () => {
    const { pipeline } = await import('@huggingface/transformers');
    const device = (navigator as any).gpu ? 'webgpu' : 'wasm';
    onStatus(`downloading whisper model (~150 MB, cached) · running on ${device}…`);
    // verify the current model id on huggingface.co/onnx-community at impl time
    return pipeline('automatic-speech-recognition', 'onnx-community/whisper-base', { device });
  })();
  return asrPromise;
}

/** input: 16 kHz mono Float32Array (produce with ffmpeg: -ar 16000 -ac 1 -f f32le) */
export async function transcribe(
  audio: Float32Array, onStatus: (s: string) => void,
): Promise<{ text: string; segments: Segment[] }> {
  const asr = await getAsr(onStatus);
  onStatus('transcribing…');
  const out = await asr(audio, {
    chunk_length_s: 30, stride_length_s: 5, return_timestamps: true,
  });
  const segments: Segment[] = (out.chunks ?? []).map((c: any) => ({
    start: c.timestamp[0] ?? 0,
    end: c.timestamp[1] ?? (c.timestamp[0] ?? 0) + 5,
    text: c.text,
  }));
  return { text: out.text, segments };
}
