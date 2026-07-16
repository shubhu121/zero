// Heavy engine module — dynamically imported on first generate so quicktype-core
// (~1.5 MB) lands in its own chunk and never loads on initial page render.
import { quicktype, InputData, jsonInputForTargetLanguage } from 'quicktype-core';

// A target id maps to a quicktype `lang` plus renderer options. Note ids and
// langs diverge: "pydantic" renders with lang "python" + the pydantic flag.
const TARGETS: { id: string; label: string; lang: string; opts: Record<string, string> }[] = [
  { id: 'typescript', label: 'TypeScript', lang: 'typescript', opts: { 'just-types': 'true' } },
  { id: 'typescript-zod', label: 'Zod', lang: 'typescript-zod', opts: {} },
  { id: 'python', label: 'Python (dataclass)', lang: 'python', opts: { 'just-types': 'true', 'python-version': '3.7' } },
  { id: 'pydantic', label: 'Pydantic', lang: 'python', opts: { 'just-types': 'true', 'python-version': '3.7', 'pydantic-base-model': 'true' } },
  { id: 'go', label: 'Go', lang: 'go', opts: { 'just-types': 'true' } },
];

export async function generate(json: string, target: string, topLevelName: string): Promise<string> {
  const t = TARGETS.find((x) => x.id === target);
  if (!t) throw new Error('unknown target: ' + target);
  const input = jsonInputForTargetLanguage(t.lang);
  await input.addSource({ name: topLevelName || 'Root', samples: [json] });
  const data = new InputData();
  data.addInput(input);
  const result = await quicktype({ inputData: data, lang: t.lang, rendererOptions: t.opts });
  return result.lines.join('\n');
}

export const TARGET_LIST = TARGETS.map(({ id, label }) => ({ id, label }));
