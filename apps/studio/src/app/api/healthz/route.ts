import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db().execute(sql`select 1`);
    return Response.json({ ok: true, version: env().TCM_VERSION }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "database unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
