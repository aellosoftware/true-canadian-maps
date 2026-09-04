import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { invitations, members, organizations, users } from "@tcm/db";
import { MembersPanel } from "@/features/org/MembersPanel";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { roleHasPermission } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function OrgSettingsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const session = await getSession(await headers());
  if (!session) redirect(`/login?next=/o/${orgSlug}/settings`);
  const rows = await db().select({ id: organizations.id, name: organizations.name, role: members.role }).from(organizations)
    .innerJoin(members, and(eq(members.organizationId, organizations.id), eq(members.userId, session.user.id))).where(eq(organizations.slug, orgSlug)).limit(1);
  const org = rows[0];
  if (!org) notFound();
  const memberRows = await db().select({ id: members.id, role: members.role, userId: users.id, name: users.name, email: users.email }).from(members).innerJoin(users, eq(users.id, members.userId)).where(eq(members.organizationId, org.id));
  const pending = await db().select().from(invitations).where(and(eq(invitations.organizationId, org.id), eq(invitations.status, "pending")));
  const canManage = roleHasPermission(org.role, { member: ["create"] });
  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="mb-6">
        <Link href={`/o/${orgSlug}`} className="text-sm text-muted hover:text-navy">← Maps</Link>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-red">{org.name}</p>
        <h1 className="text-3xl font-bold">Team</h1>
      </header>
      <MembersPanel
        orgId={org.id}
        myUserId={session.user.id}
        canManage={canManage}
        members={memberRows.map((m) => ({ id: m.id, role: m.role, user: { id: m.userId, name: m.name, email: m.email } }))}
        invitations={pending.map((i) => ({ id: i.id, email: i.email, role: i.role, status: i.status, expiresAt: i.expiresAt.toISOString() }))}
      />
    </main>
  );
}
