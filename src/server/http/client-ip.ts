import { isIP } from "node:net";

export type ClientIpConfig = {
  /** Only behind a reverse proxy that sets the header; otherwise any header is client-controlled. */
  readonly trustProxy: boolean;
  readonly header: string;
  /** Proxy addresses or IPv4 CIDR ranges to skip when walking X-Forwarded-For from the right. */
  readonly trustedProxies: readonly string[];
};

function ipv4ToNumber(ip: string): number {
  return ip.split(".").reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;
}

function matches(ip: string, rule: string): boolean {
  if (!rule.includes("/")) return ip === rule;
  const [base, bits] = rule.split("/");
  if (isIP(ip) !== 4 || isIP(base!) !== 4) return false;
  const prefix = Number(bits);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipv4ToNumber(ip) & mask) === (ipv4ToNumber(base!) & mask);
}

/** The client's IP as reported by our proxy, or null when it cannot be trusted or found. */
export function clientIp(headers: Headers, config: ClientIpConfig): string | null {
  if (!config.trustProxy) return null;
  const raw = headers.get(config.header);
  if (!raw) return null;

  const chain = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const candidate = [...chain]
    .reverse()
    .find((ip) => !config.trustedProxies.some((rule) => matches(ip, rule)));
  return candidate && isIP(candidate) ? candidate : null;
}
