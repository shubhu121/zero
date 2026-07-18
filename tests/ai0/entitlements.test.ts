import { describe, it, expect } from 'vitest';
import { verifyLicenseKey } from '../../src/hubs/ai0/lib/entitlements';

// The verifier takes an optional public JWK so we can test against a throwaway
// keypair (the shipped PUBLIC_JWK is a placeholder until a real pro launch).
const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');

async function freshKeypair() {
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
  return { priv: kp.privateKey, jwk };
}

/** Mint a real `0LK1.<payload>.<sig>` key signed with `priv` (sig is over the payload bytes). */
async function mint(payload: object, priv: CryptoKey): Promise<string> {
  const payloadBytes = enc.encode(JSON.stringify(payload));
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, payloadBytes),
  );
  return `0LK1.${b64url(payloadBytes)}.${b64url(sig)}`;
}

const base = () => ({
  v: 1, email: 'pro@ai0.test', plan: 'pro',
  hubs: ['ai0'], iat: Math.floor(Date.now() / 1000), exp: null as number | null,
});

describe('verifyLicenseKey — offline ECDSA P-256 (HUB=ai0)', () => {
  it('accepts a valid, correctly-signed key scoped to this hub', async () => {
    const { priv, jwk } = await freshKeypair();
    const payload = await verifyLicenseKey(await mint(base(), priv), jwk);
    expect(payload?.email).toBe('pro@ai0.test');
    expect(payload?.plan).toBe('pro');
  });

  it('rejects a tampered payload (original signature no longer matches)', async () => {
    const { priv, jwk } = await freshKeypair();
    const [tag, , sig] = (await mint(base(), priv)).split('.');
    const forged = b64url(enc.encode(JSON.stringify({ ...base(), email: 'evil@x.com' })));
    expect(await verifyLicenseKey(`${tag}.${forged}.${sig}`, jwk)).toBeNull();
  });

  it('rejects an expired key', async () => {
    const { priv, jwk } = await freshKeypair();
    const key = await mint({ ...base(), exp: Math.floor(Date.now() / 1000) - 60 }, priv);
    expect(await verifyLicenseKey(key, jwk)).toBeNull();
  });

  it('rejects a key scoped to a different hub', async () => {
    const { priv, jwk } = await freshKeypair();
    const key = await mint({ ...base(), hubs: ['dev0'] }, priv);
    expect(await verifyLicenseKey(key, jwk)).toBeNull();
  });

  it('rejects garbage / malformed keys', async () => {
    const { jwk } = await freshKeypair();
    expect(await verifyLicenseKey('not-a-key', jwk)).toBeNull();
    expect(await verifyLicenseKey('0LK1.foo.bar', jwk)).toBeNull();
  });
});
