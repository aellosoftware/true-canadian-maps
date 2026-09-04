import type { LayerSpecification, SourceSpecification } from "@maplibre/maplibre-gl-style-spec";
import { z } from "zod";
import { ColorSchema, type MarkerSettings } from "./schema";

export const MARKER_SOURCE = "tcm-markers";
export const MARKER_SPRITE_ID = "markers";
export const MARKER_LAYERS = { clusters: "tcm-marker-clusters", clusterCount: "tcm-marker-cluster-count", markers: "tcm-markers" } as const;
export const DEFAULT_PIN_ICON = "pin";

export const MarkerLinkSchema = z.object({ label: z.string().trim().min(1).max(60), url: z.string().url().max(2048) });

export const MarkerInputSchema = z.object({
  externalId: z.string().trim().max(120).nullable().optional(),
  title: z.string().trim().min(1).max(120),
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  description: z.string().trim().max(2000).nullable().optional(),
  link: MarkerLinkSchema.nullable().optional(),
  imageUrl: z.string().url().max(2048).nullable().optional(),
  icon: z.string().trim().min(1).max(80).default(DEFAULT_PIN_ICON),
  color: ColorSchema.default("#E23B3B"),
  category: z.string().trim().max(60).nullable().optional(),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  sortOrder: z.number().int().default(0),
  visible: z.boolean().default(true),
});
export type MarkerInput = z.infer<typeof MarkerInputSchema>;

export interface MarkerRecord extends MarkerInput {
  id: string;
}

export interface MarkerFeatureProperties {
  id: string;
  title: string;
  description: string | null;
  link: { label: string; url: string } | null;
  imageUrl: string | null;
  icon: string;
  color: string;
  category: string | null;
  imageKey: string;
  externalId: string | null;
  [key: string]: unknown;
}

export interface MarkerFeatureCollection {
  type: "FeatureCollection";
  features: Array<{ type: "Feature"; id: string; geometry: { type: "Point"; coordinates: [number, number] }; properties: MarkerFeatureProperties }>;
}

/** Stable sprite image name for an (icon, colour) combination, e.g. `pin__maki-cafe__e23b3b`. */
export function markerImageKey(icon: string, color: string): string {
  const safeIcon = icon.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || DEFAULT_PIN_ICON;
  const safeColor = color.toLowerCase().replace(/[^a-z0-9.%]+/g, "");
  return `pin__${safeIcon}__${safeColor}`;
}

/** Deterministic GeoJSON for a project's visible markers (sorted by sortOrder, then id). */
export function markersToGeoJSON(markers: readonly MarkerRecord[]): MarkerFeatureCollection {
  const sorted = [...markers].filter((m) => m.visible !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    type: "FeatureCollection",
    features: sorted.map((m) => ({
      type: "Feature",
      id: m.id,
      geometry: { type: "Point", coordinates: [round(m.lng), round(m.lat)] },
      properties: {
        ...(m.properties ?? {}),
        id: m.id,
        externalId: m.externalId ?? null,
        title: m.title,
        description: m.description ?? null,
        link: m.link ?? null,
        imageUrl: m.imageUrl ?? null,
        icon: m.icon,
        color: m.color,
        category: m.category ?? null,
        imageKey: markerImageKey(m.icon, m.color),
      },
    })),
  };
}

function round(n: number): number {
  return Math.round(n * 1e7) / 1e7;
}

export function markerSource(settings: MarkerSettings, data: string | MarkerFeatureCollection): SourceSpecification {
  return {
    type: "geojson",
    data: data as never,
    promoteId: "id",
    ...(settings.cluster ? { cluster: true, clusterRadius: settings.clusterRadius, clusterMaxZoom: 14 } : {}),
  };
}

/** Marker layers appended after the basemap. Icons live in the `markers` sprite (or editor-added images). */
export function markerLayers(settings: MarkerSettings, fonts: { regular: string; bold: string }): LayerSpecification[] {
  const iconImage: unknown = ["concat", `${MARKER_SPRITE_ID}:`, ["get", "imageKey"]];
  const layers: LayerSpecification[] = [];
  if (settings.cluster) {
    layers.push(
      {
        id: MARKER_LAYERS.clusters,
        type: "circle",
        source: MARKER_SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": settings.defaultColor,
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      },
      {
        id: MARKER_LAYERS.clusterCount,
        type: "symbol",
        source: MARKER_SOURCE,
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": [fonts.bold], "text-size": 12 },
        paint: { "text-color": "#ffffff" },
      },
    );
  }
  layers.push({
    id: MARKER_LAYERS.markers,
    type: "symbol",
    source: MARKER_SOURCE,
    filter: settings.cluster ? ["!", ["has", "point_count"]] : ["all"],
    layout: {
      "icon-image": iconImage as never,
      "icon-size": settings.iconScale,
      "icon-anchor": "bottom",
      "icon-allow-overlap": true,
      "icon-ignore-placement": false,
      ...(settings.showTitles
        ? {
            "text-field": ["get", "title"],
            "text-font": [fonts.regular],
            "text-size": 12,
            "text-offset": [0, 0.6],
            "text-anchor": "top",
            "text-optional": true,
          }
        : {}),
    },
    paint: settings.showTitles ? { "text-color": "#1a2f38", "text-halo-color": "#ffffff", "text-halo-width": 1.2 } : {},
  } as LayerSpecification);
  return layers;
}
