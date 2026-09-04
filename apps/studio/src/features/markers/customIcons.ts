"use client";

import { create } from "zustand";

export interface CustomIcon { id: string; name: string; width: number | null; height: number | null }

interface State {
  icons: CustomIcon[];
  svgs: Record<string, string>;
  loaded: boolean;
  setIcons: (icons: CustomIcon[]) => void;
  setSvg: (id: string, svg: string) => void;
}

/** Custom icon metadata + fetched SVG source, shared by the picker and the map image builder. */
export const useCustomIcons = create<State>()((set) => ({
  icons: [],
  svgs: {},
  loaded: false,
  setIcons: (icons) => set({ icons, loaded: true }),
  setSvg: (id, svg) => set((s) => ({ svgs: { ...s.svgs, [id]: svg } })),
}));

export function customLookup(id: string): string | null {
  return useCustomIcons.getState().svgs[id] ?? null;
}
