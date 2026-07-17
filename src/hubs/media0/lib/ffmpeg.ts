import type { FFmpeg } from '@ffmpeg/ffmpeg';

export type FFProgress = (p: { ratio: number; time: number }) => void;
export type FFLog = (line: string) => void;

let _ff: FFmpeg | null = null;
let _loading: Promise<FFmpeg> | null = null;

/**
 * Lazy FFmpeg.wasm singleton. Multithreaded core (@ffmpeg/core-mt) when the page
 * is cross-origin isolated (SharedArrayBuffer available), single-thread core
 * otherwise — so Safari / non-isolated contexts still work, just slower.
 * Cores load from unpkg via toBlobURL (fetched with CORS, then blobbed, which
 * satisfies COEP require-corp). If unpkg is unreliable, vendor the three core
 * files into public/ffmpeg/ and point `base` there instead.
 */
export async function getFFmpeg(onStatus?: (s: string) => void): Promise<FFmpeg> {
  if (_ff) return _ff;
  _loading ??= (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');
    const ff = new FFmpeg();
    const mt = typeof SharedArrayBuffer !== 'undefined' && globalThis.crossOriginIsolated === true;
    onStatus?.(`loading ffmpeg (${mt ? 'multithread' : 'single-thread'}, ~32 MB, cached)…`);
    const base = mt
      ? 'https://unpkg.com/@ffmpeg/core-mt@0.12.10/dist/esm'
      : 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
    await ff.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      ...(mt ? { workerURL: await toBlobURL(`${base}/ffmpeg-core.worker.js`, 'text/javascript') } : {}),
    });
    _ff = ff;
    return ff;
  })();
  return _loading;
}

export interface RunResult { out: Uint8Array; log: string[]; ms: number; }

/** Write input -> exec args -> read output -> cleanup. One job at a time. */
export async function runFFmpeg(opts: {
  input: File; args: string[]; outFile: string;
  onProgress?: FFProgress; onLog?: FFLog; onStatus?: (s: string) => void;
}): Promise<RunResult> {
  const ff = await getFFmpeg(opts.onStatus);
  const log: string[] = [];
  const logCb = ({ message }: { message: string }) => { log.push(message); opts.onLog?.(message); };
  const progCb = ({ progress, time }: { progress: number; time: number }) =>
    opts.onProgress?.({ ratio: progress, time });
  ff.on('log', logCb);
  ff.on('progress', progCb);
  const t0 = performance.now();
  try {
    const inName = 'in_' + opts.input.name.replace(/[^\w.]/g, '_'); // sanitized virtual name
    await ff.writeFile(inName, new Uint8Array(await opts.input.arrayBuffer()));
    const code = await ff.exec(['-i', inName, ...opts.args, opts.outFile]);
    if (code !== 0) throw new Error(`ffmpeg exited ${code} — ${log.slice(-5).join(' / ')}`);
    const out = (await ff.readFile(opts.outFile)) as Uint8Array;
    await ff.deleteFile(inName).catch(() => {});
    await ff.deleteFile(opts.outFile).catch(() => {});
    return { out, log, ms: performance.now() - t0 };
  } finally {
    ff.off('log', logCb);
    ff.off('progress', progCb);
  }
}

/** The command string shown to the user (trust + education). */
export const cmdString = (input: File, args: string[], outFile: string) =>
  `ffmpeg -i "${input.name}" ${args.join(' ')} "${outFile}"`;
