import type { LayerSpecification, StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import { layers as basemapLayers, namedFlavor, type Flavor } from "@protomaps/basemaps";

export { namedFlavor };
export type { Flavor };
import { applyLabelLanguage, basemapLang } from "./labels";
import { MARKER_SOURCE, MARKER_SPRITE_ID, markerLayers, markerSource, type MarkerFeatureCollection } from "./markers";
import type { LayerOverrides, StyleConfig } from "./schema";
import { applyVisibility } from "./visibility";

export const COMPILER_VERSION = "tcm-style-compiler/1";
export const BASEMAP_SOURCE = "basemap";

export const FONT_STACKS = {
  "noto-sans": { regular: "Noto Sans Regular", bold: "Noto Sans Medium", italic: "Noto Sans Italic" },
} as const;

export interface CompileTargets {
  /** Absolute URL of the PMTiles archive (without the pmtiles:// prefix). */
  basemapUrl: string;
  /** Glyph template, e.g. https://maps.example.com/fonts/{fontstack}/{range}.pbf */
  glyphsUrl: string;
  /** Directory of basemap sprites, e.g. https://maps.example.com/sprites/basemap/v4 (theme appended). */
  basemapSpriteBase: string;
  /** Project marker sprite URL (without extension). Omit in the editor, which registers images at runtime. */
  markersSpriteUrl?: string;
  /** Marker data: a URL to markers.geojson or an inline collection. Omit for a style without markers. */
  markers?: string | MarkerFeatureCollection;
  attribution: string;
  layerOverrides?: LayerOverrides | null;
}

/** Effective flavor = named base flavor + token overrides + font names. */
export function compileFlavor(config: StyleConfig): Flavor {
  const base = namedFlavor(config.base);
  const fonts = FONT_STACKS[config.fonts.stack];
  const { pois, landcover, ...flat } = config.tokens;
  const flavor: Flavor = { ...base, ...(flat as Partial<Flavor>), regular: fonts.regular, bold: fonts.bold, italic: fonts.italic };
  if (pois || base.pois) flavor.pois = { ...(base.pois as NonNullable<Flavor["pois"]>), ...(pois ?? {}) };
  if (landcover || base.landcover) flavor.landcover = { ...(base.landcover as NonNullable<Flavor["landcover"]>), ...(landcover ?? {}) };
  return flavor;
}

const DARK_BASES = new Set(["dark", "black"]);

/** Basemap sprite theme: the upstream sprites come in light/dark variants matching each flavor. */
export function basemapSpriteTheme(base: StyleConfig["base"]): "light" | "dark" | "white" | "grayscale" | "black" {
  return base;
}

export function isDarkBase(base: StyleConfig["base"]): boolean {
  return DARK_BASES.has(base);
}

const OVERRIDABLE = new Set(["paint", "layout", "filter", "minzoom", "maxzoom"]);

function applyOverrides(layers: LayerSpecification[], overrides: LayerOverrides | null | undefined): LayerSpecification[] {
  if (!overrides) return layers;
  return layers.map((l) => {
    const o = overrides[l.id];
    if (!o) return l;
    const next: Record<string, unknown> = { ...l };
    for (const [k, v] of Object.entries(o)) {
      if (!OVERRIDABLE.has(k) || v === undefined) continue;
      if (k === "paint" || k === "layout") {
        next[k] = { ...((l as Record<string, unknown>)[k] as Record<string, unknown> | undefined), ...(v as Record<string, unknown>) };
      } else {
        next[k] = v;
      }
    }
    return next as LayerSpecification;
  });
}

/** Recursively sort object keys so output is byte-stable regardless of construction order. */
export function canonicalize<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => canonicalize(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) out[k] = canonicalize((value as Record<string, unknown>)[k]);
    return out as T;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * Compile a StyleConfig into a MapLibre style. Pure and deterministic: the same
 * config + targets always produce the same JSON, in the editor and in the publisher.
 */
export function compileStyle(config: StyleConfig, targets: CompileTargets): StyleSpecification {
  const flavor = compileFlavor(config);
  const fonts = FONT_STACKS[config.fonts.stack];

  let layers = basemapLayers(BASEMAP_SOURCE, flavor, { lang: basemapLang(config.labels.lang) });
  layers = applyVisibility(layers, config.visibility);
  layers = applyLabelLanguage(layers, config.labels.lang);
  layers = applyOverrides(layers, targets.layerOverrides);

  const sources: StyleSpecification["sources"] = {
    [BASEMAP_SOURCE]: { type: "vector", url: `pmtiles://${targets.basemapUrl}`, attribution: targets.attribution },
  };
  if (targets.markers !== undefined) {
    sources[MARKER_SOURCE] = markerSource(config.markers, targets.markers);
    layers = [...layers, ...markerLayers(config.markers, fonts)];
  }

  const sprite: Array<{ id: string; url: string }> = [
    { id: "default", url: `${targets.basemapSpriteBase.replace(/\/$/, "")}/${basemapSpriteTheme(config.base)}` },
  ];
  if (targets.markersSpriteUrl) sprite.push({ id: MARKER_SPRITE_ID, url: targets.markersSpriteUrl });

  const style: StyleSpecification = {
    version: 8,
    name: `tcm:${config.base}`,
    metadata: { "tcm:compiler": COMPILER_VERSION, "tcm:base": config.base, "tcm:lang": config.labels.lang },
    glyphs: targets.glyphsUrl,
    sprite,
    sources,
    layers,
  };
  return canonicalize(style);
}
