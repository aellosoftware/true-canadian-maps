import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { basemapVersions } from "@tcm/db";
import { StyleConfigSchema, TOKEN_GROUPS, compileFlavor } from "@tcm/style-compiler";
import { GalleryPreview } from "@/features/gallery/GalleryPreview";
import { UseStyleButton } from "@/features/gallery/UseStyleButton";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getGalleryStyle } from "@/lib/services/gallery";

export const dynamic = "force-dynamic";

export default async function GalleryStylePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let data;
  try { data = await getGalleryStyle(slug); } catch { notFound(); }
  const config = StyleConfigSchema.parse(data.config);
  const flavor = compileFlavor(config);
  const [basemap] = await db().select().from(basemapVersions).where(eq(basemapVersions.status, "available")).limit(1);
  const maps = env().PUBLIC_MAPS_URL.replace(/\/$/, "");
  const targets = {
    basemapUrl: env().BASEMAP_URL ?? (basemap ? `${maps}/${basemap.pmtilesPath}` : `${maps}/base/missing.pmtiles`),
    glyphsUrl: `${maps}/fonts/{fontstack}/{range}.pbf`,
    basemapSpriteBase: `${maps}/sprites/basemap/v4`,
    attribution: basemap?.attribution ?? "© OpenStreetMap contributors, Protomaps",
  };
  const overridden = TOKEN_GROUPS.flatMap((g) => g.keys.filter((k) => config.tokens[k] !== undefined));
  return (
    <div>
      <Link href="/gallery" className="text-sm text-muted hover:text-navy">← Gallery</Link>
      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="relative h-[520px] overflow-hidden rounded-xl border border-line bg-white"><GalleryPreview config={config} targets={targets} /></div>
        <aside className="space-y-4">
          <div><h1 className="text-3xl font-bold">{data.card.name}</h1>{data.card.description ? <p className="mt-1 text-sm text-muted">{data.card.description}</p> : null}
            <p className="mt-2 text-xs text-muted">Base: {config.base} · {data.card.tags.join(" · ")}{data.card.useCount ? ` · used ${data.card.useCount}×` : ""}</p></div>
          <UseStyleButton slug={slug} name={data.card.name} />
          <section><h2 className="text-xs font-bold uppercase tracking-wide text-muted">Palette</h2>
            <ul className="mt-2 grid grid-cols-6 gap-1">{(["background", "earth", "water", "park_a", "highway", "major", "minor_a", "buildings", "boundaries", "city_label", "country_label", "ocean_label"] as const).map((k) => <li key={k} title={`${k}: ${flavor[k]}`} className="h-8 rounded border border-line" style={{ background: flavor[k] }} />)}</ul>
            <p className="mt-2 text-xs text-muted">{overridden.length} colour{overridden.length === 1 ? "" : "s"} customised from the {config.base} base.</p></section>
          <details className="text-xs"><summary className="cursor-pointer font-semibold text-navy">Style config JSON</summary><pre className="mt-2 max-h-64 overflow-auto rounded bg-navy p-2 text-[10px] text-ice">{JSON.stringify(config, null, 2)}</pre></details>
        </aside>
      </div>
    </div>
  );
}
