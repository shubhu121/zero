// Renders nested JSON values as a collapsible, syntax-highlighted tree.
// Falls back to a simple one-line string for primitives.
// Safe: every value is rendered via textContent — no innerHTML, no eval.

const TYPE_COLORS: Record<string, string> = {
  string: 'jv-string',
  number: 'jv-number',
  boolean: 'jv-boolean',
  null: 'jv-null',
  key: 'jv-key',
  punct: 'jv-punct',
};

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
}

function isContainer(v: unknown): v is Record<string, unknown> | unknown[] {
  return v !== null && typeof v === 'object' && !(v instanceof Date);
}

function summarize(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    const keys = Object.keys(v as object);
    return `Object{${keys.length}}`;
  }
  return String(v);
}

function renderPrimitive(value: unknown): HTMLElement {
  const span = document.createElement('span');
  if (value === null || value === undefined) {
    span.className = TYPE_COLORS.null;
    span.textContent = 'null';
    return span;
  }
  if (typeof value === 'string') {
    span.className = TYPE_COLORS.string;
    span.textContent = `"${value}"`;
    return span;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    span.className = TYPE_COLORS.number;
    span.textContent = String(value);
    return span;
  }
  if (typeof value === 'boolean') {
    span.className = TYPE_COLORS.boolean;
    span.textContent = String(value);
    return span;
  }
  if (value instanceof Date) {
    span.className = TYPE_COLORS.string;
    span.textContent = `"${value.toISOString()}"`;
    return span;
  }
  span.textContent = String(value);
  return span;
}

function renderContainer(
  value: Record<string, unknown> | unknown[],
  opts: { expanded?: boolean; maxDepth?: number; depth?: number }
): HTMLElement {
  const { expanded = false, maxDepth = 4, depth = 0 } = opts;
  const container = el('div', 'jv-container');

  const toggle = el('span', 'jv-toggle');
  toggle.textContent = expanded ? '▾' : '▸';

  const summarySpan = el('span', 'jv-summary');
  summarySpan.textContent = summarize(value);

  const header = el('div', 'jv-header');
  header.append(toggle, summarySpan);

  const children = el('div', 'jv-children');
  if (depth >= maxDepth) {
    children.classList.add('jv-truncated');
    children.append(el('span', 'jv-truncated-note', '(depth limit, expand manually)'));
  } else {
    const entries: [string, unknown][] = Array.isArray(value)
      ? (value as unknown[]).map((v, i) => [String(i), v])
      : Object.entries(value);
    for (const [k, v] of entries) {
      const row = el('div', 'jv-row');
      const keySpan = el('span', TYPE_COLORS.key, k);
      const punct = el('span', TYPE_COLORS.punct, ': ');
      row.append(keySpan, punct);
      if (isContainer(v) && !(v instanceof Date)) {
        row.append(renderContainer(v as Record<string, unknown> | unknown[], {
          expanded: false,
          maxDepth,
          depth: depth + 1,
        }));
      } else {
        row.append(renderPrimitive(v));
      }
      children.append(row);
    }
  }

  const applyState = (open: boolean) => {
    toggle.textContent = open ? '▾' : '▸';
    children.style.display = open ? '' : 'none';
  };
  applyState(expanded);

  header.addEventListener('click', () => {
    applyState(children.style.display === 'none');
  });
  header.style.cursor = 'pointer';

  container.append(header, children);
  return container;
}

/**
 * Renders any value as a JSON tree. Primitives are rendered inline.
 * Containers (objects/arrays) are rendered as a collapsible tree, top level
 * expanded by default.
 *
 * If `value` is null/undefined, renders a dim "null" cell.
 */
export function renderJsonValue(value: unknown, maxDepth = 4): HTMLElement {
  if (value === null || value === undefined) {
    return renderPrimitive(value);
  }
  if (isContainer(value)) {
    return renderContainer(value, { expanded: true, maxDepth });
  }
  return renderPrimitive(value);
}

/**
 * Flattens a nested object into a one-level object with dotted keys.
 * Arrays are kept as-is (not descended); only plain objects are flattened.
 * Example: { a: { b: 1, c: { d: 2 } } } -> { "a.b": 1, "a.c.d": 2 }
 * Example: { a: [1,2,3] } -> { a: [1,2,3] }
 */
export function flatten(value: unknown, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (value === null || value === undefined) {
    out[prefix || ''] = value;
    return out;
  }
  if (Array.isArray(value) || !isObject(value)) {
    out[prefix || ''] = value;
    return out;
  }
  for (const [k, v] of Object.entries(value)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isObject(v) && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}
