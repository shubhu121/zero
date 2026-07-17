import { runFFmpeg } from '../../lib/ffmpeg';
import { transcribe } from '../../lib/whisper';
import { toSrt, toVtt, type Segment } from '../../lib/subs';
import { downloadBlob, outName, fmtBytes, fmtDuration } from '../../lib/mediafile';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let current: File | null = null;
let segments: Segment[] = [];
let fullText = '';
let mediaUrl: string | null = null;

function setFile(f: File) {
  current = f;
  segments = []; fullText = '';
  $('t-empty').classList.add('hidden');
  $('t-file').classList.remove('hidden');
  $('t-name').textContent = f.name;
  $('t-meta').textContent = fmtBytes(f.size);
  ($('t-run') as HTMLButtonElement).disabled = false;
  $('t-results').classList.add('hidden');
  $('t-error').classList.add('hidden');
  $('t-status').textContent = '';
  const media = $('t-media') as HTMLVideoElement;
  if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  mediaUrl = URL.createObjectURL(f);
  media.src = mediaUrl;
  media.classList.remove('hidden');
  media.onloadedmetadata = () => {
    if (media.duration > 7200) {
      $('t-status').textContent = `heads up: ~${Math.round(media.duration / 60)} min — this will take a while and a lot of RAM`;
    }
  };
}

function renderResults() {
  $('t-text').textContent = fullText;
  const list = $('t-segments');
  list.innerHTML = '';
  for (const s of segments) {
    const row = document.createElement('div');
    row.className = 'flex gap-3 py-1.5 border-b border-rule text-sm';
    const ts = document.createElement('button');
    ts.type = 'button';
    ts.className = 'label text-accent shrink-0 hover:underline';
    ts.textContent = fmtDuration(s.start);
    ts.addEventListener('click', () => {
      const m = $('t-media') as HTMLVideoElement;
      m.currentTime = s.start;
      void m.play();
    });
    const txt = document.createElement('div');
    txt.className = 'text-ink';
    txt.textContent = s.text.trim();
    row.append(ts, txt);
    list.appendChild(row);
  }
}

async function run() {
  if (!current) return;
  const runBtn = $('t-run') as HTMLButtonElement;
  runBtn.disabled = true;
  $('t-progress').classList.remove('hidden');
  $('t-results').classList.add('hidden');
  $('t-error').classList.add('hidden');
  const bar = $('t-bar');
  const status = (s: string) => { $('t-status').textContent = s; };
  try {
    // 1) normalize any input to 16 kHz mono float32 PCM
    status('extracting audio…');
    const { out } = await runFFmpeg({
      input: current,
      args: ['-vn', '-ar', '16000', '-ac', '1', '-f', 'f32le'],
      outFile: 'audio.raw',
      onStatus: status,
      onProgress: (x) => { bar.style.width = `${Math.round(x.ratio * 50)}%`; },
    });
    const pcm = new Float32Array(out.buffer, out.byteOffset, Math.floor(out.byteLength / 4));
    // 2) transcribe on-device
    bar.style.width = '55%';
    const res = await transcribe(pcm, status);
    bar.style.width = '100%';
    fullText = res.text.trim();
    segments = res.segments;
    renderResults();
    $('t-results').classList.remove('hidden');
    status(`done — ${segments.length} segment${segments.length === 1 ? '' : 's'}`);
  } catch (err) {
    $('t-error').textContent = (err as Error).message;
    $('t-error').classList.remove('hidden');
    status('failed');
  } finally {
    runBtn.disabled = false;
    $('t-progress').classList.add('hidden');
  }
}

// drop-zone wiring
const drop = $('t-drop');
const input = $<HTMLInputElement>('t-input');
input.addEventListener('change', () => { const f = input.files?.[0]; if (f) setFile(f); });
drop.addEventListener('click', (e) => { if ((e.target as HTMLElement).id !== 't-input') input.click(); });
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
$('t-run').addEventListener('click', run);

// exports
const save = (text: string, ext: string, mime: string) =>
  current && downloadBlob(new Blob([text], { type: mime }), outName(current.name, ext), mime);
$('t-srt').addEventListener('click', () => save(toSrt(segments), 'srt', 'text/plain'));
$('t-vtt').addEventListener('click', () => save(toVtt(segments), 'vtt', 'text/vtt'));
$('t-txt').addEventListener('click', () => save(fullText, 'txt', 'text/plain'));
$('t-copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(fullText);
  const b = $('t-copy');
  b.textContent = 'copied';
  setTimeout(() => { b.textContent = 'copy'; }, 1500);
});
