import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { defineConfig } from "tsup";
import { randomUUID } from "node:crypto";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
const version = process.env.TCM_EMBED_VERSION ?? `${pkg.version}-dev-${randomUUID()}`;
if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(version)) throw new Error("Invalid immutable embed version");
const versioned = `dist/embed/v1/${version}`;
const define = { __TCM_VERSION__: JSON.stringify(version) };

export default defineConfig([
  // loader: tiny, mutable, classic script
  { entry: { v1: "src/loader/v1.ts" }, outDir: "dist/embed", format: ["iife"], platform: "browser", target: "es2020", minify: true, sourcemap: false, define, outExtension: () => ({ js: ".js" }), clean: true },
  // core: maplibre + pmtiles + runtime, immutable path
  {
    entry: { tcm: "src/core/index.ts" },
    outDir: versioned,
    format: ["esm"],
    platform: "browser",
    target: "es2020",
    minify: true,
    sourcemap: true,
    define,
    noExternal: ["maplibre-gl", "pmtiles"],
    outExtension: () => ({ js: ".js" }),
    onSuccess: async () => {
      const require = createRequire(import.meta.url);
      const ml = path.dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
      mkdirSync(versioned, { recursive: true });
      for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(path.join(ml, f), path.join(versioned, f));
      const css = readFileSync(path.join(ml, "maplibre-gl.css"), "utf8") + "\n" + readFileSync("src/styles/tcm.css", "utf8");
      writeFileSync(path.join(versioned, "tcm.css"), css);
      writeFileSync("dist/embed/version.json", JSON.stringify({ version }));
      writeFileSync("dist/style.css", css); // SDK consumers: import "@truecanadianmaps/web/style.css"
      writeFileSync("dist/style.css.d.ts", "export {};\n");
      console.log(`embed core ${version} -> ${versioned}`);
    },
  },
  // SDK for bundlers (maplibre-gl/pmtiles stay external)
  { entry: { web: "src/sdk/index.ts" }, outDir: "dist", format: ["esm"], platform: "browser", target: "es2020", dts: true, sourcemap: true, define, external: ["maplibre-gl", "pmtiles"] },
]);
