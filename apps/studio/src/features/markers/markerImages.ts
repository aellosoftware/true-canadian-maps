"use client";

import { composePinSvg, resolveGlyph } from "@tcm/icons";
import { markerImageKey, type MarkerRecord } from "@tcm/style-compiler";
import { customLookup as defaultCustomLookup } from "./customIcons";

export interface ImageSpec { icon: string; color: string }

/** imageKey -> (icon, colour) so the map can build any missing sprite image on demand. */
export function buildImageRegistry(markers: readonly MarkerRecord[], defaults: { icon: string; color: string }): Map<string, ImageSpec> {
  const reg = new Map<string, ImageSpec>();
  reg.set(markerImageKey(defaults.icon, defaults.color), defaults);
  for (const m of markers) reg.set(markerImageKey(m.icon, m.color), { icon: m.icon, color: m.color });
  return reg;
}

export async function rasterizeMarker(spec: ImageSpec, pixelRatio = 2, customLookup: (id: string) => string | null | undefined = defaultCustomLookup): Promise<ImageData> {
  const svg = composePinSvg({ glyphSvg: resolveGlyph(spec.icon, customLookup), color: spec.color });
  const img = new Image();
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("could not rasterize marker icon"));
    img.src = url;
  });
  const w = 24 * pixelRatio, h = 32 * pixelRatio;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Small inline preview for lists/pickers. */
export function markerPreviewDataUrl(spec: ImageSpec, customLookup: (id: string) => string | null | undefined = defaultCustomLookup): string {
  const svg = composePinSvg({ glyphSvg: resolveGlyph(spec.icon, customLookup), color: spec.color });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
