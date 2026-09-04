"use client";

import { Share2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { useApi } from "@/components/ConfigProvider";
import { useEditor, useEditorStore } from "@/features/editor/EditorContext";
import { hasUnsavedWork } from "@/features/editor/marker-writes";

type EditorWindow = Window & { __TCM_EDITOR__?: { map: { getCanvas(): HTMLCanvasElement; triggerRepaint(): void; once(e: string, cb: () => void): void; redraw?(): void } } };

/** Captures the editor's WebGL canvas after a forced render; downscales to a 640×400 JPEG. */
async function captureThumbnail(): Promise<string | undefined> {
  const map = (window as EditorWindow).__TCM_EDITOR__?.map;
  if (!map) return undefined;
  const canvas = map.getCanvas();
  await new Promise<void>((resolve) => { map.once("render", () => resolve()); map.triggerRepaint(); });
  const out = document.createElement("canvas");
  const scale = Math.min(640 / canvas.width, 400 / canvas.height);
  out.width = Math.round(canvas.width * scale); out.height = Math.round(canvas.height * scale);
  out.getContext("2d")!.drawImage(canvas, 0, 0, out.width, out.height);
  const url = out.toDataURL("image/jpeg", 0.82);
  // a fully transparent/black capture means preserveDrawingBuffer was false; skip rather than upload junk
  return url.length > 2000 ? url : undefined;
}

export function ShareToGallery() {
  const api = useApi();
  const { project, store } = useEditor();
  const unsaved = useEditorStore((s) => s.saveState !== "saved" || s.saveInFlight || s.markerPending > 0 || Boolean(s.markerError) || Object.keys(s.markerDrafts).length > 0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (hasUnsavedWork(store)) { setMsg({ tone: "error", text: "Finish saving your style and locations before sharing." }); return; }
    const f = new FormData(e.currentTarget);
    setBusy(true); setMsg(null);
    try {
      const thumbnail = await captureThumbnail();
      if (hasUnsavedWork(store)) throw new Error("The draft changed while capturing the preview. Finish saving and try again.");
      const { data } = await api<{ style: { slug: string } }>(`/orgs/${project.orgId}/projects/${project.id}/gallery`, {
        method: "POST",
        json: { name: f.get("name"), description: f.get("description") || undefined, tags: String(f.get("tags")).split(",").map((t) => t.trim().toLowerCase()).filter(Boolean), thumbnail },
      });
      setMsg({ tone: "success", text: `Shared as /gallery/${data.style.slug}` });
      setOpen(false);
    } catch (err) { setMsg({ tone: "error", text: err instanceof Error ? err.message : "could not share" }); }
    finally { setBusy(false); }
  }
  return (
    <div className="border-t border-line px-4 py-3">
      {msg ? <div className="mb-2"><Alert tone={msg.tone}>{msg.text}</Alert></div> : null}
      {!open ? <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs font-semibold text-navy hover:text-red"><Share2 size={13} /> Share this style to the public gallery</button> : (
        <form onSubmit={submit} className="space-y-2 rounded-md border border-line bg-ice p-3">
          <Field label="Style name" htmlFor="g-name"><Input id="g-name" name="name" required defaultValue={`${project.name} style`} /></Field>
          <Field label="Description" htmlFor="g-desc"><Input id="g-desc" name="description" placeholder="Who is this style for?" /></Field>
          <Field label="Tags (comma separated)" htmlFor="g-tags"><Input id="g-tags" name="tags" placeholder="light, retail, brand" /></Field>
          <p className="text-[11px] text-muted">The style settings and a thumbnail of your current view will be public. The thumbnail can show visible locations. Share only a view you have permission to publish.</p>
          {unsaved ? <p role="status" className="text-xs text-muted">Finish saving your style and locations before sharing.</p> : null}
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)} className="px-3 py-1 text-xs">Cancel</Button><Button type="submit" disabled={busy || unsaved} className="px-3 py-1 text-xs">{busy ? "Sharing…" : "Share"}</Button></div>
        </form>
      )}
    </div>
  );
}
