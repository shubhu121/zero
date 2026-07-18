import { describe, expect, it } from 'vitest';
import {
  caseVariants,
  decodeHtmlEntities,
  encodeHtmlEntities,
  formatQuery,
  gitignoreFor,
  inspectUnicode,
  inspectUserAgent,
  lookupHttpStatus,
  lookupMime,
  parseEnv,
  parseQuery,
  unixPermissions,
} from '../../src/hubs/dev0/lib/toolbox';

describe('developer toolbox helpers', () => {
  it('parses and normalizes a URL query while retaining repeated keys', () => {
    const entries = parseQuery('https://example.com/?name=Ada+Lovelace&tag=one&tag=two#section');
    expect(entries).toEqual([
      { key: 'name', value: 'Ada Lovelace' },
      { key: 'tag', value: 'one' },
      { key: 'tag', value: 'two' },
    ]);
    expect(formatQuery(entries)).toBe('name=Ada+Lovelace&tag=one&tag=two');
  });

  it('encodes and decodes HTML entities', () => {
    expect(encodeHtmlEntities('<a href="/?q=one&two">')).toBe('&lt;a href=&quot;/?q=one&amp;two&quot;&gt;');
    expect(decodeHtmlEntities('&lt;span&gt;&#x1F44B; &#39;hi&#39;&lt;/span&gt;')).toBe("<span>👋 'hi'</span>");
    expect(decodeHtmlEntities('&#x110000;')).toBe('&#x110000;');
  });

  it('produces useful case variants from human text', () => {
    expect(caseVariants('TabZero browser tools')).toMatchObject({
      camelCase: 'tabZeroBrowserTools',
      PascalCase: 'TabZeroBrowserTools',
      snake_case: 'tab_zero_browser_tools',
      'kebab-case': 'tab-zero-browser-tools',
    });
  });

  it('inspects Unicode code points and UTF-8 bytes', () => {
    expect(inspectUnicode('A👋')).toEqual([
      { char: 'A', codePoint: 'U+0041', decimal: 65, utf8: '41' },
      { char: '👋', codePoint: 'U+1F44B', decimal: 128075, utf8: 'F0 9F 91 8B' },
    ]);
  });

  it('translates chmod modes including special bits', () => {
    expect(unixPermissions('4755')).toEqual({
      octal: '4755',
      symbolic: 'user: rws\ngroup: r-x\nother: r-x',
    });
  });

  it('finds bundled MIME types and HTTP statuses', () => {
    expect(lookupMime('assets/logo.svg')).toEqual({ extension: 'svg', mime: 'image/svg+xml' });
    expect(lookupHttpStatus('429')).toMatchObject({ title: 'Too Many Requests', category: 'Client error' });
  });

  it('recognizes a modern Edge user agent without capture leakage', () => {
    const info = inspectUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.67');
    expect(info).toEqual({ browser: 'Microsoft Edge 124.0.2478.67', engine: 'Blink', os: 'Windows 10 or 11', device: 'Desktop' });
  });

  it('reports malformed and duplicate .env lines', () => {
    const parsed = parseEnv('API_URL="https://localhost"\nAPI_URL=duplicate\nBAD LINE');
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0]).toMatchObject({ key: 'API_URL', quoted: true, duplicate: false });
    expect(parsed.entries[1]).toMatchObject({ key: 'API_URL', duplicate: true });
    expect(parsed.issues).toEqual(['Line 2: duplicate key API_URL', 'Line 3: expected KEY=value']);
  });

  it('combines .gitignore presets without duplicate entries', () => {
    const output = gitignoreFor(['node', 'python', 'macos']);
    expect(output).toContain('node_modules/\n');
    expect(output).toContain('.DS_Store\n');
    expect(output.match(/^\.env$/gm)).toHaveLength(1);
  });
});
