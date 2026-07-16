// Light DOM wiring for /jq. The heavy jq-web engine (real jq compiled to a
// ~2.7 MB WebAssembly module) is dynamically imported on first run so this page
// loads instantly and the wasm is fetched + cached lazily as its own chunk.
//
// WASM path note: jq-web (0.6.2) is an Emscripten MODULARIZE build whose default
// export is a *thenable* that resolves to `{ json, raw }`. It auto-instantiates
// the moment it is imported, with NO hook to inject `Module.locateFile`. Its
// default `locateFile` returns the bare string 'jq.wasm' because, inside a
// bundled ES-module chunk, `document.currentScript` is null and Emscripten's
// `scriptDirectory` resolves to '', so the browser fetches 'jq.wasm' relative to
// the *page* (document.baseURI). On a nested route like `/dev0/jq/` that becomes
// `/dev0/jq/jq.wasm`, a 404, and the engine aborts with
// "both async and sync fetching of the wasm failed".
//
// We ship the binary at the site root (`public/jq.wasm` -> `/jq.wasm`). Since we
// can't pass `locateFile`, `resolveJq()` briefly wraps `fetch` around the import
// + first instantiation and rewrites only a request whose path ends in
// `/jq.wasm` to the absolute `/jq.wasm`. It is URL-agnostic, so it behaves the
// same under `astro dev`, `astro build` + `preview`, and any trailingSlash mode.

let jqPromise: Promise<any> | null = null;
async function resolveJq(): Promise<any> {
  // jq-web (0.6.2) resolves to different shapes across Vite dev and the prod
  // Rollup bundle. Its jq.js ends by reassigning module.exports to a PROMISE
  // of { json, raw } AFTER setting .default to the emscripten *factory fn*, so:
  //   - prod: mod.default is the resolved promise -> await -> { json, raw }
  //   - dev:  mod.default is the factory function -> must be CALLED, not awaited
  // Unwrap defensively: if it's a thenable, await it; if it's a function, call
  // it (emscripten factory -> Promise<Module>); follow nested .default; stop
  // once we find a .json() entry point.
  //
  // The wasm fetch jq-web kicks off on import resolves 'jq.wasm' relative to the
  // page (e.g. /dev0/jq/jq.wasm). We serve it at the root, so wrap fetch for the
  // duration of import + instantiation and redirect any '*/jq.wasm' to /jq.wasm.
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const patchedFetch: typeof fetch = (input, init) => {
    try {
      const raw =
        typeof input === 'string' ? input :
        input instanceof URL ? input.href :
        (input as Request).url;
      if (raw) {
        const { pathname } = new URL(raw, location.href);
        if (/(^|\/)jq\.wasm$/.test(pathname) && pathname !== '/jq.wasm') {
          return nativeFetch(new URL('/jq.wasm', location.origin).href, init);
        }
      }
    } catch {
      /* fall through to the native fetch with the original input */
    }
    return nativeFetch(input as RequestInfo, init);
  };
  globalThis.fetch = patchedFetch;
  try {
    const mod: any = await import('jq-web');
    let cand: any = mod?.default ?? mod;
    for (let i = 0; i < 5; i++) {
      if (cand && typeof cand.json === 'function') return cand;
      if (cand && typeof cand.then === 'function') { cand = await cand; continue; }
      if (typeof cand === 'function') { cand = cand(); continue; } // emscripten factory
      if (cand && cand.default && cand.default !== cand) { cand = cand.default; continue; }
      break;
    }
    if (cand && typeof cand.json === 'function') return cand;
    throw new Error('jq engine loaded but exposed no json() entry point');
  } finally {
    globalThis.fetch = nativeFetch;
  }
}
function loadJq() {
  jqPromise ??= resolveJq();
  return jqPromise;
}

export async function runFilter(jsonText: string, filter: string): Promise<string> {
  const jq = await loadJq();
  const data = JSON.parse(jsonText); // throws SyntaxError -> shown as JSON error
  const out = await jq.json(data, filter); // throws jq error -> shown as filter error
  return JSON.stringify(out, null, 2);
}

