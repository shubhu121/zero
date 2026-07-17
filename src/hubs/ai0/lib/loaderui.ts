import { MODELS, defaultModelId, fmtBytes, getEngine, storageInfo, requestPersistence } from './engine';
import { checkWebGPU } from './gpu';
import type { MLCEngine } from '@mlc-ai/web-llm';

const setGenerating = (on: boolean) =>
  document.documentElement.classList.toggle('is-generating', on);

/** Wires the ModelLoader panel. Calls onReady with a loaded engine after the user clicks load. */
export function initLoader(onReady: (engine: MLCEngine, modelId: string) => void) {
  const $ = (id: string) => document.getElementById(id)!;
  const select = $('loader-model') as HTMLSelectElement;
  const sizeEl = $('loader-size');

  for (const m of MODELS) {
    const o = document.createElement('option');
    o.value = m.id; o.textContent = `${m.label} — ${m.note}`;
    select.appendChild(o);
  }
  select.value = defaultModelId();
  const updSize = () =>
    sizeEl.textContent = `download ${fmtBytes(MODELS.find((m) => m.id === select.value)!.sizeBytes)} · cached after first load`;
  updSize();
  select.addEventListener('change', updSize);

  checkWebGPU().then((g) => {
    if (!g.ok) {
      $('loader-gpu-warn').textContent = `${g.reason} Generation needs WebGPU — this page can't run without it.`;
      $('loader-gpu-warn').classList.remove('hidden');
      ($('loader-go') as HTMLButtonElement).disabled = true;
    }
  });
  storageInfo().then((s) =>
    $('loader-storage').textContent =
      `storage: ${fmtBytes(s.usage)} used of ${fmtBytes(s.quota)} · ${s.persisted ? 'persistent ✓' : 'browser may evict cached models'}`);

  $('loader-go').addEventListener('click', async () => {
    const btn = $('loader-go') as HTMLButtonElement;
    btn.disabled = true;
    $('loader-progress-wrap').classList.remove('hidden');
    await requestPersistence().catch(() => {});
    setGenerating(true); // freeze the liquid sheen while the GPU compiles/loads
    try {
      const engine = await getEngine(select.value, ({ text, progress }) => {
        ($('loader-bar') as HTMLElement).style.width = `${Math.round(progress * 100)}%`;
        $('loader-text').textContent = text;
      });
      $('loader-text').textContent = 'ready — cached for next time';
      onReady(engine, select.value);
    } catch (e) {
      $('loader-text').textContent = `failed: ${(e as Error).message}`;
      btn.disabled = false;
    } finally {
      setGenerating(false);
    }
  });
}
