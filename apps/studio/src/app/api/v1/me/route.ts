import { eq } from "drizzle-orm";
import { members, organizations } from "@tcm/db";
import { handle, json } from "@/lib/api";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const session = await requireSession(req.headers);
  const memberships = await db()
    .select({
      organizationId: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      logo: organizations.logo,
      role: members.role,
    })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(eq(members.userId, session.user.id));
  return json({
    user: { id: session.user.id, name: session.user.name, email: session.user.email, emailVerified: session.user.emailVerified, image: session.user.image },
    activeOrganizationId: (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null,
    organizations: memberships,
  });
});