function $(id: string) {
  return document.getElementById(id)!;
}

const SAMPLE_JSON = JSON.stringify(
  {
    users: [
      { name: 'Ada Lovelace', email: 'ada@example.com', active: true, age: 36 },
      { name: 'Alan Turing', email: 'alan@example.com', active: false, age: 41 },
      { name: 'Grace Hopper', email: 'grace@example.com', active: true, age: 85 },
    ],
  },
  null,
  2,
);

const SAMPLE_FILTER = '.users[] | {name, email}';

export function jqSection() {
  const filterInput = $('jq-filter') as HTMLInputElement;
  const jsonInput = $('jq-json') as HTMLTextAreaElement;
  const output = $('jq-output');
  const jsonError = $('jq-json-error');
  const filterError = $('jq-filter-error');
  const status = $('jq-status');
  const copyBtn = $('jq-copy') as HTMLButtonElement;
  const sampleBtn = $('jq-sample') as HTMLButtonElement;

  let loaded = false;
  let lastOutput = '';
  let debounce: number | undefined;
  let runToken = 0;

  function clearJsonError() {
    jsonError.textContent = '';
    jsonError.classList.add('hidden');
  }
  function showJsonError(msg: string) {
    jsonError.textContent = msg;
    jsonError.classList.remove('hidden');
    output.classList.add('opacity-40');
  }
  function clearFilterError() {
    filterError.textContent = '';
    filterError.classList.add('hidden');
  }
  function showFilterError(msg: string) {
    filterError.textContent = msg;
    filterError.classList.remove('hidden');
    output.classList.add('opacity-40');
  }

  async function run() {
    const rawJson = jsonInput.value;
    const filter = filterInput.value;

    // 1) Validate JSON separately so a parse failure lands in jq-json-error.
    let data: unknown;
    try {
      data = JSON.parse(rawJson);
    } catch (e) {
      showJsonError((e as Error).message);
      return;
    }
    clearJsonError();

    // 2) Load the engine lazily on first run.
    if (!loaded) {
      status.textContent = 'loading jq… (~2.7 MB, cached after first use)';
      try {
        await loadJq();
        loaded = true;
      } catch (e) {
        clearFilterError();
        showFilterError('failed to load jq: ' + (e as Error).message);
        status.textContent = '';
        return;
      }
    }

    // 3) Evaluate the filter; a jq failure lands in jq-filter-error.
    const token = ++runToken;
    const t0 = performance.now();
    try {
      const jq = await loadJq();
      const out = await jq.json(data, filter);
      if (token !== runToken) return; // superseded by a newer run
      const text = JSON.stringify(out, null, 2);
      lastOutput = text;
      output.textContent = text;
      output.classList.remove('opacity-40');
      clearFilterError();
      const ms = Math.max(0, Math.round(performance.now() - t0));
      status.textContent = `ok · ${ms}ms`;
    } catch (e) {
      if (token !== runToken) return;
      // jq emits its compile/runtime errors via stderr (Error.message).
      const msg = ((e as Error).message || String(e)).trim();
      showFilterError(msg || 'jq error');
      status.textContent = 'error';
    }
  }

  function schedule(delay = 300) {
    if (debounce) clearTimeout(debounce);
    debounce = window.setTimeout(run, delay);
  }

  filterInput.addEventListener('input', () => schedule());
  jsonInput.addEventListener('input', () => schedule());

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(lastOutput || output.textContent || '');
    const prev = copyBtn.textContent;
    copyBtn.textContent = 'copied';
    copyBtn.classList.add('text-ok', 'border-ok');
    setTimeout(() => {
      copyBtn.textContent = prev;
      copyBtn.classList.remove('text-ok', 'border-ok');
    }, 1000);
  });

  sampleBtn.addEventListener('click', () => {
    jsonInput.value = SAMPLE_JSON;
    filterInput.value = SAMPLE_FILTER;
    schedule(0);
  });

  // Preload the sample and run it once on init.
  jsonInput.value = SAMPLE_JSON;
  filterInput.value = SAMPLE_FILTER;
  schedule(0);
}
