"use client";

import { Crosshair, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MarkerRecord } from "@tcm/style-compiler";
import { useApi } from "@/components/ConfigProvider";
import { useEditor, useEditorStore } from "@/features/editor/EditorContext";
import { IconPicker } from "./IconPicker";
import { ImportWizard } from "./ImportWizard";
import { markerPreviewDataUrl } from "./markerImages";
import { useLoadMarkers } from "./useLoadMarkers";
import { writeMarkers } from "@/features/editor/marker-writes";

function parseCoords(input: string): { lat: number; lng: number } | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(input);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lng: b };
  return null;
}

function Inspector({ marker }: { marker: MarkerRecord }) {
  const api = useApi();
  const { store, project } = useEditor();
  const drafts = useEditorStore((s) => s.markerDrafts);
  const draft = { ...marker, ...drafts[marker.id] };
  const coords = drafts[marker.id]?.coordinateText ?? `${marker.lat.toFixed(6)}, ${marker.lng.toFixed(6)}`;
  const [err, setErr] = useState<string | null>(null);
  function setDraft(next: MarkerRecord) {
    const patch: Partial<MarkerRecord> & { coordinateText?: string } = {};
    for (const key of ["title", "description", "link", "imageUrl", "category", "color", "visible", "icon", "lat", "lng"] as const) {
      if (JSON.stringify(next[key]) !== JSON.stringify(marker[key])) Object.assign(patch, { [key]: next[key] });
    }
    if (drafts[marker.id]?.coordinateText !== undefined) patch.coordinateText = drafts[marker.id]!.coordinateText;
    const markerDrafts = { ...store.getState().markerDrafts };
    if (Object.keys(patch).length) markerDrafts[marker.id] = patch; else delete markerDrafts[marker.id];
    store.setState({ markerDrafts });
  }
  const setCoords = (value: string) => store.getState().setMarkerDraft(marker.id, { coordinateText: value });
  async function patch(p: Partial<MarkerRecord>) {
    store.getState().setMarkerDraft(marker.id, p);
    const acknowledged = { ...p, ...(p.lat !== undefined ? { coordinateText: store.getState().markerDrafts[marker.id]?.coordinateText } : {}) };
    try {
      await writeMarkers(store, "Location update", async () => {
        const { data } = await api<{ marker: MarkerRecord }>(`/orgs/${project.orgId}/projects/${project.id}/markers/${marker.id}`, { method: "PATCH", json: p });
        store.getState().upsertMarker(data.marker);
        store.getState().clearMarkerDraft(marker.id, acknowledged);
        setErr(null);
      }, { key: `${marker.id}:${Object.keys(p).sort().join(",")}` });
    } catch { setErr("Location update failed. Your edits are retained; use Retry location updates above."); }
  }
  async function remove() {
    if (!confirm(`Delete "${marker.title}"?`)) return;
    try {
      await writeMarkers(store, "Location deletion", async () => {
        await api(`/orgs/${project.orgId}/projects/${project.id}/markers/${marker.id}`, { method: "DELETE" });
        store.getState().removeMarkers([marker.id]);
        const markerDrafts = { ...store.getState().markerDrafts }; delete markerDrafts[marker.id]; store.setState({ markerDrafts });
      }, { retrySafe: false });
    } catch { setErr("Deletion could not be confirmed. Reload server locations to check."); }
  }
  const field = "w-full rounded border border-line px-2 py-1 text-xs";
  return (
    <div className="space-y-2 border-t border-line p-3">
      <div className="flex items-center justify-between"><h3 className="text-xs font-bold text-navy">Marker</h3>
        <button type="button" onClick={remove} className="flex items-center gap-1 text-xs text-red hover:underline"><Trash2 size={12} /> Delete</button></div>
      {err ? <p role="alert" className="text-xs text-red">{err}</p> : null}
      <label className="block text-xs">Title<input className={field} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} onBlur={() => { if (!draft.title.trim()) setErr("A location title is required."); else if (draft.title !== marker.title) void patch({ title: draft.title.trim() }); }} /></label>
      <label className="block text-xs">Coordinates (lat, lng)<input className={`${field} font-mono`} value={coords} onChange={(e) => setCoords(e.target.value)} onBlur={() => { const c = parseCoords(coords); if (!c) setErr("Enter latitude from -90 to 90 and longitude from -180 to 180."); else if (c.lat !== marker.lat || c.lng !== marker.lng) void patch(c); else store.getState().clearMarkerDraft(marker.id, { coordinateText: coords }); }} /></label>
      <label className="block text-xs">Description<textarea className={field} rows={3} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} onBlur={() => (draft.description ?? "") !== (marker.description ?? "") && patch({ description: draft.description || null })} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">Link label<input className={field} value={draft.link?.label ?? ""} onChange={(e) => setDraft({ ...draft, link: { label: e.target.value, url: draft.link?.url ?? "" } })} onBlur={() => { const l = draft.link; if (l && l.label && /^https?:\/\//.test(l.url)) void patch({ link: l }); else if (!l?.label && !l?.url) void patch({ link: null }); else setErr("Enter both a link label and a URL starting with https:// or http://."); }} /></label>
        <label className="block text-xs">Link URL<input className={field} value={draft.link?.url ?? ""} onChange={(e) => setDraft({ ...draft, link: { label: draft.link?.label ?? "More", url: e.target.value } })} onBlur={() => { const l = draft.link; if (l && l.label && /^https?:\/\//.test(l.url)) void patch({ link: l }); else if (!l?.label && !l?.url) void patch({ link: null }); else setErr("Enter both a link label and a URL starting with https:// or http://."); }} placeholder="https://" /></label>
      </div>
      <label className="block text-xs">Image URL<input className={field} value={draft.imageUrl ?? ""} onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })} onBlur={() => (draft.imageUrl ?? "") !== (marker.imageUrl ?? "") && patch({ imageUrl: draft.imageUrl || null })} placeholder="https://" /></label>
      <label className="block text-xs">Category<input className={field} value={draft.category ?? ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} onBlur={() => (draft.category ?? "") !== (marker.category ?? "") && patch({ category: draft.category || null })} /></label>
      <div className="flex items-center gap-2 text-xs"><span>Colour</span>
        <input type="color" aria-label="Marker colour" value={/^#[0-9a-f]{6}$/i.test(draft.color) ? draft.color : "#e23b3b"} onChange={(e) => patch({ color: e.target.value })} />
        <span className="font-mono text-muted">{draft.color}</span>
        <label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={draft.visible} onChange={(e) => patch({ visible: e.target.checked })} /> Visible</label></div>
      <div className="text-xs"><span className="mb-1 block">Icon</span><IconPicker value={draft.icon} color={draft.color} onChange={(icon) => patch({ icon })} /></div>
    </div>
  );
}

