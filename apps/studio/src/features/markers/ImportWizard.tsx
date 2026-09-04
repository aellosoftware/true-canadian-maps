"use client";
import { writeMarkers } from "@/features/editor/marker-writes";

import Papa from "papaparse";
import { useMemo, useState } from "react";
import { MarkerInputSchema, type MarkerInput, type MarkerRecord } from "@tcm/style-compiler";
import { Alert, Button } from "@/components/ui";
import { useApi } from "@/components/ConfigProvider";
import { useEditor } from "@/features/editor/EditorContext";

type Row = Record<string, string>;
type ColumnMap = { lat: string; lng: string; title: string; description: string; category: string };
const LAT = /^(lat|latitude|y)$/i, LNG = /^(lng|lon|long|longitude|x)$/i, TITLE = /^(title|name|label|store|location)$/i, DESC = /^(description|desc|notes|address)$/i, CAT = /^(category|type|group)$/i;

function autoPick(cols: string[], re: RegExp): string {
  return cols.find((c) => re.test(c.trim())) ?? "";
}

function ColumnSelect({ field, label, value, columns, onChange }: { field: keyof ColumnMap; label: string; value: string; columns: string[]; onChange: (field: keyof ColumnMap, value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs"><span>{label}</span>
      <select value={value} onChange={(e) => onChange(field, e.target.value)} className="w-40 rounded border border-line px-1 py-0.5 text-xs">
        <option value="">—</option>{columns.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </label>
  );
}

export function ImportWizard({ onDone }: { onDone: () => void }) {
  const api = useApi();
  const { store, project } = useEditor();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [geo, setGeo] = useState<MarkerInput[] | null>(null);
  const [cols, setCols] = useState<string[]>([]);
  const [map, setMap] = useState<ColumnMap>({ lat: "", lng: "", title: "", description: "", category: "" });
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");

  async function onFile(file: File) {
    setError(null); setRows(null); setGeo(null); setFileName(file.name);
    if (file.size > 5 * 1024 * 1024) { setError("Files are limited to 5 MB."); return; }
    const text = await file.text();
    if (/\.(geo)?json$/i.test(file.name) || text.trimStart().startsWith("{")) {
      try {
        const j = JSON.parse(text) as { type: string; features?: Array<{ geometry?: { type: string; coordinates: number[] }; properties?: Record<string, unknown> }>; geometry?: unknown };
        const feats = j.type === "FeatureCollection" ? j.features ?? [] : j.type === "Feature" ? [j as never] : [];
        const out: MarkerInput[] = [];
        for (const f of feats) {
          if (f.geometry?.type !== "Point") continue;
          const p = f.properties ?? {};
          const title = String(p.title ?? p.name ?? p.label ?? `Location ${out.length + 1}`);
          const parsed = MarkerInputSchema.safeParse({
            title, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
            description: p.description != null ? String(p.description) : undefined, category: p.category != null ? String(p.category) : undefined,
            icon: store.getState().config.markers.defaultIcon, color: store.getState().config.markers.defaultColor,
          });
          if (parsed.success) out.push(parsed.data);
        }
        if (out.length === 0) { setError("No Point features found in that GeoJSON."); return; }
        setGeo(out);
      } catch { setError("That file is not valid JSON."); }
      return;
    }
    const res = Papa.parse<Row>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
    if (res.errors.length && res.data.length === 0) { setError(`CSV parse error: ${res.errors[0]!.message}`); return; }
    const c = res.meta.fields ?? [];
    setCols(c); setRows(res.data);
    setMap({ lat: autoPick(c, LAT), lng: autoPick(c, LNG), title: autoPick(c, TITLE), description: autoPick(c, DESC), category: autoPick(c, CAT) });
  }

  const preview = useMemo(() => {
    if (geo) return { valid: geo, skipped: [] as number[] };
    if (!rows || !map.lat || !map.lng) return null;
    const valid: MarkerInput[] = []; const skipped: number[] = [];
    const defaults = store.getState().config.markers;
    rows.forEach((r, i) => {
      const parsed = MarkerInputSchema.safeParse({
        title: (map.title && r[map.title]) || `Row ${i + 2}`,
        lat: Number(r[map.lat]), lng: Number(r[map.lng]),
        description: map.description ? r[map.description] || undefined : undefined,
        category: map.category ? r[map.category] || undefined : undefined,
        icon: defaults.defaultIcon, color: defaults.defaultColor,
      });
      if (parsed.success && Number.isFinite(parsed.data.lat) && Number.isFinite(parsed.data.lng)) valid.push(parsed.data); else skipped.push(i + 2);
    });
    return { valid, skipped };
  }, [rows, geo, map, store]);

  async function run() {
    if (!preview || preview.valid.length === 0) return;
    setBusy(true); setError(null);
    try {
      await writeMarkers(store, "Location import", async () => {
      await api(`/orgs/${project.orgId}/projects/${project.id}/markers/bulk`, { method: "POST", json: { markers: preview.valid, mode } });
      const { data } = await api<{ markers: MarkerRecord[] }>(`/orgs/${project.orgId}/projects/${project.id}/markers`);
      store.getState().setMarkers(data.markers);
      onDone();
      }, { retrySafe: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "import failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 rounded-md border border-line bg-ice p-3">
      <div className="flex items-center justify-between"><h3 className="text-xs font-bold text-navy">Import locations</h3><button type="button" onClick={onDone} className="text-xs text-muted hover:text-navy">Close</button></div>
      <input type="file" accept=".csv,text/csv,.json,.geojson,application/json,application/geo+json" aria-label="Choose a CSV or GeoJSON file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} className="block w-full text-xs" />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {rows ? (
        <div className="space-y-1">
          <p className="text-xs text-muted">{fileName}: {rows.length} rows. Map the columns:</p>
          {([['lat', 'Latitude *'], ['lng', 'Longitude *'], ['title', 'Title'], ['description', 'Description'], ['category', 'Category']] as const).map(([field, label]) => (
            <ColumnSelect key={field} field={field} label={label} value={map[field]} columns={cols} onChange={(key, value) => setMap((current) => ({ ...current, [key]: value }))} />
          ))}
        </div>
      ) : null}
      {preview ? (
        <p className="text-xs text-body" role="status">
          <strong>{preview.valid.length}</strong> valid location{preview.valid.length === 1 ? "" : "s"}
          {preview.skipped.length ? <> · {preview.skipped.length} skipped (rows {preview.skipped.slice(0, 8).join(", ")}{preview.skipped.length > 8 ? "…" : ""})</> : null}
        </p>
      ) : null}
      {preview && preview.valid.length > 0 ? (
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs"><input type="radio" name="mode" checked={mode === "append"} onChange={() => setMode("append")} /> Add to existing</label>
          <label className="text-xs"><input type="radio" name="mode" checked={mode === "replace"} onChange={() => setMode("replace")} /> Replace all</label>
          <Button type="button" onClick={run} disabled={busy} className="px-3 py-1 text-xs">{busy ? "Importing…" : `Import ${preview.valid.length}`}</Button>
        </div>
      ) : null}
    </div>
  );
}
