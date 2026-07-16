// DOM wiring for the unix timestamp converter. All parsing/formatting lives in src/lib/epoch.ts.
import { parseTimestampInput, formatAll } from '../../lib/epoch';

function $(id: string) { return document.getElementById(id)!; }

const UNIT_LABELS: Record<string, string> = {
  s: 'seconds', ms: 'milliseconds', 'µs': 'microseconds', ns: 'nanoseconds',
  iso: 'ISO 8601', date: 'date string',
};

export function epochSection() {
  const input = $('epoch-input') as HTMLTextAreaElement;
  const unitBadge = $('epoch-unit');
  const results = $('epoch-results');
  const nowBtn = $('epoch-now');
  const clock = $('epoch-clock');

  function waiting() {
    unitBadge.textContent = '—';
    results.innerHTML = '<p class="text-sm text-muted">waiting for a timestamp…</p>';
  }

  function row(label: string, value: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'flex items-center justify-between gap-4 px-4 py-2.5 border-b border-rule last:border-b-0';
    const dt = document.createElement('dt');
    dt.className = 'label shrink-0';
    dt.textContent = label;
    const right = document.createElement('div');
    right.className = 'flex items-center gap-2 min-w-0';
    const dd = document.createElement('dd');
    dd.className = 'text-sm font-mono text-ink truncate';
    dd.textContent = value;
    const copy = document.createElement('button');
    copy.className = 'text-[10px] font-medium px-1.5 py-0.5 rounded-sm bg-bg border border-rule text-muted shrink-0 transition-colors';
    copy.textContent = 'copy';
    copy.addEventListener('click', () => {
      navigator.clipboard.writeText(value);
      copy.textContent = 'copied';
      copy.classList.add('text-ok', 'border-ok');
      setTimeout(() => {
        copy.textContent = 'copy';
        copy.classList.remove('text-ok', 'border-ok');
      }, 1000);
    });
    right.append(dd, copy);
    wrap.append(dt, right);
    return wrap;
  }

  function render() {
    const parsed = parseTimestampInput(input.value);
    if (!parsed) { waiting(); return; }
    unitBadge.textContent = UNIT_LABELS[parsed.unit] ?? parsed.unit;
    const f = formatAll(parsed.ms);
    const dl = document.createElement('dl');
    dl.className = 'divide-y divide-rule';
    dl.append(
      row('Unix seconds', String(f.unixSeconds)),
      row('Unix millis', String(f.unixMillis)),
      row('ISO 8601', f.iso),
      row('UTC', f.utc),
      row('Local', f.local),
      row('Relative', f.relative),
    );
    results.innerHTML = '';
    results.appendChild(dl);
  }

  input.addEventListener('input', render);

  nowBtn.addEventListener('click', () => {
    input.value = String(Math.floor(Date.now() / 1000));
    render();
  });

  setInterval(() => {
    clock.textContent = String(Math.floor(Date.now() / 1000));
  }, 1000);
  clock.textContent = String(Math.floor(Date.now() / 1000));

  if (!input.value) waiting();
  else render();
}
