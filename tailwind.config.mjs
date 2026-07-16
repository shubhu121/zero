// tailwind.config.mjs — semantic tokens only; components NEVER use raw palette colors
export default {
  content: ['./src/**/*.{astro,html,ts,tsx,md}'],
  theme: {
    colors: {
      bg: 'var(--bg)', raised: 'var(--bg-raised)', sunken: 'var(--bg-sunken)',
      ink: 'var(--ink)', 'ink-soft': 'var(--ink-soft)', muted: 'var(--muted)',
      accent: 'var(--accent)', 'accent-ink': 'var(--accent-ink)', 'accent-soft': 'var(--accent-soft)',
      rule: 'var(--rule)', 'rule-strong': 'var(--rule-strong)',
      ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)',
      transparent: 'transparent', current: 'currentColor',
    },
    fontFamily: {
      mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      body: ['system-ui', 'sans-serif'],
    },
    extend: {},
  },
};
