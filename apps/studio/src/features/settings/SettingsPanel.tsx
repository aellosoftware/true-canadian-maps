"use client";

import { Copy, Plus, Ban } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { useApi, usePublicConfig } from "@/components/ConfigProvider";
import { useEditor } from "@/features/editor/EditorContext";

interface Key { id: string; label: string; publicKey: string; allowedOrigins: string[]; status: "active" | "revoked"; lastUsedAt: string | null; createdAt: string }

export function KeysSection() {
  const api = useApi();
  const { project, canEdit } = useEditor();
  const [keys, setKeys] = useState<Key[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const load = useCallback(async () => { const { data } = await api<{ keys: Key[] }>(`/orgs/${project.orgId}/projects/${project.id}/keys`); setKeys(data.keys); }, [api, project]);
  useEffect(() => { void load().catch((e) => setError(String(e.message ?? e))); }, [load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const origins = String(f.get("origins")).split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    setError(null);
    try {
      await api(`/orgs/${project.orgId}/projects/${project.id}/keys`, { method: "POST", json: { label: f.get("label"), allowedOrigins: origins } });
      setCreating(false); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "could not create key"); }
  }
  async function revoke(k: Key) {
    if (!confirm(`Revoke "${k.label}"? Embeds using it will stop loading.`)) return;
    await api(`/orgs/${project.orgId}/projects/${project.id}/keys/${k.id}`, { method: "PATCH", json: { status: "revoked" } }); await load();
  }
  async function copy(text: string, id: string) { await navigator.clipboard.writeText(text); setCopied(id); window.setTimeout(() => setCopied(null), 1500); }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between"><h3 className="text-xs font-bold text-navy">Browser keys</h3>
        {canEdit ? <button type="button" onClick={() => setCreating((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-red hover:underline"><Plus size={13} /> New key</button> : null}</div>
      <p className="text-xs text-muted">A public key identifies this map and the websites allowed to use the standard embed. It is not a secret. Published files remain public, regardless of allowed origins.</p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {creating ? (
        <form onSubmit={create} className="space-y-2 rounded-md border border-line bg-ice p-3">
          <Field label="Label" htmlFor="label"><Input id="label" name="label" required placeholder="Company website" /></Field>
          <Field label="Allowed origins (one per line)" htmlFor="origins" hint="https://example.com · https://*.example.com · http://localhost:*">
            <textarea id="origins" name="origins" required rows={3} className="w-full rounded-md border border-line px-3 py-2 font-mono text-xs" defaultValue={"http://localhost:*"} />
          </Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button><Button type="submit">Create key</Button></div>
        </form>
      ) : null}
      <ul className="divide-y divide-line rounded-md border border-line">
        {keys.map((k) => (
          <li key={k.id} className={`px-3 py-2 text-xs ${k.status === "revoked" ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between"><span className="font-semibold text-navy">{k.label}</span>
              <span className={`rounded-full px-2 py-0.5 font-semibold ${k.status === "active" ? "bg-sage/50 text-navy" : "bg-pale-red text-red-dark"}`}>{k.status}</span></div>
            <div className="mt-1 flex items-center gap-1 font-mono text-[11px] text-body"><span className="truncate">{k.publicKey}</span>
              <button type="button" onClick={() => copy(k.publicKey, k.id)} aria-label="Copy key" className="rounded p-1 text-muted hover:text-navy"><Copy size={12} /></button>{copied === k.id ? <span className="text-muted" role="status">Copied</span> : null}</div>
            <div className="mt-1 text-muted">{k.allowedOrigins.join(" · ")}</div>
            {k.status === "active" && canEdit ? <button type="button" onClick={() => revoke(k)} className="mt-1 flex items-center gap-1 text-red hover:underline"><Ban size={11} /> Revoke</button> : null}
          </li>
        ))}
        {keys.length === 0 ? <li className="px-3 py-4 text-center text-xs text-muted">No keys yet. Create one to embed this map.</li> : null}
      </ul>
    </section>
  );
}

export function SettingsPanel() {
  const router = useRouter();
  const api = useApi();
  const { apiBase, sourceUrl } = usePublicConfig();
  const { project, canEdit } = useEditor();
  const [name, setName] = useState(project.name);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/orgs/${project.orgId}/projects/${project.id}`, { method: "PATCH", json: { name } });
      setSaved("Saved"); window.setTimeout(() => setSaved(null), 1500);
    } catch (err) { setError(err instanceof Error ? err.message : "save failed"); }
  }
  async function remove() {
    if (!confirm(`Delete the map "${project.name}" and everything in it? This cannot be undone.`)) return;
    await api(`/orgs/${project.orgId}/projects/${project.id}`, { method: "DELETE" });
    router.push(`/o/${project.orgSlug}`);
  }
  return (
    <div className="space-y-6 p-4">
      <section>
        <h2 className="text-sm font-bold text-navy">Settings</h2>
        <form onSubmit={save} className="mt-2 space-y-2">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field label="Map name" htmlFor="name"><Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} /></Field>
          <p className="text-xs text-muted">Project id <code className="font-mono">{project.id}</code></p>
          {canEdit ? <div className="flex items-center gap-2"><Button type="submit" className="px-3 py-1 text-xs">Save</Button>{saved ? <span className="text-xs text-muted" role="status">{saved}</span> : null}</div> : null}
        </form>
      </section>
      <KeysSection />
      {sourceUrl ? <section><h3 className="text-xs font-bold text-navy">Source and licences</h3><p className="mt-1 text-xs text-muted">Studio and server: AGPL-3.0-only. Browser SDK: MIT.</p><a className="mt-2 inline-block text-xs font-semibold text-red underline" href={sourceUrl}>Download the corresponding source for this version</a></section> : null}
      <section>
        <h3 className="text-xs font-bold text-navy">Export</h3>
        <p className="mt-1 text-xs text-muted">Download a zip with the style config, markers, custom icons and release manifests. Import it into another installation or keep it as a backup.</p>
        <a href={`${apiBase}/v1/orgs/${project.orgId}/projects/${project.id}/export`} className="mt-2 inline-block rounded-md border border-line bg-white px-3 py-1 text-xs font-semibold text-navy hover:bg-pale-navy">Download export (.zip)</a>
      </section>
      {canEdit ? (
        <section className="rounded-md border border-red/40 p-3">
          <h3 className="text-xs font-bold text-red">Danger zone</h3>
          <p className="mt-1 text-xs text-muted">Deleting removes the draft, markers, keys and release history. Published files already cached by browsers may persist until they expire.</p>
          <Button type="button" variant="danger" onClick={remove} className="mt-2 px-3 py-1 text-xs">Delete map</Button>
        </section>
      ) : null}
    </div>
  );
}
