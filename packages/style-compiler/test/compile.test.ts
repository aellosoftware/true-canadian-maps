import { layers as basemapLayers, namedFlavor } from "@protomaps/basemaps";
import { describe, expect, it } from "vitest";
import {
  FLAVOR_COLOR_KEYS, MARKER_LAYERS, PRESETS, StyleConfigSchema, TOKEN_GROUPS, VISIBILITY_GROUPS, applyPreset,
  canonicalJson, compileFlavor, compileStyle, contrastRatio, defaultConfig, markerImageKey, markersToGeoJSON, validateCompiledStyle,
  type CompileTargets,
} from "../src";

const targets: CompileTargets = {
  basemapUrl: "https://maps.example.com/base/base-ca-20260901.pmtiles",
  glyphsUrl: "https://maps.example.com/fonts/{fontstack}/{range}.pbf",
  basemapSpriteBase: "https://maps.example.com/sprites/basemap/v4",
  markersSpriteUrl: "https://maps.example.com/t/org/prj/rel/sprite",
  markers: "https://maps.example.com/t/org/prj/rel/markers.geojson",
  attribution: "© OpenStreetMap contributors, Protomaps",
};

describe("presets", () => {
  it("every preset is a valid StyleConfig and compiles to a valid MapLibre style", () => {
    for (const p of PRESETS) {
      expect(StyleConfigSchema.safeParse(p.config).success, p.slug).toBe(true);
      const style = compileStyle(p.config, targets);
      const issues = validateCompiledStyle(style);
      expect(issues, `${p.slug}: ${issues.map((i) => i.message).join("; ")}`).toEqual([]);
      expect(style.layers.length).toBeGreaterThan(60);
    }
  });
  it("preset slugs are unique", () => {
    expect(new Set(PRESETS.map((p) => p.slug)).size).toBe(PRESETS.length);
  });
  it("applyPreset keeps markers and visibility by default", () => {
    const cur = defaultConfig("light");
    cur.visibility.pois = false;
    cur.markers.cluster = true;
    const next = applyPreset(cur, "true-north");
    expect(next.base).toBe("dark");
    expect(next.visibility.pois).toBe(false);
    expect(next.markers.cluster).toBe(true);
    expect(next.tokens.highway).toBe("#e23b3b");
  });
});

describe("compileStyle", () => {
  it("is deterministic", () => {
    const a = canonicalJson(compileStyle(PRESETS[5]!.config, targets));
    const b = canonicalJson(compileStyle(PRESETS[5]!.config, targets));
    expect(a).toBe(b);
    expect(JSON.stringify(compileStyle(PRESETS[5]!.config, targets))).toBe(a); // already canonical
  });
  it("wires sources, glyphs and sprites", () => {
    const s = compileStyle(defaultConfig("dark"), targets);
    expect((s.sources.basemap as { url: string }).url).toBe(`pmtiles://${targets.basemapUrl}`);
    expect(s.glyphs).toBe(targets.glyphsUrl);
    expect(s.sprite).toEqual([
      { id: "default", url: "https://maps.example.com/sprites/basemap/v4/dark" },
      { id: "markers", url: targets.markersSpriteUrl },
    ]);
    expect(s.layers.at(-1)?.id).toBe(MARKER_LAYERS.markers);
  });
  it("omits marker layers when no markers target is given", () => {
    const s = compileStyle(defaultConfig(), { ...targets, markers: undefined, markersSpriteUrl: undefined });
    expect(s.layers.some((l) => l.id === MARKER_LAYERS.markers)).toBe(false);
    expect(s.sprite).toHaveLength(1);
  });
  it("applies token overrides onto the base flavor", () => {
    const cfg = defaultConfig("light");
    cfg.tokens.water = "#123456";
    const flavor = compileFlavor(cfg);
    expect(flavor.water).toBe("#123456");
    expect(flavor.earth).toBe(namedFlavor("light").earth);
    expect(flavor.regular).toBe("Noto Sans Regular");
    const s = compileStyle(cfg, targets);
    const water = s.layers.find((l) => l.id === "water") as { paint: { "fill-color": string } };
    expect(water.paint["fill-color"]).toBe("#123456");
  });
  it("hides layer groups with visibility toggles", () => {
    const cfg = defaultConfig();
    cfg.visibility.pois = false;
    cfg.visibility.buildings = false;
    const s = compileStyle(cfg, targets);
    const byId = new Map(s.layers.map((l) => [l.id, l]));
    expect((byId.get("pois") as { layout: { visibility: string } }).layout.visibility).toBe("none");
    expect((byId.get("buildings") as { layout: { visibility: string } }).layout.visibility).toBe("none");
    expect((byId.get("water") as { layout?: { visibility?: string } }).layout?.visibility).toBeUndefined();
  });
  it("switches label language", () => {
    const en = compileStyle(defaultConfig(), targets);
    const fr = compileStyle({ ...defaultConfig(), labels: { lang: "fr" } }, targets);
    const local = compileStyle({ ...defaultConfig(), labels: { lang: "local" } }, targets);
    const tf = (s: typeof en) => JSON.stringify((s.layers.find((l) => l.id === "places_locality") as { layout: Record<string, unknown> }).layout["text-field"]);
    expect(tf(en)).toContain("name:en");
    expect(tf(fr)).toContain("name:fr");
    expect(tf(local)).toBe(JSON.stringify(["coalesce", ["get", "name"], ["get", "name:en"]]));
  });
  it("applies layer overrides but never source/type", () => {
    const s = compileStyle(defaultConfig(), {
      ...targets,
      layerOverrides: { water: { paint: { "fill-color": "#000000" }, minzoom: 3, source: "evil", type: "line" } as never },
    });
    const water = s.layers.find((l) => l.id === "water") as { type: string; source: string; minzoom: number; paint: Record<string, unknown> };
    expect(water.paint["fill-color"]).toBe("#000000");
    expect(water.minzoom).toBe(3);
    expect(water.type).toBe("fill");
    expect(water.source).toBe("basemap");
  });
  it("supports clustering", () => {
    const cfg = defaultConfig();
    cfg.markers.cluster = true;
    const s = compileStyle(cfg, targets);
    expect(s.layers.some((l) => l.id === MARKER_LAYERS.clusters)).toBe(true);
    expect((s.sources["tcm-markers"] as { cluster: boolean }).cluster).toBe(true);
    expect(validateCompiledStyle(s)).toEqual([]);
  });
});

