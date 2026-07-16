// DuckDB-WASM lifecycle and file management.
// Lazily initializes the DB on first use; subsequent calls reuse the same connection.

import * as duckdb from '@duckdb/duckdb-wasm';
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

let _db: AsyncDuckDB | null = null;
let _conn: AsyncDuckDBConnection | null = null;
let _initPromise: Promise<void> | null = null;
let _fileCount = 0;

const SUPPORTED_EXTENSIONS = new Set(['csv', 'tsv', 'parquet', 'json', 'ndjson', 'jsonl']);

export function tableNameFor(index: number): string {
  return `file${index + 1}`;
}

export function detectFormat(filename: string): 'csv' | 'tsv' | 'parquet' | 'json' | 'ndjson' | null {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'jsonl') return 'ndjson';
  if (ext === 'json') return 'json';
  if (!ext || !SUPPORTED_EXTENSIONS.has(ext)) return null;
  return ext as 'csv' | 'tsv' | 'parquet';
}

// Build a DuckDB-safe virtual file name. Original file.name is shown to the user
// but never used in SQL strings — we use a unique, alphanumeric, extension-bearing
// virtual name registered with DuckDB's VFS. This prevents SQL injection from
// file names containing quotes/backslashes/semicolons, and avoids collisions when
// the user drops the same filename twice.
function virtualFileName(originalName: string, index: number): string {
  const ext = (originalName.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `vfile_${index}_${Date.now()}.${ext}`;
}

async function init(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const bundles = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(bundles);
    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
    );
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);
    _db = db;
    _conn = await db.connect();
  })();
  return _initPromise;
}

export interface RegisteredFile {
  name: string;          // original user-facing name
  tableName: string;     // DuckDB table name (file1, file2, ...)
  format: 'csv' | 'tsv' | 'parquet' | 'json' | 'ndjson';
  bytes: number;
}

const registered: RegisteredFile[] = [];

export async function registerFile(file: File): Promise<RegisteredFile> {
  await init();
  if (!_db || !_conn) throw new Error('DuckDB not initialized');

  const format = detectFormat(file.name);
  if (!format) {
    throw new Error(
      `Unsupported file type: .${file.name.split('.').pop()}. Supported: ${[...SUPPORTED_EXTENSIONS].join(', ')}`
    );
  }

  const index = _fileCount++;
  const tableName = tableNameFor(index);
  const vname = virtualFileName(file.name, index);
  const buffer = new Uint8Array(await file.arrayBuffer());
  await _db.registerFileBuffer(vname, buffer);

  let query: string;
  if (format === 'parquet') {
    query = `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_parquet('${vname}')`;
  } else if (format === 'csv') {
    query = `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${vname}')`;
  } else if (format === 'tsv') {
    query = `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${vname}', delim='\t')`;
  } else if (format === 'json') {
    query = `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_json_auto('${vname}')`;
  } else {
    // ndjson
    query = `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_json_auto('${vname}', format='newline_delimited')`;
  }

  await _conn.query(query);
  const entry: RegisteredFile = {
    name: file.name,
    tableName,
    format,
    bytes: file.size || buffer.byteLength,
  };
  registered.push(entry);
  return entry;
}

export function listFiles(): RegisteredFile[] {
  return [...registered];
}

export async function clearFiles(): Promise<void> {
  await init();
  if (!_conn) return;
  for (const f of registered) {
    try {
      await _conn.query(`DROP TABLE IF EXISTS ${f.tableName}`);
    } catch {
      // ignore
    }
  }
  registered.length = 0;
  _fileCount = 0;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  durationMs: number;
  truncated: boolean;
}

const MAX_RENDERED_ROWS = 1000;

// Detect Apache Arrow Vector / Struct / etc. by duck-typing: they have a
// .toArray() method but are not native JS Arrays, not Dates, not plain objects.
// We don't rely on prototype.constructor.name because production minifiers
// (Vite/esbuild/Terser) mangle class names ("Vector" -> "C" or similar).
// The presence of `_offsets` / `numChildren` / `nullCount` / `stride` (typical
// Arrow Vector internals) is a strong secondary signal. We convert any
// value that has a .toArray() and is not an Array/Date to a JS array.
function isArrowVector(v: unknown): boolean {
  if (v === null || typeof v !== 'object') return false;
  if (v instanceof Date) return false;
  if (Array.isArray(v)) return false;
  if (typeof (v as any).toArray !== 'function') return false;
  // Heuristic: Arrow Vectors usually have one or more of these internals
  const arrowish = ['_offsets', 'numChildren', 'nullCount', 'stride', 'typeId'];
  const has = Object.keys(v as any).some((k) => arrowish.includes(k));
  return has;
}

function normalizeArrow(value: unknown, depth = 0): unknown {
  if (depth > 8) return value; // safety
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return value;
  if (isArrowVector(value)) {
    const arr = (value as any).toArray();
    return arr.map((v: unknown) => normalizeArrow(v, depth + 1));
  }
  if (Array.isArray(value)) {
    return value.map((v) => normalizeArrow(v, depth + 1));
  }
  // Plain object: walk keys
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = normalizeArrow(v, depth + 1);
  }
  return out;
}

export async function runQuery(sql: string): Promise<QueryResult> {
  await init();
  if (!_conn) throw new Error('DuckDB not initialized');
  const start = performance.now();
  const result = await _conn.query(sql);
  const durationMs = performance.now() - start;

  const allRows = result.toArray();
  const columns = result.schema.fields.map((f) => f.name);
  const truncated = allRows.length > MAX_RENDERED_ROWS;
  const rows = allRows.slice(0, MAX_RENDERED_ROWS).map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]] = normalizeArrow((row as any)[columns[i]]);
    }
    return obj;
  });

  return {
    rows,
    columns,
    rowCount: allRows.length,
    durationMs,
    truncated,
  };
}

export async function dbInfo(): Promise<{ version: string }> {
  await init();
  if (!_conn) throw new Error('DuckDB not initialized');
  const result = await _conn.query('SELECT version() AS v');
  return { version: (result.toArray()[0] as any).v as string };
}
