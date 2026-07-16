// Base / radix converter. Parses an integer in any base 2–36 (BigInt, so it is
// exact for arbitrarily large values) and shows it in binary, octal, decimal,
// hex and a custom target base. Pure arithmetic; nothing leaves the page.

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

function $(id: string) { return document.getElementById(id)!; }

function digitVal(ch: string): number {
  const c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) return c - 48;        // 0-9
  if (c >= 97 && c <= 122) return c - 87;       // a-z
  return -1;
}

function parseInBase(raw: string, base: number): bigint {
  let s = raw.trim().toLowerCase();
  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  // Tolerate 0x / 0o / 0b prefixes when they match the chosen base.
  if ((base === 16 && s.startsWith('0x')) || (base === 8 && s.startsWith('0o')) || (base === 2 && s.startsWith('0b'))) {
    s = s.slice(2);
  }
  s = s.replace(/[_\s]/g, '');
  if (!s) throw new Error('Enter a number.');
  const B = BigInt(base);
  let acc = 0n;
  for (const ch of s) {
    const d = digitVal(ch);
    if (d < 0 || d >= base) throw new Error(`"${ch}" is not a valid digit in base ${base}.`);
    acc = acc * B + BigInt(d);
  }
  return neg ? -acc : acc;
}

function toBase(n: bigint, base: number): string {
  if (n === 0n) return '0';
  const neg = n < 0n;
  if (neg) n = -n;
  const B = BigInt(base);
  let s = '';
  while (n > 0n) { s = DIGITS[Number(n % B)] + s; n /= B; }
  return (neg ? '-' : '') + s;
}

let inBase = 10;

export function initBaseConv() {
  const input = $('bc-input') as HTMLInputElement;
  const errEl = $('bc-error');
  const customBase = $('bc-custom-base') as HTMLInputElement;
  const outs: Record<string, HTMLElement> = {
    2: $('bc-bin'), 8: $('bc-oct'), 10: $('bc-dec'), 16: $('bc-hex'),
  };
  const customOut = $('bc-custom-out');

  function run() {
    errEl.classList.add('hidden');
    const clearAll = () => { Object.values(outs).forEach((e) => (e.textContent = '')); customOut.textContent = ''; };
    if (!input.value.trim()) { clearAll(); return; }
    let value: bigint;
    try {
      value = parseInBase(input.value, inBase);
    } catch (e) {
      clearAll();
      errEl.textContent = (e as Error).message;
      errEl.classList.remove('hidden');
      return;
    }
    outs[2]!.textContent = toBase(value, 2);
    outs[8]!.textContent = toBase(value, 8);
    outs[10]!.textContent = toBase(value, 10);
    outs[16]!.textContent = toBase(value, 16);
    const cb = Number(customBase.value);
    customOut.textContent = cb >= 2 && cb <= 36 ? toBase(value, cb) : '(base must be 2–36)';
  }

  for (const b of document.querySelectorAll<HTMLButtonElement>('.bc-base-btn')) {
    b.addEventListener('click', () => {
      inBase = Number(b.dataset.bcBase);
      for (const x of document.querySelectorAll<HTMLButtonElement>('.bc-base-btn')) {
        const active = Number(x.dataset.bcBase) === inBase;
        x.classList.toggle('bg-bg', active);
        x.classList.toggle('text-accent', active);
        x.classList.toggle('text-muted', !active);
      }
      input.placeholder = `Number in base ${inBase}…`;
      run();
    });
  }
  input.addEventListener('input', run);
  customBase.addEventListener('input', run);

  for (const btn of document.querySelectorAll<HTMLButtonElement>('.bc-copy')) {
    btn.addEventListener('click', async () => {
      const target = document.getElementById(btn.dataset.bcCopy!);
      const v = target?.textContent || '';
      if (!v) return;
      try {
        await navigator.clipboard.writeText(v);
        btn.textContent = '✓';
        setTimeout(() => (btn.textContent = 'copy'), 1000);
      } catch { /* ignore */ }
    });
  }

  input.value = '255';
  run();
}
