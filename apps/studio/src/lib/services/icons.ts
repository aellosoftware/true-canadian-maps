import { createHash } from "node:crypto";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { artifactStoreFromEnv } from "@tcm/artifact-store";
import { ApiError, artifactKeys, newId, sanitizeSvg } from "@tcm/shared";
import { iconAssets, type IconAsset } from "@tcm/db";
import { db } from "../db";
import { getProject } from "./projects";
import { recordAudit } from "./audit";

const store = () => artifactStoreFromEnv(process.env);
export const MAX_ICONS_PER_PROJECT = 200;

export async function listIcons(orgId: string, projectId: string): Promise<IconAsset[]> {
  await getProject(orgId, projectId);
  return db().select().from(iconAssets)
    .where(and(eq(iconAssets.organizationId, orgId), or(eq(iconAssets.projectId, projectId), isNull(iconAssets.projectId))))
    .orderBy(desc(iconAssets.createdAt));
}

export async function uploadIcon(orgId: string, projectId: string, userId: string, name: string, rawSvg: string): Promise<IconAsset> {
  await getProject(orgId, projectId);
  const safeName = name.trim().toLowerCase().replace(/\.svg$/, "").replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "icon";
  const result = sanitizeSvg(rawSvg);
  if (!result.ok) throw new ApiError("validation_failed", "SVG rejected", result.reasons);
  const existing = await listIcons(orgId, projectId);
  if (existing.filter((i) => i.projectId === projectId).length >= MAX_ICONS_PER_PROJECT) throw new ApiError("conflict", `a project may hold at most ${MAX_ICONS_PER_PROJECT} custom icons`);
  const id = newId("icon");
  const key = artifactKeys.upload(orgId, projectId, id);
  await store().put(key, result.svg, { contentType: "image/svg+xml" });
  await db().transaction(async (tx) => {
    await tx.insert(iconAssets).values({ id, organizationId: orgId, projectId, name: safeName, kind: "svg", storagePath: key, width: Math.round(result.width), height: Math.round(result.height), sha256: createHash("sha256").update(result.svg).digest("hex"), sanitized: true, createdBy: userId });
    await recordAudit({ organizationId: orgId, actorUserId: userId, action: "icon.upload", targetType: "icon", targetId: id, metadata: { name: safeName, bytes: result.svg.length } }, tx);
  });
  const [row] = await db().select().from(iconAssets).where(eq(iconAssets.id, id)).limit(1);
  return row!;
}

export async function readIconSvg(orgId: string, iconId: string): Promise<{ svg: string; asset: IconAsset }> {
  const [asset] = await db().select().from(iconAssets).where(and(eq(iconAssets.id, iconId), eq(iconAssets.organizationId, orgId))).limit(1);
  if (!asset) throw ApiError.notFound("icon");
  const bytes = await store().get(asset.storagePath);
  if (!bytes) throw ApiError.notFound("icon file");
  return { svg: new TextDecoder().decode(bytes), asset };
}

export async function deleteIcon(orgId: string, projectId: string, iconId: string, userId: string): Promise<void> {
  const [asset] = await db().select().from(iconAssets).where(and(eq(iconAssets.id, iconId), eq(iconAssets.organizationId, orgId), eq(iconAssets.projectId, projectId))).limit(1);
  if (!asset) throw ApiError.notFound("icon");
  await db().transaction(async (tx) => {
    await tx.delete(iconAssets).where(eq(iconAssets.id, iconId));
    await recordAudit({ organizationId: orgId, actorUserId: userId, action: "icon.delete", targetType: "icon", targetId: iconId, metadata: { name: asset.name } }, tx);
  });
  await store().delete(asset.storagePath).catch(() => {});
}
