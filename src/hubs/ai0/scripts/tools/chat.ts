import { initLoader } from '../../lib/loaderui';
import type { MLCEngine } from '@mlc-ai/web-llm';

interface Msg { role: 'system' | 'user' | 'assistant'; content: string; }
const HISTORY_KEY = 'ai0-chat';
const $ = (id: string) => document.getElementById(id)!;
const setGenerating = (on: boolean) => document.documentElement.classList.toggle('is-generating', on);

let engine: MLCEngine | null = null;
let msgs: Msg[] = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? 'null')
  ?? [{ role: 'system', content: 'You are a concise, helpful assistant.' }];

function renderMsgs() {
  const list = $('chat-list');
  list.innerHTML = '';
  for (const m of msgs.filter((x) => x.role !== 'system')) {
    const row = document.createElement('div');
    row.className = `py-3 border-b border-rule ${m.role === 'user' ? '' : 'bg-bg rounded px-3'}`;
    const tag = document.createElement('div');
    tag.className = 'label mb-1';
    tag.textContent = m.role;
    const body = document.createElement('div');
    body.className = 'text-sm whitespace-pre-wrap leading-relaxed';
    body.textContent = m.content;            // textContent — no markdown-as-HTML in v1
    row.append(tag, body);
    list.appendChild(row);
  }
  list.scrollTop = list.scrollHeight;
}

async function send() {
  const input = $('chat-input') as HTMLTextAreaElement;
  const text = input.value.trim();
  if (!text || !engine) return;
  input.value = '';
  msgs.push({ role: 'user', content: text });
  msgs.push({ role: 'assistant', content: '' });
  renderMsgs();
  const t0 = performance.now();
  let tokens = 0;
  setGenerating(true);
  try {
    const stream = await engine.chat.completions.create({
      messages: msgs.slice(0, -1) as any, stream: true, temperature: 0.7,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        msgs[msgs.length - 1]!.content += delta;
        tokens++;
        renderMsgs();
        $('chat-status').textContent = `${(tokens / ((performance.now() - t0) / 1000)).toFixed(1)} tok/s`;
      }
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(msgs));
  } finally {
    setGenerating(false);
  }
}

initLoader((e) => {
  engine = e;
  $('chat-panel').classList.remove('hidden');
  ($('chat-system') as HTMLTextAreaElement).value = msgs[0]!.content;
  renderMsgs();
});
$('chat-send').addEventListener('click', send);
$('chat-input').addEventListener('keydown', (e) => {
  const ev = e as KeyboardEvent;
  if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') send();
});
$('chat-new').addEventListener('click', () => {
  msgs = [msgs[0]!];
  localStorage.removeItem(HISTORY_KEY);
  renderMsgs();
});
($('chat-system') as HTMLTextAreaElement).addEventListener('change', (e) => {
  msgs[0]!.content = (e.target as HTMLTextAreaElement).value;
});
