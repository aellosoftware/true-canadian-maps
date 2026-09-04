import { Map as MlMap, NavigationControl, Popup, addProtocol, setWorkerUrl, type LngLatLike, type MapGeoJSONFeature, type StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { maplibreLocale, strings } from "./i18n";
import { renderList } from "./list";
import { renderPopup } from "./popup";
import type { CreateMapOptions, EmbedConfigResponse, LocationRecord, TcmEvents, TcmMap } from "./types";

const MARKER_LAYER = "tcm-markers";
const MARKER_SOURCE = "tcm-markers";

let protocolReady = false;
export function prepareRuntime(workerUrl: string | null): void {
  if (protocolReady) return;
  if (workerUrl) setWorkerUrl(workerUrl);
  addProtocol("pmtiles", new Protocol().tile);
  protocolReady = true;
}

class Emitter {
  private handlers = new Map<string, Set<(p: unknown) => void>>();
  on<E extends keyof TcmEvents>(e: E, cb: (p: TcmEvents[E]) => void): () => void {
    if (!this.handlers.has(e)) this.handlers.set(e, new Set());
    this.handlers.get(e)!.add(cb as (p: unknown) => void);
    return () => this.off(e, cb);
  }
  off<E extends keyof TcmEvents>(e: E, cb: (p: TcmEvents[E]) => void): void {
    this.handlers.get(e)?.delete(cb as (p: unknown) => void);
  }
  emit<E extends keyof TcmEvents>(e: E, p: TcmEvents[E]): void {
    this.handlers.get(e)?.forEach((cb) => cb(p));
  }
}

interface MarkerFeature { type: "Feature"; id: string; geometry: { type: "Point"; coordinates: [number, number] }; properties: Record<string, unknown> }

function toLocation(f: MarkerFeature): LocationRecord {
  const p = f.properties;
  const { id, title, description, link, imageUrl, category, icon: _i, color: _c, imageKey: _k, externalId: _e, ...rest } = p as Record<string, unknown>;
  return {
    id: String(id ?? f.id),
    title: String(title ?? ""),
    description: (description as string | null) ?? null,
    link: (link as LocationRecord["link"]) ?? null,
    imageUrl: (imageUrl as string | null) ?? null,
    category: (category as string | null) ?? null,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    properties: rest,
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const b = (await res.json()) as { error?: { message?: string } }; if (b.error?.message) msg = b.error.message; } catch { /* ignore */ }
    throw new Error(`True Canadian Maps: ${msg} (${url})`);
  }
  return (await res.json()) as T;
}

