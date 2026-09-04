/**
 * Allowed-origin matching for browser public keys.
 *
 * Rules (each entry in `allowedOrigins`):
 *   https://example.com          exact scheme + host (+ optional port)
 *   https://*.example.com        any single-or-multi-level subdomain of example.com (not the apex)
 *   http://localhost:*           localhost on any port (development)
 *   http://127.0.0.1:*           loopback on any port
 * Scheme must match exactly. A missing Origin header never matches.
 */
export function normalizeOrigin(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.pathname !== "/" || u.search || u.hash || u.username || u.password) return null;
    if (!u.hostname || u.hostname.includes("*")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function isValidOriginRule(rule: string): boolean {
  const r = rule.trim();
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):\*$/.test(r)) return true;
  if (/^https?:\/\/\*\.[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(r)) return true;
  return normalizeOrigin(r) !== null;
}

export function originMatches(origin: string | null | undefined, allowedOrigins: readonly string[]): boolean {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  const url = new URL(normalized);

  for (const raw of allowedOrigins) {
    const rule = raw.trim();
    if (!rule) continue;

    // localhost / loopback wildcard port
    const loop = /^(https?):\/\/(localhost|127\.0\.0\.1|\[::1\]):\*$/.exec(rule);
    if (loop) {
      if (`${url.protocol.slice(0, -1)}` === loop[1] && url.hostname === loop[2]!.replace(/^\[|\]$/g, "")) return true;
      continue;
    }

    // subdomain wildcard
    const wild = /^(https?):\/\/\*\.(.+)$/.exec(rule);
    if (wild) {
      const scheme = wild[1]!;
      const base = wild[2]!.toLowerCase();
      if (url.protocol.slice(0, -1) !== scheme) continue;
      if (url.port) continue; // wildcard rules do not carry ports
      const host = url.hostname.toLowerCase();
      if (host !== base && host.endsWith(`.${base}`)) return true;
      continue;
    }

    const exact = normalizeOrigin(rule);
    if (exact && exact === normalized) return true;
  }
  return false;
}
