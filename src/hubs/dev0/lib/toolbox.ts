export interface QueryEntry { key: string; value: string; }

export function parseQuery(raw: string): QueryEntry[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  let query = trimmed;
  try {
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) query = new URL(trimmed).search;
  } catch {
    // Treat malformed URLs as a query string so pasted work can still be inspected.
  }
  const start = query.indexOf('?');
  if (start >= 0) query = query.slice(start + 1);
  query = query.split('#', 1)[0]!;
  return [...new URLSearchParams(query)].map(([key, value]) => ({ key, value }));
}

export function formatQuery(entries: QueryEntry[]): string {
  const params = new URLSearchParams();
  for (const { key, value } of entries) params.append(key, value);
  return params.toString();
}

const ENTITY_ENCODE: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
const ENTITY_DECODE: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'",
};

export function encodeHtmlEntities(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ENTITY_ENCODE[char]!);
}

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code) => {
    const normalized = String(code).toLowerCase();
    if (normalized.startsWith('#')) {
      const point = parseInt(normalized.slice(normalized.startsWith('#x') ? 2 : 1), normalized.startsWith('#x') ? 16 : 10);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    }
    return ENTITY_DECODE[normalized] ?? entity;
  });
}

export function words(value: string): string[] {
  return value
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .match(/[\p{L}\p{N}]+/gu)?.map((word) => word.toLocaleLowerCase()) ?? [];
}

function capitalize(value: string): string {
  return value ? value[0]!.toLocaleUpperCase() + value.slice(1) : value;
}

export function caseVariants(value: string): Record<string, string> {
  const tokens = words(value);
  const title = tokens.map(capitalize).join(' ');
  return {
    camelCase: tokens.map((word, index) => index ? capitalize(word) : word).join(''),
    PascalCase: tokens.map(capitalize).join(''),
    snake_case: tokens.join('_'),
    'kebab-case': tokens.join('-'),
    'CONSTANT_CASE': tokens.join('_').toLocaleUpperCase(),
    'Title Case': title,
  };
}

export interface UnicodeEntry {
  char: string; codePoint: string; decimal: number; utf8: string;
}

export function inspectUnicode(value: string): UnicodeEntry[] {
  const encoder = new TextEncoder();
  return Array.from(value).map((char) => {
    const decimal = char.codePointAt(0)!;
    return {
      char,
      codePoint: `U+${decimal.toString(16).toUpperCase().padStart(4, '0')}`,
      decimal,
      utf8: [...encoder.encode(char)].map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' '),
    };
  });
}

export interface PermissionInfo { octal: string; symbolic: string; }

export function unixPermissions(input: string): PermissionInfo | null {
  const value = input.trim().replace(/^0o?/i, '');
  if (!/^[0-7]{3,4}$/.test(value)) return null;
  const digits = value.length === 4 ? value.slice(1) : value;
  const special = value.length === 4 ? Number(value[0]) : 0;
  const labels = ['user', 'group', 'other'];
  const parts = [...digits].map((digit, index) => {
    const number = Number(digit);
    let part = `${number & 4 ? 'r' : '-'}${number & 2 ? 'w' : '-'}${number & 1 ? 'x' : '-'}`;
    if (index === 0 && special & 4) part = part.slice(0, 2) + (number & 1 ? 's' : 'S');
    if (index === 1 && special & 2) part = part.slice(0, 2) + (number & 1 ? 's' : 'S');
    if (index === 2 && special & 1) part = part.slice(0, 2) + (number & 1 ? 't' : 'T');
    return `${labels[index]}: ${part}`;
  });
  const symbolic = parts.join('\n');
  return { octal: value, symbolic };
}

export const MIME_TYPES: Record<string, string> = {
  avif: 'image/avif', bmp: 'image/bmp', css: 'text/css', csv: 'text/csv',
  gif: 'image/gif', gz: 'application/gzip', html: 'text/html', ico: 'image/x-icon',
  jpeg: 'image/jpeg', jpg: 'image/jpeg', js: 'text/javascript', json: 'application/json',
  m4a: 'audio/mp4', md: 'text/markdown', mp3: 'audio/mpeg', mp4: 'video/mp4',
  ogg: 'audio/ogg', pdf: 'application/pdf', png: 'image/png', svg: 'image/svg+xml',
  tar: 'application/x-tar', ts: 'video/mp2t', txt: 'text/plain', wasm: 'application/wasm',
  wav: 'audio/wav', webm: 'video/webm', webp: 'image/webp', xml: 'application/xml',
  yaml: 'application/yaml', yml: 'application/yaml', zip: 'application/zip',
};

export function lookupMime(input: string): { extension: string; mime: string | null } {
  const extension = input.trim().split(/[\\/]/).pop()!.split('.').pop()!.toLocaleLowerCase();
  return { extension, mime: MIME_TYPES[extension] ?? null };
}

export interface HttpStatus { title: string; category: string; description: string; }

