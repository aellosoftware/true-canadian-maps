// MapLibre 6 resolves its web worker relative to import.meta.url, which bundlers rewrite.
// We serve the worker (and the shared chunk it imports) from /vendor/maplibre and point
// MapLibre at it with setWorkerUrl(). Runs before dev/build.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
const version = JSON.parse(readFileSync(path.join(dist, "../package.json"), "utf8")).version;
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/vendor/maplibre");
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(path.join(dist, f), path.join(out, f));
writeFileSync(path.join(out, "version.json"), JSON.stringify({ version }));
console.log(`copied maplibre-gl ${version} worker to public/vendor/maplibre`);
