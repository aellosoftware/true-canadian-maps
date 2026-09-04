import { eq } from "drizzle-orm";
import { organizations } from "@tcm/db";
import { ApiError } from "@tcm/shared";
import { handle, json, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { UpdateOrganizationInput } from "@/lib/dto";
import { requireMember, requireSession } from "@/lib/session";
import { recordAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  const orgId = params.orgId!;
  const m = await requireMember(orgId, session.user.id);
  const [org] = await db().select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) throw ApiError.notFound("organization");
  return json({ organization: { id: org.id, name: org.name, slug: org.slug, logo: org.logo, createdAt: org.createdAt }, role: m.role });
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  const orgId = params.orgId!;
  await requireMember(orgId, session.user.id, { organization: ["update"] });
  const input = await parseBody(req, UpdateOrganizationInput);
  if (input.slug) {
    const clash = await db().select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, input.slug)).limit(1);
    if (clash[0] && clash[0].id !== orgId) throw new ApiError("conflict", "slug already in use");
  }
  await db().update(organizations).set({ ...input, updatedAt: new Date() }).where(eq(organizations.id, orgId));
  await recordAudit({ organizationId: orgId, actorUserId: session.user.id, action: "organization.update", targetType: "organization", targetId: orgId, metadata: { fields: Object.keys(input) } });
  const [org] = await db().select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  return json({ organization: org });
});
