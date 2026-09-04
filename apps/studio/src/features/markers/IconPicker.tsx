"use client";

import { Upload, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchIcons } from "@tcm/icons";
import { useApi } from "@/components/ConfigProvider";
import { useEditor } from "@/features/editor/EditorContext";
import { useCustomIcons, type CustomIcon } from "./customIcons";
import { markerPreviewDataUrl } from "./markerImages";

function useLoadCustomIcons() {
  const api = useApi();
  const { project } = useEditor();
  const { loaded, setIcons, setSvg } = useCustomIcons();
  useEffect(() => {
    if (loaded) return;
    api<{ icons: CustomIcon[] }>(`/orgs/${project.orgId}/projects/${project.id}/icons`).then(async ({ data }) => {
      setIcons(data.icons);
      await Promise.all(data.icons.map(async (i) => {
        const res = await fetch(`${window.location.origin}/api/v1/orgs/${project.orgId}/projects/${project.id}/icons/${i.id}/svg`, { credentials: "include" }).catch(() => null);
        if (res?.ok) setSvg(i.id, await res.text());
      }));
    }).catch(() => setIcons([]));
  }, [api, loaded, project, setIcons, setSvg]);
}

export function IconPicker({ value, color, onChange }: { value: string; color: string; onChange: (icon: string) => void }) {
  const api = useApi();
  const { project, canEdit } = useEditor();
  useLoadCustomIcons();
  const custom = useCustomIcons((s) => s.icons);
  const svgs = useCustomIcons((s) => s.svgs);
  const setIcons = useCustomIcons((s) => s.setIcons);
  const setSvg = useCustomIcons((s) => s.setSvg);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const results = useMemo(() => searchIcons(q, 48), [q]);

  async function upload(file: File) {
    setUploadError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("name", file.name);
    try {
      const { data } = await api<{ icon: CustomIcon }>(`/orgs/${project.orgId}/projects/${project.id}/icons`, { method: "POST", body: form });
      setSvg(data.icon.id, await file.text().then((t) => t)); // preview immediately; server copy is the sanitized version
      const res = await fetch(`${window.location.origin}/api/v1/orgs/${project.orgId}/projects/${project.id}/icons/${data.icon.id}/svg`, { credentials: "include" });
      if (res.ok) setSvg(data.icon.id, await res.text());
      setIcons([data.icon, ...custom]);
      onChange(`custom:${data.icon.id}`);
    } catch (err) {
      const e = err as { message?: string; details?: unknown };
      setUploadError(Array.isArray(e.details) ? `SVG rejected: ${(e.details as string[]).join("; ")}` : e.message ?? "upload failed");
    }
  }
  async function remove(icon: CustomIcon) {
    if (!confirm(`Delete icon "${icon.name}"? Markers using it fall back to the plain pin.`)) return;
    await api(`/orgs/${project.orgId}/projects/${project.id}/icons/${icon.id}`, { method: "DELETE" });
    setIcons(custom.filter((c) => c.id !== icon.id));
    if (value === `custom:${icon.id}`) onChange("pin");
  }

  return (
    <div>
      {(custom.length > 0 || canEdit) ? (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[11px] text-muted"><span>Your icons</span>
            {canEdit ? <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1 font-semibold text-red hover:underline"><Upload size={11} /> Upload SVG</button> : null}
            <input ref={fileRef} type="file" accept=".svg,image/svg+xml" className="hidden" aria-label="Upload SVG icon" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} /></div>
          {uploadError ? <p role="alert" className="mt-1 text-[11px] text-red">{uploadError}</p> : null}
          {custom.length > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-1">
              {custom.map((c) => (
                <li key={c.id} className="group relative">
                  <button type="button" onClick={() => onChange(`custom:${c.id}`)} aria-pressed={value === `custom:${c.id}`} title={c.name}
                    className={`flex h-8 w-8 items-center justify-center rounded border ${value === `custom:${c.id}` ? "border-red bg-pale-red" : "border-line hover:bg-ice"}`}>
                    {svgs[c.id] ? <span className="h-4 w-4 text-navy [&_svg]:h-4 [&_svg]:w-4" dangerouslySetInnerHTML={{ __html: svgs[c.id]! }} /> : <span className="text-[9px]">…</span>}
                  </button>
                  {canEdit ? <button type="button" onClick={() => remove(c)} aria-label={`Delete icon ${c.name}`} className="absolute -right-1 -top-1 hidden rounded-full bg-white p-0.5 text-red shadow group-hover:block"><Trash2 size={10} /></button> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange("pin")} aria-pressed={value === "pin"} className={`rounded-md border p-1 ${value === "pin" ? "border-red bg-pale-red" : "border-line"}`} title="Plain pin">
          <img src={markerPreviewDataUrl({ icon: "pin", color })} alt="Plain pin" width={18} height={24} />
        </button>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 770 icons (cafe, hospital, parking…)" aria-label="Search icons" className="flex-1 rounded-md border border-line px-2 py-1 text-xs" />
      </div>
      <ul role="listbox" aria-label="Icons" className="mt-2 grid max-h-44 grid-cols-8 gap-1 overflow-y-auto rounded-md border border-line p-1">
        {results.map((i) => (
          <li key={i.id}>
            <button type="button" role="option" aria-selected={value === i.id} onClick={() => onChange(i.id)} title={i.id}
              className={`flex h-8 w-8 items-center justify-center rounded ${value === i.id ? "bg-pale-red ring-1 ring-red" : "hover:bg-ice"}`}>
              <span className="h-4 w-4 text-navy [&_svg]:h-4 [&_svg]:w-4 [&_svg]:fill-current" dangerouslySetInnerHTML={{ __html: i.svg }} />
            </button>
          </li>
        ))}
        {results.length === 0 ? <li className="col-span-8 p-2 text-center text-xs text-muted">No icons match.</li> : null}
      </ul>
    </div>
  );
}
