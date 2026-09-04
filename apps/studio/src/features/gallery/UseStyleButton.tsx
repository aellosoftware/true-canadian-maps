"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { useApi } from "@/components/ConfigProvider";

interface Me { organizations: Array<{ organizationId: string; slug: string; name: string }> }
interface Project { id: string; name: string }

export function UseStyleButton({ slug, name }: { slug: string; name: string }) {
  const api = useApi();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [open, setOpen] = useState(searchParams.get("apply") === "1");
  const [orgId, setOrgId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api<Me>("/me").then(({ data }) => { setMe(data); setOrgId(data.organizations[0]?.organizationId ?? ""); }).catch(() => setMe(null)); }, [api]);
  useEffect(() => { if (!orgId) return; api<{ projects: Project[] }>(`/orgs/${orgId}/projects`).then(({ data }) => setProjects(data.projects)).catch(() => setProjects([])); }, [api, orgId]);

  async function apply() {
    setBusy(true); setError(null);
    try {
      const org = me?.organizations.find((o) => o.organizationId === orgId);
      if (!org) throw new Error("choose an organization");
      let pid = projectId;
      if (pid === "new") {
        const { data } = await api<{ project: { id: string } }>(`/orgs/${orgId}/projects`, { method: "POST", json: { name: `${name} map`, presetSlug: slug } });
        pid = data.project.id;
      } else {
        await api(`/orgs/${orgId}/projects/${pid}/style/apply-gallery`, { method: "POST", json: { slug } });
      }
      router.push(`/o/${org.slug}/projects/${pid}/style`);
    } catch (e) { setError(e instanceof Error ? e.message : "could not apply style"); setBusy(false); }
  }

  if (me === undefined) return <Button disabled>Use this style</Button>;
  if (me === null) return <Button onClick={() => router.push(`/login?next=${encodeURIComponent(`/gallery/${slug}?apply=1`)}`)}>Sign in to use this style</Button>;
  if (me.organizations.length === 0) return <Button onClick={() => router.push(`/onboarding?next=${encodeURIComponent(`/gallery/${slug}?apply=1`)}`)}>Create an organization to use this style</Button>;
  return (
    <div className="space-y-2">
      {!open ? <Button onClick={() => setOpen(true)}>Use this style</Button> : (
        <div className="space-y-2 rounded-md border border-line bg-white p-3 text-sm">
          {me.organizations.length > 1 ? <label className="block text-xs">Organization<select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1 w-full rounded border border-line px-2 py-1">{me.organizations.map((o) => <option key={o.organizationId} value={o.organizationId}>{o.name}</option>)}</select></label> : null}
          <label className="block text-xs">Apply to<select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1 w-full rounded border border-line px-2 py-1"><option value="new">New map from this style</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name} (replace its style)</option>)}</select></label>
          {error ? <p role="alert" className="text-xs text-red">{error}</p> : null}
          <div className="flex gap-2"><Button onClick={apply} disabled={busy}>{busy ? "Applying…" : "Apply"}</Button><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button></div>
        </div>
      )}
    </div>
  );
}
