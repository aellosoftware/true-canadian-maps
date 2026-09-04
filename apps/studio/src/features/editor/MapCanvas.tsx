"use client";
import { writeMarkers } from "./marker-writes";

import { Map as MlMap, Marker as MlMarker, NavigationControl, Popup, ScaleControl, addProtocol, setWorkerUrl, type ErrorEvent, type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { useEffect, useMemo, useRef, useState } from "react";
import { MARKER_LAYERS, MARKER_SPRITE_ID, compileStyle, markersToGeoJSON, type MarkerRecord } from "@tcm/style-compiler";
import { useApi } from "@/components/ConfigProvider";
import { buildImageRegistry, rasterizeMarker } from "@/features/markers/markerImages";
import { useEditor, useEditorStore } from "./EditorContext";

let protocolRegistered = false;
function ensurePmtiles() {
  if (protocolRegistered) return;
  // Bundlers rewrite import.meta.url, so MapLibre cannot find its worker on its own.
  setWorkerUrl(new URL("/vendor/maplibre/maplibre-gl-worker.mjs", window.location.origin).href);
  addProtocol("pmtiles", new Protocol().tile);
  protocolRegistered = true;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function popupHtml(m: MarkerRecord): string {
  const parts = [`<strong class="tcm-popup-title">${escapeHtml(m.title)}</strong>`];
  if (m.imageUrl && /^https?:\/\//.test(m.imageUrl)) parts.push(`<img class="tcm-popup-image" src="${escapeHtml(m.imageUrl)}" alt="">`);
  if (m.description) parts.push(`<p class="tcm-popup-desc">${escapeHtml(m.description).replace(/\n/g, "<br>")}</p>`);
  if (m.link && /^https?:\/\//.test(m.link.url)) parts.push(`<a class="tcm-popup-link" href="${escapeHtml(m.link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(m.link.label)}</a>`);
  return `<div class="tcm-popup">${parts.join("")}</div>`;
}

export function MapCanvas() {
  const api = useApi();
  const { project, targets, store } = useEditor();
  const config = useEditorStore((s) => s.config);
  const layerOverrides = useEditorStore((s) => s.layerOverrides);
  const markers = useEditorStore((s) => s.markers);
  const selectedMarkerId = useEditorStore((s) => s.selectedMarkerId);
  const addMode = useEditorStore((s) => s.addMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const handleRef = useRef<MlMarker | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const registryRef = useRef(buildImageRegistry([], { icon: config.markers.defaultIcon, color: config.markers.defaultColor }));
  const [status, setStatus] = useState<{ zoom: number; lng: number; lat: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const registry = useMemo(
    () => buildImageRegistry(markers, { icon: config.markers.defaultIcon, color: config.markers.defaultColor }),
    [markers, config.markers.defaultIcon, config.markers.defaultColor],
  );

  useEffect(() => { registryRef.current = registry; }, [registry]);

  // create the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensurePmtiles();
    const s = store.getState();
    const style = compileStyle(s.config, { ...targets, layerOverrides: s.layerOverrides, markers: markersToGeoJSON(s.markers) });
    const map = new MlMap({
      container: containerRef.current,
      style,
      center: project.camera.center,
      zoom: project.camera.zoom,
      minZoom: project.camera.minZoom,
      maxZoom: project.camera.maxZoom,
      attributionControl: { compact: false },
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    const pending = new Map<string, Promise<void>>();
    map.setMissingStyleImageResolver((id) => {
      if (map.hasImage(id)) return;
      const existing = pending.get(id);
      if (existing) return existing;
      const key = id.startsWith(`${MARKER_SPRITE_ID}:`) ? id.slice(MARKER_SPRITE_ID.length + 1) : id;
      const spec = registryRef.current.get(key) ?? { icon: "pin", color: `#${/__([0-9a-f]{3,8})$/i.exec(key)?.[1] ?? "e23b3b"}` };
      const resolution = rasterizeMarker(spec, 2)
        .then((img) => { if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 }); })
        .catch(() => {})
        .finally(() => pending.delete(id));
      pending.set(id, resolution);
      return resolution;
    });

    const update = () => { const c = map.getCenter(); setStatus({ zoom: map.getZoom(), lng: c.lng, lat: c.lat }); };
    map.on("move", update);
    map.on("load", update);
    map.on("error", (e: ErrorEvent) => {
      const msg = e.error?.message ?? "map error";
      if (/tile|pmtiles|fetch|glyph|sprite|source/i.test(msg)) setError(msg);
    });

    // marker interactions
    map.on("click", MARKER_LAYERS.markers, (e: MapMouseEvent & { features?: Array<{ properties: Record<string, unknown> }> }) => {
      const id = e.features?.[0]?.properties.id;
      if (typeof id === "string") { store.getState().selectMarker(id); (e as unknown as { originalEvent: { stopPropagation(): void } }).originalEvent.stopPropagation(); }
    });
    map.on("mouseenter", MARKER_LAYERS.markers, () => { if (!store.getState().addMode) map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", MARKER_LAYERS.markers, () => { if (!store.getState().addMode) map.getCanvas().style.cursor = ""; });
    map.on("click", async (e: MapMouseEvent & { defaultPrevented?: boolean }) => {
      const st = store.getState();
      if (!st.addMode) {
        const hits = map.queryRenderedFeatures(e.point, { layers: map.getLayer(MARKER_LAYERS.markers) ? [MARKER_LAYERS.markers] : [] });
        if (hits.length === 0) st.selectMarker(null);
        return;
      }
      try {
        store.getState().setAddMode(false);
        await writeMarkers(store, "Adding location", async () => {
        const { data } = await api<{ marker: MarkerRecord }>(`/orgs/${project.orgId}/projects/${project.id}/markers`, {
          method: "POST",
          json: { title: `Location ${st.markers.length + 1}`, lng: e.lngLat.lng, lat: e.lngLat.lat, icon: st.config.markers.defaultIcon, color: st.config.markers.defaultColor },
        });
        store.getState().upsertMarker(data.marker);
        store.getState().selectMarker(data.marker.id);
        store.getState().setAddMode(false);
        }, { retrySafe: false });
      } catch (err) {
        setError(err instanceof Error ? err.message : "could not add marker");
      }
    });

    mapRef.current = map;
    (window as unknown as { __TCM_EDITOR__?: { map: MlMap; store: typeof store } }).__TCM_EDITOR__ = { map, store };
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live recompile on config / markers change (debounced)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = window.setTimeout(() => {
      try {
        map.setStyle(compileStyle(config, { ...targets, layerOverrides, markers: markersToGeoJSON(markers) }), { diff: true });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }, 50);
    return () => window.clearTimeout(t);
  }, [config, layerOverrides, markers, targets]);

  // add-mode cursor
  useEffect(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = addMode ? "crosshair" : "";
  }, [addMode]);

  // selected marker: draggable handle + popup preview
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    handleRef.current?.remove(); handleRef.current = null;
    popupRef.current?.remove(); popupRef.current = null;
    const m = markers.find((x) => x.id === selectedMarkerId);
    if (!m) return;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "tcm-drag-handle";
    el.setAttribute("aria-label", `Drag to move ${m.title}. Use arrow keys to nudge.`);
    el.style.cssText = "width:34px;height:34px;border-radius:50%;border:2px dashed #E23B3B;background:rgba(226,59,59,0.12);cursor:grab;";
    const handle = new MlMarker({ element: el, draggable: true, anchor: "center" }).setLngLat([m.lng, m.lat]).addTo(map);
    const save = async (lng: number, lat: number) => {
      store.getState().setMarkerDraft(m.id, { lng, lat });
      try {
        await writeMarkers(store, "Moving location", async () => {
          const { data } = await api<{ marker: MarkerRecord }>(`/orgs/${project.orgId}/projects/${project.id}/markers/${m.id}`, { method: "PATCH", json: { lng, lat } });
          store.getState().upsertMarker(data.marker);
          store.getState().clearMarkerDraft(m.id, { lng, lat });
        }, { key: `${m.id}:lat,lng` });
      } catch { setError("Location move failed. Your change is retained; use Retry location updates above."); }
    };
    handle.on("dragend", () => { const p = handle.getLngLat(); void save(p.lng, p.lat); });
    el.addEventListener("keydown", (ev) => {
      const step = ev.shiftKey ? 10 : 1;
      const d: Record<string, [number, number]> = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] };
      const v = d[ev.key];
      if (!v) return;
      ev.preventDefault();
      const px = map.project(handle.getLngLat());
      const next = map.unproject([px.x + v[0], px.y + v[1]]);
      handle.setLngLat(next);
      void save(next.lng, next.lat);
    });
    handleRef.current = handle;
    popupRef.current = new Popup({ closeButton: false, closeOnClick: false, offset: 36, className: "tcm-popup-wrap", maxWidth: "280px" })
      .setLngLat([m.lng, m.lat])
      .setHTML(popupHtml(m))
      .addTo(map);
    return () => { handle.remove(); popupRef.current?.remove(); };
  }, [selectedMarkerId, markers, api, project, store]);

  return (
    <div className="absolute inset-0">
      {/* inline geometry: maplibre-gl.css (unlayered) sets .maplibregl-map { position: relative } which would beat Tailwind's layered utilities */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} role="region" aria-label="Map preview" />
      {addMode ? <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white shadow" role="status">Click the map to place a marker · Esc to cancel</div> : null}
      {error ? <div role="alert" className="absolute left-3 top-3 max-w-sm rounded-md border border-red bg-pale-red px-3 py-2 text-xs text-red-dark shadow">{error}</div> : null}
      <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-white/85 px-2 py-1 font-mono text-[11px] text-muted shadow-sm">
        {status ? `z ${status.zoom.toFixed(2)} · ${status.lat.toFixed(4)}, ${status.lng.toFixed(4)}` : "loading…"}
      </div>
    </div>
  );
}
