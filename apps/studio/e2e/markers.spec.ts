import { expect, test, type Page } from "@playwright/test";
import { createProject, login, resetDatabase, setupAdmin } from "./helpers";

type EditorWindow = Window & { __TCM_EDITOR__?: { map: { loaded(): boolean; querySourceFeatures(s: string): unknown[]; getLayoutProperty(l: string, p: string): unknown } } };

async function mapReady(page: Page) {
  await page.waitForFunction(() => (window as EditorWindow).__TCM_EDITOR__?.map.loaded() === true, undefined, { timeout: 30_000 });
}

let orgId = "";
let orgSlug = "";

test.beforeAll(async ({ request }) => {
  resetDatabase();
  ({ orgId, orgSlug } = await setupAdmin(request));
});

test.describe("markers", () => {
  test("adds a marker by clicking, edits it, imports a CSV and deletes", async ({ page }) => {
    await login(page);
    const projectId = await createProject(page.request, orgId, "Markers Test");
    await page.goto(`/o/${orgSlug}/projects/${projectId}/markers`);
    await mapReady(page);

    // click-to-add
    await page.getByRole("button", { name: "Add marker" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Click the map" })).toBeVisible();
    const canvas = page.locator(".maplibregl-canvas");
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByRole("list", { name: "Marker list" }).getByRole("button")).toHaveCount(1);
    await expect.poll(async () => page.evaluate(() => (window as EditorWindow).__TCM_EDITOR__!.map.querySourceFeatures("tcm-markers").length)).toBeGreaterThan(0);

    // inspector edit persists
    const title = page.getByLabel("Title", { exact: true });
    await title.fill("Head office");
    await title.blur();
    await expect(page.getByRole("list", { name: "Marker list" })).toContainText("Head office");
    const api = await page.request.get(`/api/v1/orgs/${orgId}/projects/${projectId}/markers`);
    const body = (await api.json()) as { markers: Array<{ title: string; lat: number; lng: number }> };
    expect(body.markers[0]!.title).toBe("Head office");
    expect(body.markers[0]!.lat).toBeGreaterThan(41);

    // CSV import: 3 rows, one invalid
    await page.getByRole("button", { name: "Import" }).click();
    await page.getByLabel("Choose a CSV or GeoJSON file").setInputFiles({
      name: "stores.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("name,latitude,longitude,category\nToronto,43.65,-79.38,Store\nOttawa,45.42,-75.69,Store\nBroken,999,-75,Store\n"),
    });
    await expect(page.getByRole("status").filter({ hasText: "2 valid" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "1 skipped" })).toBeVisible();
    await page.getByRole("button", { name: /^Import 2$/ }).click();
    await expect(page.getByRole("list", { name: "Marker list" }).getByRole("button")).toHaveCount(3);

    // delete selected marker
    page.once("dialog", (d) => d.accept());
    await page.getByRole("list", { name: "Marker list" }).getByRole("button", { name: /Toronto/ }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("list", { name: "Marker list" }).getByRole("button")).toHaveCount(2);
  });
});
