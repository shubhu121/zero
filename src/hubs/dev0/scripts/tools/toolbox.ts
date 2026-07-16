import {
  caseVariants,
  decodeHtmlEntities,
  encodeHtmlEntities,
  formatQuery,
  gitignoreFor,
  inspectUnicode,
  inspectUserAgent,
  lookupHttpStatus,
  lookupMime,
  parseEnv,
  parseQuery,
  unixPermissions,
} from '../../lib/toolbox';

function element<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function copy(button: HTMLButtonElement, value: string): void {
  if (!value) return;
  navigator.clipboard?.writeText(value).then(() => {
    const label = button.textContent;
    button.textContent = 'copied';
    window.setTimeout(() => { button.textContent = label; }, 1200);
  }).catch(() => undefined);
}

export function querySection(): void {
  const input = element<HTMLTextAreaElement>('query-input');
  const output = element<HTMLElement>('query-output');
  const normalized = element<HTMLElement>('query-normalized');
  const run = () => {
    const entries = parseQuery(input.value);
    output.textContent = entries.length
      ? entries.map(({ key, value }, index) => `${index + 1}. ${key || '(empty key)'} = ${value || '(empty value)'}`).join('\n')
      : 'No parameters found.';
    normalized.textContent = formatQuery(entries) || 'No query string to normalize.';
  };
  input.addEventListener('input', run);
  element<HTMLButtonElement>('query-copy').addEventListener('click', () => copy(element('query-copy'), normalized.textContent ?? ''));
  run();
}

export function entitiesSection(): void {
  const input = element<HTMLTextAreaElement>('entities-input');
  const output = element<HTMLTextAreaElement>('entities-output');
  let transform = encodeHtmlEntities;
  const run = () => { output.value = transform(input.value); };
  element<HTMLButtonElement>('entities-encode').addEventListener('click', () => { transform = encodeHtmlEntities; run(); });
  element<HTMLButtonElement>('entities-decode').addEventListener('click', () => { transform = decodeHtmlEntities; run(); });
  element<HTMLButtonElement>('entities-copy').addEventListener('click', () => copy(element('entities-copy'), output.value));
  input.addEventListener('input', run);
  run();
}

export function caseSection(): void {
  const input = element<HTMLTextAreaElement>('case-input');
  const output = element<HTMLElement>('case-output');
  const run = () => {
    output.textContent = Object.entries(caseVariants(input.value))
      .map(([label, value]) => `${label.padEnd(15)} ${value}`).join('\n');
  };
  input.addEventListener('input', run);
  element<HTMLButtonElement>('case-copy').addEventListener('click', () => copy(element('case-copy'), output.textContent ?? ''));
  run();
}

export function unicodeSection(): void {
  const input = element<HTMLTextAreaElement>('unicode-input');
  const output = element<HTMLElement>('unicode-output');
  const run = () => {
    const rows = inspectUnicode(input.value);
    output.textContent = rows.length
      ? rows.map(({ char, codePoint, decimal, utf8 }) => `${JSON.stringify(char).padEnd(10)} ${codePoint.padEnd(8)} ${String(decimal).padEnd(8)} ${utf8}`).join('\n')
      : 'Type text to inspect its characters.';
  };
  input.addEventListener('input', run);
  run();
}

export function permissionsSection(): void {
  const input = element<HTMLInputElement>('permissions-input');
  const output = element<HTMLElement>('permissions-output');
  const run = () => {
    const info = unixPermissions(input.value);
    output.textContent = info ? `octal:    ${info.octal}\n${info.symbolic}` : 'Enter three or four octal digits, such as 755 or 4755.';
  };
  input.addEventListener('input', run);
  run();
}

export function mimeSection(): void {
  const input = element<HTMLInputElement>('mime-input');
  const output = element<HTMLElement>('mime-output');
  const run = () => {
    const { extension, mime } = lookupMime(input.value);
    output.textContent = extension
      ? mime ? `extension: .${extension}\nMIME type: ${mime}` : `No bundled MIME type is known for .${extension}.`
      : 'Enter a filename or extension.';
  };
  input.addEventListener('input', run);
  run();
}

export function httpStatusSection(): void {
  const input = element<HTMLInputElement>('http-status-input');
  const output = element<HTMLElement>('http-status-output');
  const run = () => {
    const status = lookupHttpStatus(input.value);
    output.textContent = status ? `${input.value.trim()} ${status.title}\n${status.category}\n\n${status.description}` : 'This compact reference does not include that status code.';
  };
  input.addEventListener('input', run);
  run();
}

export function userAgentSection(): void {
  const input = element<HTMLTextAreaElement>('ua-input');
  const output = element<HTMLElement>('ua-output');
  if (!input.value) input.value = navigator.userAgent;
  const run = () => {
    const info = inspectUserAgent(input.value);
    output.textContent = `browser: ${info.browser}\nengine:  ${info.engine}\nOS:      ${info.os}\ndevice:  ${info.device}`;
  };
  input.addEventListener('input', run);
  run();
}

export function envSection(): void {
  const input = element<HTMLTextAreaElement>('env-input');
  const output = element<HTMLElement>('env-output');
  const run = () => {
    const parsed = parseEnv(input.value);
    const entries = parsed.entries.map(({ line, key, value, quoted, duplicate }) =>
      `L${line} ${key} = ${value}${quoted ? ' (quoted)' : ''}${duplicate ? ' (duplicate)' : ''}`);
    output.textContent = [
      `${parsed.entries.length} variable${parsed.entries.length === 1 ? '' : 's'}`,
      ...entries,
      ...(parsed.issues.length ? ['', 'Issues:', ...parsed.issues] : []),
    ].join('\n');
  };
  input.addEventListener('input', run);
  run();
}

export function gitignoreSection(): void {
  const output = element<HTMLElement>('gitignore-output');
  const presets = [...document.querySelectorAll<HTMLInputElement>('[data-gitignore-preset]')];
  const run = () => {
    output.textContent = gitignoreFor(presets.filter(({ checked }) => checked).map(({ value }) => value)) || 'Select a preset to generate entries.';
  };
  presets.forEach((preset) => preset.addEventListener('change', run));
  element<HTMLButtonElement>('gitignore-copy').addEventListener('click', () => copy(element('gitignore-copy'), output.textContent ?? ''));
  run();
}
