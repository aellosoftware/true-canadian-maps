import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index";

export type Db = ReturnType<typeof createDb>["db"];
/** A database handle or an open transaction; services accept either. */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export function createDb(connectionString: string, opts: { max?: number } = {}) {
  const pool = new Pool({ connectionString, max: opts.max ?? 10 });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  return { db, pool, schema };
}

export { schema };
