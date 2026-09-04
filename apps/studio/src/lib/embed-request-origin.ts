export interface EmbedRequestOrigin {
  /** Origin used to validate the public browser key. */
  origin: string;
  /** Origin to echo in CORS headers. Null for a same-origin request. */
  corsOrigin: string | null;
}

/**
 * Cross-origin browser fetches include Origin. Browsers omit it for same-origin
 * GETs, so in that case the request URL is the embedding page's origin.
 */
export function getEmbedRequestOrigin(req: Request): EmbedRequestOrigin {
  const corsOrigin = req.headers.get("origin");
  return {
    origin: corsOrigin ?? new URL(req.url).origin,
    corsOrigin,
  };
}
