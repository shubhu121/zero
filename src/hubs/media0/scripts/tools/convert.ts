import { mountTool } from '../toolkit';
import { runFFmpeg, cmdString } from '../../lib/ffmpeg';
import { outName, mimeFor } from '../../lib/mediafile';

const PRESETS: Record<string, { args: string[]; ext: string; note: string }> = {
  mp4: { args: ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac'], ext: 'mp4', note: 'H.264 + AAC — plays everywhere' },
  webm: { args: ['-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-c:a', 'libopus'], ext: 'webm', note: 'VP9 + Opus — smaller, web-native' },
  mp3: { args: ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'], ext: 'mp3', note: 'audio only' },
  wav: { args: ['-vn', '-c:a', 'pcm_s16le'], ext: 'wav', note: 'uncompressed audio' },
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
