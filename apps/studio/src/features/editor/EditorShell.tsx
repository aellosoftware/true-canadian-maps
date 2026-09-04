"use client";

import { Layers, MapPin, Paintbrush, Rocket, Code2, Settings, Undo2, Redo2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useCallback, useEffect, type ReactNode } from "react";
import { useEditor, useEditorStore } from "./EditorContext";
import { useAutosave } from "./useAutosave";
import { useLoadMarkers } from "@/features/markers/useLoadMarkers";
import { SaveRecovery } from "./SaveRecovery";
import { useUnsavedGuard } from "./useUnsavedGuard";

const MapCanvas = dynamic(() => import("./MapCanvas").then((m) => m.MapCanvas), { ssr: false, loading: () => <div className="absolute inset-0 grid place-items-center text-sm text-muted">Loading map…</div> });

const TABS = [
  { id: "style", label: "Style", icon: Paintbrush },
  { id: "markers", label: "Markers", icon: MapPin },
  { id: "publish", label: "Publish", icon: Rocket },
  { id: "embed", label: "Embed", icon: Code2 },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

function SaveBadge() {
  const state = useEditorStore((s) => s.saveState);
  const error = useEditorStore((s) => s.saveError);
  const label = { saved: "Style saved", dirty: "Style changed", saving: "Saving style…", conflict: "Style conflict", error: "Style save failed" }[state];
  const tone = state === "saved" ? "bg-sage/40 text-navy" : state === "conflict" || state === "error" ? "bg-pale-red text-red-dark" : "bg-pale-navy text-navy";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`} title={error ?? undefined} role="status">
      {label}
    </span>
  );
}

function UndoRedo() {
  const { store } = useEditor();
  const undo = useCallback(() => { store.temporal.getState().undo(); store.getState().markDirty(); }, [store]);
  const redo = useCallback(() => { store.temporal.getState().redo(); store.getState().markDirty(); }, [store]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={undo} className="rounded p-1.5 text-navy hover:bg-pale-navy" aria-label="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
      <button type="button" onClick={redo} className="rounded p-1.5 text-navy hover:bg-pale-navy" aria-label="Redo (Ctrl+Shift+Z)"><Redo2 size={16} /></button>
    </div>
  );
}

export function EditorShell({ children }: { children: ReactNode }) {
  const { project } = useEditor();
  const pathname = usePathname();
  useAutosave();
  useLoadMarkers();
  useUnsavedGuard();
  const base = `/o/${project.orgSlug}/projects/${project.id}`;
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ice">
      <header className="flex min-h-12 items-center justify-between gap-2 border-b border-line bg-white px-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href={`/o/${project.orgSlug}`} aria-label="Back to maps" className="flex shrink-0 items-center gap-1 text-sm text-muted hover:text-navy"><ChevronLeft size={16} /><span className="hidden sm:inline">Maps</span></Link>
          <span className="hidden text-line sm:inline">/</span>
          <h1 className="max-w-24 truncate font-display text-sm font-bold text-navy sm:max-w-64">{project.name}</h1>
          <SaveBadge />
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <UndoRedo />
          <Link href={`${base}/publish`} className="rounded-md bg-red px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-red-dark sm:px-3">Publish</Link>
        </div>
      </header>
      <SaveRecovery />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Editor sections" className="order-3 flex h-16 w-full shrink-0 items-center border-t border-line bg-white px-1 md:order-none md:h-auto md:w-16 md:flex-col md:items-center md:gap-1 md:border-r md:border-t-0 md:px-0 md:py-2">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = pathname.startsWith(`${base}/${id}`);
            return (
              <Link key={id} href={`${base}/${id}`} aria-current={active ? "page" : undefined}
                className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] font-semibold md:w-14 md:flex-none md:text-[11px] ${active ? "bg-pale-navy text-navy" : "text-muted hover:bg-ice hover:text-navy"}`}>
                <Icon size={18} aria-hidden /> {label}
              </Link>
            );
          })}
        </nav>
        <aside className="order-2 h-[44%] w-full shrink-0 overflow-y-auto border-t border-line bg-white md:order-none md:h-auto md:w-[360px] md:border-r md:border-t-0" aria-label="Editor panel">
          {children}
        </aside>
        <main className="relative order-1 min-h-0 min-w-0 flex-1 md:order-none">
          <MapCanvas />
        </main>
      </div>
      <span className="sr-only"><Layers /></span>
    </div>
  );
}
