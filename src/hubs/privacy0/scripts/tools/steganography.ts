// Steganography — hide a UTF-8 message inside a PNG using least-significant-bit
// (LSB) encoding across the R/G/B channels. A 32-bit big-endian length header
// precedes the message bytes. Output is always PNG (lossless) so the LSBs survive.
// Everything runs on a <canvas> in the browser; no image is ever uploaded.

const MAGIC = 0x30535447; // "0STG" — sanity marker so decode can reject junk images.

function $(id: string) { return document.getElementById(id)!; }

function imageDataFrom(img: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = URL.createObjectURL(file);
  });
}

// Capacity in bytes for a message, given an RGBA pixel buffer (3 usable channels
// per pixel, minus the 64-bit magic+length header).
function capacityBytes(data: Uint8ClampedArray): number {
  const channels = (data.length / 4) * 3;
  return Math.max(0, Math.floor((channels - 64) / 8));
}

function* bitsOf(magic: number, len: number, bytes: Uint8Array): Generator<number> {
  for (let i = 31; i >= 0; i--) yield (magic >>> i) & 1;
  for (let i = 31; i >= 0; i--) yield (len >>> i) & 1;
  for (const b of bytes) for (let i = 7; i >= 0; i--) yield (b >> i) & 1;
}

function embed(data: Uint8ClampedArray, bytes: Uint8Array): void {
  const it = bitsOf(MAGIC, bytes.length, bytes);
  for (let p = 0; p < data.length; p += 4) {
    for (let c = 0; c < 3; c++) {
      const next = it.next();
      if (next.done) return;
      data[p + c] = (data[p + c]! & 0xfe) | next.value;
    }
  }
}

function extract(data: Uint8ClampedArray): string {
  let channel = 0;
  const nextBit = (): number => {
    const pixel = Math.floor(channel / 3);
    const chan = channel % 3;
    channel++;
    return data[pixel * 4 + chan]! & 1;
  };
  const readUint = (n: number): number => {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v * 2 + nextBit()) >>> 0;
    return v >>> 0;
  };
  const magic = readUint(32);
  if (magic !== MAGIC) throw new Error('No hidden message found (or the image was re-compressed, e.g. saved as JPG).');
  const len = readUint(32);
  const cap = capacityBytes(data);
  if (len <= 0 || len > cap) throw new Error('No valid hidden message found in this image.');
  const bytes = new Uint8Array(len);
  for (let b = 0; b < len; b++) bytes[b] = readUint(8);
  return new TextDecoder().decode(bytes);
}

export function initSteg() {
  // Encode side
  const encFile = $('steg-enc-file') as HTMLInputElement;
  const encMsg = $('steg-message') as HTMLTextAreaElement;
  const encBtn = $('steg-encode-btn');
  const encCap = $('steg-capacity');
  const encErr = $('steg-enc-error');
  const encResult = $('steg-enc-result');
  const encPreview = $('steg-preview') as HTMLImageElement;
  const encDownload = $('steg-download') as HTMLAnchorElement;

  let encImageData: ImageData | null = null;

  async function onEncFile() {
    encErr.classList.add('hidden');
    encResult.classList.add('hidden');
    const f = encFile.files?.[0];
    if (!f) return;
    try {
      const img = await loadImage(f);
      encImageData = imageDataFrom(img);
      const cap = capacityBytes(encImageData.data);
      encCap.textContent = `Capacity: up to ${cap.toLocaleString()} characters in this ${img.naturalWidth}×${img.naturalHeight} image.`;
    } catch (e) {
      encErr.textContent = (e as Error).message;
      encErr.classList.remove('hidden');
    }
  }

  function onEncode() {
    encErr.classList.add('hidden');
    encResult.classList.add('hidden');
    if (!encImageData) { encErr.textContent = 'Choose a cover image first.'; encErr.classList.remove('hidden'); return; }
    const bytes = new TextEncoder().encode(encMsg.value);
    if (!bytes.length) { encErr.textContent = 'Type a message to hide.'; encErr.classList.remove('hidden'); return; }
    const cap = capacityBytes(encImageData.data);
    if (bytes.length > cap) {
      encErr.textContent = `Message is too long: ${bytes.length} bytes, but this image holds ${cap}. Use a larger image or a shorter message.`;
      encErr.classList.remove('hidden');
      return;
    }
    // Work on a copy so re-encoding the same image stays clean.
    const copy = new ImageData(new Uint8ClampedArray(encImageData.data), encImageData.width, encImageData.height);
    embed(copy.data, bytes);
    const canvas = document.createElement('canvas');
    canvas.width = copy.width;
    canvas.height = copy.height;
    canvas.getContext('2d')!.putImageData(copy, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      encPreview.src = url;
      encDownload.href = url;
      encDownload.download = 'stego.png';
      encResult.classList.remove('hidden');
    }, 'image/png');
  }

  encFile.addEventListener('change', onEncFile);
  encBtn.addEventListener('click', onEncode);

  // Decode side
  const decFile = $('steg-dec-file') as HTMLInputElement;
  const decOut = $('steg-dec-output') as HTMLTextAreaElement;
  const decErr = $('steg-dec-error');
  const decCopy = $('steg-dec-copy');

  decFile.addEventListener('change', async () => {
    decErr.classList.add('hidden');
    decOut.value = '';
    const f = decFile.files?.[0];
    if (!f) return;
    try {
      const img = await loadImage(f);
      const id = imageDataFrom(img);
      decOut.value = extract(id.data);
    } catch (e) {
      decErr.textContent = (e as Error).message;
      decErr.classList.remove('hidden');
    }
  });
  decCopy.addEventListener('click', async () => {
    if (!decOut.value) return;
    try {
      await navigator.clipboard.writeText(decOut.value);
      decCopy.textContent = 'Copied!';
      setTimeout(() => (decCopy.textContent = 'Copy'), 1200);
    } catch { decOut.select(); }
  });
}
