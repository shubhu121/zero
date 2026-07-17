import { mountTool } from '../toolkit';
import { getFFmpeg } from '../../lib/ffmpeg';
import { outName, mimeFor } from '../../lib/mediafile';

// Two-pass palette GIF (palettegen -> paletteuse) for far better quality than a
// naive one-pass conversion. Runs two execs against the same FFmpeg FS, so it
// uses getFFmpeg() directly rather than the single-job runFFmpeg helper.
mountTool({
  process: async (file, hooks) => {
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement).value;
    const start = val('gif-start').trim() || '0';
    const dur = val('gif-dur').trim() || '3';
    const fps = val('gif-fps');
    const w = val('gif-width');
    const filt = `fps=${fps},scale=${w}:-1:flags=lanczos`;

    const ff = await getFFmpeg(hooks.status);
    const log: string[] = [];
    const logCb = ({ message }: { message: string }) => { log.push(message); hooks.log(message); };
    const progCb = ({ progress }: { progress: number }) => hooks.progress(progress);
    ff.on('log', logCb);
    ff.on('progress', progCb);
    const inName = 'in_' + file.name.replace(/[^\w.]/g, '_');
    try {
      await ff.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
      hooks.status('generating colour palette…');
      let code = await ff.exec(['-ss', start, '-t', dur, '-i', inName, '-vf', `${filt},palettegen`, 'palette.png']);
      if (code !== 0) throw new Error(`palettegen failed — ${log.slice(-3).join(' / ')}`);
      hooks.status('rendering gif…');
      code = await ff.exec(['-ss', start, '-t', dur, '-i', inName, '-i', 'palette.png', '-lavfi', `${filt}[x];[x][1:v]paletteuse`, 'out.gif']);
      if (code !== 0) throw new Error(`gif render failed — ${log.slice(-3).join(' / ')}`);
      const out = (await ff.readFile('out.gif')) as Uint8Array;
      await ff.deleteFile(inName).catch(() => {});
      await ff.deleteFile('palette.png').catch(() => {});
      await ff.deleteFile('out.gif').catch(() => {});
      const cmd =
        `# 1) ffmpeg -ss ${start} -t ${dur} -i "${file.name}" -vf "${filt},palettegen" palette.png\n` +
        `# 2) ffmpeg -ss ${start} -t ${dur} -i "${file.name}" -i palette.png -lavfi "${filt}[x];[x][1:v]paletteuse" "${outName(file.name, 'gif')}"`;
      return { out, name: outName(file.name, 'gif'), mime: mimeFor('gif'), cmd };
    } finally {
      ff.off('log', logCb);
      ff.off('progress', progCb);
    }
  },
});
