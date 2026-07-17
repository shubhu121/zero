import { mountTool } from '../toolkit';
import { runFFmpeg, cmdString } from '../../lib/ffmpeg';
import { outName, mimeFor } from '../../lib/mediafile';

const PRESETS: Record<string, { args: string[]; ext: string; note: string }> = {
  mp3: { args: ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'], ext: 'mp3', note: 're-encode to MP3' },
  wav: { args: ['-vn', '-c:a', 'pcm_s16le'], ext: 'wav', note: 'uncompressed PCM' },
  m4a: { args: ['-vn', '-c:a', 'copy'], ext: 'm4a', note: 'stream-copy — instant, needs an AAC source' },
};

mountTool({
  process: async (file, hooks) => {
    const fmt = (document.getElementById('fmt') as HTMLSelectElement).value;
    const p = PRESETS[fmt]!;
    const outFile = 'out.' + p.ext;
    const { out } = await runFFmpeg({
      input: file, args: p.args, outFile,
      onStatus: hooks.status, onProgress: (x) => hooks.progress(x.ratio), onLog: hooks.log,
    });
    return { out, name: outName(file.name, p.ext), mime: mimeFor(p.ext), cmd: cmdString(file, p.args, outFile) };
  },
});

const sel = document.getElementById('fmt') as HTMLSelectElement | null;
const note = document.getElementById('fmt-note');
const upd = () => { if (sel && note) note.textContent = PRESETS[sel.value]!.note; };
sel?.addEventListener('change', upd);
upd();
