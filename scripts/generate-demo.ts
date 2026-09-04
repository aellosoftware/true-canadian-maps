import { writeFileSync } from "node:fs";
import { compileStyle } from "../packages/style-compiler/src/compile";
import { getPreset } from "../packages/style-compiler/src/presets";
const output = "apps/marketing/assets/live-demo/export/";
const maps = "https://maps.truecanadianmaps.com";
const features = [
  { id: "ottawa", title: "Ottawa · city centre", coordinates: [-75.6972, 45.4215] },
  { id: "montreal", title: "Montréal · centre-ville", coordinates: [-73.5673, 45.5019] },
  { id: "quebec", title: "Québec · centre-ville", coordinates: [-71.208, 46.8139] },
].map(({ id, title, coordinates }) => ({ type: "Feature", id, geometry: { type: "Point", coordinates }, properties: { id, title, category: "Public city centre", icon: "pin", color: "#E23B3B", imageKey: "pin__pin__e23b3b" } }));
writeFileSync(output + "markers.geojson", JSON.stringify({ type: "FeatureCollection", features }));
for (const [slug, language] of [["light", "en"], ["true-north", "fr"], ["sand-and-sage", "en"]] as const) {
  const config = { ...getPreset(slug)!.config, labels: { lang: language } };
  const style = compileStyle(config, {
    basemapUrl: `${maps}/base/base-ca-20260901-z6.pmtiles`, glyphsUrl: `${maps}/fonts/{fontstack}/{range}.pbf`,
    basemapSpriteBase: `${maps}/sprites/basemap/v4`, markersSpriteUrl: "https://truecanadianmaps.com/assets/live-demo/export/sprite",
    markers: "https://truecanadianmaps.com/assets/live-demo/export/markers.geojson", attribution: "© OpenStreetMap contributors, Protomaps",
  });
  writeFileSync(output + `${slug}.json`, JSON.stringify(style));
  if (slug === "light") writeFileSync(output + "style.json", JSON.stringify(style));
}
