"use client";
import { useState } from "react";
import type { StyleConfig, LayerOverrides } from "@tcm/style-compiler";
import { useApi } from "@/components/ConfigProvider";
import { useEditor, useEditorStore } from "./EditorContext";
import { discardMarkerWrites, retryMarkerWrites } from "./marker-writes";
import type { MarkerRecord } from "@tcm/style-compiler";

export function SaveRecovery() {
  const { store, project } = useEditor();
  const api = useApi();
  const state = useEditorStore((s) => s.saveState);
  const error = useEditorStore((s) => s.saveError);
  const markerError = useEditorStore((s) => s.markerError);
  const markerPending = useEditorStore((s) => s.markerPending);
  const markerRequiresReload = useEditorStore((s) => s.markerRequiresReload);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  function download() {
    const s = store.getState();
    const url = URL.createObjectURL(new Blob([JSON.stringify({ config: s.config, layerOverrides: s.layerOverrides, markers: s.markers, markerDrafts: s.markerDrafts }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `${project.slug}-unsaved-draft.json`; a.click(); URL.revokeObjectURL(url);
  }
  async function reload() {
    if (!window.confirm("Discard your local style edits and load the server style? Download your draft first if you want to keep it.")) return;
    setLoading(true); setReloadError(null);
    try {
      const { data, etag } = await api<{ style: { config: StyleConfig; layerOverrides: LayerOverrides | null; revision: number } }>(`/orgs/${project.orgId}/projects/${project.id}/style`);
      store.getState().loadServerDoc({ config: data.style.config, layerOverrides: data.style.layerOverrides }, data.style.revision, etag);
      store.temporal.getState().clear();
    } catch { setReloadError("Could not load the server style. Your local edits are still here."); }
    finally { setLoading(false); }
  }
  async function reloadMarkers() {
    if (!window.confirm("Discard pending local location edits and reload the server locations? Check the list before creating or importing locations again.")) return;
    setLoading(true); setReloadError(null);
    try {
      const { data } = await api<{ markers: MarkerRecord[] }>(`/orgs/${project.orgId}/projects/${project.id}/markers`);
      discardMarkerWrites(store);
      store.getState().setMarkers(data.markers);
    } catch { setReloadError("Could not reload locations. Your pending changes are still here."); }
    finally { setLoading(false); }
  }
  if (!error && !markerError && !markerPending && !reloadError) return null;
  return <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-pale-red px-3 py-2 text-xs text-navy" role={error || markerError ? "alert" : "status"}>
    <span>{reloadError ?? error ?? markerError ?? `Saving ${markerPending} location update${markerPending === 1 ? "" : "s"}…`}</span>
    {state === "error" ? <button className="font-bold underline" onClick={() => store.getState().retrySave()}>Retry save</button> : null}
    {markerError && !markerRequiresReload ? <button className="font-bold underline" onClick={() => retryMarkerWrites(store)}>Retry location updates</button> : null}
    {markerError ? <button className="font-bold underline" disabled={loading} onClick={reloadMarkers}>Reload server locations</button> : null}
    {error || markerError ? <button className="font-bold underline" onClick={download}>Download draft</button> : null}
    {state === "conflict" ? <button className="font-bold underline" disabled={loading} onClick={reload}>{loading ? "Loading…" : "Reload server style"}</button> : null}
  </div>;
}
