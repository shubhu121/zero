const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const setGenerating = (on: boolean) => document.documentElement.classList.toggle('is-generating', on);

// Florence-2 (on-device vision) via Transformers.js. Lazy singleton; model ~230 MB, cached.
let visionPromise: Promise<any> | null = null;
async function getVision(onStatus: (s: string) => void) {
  visionPromise ??= (async () => {
    const { pipeline } = await import('@huggingface/transformers');
    onStatus('downloading vision model (~230 MB, cached)…');
    const device = (navigator as any).gpu ? 'webgpu' : 'wasm';
    // verify the current Florence-2 onnx id + call shape on huggingface.co/onnx-community at impl time
    return pipeline('image-to-text', 'onnx-community/Florence-2-base-ft', { device });
  })();
  return visionPromise;
}

// Florence-2 task tokens (passed as the text prompt).
const TASKS: Record<string, string> = {
  ocr: '<OCR>',
  caption: '<MORE_DETAILED_CAPTION>',
};

let imgUrl: string | null = null;
let hasImage = false;

function setImage(file: File) {
  if (imgUrl) URL.revokeObjectURL(imgUrl);
  imgUrl = URL.createObjectURL(file);
  const img = $('ocr-preview') as HTMLImageElement;
  img.src = imgUrl;
  img.classList.remove('hidden');
  $('ocr-empty').classList.add('hidden');
  hasImage = true;
  ($('ocr-run') as HTMLButtonElement).disabled = false;
  $('ocr-result').classList.add('hidden');
}

async function run() {
  if (!hasImage || !imgUrl) return;
  const task = ($('ocr-task') as HTMLSelectElement).value;
  const out = $('ocr-out');
  const status = (s: string) => { $('ocr-status').textContent = s; };
  ($('ocr-run') as HTMLButtonElement).disabled = true;
  setGenerating(true);
  try {
    const vision = await getVision(status);
    status(`running ${task === 'ocr' ? 'OCR' : 'captioning'}…`);
    const result = await vision(imgUrl, { text: TASKS[task] });
    const raw = Array.isArray(result) ? result[0]?.generated_text : (result?.generated_text ?? result);
    out.textContent = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
    $('ocr-result').classList.remove('hidden');
    status('done');
  } catch (err) {
    $('ocr-out').textContent = `failed: ${(err as Error).message}`;
    $('ocr-result').classList.remove('hidden');
    status('failed');
  } finally {
    ($('ocr-run') as HTMLButtonElement).disabled = false;
    setGenerating(false);
  }
}

// drop-zone wiring
const drop = $('ocr-drop');
const input = $('ocr-input') as HTMLInputElement;
input.addEventListener('change', () => { const f = input.files?.[0]; if (f) setImage(f); });
drop.addEventListener('click', (e) => { if ((e.target as HTMLElement).id !== 'ocr-input') input.click(); });
for (const ev of ['dragover', 'dragenter']) {
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('border-accent'); });
}
for (const ev of ['dragleave', 'dragend']) {
  drop.addEventListener(ev, () => drop.classList.remove('border-accent'));
}
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('border-accent');
  const f = (e as DragEvent).dataTransfer?.files?.[0];
  if (f) setImage(f);
});
$('ocr-run').addEventListener('click', run);
$('ocr-copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('ocr-out').textContent ?? '');
  const b = $('ocr-copy');
  b.textContent = 'copied';
  setTimeout(() => { b.textContent = 'copy'; }, 1500);
});
