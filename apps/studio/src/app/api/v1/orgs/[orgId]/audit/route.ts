import { desc, eq } from "drizzle-orm";
import { auditEvents } from "@tcm/db";
import { handle, json, parseQuery } from "@/lib/api";
import { db } from "@/lib/db";
import { PaginationQuery } from "@/lib/dto";
import { requireMember, requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { audit: ["read"] });
  const { limit, offset } = parseQuery(req, PaginationQuery);
  const events = await db()
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.organizationId, params.orgId!))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit)
    .offset(offset);
  return json({ events, limit, offset });
});
