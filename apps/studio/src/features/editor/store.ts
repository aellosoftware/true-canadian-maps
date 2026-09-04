"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import type { FlavorOverride, LayerOverrides, MarkerRecord, StyleConfig, VisibilityKey } from "@tcm/style-compiler";

export interface EditorDoc {
  config: StyleConfig;
  layerOverrides: LayerOverrides | null;
}

export type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";
const editedState = (state: SaveState): SaveState => state === "error" || state === "conflict" ? state : "dirty";

interface EditorState extends EditorDoc {
  projectId: string;
  orgId: string;
  revision: number;
  etag: string | null;
  saveState: SaveState;
  saveError: string | null;
  lastSavedAt: number | null;
  saveInFlight: boolean;
  /** markers (persisted immediately via the API; not part of undo history) */
  markers: MarkerRecord[];
  markersLoaded: boolean;
  selectedMarkerId: string | null;
  addMode: boolean;
  setMarkers: (markers: MarkerRecord[]) => void;
  upsertMarker: (marker: MarkerRecord) => void;
  removeMarkers: (ids: string[]) => void;
  selectMarker: (id: string | null) => void;
  setAddMode: (on: boolean) => void;
  /** editing actions (tracked by undo history) */
  setToken: (key: keyof FlavorOverride, value: string | undefined) => void;
  setPoiToken: (key: string, value: string | undefined) => void;
  setLandcoverToken: (key: string, value: string | undefined) => void;
  resetTokens: () => void;
  setBase: (base: StyleConfig["base"]) => void;
  setVisibility: (key: VisibilityKey, on: boolean) => void;
  setLang: (lang: StyleConfig["labels"]["lang"]) => void;
  setMarkerSetting: <K extends keyof StyleConfig["markers"]>(key: K, value: StyleConfig["markers"][K]) => void;
  replaceDoc: (doc: EditorDoc) => void;
  /** persistence bookkeeping (not tracked) */
  markSaving: () => void;
  markSaved: (revision: number, etag: string | null, acknowledged: EditorDoc) => void;
  markConflict: (message: string) => void;
  markError: (message: string) => void;
  markDirty: () => void;
  retrySave: () => void;
  loadServerDoc: (doc: EditorDoc, revision: number, etag: string | null) => void;
  markerPending: number;
  markerError: string | null;
  markerRequiresReload: boolean;
  markerDrafts: Record<string, Partial<MarkerRecord> & { coordinateText?: string }>;
  setMarkerDraft: (id: string, patch: Partial<MarkerRecord> & { coordinateText?: string }) => void;
  clearMarkerDraft: (id: string, acknowledged: Partial<MarkerRecord> & { coordinateText?: string }) => void;
}

export type EditorStore = ReturnType<typeof createEditorStore>;

