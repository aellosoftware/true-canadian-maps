import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { members, organizations } from "@tcm/db";
import Link from "next/link";
import { Card } from "@/components/ui";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { listProjects } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export default async function OrgDashboard({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const session = await getSession(await headers());
  if (!session) redirect(`/login?next=/o/${orgSlug}`);
  const rows = await db()
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, role: members.role })
    .from(organizations)
    .innerJoin(members, and(eq(members.organizationId, organizations.id), eq(members.userId, session.user.id)))
    .where(eq(organizations.slug, orgSlug))
    .limit(1);
  const org = rows[0];
  if (!org) notFound();
  const projects = await listProjects(org.id);
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-red">{org.name}</p>
          <h1 className="text-3xl font-bold">Maps</h1>
          <p className="mt-1 text-sm text-muted">Create, style and publish maps for your organization.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Link href="/gallery" className="rounded-md px-3 py-2 text-sm font-semibold text-navy hover:bg-pale-navy">Gallery</Link>
          <Link href={`/o/${orgSlug}/settings`} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-pale-navy">Team</Link>
          <AccountMenu email={session.user.email} role={org.role} />
          <Link href={`/o/${orgSlug}/projects/new`} className="ml-auto rounded-md bg-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-dark sm:ml-0">New map</Link>
        </div>
      </header>
      {projects.length === 0 ? (
        <Card>
          <h2 className="text-lg font-bold">No maps yet</h2>
          <p className="mt-1 text-sm text-muted">Create your first map to start styling it.</p>
          <Link href={`/o/${orgSlug}/projects/new`} className="mt-3 inline-block rounded-md bg-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-dark">New map</Link>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Card>
                <h2 className="text-lg font-bold"><Link href={`/o/${orgSlug}/projects/${p.id}/style`} className="hover:text-red">{p.name}</Link></h2>
                <p className="text-xs text-muted">/{p.slug} · {p.template} · updated {p.updatedAt.toLocaleDateString("en-CA")}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
