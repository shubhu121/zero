// Entry point wired from index.astro. Mounts the tool layout, then surfaces
// DuckDB readiness in the footer status line. DuckDB-WASM loads its worker and
// wasm bundle from the jsDelivr CDN at runtime — no bundler config required.
import { mount } from './ui';
import { dbInfo } from './db';

export async function boot(): Promise<void> {
  mount();
  const status = document.querySelector<HTMLElement>('#status');
  if (status) status.textContent = 'Loading DuckDB…';
  try {
    const { version } = await dbInfo();
    if (status) status.textContent = `DuckDB ${version.replace(/^v/, '')} · ready`;
  } catch (err) {
    if (status) {
      status.textContent = `Error: ${(err as Error).message}`;
      status.classList.add('error');
    }
    console.error(err);
  }
}