export function createEditorStore(init: { orgId: string; projectId: string; doc: EditorDoc; revision: number; etag: string | null }) {
  return create<EditorState>()(
    temporal(
      (set) => ({
        orgId: init.orgId,
        projectId: init.projectId,
        config: init.doc.config,
        layerOverrides: init.doc.layerOverrides,
        revision: init.revision,
        etag: init.etag,
        saveState: "saved",
        saveError: null,
        lastSavedAt: null,
        saveInFlight: false,
        markerPending: 0,
        markerError: null,
        markerRequiresReload: false,
        markerDrafts: {},
        setMarkerDraft: (id, patch) => set((s) => ({ markerDrafts: { ...s.markerDrafts, [id]: { ...s.markerDrafts[id], ...patch } } })),
        clearMarkerDraft: (id, acknowledged) => set((s) => {
          const draft = { ...s.markerDrafts[id] };
          for (const key of Object.keys(acknowledged)) {
            if (JSON.stringify(draft[key as keyof typeof draft]) === JSON.stringify(acknowledged[key as keyof typeof acknowledged])) delete draft[key as keyof typeof draft];
          }
          const markerDrafts = { ...s.markerDrafts };
          if (Object.keys(draft).length) markerDrafts[id] = draft; else delete markerDrafts[id];
          return { markerDrafts };
        }),
        markers: [],
        markersLoaded: false,
        selectedMarkerId: null,
        addMode: false,
        setMarkers: (markers) => set({ markers, markersLoaded: true }),
        upsertMarker: (marker) =>
          set((s) => {
            const i = s.markers.findIndex((m) => m.id === marker.id);
            const markers = i >= 0 ? s.markers.map((m) => (m.id === marker.id ? marker : m)) : [...s.markers, marker];
            return { markers };
          }),
        removeMarkers: (ids) => set((s) => ({ markers: s.markers.filter((m) => !ids.includes(m.id)), selectedMarkerId: ids.includes(s.selectedMarkerId ?? "") ? null : s.selectedMarkerId })),
        selectMarker: (id) => set({ selectedMarkerId: id }),
        setAddMode: (on) => set({ addMode: on }),

        setToken: (key, value) =>
          set((s) => {
            const tokens = { ...s.config.tokens } as Record<string, unknown>;
            if (value === undefined) delete tokens[key];
            else tokens[key] = value;
            return { config: { ...s.config, tokens: tokens as FlavorOverride }, saveState: editedState(s.saveState) };
          }),
        setPoiToken: (key, value) =>
          set((s) => {
            const pois = { ...(s.config.tokens.pois ?? {}) } as Record<string, string>;
            if (value === undefined) delete pois[key];
            else pois[key] = value;
            const tokens = { ...s.config.tokens, pois: Object.keys(pois).length ? pois : undefined } as FlavorOverride;
            if (!tokens.pois) delete (tokens as Record<string, unknown>).pois;
            return { config: { ...s.config, tokens }, saveState: editedState(s.saveState) };
          }),
        setLandcoverToken: (key, value) =>
          set((s) => {
            const lc = { ...(s.config.tokens.landcover ?? {}) } as Record<string, string>;
            if (value === undefined) delete lc[key];
            else lc[key] = value;
            const tokens = { ...s.config.tokens, landcover: Object.keys(lc).length ? lc : undefined } as FlavorOverride;
            if (!tokens.landcover) delete (tokens as Record<string, unknown>).landcover;
            return { config: { ...s.config, tokens }, saveState: editedState(s.saveState) };
          }),
        resetTokens: () => set((s) => ({ config: { ...s.config, tokens: {} }, saveState: editedState(s.saveState) })),
        setBase: (base) => set((s) => ({ config: { ...s.config, base }, saveState: editedState(s.saveState) })),
        setVisibility: (key, on) => set((s) => ({ config: { ...s.config, visibility: { ...s.config.visibility, [key]: on } }, saveState: editedState(s.saveState) })),
        setLang: (lang) => set((s) => ({ config: { ...s.config, labels: { lang } }, saveState: editedState(s.saveState) })),
        setMarkerSetting: (key, value) => set((s) => ({ config: { ...s.config, markers: { ...s.config.markers, [key]: value } }, saveState: editedState(s.saveState) })),
        replaceDoc: (doc) => set((s) => ({ config: doc.config, layerOverrides: doc.layerOverrides, saveState: editedState(s.saveState) })),

        markSaving: () => set({ saveState: "saving", saveInFlight: true, saveError: null }),
        markSaved: (revision, etag, acknowledged) => set((s) => ({ revision, etag, saveInFlight: false, saveError: null, saveState: JSON.stringify({ config: s.config, layerOverrides: s.layerOverrides }) === JSON.stringify(acknowledged) ? "saved" : "dirty", lastSavedAt: Date.now() })),
        markConflict: (message) => set({ saveState: "conflict", saveInFlight: false, saveError: message }),
        markError: (message) => set({ saveState: "error", saveInFlight: false, saveError: message }),
        markDirty: () => set((s) => ({ saveState: s.saveState === "conflict" || s.saveState === "error" ? s.saveState : "dirty" })),
        retrySave: () => set((s) => s.saveState === "error" ? { saveState: "dirty", saveError: null } : {}),
        loadServerDoc: (doc, revision, etag) => set({ ...doc, revision, etag, saveState: "saved", saveError: null, saveInFlight: false }),
      }),
      {
        limit: 200,
        partialize: (s) => ({ config: s.config, layerOverrides: s.layerOverrides }) as EditorState,
        equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
      },
    ),
  );
}
