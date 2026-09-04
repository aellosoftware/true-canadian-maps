import type { StyleConfig } from "./schema";
import { DEFAULT_VISIBILITY } from "./visibility";

export interface Preset {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  config: StyleConfig;
}

const DEFAULT_MARKERS: StyleConfig["markers"] = {
  cluster: false,
  clusterRadius: 50,
  iconScale: 1,
  showTitles: false,
  defaultIcon: "pin",
  defaultColor: "#E23B3B",
};

export function defaultConfig(base: StyleConfig["base"] = "light"): StyleConfig {
  return {
    version: 1,
    base,
    tokens: {},
    visibility: { ...DEFAULT_VISIBILITY },
    labels: { lang: "en" },
    fonts: { stack: "noto-sans" },
    markers: { ...DEFAULT_MARKERS },
  };
}

function preset(slug: string, name: string, description: string, tags: string[], config: Partial<StyleConfig> & { base: StyleConfig["base"] }): Preset {
  return { slug, name, description, tags, config: { ...defaultConfig(config.base), ...config, tokens: config.tokens ?? {} } };
}

/** Platform presets: the five Protomaps flavors plus originals built from the brand palette. */
export const PRESETS: readonly Preset[] = [
  preset("light", "Light", "The standard Protomaps light basemap.", ["light", "standard"], { base: "light" }),
  preset("dark", "Dark", "Low-glare dark basemap for dashboards and night use.", ["dark", "standard"], { base: "dark" }),
  preset("white", "White", "Minimal white canvas that lets your markers stand out.", ["light", "minimal"], { base: "white" }),
  preset("grayscale", "Grayscale", "Neutral greys for data overlays and print.", ["light", "minimal", "print"], { base: "grayscale" }),
  preset("black", "Black", "High-contrast black basemap.", ["dark", "minimal"], { base: "black" }),
  preset("true-north", "True North", "Navy night map with signal-red highways and aqua arterials.", ["dark", "brand"], {
    base: "dark",
    tokens: {
      background: "#0b2130", earth: "#102d3c", water: "#1f4c5c", glacier: "#2a5566", sand: "#1a3a48", beach: "#1a3a48",
      park_a: "#173f4a", park_b: "#194552", wood_a: "#153c47", wood_b: "#173f4a", scrub_a: "#143643", scrub_b: "#153944",
      buildings: "#1c3d4c", boundaries: "#79c7c3",
      highway: "#e23b3b", highway_casing_early: "#8a2323", highway_casing_late: "#8a2323",
      major: "#79c7c3", major_casing_early: "#3c7b78", major_casing_late: "#3c7b78",
      minor_a: "#33606d", minor_b: "#2c5461", minor_casing: "#1a3a48", minor_service: "#2a4f5c", minor_service_casing: "#1a3a48",
      link: "#5aa7a3", link_casing: "#2f6a68", other: "#2a4f5c", railway: "#4c7c86",
      bridges_highway: "#e23b3b", bridges_highway_casing: "#8a2323", bridges_major: "#79c7c3", bridges_major_casing: "#3c7b78",
      bridges_minor: "#33606d", bridges_minor_casing: "#1a3a48", bridges_link: "#5aa7a3", bridges_link_casing: "#2f6a68", bridges_other: "#2a4f5c", bridges_other_casing: "#1a3a48",
      country_label: "#f5fafa", state_label: "#c9efe9", state_label_halo: "#102d3c", city_label: "#f5fafa", city_label_halo: "#102d3c",
      subplace_label: "#c9efe9", subplace_label_halo: "#102d3c", ocean_label: "#79c7c3",
      roads_label_major: "#f5fafa", roads_label_major_halo: "#102d3c", roads_label_minor: "#c9efe9", roads_label_minor_halo: "#102d3c",
      address_label: "#c9efe9", address_label_halo: "#102d3c",
    },
  }),
  preset("sand-and-sage", "Sand & Sage", "Warm paper tones with sage parks and aqua water.", ["light", "brand", "warm"], {
    base: "light",
    tokens: {
      background: "#faf6ef", earth: "#f2e8d8", sand: "#efe0c6", beach: "#efe0c6", water: "#c9efe9", glacier: "#f5fafa",
      park_a: "#b7c8ad", park_b: "#c6d3bd", wood_a: "#b7c8ad", wood_b: "#c1cfb8", scrub_a: "#d5ddc7", scrub_b: "#dbe2cf",
      pedestrian: "#efe6d6", pier: "#efe6d6", buildings: "#e6dac6", boundaries: "#79c7c3",
      highway: "#e0b98d", highway_casing_early: "#c99f70", highway_casing_late: "#c99f70",
      major: "#f3e6cf", major_casing_early: "#d9c7a8", major_casing_late: "#d9c7a8",
      minor_a: "#ffffff", minor_b: "#fbf7f0", minor_casing: "#e2d6c2", minor_service: "#fbf7f0", minor_service_casing: "#e2d6c2",
      link: "#f3e6cf", link_casing: "#d9c7a8", other: "#f7f0e4", railway: "#bfb39f",
      bridges_highway: "#e0b98d", bridges_highway_casing: "#c99f70", bridges_major: "#f3e6cf", bridges_major_casing: "#d9c7a8",
      bridges_minor: "#ffffff", bridges_minor_casing: "#e2d6c2", bridges_link: "#f3e6cf", bridges_link_casing: "#d9c7a8", bridges_other: "#f7f0e4", bridges_other_casing: "#e2d6c2",
      country_label: "#102d3c", state_label: "#2a3c44", state_label_halo: "#faf6ef", city_label: "#102d3c", city_label_halo: "#faf6ef",
      subplace_label: "#2a3c44", subplace_label_halo: "#faf6ef", ocean_label: "#3c7b78",
      roads_label_major: "#2a3c44", roads_label_major_halo: "#faf6ef", roads_label_minor: "#5d7078", roads_label_minor_halo: "#faf6ef",
      address_label: "#5d7078", address_label_halo: "#faf6ef",
    },
  }),
  preset("ice", "Ice", "Cool white canvas with aqua water and navy labels.", ["light", "brand", "minimal"], {
    base: "white",
    tokens: {
      background: "#f5fafa", earth: "#f5fafa", water: "#c9efe9", glacier: "#ffffff", park_a: "#e6efe3", park_b: "#ebf2e8",
      wood_a: "#e6efe3", wood_b: "#ebf2e8", buildings: "#e8eef0", boundaries: "#79c7c3",
      highway: "#d9e4e5", highway_casing_early: "#c3d2d4", highway_casing_late: "#c3d2d4", major: "#e6eeef", major_casing_early: "#d0dcdd", major_casing_late: "#d0dcdd",
      minor_a: "#ffffff", minor_b: "#fbfdfd", minor_casing: "#dde7e8", minor_service: "#fbfdfd", minor_service_casing: "#dde7e8",
      country_label: "#194b5b", state_label: "#194b5b", state_label_halo: "#f5fafa", city_label: "#102d3c", city_label_halo: "#f5fafa",
      subplace_label: "#3f5f6b", subplace_label_halo: "#f5fafa", ocean_label: "#3c7b78",
      roads_label_major: "#2a3c44", roads_label_major_halo: "#f5fafa", roads_label_minor: "#5d7078", roads_label_minor_halo: "#f5fafa",
    },
  }),
  preset("contour", "Contour", "Grayscale land with aqua water and boundaries for data-first maps.", ["light", "brand", "data"], {
    base: "grayscale",
    tokens: { water: "#a9dfdb", boundaries: "#79c7c3", ocean_label: "#3c7b78", glacier: "#e9f6f5" },
  }),
];

export function getPreset(slug: string): Preset | undefined {
  return PRESETS.find((p) => p.slug === slug);
}

/** Apply a preset while keeping the project's marker settings and layer toggles unless told otherwise. */
export function applyPreset(current: StyleConfig, presetSlug: string, opts: { keepVisibility?: boolean; keepMarkers?: boolean } = {}): StyleConfig {
  const p = getPreset(presetSlug);
  if (!p) throw new Error(`unknown preset: ${presetSlug}`);
  return {
    ...p.config,
    visibility: opts.keepVisibility === false ? p.config.visibility : current.visibility,
    markers: opts.keepMarkers === false ? p.config.markers : current.markers,
    labels: current.labels,
  };
}
