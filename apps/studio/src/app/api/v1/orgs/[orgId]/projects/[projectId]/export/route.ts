import { zipSync, strToU8 } from "fflate";
import { artifactStoreFromEnv } from "@tcm/artifact-store";
import { handle } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { getProject } from "@/lib/services/projects";
import { getStyle } from "@/lib/services/styles";
import { listMarkers, markersGeoJSON } from "@/lib/services/markers";
import { listIcons } from "@/lib/services/icons";
import { listReleases } from "@/lib/services/releases";
import { recordAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

/**
 * Portability export: everything needed to move a map to another installation.
 * Zip of project.json, style-config.json, markers.geojson, markers.json, icons/*.svg and the manifests of published releases.
 */
export const GET = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { project: ["read"] });
  const orgId = params.orgId!, projectId = params.projectId!;
  const [project, style, markers, geojson, icons, releases] = await Promise.all([
    getProject(orgId, projectId), getStyle(orgId, projectId), listMarkers(orgId, projectId), markersGeoJSON(orgId, projectId), listIcons(orgId, projectId), listReleases(orgId, projectId, 200),
  ]);
  const store = artifactStoreFromEnv(process.env);
  const files: Record<string, Uint8Array> = {
    "project.json": strToU8(JSON.stringify({ schema: "tcm.export/1", exportedAt: new Date().toISOString(), project: { id: project.id, slug: project.slug, name: project.name, description: project.description, template: project.template, defaultLocale: project.defaultLocale, camera: project.camera } }, null, 2)),
    "style-config.json": strToU8(JSON.stringify(style.config, null, 2)),
    ...(style.layerOverrides ? { "layer-overrides.json": strToU8(JSON.stringify(style.layerOverrides, null, 2)) } : {}),
    "markers.json": strToU8(JSON.stringify(markers, null, 2)),
    "markers.geojson": strToU8(JSON.stringify(geojson)),
    "README.txt": strToU8("True Canadian Maps export. style-config.json + markers.json can be imported into any installation; releases/*.json describe published builds (artifact URLs point at the source installation).\n"),
  };
  for (const icon of icons) {
    const bytes = await store.get(icon.storagePath);
    if (bytes) files[`icons/${icon.id}-${icon.name}.svg`] = bytes;
  }
  for (const r of releases) if (r.manifest) files[`releases/${String(r.number).padStart(4, "0")}-${r.id}.json`] = strToU8(JSON.stringify(r.manifest, null, 2));
  const zip = zipSync(files, { level: 6 });
  await recordAudit({ organizationId: orgId, actorUserId: session.user.id, action: "project.export", targetType: "project", targetId: projectId, metadata: { files: Object.keys(files).length } });
  return new Response(zip as unknown as BodyInit, { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${project.slug}-export.zip"`, "cache-control": "no-store" } });
});
