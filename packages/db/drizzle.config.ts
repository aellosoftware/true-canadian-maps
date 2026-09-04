import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  casing: "snake_case",
  extensionsFilters: ["postgis"],
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://tcm@127.0.0.1:5433/tcm_dev" },
  strict: true,
  verbose: true,
});