export const HTTP_STATUSES: Record<number, HttpStatus> = {
  100: { title: 'Continue', category: 'Informational', description: 'The request headers were received; continue with the request body.' },
  200: { title: 'OK', category: 'Success', description: 'The request succeeded.' },
  201: { title: 'Created', category: 'Success', description: 'A new resource was created.' },
  202: { title: 'Accepted', category: 'Success', description: 'The request was accepted for later processing.' },
  204: { title: 'No Content', category: 'Success', description: 'The request succeeded without a response body.' },
  301: { title: 'Moved Permanently', category: 'Redirect', description: 'The resource has a permanent new location.' },
  302: { title: 'Found', category: 'Redirect', description: 'The resource is temporarily available elsewhere.' },
  304: { title: 'Not Modified', category: 'Redirect', description: 'Use the cached response.' },
  400: { title: 'Bad Request', category: 'Client error', description: 'The server could not understand the request.' },
  401: { title: 'Unauthorized', category: 'Client error', description: 'Authentication is required.' },
  403: { title: 'Forbidden', category: 'Client error', description: 'The server understood the request but refuses it.' },
  404: { title: 'Not Found', category: 'Client error', description: 'The requested resource does not exist.' },
  405: { title: 'Method Not Allowed', category: 'Client error', description: 'The endpoint does not support this HTTP method.' },
  409: { title: 'Conflict', category: 'Client error', description: 'The request conflicts with the current resource state.' },
  422: { title: 'Unprocessable Content', category: 'Client error', description: 'The request is well-formed but semantically invalid.' },
  429: { title: 'Too Many Requests', category: 'Client error', description: 'The client exceeded a rate limit.' },
  500: { title: 'Internal Server Error', category: 'Server error', description: 'The server encountered an unexpected condition.' },
  502: { title: 'Bad Gateway', category: 'Server error', description: 'A gateway received an invalid upstream response.' },
  503: { title: 'Service Unavailable', category: 'Server error', description: 'The service is temporarily unable to handle the request.' },
};

export function lookupHttpStatus(input: string): HttpStatus | null {
  return HTTP_STATUSES[Number(input.trim())] ?? null;
}

export interface UserAgentInfo { browser: string; engine: string; os: string; device: string; }

export function inspectUserAgent(value: string): UserAgentInfo {
  const version = (pattern: RegExp) => pattern.exec(value)?.[1];
  const edge = version(/Edg\/([\d.]+)/);
  const opera = version(/OPR\/([\d.]+)/);
  const firefox = version(/Firefox\/([\d.]+)/);
  const chrome = version(/(?:Chrome|CriOS)\/([\d.]+)/);
  const safari = version(/Version\/([\d.]+).*Safari/);
  const android = version(/Android ([\d.]+)/);
  const macOS = version(/Mac OS X ([\d_]+)/);
  const browser = edge ? `Microsoft Edge ${edge}`
    : opera ? `Opera ${opera}`
    : firefox ? `Firefox ${firefox}`
    : chrome ? `Chrome ${chrome}`
    : safari ? `Safari ${safari}` : 'Unknown browser';
  const os = /Windows NT 10/.test(value) ? 'Windows 10 or 11'
    : /Windows NT/.test(value) ? 'Windows'
    : android ? `Android ${android}`
    : /iPhone|iPad/.test(value) ? 'iOS or iPadOS'
    : macOS ? `macOS ${macOS.replace(/_/g, '.')}`
    : /Linux/.test(value) ? 'Linux' : 'Unknown OS';
  const engine = /Gecko\//.test(value) && /Firefox\//.test(value) ? 'Gecko'
    : /AppleWebKit\//.test(value) && /Chrome|CriOS|Edg|OPR/.test(value) ? 'Blink'
    : /AppleWebKit\//.test(value) ? 'WebKit' : 'Unknown engine';
  return { browser, engine, os, device: /Mobi|Android|iPhone|iPad/i.test(value) ? 'Mobile' : 'Desktop' };
}

export interface EnvEntry { line: number; key: string; value: string; quoted: boolean; duplicate: boolean; }
export interface EnvParse { entries: EnvEntry[]; issues: string[]; }

export function parseEnv(value: string): EnvParse {
  const entries: EnvEntry[] = [];
  const issues: string[] = [];
  const seen = new Set<string>();
  value.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z\d_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) { issues.push(`Line ${index + 1}: expected KEY=value`); return; }
    const [, key, rawValue] = match;
    const quoted = /^(".*"|'.*')$/.test(rawValue);
    const duplicate = seen.has(key!);
    if (duplicate) issues.push(`Line ${index + 1}: duplicate key ${key}`);
    seen.add(key!);
    entries.push({ line: index + 1, key: key!, value: rawValue!, quoted, duplicate });
  });
  return { entries, issues };
}

export const GITIGNORE_PRESETS: Record<string, string[]> = {
  node: ['node_modules/', '.env', '.env.*', 'dist/', 'coverage/', '*.log'],
  python: ['__pycache__/', '*.py[cod]', '.venv/', 'venv/', '.env', 'dist/', 'build/'],
  java: ['*.class', '.gradle/', 'build/', 'target/', '.idea/', '*.iml'],
  macos: ['.DS_Store', '._*'],
  vscode: ['.vscode/*', '!.vscode/extensions.json', '!.vscode/settings.json'],
};

export function gitignoreFor(presets: string[]): string {
  const lines = presets.flatMap((preset) => GITIGNORE_PRESETS[preset] ?? []);
  return [...new Set(lines)].join('\n') + (lines.length ? '\n' : '');
}
