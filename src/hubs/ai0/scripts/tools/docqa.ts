import { initLoader } from '../../lib/loaderui';
import { extractPdfText } from '../../lib/pdf';
import { chunkText, type Chunk } from '../../lib/chunk';
import { embed } from '../../lib/embed';
import { cosineTopK } from '../../lib/vec';
import type { MLCEngine } from '@mlc-ai/web-llm';

const $ = (id: string) => document.getElementById(id)!;
const setGenerating = (on: boolean) => document.documentElement.classList.toggle('is-generating', on);

const SYSTEM = `Answer using ONLY the provided context. Cite pages like [p.3].
If the context doesn't contain the answer, say so plainly.`;

let engine: MLCEngine | null = null;
let chunks: Chunk[] = [];
let vectors: Float32Array[] = [];

const status = (s: string) => { $('dq-status').textContent = s; };

async function indexPdf(file: File) {
  ($('dq-ask') as HTMLButtonElement).disabled = true;
  ($('dq-q') as HTMLInputElement).disabled = true;
  status('extracting text…');
  const pages = await extractPdfText(file, (d, t) => status(`extracting text… page ${d}/${t}`));
  chunks = pages.flatMap((p) => chunkText(p.text, { page: p.page }));
  if (chunks.length === 0) {
    status('no extractable text — is this a scanned PDF? try /ai0/ocr first');
    return;
  }
  status(`embedding ${chunks.length} chunks… (first time downloads a ~25 MB embedding model)`);
  vectors = await embed(chunks.map((c) => c.text));
  status(`indexed ${chunks.length} chunks from ${pages.length} pages — ask away`);
  ($('dq-q') as HTMLInputElement).disabled = false;
  ($('dq-ask') as HTMLButtonElement).disabled = false;
}

function renderSources(sources: Chunk[]) {
  const srcEl = $('dq-sources');
  srcEl.innerHTML = '';
  const pagesList = [...new Set(sources.map((s) => s.page))].sort((a, b) => a - b).map((p) => `p.${p}`).join(' · ');
  const det = document.createElement('details');
  const sum = document.createElement('summary');
  sum.className = 'label cursor-pointer';
  sum.textContent = `sources — ${pagesList}`;
  det.appendChild(sum);
  for (const s of sources) {
    const d = document.createElement('div');
    d.className = 'text-xs text-muted mt-2 border-l-2 border-rule pl-2';
    d.textContent = `[p.${s.page}] ${s.text.slice(0, 300)}${s.text.length > 300 ? '…' : ''}`;
    det.appendChild(d);
  }
  srcEl.appendChild(det);
}

async function ask() {
  const q = ($('dq-q') as HTMLInputElement).value.trim();
  if (!q || !engine || vectors.length === 0) return;
  $('dq-error').classList.add('hidden');
  ($('dq-ask') as HTMLButtonElement).disabled = true;
  const answerEl = $('dq-answer');
  answerEl.textContent = '';
  $('dq-sources').innerHTML = '';
  $('dq-answer-wrap').classList.remove('hidden');
  setGenerating(true);
  try {
    const [qv] = await embed([q]);
    const top = cosineTopK(qv!, vectors, 5);
    const sources = top.map((t) => chunks[t.index]!);
    const context = sources.map((c) => `[p.${c.page}] ${c.text}`).join('\n\n');
    const stream = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Context:\n${context}\n\nQuestion: ${q}` },
      ] as any, stream: true, temperature: 0.2,
    });
    let answer = '';
    for await (const chunk of stream) {
      answer += chunk.choices[0]?.delta?.content ?? '';
      answerEl.textContent = answer;
    }
    renderSources(sources);
  } catch (err) {
    $('dq-error').textContent = (err as Error).message;
    $('dq-error').classList.remove('hidden');
  } finally {
    setGenerating(false);
    ($('dq-ask') as HTMLButtonElement).disabled = false;
  }
}

function wireDrop() {
  const drop = $('dq-drop');
  const input = $('dq-input') as HTMLInputElement;
  const onFile = (f: File) => {
    $('dq-empty').classList.add('hidden');
    $('dq-file').classList.remove('hidden');
    $('dq-name').textContent = f.name;
    indexPdf(f);
  };
  input.addEventListener('change', () => { const f = input.files?.[0]; if (f) onFile(f); });
  drop.addEventListener('click', (e) => { if ((e.target as HTMLElement).id !== 'dq-input') input.click(); });
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
    if (f) onFile(f);
  });
}

initLoader((e) => { engine = e; $('dq-panel').classList.remove('hidden'); });
wireDrop();
$('dq-ask').addEventListener('click', ask);
$('dq-q').addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') ask(); });
