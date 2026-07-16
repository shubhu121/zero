import {
  REFERRER_POLICIES, buildCacheControl, buildCanonical, buildCors, buildCsp,
  buildHreflang, buildHsts, buildLinkHeader, buildManifest, buildPermissionsPolicy,
  buildRedirects, buildRobots, buildSecurityTxt, buildSitemap, parseSetCookies,
  type WebStandardsTool,
} from '../../lib/webStandards';

function byId<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

function value(id: string) { return byId<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(id).value; }
function checked(id: string) { return byId<HTMLInputElement>(id).checked; }

export function initWebStandardsTool(kind: WebStandardsTool) {
  const output = byId<HTMLPreElement>('standard-output');
  const note = byId<HTMLParagraphElement>('standard-note');
  const copy = byId<HTMLButtonElement>('standard-copy');
  let current = '';
  const show = (text: string, detail = '') => { current = text; output.textContent = text; note.textContent = detail; };
  const watch = (ids: string[], render: () => void) => {
    for (const id of ids) {
      const field = byId<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(id);
      field.addEventListener('input', render);
      field.addEventListener('change', render);
    }
    render();
  };

  copy.addEventListener('click', async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current);
      copy.textContent = 'copied';
      setTimeout(() => { copy.textContent = 'copy'; }, 1100);
    } catch { note.textContent = 'Select the output and copy it manually.'; }
  });

  if (kind === 'csp') return watch(['csp-directives'], () => show(`Content-Security-Policy: ${buildCsp(value('csp-directives'))}`));
  if (kind === 'cors') return watch(['cors-origin', 'cors-methods', 'cors-headers', 'cors-max-age', 'cors-credentials'], () => {
    const credentials = checked('cors-credentials');
    const origin = value('cors-origin');
    show(buildCors({ origin, methods: value('cors-methods'), headers: value('cors-headers'), credentials, maxAge: value('cors-max-age') }), credentials && origin.trim() === '*' ? 'Credentials cannot be used with Access-Control-Allow-Origin: *.' : '');
  });
  if (kind === 'cache-control') return watch(['cache-visibility', 'cache-max-age', 'cache-immutable', 'cache-no-cache'], () => show(buildCacheControl({ visibility: value('cache-visibility'), maxAge: value('cache-max-age'), immutable: checked('cache-immutable'), noCache: checked('cache-no-cache') })));
  if (kind === 'cookies') return watch(['cookies-raw'], () => {
    const cookies = parseSetCookies(value('cookies-raw'));
    show(cookies.length ? JSON.stringify(cookies, null, 2) : 'Paste one or more Set-Cookie header values.');
  });
  if (kind === 'robots') return watch(['robots-agent', 'robots-sitemap', 'robots-allow', 'robots-disallow'], () => show(buildRobots({ userAgent: value('robots-agent'), sitemap: value('robots-sitemap'), allow: value('robots-allow'), disallow: value('robots-disallow') })));
  if (kind === 'sitemap') return watch(['sitemap-base', 'sitemap-paths'], () => show(buildSitemap(value('sitemap-base'), value('sitemap-paths'))));
  if (kind === 'security-txt') return watch(['security-contact', 'security-expires', 'security-encryption', 'security-policy'], () => show(buildSecurityTxt({ contact: value('security-contact'), expires: value('security-expires'), encryption: value('security-encryption'), policy: value('security-policy') })));
  if (kind === 'redirects') return watch(['redirects-raw'], () => show(buildRedirects(value('redirects-raw')), 'Netlify-style _redirects format.'));
  if (kind === 'referrer-policy') return watch(['referrer-policy-value'], () => {
    const policy = value('referrer-policy-value');
    show(`Referrer-Policy: ${policy}\n<meta name="referrer" content="${policy}">`, REFERRER_POLICIES[policy] || '');
  });
  if (kind === 'permissions-policy') return watch(['permissions-raw'], () => show(buildPermissionsPolicy(value('permissions-raw'))));
  if (kind === 'hsts') return watch(['hsts-max-age', 'hsts-subdomains', 'hsts-preload'], () => show(buildHsts(value('hsts-max-age'), checked('hsts-subdomains'), checked('hsts-preload')), checked('hsts-preload') ? 'Only submit a domain for HSTS preload after its HTTPS setup is complete.' : ''));
  if (kind === 'canonical') return watch(['canonical-url'], () => show(buildCanonical(value('canonical-url'))));
  if (kind === 'hreflang') return watch(['hreflang-raw'], () => show(buildHreflang(value('hreflang-raw'))));
  if (kind === 'manifest') return watch(['manifest-name', 'manifest-short-name', 'manifest-start-url', 'manifest-display', 'manifest-theme-color', 'manifest-background-color'], () => show(buildManifest({ name: value('manifest-name'), shortName: value('manifest-short-name'), startUrl: value('manifest-start-url'), display: value('manifest-display'), themeColor: value('manifest-theme-color'), backgroundColor: value('manifest-background-color') })));
  if (kind === 'link-header') return watch(['link-header-url', 'link-header-relation', 'link-header-as', 'link-header-crossorigin'], () => show(buildLinkHeader({ url: value('link-header-url'), relation: value('link-header-relation'), as: value('link-header-as'), crossorigin: checked('link-header-crossorigin') })));
}
