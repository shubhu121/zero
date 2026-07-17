import { mountTool } from '../toolkit';
import { runFFmpeg, cmdString } from '../../lib/ffmpeg';
import { outName, mimeFor } from '../../lib/mediafile';

const CRF: Record<string, string> = { light: '23', balanced: '28', strong: '32' };

mountTool({
  process: async (file, hooks) => {
    const level = (document.getElementById('level') as HTMLSelectElement).value;
    const scale720 = (document.getElementById('scale720') as HTMLInputElement).checked;
    const crf = CRF[level] ?? '28';
    const args = [
      '-c:v', 'libx264', '-preset', 'fast', '-crf', crf,
      '-c:a', 'aac', '-b:a', '128k',
      ...(scale720 ? ['-vf', 'scale=-2:720'] : []),
    ];
    const outFile = 'out.mp4';
    const { out } = await runFFmpeg({
      input: file, args, outFile,
      onStatus: hooks.status, onProgress: (x) => hooks.progress(x.ratio), onLog: hooks.log,
    });
    return { out, name: outName(file.name, 'mp4'), mime: mimeFor('mp4'), cmd: cmdString(file, args, outFile) };
  },
});
