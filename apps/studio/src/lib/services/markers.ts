import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { ApiError, newId } from "@tcm/shared";
import { markers, type Marker } from "@tcm/db";
import { MarkerInputSchema, markersToGeoJSON, type MarkerFeatureCollection, type MarkerRecord } from "@tcm/style-compiler";
import { db } from "../db";
import { getProject } from "./projects";
import { recordAudit } from "./audit";

export const MAX_MARKERS_PER_PROJECT = 5000;

export const UpdateMarkerInput = MarkerInputSchema.partial();
export const BulkMarkersInput = z.object({
  markers: z.array(MarkerInputSchema).min(1).max(MAX_MARKERS_PER_PROJECT),
  /** replace = delete existing markers first; append = keep them */
  mode: z.enum(["append", "replace"]).default("append"),
});

export function toRecord(m: Marker): MarkerRecord {
  return {
    id: m.id,
    externalId: m.externalId,
    title: m.title,
    lng: m.location.x,
    lat: m.location.y,
    description: m.description,
    link: m.link ?? null,
    imageUrl: m.imageUrl,
    icon: m.icon,
    color: m.color,
    category: m.category,
    properties: m.properties,
    sortOrder: m.sortOrder,
    visible: m.visible,
  };
}

export async function listMarkers(orgId: string, projectId: string): Promise<MarkerRecord[]> {
  await getProject(orgId, projectId);
  const rows = await db()
    .select()
    .from(markers)
    .where(and(eq(markers.organizationId, orgId), eq(markers.projectId, projectId)))
    .orderBy(asc(markers.sortOrder), asc(markers.id));
  return rows.map(toRecord);
}

export async function markersGeoJSON(orgId: string, projectId: string): Promise<MarkerFeatureCollection> {
  return markersToGeoJSON(await listMarkers(orgId, projectId));
}

async function countMarkers(projectId: string): Promise<number> {
  const [row] = await db().select({ n: sql<number>`count(*)::int` }).from(markers).where(eq(markers.projectId, projectId));
  return row?.n ?? 0;
}

function toRow(orgId: string, projectId: string, input: z.infer<typeof MarkerInputSchema>, id = newId("marker")) {
  return {
    id,
    organizationId: orgId,
    projectId,
    externalId: input.externalId ?? null,
    title: input.title,
    location: { x: input.lng, y: input.lat },
    description: input.description ?? null,
    link: input.link ?? null,
    imageUrl: input.imageUrl ?? null,
    icon: input.icon,
    color: input.color,
    category: input.category ?? null,
    properties: input.properties,
    sortOrder: input.sortOrder,
    visible: input.visible,
  };
}

export async function createMarker(orgId: string, projectId: string, userId: string, input: z.infer<typeof MarkerInputSchema>): Promise<MarkerRecord> {
  await getProject(orgId, projectId);
  if ((await countMarkers(projectId)) >= MAX_MARKERS_PER_PROJECT) throw new ApiError("conflict", `a project may hold at most ${MAX_MARKERS_PER_PROJECT} markers`);
  const row = toRow(orgId, projectId, input);
  if (input.sortOrder === 0) {
    const [mx] = await db().select({ m: sql<number>`coalesce(max(sort_order), -1)::int` }).from(markers).where(eq(markers.projectId, projectId));
    row.sortOrder = (mx?.m ?? -1) + 1;
  }
  await db().transaction(async (tx) => {
    await tx.insert(markers).values(row);
    await recordAudit({ organizationId: orgId, actorUserId: userId, action: "marker.create", targetType: "marker", targetId: row.id, metadata: { projectId, title: input.title } }, tx);
  });
  const [m] = await db().select().from(markers).where(eq(markers.id, row.id)).limit(1);
  return toRecord(m!);
}

export async function updateMarker(orgId: string, projectId: string, markerId: string, userId: string, input: z.infer<typeof UpdateMarkerInput>): Promise<MarkerRecord> {
  const [existing] = await db().select().from(markers).where(and(eq(markers.organizationId, orgId), eq(markers.projectId, projectId), eq(markers.id, markerId))).limit(1);
  if (!existing) throw ApiError.notFound("marker");
  const patch: Partial<typeof markers.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.externalId !== undefined) patch.externalId = input.externalId;
  if (input.description !== undefined) patch.description = input.description;
  if (input.link !== undefined) patch.link = input.link;
  if (input.imageUrl !== undefined) patch.imageUrl = input.imageUrl;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.color !== undefined) patch.color = input.color;
  if (input.category !== undefined) patch.category = input.category;
  if (input.properties !== undefined) patch.properties = input.properties;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
  if (input.visible !== undefined) patch.visible = input.visible;
  if (input.lng !== undefined || input.lat !== undefined) patch.location = { x: input.lng ?? existing.location.x, y: input.lat ?? existing.location.y };
  await db().update(markers).set(patch).where(eq(markers.id, markerId));
  const [m] = await db().select().from(markers).where(eq(markers.id, markerId)).limit(1);
  return toRecord(m!);
}

export async function deleteMarkers(orgId: string, projectId: string, userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db()
    .delete(markers)
    .where(and(eq(markers.organizationId, orgId), eq(markers.projectId, projectId), inArray(markers.id, ids)))
    .returning({ id: markers.id });
  if (rows.length) await recordAudit({ organizationId: orgId, actorUserId: userId, action: "marker.delete", targetType: "project", targetId: projectId, metadata: { count: rows.length } });
  return rows.length;
}

export async function bulkUpsertMarkers(orgId: string, projectId: string, userId: string, input: z.infer<typeof BulkMarkersInput>): Promise<{ created: number; replaced: number }> {
  await getProject(orgId, projectId);
  const existing = input.mode === "replace" ? 0 : await countMarkers(projectId);
  if (existing + input.markers.length > MAX_MARKERS_PER_PROJECT) {
    throw new ApiError("payload_too_large", `import would exceed ${MAX_MARKERS_PER_PROJECT} markers (currently ${existing})`);
  }
  let replaced = 0;
  await db().transaction(async (tx) => {
    if (input.mode === "replace") {
      const gone = await tx.delete(markers).where(and(eq(markers.organizationId, orgId), eq(markers.projectId, projectId))).returning({ id: markers.id });
      replaced = gone.length;
    }
    const [mx] = await tx.select({ m: sql<number>`coalesce(max(sort_order), -1)::int` }).from(markers).where(eq(markers.projectId, projectId));
    let next = (mx?.m ?? -1) + 1;
    const rows = input.markers.map((m) => {
      const r = toRow(orgId, projectId, m);
      if (m.sortOrder === 0) r.sortOrder = next++;
      return r;
    });
    for (let i = 0; i < rows.length; i += 500) await tx.insert(markers).values(rows.slice(i, i + 500));
    await recordAudit({ organizationId: orgId, actorUserId: userId, action: "marker.import", targetType: "project", targetId: projectId, metadata: { count: rows.length, mode: input.mode, replaced } }, tx);
  });
  return { created: input.markers.length, replaced };
}
