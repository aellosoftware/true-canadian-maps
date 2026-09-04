"use client";

import { Copy } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui";
import { useApi, usePublicConfig } from "@/components/ConfigProvider";
import { useEditor } from "@/features/editor/EditorContext";

interface Key { id: string; label: string; publicKey: string; status: string; allowedOrigins: string[] }

export function EmbedPanel() {
  const api = useApi();
  const { mapsBase, apiBase } = usePublicConfig();
  const { project } = useEditor();
  const [keys, setKeys] = useState<Key[]>([]);
  const [keyId, setKeyId] = useState<string>("");
  const [locale, setLocale] = useState("en-CA");
  const [list, setList] = useState<"auto" | "below" | "none">("auto");
  const [height, setHeight] = useState("480");
  const [published, setPublished] = useState<boolean | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<"script" | "sdk">("script");

  const load = useCallback(async () => {
    const [{ data: k }, { data: r }] = await Promise.all([
      api<{ keys: Key[] }>(`/orgs/${project.orgId}/projects/${project.id}/keys`),
      api<{ environments: Array<{ name: string; currentReleaseId: string | null }> }>(`/orgs/${project.orgId}/projects/${project.id}/releases`),
    ]);
    const active = k.keys.filter((x) => x.status === "active");
    setKeys(active); setKeyId((cur) => cur || active[0]?.id || "");
    setPublished(Boolean(r.environments.find((e) => e.name === "production")?.currentReleaseId));
  }, [api, project]);
  useEffect(() => { void load(); }, [load]);

  const key = keys.find((k) => k.id === keyId);
  const canGenerate = published === true && Boolean(key);
  const unavailableMessage = !key
    ? "Create an active browser key to generate embed code."
    : "Publish this map to generate embed code.";
  const snippet = useMemo(() => {
    if (!key || !published) return unavailableMessage;
    const attrs = [`data-tcm-map`, `data-project="${project.id}"`, `data-key="${key.publicKey}"`, `data-locale="${locale}"`, list !== "auto" ? `data-list="${list}"` : ""].filter(Boolean).join("\n  ");
    const style = list === "below" || list === "auto" ? "" : ` style="height:${height}px"`;
    return `<div\n  ${attrs}${style}></div>\n<script src="${mapsBase}/embed/v1.js" defer></script>`;
  }, [project.id, key, published, unavailableMessage, locale, list, height, mapsBase]);
  const sdk = useMemo(() => {
    if (!key || !published) return unavailableMessage;
    return `import { createMap } from "@truecanadianmaps/web";\nimport "@truecanadianmaps/web/style.css";\n\nconst map = await createMap({\n  container: "map",\n  apiUrl: "${apiBase}",\n  projectId: "${project.id}",\n  publicKey: "${key.publicKey}",\n  locale: "${locale}",\n});\nmap.on("location:selected", ({ locationId }) => console.log(locationId));`;
  }, [apiBase, project.id, key, published, unavailableMessage, locale]);

  async function copy(text: string, id: string) {
    if (!canGenerate) return;
    await navigator.clipboard.writeText(text); setCopied(id); window.setTimeout(() => setCopied(null), 1500);
  }
  const previewSrcDoc = useMemo(() => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:system-ui}</style></head><body>${snippet}</body></html>`, [snippet]);

  return (
    <div className="space-y-4 p-4">
      <div><h2 className="text-sm font-bold text-navy">Embed</h2><p className="mt-1 text-xs text-muted">Paste the snippet into any web page. The standard embed checks the key’s allowed origins. Published map files remain public; origin restrictions do not make them confidential.</p></div>
      {published === false ? <Alert tone="info">Nothing is published yet. <Link href={`/o/${project.orgSlug}/projects/${project.id}/publish`} className="font-semibold text-red">Publish first</Link>.</Alert> : null}
      {keys.length === 0 ? <Alert tone="info">No active browser key. <Link href={`/o/${project.orgSlug}/projects/${project.id}/settings`} className="font-semibold text-red">Create one in Settings</Link>.</Alert> : null}
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <label className="block">Key<select value={keyId} onChange={(e) => setKeyId(e.target.value)} disabled={keys.length === 0} className="mt-1 w-full rounded border border-line px-2 py-1 disabled:bg-ice disabled:text-muted">{keys.length === 0 ? <option value="">No active browser keys</option> : null}{keys.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></label>
        <label className="block">Language<select value={locale} onChange={(e) => setLocale(e.target.value)} className="mt-1 w-full rounded border border-line px-2 py-1"><option value="en-CA">English</option><option value="fr-CA">Français</option></select></label>
        <label className="block">Location list<select value={list} onChange={(e) => setList(e.target.value as typeof list)} className="mt-1 w-full rounded border border-line px-2 py-1"><option value="auto">Below the map (auto)</option><option value="below">Always below</option><option value="none">None</option></select></label>
        <label className="block">Height (px)<input value={height} onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))} disabled={list !== "none"} className="mt-1 w-full rounded border border-line px-2 py-1" /></label>
      </div>
      <div role="tablist" className="flex overflow-hidden rounded-md border border-line text-xs">
        {(["script"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={`flex-1 px-2 py-1 ${tab === t ? "bg-navy text-white" : "bg-white text-navy hover:bg-ice"}`}>{t === "script" ? "Script tag" : "JavaScript SDK"}</button>)}
      </div>
      <div className="relative">
        <pre className="max-h-64 overflow-auto rounded-md bg-navy p-3 font-mono text-[11px] leading-relaxed text-ice"><code>{tab === "script" ? snippet : sdk}</code></pre>
        <button type="button" disabled={!canGenerate} onClick={() => copy(tab === "script" ? snippet : sdk, tab)} className="absolute right-2 top-2 flex items-center gap-1 rounded bg-white/90 px-2 py-1 text-[11px] font-semibold text-navy hover:bg-white disabled:cursor-not-allowed disabled:opacity-50" aria-label="Copy code"><Copy size={12} /> {copied === tab ? "Copied" : "Copy"}</button>
      </div>
      {tab === "sdk" ? <p className="text-xs text-muted">Public SDK distribution is being prepared. Use the script tag for the current preview.</p> : null}
      {canGenerate ? (
        <details className="text-xs"><summary className="cursor-pointer font-semibold text-navy">Live preview</summary>
          <p className="my-1 text-muted">Renders the snippet in a sandboxed frame using this Studio origin. Add <code className="font-mono">{typeof window !== "undefined" ? window.location.origin : ""}</code> to the key’s allowed origins if needed.</p>
          <iframe title="Embed preview" sandbox="allow-scripts allow-same-origin" srcDoc={previewSrcDoc} className="h-[420px] w-full rounded-md border border-line bg-white" />
        </details>
      ) : null}
    </div>
  );
}
