"use client";

import { ChevronDown, Download, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  FLAVOR_COLOR_KEYS, LANDCOVER_KEYS, POI_KEYS, PRESETS, TOKEN_GROUPS, StyleConfigSchema, applyPreset as applyPresetConfig, compileFlavor, contrastRatio, namedFlavor,
  type FlavorColorKey, type StyleConfig, type VisibilityKey,
} from "@tcm/style-compiler";
import { useEditor, useEditorStore } from "@/features/editor/EditorContext";
import { ColorField } from "./ColorField";
import { ShareToGallery } from "@/features/gallery/ShareToGallery";

const VISIBILITY_LABELS: Record<VisibilityKey, string> = {
  pois: "Points of interest", buildings: "Buildings", addresses: "House numbers", boundaries: "Boundaries", landuse: "Parks & land use",
  landcover: "Land cover", rail: "Railways", roadLabels: "Road names", roadShields: "Highway shields", placeLabels: "Place names", waterLabels: "Water names",
};
const HALO_OF: Partial<Record<FlavorColorKey, FlavorColorKey>> = {
  state_label: "state_label_halo", city_label: "city_label_halo", subplace_label: "subplace_label_halo",
  roads_label_major: "roads_label_major_halo", roads_label_minor: "roads_label_minor_halo", address_label: "address_label_halo",
};

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace("Casing", "outline").replace("Halo", "halo");
}

function Section({ title, children, defaultOpen = false, count }: { title: string; children: React.ReactNode; defaultOpen?: boolean; count?: number }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${title} colour settings`} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-navy hover:bg-ice">
        <span>{title}{count ? <span aria-hidden="true" className="ml-2 rounded-full bg-pale-red px-1.5 text-[10px] text-red">{count}</span> : null}</span>
        <ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="px-4 pb-3">{children}</div> : null}
    </section>
  );
}

export function StylePanel() {
  const { store, project, canEdit } = useEditor();
  const config = useEditorStore((s) => s.config);
  const base = useMemo(() => namedFlavor(config.base), [config.base]);
  const effective = useMemo(() => compileFlavor(config), [config]);
  const fileRef = useRef<HTMLInputElement>(null);
  const overriddenCount = (g: readonly FlavorColorKey[]) => g.filter((k) => config.tokens[k] !== undefined).length;

  function applyPreset(slug: string) {
    const current = store.getState();
    current.replaceDoc({ config: applyPresetConfig(current.config, slug), layerOverrides: null });
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.slug}-style.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(file: File) {
    const parsed = StyleConfigSchema.safeParse(JSON.parse(await file.text()));
    if (!parsed.success) {
      alert(`Invalid style file:\n${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")}`);
      return;
    }
    store.getState().replaceDoc({ config: parsed.data, layerOverrides: store.getState().layerOverrides });
  }

  const s = store.getState();
  const disabled = !canEdit;

  return (
    <div aria-disabled={disabled} className={disabled ? "pointer-events-none opacity-70" : ""}>
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-bold text-navy">Presets</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {PRESETS.map((p) => {
            const f = compileFlavor(p.config);
            return (
              <button key={p.slug} type="button" onClick={() => applyPreset(p.slug)} disabled={!canEdit} title={p.description}
                className="group overflow-hidden rounded-md border border-line text-left hover:border-aqua focus-visible:border-aqua">
                <div className="h-10 w-full" style={{ background: `linear-gradient(135deg, ${f.earth} 0 45%, ${f.water} 45% 70%, ${f.highway} 70% 76%, ${f.park_a} 76%)` }} aria-hidden />
                <div className="truncate px-1.5 py-1 text-[11px] font-semibold text-navy">{p.name}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <label className="text-xs text-muted">Base flavor
            <select value={config.base} onChange={(e) => s.setBase(e.target.value as StyleConfig["base"])} className="ml-2 rounded border border-line px-1.5 py-0.5 text-xs text-ink">
              {(["light", "dark", "white", "grayscale", "black"] as const).map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <div className="flex gap-1">
            <button type="button" onClick={exportJson} className="rounded p-1.5 text-muted hover:text-navy" aria-label="Export style JSON"><Download size={15} /></button>
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded p-1.5 text-muted hover:text-navy" aria-label="Import style JSON"><Upload size={15} /></button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ""; }} />
          </div>
        </div>
      </div>

      <Section title="Labels & language" defaultOpen>
        <div className="flex items-center gap-2 py-1 text-xs">
          <span className="text-body">Language</span>
          <div role="radiogroup" className="flex overflow-hidden rounded-md border border-line">
            {([["en", "English"], ["fr", "Français"], ["local", "Local"]] as const).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={config.labels.lang === v} onClick={() => s.setLang(v)}
                className={`px-2 py-1 ${config.labels.lang === v ? "bg-navy text-white" : "bg-white text-navy hover:bg-ice"}`}>{l}</button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Visible layers" defaultOpen>
        <ul className="grid grid-cols-1 gap-1">
          {(Object.keys(VISIBILITY_LABELS) as VisibilityKey[]).map((k) => (
            <li key={k} className="flex items-center justify-between py-0.5 text-xs">
              <label htmlFor={`vis-${k}`} className="text-body">{VISIBILITY_LABELS[k]}</label>
              <input id={`vis-${k}`} type="checkbox" checked={config.visibility[k]} onChange={(e) => s.setVisibility(k, e.target.checked)} className="h-4 w-4 accent-red" />
            </li>
          ))}
        </ul>
      </Section>

      {TOKEN_GROUPS.map((g) => (
        <Section key={g.id} title={g.label} count={overriddenCount(g.keys)}>
          {g.keys.map((k) => {
            const halo = HALO_OF[k];
            const ratio = halo ? contrastRatio(effective[k], effective[halo]) : k === "country_label" || k === "ocean_label" ? contrastRatio(effective[k], effective.earth) : null;
            return (
              <ColorField
                key={k}
                label={humanize(k)}
                value={effective[k]}
                baseValue={base[k]}
                onChange={(v) => s.setToken(k, v)}
                onReset={() => s.setToken(k, undefined)}
                contrastHint={ratio ? `${ratio.toFixed(1)}:1` : undefined}
              />
            );
          })}
        </Section>
      ))}

      <Section title="Points of interest" count={Object.keys(config.tokens.pois ?? {}).length}>
        {POI_KEYS.map((k) => (
          <ColorField key={k} label={humanize(k)} value={effective.pois?.[k] ?? "#000000"} baseValue={base.pois?.[k] ?? "#000000"}
            onChange={(v) => s.setPoiToken(k, v)} onReset={() => s.setPoiToken(k, undefined)} />
        ))}
      </Section>

      <Section title="Land cover" count={Object.keys(config.tokens.landcover ?? {}).length}>
        {LANDCOVER_KEYS.map((k) => (
          <ColorField key={k} label={humanize(k)} value={effective.landcover?.[k] ?? "#000000"} baseValue={base.landcover?.[k] ?? "#000000"}
            onChange={(v) => s.setLandcoverToken(k, v)} onReset={() => s.setLandcoverToken(k, undefined)} />
        ))}
      </Section>

      <ShareToGallery />
      <div className="px-4 py-3 text-right">
        <button type="button" onClick={() => s.resetTokens()} className="text-xs font-semibold text-red hover:underline" disabled={FLAVOR_COLOR_KEYS.every((k) => config.tokens[k] === undefined) && !config.tokens.pois && !config.tokens.landcover}>
          Reset all colours to base
        </button>
      </div>
    </div>
  );
}
