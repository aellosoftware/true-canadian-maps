import { z } from "zod";
import { errorResponse, handle, json, parseQuery } from "@/lib/api";
import { getEmbedRequestOrigin } from "@/lib/embed-request-origin";
import { resolveEmbedConfig } from "@/lib/services/embed-config";
import { ApiError } from "@tcm/shared";

export const dynamic = "force-dynamic";

const Query = z.object({ project: z.string().min(1), env: z.string().default("production"), key: z.string().min(1) });

const CORS_HEADERS = { "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" };

export function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS, ...(origin ? { "access-control-allow-origin": origin } : {}) } });
}

/** GET /v1/embed/config?project=prj_…&env=production&key=pk_live_… */
export const GET = handle(async (req, { correlationId }) => {
  const q = parseQuery(req, Query);
  const { origin, corsOrigin } = getEmbedRequestOrigin(req);
  try {
    const { config } = await resolveEmbedConfig({ projectId: q.project, environment: q.env, key: q.key, origin });
    return json(config, { headers: { ...CORS_HEADERS, ...(corsOrigin ? { "access-control-allow-origin": corsOrigin } : {}), "cache-control": "private, max-age=60" } });
  } catch (err) {
    if (err instanceof ApiError) {
      const res = errorResponse(err.code, err.message, err.status, correlationId);
      for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
      if (corsOrigin) res.headers.set("access-control-allow-origin", corsOrigin);
      return res;
    }
    throw err;
  }
});
