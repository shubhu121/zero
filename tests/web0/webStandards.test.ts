import { describe, expect, it } from 'vitest';
import {
  buildCacheControl, buildCanonical, buildCors, buildCsp, buildHreflang, buildHsts,
  buildLinkHeader, buildManifest, buildPermissionsPolicy, buildRedirects, buildRobots,
  buildSecurityTxt, buildSitemap, parseSetCookies,
} from '../../src/hubs/web0/lib/webStandards';

describe('web-standard helpers', () => {
  it('formats HTTP delivery and security headers', () => {
    expect(buildCsp("default-src 'self'\nobject-src 'none'")).toBe("default-src 'self'; object-src 'none';");
    expect(buildCors({ origin: 'https://app.example.com', methods: 'get, post', headers: 'Content-Type', credentials: true, maxAge: '600' })).toContain('Access-Control-Allow-Methods: GET, POST');
    expect(buildCacheControl({ visibility: 'public', maxAge: '31536000', immutable: true, noCache: false })).toBe('Cache-Control: public, max-age=31536000, immutable');
    expect(buildPermissionsPolicy('camera=()\nmicrophone=()')).toBe('Permissions-Policy: camera=(), microphone=()');
    expect(buildHsts('63072000', true, true)).toBe('Strict-Transport-Security: max-age=63072000; includeSubDomains; preload');
    expect(buildLinkHeader({ url: '/app.css', relation: 'preload', as: 'style', crossorigin: false })).toBe('Link: </app.css>; rel="preload"; as="style"');
  });

  it('reads cookie flags without mutating cookies', () => {
    expect(parseSetCookies('session=abc; Path=/; Secure; HttpOnly; SameSite=Lax')).toEqual([{
      name: 'session', value: 'abc', attributes: { path: '/', secure: true, httponly: true, samesite: 'Lax' },
    }]);
  });

  it('generates crawler and disclosure files', () => {
    expect(buildRobots({ userAgent: '*', allow: '/', disallow: '/admin/', sitemap: 'https://example.com/sitemap.xml' })).toContain('Disallow: /admin/');
    expect(buildSitemap('https://example.com/', '/about/')).toContain('<loc>https://example.com/about/</loc>');
    expect(buildSecurityTxt({ contact: 'mailto:security@example.com', expires: '2027-01-01T00:00:00Z', encryption: '', policy: '' })).toContain('Expires: 2027-01-01T00:00:00Z');
    expect(buildRedirects('/old /new 302')).toBe('/old  /new  302');
  });

  it('escapes and formats SEO and PWA metadata', () => {
    expect(buildCanonical('https://example.com/?x="one"')).toBe('<link rel="canonical" href="https://example.com/?x=&quot;one&quot;">');
    expect(buildHreflang('en https://example.com/en/\nx-default https://example.com/')).toContain('hreflang="x-default"');
    expect(buildManifest({ name: 'Example', shortName: '', startUrl: '/', display: 'standalone', themeColor: '#000000', backgroundColor: '#ffffff' })).toContain('"short_name": "Example"');
  });
});
