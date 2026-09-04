/** One-shot: apply schema migrations (used by the compose `migrate` service). */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "@tcm/db";
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const here = path.dirname(fileURLToPath(import.meta.url));
// bundled: dist/migrations ; source: ../../packages/db/migrations
const folder = process.env.MIGRATIONS_DIR ?? ((await import("node:fs")).existsSync(path.join(here, "migrations")) ? path.join(here, "migrations") : path.resolve(here, "../../../packages/db/migrations"));
const { db, pool } = createDb(url, { max: 1 });
try {
  await migrate(db, { migrationsFolder: folder });
  console.log(`migrations applied from ${folder}`);
} finally {
  await pool.end();
}
