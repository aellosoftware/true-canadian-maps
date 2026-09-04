/**
 * Build the built-in icon manifest from Maki (CC0) and Temaki (CC0).
 * Output: src/manifest.json  { icons: [{ id, set, name, tags, svg }] }
 * SVGs are normalised to a 15x15 viewBox glyph with fill="currentColor" removed (we recolour at compose time).
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const makiDir = path.join(path.dirname(require.resolve("@mapbox/maki/package.json")), "icons");
const temakiPkg = path.dirname(require.resolve("@rapideditor/temaki/package.json"));
const temakiDir = path.join(temakiPkg, "icons");

interface Entry { id: string; set: "maki" | "temaki"; name: string; tags: string[]; svg: string }

function normalize(svg: string): string {
  return svg
    .replace(/<\?xml[^>]*>\s*/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<title>[\s\S]*?<\/title>/g, "")
    .replace(/\s(id|xmlns:xlink|xml:space|version|enable-background)="[^"]*"/g, "")
    .replace(/\sfill="(#000|#000000|black)"/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function words(name: string): string[] {
  return name.split(/[-_]/).filter(Boolean);
}

// optional temaki tag data
let temakiTags: Record<string, string[]> = {};
for (const candidate of ["data/tags.json", "data/icons.json", "dist/temaki.json"]) {
  const f = path.join(temakiPkg, candidate);
  if (existsSync(f)) {
    try {
      const j = JSON.parse(readFileSync(f, "utf8")) as Record<string, unknown>;
      for (const [k, v] of Object.entries(j)) {
        const obj = v as { tags?: unknown; groups?: unknown };
        const tags = Array.isArray(v) ? v : Array.isArray(obj.tags) ? obj.tags : Array.isArray(obj.groups) ? obj.groups : [];
        temakiTags[k.replace(/^temaki-/, "")] = tags.map(String);
      }
      break;
    } catch { /* ignore */ }
  }
}

const icons: Entry[] = [];
for (const f of readdirSync(makiDir).filter((n) => n.endsWith(".svg")).sort()) {
  const name = f.replace(/\.svg$/, "");
  icons.push({ id: `maki:${name}`, set: "maki", name, tags: words(name), svg: normalize(readFileSync(path.join(makiDir, f), "utf8")) });
}
for (const f of readdirSync(temakiDir).filter((n) => n.endsWith(".svg")).sort()) {
  const name = f.replace(/\.svg$/, "");
  icons.push({ id: `temaki:${name}`, set: "temaki", name, tags: [...new Set([...words(name), ...(temakiTags[name] ?? [])])], svg: normalize(readFileSync(path.join(temakiDir, f), "utf8")) });
}
const out = { generatedAt: new Date().toISOString().slice(0, 10), licenses: { maki: "CC0-1.0", temaki: "CC0-1.0" }, icons };
writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/manifest.json"), JSON.stringify(out));
console.log(`wrote ${icons.length} icons (${icons.filter((i) => i.set === "maki").length} maki, ${icons.filter((i) => i.set === "temaki").length} temaki)`);
