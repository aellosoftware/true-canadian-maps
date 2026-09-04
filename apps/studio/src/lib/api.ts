import { randomUUID } from "node:crypto";
import { ZodError, type ZodType } from "zod";
import { ApiError, type ErrorBody } from "@tcm/shared";

type Params = Record<string, string>;
export type RouteContext = { params: Promise<Params> };
export type Handler = (req: Request, ctx: { params: Params; correlationId: string }) => Promise<Response> | Response;

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(code: ErrorBody["error"]["code"], message: string, status: number, correlationId: string, details?: unknown): Response {
  const body: ErrorBody = { error: { code, message, correlationId, ...(details !== undefined ? { details } : {}) } };
  return json(body, { status, headers: { "x-correlation-id": correlationId } });
}

/** Wraps a route handler with error mapping and a correlation id. */
export function handle(fn: Handler) {
  return async (req: Request, ctx?: RouteContext): Promise<Response> => {
    const correlationId = req.headers.get("x-request-id") ?? randomUUID();
    try {
      const params = ctx ? await ctx.params : {};
      const res = await fn(req, { params, correlationId });
      res.headers.set("x-correlation-id", correlationId);
      return res;
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err.code, err.message, err.status, correlationId, err.details);
      if (err instanceof ZodError) {
        return errorResponse("validation_failed", "request validation failed", 422, correlationId, err.issues);
      }
      console.error(`[api ${correlationId}]`, err);
      return errorResponse("internal", "internal error", 500, correlationId);
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError("bad_request", "request body must be JSON");
  }
  return schema.parse(raw);
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const url = new URL(req.url);
  return schema.parse(Object.fromEntries(url.searchParams.entries()));
}

export function clientInfo(req: Request): { ip: string | null; userAgent: string | null } {
  const fwd = req.headers.get("x-forwarded-for");
  return { ip: fwd ? fwd.split(",")[0]!.trim() : null, userAgent: req.headers.get("user-agent") };
}
