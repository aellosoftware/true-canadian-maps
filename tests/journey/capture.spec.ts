import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { PRESETS } from "../../packages/style-compiler/src/presets";

test("capture real built-in maps and Studio walkthrough", async ({ page }, info) => {
  test.skip(process.env.TCM_CAPTURE !== "1" || info.project.name !== "chromium-1440", "Explicit asset generation only");
  test.setTimeout(180000);
  const login = await page.request.post("/api/auth/sign-in/email", { headers: { Origin: "http://127.0.0.1:16054" }, data: { email: "admin@example.test", password: "Disposable-map-test-2026!" } });
  expect(login.ok()).toBe(true);
  const me = await (await page.request.get("/api/v1/me")).json();
  const org = me.organizations[0];
  const project = (await (await page.request.post(`/api/v1/orgs/${org.organizationId}/projects`, { data: { name: "Public city guide", presetSlug: "true-north" } })).json()).project;
  await page.goto(`/o/${org.slug}/projects/${project.id}/style`);
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__TCM_EDITOR__?.map.isStyleLoaded()))).toBe(true);
  mkdirSync("apps/studio/public/gallery", { recursive: true });
  mkdirSync("apps/marketing/assets/walkthrough", { recursive: true });
  for (const preset of PRESETS) {
    await page.evaluate((config) => {
      const { store, map } = (window as any).__TCM_EDITOR__;
      store.getState().replaceDoc({ config, layerOverrides: null });
      map.jumpTo({ center: [-75.7, 45.42], zoom: 5.5, bearing: 0, pitch: 0 });
    }, preset.config);
    await expect(page.getByText("Style saved", { exact: true })).toBeVisible();
    await page.evaluate(() => new Promise<void>((resolve) => { const { map } = (window as any).__TCM_EDITOR__; map.once("idle", resolve); map.triggerRepaint(); }));
    await page.getByRole("region", { name: "Map preview", exact: true }).screenshot({ path: `apps/studio/public/gallery/${preset.slug}.png` });
  }
  await page.getByRole("button", { name: "True North", exact: true }).click();
  await expect(page.getByText("Style saved", { exact: true })).toBeVisible();
  await page.screenshot({ path: "apps/marketing/assets/walkthrough/choose-style.png" });
  const api = `/api/v1/orgs/${org.organizationId}/projects/${project.id}`;
  for (const [title, lng, lat] of [["Ottawa city centre", -75.6972, 45.4215], ["Montréal city centre", -73.5673, 45.5019]] as const) {
    const result = await page.request.post(`${api}/markers`, { data: { title, lng, lat } });
    expect(result.ok()).toBe(true);
  }
  await page.goto(`/o/${org.slug}/projects/${project.id}/markers`);
  await expect(page.getByRole("list", { name: "Marker list" })).toContainText("Ottawa");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__TCM_EDITOR__?.map.isStyleLoaded()))).toBe(true);
  await page.evaluate(() => (window as any).__TCM_EDITOR__.map.jumpTo({ center: [-75, 46], zoom: 5.5 }));
  await page.getByRole("list", { name: "Marker list" }).getByRole("button").filter({ hasText: "Ottawa" }).click();
  await page.screenshot({ path: "apps/marketing/assets/walkthrough/add-locations.png" });
  await page.locator('nav[aria-label="Editor sections"]').getByRole("link", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Publish draft to production" }).click();
  await expect(page.getByText("release #1", { exact: true })).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: "apps/marketing/assets/walkthrough/publish-map.png" });
});
