// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// media0 needs cross-origin isolation (SharedArrayBuffer for multithreaded FFmpeg.wasm).
// COOP+COEP are scoped to /media0 DOCUMENTS only, so COEP can never break another hub's
// pages. But the spec also requires that any dedicated worker a cross-origin-isolated
// document spawns from a network URL carries COEP `require-corp` on the worker script's
// OWN response — the ffmpeg API worker chunk lives under /_astro/, so non-document
// requests get a COEP header too (inert on scripts/styles/images; only workers read it).
// Without it the worker is killed with ERR_BLOCKED_BY_RESPONSE and ff.load() hangs.
// Prod mirrors this via vercel.json; dev needs this integration because
// `vite.server.headers` alone doesn't cover Astro's rendered HTML.
// Non-isolated contexts (e.g. if headers are stripped) fall back to single-thread FFmpeg.
/** @type {import('astro').AstroIntegration} */
const media0IsolationDev = {
  name: 'media0:coi-dev',
  hooks: {
    'astro:server:setup': ({ server }) => {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/media0' || req.url?.startsWith('/media0/')) {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        } else if (!req.headers.accept?.includes('text/html')) {
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        }
        next();
      });
    },
  },
};

// TabZero — single integrated app. Each hub is a route group under src/pages/<hub>/.
// MPA static output: every route ships its own CSS bundle, so per-hub themes never collide.
export default defineConfig({
  // Canonical site URL — single source for canonical tags, OG URLs, and the sitemap.
  // Replace this placeholder with the production domain before deploying.
  // Keep public/robots.txt in sync when the domain is set.
  site: 'https://example.com',
  output: 'static',
  integrations: [tailwind(), sitemap(), media0IsolationDev],
  build: { inlineStylesheets: 'auto' },
  vite: {
    optimizeDeps: {
      // Pre-bundle heavy deps so the dev server serves one request each instead of
      // flooding the browser with hundreds of unbundled ESM modules (ERR_INSUFFICIENT_RESOURCES).
      // dev0: jq-web/quicktype-core/dagre (CJS); privacy0: exifr/pdf-lib (metadata stripper).
      include: ['jq-web', 'quicktype-core', 'dagre', 'exifr', 'pdf-lib'],
      // data0 ships its own wasm; media0/ai0 load ffmpeg/whisper/WebLLM/pdf.js via dynamic
      // import — pre-bundling breaks their wasm/worker URL resolution. Let Vite leave them alone.
      exclude: [
        '@duckdb/duckdb-wasm',
        '@ffmpeg/ffmpeg',
        '@ffmpeg/util',
        '@huggingface/transformers',
        '@mlc-ai/web-llm',
        'pdfjs-dist',
      ],
    },
  },
});
