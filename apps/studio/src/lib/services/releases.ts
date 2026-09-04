import { and, desc, eq, sql } from "drizzle-orm";
import { ApiError, newId } from "@tcm/shared";
import { markers, projectEnvironments, releases, type Release } from "@tcm/db";
import { db } from "../db";
import { enqueuePointer, enqueuePublish } from "../queue";
import { getProject } from "./projects";
import { getStyle } from "./styles";
import { recordAudit } from "./audit";

export async function listReleases(orgId: string, projectId: string, limit = 50): Promise<Release[]> {
  await getProject(orgId, projectId);
  return db().select().from(releases).where(and(eq(releases.organizationId, orgId), eq(releases.projectId, projectId))).orderBy(desc(releases.number)).limit(limit);
}

export async function getRelease(orgId: string, projectId: string, releaseId: string): Promise<Release> {
  const [r] = await db().select().from(releases).where(and(eq(releases.organizationId, orgId), eq(releases.projectId, projectId), eq(releases.id, releaseId))).limit(1);
  if (!r) throw ApiError.notFound("release");
  return r;
}

export async function getEnvironments(orgId: string, projectId: string) {
  await getProject(orgId, projectId);
  return db().select().from(projectEnvironments).where(and(eq(projectEnvironments.organizationId, orgId), eq(projectEnvironments.projectId, projectId)));
}

/** Snapshot the draft and queue a build. One in-flight build per project. */
export async function requestPublish(orgId: string, projectId: string, userId: string, environment = "production", meta: { ip?: string | null; userAgent?: string | null } = {}): Promise<Release> {
  const project = await getProject(orgId, projectId);
  const style = await getStyle(orgId, projectId);
  const inflight = await db()
    .select({ id: releases.id })
    .from(releases)
    .where(and(eq(releases.projectId, projectId), sql`${releases.status} in ('queued','building')`))
    .limit(1);
  if (inflight[0]) throw new ApiError("conflict", "a publish is already in progress for this project", { releaseId: inflight[0].id });

  const [countRow] = await db().select({ n: sql<number>`count(*)::int` }).from(markers).where(and(eq(markers.projectId, projectId), eq(markers.visible, true)));
  const [numRow] = await db().select({ next: sql<number>`coalesce(max(number), 0)::int + 1` }).from(releases).where(eq(releases.projectId, projectId));
  const markerCount = countRow?.n ?? 0;
  const next = numRow?.next ?? 1;

  const id = newId("release");
  await db().transaction(async (tx) => {
    await tx.insert(releases).values({
      id,
      organizationId: orgId,
      projectId,
      environment,
      number: next,
      status: "queued",
      styleRevision: style.revision,
      styleConfigSnapshot: style.config,
      layerOverridesSnapshot: style.layerOverrides ?? null,
      markerCount,
      basemapVersionId: project.basemapVersionId,
      createdBy: userId,
    });
    await recordAudit({ organizationId: orgId, actorUserId: userId, action: "release.request", targetType: "release", targetId: id, metadata: { number: next, environment }, ...meta }, tx);
  });
  const jobId = await enqueuePublish({ releaseId: id, organizationId: orgId, projectId, requestedBy: userId });
  if (jobId) await db().update(releases).set({ jobId }).where(eq(releases.id, id));
  return getRelease(orgId, projectId, id);
}

/** Point an environment at an earlier published release. No rebuild. */
export async function rollback(orgId: string, projectId: string, userId: string, environment: string, releaseId: string, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  const target = await getRelease(orgId, projectId, releaseId);
  if (target.status !== "published" && target.status !== "superseded") throw new ApiError("conflict", `release is ${target.status}; only published releases can be restored`);
  const [envRow] = await db().select().from(projectEnvironments).where(and(eq(projectEnvironments.projectId, projectId), eq(projectEnvironments.name, environment))).limit(1);
  if (!envRow) throw ApiError.notFound("environment");
  if (envRow.currentReleaseId === releaseId) return envRow;
  await db().transaction(async (tx) => {
    await tx
      .update(projectEnvironments)
      .set({ previousReleaseId: envRow.currentReleaseId, currentReleaseId: releaseId, pointerUpdatedAt: new Date() })
      .where(eq(projectEnvironments.id, envRow.id));
    if (envRow.currentReleaseId) await tx.update(releases).set({ status: "superseded" }).where(and(eq(releases.id, envRow.currentReleaseId), eq(releases.status, "published")));
    await tx.update(releases).set({ status: "published" }).where(eq(releases.id, releaseId));
    await recordAudit({ organizationId: orgId, actorUserId: userId, action: "pointer.rollback", targetType: "release", targetId: releaseId, metadata: { environment, from: envRow.currentReleaseId }, ...meta }, tx);
  });
  await enqueuePointer({ organizationId: orgId, projectId, environment, releaseId });
  const [updated] = await db().select().from(projectEnvironments).where(eq(projectEnvironments.id, envRow.id)).limit(1);
  return updated!;
}
