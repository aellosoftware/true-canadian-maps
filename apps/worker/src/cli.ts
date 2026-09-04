/**
 * Admin CLI for headless installs.
 *   node dist/cli.js admin create-user --email a@b.c --password ... --name "Ada" [--org "My Org"]
 *   node dist/cli.js seed presets
 */
import { eq } from "drizzle-orm";
import { PRESETS } from "@tcm/style-compiler";
import { newId } from "@tcm/shared";
import { createDb, stylePresets } from "@tcm/db";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const [, , group, cmd] = process.argv;
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

if (group === "seed" && cmd === "presets") {
  const { db, pool } = createDb(url, { max: 1 });
  try {
    for (const p of PRESETS) {
      const existing = await db.select({ id: stylePresets.id }).from(stylePresets).where(eq(stylePresets.slug, p.slug)).limit(1);
      const values = { name: p.name, description: p.description, tags: p.tags, config: p.config as Record<string, unknown>, isPublic: true, featured: true };
      if (existing[0]) await db.update(stylePresets).set(values).where(eq(stylePresets.id, existing[0].id));
      else await db.insert(stylePresets).values({ id: newId("preset"), slug: p.slug, ...values });
    }
    console.log(`seeded ${PRESETS.length} presets`);
  } finally {
    await pool.end();
  }
} else if (group === "admin" && cmd === "create-user") {
  // Delegates to the studio's setup endpoint so password hashing and org creation follow one code path.
  const api = process.env.PUBLIC_API_URL?.replace(/\/$/, "");
  if (!api) throw new Error("PUBLIC_API_URL is required");
  const body = { name: arg("name") ?? "Administrator", email: arg("email"), password: arg("password"), organizationName: arg("org") ?? "My organization" };
  if (!body.email || !body.password) throw new Error("--email and --password are required");
  const res = await fetch(`${api}/v1/setup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  console.log(res.status, await res.text());
  if (!res.ok) process.exit(1);
} else {
  console.log("usage: cli <admin create-user | seed presets>");
  process.exit(2);
}
