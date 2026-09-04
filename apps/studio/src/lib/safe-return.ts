/** Accept internal application paths only, including after URL decoding. */
export function safeReturnPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length > 2048) return fallback;
  let decoded = value;
  try {
    for (let i = 0; i < 3; i++) {
      if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded)) return fallback;
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    const url = new URL(value, "https://internal.invalid");
    if (url.origin !== "https://internal.invalid" || url.pathname.startsWith("/api/") || /^\/(login|signup|forgot-password|reset-password)(\/|$)/.test(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}
