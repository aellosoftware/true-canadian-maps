import { NextResponse, type NextRequest } from "next/server";

/**
 * Host-based routing.
 *
 * Multi-host mode (default SaaS):  api.example.com/v1/*  -> /api/v1/*
 * Single-host mode (self-host):     example.com/api/v1/*  -> /api/v1/*  (no rewrite needed)
 *
 * PUBLIC_API_URL / PUBLIC_STUDIO_URL decide the mode. Static assets never reach this file.
 */
const apiUrl = process.env.PUBLIC_API_URL ? new URL(process.env.PUBLIC_API_URL) : null;
const studioUrl = process.env.PUBLIC_STUDIO_URL ? new URL(process.env.PUBLIC_STUDIO_URL) : null;
const multiHost = !!apiUrl && !!studioUrl && apiUrl.host !== studioUrl.host;

const studioOrigin = studioUrl?.origin ?? null;

function withCors(res: Response, request: NextRequest): Response {
  const origin = request.headers.get("origin");
  if (origin && studioOrigin && origin === studioOrigin) {
    res.headers.set("access-control-allow-origin", origin);
    res.headers.set("access-control-allow-credentials", "true");
    res.headers.set("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.headers.set("access-control-allow-headers", "content-type, if-match, x-request-id");
    res.headers.set("access-control-expose-headers", "etag, x-correlation-id");
    res.headers.append("vary", "origin");
  }
  return res;
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  // Studio -> API calls cross origins in multi-host mode (studio. vs api.).
  const isApi = pathname.startsWith("/api/v1/") || pathname.startsWith("/v1/");
  if (isApi && request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }), request);
  }

  if (multiHost && apiUrl && host === apiUrl.host) {
    if (pathname === "/healthz" || pathname === "/readyz") {
      return NextResponse.rewrite(new URL(`/api${pathname}`, request.url));
    }
    if (pathname.startsWith("/v1/")) {
      return withCors(NextResponse.rewrite(new URL(`/api${pathname}${request.nextUrl.search}`, request.url)), request);
    }
    if (pathname.startsWith("/api/")) {
      return withCors(NextResponse.next(), request);
    }
    return Response.json(
      { error: { code: "not_found", message: "Not found", correlationId: request.headers.get("x-request-id") ?? "" } },
      { status: 404 },
    );
  }

  // Root-level health endpoints on the studio host too (single-host or multi-host)
  if (pathname === "/healthz" || pathname === "/readyz") {
    return NextResponse.rewrite(new URL(`/api${pathname}`, request.url));
  }

  return isApi ? withCors(NextResponse.next(), request) : NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/).*)"],
};
