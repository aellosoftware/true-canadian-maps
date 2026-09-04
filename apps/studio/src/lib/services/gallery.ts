import { desc, eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { artifactStoreFromEnv, CACHE_IMMUTABLE } from "@tcm/artifact-store";
import { ApiError, newId } from "@tcm/shared";
import { stylePresets, type StylePreset } from "@tcm/db";
import { StyleConfigSchema, getPreset } from "@tcm/style-compiler";
import { db } from "../db";
import { env } from "../env";
import { getStyle, saveStyle } from "./styles";
import { recordAudit } from "./audit";
import { slugify, uniqueSlug } from "../slug";

export const ShareStyleInput = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
  /** data:image/jpeg;base64,… captured client-side (≤ 400 KB) */
  thumbnail: z.string().startsWith("data:image/").max(600_000).optional(),
});

export interface GalleryCard {
  id: string; slug: string; name: string; description: string | null; tags: string[]; base: string; isPlatform: boolean;
  previewUrl: string | null; useCount: number; featured: boolean; createdAt: Date;
}

function toCard(p: StylePreset): GalleryCard {
  const maps = env().PUBLIC_MAPS_URL.replace(/\/$/, "");
  return {
    id: p.id, slug: p.slug, name: p.name, description: p.description, tags: p.tags, base: String((p.config as { base?: string }).base ?? "light"),
    isPlatform: p.organizationId === null, previewUrl: p.organizationId === null && getPreset(p.slug) ? `/gallery/${p.slug}.png` : p.previewImagePath ? `${maps}/${p.previewImagePath}` : null, useCount: p.useCount, featured: p.featured, createdAt: p.createdAt,
  };
}

export async function listGallery(): Promise<GalleryCard[]> {
  const rows = await db().select().from(stylePresets).where(eq(stylePresets.isPublic, true)).orderBy(desc(stylePresets.featured), desc(stylePresets.useCount), desc(stylePresets.createdAt));
  return rows.map(toCard);
}

export async function getGalleryStyle(slug: string): Promise<{ card: GalleryCard; config: Record<string, unknown> }> {
  const [p] = await db().select().from(stylePresets).where(and(eq(stylePresets.slug, slug), eq(stylePresets.isPublic, true))).limit(1);
  if (!p) throw ApiError.notFound("style");
  return { card: toCard(p), config: p.config };
}

/** Publish a project's current draft style to the public gallery. */
export async function shareStyle(orgId: string, projectId: string, userId: string, input: z.infer<typeof ShareStyleInput>): Promise<GalleryCard> {
  const style = await getStyle(orgId, projectId);
  const config = StyleConfigSchema.parse(style.config);
  const slug = await uniqueSlug(input.name, async (c) => (await db().select({ id: stylePresets.id }).from(stylePresets).where(eq(stylePresets.slug, c)).limit(1)).length > 0);
  const id = newId("preset");
  let previewImagePath: string | null = null;
  if (input.thumbnail) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(input.thumbnail);
    if (!m) throw new ApiError("validation_failed", "thumbnail must be a base64 jpeg/png/webp data URL");
    const bytes = Buffer.from(m[2]!, "base64");
    if (bytes.byteLength > 400 * 1024) throw new ApiError("payload_too_large", "thumbnail must be under 400 KB");
    const ext = m[1] === "image/png" ? "png" : m[1] === "image/webp" ? "webp" : "jpg";
    previewImagePath = `gallery/${id}.${ext}`;
    await artifactStoreFromEnv(process.env).put(previewImagePath, new Uint8Array(bytes), { contentType: m[1]!, cacheControl: CACHE_IMMUTABLE });
  }
  await db().transaction(async (tx) => {
    await tx.insert(stylePresets).values({
      id, organizationId: orgId, slug: slugify(slug), name: input.name, description: input.description ?? null, tags: input.tags,
      config: config as unknown as Record<string, unknown>, previewImagePath, isPublic: true, featured: false, sourceProjectId: projectId, createdBy: userId,
    });
    await recordAudit({ organizationId: orgId, actorUserId: userId, action: "gallery.share", targetType: "preset", targetId: id, metadata: { slug, name: input.name } }, tx);
  });
  const [row] = await db().select().from(stylePresets).where(eq(stylePresets.id, id)).limit(1);
  return toCard(row!);
}

/** Copy a gallery style into a project's draft (keeps markers and layer toggles). */
export async function applyGalleryStyle(orgId: string, projectId: string, userId: string, slug: string) {
  const { config } = await getGalleryStyle(slug);
  const current = StyleConfigSchema.parse((await getStyle(orgId, projectId)).config);
  const next = StyleConfigSchema.parse(config);
  await db().update(stylePresets).set({ useCount: sql`${stylePresets.useCount} + 1` }).where(eq(stylePresets.slug, slug));
  const [preset] = await db().select({ id: stylePresets.id }).from(stylePresets).where(eq(stylePresets.slug, slug)).limit(1);
  return saveStyle(orgId, projectId, userId, { config: { ...next, visibility: current.visibility, markers: current.markers, labels: current.labels }, layerOverrides: null, presetId: preset?.id ?? null }, null);
}
