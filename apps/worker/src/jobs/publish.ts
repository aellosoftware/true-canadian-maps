import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { CACHE_IMMUTABLE } from "@tcm/artifact-store";
import { auditEvents, basemapVersions, iconAssets, markers, projectEnvironments, projects, releases, type Marker } from "@tcm/db";
import { composePinSvg, resolveGlyph, PIN_HEIGHT, PIN_WIDTH } from "@tcm/icons";
import { artifactKeys, joinUrl, newId, type ReleaseManifest } from "@tcm/shared";
import {
  COMPILER_VERSION, StyleConfigSchema, LayerOverridesSchema, canonicalJson, compileStyle, markerImageKey, markersToGeoJSON, validateCompiledStyle, type MarkerRecord,
} from "@tcm/style-compiler";
import type { WorkerContext } from "../context";
import { log } from "../log";
import { buildSpriteSheet, type SpriteInput } from "../sprite/build";
import { writePointer } from "./pointer";

export interface PublishJobData { releaseId: string; organizationId: string; projectId: string; requestedBy: string }

function toRecord(m: Marker): MarkerRecord {
  return { id: m.id, externalId: m.externalId, title: m.title, lng: m.location.x, lat: m.location.y, description: m.description, link: m.link ?? null, imageUrl: m.imageUrl, icon: m.icon, color: m.color, category: m.category, properties: m.properties, sortOrder: m.sortOrder, visible: m.visible };
}

const sha = (b: Uint8Array | string) => `sha256:${createHash("sha256").update(b).digest("hex")}`;

