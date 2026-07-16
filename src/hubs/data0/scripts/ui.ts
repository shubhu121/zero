// UI layer: drop zone, file list, SQL editor, results table, error display.

import {
  type QueryResult,
  clearFiles,
  listFiles,
  registerFile,
  runQuery,
} from './db';
import { flatten, renderJsonValue } from './jsonView';

const app = () => document.querySelector<HTMLDivElement>('#app')!;

type ViewMode = 'tree' | 'flat' | 'raw';

let _viewMode: ViewMode = 'tree';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Partial<Record<string, string>> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) node.setAttribute(k, v);
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function isContainer(v: unknown): v is Record<string, unknown> | unknown[] {
  return v !== null && typeof v === 'object' && !(v instanceof Date);
}

// Compact JSON for object/array cells in Flatten + Raw views. BigInt-safe
// (DuckDB returns BigInt for 64-bit ints, which JSON.stringify throws on).
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
  } catch {
    return String(value);
  }
}

const SAMPLE_CSV = `name,age,city
Alice,30,New York
Bob,25,San Francisco
Charlie,35,London
Diana,28,Tokyo
Eve,42,Berlin
Frank,31,Paris
Grace,29,Sydney
Henry,38,Toronto
Iris,33,Mumbai
Jack,27,Singapore`;

const DEFAULT_SQL = `-- Drop CSV/Parquet/JSON files in the panel on the left.
-- Files become tables named file1, file2, file3, ...
-- Try: SELECT * FROM file1 LIMIT 10
-- Or join multiple files: SELECT a.*, b.x FROM file1 a JOIN file2 b ON a.id = b.id
`;

