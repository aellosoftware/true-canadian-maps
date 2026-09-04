import { z } from "zod";

const Schema = z.object({
  DATABASE_URL: z.string().min(1),
  PUBLIC_MAPS_URL: z.string().url(),
  PUBLIC_API_URL: z.string().url().optional(),
  ARTIFACT_STORE: z.enum(["fs", "s3"]).default("fs"),
  ARTIFACT_FS_ROOT: z.string().default("./.data/delivery"),
  BASEMAP_URL: z.string().optional(),
  LOG_LEVEL: z.string().default("info"),
  TCM_VERSION: z.string().default("dev"),
  WORKER_HEARTBEAT_FILE: z.string().default("/tmp/tcm-worker-heartbeat"),
});
export type WorkerEnv = z.infer<typeof Schema>;

let cached: WorkerEnv | null = null;
export function env(): WorkerEnv {
  if (cached) return cached;
  const r = Schema.safeParse(process.env);
  if (!r.success) throw new Error(`worker env invalid:\n${r.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  cached = r.data;
  return cached;
}
