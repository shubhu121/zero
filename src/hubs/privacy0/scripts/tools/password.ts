// Password generator — cryptographically-random passwords with a live entropy
// estimate. Uses crypto.getRandomValues with rejection sampling (no modulo bias).
// Nothing is generated on a server; the password never leaves the page.

interface Set { id: string; chars: string; }

const SETS: Set[] = [
  { id: 'lower', chars: 'abcdefghijklmnopqrstuvwxyz' },
  { id: 'upper', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { id: 'digits', chars: '0123456789' },
  { id: 'symbols', chars: '!@#$%^&*()-_=+[]{};:,.<>?/~' },
];
const AMBIGUOUS = new Set('O0oIl1|`\'"{}[]()/\\'.split(''));

function $(id: string) { return document.getElementById(id)!; }

// Unbiased integer in [0, max) via rejection sampling.
function randInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const arr = new Uint32Array(1);
  let x: number;
  do { crypto.getRandomValues(arr); x = arr[0]!; } while (x >= limit);
  return x % max;
}

function generate(length: number, pool: string, sets: string[]): string {
  // Retry until every chosen set is represented (cheap; almost always first try).
  for (let attempt = 0; attempt < 20; attempt++) {
    let out = '';
    for (let i = 0; i < length; i++) out += pool[randInt(pool.length)];
    if (sets.every((s) => [...s].some((c) => out.includes(c)))) return out;
  }
  // Fallback: force one char from each set into random positions.
  const chars = Array.from({ length }, () => pool[randInt(pool.length)]!);
  sets.forEach((s, i) => { if (i < length) chars[randInt(length)] = s[randInt(s.length)]!; });
  return chars.join('');
}

function strength(bits: number): { label: string; pct: number; tone: string } {
  if (bits < 40) return { label: 'Weak', pct: 25, tone: 'var(--err)' };
  if (bits < 60) return { label: 'Fair', pct: 50, tone: 'var(--warn)' };
  if (bits < 80) return { label: 'Strong', pct: 75, tone: 'var(--accent)' };
  return { label: 'Excellent', pct: 100, tone: 'var(--ok)' };
}

export function initPassword() {
  const lenInput = $('pw-length') as HTMLInputElement;
  const lenLabel = $('pw-length-val');
  const noAmbig = $('pw-no-ambiguous') as HTMLInputElement;
  const out = $('pw-output') as HTMLInputElement;
  const meterBar = $('pw-meter-bar');
  const meterLabel = $('pw-meter-label');
  const entropyLabel = $('pw-entropy');
  const copyBtn = $('pw-copy');
  const regenBtn = $('pw-regen');
  const setBoxes = SETS.map((s) => $(`pw-set-${s.id}`) as HTMLInputElement);

  function run() {
    const length = Number(lenInput.value);
    lenLabel.textContent = String(length);
    const chosen = SETS.filter((_, i) => setBoxes[i]!.checked);
    let pool = chosen.map((s) => s.chars).join('');
    if (noAmbig.checked) pool = [...pool].filter((c) => !AMBIGUOUS.has(c)).join('');

    if (!pool) {
      out.value = '';
      meterLabel.textContent = 'Pick at least one character set';
      meterBar.style.width = '0%';
      entropyLabel.textContent = '';
      return;
    }
    const setChars = chosen.map((s) =>
      noAmbig.checked ? [...s.chars].filter((c) => !AMBIGUOUS.has(c)).join('') : s.chars,
    );
    out.value = generate(length, pool, setChars);
    const bits = Math.round(length * Math.log2(pool.length));
    const st = strength(bits);
    meterBar.style.width = `${st.pct}%`;
    meterBar.style.background = st.tone;
    meterLabel.textContent = st.label;
    meterLabel.style.color = st.tone;
    entropyLabel.textContent = `~${bits} bits of entropy · pool of ${pool.length}`;
  }

  lenInput.addEventListener('input', run);
  noAmbig.addEventListener('change', run);
  setBoxes.forEach((b) => b.addEventListener('change', run));
  regenBtn.addEventListener('click', run);
  copyBtn.addEventListener('click', async () => {
    if (!out.value) return;
    try {
      await navigator.clipboard.writeText(out.value);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
    } catch { out.select(); }
  });

  run();
}
