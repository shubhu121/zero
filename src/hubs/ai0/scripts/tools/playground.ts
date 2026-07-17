import { MODELS, defaultModelId, getEngine } from '../../lib/engine';
import { checkWebGPU } from '../../lib/gpu';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const setGenerating = (on: boolean) => document.documentElement.classList.toggle('is-generating', on);
const PROMPT_KEY = 'ai0-playground';

function fillSelect(sel: HTMLSelectElement, value: string) {
  for (const m of MODELS) {
    const o = document.createElement('option');
    o.value = m.id; o.textContent = `${m.label} — ${m.note}`;
    sel.appendChild(o);
  }
  sel.value = value;
}

async function runColumn(modelId: string, outEl: HTMLElement, statusEl: HTMLElement, prompt: string, system: string, temp: number) {
  statusEl.textContent = 'loading model…';
  const engine = await getEngine(modelId, ({ text, progress }) => {
    statusEl.textContent = `${text} ${Math.round(progress * 100)}%`;
  });
  outEl.textContent = '';
  const t0 = performance.now();
  let tokens = 0;
  const stream = await engine.chat.completions.create({
    messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] as any,
    stream: true, temperature: temp,
  });
  for await (const chunk of stream) {
    const d = chunk.choices[0]?.delta?.content ?? '';
    if (d) {
      outEl.textContent += d;
      tokens++;
      statusEl.textContent = `${(tokens / ((performance.now() - t0) / 1000)).toFixed(1)} tok/s`;
    }
  }
}

async function runBoth() {
  const prompt = ($('pg-prompt') as HTMLTextAreaElement).value.trim();
  if (!prompt) return;
  const system = ($('pg-system') as HTMLTextAreaElement).value;
  const temp = parseFloat(($('pg-temp') as HTMLInputElement).value);
  const a = ($('pg-model-a') as HTMLSelectElement).value;
  const b = ($('pg-model-b') as HTMLSelectElement).value;
  const run = $('pg-run') as HTMLButtonElement;
  run.disabled = true;
  setGenerating(true);
  try {
    // Models are GB-scale — one engine at a time, so the columns run sequentially.
    $('pg-out-b').textContent = '';
    $('pg-status-b').textContent = b === a ? '' : 'waiting for column A…';
    await runColumn(a, $('pg-out-a'), $('pg-status-a'), prompt, system, temp);
    if (b === a) {
      $('pg-out-b').textContent = '(same model as column A)';
    } else {
      await runColumn(b, $('pg-out-b'), $('pg-status-b'), prompt, system, temp);
    }
  } catch (err) {
    $('pg-status-a').textContent = `failed: ${(err as Error).message}`;
  } finally {
    run.disabled = false;
    setGenerating(false);
  }
}

fillSelect($('pg-model-a') as HTMLSelectElement, defaultModelId());
fillSelect($('pg-model-b') as HTMLSelectElement, MODELS[1]?.id ?? defaultModelId());

checkWebGPU().then((g) => {
  if (!g.ok) {
    $('pg-gpu-warn').textContent = `${g.reason} This page needs WebGPU.`;
    $('pg-gpu-warn').classList.remove('hidden');
    ($('pg-run') as HTMLButtonElement).disabled = true;
  }
});

const saved = localStorage.getItem(PROMPT_KEY);
if (saved) ($('pg-prompt') as HTMLTextAreaElement).value = saved;
$('pg-prompt').addEventListener('input', () =>
  localStorage.setItem(PROMPT_KEY, ($('pg-prompt') as HTMLTextAreaElement).value));

$('pg-run').addEventListener('click', runBoth);
$('pg-swap').addEventListener('click', () => {
  const a = $('pg-model-a') as HTMLSelectElement;
  const b = $('pg-model-b') as HTMLSelectElement;
  [a.value, b.value] = [b.value, a.value];
});
$('pg-temp').addEventListener('input', () => {
  $('pg-temp-val').textContent = ($('pg-temp') as HTMLInputElement).value;
});
