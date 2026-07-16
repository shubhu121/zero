// Small shared CSV/TSV helpers used by the data0 converters. RFC 4180-ish:
// quoted fields, "" escapes, CR/LF line endings. No dependency.

export function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === delim) { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  // Flush the trailing field/row unless the input ended on a newline (no dangling row).
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// Guess the delimiter from the first non-empty line (tab, semicolon, or comma).
export function detectDelimiter(text: string): string {
  const line = text.split('\n').find((l) => l.trim() !== '') ?? '';
  const tabs = (line.match(/\t/g) || []).length;
  const semis = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  if (tabs >= semis && tabs >= commas && tabs > 0) return '\t';
  if (semis > commas) return ';';
  return ',';
}

// Coerce a CSV string cell to a JSON scalar (number / boolean / null / string).
export function inferType(s: string): string | number | boolean | null {
  if (s === '') return '';
  if (s === 'null' || s === 'NULL') return null;
  if (s === 'true' || s === 'TRUE') return true;
  if (s === 'false' || s === 'FALSE') return false;
  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isSafeInteger(n)) return n;
  } else if (/^-?\d*\.\d+$/.test(s) || /^-?\d+\.\d*$/.test(s) || /^-?\d+(\.\d+)?[eE][+-]?\d+$/.test(s)) {
    return Number(s);
  }
  return s;
}

// Escape a value for a CSV cell, quoting only when needed.
export function csvEscape(value: unknown, delim: string): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (s.includes(delim) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
