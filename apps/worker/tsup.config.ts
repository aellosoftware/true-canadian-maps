import { cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Bundle the worker (and its workspace packages) into plain Node ESM; keep native/heavy deps external. */
export default defineConfig({
  entry: { index: "src/index.ts", migrate: "src/migrate.ts", cli: "src/cli.ts" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: [/^@tcm\//, "@protomaps/basemaps"],
  external: ["pg", "pg-boss", "pino", "@resvg/resvg-wasm", "fast-png", "potpack", "drizzle-orm", "@aws-sdk/client-s3", "zod", "ulidx", "@maplibre/maplibre-gl-style-spec"],
  onSuccess: async () => {
    cpSync(path.resolve(here, "../../packages/db/migrations"), path.resolve(here, "dist/migrations"), { recursive: true });
    console.log("copied migrations into dist/");
  },
});
