import { expect, test } from "@playwright/test";
import { createProject, login, resetDatabase, setupAdmin } from "./helpers";

let orgId = "";
let orgSlug = "";
const MAPS = process.env.MAPS_URL ?? "http://localhost:8081";

test.beforeAll(async ({ request }) => {
  resetDatabase();
  ({ orgId, orgSlug } = await setupAdmin(request));
});

test("publishes a release and exposes immutable artifacts", async ({ page, request }) => {
  await login(page);
  const projectId = await createProject(page.request, orgId, "Publish Test", "sand-and-sage");
  await page.request.post(`/api/v1/orgs/${orgId}/projects/${projectId}/markers/bulk`, {
    data: { markers: [{ title: "Toronto", lat: 43.65, lng: -79.38, icon: "maki:cafe", color: "#E23B3B" }] },
  });
  await page.goto(`/o/${orgSlug}/projects/${projectId}/publish`);
  await page.getByRole("button", { name: /Publish draft to production/ }).click();
  await expect(page.getByText("release #1")).toBeVisible({ timeout: 60_000 });

  const rel = await page.request.get(`/api/v1/orgs/${orgId}/projects/${projectId}/releases`);
  const body = (await rel.json()) as { releases: Array<{ id: string; status: string; manifest: { urls: { style: string; markers: string; sprite: string } } }>; environments: Array<{ name: string; currentReleaseId: string | null }> };
  const release = body.releases[0]!;
  expect(release.status).toBe("published");
  expect(body.environments.find((e) => e.name === "production")?.currentReleaseId).toBe(release.id);

  const style = await request.get(release.manifest.urls.style);
  expect(style.status()).toBe(200);
  const styleJson = (await style.json()) as { sources: Record<string, { url?: string }>; layers: unknown[] };
  expect(styleJson.sources.basemap!.url).toContain("pmtiles://");
  expect(styleJson.layers.length).toBeGreaterThan(60);
  const markers = await request.get(release.manifest.urls.markers);
  expect(((await markers.json()) as { features: unknown[] }).features).toHaveLength(1);
  const sprite = await request.get(`${release.manifest.urls.sprite}.json`);
  expect(Object.keys((await sprite.json()) as object)).toContain("pin__maki-cafe__e23b3b");
  const pointer = await request.get(`${MAPS}/p/${projectId}/production.json`);
  expect(((await pointer.json()) as { release_id: string }).release_id).toBe(release.id);

  // PMTiles range support on the basemap
  const range = await request.get(styleJson.sources.basemap!.url!.replace("pmtiles://", ""), { headers: { Range: "bytes=0-511" } });
  expect(range.status()).toBe(206);
});
