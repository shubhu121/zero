// Light DOM wiring for /json-to-types. The heavy quicktype engine is dynamically
// imported (see jsontypes-engine.ts) only on first generate, so this page loads
// instantly and the ~1.5 MB bundle is fetched + cached lazily.

function $(id: string) { return document.getElementById(id)!; }

// Targets grouped by language (NOT a flat list): a language can have multiple
// output flavors — TypeScript → interface/Zod, Python → dataclass/Pydantic. The
// flavor id is the quicktype target the engine understands. We deliberately do
// NOT import the engine here, since that would pull quicktype-core into this
// light chunk.
const LANGS = [
  { id: 'ts', label: 'TypeScript', flavors: [
    { id: 'typescript', label: 'Interface' },
    { id: 'typescript-zod', label: 'Zod' },
  ] },
  { id: 'py', label: 'Python', flavors: [
    { id: 'python', label: 'Dataclass' },
    { id: 'pydantic', label: 'Pydantic' },
  ] },
  { id: 'go', label: 'Go', flavors: [
    { id: 'go', label: 'Go' },
  ] },
];

const SAMPLE = JSON.stringify(
  {
    id: 42,
    name: 'Ada Lovelace',
    active: true,
    score: 99.5,
    middleName: null,
    roles: ['admin', 'author'],
    profile: {
      bio: 'First programmer',
      website: 'https://example.com',
      followers: 1024,
    },
    posts: [
      { id: 1, title: 'On the Analytical Engine', published: true, tags: ['history'] },
    ],
  },
  null,
  2,
);

type GenerateFn = (json: string, target: string, name: string) => Promise<string>;

export function jsonTypesSection() {
  const input = $('jt-input') as HTMLTextAreaElement;
  const nameInput = $('jt-name') as HTMLInputElement;
  const targetsWrap = $('jt-targets');
  const output = $('jt-output');
  const error = $('jt-error');
  const status = $('jt-status');
  const copyBtn = $('jt-copy') as HTMLButtonElement;

  let generate: GenerateFn | null = null;
  let target = 'typescript';
  let lastValidOutput = '';
  let debounce: number | undefined;
  let runToken = 0;

  // --- two-tier selector: language row + (conditional) flavor row ----------
  // Stack the two rows; the flavor row only appears for languages with >1 flavor.
  targetsWrap.className = 'flex flex-col gap-2';
  const langRow = document.createElement('div');
  langRow.className = 'flex flex-wrap items-center gap-1.5';
  const flavorRow = document.createElement('div');
  flavorRow.className = 'flex flex-wrap items-center gap-1.5';
  targetsWrap.append(langRow, flavorRow);

  // Build an accent-chip. `on` = solid accent + accent-ink text; otherwise plain
  // bg + muted text. Every class is set explicitly so two competing bg/text
  // utilities never coexist (that coexistence is what hid the active label).
  function chip(label: string, on: boolean, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.className = `text-xs font-medium px-2.5 py-1 rounded-sm border transition-colors ${
      on ? 'bg-accent text-accent-ink border-accent' : 'bg-bg text-muted border-rule'
    }`;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function currentLang() {
    return LANGS.find((l) => l.flavors.some((f) => f.id === target)) ?? LANGS[0];
  }

  function renderSelector() {
    const lang = currentLang();
    langRow.replaceChildren(
      ...LANGS.map((l) =>
        chip(l.label, l === lang, () => {
          // switching language jumps to its first flavor (unless already in it)
          if (!l.flavors.some((f) => f.id === target)) target = l.flavors[0].id;
          renderSelector();
          schedule(0);
        }),
      ),
    );
    if (lang.flavors.length < 2) {
      flavorRow.classList.add('hidden');
      flavorRow.replaceChildren();
    } else {
      flavorRow.classList.remove('hidden');
      flavorRow.replaceChildren(
        ...lang.flavors.map((f) =>
          chip(f.label, f.id === target, () => {
            target = f.id;
            renderSelector();
            schedule(0);
          }),
        ),
      );
    }
  }

  renderSelector();

  // --- error / status helpers ---------------------------------------------
  function clearError() {
    error.textContent = '';
    error.classList.add('hidden');
    output.classList.remove('opacity-40');
  }
  function showError(msg: string) {
    error.textContent = msg;
    error.classList.remove('hidden');
    // Keep the last good output, but grey it out.
    output.classList.add('opacity-40');
  }

  // --- generation ----------------------------------------------------------
  async function run() {
    const raw = input.value;
    // Validate JSON first; on failure keep last output greyed.
    try {
      JSON.parse(raw);
    } catch (e) {
      showError((e as Error).message);
      return;
    }
    clearError();

    if (!generate) {
      status.textContent = 'loading generator… (~1.5 MB, cached after first use)';
      try {
        const mod = await import('./jsontypes-engine');
        generate = mod.generate;
      } catch (e) {
        showError('Failed to load generator: ' + (e as Error).message);
        status.textContent = '';
        return;
      }
    }

    const token = ++runToken;
    status.textContent = 'generating…';
    try {
      const code = await generate(raw, target, nameInput.value.trim() || 'Root');
      if (token !== runToken) return; // a newer run superseded this one
      lastValidOutput = code;
      output.textContent = code;
      output.classList.remove('opacity-40');
      const lines = code === '' ? 0 : code.split('\n').length;
      status.textContent = `generated · ${lines} line${lines === 1 ? '' : 's'}`;
    } catch (e) {
      if (token !== runToken) return;
      showError((e as Error).message);
      status.textContent = '';
    }
  }

  function schedule(delay = 300) {
    if (debounce) clearTimeout(debounce);
    debounce = window.setTimeout(run, delay);
  }

  input.addEventListener('input', () => schedule());
  nameInput.addEventListener('input', () => schedule());

  // --- copy ----------------------------------------------------------------
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(lastValidOutput || output.textContent || '');
    const prev = copyBtn.textContent;
    copyBtn.textContent = 'copied';
    copyBtn.classList.add('text-ok', 'border-ok');
    setTimeout(() => {
      copyBtn.textContent = prev;
      copyBtn.classList.remove('text-ok', 'border-ok');
    }, 1000);
  });

  // --- preload sample ------------------------------------------------------
  input.value = SAMPLE;
  schedule(0);
}
