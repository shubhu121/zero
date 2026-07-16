// Small, dependency-free helpers for browser-delivery standards. Every function is
// deterministic: it only formats or reads text supplied in the current tab.

export type WebStandardsTool =
  | 'csp' | 'cors' | 'cache-control' | 'cookies' | 'robots' | 'sitemap'
  | 'security-txt' | 'redirects' | 'referrer-policy' | 'permissions-policy'
  | 'hsts' | 'canonical' | 'hreflang' | 'manifest' | 'link-header';

export const WEB_STANDARD_TOOL_SLUGS: WebStandardsTool[] = [
  'csp', 'cors', 'cache-control', 'cookies', 'robots', 'sitemap', 'security-txt',
  'redirects', 'referrer-policy', 'permissions-policy', 'hsts', 'canonical',
  'hreflang', 'manifest', 'link-header',
];

function lines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function xml(value: string) {
  return value.replace(/[<>&'\"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]!);
}

function attr(value: string) {
  return value.replace(/[&'\"]/g, (char) => ({ '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]!);
}

export function buildCsp(raw: string) {
  return lines(raw)
    .map((line) => line.replace(/;\s*$/, '').replace(/\s+/g, ' '))
    .join('; ') + (lines(raw).length ? ';' : '');
}

export function buildCors(options: { origin: string; methods: string; headers: string; credentials: boolean; maxAge: string }) {
  const origin = options.origin.trim() || '*';
  const methods = options.methods.split(',').map((method) => method.trim().toUpperCase()).filter(Boolean).join(', ') || 'GET';
  const out = [`Access-Control-Allow-Origin: ${origin}`, `Access-Control-Allow-Methods: ${methods}`];
  if (options.headers.trim()) out.push(`Access-Control-Allow-Headers: ${options.headers.split(',').map((header) => header.trim()).filter(Boolean).join(', ')}`);
  if (options.credentials) out.push('Access-Control-Allow-Credentials: true');
  const maxAge = Number(options.maxAge);
  if (Number.isFinite(maxAge) && maxAge >= 0) out.push(`Access-Control-Max-Age: ${Math.floor(maxAge)}`);
  return out.join('\n');
}

export function buildCacheControl(options: { visibility: string; maxAge: string; immutable: boolean; noCache: boolean }) {
  const directives = [options.visibility === 'private' ? 'private' : 'public'];
  const maxAge = Number(options.maxAge);
  if (Number.isFinite(maxAge) && maxAge >= 0) directives.push(`max-age=${Math.floor(maxAge)}`);
  if (options.noCache) directives.push('no-cache');
  if (options.immutable) directives.push('immutable');
  return `Cache-Control: ${directives.join(', ')}`;
}

export interface CookieDetail { name: string; value: string; attributes: Record<string, string | true>; }

export function parseSetCookies(raw: string): CookieDetail[] {
  return lines(raw).map((line) => {
    const source = line.replace(/^set-cookie:\s*/i, '');
    const [pair = '', ...parts] = source.split(';');
    const eq = pair.indexOf('=');
    const attributes: Record<string, string | true> = {};
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const attributeEq = trimmed.indexOf('=');
      const key = (attributeEq < 0 ? trimmed : trimmed.slice(0, attributeEq)).trim();
      if (key) attributes[key.toLowerCase()] = attributeEq < 0 ? true : trimmed.slice(attributeEq + 1).trim();
    }
    return { name: (eq < 0 ? pair : pair.slice(0, eq)).trim(), value: eq < 0 ? '' : pair.slice(eq + 1).trim(), attributes };
  }).filter((cookie) => cookie.name);
}

export function buildRobots(options: { userAgent: string; allow: string; disallow: string; sitemap: string }) {
  const out = [`User-agent: ${options.userAgent.trim() || '*'}`];
  for (const path of lines(options.allow)) out.push(`Allow: ${path}`);
  for (const path of lines(options.disallow)) out.push(`Disallow: ${path}`);
  if (options.sitemap.trim()) out.push('', `Sitemap: ${options.sitemap.trim()}`);
  return out.join('\n');
}

export function buildSitemap(baseUrl: string, paths: string) {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const urls = lines(paths).map((path) => {
    if (/^https?:\/\//i.test(path)) return path;
    return `${base}/${path.replace(/^\/+/, '')}`;
  }).filter((url) => {
    try { new URL(url); return true; } catch { return false; }
  });
  const nodes = urls.map((url) => `  <url>\n    <loc>${xml(url)}</loc>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${nodes}\n</urlset>`;
}

export function buildSecurityTxt(options: { contact: string; expires: string; encryption: string; policy: string }) {
  const out = [] as string[];
  for (const contact of lines(options.contact)) out.push(`Contact: ${contact}`);
  if (options.expires.trim()) out.push(`Expires: ${options.expires.trim()}`);
  if (options.encryption.trim()) out.push(`Encryption: ${options.encryption.trim()}`);
  if (options.policy.trim()) out.push(`Policy: ${options.policy.trim()}`);
  return out.join('\n');
}

export function buildRedirects(raw: string) {
  return lines(raw).map((line) => {
    const [from, to, status = '301'] = line.split(/\s+/);
    return from && to ? `${from}  ${to}  ${/^30[12]$/.test(status) ? status : '301'}` : '';
  }).filter(Boolean).join('\n');
}

export const REFERRER_POLICIES: Record<string, string> = {
  'no-referrer': 'Sends no referrer information on any request.',
  'same-origin': 'Sends the full referrer only to pages on the same origin.',
  'strict-origin': 'Sends only the origin over HTTPS, and nothing on HTTPS to HTTP downgrades.',
  'strict-origin-when-cross-origin': 'Sends the full URL on same-origin requests and only the origin on secure cross-origin requests. Browser default.',
  'origin-when-cross-origin': 'Sends the full URL on same-origin requests and the origin cross-origin.',
};

export function buildPermissionsPolicy(raw: string) {
  return `Permissions-Policy: ${lines(raw).map((line) => line.replace(/\s+/g, '')).join(', ')}`;
}

export function buildHsts(maxAge: string, includeSubdomains: boolean, preload: boolean) {
  const age = Math.max(0, Math.floor(Number(maxAge) || 0));
  const directives = [`max-age=${age}`];
  if (includeSubdomains) directives.push('includeSubDomains');
  if (preload) directives.push('preload');
  return `Strict-Transport-Security: ${directives.join('; ')}`;
}

export function buildCanonical(url: string) {
  return `<link rel="canonical" href="${attr(url.trim())}">`;
}

export function buildHreflang(raw: string) {
  return lines(raw).map((line) => {
    const [language, ...urlParts] = line.split(/\s+/);
    const url = urlParts.join(' ');
    return language && url ? `<link rel="alternate" hreflang="${attr(language)}" href="${attr(url)}">` : '';
  }).filter(Boolean).join('\n');
}

export function buildManifest(options: { name: string; shortName: string; startUrl: string; display: string; themeColor: string; backgroundColor: string }) {
  return JSON.stringify({
    name: options.name.trim(),
    short_name: options.shortName.trim() || options.name.trim(),
    start_url: options.startUrl.trim() || '/',
    display: options.display,
    theme_color: options.themeColor,
    background_color: options.backgroundColor,
  }, null, 2);
}

export function buildLinkHeader(options: { url: string; relation: string; as: string; crossorigin: boolean }) {
  const segments = [`<${options.url.trim()}>`, `rel="${options.relation.trim() || 'preload'}"`];
  if (options.as.trim()) segments.push(`as="${options.as.trim()}"`);
  if (options.crossorigin) segments.push('crossorigin');
  return `Link: ${segments.join('; ')}`;
}
