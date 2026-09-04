import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { basemapVersions, members, organizations } from "@tcm/db";
import { StyleConfigSchema, type LayerOverrides } from "@tcm/style-compiler";
import { db } from "../db";
import { env } from "../env";
import { getSession } from "../session";
import { roleHasPermission } from "../authz";
import { getProject } from "./projects";
import { getStyle, styleEtag } from "./styles";
import type { Camera } from "../dto";

/** Everything the editor shell needs, resolved server-side with tenant checks. */
export async function loadEditorContext(orgSlug: string, projectId: string) {
  const session = await getSession(await headers());
  if (!session) redirect(`/login?next=/o/${orgSlug}/projects/${projectId}/style`);
  const rows = await db()
    .select({ id: organizations.id, slug: organizations.slug, name: organizations.name, role: members.role })
    .from(organizations)
    .innerJoin(members, and(eq(members.organizationId, organizations.id), eq(members.userId, session.user.id)))
    .where(eq(organizations.slug, orgSlug))
    .limit(1);
  const org = rows[0];
  if (!org) notFound();
  let project;
  try {
    project = await getProject(org.id, projectId);
  } catch {
    notFound();
  }
  const style = await getStyle(org.id, projectId);
  const basemap = project.basemapVersionId
    ? (await db().select().from(basemapVersions).where(eq(basemapVersions.id, project.basemapVersionId)).limit(1))[0]
    : (await db().select().from(basemapVersions).where(eq(basemapVersions.status, "available")).limit(1))[0];
  const maps = env().PUBLIC_MAPS_URL.replace(/\/$/, "");
  const basemapUrl = env().BASEMAP_URL ?? (basemap ? `${maps}/${basemap.pmtilesPath}` : `${maps}/base/missing.pmtiles`);
  return {
    session,
    org,
    project: { id: project.id, orgId: org.id, orgSlug: org.slug, name: project.name, slug: project.slug, camera: project.camera as Camera, role: org.role },
    doc: { config: StyleConfigSchema.parse(style.config), layerOverrides: (style.layerOverrides as LayerOverrides | null) ?? null },
    revision: style.revision,
    etag: styleEtag(style),
    targets: {
      basemapUrl,
      glyphsUrl: `${maps}/fonts/{fontstack}/{range}.pbf`,
      basemapSpriteBase: `${maps}/sprites/basemap/v4`,
      attribution: basemap?.attribution ?? "© OpenStreetMap contributors, Protomaps",
    },
    canEdit: roleHasPermission(org.role, { style: ["update"] }),
    basemap: basemap ?? null,
  };
}
