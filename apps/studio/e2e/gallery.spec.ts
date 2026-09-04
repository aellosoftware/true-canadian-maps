import { expect, test } from "@playwright/test";
import { createProject, login, resetDatabase, setupAdmin } from "./helpers";

let orgId = "";
let orgSlug = "";

test.beforeAll(async ({ request }) => {
  resetDatabase();
  ({ orgId, orgSlug } = await setupAdmin(request));
});

test("uploads a custom SVG icon, rejects a malicious one, shares a style and reuses it from the gallery", async ({ page }) => {
  await login(page);
  const projectId = await createProject(page.request, orgId, "Gallery Source", "true-north");

  // icon upload API: safe SVG accepted, script rejected
  const ok = await page.request.post(`/api/v1/orgs/${orgId}/projects/${projectId}/icons`, { data: { name: "leaf", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15"><path d="M2 13C2 6 6 2 13 2c0 7-4 11-11 11z"/></svg>' } });
  expect(ok.status()).toBe(201);
  const bad = await page.request.post(`/api/v1/orgs/${orgId}/projects/${projectId}/icons`, { data: { name: "evil", svg: '<svg viewBox="0 0 1 1" onload="alert(1)"><script>1</script></svg>' } });
  expect(bad.status()).toBe(422);
  const icons = await (await page.request.get(`/api/v1/orgs/${orgId}/projects/${projectId}/icons`)).json() as { icons: Array<{ id: string; name: string }> };
  expect(icons.icons.map((i) => i.name)).toEqual(["leaf"]);
  const svg = await page.request.get(`/api/v1/orgs/${orgId}/projects/${projectId}/icons/${icons.icons[0]!.id}/svg`);
  expect(await svg.text()).toContain("<path");

  // share the project's style to the gallery from the Style tab
  await page.goto(`/o/${orgSlug}/projects/${projectId}/style`);
  await page.waitForFunction(() => (window as Window & { __TCM_EDITOR__?: { map: { loaded(): boolean } } }).__TCM_EDITOR__?.map.loaded() === true, undefined, { timeout: 30_000 });
  await page.getByRole("button", { name: /Share this style to the public gallery/ }).click();
  await page.getByLabel("Style name").fill("Midnight Retail");
  await page.getByLabel("Tags (comma separated)").fill("dark, retail");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByText(/Shared as \/gallery\/midnight-retail/)).toBeVisible({ timeout: 15_000 });

  // gallery lists it (public) and the detail page renders
  const gallery = await (await page.request.get("/api/v1/gallery")).json() as { styles: Array<{ slug: string; previewUrl: string | null; tags: string[] }> };
  const shared = gallery.styles.find((s) => s.slug === "midnight-retail")!;
  expect(shared.tags).toEqual(["dark", "retail"]);
  await page.goto("/gallery?tag=retail");
  await expect(page.getByRole("heading", { name: "Midnight Retail" })).toBeVisible();
  await page.goto("/gallery/midnight-retail");
  await expect(page.getByRole("heading", { name: "Midnight Retail" })).toBeVisible();

  // use it: creates a new project from the style and lands in the editor
  await page.getByRole("button", { name: "Use this style" }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.waitForURL(/\/projects\/prj_[A-Z0-9]+\/style/);
  await expect(page.getByRole("heading", { name: "Midnight Retail map" })).toBeVisible();
  const projects = await (await page.request.get(`/api/v1/orgs/${orgId}/projects`)).json() as { projects: Array<{ name: string }> };
  expect(projects.projects.map((p) => p.name).sort()).toEqual(["Gallery Source", "Midnight Retail map"]);
});
