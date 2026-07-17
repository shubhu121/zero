// Lorem ipsum generator — words, sentences or paragraphs, with the classic
// opening and optional <p> wrapping. All local.

const WORDS = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ' +
  'incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud ' +
  'exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure ' +
  'in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint ' +
  'occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum').split(' ');

const OPENING = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

function $(id: string) { return document.getElementById(id)!; }
function randInt(min: number, max: number): number { return min + Math.floor(Math.random() * (max - min + 1)); }
function pick(): string { return WORDS[randInt(0, WORDS.length - 1)]!; }

function sentence(): string {
  const n = randInt(6, 14);
  const words = Array.from({ length: n }, pick);
  words[0] = words[0]!.charAt(0).toUpperCase() + words[0]!.slice(1);
  // sprinkle a comma roughly mid-sentence
  if (n > 8) words[Math.floor(n / 2)] += ',';
  return words.join(' ') + '.';
}

function paragraph(startWithOpening: boolean): string {
  const n = randInt(3, 6);
  const sentences = Array.from({ length: n }, sentence);
  if (startWithOpening) sentences[0] = OPENING;
  return sentences.join(' ');
}

export function initLorem() {
  const count = $('lo-count') as HTMLInputElement;
  const unit = $('lo-unit') as HTMLSelectElement;
  const startBox = $('lo-start') as HTMLInputElement;
  const htmlBox = $('lo-html') as HTMLInputElement;
  const output = $('lo-output') as HTMLTextAreaElement;
  const copyBtn = $('lo-copy');
  const regenBtn = $('lo-regen');

  function run() {
    const n = Math.max(1, Math.min(100, Number(count.value) || 1));
    const u = unit.value;
    const wrap = htmlBox.checked;
    let parts: string[] = [];
    if (u === 'words') {
      const words = Array.from({ length: n }, pick);
      if (startBox.checked) words.unshift('lorem', 'ipsum');
      parts = [words.slice(0, n).join(' ')];
    } else if (u === 'sentences') {
      parts = Array.from({ length: n }, (_, i) => (i === 0 && startBox.checked ? OPENING : sentence()));
      parts = [parts.join(' ')];
    } else {
      parts = Array.from({ length: n }, (_, i) => paragraph(i === 0 && startBox.checked));
    }
    output.value = wrap ? parts.map((p) => `<p>${p}</p>`).join('\n') : parts.join('\n\n');
  }

  [count, unit, startBox, htmlBox].forEach((el) => el.addEventListener('input', run));
  unit.addEventListener('change', run);
  regenBtn.addEventListener('click', run);
  copyBtn.addEventListener('click', async () => {
    if (!output.value) return;
    try {
      await navigator.clipboard.writeText(output.value);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
    } catch { output.select(); }
  });

  run();
}
