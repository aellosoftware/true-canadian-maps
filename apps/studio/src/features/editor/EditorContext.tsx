"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createEditorStore, type EditorDoc, type EditorStore } from "./store";
import type { CompileTargets } from "@tcm/style-compiler";
import type { Camera } from "@/lib/dto";

export interface EditorProject {
  id: string;
  orgId: string;
  orgSlug: string;
  name: string;
  slug: string;
  camera: Camera;
  role: string;
}

export interface EditorContextValue {
  store: EditorStore;
  project: EditorProject;
  targets: Omit<CompileTargets, "markers" | "markersSpriteUrl" | "layerOverrides">;
  canEdit: boolean;
}

const Ctx = createContext<EditorContextValue | null>(null);

export function EditorProvider({
  project, doc, revision, etag, targets, canEdit, children,
}: { project: EditorProject; doc: EditorDoc; revision: number; etag: string | null; targets: EditorContextValue["targets"]; canEdit: boolean; children: ReactNode }) {
  const [store] = useState(() => createEditorStore({ orgId: project.orgId, projectId: project.id, doc, revision, etag }));
  return <Ctx.Provider value={{ store, project, targets, canEdit }}>{children}</Ctx.Provider>;
}

export function useEditor(): EditorContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("EditorProvider missing");
  return v;
}

export function useEditorStore<T>(selector: (s: ReturnType<EditorStore["getState"]>) => T): T {
  const { store } = useEditor();
  return useStore(store, selector);
}
