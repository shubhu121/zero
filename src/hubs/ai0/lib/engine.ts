// WebLLM lifecycle. One engine at a time (models are GB-scale; parallel = OOM).
import type { MLCEngine, InitProgressReport } from '@mlc-ai/web-llm';

export interface ModelSpec { id: string; label: string; sizeBytes: number; note: string; }

// IDs must exist in web-llm's prebuiltAppConfig.model_list — verify at implementation
// time with: import { prebuiltAppConfig } from '@mlc-ai/web-llm';
// console.log(prebuiltAppConfig.model_list.map(m => m.model_id))
export const MODELS: ModelSpec[] = [
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B', sizeBytes: 880_000_000, note: 'fastest — fine for chat & RAG' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 3B', sizeBytes: 2_260_000_000, note: 'best quality/speed balance' },
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 3B', sizeBytes: 2_400_000_000, note: 'strong multilingual' },
  { id: 'gemma-2-2b-it-q4f16_1-MLC', label: 'Gemma 2 2B', sizeBytes: 1_900_000_000, note: 'Google, concise answers' },
];

export const defaultModelId = () => [...MODELS].sort((a, b) => a.sizeBytes - b.sizeBytes)[0]!.id;

export const fmtBytes = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1).replace(/\.0$/, '')} GB` : `${Math.round(n / 1e6)} MB`;

export type ProgressHandler = (p: { text: string; progress: number }) => void;

let _engine: MLCEngine | null = null;
let _loadedModel: string | null = null;

export async function getEngine(modelId: string, onProgress: ProgressHandler): Promise<MLCEngine> {
  if (_engine && _loadedModel === modelId) return _engine;
  if (_engine) { await _engine.unload(); _engine = null; _loadedModel = null; }
  const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
  _engine = await CreateMLCEngine(modelId, {
    initProgressCallback: (r: InitProgressReport) =>
      onProgress({ text: r.text, progress: r.progress }),
  });
  _loadedModel = modelId;
  return _engine;
}

export const loadedModelId = () => _loadedModel;

export async function storageInfo(): Promise<{ usage: number; quota: number; persisted: boolean }> {
  const est = await navigator.storage.estimate();
  const persisted = await navigator.storage.persisted();
  return { usage: est.usage ?? 0, quota: est.quota ?? 0, persisted };
}
export const requestPersistence = () => navigator.storage.persist();
