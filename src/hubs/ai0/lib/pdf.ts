import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PageText { page: number; text: string; }

export async function extractPdfText(
  file: File,
  onPage?: (done: number, total: number) => void,
): Promise<PageText[]> {
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: PageText[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push({ page: p, text: content.items.map((i: any) => i.str).join(' ') });
    onPage?.(p, doc.numPages);
  }
  return pages;
}
