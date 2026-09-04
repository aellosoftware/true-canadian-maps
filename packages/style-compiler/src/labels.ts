import type { LayerSpecification } from "@maplibre/maplibre-gl-style-spec";
import type { LabelLang } from "./schema";

/** Label layers whose text-field is rewritten for the "local names" option. */
const NAME_LAYERS = new Set([
  "places_country", "places_region", "places_locality", "places_subplace",
  "water_label_ocean", "water_label_lakes", "water_waterway_label", "earth_label_islands",
  "roads_labels_minor", "roads_labels_major",
]);

/** The language passed to @protomaps/basemaps `layers()`. */
export function basemapLang(lang: LabelLang): string {
  return lang === "local" ? "en" : lang;
}

/**
 * For `lang: "local"` show the on-the-ground name (`name`) and fall back to English.
 * Other languages are handled upstream by `layers({ lang })` (with multiline local names).
 */
export function applyLabelLanguage(layers: LayerSpecification[], lang: LabelLang): LayerSpecification[] {
  if (lang !== "local") return layers;
  return layers.map((l) => {
    if (!NAME_LAYERS.has(l.id) || l.type !== "symbol") return l;
    return { ...l, layout: { ...(l.layout ?? {}), "text-field": ["coalesce", ["get", "name"], ["get", "name:en"]] } } as LayerSpecification;
  });
}
