// Wires the MediaTool.astro shell to a tool's processing function.
// The tool supplies process(file, hooks); the shell handles file selection
// (drop + click), the run lifecycle, progress, errors, and download.
import { fmtBytes, downloadBlob } from '../lib/mediafile';

export interface ToolHooks {
  status: (s: string) => void;
  progress: (ratio: number) => void;
  log: (line: string) => void;
}
export interface ToolResult { out: Uint8Array; name: string; mime: string; cmd: string; }

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function mountTool(opts: {
  process: (file: File, hooks: ToolHooks) => Promise<ToolResult>;
  onFile?: (file: File) => void;
}) {
  const drop = $('drop');
  const fileInput = $<HTMLInputElement>('file');
  const runBtn = $<HTMLButtonElement>('run');
  const bar = $('bar');
  let current: File | null = null;
  let result: ToolResult | null = null;

  function setFile(f: File) {
    current = f; result = null;
    $('drop-empty').classList.add('hidden');
    $('drop-file').classList.remove('hidden');
    $('file-name').textContent = f.name;
    $('file-meta').textContent = fmtBytes(f.size);
    $('result').classList.add('hidden');
    $('error').classList.add('hidden');
    $('status').textContent = '';
    runBtn.disabled = false;
    opts.onFile?.(f);
  }

  fileInput.addEventListener('change', () => { const f = fileInput.files?.[0]; if (f) setFile(f); });
  drop.addEventListener('click', (e) => { if ((e.target as HTMLElement).id !== 'file') fileInput.click(); });
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
    if (f) setFile(f);
  });

  runBtn.addEventListener('click', async () => {
    if (!current) return;
    runBtn.disabled = true;
    $('progress').classList.remove('hidden');
    $('result').classList.add('hidden');
    $('error').classList.add('hidden');
    const logEl = $('log');
    logEl.textContent = '';
    bar.style.width = '0%';
    const hooks: ToolHooks = {
      status: (s) => { $('status').textContent = s; },
      progress: (r) => { bar.style.width = `${Math.max(0, Math.min(100, Math.round(r * 100)))}%`; },
      log: (l) => { logEl.textContent += l + '\n'; },
    };
    const t0 = performance.now();
    try {
      result = await opts.process(current, hooks);
      hooks.progress(1);
      $('status').textContent = `done in ${((performance.now() - t0) / 1000).toFixed(1)}s`;
      $('result-sizes').textContent =
        `${fmtBytes(current.size)} → ${fmtBytes(result.out.byteLength)} · ${result.name}`;
      $('cmd').textContent = result.cmd;
      $('result').classList.remove('hidden');
    } catch (err) {
      $('error').textContent = (err as Error).message;
      $('error').classList.remove('hidden');
      $('status').textContent = 'failed';
    } finally {
      runBtn.disabled = false;
      $('progress').classList.add('hidden');
    }
  });

  $('download').addEventListener('click', () => {
    if (result) downloadBlob(result.out, result.name, result.mime);
  });
}