describe("upstream layer contract", () => {
  const ids = new Set(basemapLayers("basemap", namedFlavor("light"), { lang: "en" }).map((l) => l.id));
  it("every visibility group id exists upstream", () => {
    for (const [group, list] of Object.entries(VISIBILITY_GROUPS)) {
      for (const id of list) expect(ids.has(id), `${group}: ${id}`).toBe(true);
    }
  });
  it("every colour key appears in exactly one editor group", () => {
    const seen = new Map<string, number>();
    for (const g of TOKEN_GROUPS) for (const k of g.keys) seen.set(k, (seen.get(k) ?? 0) + 1);
    for (const k of FLAVOR_COLOR_KEYS) expect(seen.get(k), k).toBe(1);
    expect(seen.size).toBe(FLAVOR_COLOR_KEYS.length);
  });
  it("flavor keys match the upstream Flavor object", () => {
    const upstream = Object.keys(namedFlavor("light")).filter((k) => !["pois", "landcover", "regular", "bold", "italic"].includes(k)).sort();
    expect([...FLAVOR_COLOR_KEYS].sort()).toEqual(upstream);
  });
});

describe("markers", () => {
  it("builds deterministic GeoJSON with image keys", () => {
    const fc = markersToGeoJSON([
      { id: "mkr_b", title: "B", lng: -79.38, lat: 43.65, icon: "maki:cafe", color: "#E23B3B", properties: { open: true }, sortOrder: 1, visible: true },
      { id: "mkr_a", title: "A", lng: -75.69, lat: 45.42, icon: "pin", color: "#102D3C", properties: {}, sortOrder: 0, visible: true },
      { id: "mkr_c", title: "hidden", lng: 0, lat: 0, icon: "pin", color: "#000", properties: {}, sortOrder: 2, visible: false },
    ]);
    expect(fc.features.map((f) => f.id)).toEqual(["mkr_a", "mkr_b"]);
    expect(fc.features[1]!.properties.imageKey).toBe("pin__maki-cafe__e23b3b");
    expect(fc.features[1]!.properties.open).toBe(true);
    expect(markerImageKey("Custom:ico_ABC", "#ffffff")).toBe("pin__custom-ico-abc__ffffff");
  });
});

describe("contrast", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#102D3C", "#F5FAFA")!).toBeGreaterThan(10);
    expect(contrastRatio("nope", "#fff")).toBeNull();
  });
});
