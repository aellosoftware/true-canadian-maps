import { expect, test, type Page } from "@playwright/test";
import { createProject, login, resetDatabase, setupAdmin } from "./helpers";

type EditorWindow = Window & { __TCM_EDITOR__?: { map: { loaded(): boolean; getPaintProperty(l: string, p: string): unknown; getLayoutProperty(l: string, p: string): unknown; getStyle(): { layers: { id: string }[] } }; store: { getState(): { saveState: string; revision: number } } } };

async function mapReady(page: Page) {
  await page.waitForFunction(() => (window as EditorWindow).__TCM_EDITOR__?.map.loaded() === true, undefined, { timeout: 30_000 });
}

let orgId = "";
let orgSlug = "";
let projectId = "";

test.beforeAll(async ({ request }) => {
  resetDatabase();
  ({ orgId, orgSlug } = await setupAdmin(request));
});

test.describe("style editor", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // API calls from the test share the browser's cookie jar
    projectId = await createProject(page.request, orgId, "Editor Test", "sand-and-sage");
  });

  test("renders the map with the project's preset", async ({ page }) => {
    const tileRequests: number[] = [];
    page.on("response", (r) => { if (r.url().includes(".pmtiles")) tileRequests.push(r.status()); });
    await page.goto(`/o/${orgSlug}/projects/${projectId}/style`);
    await expect(page.getByRole("heading", { name: "Editor Test" })).toBeVisible();
    await mapReady(page);
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    expect(tileRequests.some((s) => s === 206)).toBe(true);
    const water = await page.evaluate(() => (window as EditorWindow).__TCM_EDITOR__!.map.getPaintProperty("water", "fill-color"));
    expect(String(water).toLowerCase()).toContain("#c9efe9");
    await expect(page.getByText("© OpenStreetMap")).toBeVisible();
  });

  test("changes a colour token, toggles a layer, autosaves and undoes", async ({ page }) => {
    await page.goto(`/o/${orgSlug}/projects/${projectId}/style`);
    await mapReady(page);

    // open the Land & water section and set water via hex input
    await page.getByRole("button", { name: /^Land & water/ }).click();
    const waterInput = page.getByLabel("Water", { exact: true });
    await waterInput.fill("#123456");
    await expect.poll(async () => page.evaluate(() => (window as EditorWindow).__TCM_EDITOR__!.map.getPaintProperty("water", "fill-color"))).toBe("#123456");

    // toggle POIs off
    await page.getByRole("checkbox", { name: "Points of interest", exact: true }).uncheck();
    await expect.poll(async () => page.evaluate(() => (window as EditorWindow).__TCM_EDITOR__!.map.getLayoutProperty("pois", "visibility"))).toBe("none");

    // autosave persists revision 2+
    await page.waitForFunction(() => { const st = (window as EditorWindow).__TCM_EDITOR__!.store.getState(); return st.saveState === "saved" && st.revision > 1; }, undefined, { timeout: 10_000 });
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    const saved = await page.request.get(`/api/v1/orgs/${orgId}/projects/${projectId}/style`);
    const body = (await saved.json()) as { style: { revision: number; config: { tokens: { water?: string }; visibility: { pois: boolean } } } };
    expect(body.style.revision).toBeGreaterThan(1);
    expect(body.style.config.tokens.water).toBe("#123456");
    expect(body.style.config.visibility.pois).toBe(false);

    // undo restores POIs
    await page.getByRole("button", { name: /Undo/ }).click();
    await expect.poll(async () => page.evaluate(() => (window as EditorWindow).__TCM_EDITOR__!.map.getLayoutProperty("pois", "visibility"))).not.toBe("none");
  });

  test("applies a preset and switches label language", async ({ page }) => {
    await page.goto(`/o/${orgSlug}/projects/${projectId}/style`);
    await mapReady(page);
    await page.getByRole("button", { name: "True North" }).click();
    await expect.poll(async () => page.evaluate(() => (window as EditorWindow).__TCM_EDITOR__!.map.getPaintProperty("roads_highway", "line-color"))).toBe("#e23b3b");
    await page.getByRole("radio", { name: "Français" }).click();
    await expect.poll(async () => JSON.stringify(await page.evaluate(() => (window as EditorWindow).__TCM_EDITOR__!.map.getLayoutProperty("places_locality", "text-field")))).toContain("name:fr");
  });
});
