import type { LayerSpecification } from "@maplibre/maplibre-gl-style-spec";
import type { Visibility, VisibilityKey } from "./schema";

/**
 * Layer ids emitted by @protomaps/basemaps `layers()` grouped by editor toggle.
 * A test asserts every id here exists in the generated layer list, so an upstream
 * rename fails CI instead of silently un-hiding a layer in production.
 */
export const VISIBILITY_GROUPS: Record<VisibilityKey, readonly string[]> = {
  pois: ["pois"],
  buildings: ["buildings"],
  addresses: ["address_label"],
  boundaries: ["boundaries", "boundaries_country"],
  landcover: ["landcover"],
  landuse: [
    "landuse_park", "landuse_urban_green", "landuse_hospital", "landuse_industrial", "landuse_school",
    "landuse_beach", "landuse_zoo", "landuse_aerodrome", "landuse_runway", "landuse_pedestrian", "landuse_pier",
  ],
  rail: ["roads_rail"],
  roadLabels: ["roads_labels_minor", "roads_labels_major", "roads_oneway"],
  roadShields: ["roads_shields"],
  placeLabels: ["places_country", "places_region", "places_locality", "places_subplace"],
  waterLabels: ["water_label_ocean", "water_label_lakes", "water_waterway_label", "earth_label_islands"],
};

export const DEFAULT_VISIBILITY: Visibility = {
  pois: true, buildings: true, addresses: false, boundaries: true, landuse: true, landcover: true,
  rail: true, roadLabels: true, roadShields: true, placeLabels: true, waterLabels: true,
};

/** Hides layers by setting `layout.visibility` (keeps ids addressable and z-order stable). */
export function applyVisibility(layers: LayerSpecification[], visibility: Visibility): LayerSpecification[] {
  const hidden = new Set<string>();
  for (const [key, ids] of Object.entries(VISIBILITY_GROUPS) as [VisibilityKey, readonly string[]][]) {
    if (!visibility[key]) for (const id of ids) hidden.add(id);
  }
  if (hidden.size === 0) return layers;
  return layers.map((l) => {
    if (!hidden.has(l.id) || l.type === "background") return l;
    return { ...l, layout: { ...(l.layout ?? {}), visibility: "none" } } as LayerSpecification;
  });
}
