import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { members, organizations } from "@tcm/db";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { roleHasPermission } from "@/lib/authz";
import { NewProjectForm } from "./NewProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const session = await getSession(await headers());
  if (!session) redirect(`/login?next=/o/${orgSlug}/projects/new`);
  const rows = await db()
    .select({ id: organizations.id, role: members.role })
    .from(organizations)
    .innerJoin(members, and(eq(members.organizationId, organizations.id), eq(members.userId, session.user.id)))
    .where(eq(organizations.slug, orgSlug))
    .limit(1);
  const org = rows[0];
  if (!org) notFound();
  if (!roleHasPermission(org.role, { project: ["create"] })) redirect(`/o/${orgSlug}`);
  return (
    <main className="mx-auto max-w-5xl p-8">
      <NewProjectForm orgId={org.id} orgSlug={orgSlug} />
    </main>
  );
}