export async function runPublish(ctx: WorkerContext, data: PublishJobData): Promise<void> {
  const { db, store, env } = ctx;
  const [rel] = await db.select().from(releases).where(eq(releases.id, data.releaseId)).limit(1);
  if (!rel) throw new Error(`release ${data.releaseId} not found`);
  if (rel.organizationId !== data.organizationId || rel.projectId !== data.projectId) throw new Error("tenant mismatch on release job");
  if (rel.status === "published" || rel.status === "superseded") return; // idempotent retry

  const l = log.child({ releaseId: rel.id, projectId: rel.projectId });
  await db.update(releases).set({ status: "building", error: null }).where(eq(releases.id, rel.id));
  const prefix = artifactKeys.releasePrefix(rel.organizationId, rel.projectId, rel.id);
  try {
    const [project] = await db.select().from(projects).where(and(eq(projects.id, rel.projectId), eq(projects.organizationId, rel.organizationId))).limit(1);
    if (!project) throw new Error("project not found");
    const basemap = rel.basemapVersionId
      ? (await db.select().from(basemapVersions).where(eq(basemapVersions.id, rel.basemapVersionId)).limit(1))[0]
      : (await db.select().from(basemapVersions).where(eq(basemapVersions.status, "available")).limit(1))[0];
    if (!basemap && !env.BASEMAP_URL) throw new Error("no basemap registered; run the basemap pipeline first");

    const config = StyleConfigSchema.parse(rel.styleConfigSnapshot);
    const overrides = rel.layerOverridesSnapshot ? LayerOverridesSchema.parse(rel.layerOverridesSnapshot) : null;
    const rows = await db.select().from(markers).where(and(eq(markers.organizationId, rel.organizationId), eq(markers.projectId, rel.projectId))).orderBy(asc(markers.sortOrder), asc(markers.id));
    const records = rows.map(toRecord).filter((m) => m.visible);
    const fc = markersToGeoJSON(records);

    // custom icons referenced by markers
    const customIds = new Set(records.map((m) => m.icon).filter((i) => i.startsWith("custom:")).map((i) => i.slice(7)));
    const customSvg = new Map<string, string>();
    for (const id of customIds) {
      const [asset] = await db.select().from(iconAssets).where(and(eq(iconAssets.id, id), eq(iconAssets.organizationId, rel.organizationId))).limit(1);
      if (!asset) continue;
      const bytes = await store.get(asset.storagePath);
      if (bytes) customSvg.set(id, new TextDecoder().decode(bytes));
    }
    const customLookup = (id: string) => customSvg.get(id) ?? null;

    // sprite: one image per (icon, colour) + the default pin
    const combos = new Map<string, { icon: string; color: string }>();
    combos.set(markerImageKey(config.markers.defaultIcon, config.markers.defaultColor), { icon: config.markers.defaultIcon, color: config.markers.defaultColor });
    for (const m of records) combos.set(markerImageKey(m.icon, m.color), { icon: m.icon, color: m.color });
    const inputs: SpriteInput[] = [...combos.entries()].map(([name, c]) => ({ name, svg: composePinSvg({ glyphSvg: resolveGlyph(c.icon, customLookup), color: c.color }), width: PIN_WIDTH, height: PIN_HEIGHT }));
    const [s1, s2] = await Promise.all([buildSpriteSheet(inputs, 1), buildSpriteSheet(inputs, 2)]);

    const maps = env.PUBLIC_MAPS_URL.replace(/\/$/, "");
    const url = (file: string) => joinUrl(maps, artifactKeys.release(rel.organizationId, rel.projectId, rel.id, file));
    const basemapUrl = env.BASEMAP_URL ?? joinUrl(maps, basemap!.pmtilesPath);
    const attribution = basemap?.attribution ?? "© OpenStreetMap contributors, Protomaps";
    const style = compileStyle(config, {
      basemapUrl,
      glyphsUrl: `${maps}/fonts/{fontstack}/{range}.pbf`,
      basemapSpriteBase: `${maps}/sprites/basemap/v4`,
      markersSpriteUrl: url("sprite"),
      markers: url("markers.geojson"),
      attribution,
      layerOverrides: overrides,
    });
    const issues = validateCompiledStyle(style);
    if (issues.length) throw new Error(`compiled style invalid: ${issues.map((i) => i.message).join("; ")}`);

    const styleJson = canonicalJson(style);
    const markersJson = JSON.stringify(fc);
    const files: Array<[string, Uint8Array | string, string]> = [
      ["style.json", styleJson, "application/json"],
      ["markers.geojson", markersJson, "application/geo+json"],
      ["sprite.json", JSON.stringify(s1.json), "application/json"],
      ["sprite.png", s1.png, "image/png"],
      ["sprite@2x.json", JSON.stringify(s2.json), "application/json"],
      ["sprite@2x.png", s2.png, "image/png"],
    ];
    const checksums: Record<string, string> = {};
    for (const [name, body, ct] of files) {
      await store.put(artifactKeys.release(rel.organizationId, rel.projectId, rel.id, name), body, { contentType: ct, cacheControl: CACHE_IMMUTABLE });
      checksums[name] = sha(body);
    }
    const manifest: ReleaseManifest = {
      schema: "tcm.release/1",
      release_id: rel.id,
      organization_id: rel.organizationId,
      project_id: rel.projectId,
      number: rel.number,
      environment: rel.environment,
      basemap_version: basemap?.name ?? "external",
      tileset_schema: basemap?.tilesetSchema ?? 4,
      style_revision: rel.styleRevision,
      style_hash: sha(styleJson),
      compiler_version: COMPILER_VERSION,
      basemaps_version: "@protomaps/basemaps@5",
      artifacts: Object.fromEntries(files.map(([n]) => [n, n])),
      urls: { style: url("style.json"), markers: url("markers.geojson"), sprite: url("sprite"), manifest: url("manifest.json") },
      checksums,
      marker_count: fc.features.length,
      attribution,
      published_at: new Date().toISOString(),
      created_by: rel.createdBy ?? data.requestedBy,
    };
    await store.put(artifactKeys.release(rel.organizationId, rel.projectId, rel.id, "manifest.json"), JSON.stringify(manifest, null, 2), { contentType: "application/json", cacheControl: CACHE_IMMUTABLE });

    // flip the environment pointer transactionally
    await db.transaction(async (tx) => {
      const [envRow] = await tx.select().from(projectEnvironments).where(and(eq(projectEnvironments.projectId, rel.projectId), eq(projectEnvironments.name, rel.environment))).limit(1);
      if (!envRow) throw new Error(`environment ${rel.environment} missing`);
      if (envRow.currentReleaseId && envRow.currentReleaseId !== rel.id) {
        await tx.update(releases).set({ status: "superseded" }).where(and(eq(releases.id, envRow.currentReleaseId), eq(releases.status, "published")));
      }
      await tx.update(projectEnvironments).set({ previousReleaseId: envRow.currentReleaseId, currentReleaseId: rel.id, pointerUpdatedAt: new Date() }).where(eq(projectEnvironments.id, envRow.id));
      await tx.update(releases).set({ status: "published", manifest, artifactPrefix: prefix, markerCount: fc.features.length, publishedAt: new Date() }).where(eq(releases.id, rel.id));
      await tx.insert(auditEvents).values({ id: newId("audit"), organizationId: rel.organizationId, actorType: "system", actorUserId: data.requestedBy, action: "release.publish", targetType: "release", targetId: rel.id, metadata: { number: rel.number, style_hash: manifest.style_hash, marker_count: fc.features.length } });
    });
    await writePointer(ctx, rel.projectId, rel.environment);
    l.info({ number: rel.number, markers: fc.features.length, sprites: inputs.length }, "release published");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    l.error({ err: message }, "publish failed");
    await store.deletePrefix(prefix).catch(() => {});
    await db.update(releases).set({ status: "failed", error: message.slice(0, 2000) }).where(eq(releases.id, rel.id));
    throw err;
  }
}
