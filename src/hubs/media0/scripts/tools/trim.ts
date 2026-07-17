import { mountTool } from '../toolkit';
import { runFFmpeg, cmdString } from '../../lib/ffmpeg';
import { outName, mimeFor } from '../../lib/mediafile';

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const srcExt = (name: string) => (name.split('.').pop() || 'mp4').toLowerCase();

let videoUrl: string | null = null;
const vid = () => document.getElementById('trim-preview') as HTMLVideoElement;

mountTool({
  onFile: (file) => {
    const v = vid();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl = URL.createObjectURL(file);
    v.src = videoUrl;
    v.classList.remove('hidden');
  },
  process: async (file, hooks) => {
    const start = (document.getElementById('trim-start') as HTMLInputElement).value.trim() || '0';
    const end = (document.getElementById('trim-end') as HTMLInputElement).value.trim();
    const reenc = (document.getElementById('trim-reenc') as HTMLInputElement).checked;
    if (!end) throw new Error('set an end time first (mm:ss)');
    const args = reenc
      ? ['-ss', start, '-to', end, '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac']
      : ['-ss', start, '-to', end, '-c', 'copy'];
    const ext = srcExt(file.name);
    const outFile = 'out.' + ext;
    const { out } = await runFFmpeg({
      input: file, args, outFile,
      onStatus: hooks.status, onProgress: (x) => hooks.progress(x.ratio), onLog: hooks.log,
    });
    return { out, name: outName(file.name, ext), mime: mimeFor(ext), cmd: cmdString(file, args, outFile) };
  },
});

document.getElementById('trim-set-start')?.addEventListener('click', () => {
  (document.getElementById('trim-start') as HTMLInputElement).value = fmtTime(vid().currentTime);
});
document.getElementById('trim-set-end')?.addEventListener('click', () => {
  (document.getElementById('trim-end') as HTMLInputElement).value = fmtTime(vid().currentTime);
});
