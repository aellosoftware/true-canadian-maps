"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PRESETS, compileFlavor } from "@tcm/style-compiler";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { useApi } from "@/components/ConfigProvider";

const TEMPLATES = [
  { id: "blank", name: "Blank map", desc: "Start from a styled basemap and add what you need." },
  { id: "store_locator", name: "Store locator", desc: "Branches, dealers or service points with a location list." },
  { id: "public_facilities", name: "Public facilities", desc: "Parks, offices, clinics and other public information." },
  { id: "editorial", name: "Editorial map", desc: "A map for an article, report or campaign." },
] as const;

export function NewProjectForm({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const api = useApi();
  const router = useRouter();
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]["id"]>("blank");
  const [preset, setPreset] = useState("light");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true); setError(null);
    try {
      const { data } = await api<{ project: { id: string } }>(`/orgs/${orgId}/projects`, {
        method: "POST",
        json: { name: f.get("name"), description: f.get("description") || undefined, template, presetSlug: preset, defaultLocale: f.get("locale") },
      });
      router.push(`/o/${orgSlug}/projects/${data.project.id}/style`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the map");
      setPending(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <h1 className="text-2xl font-bold">New map</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-5">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Name" htmlFor="name"><Input id="name" name="name" required placeholder="Store locator" /></Field>
        <Field label="Description (optional)" htmlFor="description"><Input id="description" name="description" /></Field>
        <fieldset>
          <legend className="text-sm font-semibold text-navy">Template</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {TEMPLATES.map((t) => (
              <label key={t.id} className={`cursor-pointer rounded-md border p-3 text-sm ${template === t.id ? "border-red bg-pale-red" : "border-line hover:border-aqua"}`}>
                <input type="radio" name="template" value={t.id} checked={template === t.id} onChange={() => setTemplate(t.id)} className="sr-only" />
                <span className="block font-semibold text-navy">{t.name}</span>
                <span className="text-xs text-muted">{t.desc}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold text-navy">Starting style</legend>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {PRESETS.map((p) => {
              const fl = compileFlavor(p.config);
              return (
                <label key={p.slug} className={`cursor-pointer overflow-hidden rounded-md border ${preset === p.slug ? "border-red ring-2 ring-red/30" : "border-line hover:border-aqua"}`}>
                  <input type="radio" name="preset" value={p.slug} checked={preset === p.slug} onChange={() => setPreset(p.slug)} className="sr-only" />
                  <span className="block h-10" style={{ background: `linear-gradient(135deg, ${fl.earth} 0 45%, ${fl.water} 45% 70%, ${fl.highway} 70% 76%, ${fl.park_a} 76%)` }} aria-hidden />
                  <span className="block truncate px-1.5 py-1 text-[11px] font-semibold text-navy">{p.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <Field label="Default label language" htmlFor="locale">
          <select id="locale" name="locale" defaultValue="en-CA" className="rounded-md border border-line bg-white px-3 py-2 text-sm">
            <option value="en-CA">English (Canada)</option>
            <option value="fr-CA">Français (Canada)</option>
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create map"}</Button>
        </div>
      </form>
    </Card>
  );
}
