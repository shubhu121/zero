// Pure HTTP response-header security audit. No DOM, no network — unit-tested.

interface HeaderCheck {
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  required: boolean;
  validate?: (value: string) => string | null;
  description: string;
  recommendation: string;
}

const CHECKS: HeaderCheck[] = [
  {
    name: 'content-security-policy',
    severity: 'high', required: true,
    description: 'Controls which resources the browser is allowed to load.',
    recommendation: "Add a strict CSP: `default-src 'self'; object-src 'none'; base-uri 'self'`.",
    validate: (v) => (v.includes('default-src') ? null : 'CSP present but missing default-src'),
  },
  {
    name: 'strict-transport-security',
    severity: 'high', required: true,
    description: 'Forces browsers to use HTTPS for this domain.',
    recommendation: 'Add: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`',
    validate: (v) => {
      const m = v.match(/max-age=(\d+)/);
      if (!m) return 'missing max-age';
      const days = parseInt(m[1]!, 10) / 86400;
      if (days < 365) return `max-age is ${Math.floor(days)} days, recommend >= 365`;
      return null;
    },
  },
  {
    name: 'x-frame-options',
    severity: 'medium', required: false,
    description: 'Prevents the page from being framed (clickjacking).',
    recommendation: 'Add: `X-Frame-Options: DENY` (or use CSP frame-ancestors).',
    validate: (v) => (/DENY|SAMEORIGIN/i.test(v) ? null : `value "${v}" not strict`),
  },
  {
    name: 'x-content-type-options',
    severity: 'medium', required: true,
    description: 'Prevents MIME-type sniffing.',
    recommendation: 'Add: `X-Content-Type-Options: nosniff`',
  },
  {
    name: 'referrer-policy',
    severity: 'low', required: false,
    description: 'Controls how much referrer info leaks to other origins.',
    recommendation: 'Add: `Referrer-Policy: strict-origin-when-cross-origin` (or stricter).',
  },
  {
    name: 'permissions-policy',
    severity: 'low', required: false,
    description: 'Disables powerful browser features the page does not need.',
    recommendation: 'Add: `Permissions-Policy: camera=(), microphone=(), geolocation=()`',
  },
  {
    name: 'cross-origin-opener-policy',
    severity: 'low', required: false,
    description: 'Isolates the browsing context from other origins.',
    recommendation: 'Add: `Cross-Origin-Opener-Policy: same-origin`',
  },
  {
    name: 'server',
    severity: 'info', required: false,
    description: 'Reveals the web server software and version.',
    recommendation: 'Remove or set to a generic value to reduce fingerprinting.',
  },
];

export function parsePastedHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  let lastKey: string | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (/^HTTP\//i.test(line.trim())) continue;            // status line
    if (/^[ \t]/.test(line) && lastKey) {                  // folded continuation
      out[lastKey] += ' ' + line.trim();
      continue;
    }
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (!m) { lastKey = null; continue; }
    lastKey = m[1]!.toLowerCase();
    out[lastKey] = m[2]!.trim();
  }
  return out;
}

export interface Finding { name: string; status: 'pass' | 'warn' | 'fail' | 'info'; severity: string; msg?: string; }
export interface Grade { letter: string; desc: string; score: number; total: number; findings: Finding[]; }

function gradeFrom(score: number, total: number, critical: number): { letter: string; desc: string } {
  if (critical > 0) return { letter: 'F', desc: 'Missing critical security headers' };
  const r = total ? score / total : 0;
  if (r >= 0.85) return { letter: 'A', desc: 'Excellent security posture' };
  if (r >= 0.65) return { letter: 'B', desc: 'Good, with room to improve' };
  if (r >= 0.4) return { letter: 'C', desc: 'Adequate, several gaps' };
  if (r >= 0.2) return { letter: 'D', desc: 'Poor security posture' };
  return { letter: 'F', desc: 'No security headers present' };
}

export function auditHeaders(headers: Record<string, string>): Grade {
  let score = 0, total = 0, critical = 0;
  const findings: Finding[] = [];
  for (const c of CHECKS) {
    total += 1;
    const v = headers[c.name];
    if (v !== undefined) {
      const validationMsg = c.validate ? c.validate(v) : null;
      if (validationMsg) {
        findings.push({ name: c.name, status: 'warn', severity: c.severity, msg: validationMsg });
        score += c.severity === 'high' || c.severity === 'critical' ? 0.5 : 0.75;
      } else {
        findings.push({ name: c.name, status: 'pass', severity: c.severity });
        score += 1;
      }
    } else {
      if (c.severity === 'critical') critical++;
      if (c.required || c.severity === 'high' || c.severity === 'critical') {
        findings.push({ name: c.name, status: 'fail', severity: c.severity, msg: c.recommendation });
      } else {
        findings.push({ name: c.name, status: 'info', severity: c.severity, msg: c.description });
      }
    }
  }
  const g = gradeFrom(score, total, critical);
  return { letter: g.letter, desc: g.desc, score, total, findings };
}
