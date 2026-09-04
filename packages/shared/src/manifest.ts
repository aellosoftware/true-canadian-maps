import { z } from "zod";

export const ReleaseManifestSchema = z.object({
  schema: z.literal("tcm.release/1"),
  release_id: z.string(),
  organization_id: z.string(),
  project_id: z.string(),
  number: z.number().int().positive(),
  environment: z.string(),
  basemap_version: z.string(),
  tileset_schema: z.number().int(),
  style_revision: z.number().int(),
  style_hash: z.string(),
  compiler_version: z.string(),
  basemaps_version: z.string(),
  artifacts: z.record(z.string(), z.string()),
  urls: z.object({
    style: z.string().url(),
    markers: z.string().url(),
    sprite: z.string().url(),
    manifest: z.string().url(),
  }),
  checksums: z.record(z.string(), z.string()),
  marker_count: z.number().int().nonnegative(),
  attribution: z.string(),
  published_at: z.string(),
  created_by: z.string(),
});
export type ReleaseManifest = z.infer<typeof ReleaseManifestSchema>;

/** Short-TTL environment pointer written next to each publish. */
export const EnvironmentPointerSchema = z.object({
  schema: z.literal("tcm.pointer/1"),
  project_id: z.string(),
  environment: z.string(),
  release_id: z.string(),
  manifest_url: z.string().url(),
  style_url: z.string().url(),
  markers_url: z.string().url(),
  sprite_url: z.string().url(),
  updated_at: z.string(),
});
export type EnvironmentPointer = z.infer<typeof EnvironmentPointerSchema>;
