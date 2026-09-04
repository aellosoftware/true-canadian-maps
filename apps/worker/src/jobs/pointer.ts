import { and, eq } from "drizzle-orm";
import { CACHE_POINTER } from "@tcm/artifact-store";
import { projectEnvironments, releases } from "@tcm/db";
import { artifactKeys, deliveryUrl, type EnvironmentPointer, type ReleaseManifest } from "@tcm/shared";
import type { WorkerContext } from "../context";

/** Rewrite p/{project}/{env}.json from the environment's current release (used by publish and rollback). */
export async function writePointer(ctx: WorkerContext, projectId: string, environment: string): Promise<EnvironmentPointer | null> {
  const [envRow] = await ctx.db.select().from(projectEnvironments).where(and(eq(projectEnvironments.projectId, projectId), eq(projectEnvironments.name, environment))).limit(1);
  if (!envRow?.currentReleaseId) return null;
  const [rel] = await ctx.db.select().from(releases).where(eq(releases.id, envRow.currentReleaseId)).limit(1);
  const manifest = rel?.manifest as ReleaseManifest | null | undefined;
  if (!rel || !manifest) return null;
  const pointer: EnvironmentPointer = {
    schema: "tcm.pointer/1",
    project_id: projectId,
    environment,
    release_id: rel.id,
    manifest_url: manifest.urls.manifest,
    style_url: manifest.urls.style,
    markers_url: manifest.urls.markers,
    sprite_url: manifest.urls.sprite,
    updated_at: new Date().toISOString(),
  };
  await ctx.store.put(artifactKeys.pointer(projectId, environment), JSON.stringify(pointer), { contentType: "application/json", cacheControl: CACHE_POINTER, ifNoneMatch: false });
  void deliveryUrl;
  return pointer;
}
