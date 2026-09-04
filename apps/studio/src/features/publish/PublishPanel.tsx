"use client";

import { ExternalLink, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ReleaseManifest } from "@tcm/shared";
import { Alert, Button } from "@/components/ui";
import { useApi, usePublicConfig } from "@/components/ConfigProvider";
import { useEditor, useEditorStore } from "@/features/editor/EditorContext";
import { hasUnsavedWork } from "@/features/editor/marker-writes";

interface Release {
  id: string; number: number; status: "queued" | "building" | "published" | "failed" | "superseded"; styleRevision: number; markerCount: number;
  manifest: ReleaseManifest | null; error: string | null; createdAt: string; publishedAt: string | null;
}
interface Environment { id: string; name: string; currentReleaseId: string | null; previousReleaseId: string | null; pointerUpdatedAt: string | null }

const STATUS_TONE: Record<Release["status"], string> = {
  queued: "bg-pale-navy text-navy", building: "bg-aqua-light text-navy", published: "bg-sage/50 text-navy", failed: "bg-pale-red text-red-dark", superseded: "bg-ice text-muted",
};

export function PublishPanel() {
  const api = useApi();
  const { mapsBase } = usePublicConfig();
  const { project, canEdit, store } = useEditor();
  const saveState = useEditorStore((s) => s.saveState);
  const revision = useEditorStore((s) => s.revision);
  const markerPending = useEditorStore((s) => s.markerPending);
  const markerError = useEditorStore((s) => s.markerError);
  const markerDrafts = useEditorStore((s) => s.markerDrafts);
  const saveInFlight = useEditorStore((s) => s.saveInFlight);
  const unsaved = saveState !== "saved" || saveInFlight || markerPending > 0 || Boolean(markerError) || Object.keys(markerDrafts).length > 0;
  const [releases, setReleases] = useState<Release[]>([]);
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await api<{ releases: Release[]; environments: Environment[] }>(`/orgs/${project.orgId}/projects/${project.id}/releases`);
    setReleases(data.releases); setEnvs(data.environments);
    return data.releases;
  }, [api, project]);

  useEffect(() => { void load().catch((e) => setError(String(e.message ?? e))); }, [load]);

  // poll while a build is in flight
  const inflight = releases.some((r) => r.status === "queued" || r.status === "building");
  useEffect(() => {
    if (!inflight) return;
    const t = window.setInterval(() => { void load(); }, 2000);
    return () => window.clearInterval(t);
  }, [inflight, load]);

  const production = envs.find((e) => e.name === "production");
  const current = releases.find((r) => r.id === production?.currentReleaseId) ?? null;
  const publishedBehind = current ? current.styleRevision < revision : true;

  async function publish() {
    if (hasUnsavedWork(store)) { setError("Finish saving the style and location updates before publishing."); return; }
    setBusy(true); setError(null);
    try { await api(`/orgs/${project.orgId}/projects/${project.id}/publish`, { method: "POST", json: {} }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "publish failed"); }
    finally { setBusy(false); }
  }
  async function restore(releaseId: string) {
    setBusy(true); setError(null);
    try { await api(`/orgs/${project.orgId}/projects/${project.id}/environments/production/rollback`, { method: "POST", json: { releaseId } }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "rollback failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-sm font-bold text-navy">Publish</h2>
        <p className="mt-1 text-xs text-muted">Publishing compiles the draft into immutable files (style, markers, sprite, manifest) and points the production environment at them.</p>
      </div>
      <Alert tone="info">Published map content is public, including previous releases. Browser-origin restrictions do not make map files confidential. Publish only information you have permission to share publicly.</Alert>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="rounded-md border border-line bg-ice p-3 text-xs">
        <div className="flex items-center justify-between"><span className="font-semibold text-navy">Production</span>
          {current ? <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_TONE[current.status]}`}>release #{current.number}</span> : <span className="text-muted">nothing published yet</span>}</div>
        <p className="mt-1 text-muted">Draft revision {revision}{current ? ` · published revision ${current.styleRevision}` : ""}{saveState === "dirty" || saveState === "saving" ? " · saving draft…" : ""}</p>
        {unsaved ? <p role="status" className="mt-2 text-muted">Finish saving your style and location changes before publishing.</p> : null}
        <Button type="button" onClick={publish} disabled={!canEdit || busy || inflight || unsaved} className="mt-3 w-full">
          {inflight ? "Building…" : publishedBehind ? "Publish draft to production" : "Republish"}
        </Button>
        {current?.manifest ? (
          <a href={current.manifest.urls.style} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-red hover:underline">Open published style.json <ExternalLink size={11} /></a>
        ) : null}
      </div>
      <section aria-label="Release history">
        <h3 className="mb-2 text-xs font-bold text-navy">History</h3>
        <ul className="divide-y divide-line rounded-md border border-line">
          {releases.map((r) => (
            <li key={r.id} className="flex items-start gap-2 px-3 py-2 text-xs">
              <span className={`mt-0.5 rounded-full px-2 py-0.5 font-semibold ${STATUS_TONE[r.status]}`}>{r.status}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-navy">#{r.number} · rev {r.styleRevision} · {r.markerCount} markers</div>
                <div className="text-muted">{new Date(r.publishedAt ?? r.createdAt).toLocaleString("en-CA")}</div>
                {r.error ? <div className="mt-1 text-red-dark">{r.error}</div> : null}
                {r.manifest ? <div className="mt-1 break-all font-mono text-[10px] text-muted">{r.manifest.urls.manifest.replace(mapsBase, "")}</div> : null}
              </div>
              {r.status === "superseded" && canEdit ? (
                <button type="button" onClick={() => restore(r.id)} disabled={busy} className="flex items-center gap-1 text-navy hover:text-red" title="Make this the production release again"><RotateCcw size={12} /> Restore</button>
              ) : null}
            </li>
          ))}
          {releases.length === 0 ? <li className="px-3 py-4 text-center text-xs text-muted">No releases yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
