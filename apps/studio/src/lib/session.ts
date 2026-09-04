import { and, eq } from "drizzle-orm";
import { ApiError } from "@tcm/shared";
import { members } from "@tcm/db";
import { auth, type Session } from "./auth";
import { db } from "./db";
import { roleHasPermission, type Permission } from "./authz";

export async function getSession(headers: Headers): Promise<Session | null> {
  return auth.api.getSession({ headers });
}

export async function requireSession(headers: Headers): Promise<Session> {
  const session = await getSession(headers);
  if (!session) throw ApiError.unauthorized();
  return session;
}

export interface Membership {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
}

/**
 * Service-layer tenant check. Every handler that touches organization data
 * resolves the caller's membership and required permission here.
 */
export async function requireMember(orgId: string, userId: string, permission?: Permission): Promise<Membership> {
  const rows = await db()
    .select({ id: members.id, organizationId: members.organizationId, userId: members.userId, role: members.role })
    .from(members)
    .where(and(eq(members.organizationId, orgId), eq(members.userId, userId)))
    .limit(1);
  const m = rows[0];
  if (!m) throw ApiError.notFound("organization");
  if (permission && !roleHasPermission(m.role, permission)) {
    throw ApiError.forbidden("your role does not permit this action");
  }
  return m;
}
