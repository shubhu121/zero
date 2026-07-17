// CSS gradient maker — two color stops, linear (with angle) or radial, with a
// live preview and copyable CSS. All local.

function $(id: string) { return document.getElementById(id)!; }

let type: 'linear' | 'radial' = 'linear';

export function initGradient() {
  const c1 = $('gr-c1') as HTMLInputElement;
  const c2 = $('gr-c2') as HTMLInputElement;
  const p1 = $('gr-p1') as HTMLInputElement;
  const p2 = $('gr-p2') as HTMLInputElement;
  const angle = $('gr-angle') as HTMLInputElement;
  const angleVal = $('gr-angle-val');
  const angleWrap = $('gr-angle-wrap');
  const preview = $('gr-preview');
  const cssEl = $('gr-css');
  const copyBtn = $('gr-copy');

  function gradientCss(): string {
    const stops = `${c1.value} ${p1.value}%, ${c2.value} ${p2.value}%`;
    return type === 'linear'
      ? `linear-gradient(${angle.value}deg, ${stops})`
      : `radial-gradient(circle, ${stops})`;
  }

  function run() {
    angleVal.textContent = `${angle.value}°`;
    angleWrap.style.display = type === 'linear' ? '' : 'none';
    const css = gradientCss();
    preview.style.background = css;
    cssEl.textContent = `background: ${css};`;
  }

  for (const b of document.querySelectorAll<HTMLButtonElement>('.gr-type-btn')) {
    b.addEventListener('click', () => {
      type = b.dataset.grType as 'linear' | 'radial';
      for (const x of document.querySelectorAll<HTMLButtonElement>('.gr-type-btn')) {
        const active = x.dataset.grType === type;
        x.classList.toggle('bg-bg', active);
        x.classList.toggle('text-accent', active);
        x.classList.toggle('text-muted', !active);
      }
      run();
    });
  }
  [c1, c2, p1, p2, angle].forEach((el) => el.addEventListener('input', run));
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(cssEl.textContent || '');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy CSS'), 1200);
    } catch { /* ignore */ }
  });

  run();
}
