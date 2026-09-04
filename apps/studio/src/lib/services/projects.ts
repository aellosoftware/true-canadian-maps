import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { ApiError, newId } from "@tcm/shared";
import { basemapVersions, projectEnvironments, projects, stylePresets, styles, type Project } from "@tcm/db";
import { defaultConfig, type StyleConfig } from "@tcm/style-compiler";
import { db } from "../db";
import { DEFAULT_CAMERA, type CreateProjectInput, type UpdateProjectInput } from "../dto";
import { uniqueSlug } from "../slug";
import { recordAudit } from "./audit";

export const ENVIRONMENTS = ["draft", "production"] as const;

export async function listProjects(orgId: string): Promise<Project[]> {
  return db().select().from(projects).where(eq(projects.organizationId, orgId)).orderBy(desc(projects.updatedAt));
}

export async function getProject(orgId: string, projectId: string): Promise<Project> {
  const rows = await db()
    .select()
    .from(projects)
    .where(and(eq(projects.organizationId, orgId), eq(projects.id, projectId)))
    .limit(1);
  const p = rows[0];
  if (!p) throw ApiError.notFound("project");
  return p;
}

async function slugExists(orgId: string, slug: string): Promise<boolean> {
  const rows = await db()
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.organizationId, orgId), eq(projects.slug, slug)))
    .limit(1);
  return rows.length > 0;
}

export async function createProject(
  orgId: string,
  userId: string,
  input: z.infer<typeof CreateProjectInput>,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<Project> {
  const slug = input.slug
    ? (await slugExists(orgId, input.slug)) ? (() => { throw new ApiError("conflict", "slug already in use"); })() : input.slug
    : await uniqueSlug(input.name, (c) => slugExists(orgId, c));

  const basemap = await db()
    .select({ id: basemapVersions.id })
    .from(basemapVersions)
    .where(eq(basemapVersions.status, "available"))
    .orderBy(desc(basemapVersions.createdAt))
    .limit(1);

  let styleConfig: Record<string, unknown> = defaultConfig("light") as unknown as Record<string, unknown>;
  let presetId: string | null = null;
  if (input.presetSlug) {
    const preset = await db().select().from(stylePresets).where(eq(stylePresets.slug, input.presetSlug)).limit(1);
    const p = preset[0];
    if (!p) throw ApiError.notFound("preset");
    if (p.organizationId && p.organizationId !== orgId && !p.isPublic) throw ApiError.notFound("preset");
    styleConfig = p.config as unknown as StyleConfig as unknown as Record<string, unknown>;
    presetId = p.id;
  }

  const id = newId("project");
  await db().transaction(async (tx) => {
    await tx.insert(projects).values({
      id,
      organizationId: orgId,
      slug,
      name: input.name,
      description: input.description ?? null,
      template: input.template,
      defaultLocale: input.defaultLocale,
      basemapVersionId: basemap[0]?.id ?? null,
      camera: input.camera ?? DEFAULT_CAMERA,
      createdBy: userId,
    });
    await tx.insert(projectEnvironments).values(
      ENVIRONMENTS.map((name) => ({ id: newId("environment"), organizationId: orgId, projectId: id, name })),
    );
    await tx.insert(styles).values({
      id: newId("style"),
      organizationId: orgId,
      projectId: id,
      config: styleConfig,
      presetId,
      updatedBy: userId,
    });
    await recordAudit(
      { organizationId: orgId, actorUserId: userId, action: "project.create", targetType: "project", targetId: id, metadata: { slug, template: input.template }, ...meta },
      tx,
    );
  });
  return getProject(orgId, id);
}

export async function updateProject(
  orgId: string,
  projectId: string,
  userId: string,
  input: z.infer<typeof UpdateProjectInput>,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<Project> {
  await getProject(orgId, projectId);
  if (input.slug && (await slugExists(orgId, input.slug))) {
    const current = await getProject(orgId, projectId);
    if (current.slug !== input.slug) throw new ApiError("conflict", "slug already in use");
  }
  await db().transaction(async (tx) => {
    await tx
      .update(projects)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(projects.organizationId, orgId), eq(projects.id, projectId)));
    await recordAudit(
      { organizationId: orgId, actorUserId: userId, action: "project.update", targetType: "project", targetId: projectId, metadata: { fields: Object.keys(input) }, ...meta },
      tx,
    );
  });
  return getProject(orgId, projectId);
}

export async function deleteProject(orgId: string, projectId: string, userId: string, meta: { ip?: string | null; userAgent?: string | null } = {}): Promise<void> {
  const p = await getProject(orgId, projectId);
  await db().transaction(async (tx) => {
    await tx.delete(projects).where(and(eq(projects.organizationId, orgId), eq(projects.id, projectId)));
    await recordAudit(
      { organizationId: orgId, actorUserId: userId, action: "project.delete", targetType: "project", targetId: projectId, metadata: { slug: p.slug, name: p.name }, ...meta },
      tx,
    );
  });
}
