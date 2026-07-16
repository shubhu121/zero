export interface CidrInfo {
  network: string; broadcast: string; firstHost: string; lastHost: string;
  mask: string; wildcard: string; totalAddresses: number; usableHosts: number; prefix: number;
}

const toNum = (ip: string): number | null => {
  const p = ip.split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const oct of p) {
    if (!/^\d{1,3}$/.test(oct)) return null;
    const v = Number(oct);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
};
const toIp = (n: number): string =>
  [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

export function parseCidr(input: string): CidrInfo | null {
  const m = input.trim().match(/^([\d.]+)\/(\d{1,2})$/);
  if (!m) return null;
  const ip = toNum(m[1]!);
  const prefix = Number(m[2]!);
  if (ip === null || prefix > 32) return null;
  const maskNum = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const network = (ip & maskNum) >>> 0;
  const broadcast = (network | (~maskNum >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  const usable = prefix >= 31 ? total : Math.max(total - 2, 0);
  return {
    network: toIp(network), broadcast: toIp(broadcast),
    firstHost: toIp(prefix >= 31 ? network : network + 1),
    lastHost: toIp(prefix >= 31 ? broadcast : broadcast - 1),
    mask: toIp(maskNum), wildcard: toIp(~maskNum >>> 0),
    totalAddresses: total, usableHosts: usable, prefix,
  };
}

/** True if `ip` falls inside `cidr`; null if either input is invalid. */
export function cidrContains(cidr: string, ip: string): boolean | null {
  const info = parseCidr(cidr);
  const n = toNum(ip.trim());
  if (!info || n === null) return null;
  const maskNum = info.prefix === 0 ? 0 : (~0 << (32 - info.prefix)) >>> 0;
  const network = toNum(info.network)!;
  return ((n & maskNum) >>> 0) === network;
}