export async function mount(opts: CreateMapOptions, defaults: { apiUrl: string | null; workerUrl: string | null }): Promise<TcmMap> {
  const container = typeof opts.container === "string" ? document.getElementById(opts.container) ?? document.querySelector<HTMLElement>(opts.container) : opts.container;
  if (!container) throw new Error("True Canadian Maps: container not found");
  const apiUrl = (opts.apiUrl ?? defaults.apiUrl ?? "").replace(/\/$/, "");
  if (!apiUrl) throw new Error("True Canadian Maps: apiUrl is required");
  const env = opts.environment ?? "production";
  const t = strings(opts.locale);

  prepareRuntime(defaults.workerUrl);
  const cfg = await fetchJson<EmbedConfigResponse>(`${apiUrl}/v1/embed/config?project=${encodeURIComponent(opts.projectId)}&env=${encodeURIComponent(env)}&key=${encodeURIComponent(opts.publicKey)}`);
  const [style, markers] = await Promise.all([fetchJson<StyleSpecification>(cfg.styleUrl), fetchJson<{ features: MarkerFeature[] }>(cfg.markersUrl)]);
  const src = style.sources[MARKER_SOURCE] as { data?: unknown } | undefined;
  if (src) src.data = markers; // one fetch feeds both the map and the list
  const locations = markers.features.map(toLocation);
  const byId = new Map(locations.map((l) => [l.id, l]));

  // layout: wrapper > (skip link, map, list)
  container.classList.add("tcm-embed");
  container.innerHTML = "";
  const mapEl = document.createElement("div");
  mapEl.className = "tcm-map";
  mapEl.setAttribute("role", "region");
  mapEl.setAttribute("aria-label", t.mapLabel);
  if (!container.style.height && getComputedStyle(container).height === "0px") container.classList.add("tcm-embed-autoheight");
  container.appendChild(mapEl);

  const emitter = new Emitter();
  const map = new MlMap({
    container: mapEl,
    style,
    center: cfg.camera.center,
    zoom: cfg.camera.zoom,
    minZoom: cfg.camera.minZoom,
    maxZoom: cfg.camera.maxZoom,
    bearing: cfg.camera.bearing ?? 0,
    pitch: cfg.camera.pitch ?? 0,
    maxBounds: cfg.camera.maxBounds,
    interactive: opts.interactive ?? true,
    cooperativeGestures: opts.cooperativeGestures ?? false,
    attributionControl: { compact: mapEl.clientWidth < 640, customAttribution: cfg.attribution },
    locale: maplibreLocale(opts.locale),
    validateStyle: false,
  });
  map.addControl(new NavigationControl({ showCompass: false }), "top-right");

  let popup: Popup | null = null;
  let list: ReturnType<typeof renderList> | null = null;
  const reduceMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function select(id: string, source: TcmEvents["location:selected"]["source"], o: { openPopup?: boolean; fly?: boolean } = {}) {
    const loc = byId.get(id);
    if (!loc) return;
    const target: LngLatLike = [loc.lng, loc.lat];
    if (o.fly !== false) {
      const z = Math.max(map.getZoom(), 12);
      if (reduceMotion) map.jumpTo({ center: target, zoom: z }); else map.flyTo({ center: target, zoom: z, speed: 1.2 });
    }
    if (o.openPopup !== false) {
      popup?.remove();
      popup = new Popup({ offset: 30, maxWidth: "300px", className: "tcm-popup-wrap", focusAfterOpen: source !== "map" }).setLngLat(target).setDOMContent(renderPopup(loc)).addTo(map);
    }
    list?.announce(t.showing(loc.title));
    emitter.emit("location:selected", { locationId: id, source });
  }

  map.on("click", MARKER_LAYER, (e) => {
    const f = (e.features as MapGeoJSONFeature[] | undefined)?.[0];
    const id = f?.properties?.id as string | undefined;
    if (id) select(id, "map", { fly: false });
  });
  map.on("mouseenter", MARKER_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", MARKER_LAYER, () => { map.getCanvas().style.cursor = ""; emitter.emit("location:hover", { locationId: null }); });
  map.on("mousemove", MARKER_LAYER, (e) => {
    const id = (e.features as MapGeoJSONFeature[] | undefined)?.[0]?.properties?.id as string | undefined;
    if (id) emitter.emit("location:hover", { locationId: id });
  });
  map.on("moveend", () => { const c = map.getCenter(); emitter.emit("viewport:change", { center: [c.lng, c.lat], zoom: map.getZoom() }); });
  map.on("error", (e) => { const err = e.error instanceof Error ? e.error : new Error(String(e.error)); opts.onError?.(err); emitter.emit("error", { error: err }); });

  // location list
  const listOpt = opts.list ?? "auto";
  let listTarget: HTMLElement | null = null;
  if (listOpt === "auto" || listOpt === "below") {
    if (listOpt === "below" || locations.length > 0) { listTarget = document.createElement("div"); listTarget.className = "tcm-list-wrap"; container.appendChild(listTarget); }
  } else if (listOpt !== "none") {
    listTarget = typeof listOpt === "string" ? document.querySelector<HTMLElement>(listOpt) : listOpt;
  }
  if (listTarget) {
    const skip = document.createElement("a");
    skip.className = "tcm-skip";
    skip.href = "#";
    skip.textContent = t.skipToList;
    skip.addEventListener("click", (ev) => { ev.preventDefault(); listTarget!.querySelector<HTMLElement>("button, a, h3")?.focus(); });
    container.insertBefore(skip, mapEl);
    list = renderList(listTarget, locations, opts.locale, (id) => select(id, "list"));
  }

  if (opts.fitToMarkers && locations.length > 1) {
    const lngs = locations.map((l) => l.lng), lats = locations.map((l) => l.lat);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 40, duration: 0 });
  }

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.resize()) : null;
  ro?.observe(mapEl);

  await new Promise<void>((resolve, reject) => {
    map.once("load", () => resolve());
    map.once("error", (e) => reject(e.error ?? new Error("map failed to load")));
  });
  emitter.emit("ready", { releaseId: cfg.releaseId });
  container.dispatchEvent(new CustomEvent("tcm:ready", { detail: { releaseId: cfg.releaseId } }));

  return {
    map,
    release: { id: cfg.releaseId, manifestUrl: cfg.manifestUrl, attribution: cfg.attribution },
    on: (e, cb) => emitter.on(e, cb),
    off: (e, cb) => emitter.off(e, cb),
    selectLocation: (id, o) => select(id, "api", o),
    setCategoryFilter(categories) {
      const ids = categories ? new Set(locations.filter((l) => l.category && categories.includes(l.category)).map((l) => l.id)) : null;
      map.setFilter(MARKER_LAYER, ids ? ["in", ["get", "id"], ["literal", [...ids]]] : cfg.config.cluster ? ["!", ["has", "point_count"]] : ["all"]);
      list?.update(ids);
    },
    getLocations: () => [...locations],
    resize: () => map.resize(),
    destroy() {
      ro?.disconnect();
      popup?.remove();
      map.remove();
      container.innerHTML = "";
      container.classList.remove("tcm-embed", "tcm-embed-autoheight");
    },
  };
}
