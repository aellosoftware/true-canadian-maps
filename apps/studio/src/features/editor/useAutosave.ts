"use client";
import { useEffect } from "react";
import { useApi } from "@/components/ConfigProvider";
import { useEditor } from "./EditorContext";
import { startAutosave } from "./autosave";

export function useAutosave() {
  const api = useApi();
  const { store, project, canEdit } = useEditor();
  useEffect(() => {
    if (!canEdit) return;
    return startAutosave(store, async (doc, etag) => {
      const result = await api<{ style: { revision: number } }>(`/orgs/${project.orgId}/projects/${project.id}/style`, {
        method: "PUT", headers: etag ? { "if-match": etag } : {}, json: doc,
      });
      return { revision: result.data.style.revision, etag: result.etag };
    });
  }, [api, store, project.orgId, project.id, canEdit]);
}
