import manifest from "./manifest.json";

export interface BuiltinIcon { id: string; set: "maki" | "temaki"; name: string; tags: string[]; svg: string }

const ICONS = (manifest as { icons: BuiltinIcon[] }).icons;
const BY_ID = new Map(ICONS.map((i) => [i.id, i]));

export function listBuiltinIcons(): readonly BuiltinIcon[] {
  return ICONS;
}

export function getBuiltinIcon(id: string): BuiltinIcon | undefined {
  return BY_ID.get(id);
}

export function searchIcons(query: string, limit = 60): BuiltinIcon[] {
  const q = query.trim().toLowerCase();
  if (!q) return ICONS.slice(0, limit);
  const terms = q.split(/\s+/);
  const scored: Array<[number, BuiltinIcon]> = [];
  for (const i of ICONS) {
    let score = 0;
    for (const t of terms) {
      if (i.name === t) score += 10;
      else if (i.name.startsWith(t)) score += 5;
      else if (i.name.includes(t)) score += 3;
      else if (i.tags.some((g) => g.startsWith(t))) score += 2;
    }
    if (score > 0) scored.push([score, i]);
  }
  return scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name)).slice(0, limit).map(([, i]) => i);
}

/** Resolve an icon reference ("pin", "maki:cafe", "temaki:bench", "custom:ico_…") to a glyph SVG or null for the plain pin. */
export function resolveGlyph(iconRef: string, customLookup?: (id: string) => string | null | undefined): string | null {
  if (!iconRef || iconRef === "pin") return null;
  if (iconRef.startsWith("custom:")) return customLookup?.(iconRef.slice("custom:".length)) ?? null;
  return BY_ID.get(iconRef)?.svg ?? null;
}
