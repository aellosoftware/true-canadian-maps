import { createDb, schema, type Db } from "@tcm/db";
import { env } from "./env";

declare global {
  var __tcmDb: ReturnType<typeof createDb> | undefined;
}

function init() {
  if (!globalThis.__tcmDb) {
    globalThis.__tcmDb = createDb(env().DATABASE_URL, { max: 10 });
  }
  return globalThis.__tcmDb;
}

export function db(): Db {
  return init().db;
}

export function pool() {
  return init().pool;
}

export { schema };
