import * as exifr from 'exifr';
import { PDFDocument } from 'pdf-lib';

export interface MetaField { key: string; value: string; }

async function stripImageMeta(file: File): Promise<{ fields: MetaField[]; stripped: Blob }> {
  let fields: MetaField[] = [];
  try {
    const raw = await exifr.parse(file, { tiff: true, exif: true, gps: true, iptc: true, icc: false });
    if (raw) {
      fields = Object.entries(raw).map(([k, v]) => ({ key: k, value: String(v) }));
    }
  } catch { /* no exif */ }

  // Re-encode via canvas to strip metadata
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  const stripped = await new Promise<Blob>((res) =>
    canvas.toBlob((b) => res(b!), file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.95),
  );
  return { fields, stripped };
}

async function stripPdfMeta(file: File): Promise<{ fields: MetaField[]; stripped: Blob }> {
  const buf = await file.arrayBuffer();
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
  const info = pdf.getInfoDict();
  const fields: MetaField[] = [];
  const keys = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate'];
  for (const k of keys) {
    try {
      const entry = info.get(info.context.obj(k) as never) as unknown;
      if (entry) fields.push({ key: k, value: String(entry) });
    } catch { /* skip */ }
  }
  // Clear metadata
  pdf.setTitle('');
  pdf.setAuthor('');
  pdf.setSubject('');
  pdf.setKeywords([]);
  pdf.setCreator('');
  pdf.setProducer('');
  const bytes = await pdf.save();
  return { fields, stripped: new Blob([bytes], { type: 'application/pdf' }) };
}

export async function processFile(file: File): Promise<{ fields: MetaField[]; stripped: Blob }> {
  if (file.type === 'application/pdf') return stripPdfMeta(file);
  if (file.type.startsWith('image/')) return stripImageMeta(file);
  throw new Error('Unsupported file type');
}

export function initMetadata(): void {
  const dropzone = document.getElementById('meta-drop')!;
  const fileInput = document.getElementById('meta-file') as HTMLInputElement;
  const table = document.getElementById('meta-table')!;
  const downloadBtn = document.getElementById('meta-download')!;
  let strippedBlob: Blob | null = null;
  let originalName = '';

  async function handleFile(file: File): Promise<void> {
    table.innerHTML = '<p class="text-muted text-sm">Processing…</p>';
    downloadBtn.classList.add('hidden');
    try {
      const { fields, stripped } = await processFile(file);
      strippedBlob = stripped;
      originalName = file.name;
      if (fields.length === 0) {
        table.innerHTML = '<p class="text-muted text-sm">No metadata found.</p>';
      } else {
        table.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm font-mono';
        for (const { key, value } of fields) {
          const k = document.createElement('span');
          k.className = 'text-muted';
          k.textContent = key;
          const v = document.createElement('span');
          v.className = 'text-ink truncate';
          v.textContent = value;
          grid.appendChild(k);
          grid.appendChild(v);
        }
        table.appendChild(grid);
      }
      downloadBtn.classList.remove('hidden');
    } catch (e) {
      table.innerHTML = `<p class="text-err text-sm">${(e as Error).message}</p>`;
    }
  }

  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('border-accent'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('border-accent'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-accent');
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  });
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) handleFile(file);
  });
  downloadBtn.addEventListener('click', () => {
    if (!strippedBlob) return;
    const url = URL.createObjectURL(strippedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clean-${originalName}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  });
}
