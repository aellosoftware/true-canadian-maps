"use client";

import { useEffect } from "react";
import type { MarkerRecord } from "@tcm/style-compiler";
import { useApi } from "@/components/ConfigProvider";
import { useEditor, useEditorStore } from "@/features/editor/EditorContext";

export function useLoadMarkers() {
  const api = useApi();
  const { store, project } = useEditor();
  const loaded = useEditorStore((s) => s.markersLoaded);
  useEffect(() => {
    if (loaded) return;
    let cancelled = false;
    api<{ markers: MarkerRecord[] }>(`/orgs/${project.orgId}/projects/${project.id}/markers`)
      .then(({ data }) => { if (!cancelled) store.getState().setMarkers(data.markers); })
      .catch(() => { if (!cancelled) store.getState().setMarkers([]); });
    return () => { cancelled = true; };
  }, [api, loaded, project, store]);
}
