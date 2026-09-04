import { eq } from "drizzle-orm";
import { members, organizations } from "@tcm/db";
import { handle, json, parseBody } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreateOrganizationInput } from "@/lib/dto";
import { requireSession } from "@/lib/session";
import { recordAudit } from "@/lib/services/audit";
import { slugify, uniqueSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const session = await requireSession(req.headers);
  const rows = await db()
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, logo: organizations.logo, role: members.role, createdAt: organizations.createdAt })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(eq(members.userId, session.user.id));
  return json({ organizations: rows });
});

export const POST = handle(async (req) => {
  const session = await requireSession(req.headers);
  const input = await parseBody(req, CreateOrganizationInput);
  const slug = input.slug ?? (await uniqueSlug(input.name, async (c) => (await db().select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, c)).limit(1)).length > 0));
  const org = await auth.api.createOrganization({ headers: req.headers, body: { name: input.name, slug: slugify(slug) } });
  if (!org) throw new Error("organization creation failed");
  await recordAudit({ organizationId: org.id, actorUserId: session.user.id, action: "organization.create", targetType: "organization", targetId: org.id, metadata: { slug: org.slug } });
  return json({ organization: { id: org.id, name: org.name, slug: org.slug, logo: org.logo ?? null } }, { status: 201 });
});