export function mount(): void {
  const root = app();
  root.innerHTML = '';

  const fileListEl = el('div', { class: 'file-list', id: 'file-list' });
  const sqlEditor = el('textarea', {
    class: 'sql-editor',
    id: 'sql-editor',
    spellcheck: 'false',
    placeholder: 'SELECT * FROM file1 LIMIT 10',
  }) as HTMLTextAreaElement;
  sqlEditor.value = DEFAULT_SQL;

  const runBtn = el('button', { class: 'btn btn-primary', id: 'run-btn' }, 'Run (Ctrl+Enter)');
  const sampleBtn = el('button', { class: 'btn', id: 'sample-btn' }, 'Load sample data');
  const clearBtn = el('button', { class: 'btn', id: 'clear-btn' }, 'Clear all files');

  const dropZone = el('div', { class: 'drop-zone', id: 'drop-zone' },
    el('div', { class: 'drop-icon' }, '📁'),
    el('div', { class: 'drop-text' }, 'Drop CSV, TSV, Parquet, JSON, or NDJSON files'),
    el('div', { class: 'drop-hint' }, 'or click to browse'),
  );
  (dropZone as HTMLDivElement).onclick = () => fileInput.click();

  const fileInput = el('input', {
    type: 'file',
    multiple: 'true',
    accept: '.csv,.tsv,.parquet,.json,.ndjson,.jsonl',
  }) as HTMLInputElement;
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', () => {
    if (fileInput.files) handleFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });

  const dropContainer = el('div', { class: 'drop-container' }, dropZone, fileInput);

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  document.addEventListener('dragleave', (e) => {
    if (e.target === document || e.relatedTarget == null) {
      dropZone.classList.remove('dragover');
    }
  });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer?.files;
    if (files && files.length) handleFiles(Array.from(files));
  });

  // The status element lives in the Astro <Footer/>; the layout mounts into #app.
  const statusEl = document.getElementById('status');
  const resultMeta = el('div', { class: 'result-meta', id: 'result-meta' });
  const errorEl = el('div', { class: 'error', id: 'error', hidden: 'true' });
  const resultsContainer = el('div', { class: 'results', id: 'results' });

  const viewToggle = el('div', { class: 'view-toggle', id: 'view-toggle' },
    el('button', { class: 'view-btn active', 'data-view': 'tree' }, 'Tree'),
    el('button', { class: 'view-btn', 'data-view': 'flat' }, 'Flatten'),
    el('button', { class: 'view-btn', 'data-view': 'raw' }, 'Raw'),
  );
  viewToggle.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.matches('.view-btn')) return;
    const mode = target.dataset.view as ViewMode;
    if (mode === _viewMode) return;
    _viewMode = mode;
    for (const btn of viewToggle.querySelectorAll<HTMLElement>('.view-btn')) {
      btn.classList.toggle('active', btn.dataset.view === mode);
    }
    if (_lastResult) renderResult(_lastResult);
  });

  const editorPanel = el('div', { class: 'panel' },
    el('div', { class: 'panel-header' },
      el('h2', {}, 'SQL Query'),
      runBtn,
    ),
    sqlEditor,
    errorEl,
  );

  const leftPanel = el('aside', { class: 'left-panel' },
    el('div', { class: 'panel-header' },
      el('h2', {}, 'Files'),
      clearBtn,
    ),
    dropContainer,
    fileListEl,
  );

  const rightPanel = el('section', { class: 'right-panel' },
    editorPanel,
    el('div', { class: 'panel' },
      el('div', { class: 'panel-header' },
        el('h2', {}, 'Results'),
        el('div', { class: 'header-actions' },
          viewToggle,
          sampleBtn,
        ),
      ),
      resultMeta,
      resultsContainer,
    ),
  );

  const main = el('main', { class: 'layout' }, leftPanel, rightPanel);

  // Header, footer and theme toggle are rendered by the Astro shell components.
  // This mount only owns the interactive tool layout inside #app.
  root.append(main);

  runBtn.addEventListener('click', runCurrentQuery);
  sampleBtn.addEventListener('click', loadSample);
  clearBtn.addEventListener('click', async () => {
    await clearFiles();
    renderFileList();
    setStatus('Cleared all files');
  });

  sqlEditor.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runCurrentQuery();
    }
  });

  (window as any).data0 = { runCurrentQuery, listFiles, setView: (m: ViewMode) => {
    _viewMode = m;
    for (const btn of viewToggle.querySelectorAll<HTMLElement>('.view-btn')) {
      btn.classList.toggle('active', btn.dataset.view === m);
    }
    if (_lastResult) renderResult(_lastResult);
  } };

  async function handleFiles(files: File[]): Promise<void> {
    for (const f of files) {
      setStatus(`Loading ${f.name}…`);
      try {
        const reg = await registerFile(f);
        setStatus(`Loaded ${reg.name} (${fmtBytes(reg.bytes)}) as ${reg.tableName}`);
        renderFileList();
      } catch (err) {
        showError(`Failed to load ${f.name}: ${(err as Error).message}`);
      }
    }
  }

  function renderFileList(): void {
    const files = listFiles();
    fileListEl.innerHTML = '';
    if (files.length === 0) {
      fileListEl.append(
        el('div', { class: 'empty' }, 'No files loaded. Drop a file or click "Load sample data".')
      );
      return;
    }
    for (const f of files) {
      fileListEl.append(
        el('div', { class: 'file-item' },
          el('div', { class: 'file-name' },
            el('span', { class: 'tag' }, f.tableName),
            ` ${f.name}`,
          ),
          el('div', { class: 'file-meta' }, `${f.format} · ${fmtBytes(f.bytes)}`),
        )
      );
    }
  }
  renderFileList();

  async function loadSample(): Promise<void> {
    const file = new File([SAMPLE_CSV], 'sample_people.csv', { type: 'text/csv' });
    await handleFiles([file]);
    sqlEditor.value = `SELECT
  city,
  COUNT(*) AS n,
  AVG(age) AS avg_age
FROM file1
GROUP BY city
ORDER BY n DESC`;
  }

  let _lastResult: QueryResult | null = null;

  async function runCurrentQuery(): Promise<void> {
    const sql = sqlEditor.value.trim();
    if (!sql) {
      showError('Write a SQL query first.');
      return;
    }
    hideError();
    resultsContainer.innerHTML = '';
    resultMeta.textContent = '';
    setStatus('Running…');
    runBtn.setAttribute('disabled', 'true');
    try {
      const result: QueryResult = await runQuery(sql);
      _lastResult = result;
      renderResult(result);
      const truncNote = result.truncated ? ` (showing first ${result.rows.length})` : '';
      resultMeta.textContent = `${result.rowCount.toLocaleString()} rows · ${result.durationMs.toFixed(1)}ms${truncNote}`;
      setStatus(`Done in ${result.durationMs.toFixed(1)}ms`);
    } catch (err) {
      const msg = (err as Error).message;
      showError(msg);
      setStatus('Error');
    } finally {
      runBtn.removeAttribute('disabled');
    }
  }

  function renderResult(result: QueryResult): void {
    if (result.rows.length === 0) {
      resultsContainer.append(el('div', { class: 'empty' }, 'Query returned 0 rows.'));
      return;
    }
    resultsContainer.innerHTML = '';
    if (_viewMode === 'tree') {
      resultsContainer.append(renderTableTree(result));
    } else if (_viewMode === 'flat') {
      resultsContainer.append(renderTableFlat(result));
    } else {
      resultsContainer.append(renderTableRaw(result));
    }
  }

  function renderTableRaw(result: QueryResult): HTMLElement {
    const wrap = el('div', { class: 'results-wrap' });
    const table = el('table', { class: 'results-table' });
    const thead = el('thead');
    const headerRow = el('tr');
    for (const col of result.columns) headerRow.append(el('th', {}, col));
    thead.append(headerRow);
    table.append(thead);
    const tbody = el('tbody');
    for (const row of result.rows) {
      const tr = el('tr');
      for (const col of result.columns) {
        const v = row[col];
        tr.append(el('td', { class: cellClass(v) }, primitiveText(v)));
      }
      tbody.append(tr);
    }
    table.append(tbody);
    wrap.append(table);
    return wrap;
  }

  function renderTableFlat(result: QueryResult): HTMLElement {
    // Flatten only the nested columns; keep top-level columns as separate columns.
    // Each row gets its own set of dotted columns per source column.
    const wrap = el('div', { class: 'results-wrap' });
    const table = el('table', { class: 'results-table' });

    // Compute the union of flattened keys per source column
    const columnKeys: Record<string, Set<string>> = {};
    for (const col of result.columns) {
      columnKeys[col] = new Set<string>();
      for (const row of result.rows) {
        const v = row[col];
        if (isContainer(v)) {
          for (const k of Object.keys(flatten(v))) columnKeys[col].add(`${col}.${k}`);
        } else {
          columnKeys[col].add(col);
        }
      }
    }
    // Add a column for every non-nested entry, plus dotted columns for nested entries
    const flatCols: string[] = [];
    for (const col of result.columns) {
      const ks = [...columnKeys[col]];
      if (ks.length === 1 && ks[0] === col) flatCols.push(col);
      else for (const k of ks) flatCols.push(k);
    }

    const thead = el('thead');
    const headerRow = el('tr');
    for (const c of flatCols) headerRow.append(el('th', {}, c));
    thead.append(headerRow);
    table.append(thead);

    const tbody = el('tbody');
    for (const row of result.rows) {
      const tr = el('tr');
      const cells: Record<string, unknown> = {};
      for (const col of result.columns) {
        const v = row[col];
        if (isContainer(v)) {
          Object.assign(cells, flatten(v, col));
        } else {
          cells[col] = v;
        }
      }
      for (const c of flatCols) {
        tr.append(el('td', { class: cellClass(cells[c]) }, primitiveText(cells[c])));
      }
      tbody.append(tr);
    }
    table.append(tbody);
    wrap.append(table);
    return wrap;
  }

  function renderTableTree(result: QueryResult): HTMLElement {
    const wrap = el('div', { class: 'results-wrap' });
    const table = el('table', { class: 'results-table' });
    const thead = el('thead');
    const headerRow = el('tr');
    for (const col of result.columns) headerRow.append(el('th', {}, col));
    thead.append(headerRow);
    table.append(thead);
    const tbody = el('tbody');
    for (const row of result.rows) {
      const tr = el('tr');
      for (const col of result.columns) {
        const v = row[col];
        const td = el('td', { class: cellClass(v) });
        if (v === null || v === undefined) {
          // leave empty
        } else if (isContainer(v)) {
          td.append(renderJsonValue(v));
        } else {
          td.textContent = primitiveText(v);
        }
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(tbody);
    wrap.append(table);
    return wrap;
  }

  function primitiveText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'object') return safeStringify(value); // arrays/objects → compact JSON
    return String(value);
  }

  function cellClass(value: unknown): string {
    if (value === null || value === undefined) return 'cell-null';
    if (isContainer(value)) return 'cell-object';
    return '';
  }

  function setStatus(text: string): void {
    if (statusEl) statusEl.textContent = text;
  }

  function showError(msg: string): void {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }
  function hideError(): void {
    errorEl.textContent = '';
    errorEl.hidden = true;
  }
}
