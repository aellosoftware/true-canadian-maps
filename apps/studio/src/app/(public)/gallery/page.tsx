import Link from "next/link";
import { compileFlavor, StyleConfigSchema } from "@tcm/style-compiler";
import { listGallery, getGalleryStyle } from "@/lib/services/gallery";

export const dynamic = "force-dynamic";
export const metadata = { title: "Style gallery" };

function Swatch({ slug }: { slug: string }) {
  return <GallerySwatch slug={slug} />;
}
async function GallerySwatch({ slug }: { slug: string }) {
  const { config } = await getGalleryStyle(slug);
  const f = compileFlavor(StyleConfigSchema.parse(config));
  return <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${f.earth} 0 45%, ${f.water} 45% 70%, ${f.highway} 70% 76%, ${f.park_a} 76%)` }} aria-hidden />;
}

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ tag?: string; q?: string }> }) {
  const { tag, q } = await searchParams;
  const allStyles = await listGallery();
  let styles = allStyles;
  if (tag) styles = styles.filter((s) => s.tags.includes(tag));
  if (q) { const t = q.toLowerCase(); styles = styles.filter((s) => s.name.toLowerCase().includes(t) || (s.description ?? "").toLowerCase().includes(t)); }
  const tags = [...new Set(allStyles.flatMap((s) => s.tags))].sort();
  const filterUrl = (selectedTag?: string) => `/gallery?${new URLSearchParams({ ...(q ? { q } : {}), ...(selectedTag ? { tag: selectedTag } : {}) })}`;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-red">Style gallery</p><h1 className="text-3xl font-bold">Map styles to start from</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">Every style here is a set of colour tokens on an open MapLibre basemap. Apply one to your map and keep customizing.</p></div>
        <form className="flex max-w-full gap-2" role="search">{tag ? <input name="tag" type="hidden" value={tag} /> : null}<input name="q" defaultValue={q} placeholder="Search styles" aria-label="Search styles" className="min-w-0 rounded-md border border-line bg-white px-3 py-2 text-sm" /><button className="rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white">Search</button></form>
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Link href={filterUrl()} aria-current={!tag ? "true" : undefined} className={`rounded-full px-3 py-1 font-semibold ${!tag ? "bg-navy text-white" : "bg-white text-navy border border-line"}`}>All tags</Link>
        {tags.map((t) => <Link key={t} href={filterUrl(t)} aria-current={tag === t ? "true" : undefined} className={`rounded-full px-3 py-1 font-semibold ${tag === t ? "bg-navy text-white" : "border border-line bg-white text-navy"}`}>{t}</Link>)}
        {tag || q ? <Link href="/gallery" className="rounded-full px-3 py-1 font-semibold text-red underline">Reset filters</Link> : null}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {styles.map((s) => (
          <li key={s.id} className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            <Link href={`/gallery/${s.slug}`} className="block">
              <div className="h-40 w-full bg-ice">{s.previewUrl ? <img src={s.previewUrl} alt={`${s.name} preview`} className="h-full w-full object-cover" /> : <Swatch slug={s.slug} />}</div>
              <div className="p-4"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold text-navy">{s.name}</h2>{s.isPlatform ? <span className="rounded-full bg-pale-navy px-2 py-0.5 text-[10px] font-semibold text-navy">Built-in</span> : null}</div>
                {s.description ? <p className="mt-1 text-sm text-muted">{s.description}</p> : null}
                <p className="mt-2 text-xs text-muted">{s.tags.join(" · ")}{s.useCount ? ` · used ${s.useCount}×` : ""}</p></div>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">Built-in previews show the same view of eastern Canada. Map data © <a className="underline" href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, basemap by <a className="underline" href="https://protomaps.com">Protomaps</a>.</p>
      {styles.length === 0 ? <div role="status" className="rounded-xl border border-line bg-white p-6"><h2 className="font-bold">No matching styles</h2><p className="mt-2 text-sm text-muted">Try a shorter search or remove the selected tag.</p><Link href="/gallery" className="mt-3 inline-block font-semibold text-red">Reset filters and browse all styles</Link></div> : null}
    </div>
  );
}
