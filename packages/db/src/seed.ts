/** Seed platform style presets (idempotent). */
import { eq } from "drizzle-orm";
import { PRESETS } from "@tcm/style-compiler";
import { newId } from "@tcm/shared";
import { createDb } from "./client";
import { stylePresets } from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const { db, pool } = createDb(url, { max: 1 });
try {
  for (const p of PRESETS) {
    const existing = await db.select({ id: stylePresets.id }).from(stylePresets).where(eq(stylePresets.slug, p.slug)).limit(1);
    const values = { name: p.name, description: p.description, tags: p.tags, config: p.config as Record<string, unknown>, isPublic: true, featured: true, organizationId: null };
    if (existing[0]) {
      await db.update(stylePresets).set({ ...values, updatedAt: new Date() }).where(eq(stylePresets.id, existing[0].id));
    } else {
      await db.insert(stylePresets).values({ id: newId("preset"), slug: p.slug, ...values });
    }
  }
  console.log(`seeded ${PRESETS.length} platform presets`);
} finally {
  await pool.end();
}
