import { createDb } from "@tcm/db";
import { artifactStoreFromEnv } from "@tcm/artifact-store";
import { env } from "./env";

export function createContext() {
  const e = env();
  const { db, pool } = createDb(e.DATABASE_URL, { max: 5 });
  const store = artifactStoreFromEnv(process.env);
  return { env: e, db, pool, store };
}
export type WorkerContext = ReturnType<typeof createContext>;
