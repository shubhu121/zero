# TabZero

**Private browser tools that stay in your tab.** Every tool runs entirely client-side — nothing is uploaded, no API keys, no accounts, no tracking. Open DevTools → Network and watch: your data never leaves the page.

One integrated [Astro](https://astro.build) app. Each hub is a route group with its own accent and theme, sharing a single semantic-token design system.

![TabZero demo — 75 client-side browser tools across seven hubs](docs/media/0-suite-demo.gif)

## Hubs

| Hub | Accent | What it does |
|-----|--------|--------------|
| **dev0** | blue | 23 developer utilities — JWT decoder, regex tester, cron parser, base64, epoch converter, JSON→types, jq playground, ERD generator, UUID/ULID, cert inspector, JSON formatter, SHA hash, diff checker, query parser, HTML entities, case converter, Unicode inspector, Unix permissions, MIME lookup, HTTP status explorer, user-agent inspector, .env inspector and .gitignore generator |
| **web0** | teal | 21 network and web-standard tools — DNS-over-HTTPS lookup, RDAP, HTTP header audit, WebSocket tester, email-header analyzer, CIDR calculator, CSP/CORS/Cache-Control/HSTS/Permissions/Referrer/Link header builders, cookie inspector, robots.txt, sitemap XML, security.txt, redirects, canonical, hreflang and web-manifest generators |
| **data0** | violet | 7 data tools — DuckDB-WASM SQL workbench (CSV / Parquet / JSON) plus CSV⇄JSON, YAML⇄JSON, SQL formatter, Markdown-table generator, base converter and chart maker |
| **privacy0** | emerald | 7 privacy tools — PII scrubber, file metadata stripper, encrypted local notes, browser-fingerprint check, password generator, file-hash checker, image steganography |
| **ui0** | amber | 7 design & web tools — color picker (+ WCAG contrast), CSS gradient maker, meta / Open-Graph preview, favicon generator, QR code, URL encoder, lorem ipsum |
| **media0** | fuchsia | 6 media tools — FFmpeg + Whisper in WebAssembly: transcribe, convert, trim, compress, GIF maker, extract audio |
| **ai0** | cyan | 4 local-AI tools — LLM chat (WebGPU), PDF Q&A (local RAG), prompt playground, OCR |

`hub0` is the TabZero landing page that links them together — 75 tools across seven hubs, one real URL each.

> Why client-side matters now: the safest way to use these alongside AI tools is to never hand your data to anyone's servers. Scrub it, decode it, query it — locally, in the tab.

## Develop

Requires Node 18+.

```bash
npm install
npm run dev       # local dev server
npm run build     # static build to dist/
npm run preview   # serve the production build
npm run check     # astro check (type/diagnostics)
npm test          # vitest unit tests (media0/ai0 pure libs)
```

## Architecture

Single Astro 5 app, `output: 'static'` (MPA) — every route ships its own CSS bundle, so per-hub themes never collide.

```
src/
  pages/
    index.astro        # hub0 landing
    <hub>/*.astro      # one route per tool (dev0/, web0/, data0/, privacy0/, ui0/, media0/, ai0/)
  hubs/
    <hub>/             # per-hub components, styles, lib
```

- **Stack:** Astro + Tailwind + TypeScript, all hubs (data0 included — it's Astro, not Vite).
- **Theme:** paper (light) / nocturne (dark) via `data-theme`, persisted to `localStorage['0-theme']`.
- **Token contract:** hubs use semantic CSS vars (`--bg`, `--ink`, `--accent`, …) — never raw colors. Accent is the only per-hub differentiator.
- **Heavy deps run in-browser:** DuckDB-WASM (data0), exifr + pdf-lib (privacy0 metadata), jq-web / quicktype-core / dagre (dev0), FFmpeg.wasm + Whisper via Transformers.js (media0), WebLLM + Transformers.js + pdf.js (ai0).
- **Cross-origin isolation:** `/media0/*` documents get COOP/COEP headers (vercel.json in prod, a dev-server middleware locally) so multithreaded FFmpeg.wasm can use `SharedArrayBuffer`; other hubs are untouched. Without isolation media0 falls back to single-thread FFmpeg.
- **SEO:** static URLs, unique titles + meta, `SoftwareApplication` JSON-LD, sitemap, robots.txt.

The canonical site URL is a placeholder in `astro.config.mjs` (`site:`) — set it once a domain is chosen.



