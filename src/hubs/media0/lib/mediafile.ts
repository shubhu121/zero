// Pure media-file helpers (formatting + naming) and one DOM helper (downloadBlob).
// The pure trio is unit-tested; downloadBlob touches the DOM so it's exercised in-app.

export const fmtBytes = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB`
  : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB`
  : n >= 1e3 ? `${(n / 1e3).toFixed(0)} KB`
  : `${n} B`;

export const fmtDuration = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
};

/** Swap the final extension. `My Video.MOV` + `mp4` -> `My Video.mp4`. */
export const outName = (input: string, ext: string) =>
  input.replace(/\.[^.]+$/, '') + '.' + ext;

const MIME: Record<string, string> = {
  mp4: 'video/mp4', webm: 'video/webm', gif: 'image/gif',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg',
};
export const mimeFor = (ext: string) => MIME[ext.toLowerCase()] ?? 'application/octet-stream';

export function downloadBlob(data: Uint8Array | Blob, name: string, mime: string) {
  // `[data as BlobPart]`: Uint8Array is generic over its backing buffer in TS 5.7+;
  // at this boundary the bytes are always regular-ArrayBuffer-backed.
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
