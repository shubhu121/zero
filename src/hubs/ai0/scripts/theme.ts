export function initThemeToggle(btn: HTMLElement) {
  btn.addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'nocturne' ? 'paper' : 'nocturne';
    root.dataset.theme = next;
    localStorage.setItem('0-theme', next);
  });
}
