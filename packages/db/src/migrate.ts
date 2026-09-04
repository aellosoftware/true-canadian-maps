import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createDb } from "./client";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");
const { db, pool } = createDb(url, { max: 1 });
try {
  await migrate(db, { migrationsFolder });
  console.log(`migrations applied from ${migrationsFolder}`);
} finally {
  await pool.end();
}
