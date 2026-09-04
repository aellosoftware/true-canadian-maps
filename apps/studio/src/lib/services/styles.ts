import { createHash } from "node:crypto";
import { and, desc, eq, or, isNull } from "drizzle-orm";
import { ApiError, newId } from "@tcm/shared";
import { basemapVersions, stylePresets, styles, type Style } from "@tcm/db";
import { LayerOverridesSchema, StyleConfigSchema, applyPreset as applyPresetConfig, type LayerOverrides, type StyleConfig } from "@tcm/style-compiler";
import { db } from "../db";
import { getProject } from "./projects";
import { recordAudit } from "./audit";

export function styleEtag(style: Style): string {
  return `"${createHash("sha1").update(`${style.id}:${style.revision}`).digest("hex").slice(0, 16)}"`;
}

export async function getStyle(orgId: string, projectId: string): Promise<Style> {
  await getProject(orgId, projectId);
  const rows = await db().select().from(styles).where(and(eq(styles.organizationId, orgId), eq(styles.projectId, projectId))).limit(1);
  let s = rows[0];
  if (!s) {
    // Older projects may pre-date the styles row; create a default on first read.
    const { defaultConfig } = await import("@tcm/style-compiler");
    await db().insert(styles).values({ id: newId("style"), organizationId: orgId, projectId, config: defaultConfig() as unknown as Record<string, unknown> });
    s = (await db().select().from(styles).where(and(eq(styles.organizationId, orgId), eq(styles.projectId, projectId))).limit(1))[0]!;
  }
  return s;
}

export interface SaveStyleInput {
  config: StyleConfig;
  layerOverrides?: LayerOverrides | null;
  presetId?: string | null;
  name?: string;
}

/** Full replace with optimistic concurrency via the caller's If-Match etag. */
export async function saveStyle(orgId: string, projectId: string, userId: string, input: SaveStyleInput, ifMatch: string | null): Promise<Style> {
  const current = await getStyle(orgId, projectId);
  const config = StyleConfigSchema.parse(input.config);
  const layerOverrides = input.layerOverrides == null ? null : LayerOverridesSchema.parse(input.layerOverrides);
  return db().transaction(async (tx) => {
    // Lock the row before checking its ETag. Concurrent writers cannot both
    // acknowledge the same revision, including callers without If-Match.
    const [locked] = await tx.select().from(styles).where(eq(styles.id, current.id)).for("update");
    if (!locked) throw ApiError.notFound("style");
    if (ifMatch && ifMatch !== "*" && ifMatch !== styleEtag(locked)) {
      throw new ApiError("precondition_failed", "the style was modified by someone else; download your draft or reload the server version", { revision: locked.revision });
    }
    const [saved] = await tx
      .update(styles)
      .set({
        config: config as unknown as Record<string, unknown>,
        layerOverrides: layerOverrides as Record<string, unknown> | null,
        presetId: input.presetId === undefined ? locked.presetId : input.presetId,
        name: input.name ?? locked.name,
        revision: locked.revision + 1,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(styles.id, locked.id)).returning();
    await recordAudit({ organizationId: orgId, actorUserId: userId, action: "style.update", targetType: "style", targetId: locked.id, metadata: { revision: locked.revision + 1, base: config.base } }, tx);
    return saved!;
  });
}

export async function listPresets(orgId: string | null) {
  const where = orgId ? or(isNull(stylePresets.organizationId), eq(stylePresets.organizationId, orgId), eq(stylePresets.isPublic, true)) : eq(stylePresets.isPublic, true);
  return db()
    .select({
      id: stylePresets.id, slug: stylePresets.slug, name: stylePresets.name, description: stylePresets.description, tags: stylePresets.tags,
      config: stylePresets.config, previewImagePath: stylePresets.previewImagePath, isPublic: stylePresets.isPublic, featured: stylePresets.featured,
      organizationId: stylePresets.organizationId, useCount: stylePresets.useCount, createdAt: stylePresets.createdAt,
    })
    .from(stylePresets)
    .where(where)
    .orderBy(desc(stylePresets.featured), desc(stylePresets.useCount), stylePresets.name);
}

export async function applyPresetToProject(orgId: string, projectId: string, userId: string, presetSlugOrId: string, opts: { keepVisibility?: boolean; keepMarkers?: boolean }): Promise<Style> {
  const current = await getStyle(orgId, projectId);
  const rows = await db().select().from(stylePresets).where(or(eq(stylePresets.slug, presetSlugOrId), eq(stylePresets.id, presetSlugOrId))).limit(1);
  const preset = rows[0];
  if (!preset || (preset.organizationId && preset.organizationId !== orgId && !preset.isPublic)) throw ApiError.notFound("preset");
  const currentConfig = StyleConfigSchema.parse(current.config);
  const presetConfig = StyleConfigSchema.parse(preset.config);
  const next: StyleConfig = {
    ...presetConfig,
    visibility: opts.keepVisibility === false ? presetConfig.visibility : currentConfig.visibility,
    markers: opts.keepMarkers === false ? presetConfig.markers : currentConfig.markers,
    labels: currentConfig.labels,
  };
  void applyPresetConfig; // platform presets share the same merge rules as PRESETS
  await db().update(stylePresets).set({ useCount: preset.useCount + 1 }).where(eq(stylePresets.id, preset.id));
  return saveStyle(orgId, projectId, userId, { config: next, layerOverrides: null, presetId: preset.id }, null);
}

export async function listBasemaps() {
  return db().select().from(basemapVersions).orderBy(desc(basemapVersions.createdAt));
}