export function MarkersPanel() {
  useLoadMarkers();
  const { store, canEdit } = useEditor();
  const markers = useEditorStore((s) => s.markers);
  const loaded = useEditorStore((s) => s.markersLoaded);
  const selectedId = useEditorStore((s) => s.selectedMarkerId);
  const addMode = useEditorStore((s) => s.addMode);
  const settings = useEditorStore((s) => s.config.markers);
  const [q, setQ] = useState("");
  const [importing, setImporting] = useState(false);
  const selected = markers.find((m) => m.id === selectedId) ?? null;
  const filtered = useMemo(() => { const t = q.trim().toLowerCase(); return t ? markers.filter((m) => m.title.toLowerCase().includes(t) || (m.category ?? "").toLowerCase().includes(t)) : markers; }, [markers, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") store.getState().setAddMode(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  const s = store.getState();
  return (
    <div className={canEdit ? "" : "pointer-events-none opacity-70"}>
      <div className="space-y-2 border-b border-line px-4 py-3">
        <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-navy">Markers <span className="text-xs font-normal text-muted">{loaded ? markers.length : "…"}</span></h2>
          <div className="flex gap-1">
            <button type="button" onClick={() => setImporting((v) => !v)} className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold text-navy hover:bg-ice"><Upload size={13} /> Import</button>
            <button type="button" aria-pressed={addMode} onClick={() => s.setAddMode(!addMode)} className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${addMode ? "bg-navy text-white" : "bg-red text-white hover:bg-red-dark"}`}><Crosshair size={13} /> {addMode ? "Cancel" : "Add marker"}</button>
          </div></div>
        {importing ? <ImportWizard onDone={() => setImporting(false)} /> : null}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search markers" aria-label="Search markers" className="w-full rounded-md border border-line px-2 py-1 text-xs" />
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-navy">Display settings</summary>
          <div className="mt-2 space-y-1.5">
            <label className="flex items-center justify-between">Cluster nearby markers<input type="checkbox" checked={settings.cluster} onChange={(e) => s.setMarkerSetting("cluster", e.target.checked)} /></label>
            <label className="flex items-center justify-between">Show titles on map<input type="checkbox" checked={settings.showTitles} onChange={(e) => s.setMarkerSetting("showTitles", e.target.checked)} /></label>
            <label className="flex items-center justify-between">Icon size<input type="range" min={0.5} max={2} step={0.1} value={settings.iconScale} onChange={(e) => s.setMarkerSetting("iconScale", Number(e.target.value))} aria-valuetext={`${settings.iconScale}x`} /></label>
            <label className="flex items-center justify-between">Default colour<input type="color" value={/^#[0-9a-f]{6}$/i.test(settings.defaultColor) ? settings.defaultColor : "#e23b3b"} onChange={(e) => s.setMarkerSetting("defaultColor", e.target.value)} /></label>
            <div><span className="mb-1 block">Default icon</span><IconPicker value={settings.defaultIcon} color={settings.defaultColor} onChange={(icon) => s.setMarkerSetting("defaultIcon", icon)} /></div>
          </div>
        </details>
      </div>
      {selected ? <Inspector key={selected.id} marker={selected} /> : null}
      <ul aria-label="Marker list" className="divide-y divide-line">
        {filtered.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => s.selectMarker(m.id)} aria-current={m.id === selectedId ? "true" : undefined}
              className={`flex w-full items-center gap-2 px-4 py-2 text-left text-xs hover:bg-ice ${m.id === selectedId ? "bg-pale-red" : ""} ${m.visible ? "" : "opacity-50"}`}>
              <img src={markerPreviewDataUrl({ icon: m.icon, color: m.color })} alt="" width={15} height={20} />
              <span className="min-w-0 flex-1 truncate font-semibold text-navy">{m.title}</span>
              {m.category ? <span className="rounded bg-ice px-1 text-[10px] text-muted">{m.category}</span> : null}
            </button>
          </li>
        ))}
        {loaded && markers.length === 0 ? <li className="px-4 py-6 text-center text-xs text-muted">No markers yet. Click <strong>Add marker</strong>, then click the map — or import a CSV / GeoJSON file.</li> : null}
      </ul>
    </div>
  );
}
