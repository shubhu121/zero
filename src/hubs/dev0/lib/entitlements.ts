// 0ds entitlements — canonical source: browser-based-tools/MONETIZATION.md. Copy, don't drift.
// Offline license verification. No network calls, ever.

const HUB = 'dev0'; // ← change per hub: ai0 | media0 | privacy0 | dev0 | web0 | data0

// ECDSA P-256 public key, JWK. Generated once by licensing/keygen.mjs; same across all hubs.
// REPLACE x/y with the real values from licensing/keys/public.jwk before any pro launch.
const PUBLIC_JWK: JsonWebKey = {
  kty: 'EC', crv: 'P-256',
  x: 'REPLACE_WITH_REAL_PUBLIC_KEY_X',
  y: 'REPLACE_WITH_REAL_PUBLIC_KEY_Y',
};

export interface LicensePayload {
  v: 1;
  email: string;
  plan: 'pro';
  hubs: string[];
  iat: number;
  exp: number | null;
}

export interface Entitlements {
  plan: 'free' | 'pro';
  email?: string;
}

const STORAGE_KEY = '0-license';

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function verifyLicenseKey(key: string, jwk: JsonWebKey = PUBLIC_JWK): Promise<LicensePayload | null> {
  const parts = key.trim().split('.');
  if (parts.length !== 3 || parts[0] !== '0LK1') return null;
  try {
    const payloadBytes = b64urlToBytes(parts[1]!);
    const sig = b64urlToBytes(parts[2]!);
    const pub = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
    );
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' }, pub, sig, payloadBytes,
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as LicensePayload;
    if (payload.v !== 1) return null;
    if (payload.exp !== null && payload.exp < Date.now() / 1000) return null;
    if (!payload.hubs.includes('*') && !payload.hubs.includes(HUB)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getEntitlements(): Promise<Entitlements> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return { plan: 'free' };
  const payload = await verifyLicenseKey(stored);
  return payload ? { plan: 'pro', email: payload.email } : { plan: 'free' };
}

/** Returns true and stores the key if valid; false otherwise. */
export async function activateLicense(key: string): Promise<boolean> {
  const payload = await verifyLicenseKey(key);
  if (!payload) return false;
  localStorage.setItem(STORAGE_KEY, key.trim());
  return true;
}

export function clearLicense(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Feature gate. Free features never call this. Pro features call gate() and,
 * when not allowed, render the standard upsell affordance instead of the feature.
 * Keeping the check at the feature boundary (not scattered inside logic) is the
 * whole architecture — adding a paid feature later = wrap it in gate().
 */
export async function gate(_featureId: string): Promise<{ allowed: boolean; plan: string }> {
  const ent = await getEntitlements();
  return { allowed: ent.plan === 'pro', plan: ent.plan };
}
