"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { ROLE_NAMES, type RoleName } from "@/lib/authz";

export interface MemberRow { id: string; role: string; user: { id: string; name: string; email: string } }
export interface InvitationRow { id: string; email: string; role: string | null; status: string; expiresAt: string }

export function MembersPanel({ orgId, members, invitations, myUserId, canManage }: { orgId: string; members: MemberRow[]; invitations: InvitationRow[]; myUserId: string; canManage: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function act(fn: () => Promise<{ error?: { message?: string } | null } | unknown>, okMsg: string) {
    setPending(true); setError(null); setNotice(null);
    try {
      const res = (await fn()) as { error?: { message?: string } | null } | undefined;
      if (res && res.error) setError(res.error.message ?? "Something went wrong");
      else { setNotice(okMsg); window.location.reload(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setPending(false); }
  }
  function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void act(() => authClient.organization.inviteMember({ organizationId: orgId, email: String(f.get("email")), role: String(f.get("role")) as RoleName }), "Invitation sent");
  }

  return (
    <div className="space-y-6">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <Card>
        <h2 className="text-lg font-bold">Members</h2>
        <table className="mt-3 w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-muted"><th className="py-1">Name</th><th>Email</th><th>Role</th><th /></tr></thead>
          <tbody className="divide-y divide-line">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="py-2 font-semibold text-navy">{m.user.name}{m.user.id === myUserId ? <span className="ml-1 text-xs text-muted">(you)</span> : null}</td>
                <td className="text-body">{m.user.email}</td>
                <td>
                  {canManage && m.user.id !== myUserId ? (
                    <select defaultValue={m.role} disabled={pending} onChange={(e) => void act(() => authClient.organization.updateMemberRole({ organizationId: orgId, memberId: m.id, role: e.target.value as RoleName }), "Role updated")} className="rounded border border-line px-2 py-1 text-xs">
                      {ROLE_NAMES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : <span className="rounded-full bg-pale-navy px-2 py-0.5 text-xs font-semibold text-navy">{m.role}</span>}
                </td>
                <td className="text-right">
                  {canManage && m.user.id !== myUserId ? <button type="button" disabled={pending} onClick={() => confirm(`Remove ${m.user.email}?`) && void act(() => authClient.organization.removeMember({ organizationId: orgId, memberIdOrEmail: m.id }), "Member removed")} className="text-xs text-red hover:underline">Remove</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {canManage ? (
        <Card>
          <h2 className="text-lg font-bold">Invite someone</h2>
          <form onSubmit={invite} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Field label="Email" htmlFor="invite-email"><Input id="invite-email" name="email" type="email" required /></Field>
            <Field label="Role" htmlFor="invite-role">
              <select id="invite-role" name="role" defaultValue="editor" className="rounded-md border border-line bg-white px-3 py-2 text-sm">{ROLE_NAMES.filter((r) => r !== "owner").map((r) => <option key={r} value={r}>{r}</option>)}</select>
            </Field>
            <Button type="submit" disabled={pending}>Send invitation</Button>
          </form>
          <p className="mt-2 text-xs text-muted">Roles: <strong>admin</strong> manages members and keys · <strong>editor</strong> builds and publishes maps · <strong>viewer</strong> is read-only.</p>
          {invitations.length > 0 ? (
            <ul className="mt-4 divide-y divide-line text-sm">
              {invitations.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2">
                  <span>{i.email} <span className="text-xs text-muted">· {i.role} · expires {new Date(i.expiresAt).toLocaleDateString("en-CA")}</span></span>
                  <button type="button" disabled={pending} onClick={() => void act(() => authClient.organization.cancelInvitation({ invitationId: i.id }), "Invitation cancelled")} className="text-xs text-red hover:underline">Cancel</button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
