import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { members, organizations } from "@tcm/db";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { needsSetup } from "@/lib/services/setup";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (await needsSetup()) redirect("/setup");
  const session = await getSession(await headers());
  if (!session) redirect("/login");
  const active = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;
  const rows = await db()
    .select({ id: organizations.id, slug: organizations.slug })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(eq(members.userId, session.user.id));
  if (rows.length === 0) redirect("/onboarding");
  const target = rows.find((r) => r.id === active) ?? rows[0]!;
  redirect(`/o/${target.slug}`);
}
