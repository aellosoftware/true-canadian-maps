import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { invitations, organizations } from "@tcm/db";
import { AcceptInvitation } from "@/components/auth/AuthForms";
import { Alert, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ invitationId: string }> }) {
  const { invitationId } = await params;
  const rows = await db()
    .select({ id: invitations.id, email: invitations.email, role: invitations.role, status: invitations.status, expiresAt: invitations.expiresAt, orgName: organizations.name })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .where(eq(invitations.id, invitationId))
    .limit(1);
  const inv = rows[0];
  if (!inv || inv.status !== "pending" || inv.expiresAt < new Date()) {
    return (
      <Card>
        <h1 className="mb-2 text-2xl font-bold">Invitation unavailable</h1>
        <Alert tone="error">This invitation has expired, was cancelled, or was already used.</Alert>
      </Card>
    );
  }
  const session = await getSession(await headers());
  if (!session) redirect(`/signup?invitation=${encodeURIComponent(invitationId)}`);
  return <AcceptInvitation invitationId={inv.id} organizationName={inv.orgName} role={inv.role ?? "viewer"} email={inv.email} />;
}
