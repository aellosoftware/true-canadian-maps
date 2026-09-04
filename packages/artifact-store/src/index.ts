export * from "./types";
export * from "./fs";
export * from "./s3";
import { FsArtifactStore } from "./fs";
import { S3ArtifactStore } from "./s3";
import type { ArtifactStore } from "./types";

/** Build a store from environment variables shared by the studio and worker. */
export function artifactStoreFromEnv(env: NodeJS.ProcessEnv = process.env): ArtifactStore {
  const kind = env.ARTIFACT_STORE ?? "fs";
  if (kind === "s3") {
    const need = (k: string): string => {
      const v = env[k];
      if (!v) throw new Error(`${k} is required when ARTIFACT_STORE=s3`);
      return v;
    };
    return new S3ArtifactStore({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: need("S3_BUCKET"),
      accessKeyId: need("S3_ACCESS_KEY"),
      secretAccessKey: need("S3_SECRET_KEY"),
      forcePathStyle: env.S3_FORCE_PATH_STYLE !== "false",
      prefix: env.S3_PREFIX,
    });
  }
  return new FsArtifactStore(env.ARTIFACT_FS_ROOT ?? "./.data/delivery");
}

export const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
export const CACHE_POINTER = "public, max-age=60, must-revalidate";
