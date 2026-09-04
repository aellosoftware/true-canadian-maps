import { and, eq } from "drizzle-orm";
import { ApiError, PUBLIC_KEY_PATTERN, originMatches, type ReleaseManifest } from "@tcm/shared";
import { apiKeys, projectEnvironments, projects, releases } from "@tcm/db";
import { db } from "../db";

export interface EmbedConfig {
  projectId: string;
  environment: string;
  releaseId: string;
  styleUrl: string;
  markersUrl: string;
  spriteUrl: string;
  manifestUrl: string;
  camera: unknown;
  locale: string;
  attribution: string;
  markerCount: number;
  config: { cluster: boolean; showTitles: boolean };
}

/**
 * Public, key-gated configuration the embed fetches first. Authoritative (reads the DB, not the pointer file).
 * The route resolves both cross-origin and same-origin browser requests to a concrete
 * origin. A non-matching origin is rejected; the static artifacts stay public by design.
 */
export async function resolveEmbedConfig(input: { projectId: string; environment: string; key: string; origin: string | null }): Promise<{ config: EmbedConfig; origin: string }> {
  if (!PUBLIC_KEY_PATTERN.test(input.key)) throw ApiError.forbidden("invalid key");
  const [key] = await db().select().from(apiKeys).where(and(eq(apiKeys.publicKey, input.key), eq(apiKeys.projectId, input.projectId))).limit(1);
  if (!key || key.status !== "active" || key.kind !== "public") throw ApiError.forbidden("key is not valid for this project");
  if (key.expiresAt && key.expiresAt < new Date()) throw ApiError.forbidden("key has expired");
  if (!key.environments.includes(input.environment)) throw ApiError.forbidden("key is not valid for this environment");
  if (!originMatches(input.origin, key.allowedOrigins)) throw ApiError.forbidden("origin not allowed for this key");

  const [env] = await db().select().from(projectEnvironments).where(and(eq(projectEnvironments.projectId, input.projectId), eq(projectEnvironments.name, input.environment))).limit(1);
  if (!env?.currentReleaseId) throw ApiError.notFound("no published release");
  const [rel] = await db().select().from(releases).where(eq(releases.id, env.currentReleaseId)).limit(1);
  const manifest = rel?.manifest as ReleaseManifest | null | undefined;
  if (!rel || !manifest) throw ApiError.notFound("no published release");
  const [project] = await db().select().from(projects).where(eq(projects.id, input.projectId)).limit(1);
  if (!project) throw ApiError.notFound("project");
  const snapshot = rel.styleConfigSnapshot as { markers?: { cluster?: boolean; showTitles?: boolean } };

  void db().update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id)).catch(() => {});

  return {
    origin: input.origin!,
    config: {
      projectId: project.id,
      environment: input.environment,
      releaseId: rel.id,
      styleUrl: manifest.urls.style,
      markersUrl: manifest.urls.markers,
      spriteUrl: manifest.urls.sprite,
      manifestUrl: manifest.urls.manifest,
      camera: project.camera,
      locale: project.defaultLocale,
      attribution: manifest.attribution,
      markerCount: manifest.marker_count,
      config: { cluster: snapshot.markers?.cluster ?? false, showTitles: snapshot.markers?.showTitles ?? false },
    },
  };
}
