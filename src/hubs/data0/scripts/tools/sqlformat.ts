// SQL formatter, backed by sql-formatter (dialect-aware). Runs locally.

import { format } from 'sql-formatter';

type KeywordCase = 'upper' | 'lower' | 'preserve';

const SAMPLE = "select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id=u.id where u.active=true group by u.id, u.name having count(o.id)>3 order by orders desc limit 10;";

function $(id: string) { return document.getElementById(id)!; }

let dialect = 'sql';
let keywordCase: KeywordCase = 'upper';
let tabWidth = 2;

export function initSqlFormat() {
  const input = $('sf-input') as HTMLTextAreaElement;
  const output = $('sf-output') as HTMLTextAreaElement;
  const errEl = $('sf-error');
  const copyBtn = $('sf-copy');

  function run() {
    errEl.classList.add('hidden');
    const text = input.value;
    if (!text.trim()) { output.value = ''; return; }
    try {
      output.value = format(text, {
        language: dialect,
        keywordCase,
        tabWidth,
      } as Parameters<typeof format>[1]);
    } catch (e) {
      output.value = '';
      errEl.textContent = (e as Error).message;
      errEl.classList.remove('hidden');
    }
  }

  ($('sf-dialect') as HTMLSelectElement).addEventListener('change', (e) => {
    dialect = (e.target as HTMLSelectElement).value; run();
  });
  ($('sf-case') as HTMLSelectElement).addEventListener('change', (e) => {
    keywordCase = (e.target as HTMLSelectElement).value as KeywordCase; run();
  });
  ($('sf-indent') as HTMLSelectElement).addEventListener('change', (e) => {
    tabWidth = Number((e.target as HTMLSelectElement).value); run();
  });
  input.addEventListener('input', run);
  copyBtn.addEventListener('click', async () => {
    if (!output.value) return;
    try {
      await navigator.clipboard.writeText(output.value);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
    } catch { output.select(); }
  });

  input.value = SAMPLE;
  run();
}
