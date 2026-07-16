// YAML ⇄ JSON converter, backed by js-yaml. Parsing/serialising is local.

import * as YAML from 'js-yaml';

const SAMPLE_YAML = `name: TabZero
private: true
hubs:
  - dev0
  - web0
  - data0
servers: 0`;

function $(id: string) { return document.getElementById(id)!; }

let dir: 'yaml2json' | 'json2yaml' = 'yaml2json';

export function initYamlJson() {
  const input = $('yj-input') as HTMLTextAreaElement;
  const output = $('yj-output') as HTMLTextAreaElement;
  const errEl = $('yj-error');
  const inLabel = $('yj-in-label');
  const outLabel = $('yj-out-label');
  const copyBtn = $('yj-copy');

  function run() {
    errEl.classList.add('hidden');
    const text = input.value;
    if (!text.trim()) { output.value = ''; return; }
    try {
      if (dir === 'yaml2json') {
        output.value = JSON.stringify(YAML.load(text), null, 2);
      } else {
        output.value = YAML.dump(JSON.parse(text), { indent: 2, lineWidth: 100 });
      }
    } catch (e) {
      output.value = '';
      errEl.textContent = (e as Error).message;
      errEl.classList.remove('hidden');
    }
  }

  function updateLabels() {
    inLabel.textContent = dir === 'yaml2json' ? 'YAML' : 'JSON';
    outLabel.textContent = dir === 'yaml2json' ? 'JSON' : 'YAML';
  }

  for (const b of document.querySelectorAll<HTMLButtonElement>('.yj-dir-btn')) {
    b.addEventListener('click', () => {
      dir = b.dataset.yjDir as 'yaml2json' | 'json2yaml';
      for (const x of document.querySelectorAll<HTMLButtonElement>('.yj-dir-btn')) {
        const active = x.dataset.yjDir === dir;
        x.classList.toggle('bg-bg', active);
        x.classList.toggle('text-accent', active);
        x.classList.toggle('text-muted', !active);
      }
      const tmp = input.value; input.value = output.value || tmp;
      updateLabels(); run();
    });
  }
  input.addEventListener('input', run);
  copyBtn.addEventListener('click', async () => {
    if (!output.value) return;
    try {
      await navigator.clipboard.writeText(output.value);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
    } catch { output.select(); }
  });

  updateLabels();
  input.value = SAMPLE_YAML;
  run();
}
