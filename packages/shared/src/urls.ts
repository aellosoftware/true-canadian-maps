/**
 * Public URL configuration. Nothing in the codebase hardcodes a hostname;
 * both the hosted SaaS and self-hosted installs configure these three.
 */
export interface PublicUrls {
  /** Where the studio UI is served, e.g. https://studio.example.com or https://maps.example.com */
  studio: string;
  /** Where /v1/* REST lives, e.g. https://api.example.com or https://maps.example.com/api */
  api: string;
  /** Where static delivery lives (tiles, fonts, sprites, artifacts, embed), e.g. https://maps.example.com or https://maps.example.com/maps */
  maps: string;
}

export function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, "");
}

export function joinUrl(base: string, ...parts: string[]): string {
  let out = stripTrailingSlash(base);
  for (const p of parts) {
    const clean = p.replace(/^\/+/, "").replace(/\/+$/, "");
    if (clean) out += `/${clean}`;
  }
  return out;
}

/** Artifact key layout on the delivery plane. Keys never include a leading slash. */
export const artifactKeys = {
  release: (orgId: string, projectId: string, releaseId: string, file: string) =>
    `t/${orgId}/${projectId}/${releaseId}/${file}`,
  releasePrefix: (orgId: string, projectId: string, releaseId: string) => `t/${orgId}/${projectId}/${releaseId}/`,
  pointer: (projectId: string, environment: string) => `p/${projectId}/${environment}.json`,
  upload: (orgId: string, projectId: string | null, iconId: string) =>
    `uploads/${orgId}/${projectId ?? "_org"}/${iconId}.svg`,
  basemap: (name: string) => `base/${name}.pmtiles`,
  glyphs: () => `fonts/{fontstack}/{range}.pbf`,
  basemapSprite: (theme: "light" | "dark") => `sprites/basemap/v4/${theme}`,
} as const;

export function deliveryUrl(mapsBase: string, key: string): string {
  return joinUrl(mapsBase, key);
}
