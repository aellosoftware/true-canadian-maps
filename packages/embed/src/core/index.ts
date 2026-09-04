/**
 * Embed core: bundled with maplibre-gl + pmtiles. Loaded by the v1 loader (script tag) or the SDK.
 * Served at {maps}/embed/v1/{version}/tcm.js — the worker lives next to it.
 */
import { mount } from "./mount";
import type { CreateMapOptions, TcmMap } from "./types";
export type * from "./types";

declare const __TCM_VERSION__: string;
export const version = typeof __TCM_VERSION__ === "string" ? __TCM_VERSION__ : "dev";

function baseUrl(): string {
  return new URL(".", import.meta.url).href; // …/embed/v1/{version}/
}

/** {maps}/embed/v1/config.json advertises the API URL for this installation. */
async function advertisedApiUrl(): Promise<string | null> {
  try {
    const res = await fetch(new URL("../config.json", baseUrl()).href, { cache: "force-cache" });
    if (!res.ok) return null;
    const j = (await res.json()) as { apiUrl?: string };
    return j.apiUrl ?? null;
  } catch {
    return null;
  }
}

export async function createMap(opts: CreateMapOptions): Promise<TcmMap> {
  const apiUrl = opts.apiUrl ?? (await advertisedApiUrl());
  return mount({ ...opts, apiUrl: apiUrl ?? undefined }, { apiUrl, workerUrl: new URL("maplibre-gl-worker.mjs", baseUrl()).href });
}

/** Auto-mount every `[data-tcm-map]` element. Used by the loader; safe to call repeatedly. */
export async function mountAll(root: ParentNode = document): Promise<TcmMap[]> {
  const els = [...root.querySelectorAll<HTMLElement>("[data-tcm-map]:not([data-tcm-mounted])")];
  return Promise.all(
    els.map(async (el) => {
      el.setAttribute("data-tcm-mounted", "");
      const d = el.dataset;
      try {
        return await createMap({
          container: el,
          projectId: d.project ?? "",
          publicKey: d.key ?? "",
          apiUrl: d.api,
          environment: d.environment,
          locale: d.locale,
          list: (d.list as CreateMapOptions["list"]) ?? "auto",
          fitToMarkers: d.fit === "true",
          cooperativeGestures: d.cooperativeGestures === "true",
        });
      } catch (err) {
        el.dispatchEvent(new CustomEvent("tcm:error", { detail: { error: err } }));
        const msg = document.createElement("p");
        msg.className = "tcm-error";
        msg.textContent = err instanceof Error ? err.message : "The map could not be loaded.";
        el.appendChild(msg);
        throw err;
      }
    }),
  );
}
