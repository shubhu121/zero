// Regex tester with match highlighting, capture groups, and a simple explanation
// of common regex tokens (not a full parser, but useful for quick debugging).

const SAMPLE = `Contact us:
  alice@example.com
  bob+filter@subdomain.example.co.uk
  invalid@email
  
Phone: (555) 123-4567, 555.987.6543, 800-CALL-NOW
  
Dates: 2024-01-15, 2024-12-31, 1999-06-30
Invalid: 2024-13-45, 2024-00-15

IPv4: 192.168.1.1, 10.0.0.255, 255.255.255.0
Not IP: 256.300.1.1, 1.2.3`;

const TOKEN_DESCRIPTIONS: Record<string, string> = {
  '\\d': 'digit [0-9]',
  '\\D': 'non-digit',
  '\\w': 'word char [a-zA-Z0-9_]',
  '\\W': 'non-word char',
  '\\s': 'whitespace',
  '\\S': 'non-whitespace',
  '\\b': 'word boundary',
  '\\B': 'non-word boundary',
  '.': 'any char (except newline)',
  '^': 'start of string/line',
  $: 'end of string/line',
  '+': 'one or more',
  '*': 'zero or more',
  '?': 'zero or one (or lazy)',
};

function $(id: string) { return document.getElementById(id)!; }

function explainPattern(pattern: string): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    const next = pattern[i + 1];
    // Character classes
    if (c === '[') {
      const end = pattern.indexOf(']', i);
      if (end !== -1) {
        lines.push(`[${pattern.slice(i + 1, end)}]  →  character class`);
        i = end + 1;
        continue;
      }
    }
    // Escape sequences
    if (c === '\\' && next) {
      const key = `\\${next}`;
      if (TOKEN_DESCRIPTIONS[key]) {
        lines.push(`${key}  →  ${TOKEN_DESCRIPTIONS[key]}`);
        i += 2;
        continue;
      }
    }
    // Quantifiers
    if (c === '{') {
      const end = pattern.indexOf('}', i);
      if (end !== -1) {
        lines.push(`{${pattern.slice(i + 1, end)}}  →  exact count / range`);
        i = end + 1;
        continue;
      }
    }
    // Groups
    if (c === '(') {
      let label = 'group';
      if (next === '?') {
        if (pattern[i + 2] === ':') { label = 'non-capturing group'; i += 3; }
        else if (pattern[i + 2] === '<') {
          const nameEnd = pattern.indexOf('>', i + 3);
          if (nameEnd !== -1) {
            label = `named group "${pattern.slice(i + 3, nameEnd)}"`;
            i = nameEnd + 1;
          } else { i += 2; }
        } else { i += 2; }
      } else { i += 1; }
      lines.push(`(  →  ${label}`);
      continue;
    }
    // Anchors / quantifiers
    if (TOKEN_DESCRIPTIONS[c]) {
      lines.push(`${c}  →  ${TOKEN_DESCRIPTIONS[c]}`);
      i += 1;
      continue;
    }
    // Literal
    if (/[a-zA-Z0-9]/.test(c)) {
      lines.push(`${c}  →  literal "${c}"`);
    } else {
      lines.push(`${c}  →  literal "${c}"`);
    }
    i += 1;
  }
  return lines;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

function renderMatches(input: string, regex: RegExp) {
  const out = $('regex-output');
  if (!regex.global && !regex.sticky) {
    // No g flag: just highlight first match.
    const m = regex.exec(input);
    if (!m) { out.innerHTML = '<span class="text-muted">No match.</span>'; return [m]; }
    return [m];
  }
  const matches: RegExpExecArray[] = [];
  // Reset lastIndex
  regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  let safety = 1000;
  while ((m = regex.exec(input)) !== null && safety-- > 0) {
    matches.push(m);
    if (m.index === regex.lastIndex) regex.lastIndex++; // empty match safety
  }
  if (matches.length === 0) {
    out.innerHTML = '<span class="text-muted">No match.</span>';
    return matches;
  }
  // Build HTML with highlights
  let html = '';
  let cursor = 0;
  const palette = [
    'bg-bg text-warn border border-warn',
    'bg-bg text-ok border border-ok',
    'bg-bg text-accent border border-accent',
    'bg-bg text-err border border-err',
  ];
  matches.forEach((m, i) => {
    const cls = palette[i % palette.length];
    const before = escapeHtml(input.slice(cursor, m.index));
    const match = escapeHtml(m[0]);
    html += before;
    html += `<span class="rounded-sm px-0.5 ${cls}">${match}</span>`;
    cursor = m.index + m[0].length;
  });
  html += escapeHtml(input.slice(cursor));
  out.innerHTML = html;
  return matches;
}

function renderGroups(matches: RegExpExecArray[]) {
  const el = $('regex-groups');
  if (matches.length === 0) { el.textContent = '—'; return; }
  const m = matches[0];
  const lines: string[] = [];
  if (m.length > 1) {
    for (let i = 1; i < m.length; i++) {
      const v = m[i] ?? '';
      lines.push(`<span class="text-accent">$${i}</span>  =  <span class="text-ink">${escapeHtml(v)}</span>`);
    }
  } else {
    lines.push('<span class="text-muted">(no capture groups)</span>');
  }
  el.innerHTML = lines.join('<br>');
}

export function regexSection() {
  const pattern = $('regex-pattern') as HTMLInputElement;
  const flags = $('regex-flags') as HTMLInputElement;
  const input = $('regex-input') as HTMLTextAreaElement;
  const matchCount = $('regex-match-count');
  const loadSample = $('regex-load-sample');
  const errEl = $('regex-error');
  const explainEl = $('regex-explain');

  function run() {
    errEl.classList.add('hidden');
    const pat = pattern.value;
    const fl = flags.value;
    let regex: RegExp;
    try {
      regex = new RegExp(pat, fl);
    } catch (e) {
      errEl.textContent = (e as Error).message;
      errEl.classList.remove('hidden');
      $('regex-output').innerHTML = '<span class="text-muted">Invalid pattern.</span>';
      $('regex-groups').textContent = '—';
      matchCount.textContent = '0 matches';
      return;
    }
    const matches = renderMatches(input.value, regex);
    renderGroups(matches);
    matchCount.textContent = `${matches.length} match${matches.length === 1 ? '' : 'es'}`;
    // Update explanation
    const lines = explainPattern(pat);
    explainEl.innerHTML = lines.length
      ? lines.map(l => `<div class="py-0.5">${escapeHtml(l)}</div>`).join('')
      : '<span class="text-muted">(empty pattern)</span>';
  }

  pattern.addEventListener('input', run);
  flags.addEventListener('input', run);
  input.addEventListener('input', run);
  loadSample.addEventListener('click', () => {
    pattern.value = '[\\w.+-]+@[\\w.-]+';
    flags.value = 'g';
    input.value = SAMPLE;
    run();
  });

  // Initial render with sample
  if (!pattern.value) {
    pattern.value = '[\\w.+-]+@[\\w.-]+';
    flags.value = 'g';
    input.value = SAMPLE;
  }
  run();
}
