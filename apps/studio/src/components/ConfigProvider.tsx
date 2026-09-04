"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { PublicConfig } from "@/lib/public-config";

const Ctx = createContext<PublicConfig | null>(null);

export function ConfigProvider({ config, children }: { config: PublicConfig; children: ReactNode }) {
  return <Ctx.Provider value={config}>{children}</Ctx.Provider>;
}

export function usePublicConfig(): PublicConfig {
  const c = useContext(Ctx);
  if (!c) throw new Error("ConfigProvider missing");
  return c;
}

export class ApiRequestError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details?: unknown) {
    super(message);
  }
}

/** Browser API client: credentials included, JSON in/out, structured errors. */
export function useApi() {
  const { apiBase } = usePublicConfig();
  return useCallback(async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<{ data: T; etag: string | null }> {
    const headers = new Headers(init.headers);
    let body = init.body;
    if (init.json !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(init.json);
    }
    const res = await fetch(`${apiBase}${path.startsWith("/v1") ? path : `/v1${path}`}`, { ...init, headers, body, credentials: "include" });
    const etag = res.headers.get("etag");
    if (res.status === 204) return { data: undefined as T, etag };
    const payload = (await res.json().catch(() => null)) as (T & { error?: { code: string; message: string; details?: unknown } }) | null;
    if (!res.ok) {
      const err = payload?.error;
      throw new ApiRequestError(res.status, err?.code ?? "error", err?.message ?? `request failed (${res.status})`, err?.details);
    }
    return { data: payload as T, etag };
  }, [apiBase]);
}
