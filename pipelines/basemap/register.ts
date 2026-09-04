/**
 * Register a basemap archive in the database so projects can reference it.
 * usage: tsx register.ts --name base-ca-20260901 --file /srv/delivery/base/base-ca-20260901.pmtiles --build 20260901 [--path base/base-ca-20260901.pmtiles]
 */
import { createHash } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { eq } from "drizzle-orm";
import { basemapVersions, createDb } from "@tcm/db";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!;
  if (fallback !== undefined) return fallback;
  throw new Error(`missing --${name}`);
}

async function sha256(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(file).on("data", (d) => h.update(d)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });
}

const name = arg("name");
const file = arg("file");
const build = arg("build", "");
const relPath = arg("path", `base/${path.basename(file)}`);
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required");

let meta: { bounds?: string; minZoom?: number; maxZoom?: number } = {};
try {
  const out = execFileSync("pmtiles", ["show", file], { encoding: "utf8" });
  // bounds: (long: -141.010000, lat: 41.670000) (long: -52.580000, lat: 83.140000)
  const b = /bounds:\s*\(long:\s*([-\d.]+),\s*lat:\s*([-\d.]+)\)\s*\(long:\s*([-\d.]+),\s*lat:\s*([-\d.]+)\)/i.exec(out);
  const bounds = b ? `${b[1]},${b[2]},${b[3]},${b[4]}` : undefined;
  const minZ = /min zoom:\s*(\d+)/i.exec(out)?.[1];
  const maxZ = /max zoom:\s*(\d+)/i.exec(out)?.[1];
  meta = { bounds, minZoom: minZ ? Number(minZ) : undefined, maxZoom: maxZ ? Number(maxZ) : undefined };
} catch {
  console.warn("pmtiles CLI not available; skipping bounds/zoom metadata");
}
const bbox = meta.bounds ? (meta.bounds.split(/[\s,]+/).map(Number) as [number, number, number, number]) : null;

const { db, pool } = createDb(url, { max: 1 });
try {
  const hash = await sha256(file);
  const size = statSync(file).size;
  if (!Number.isSafeInteger(size) || size < 0) throw new Error("Basemap size exceeds the supported safe integer range");
  const existing = await db.select({ id: basemapVersions.id }).from(basemapVersions).where(eq(basemapVersions.name, name)).limit(1);
  const values = {
    name,
    pmtilesPath: relPath,
    sourceUrl: build ? `https://build.protomaps.com/${build}.pmtiles` : null,
    sourceBuildDate: build || null,
    tilesetSchema: 4,
    bbox,
    minZoom: meta.minZoom ?? null,
    maxZoom: meta.maxZoom ?? null,
    sizeBytes: size,
    sha256: hash,
    status: "available" as const,
  };
  if (existing[0]) {
    await db.update(basemapVersions).set(values).where(eq(basemapVersions.id, existing[0].id));
    console.log(`updated ${name} (${existing[0].id})`);
  } else {
    const { newId } = await import("@tcm/shared");
    const id = newId("basemap");
    await db.insert(basemapVersions).values({ id, ...values });
    console.log(`registered ${name} as ${id}`);
  }
} finally {
  await pool.end();
}
