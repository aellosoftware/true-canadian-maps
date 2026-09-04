import { test, expect } from "@playwright/test";

test("layout, navigation, FAQ and policy content", async ({ page }) => {
  await page.route("**/live-map.js?*", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("[data-map-error]")).toBeVisible();
  await expect(page.locator(".hero-actions .button")).toHaveText("Try the Studio");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  const faq = page.getByText("Are published maps private?", { exact: true });
  await faq.click();
  await expect(page.locator(".faq-list details[open]")).toContainText("public URLs");
  await page.screenshot({ path: `output/playwright/marketing/layout-${test.info().project.name}.png`, fullPage: true });
  await page.goto("/terms.html");
  await expect(page.getByRole("heading", { name: "Preview terms" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("stalled download expires within one overall deadline and ignores late response", async ({ page }) => {
  let release!: () => void;
  const stalled = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/live-map.js?*", async (route) => { await stalled; await route.fulfill({ contentType: "application/javascript", body: "export function mountLiveMap({onReady}) { onReady(); }" }); });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-map-error]")).toBeVisible({ timeout: 14000 });
  release();
  await expect(page.locator("[data-live-demo]")).toHaveClass(/map-failed/);
  await expect(page.locator("[data-live-map]")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".map-readable")).toContainText("Ottawa");
});

test("missing module recovers on retry without duplicate controls", async ({ page }) => {
  let attempt = 0;
  await page.route("**/live-map.js?*", (route) => ++attempt === 1 ? route.abort() : route.fulfill({ contentType: "application/javascript", body: "export function mountLiveMap({onReady}) { onReady(); }" }));
  await page.goto("/");
  await expect(page.locator("[data-map-error]")).toBeVisible();
  await page.getByRole("button", { name: "Retry interactive map" }).click();
  await expect(page.locator("[data-live-demo]")).toHaveClass(/map-ready/);
  await expect(page.locator("[data-map-error]")).toBeHidden();
});

test("unavailable WebGL keeps fallback and normal scrolling", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (/webgl/.test(type)) return null;
      return original.apply(this, [type, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("[data-map-error]")).toBeVisible();
  await expect(page.locator(".map-static-preview")).toBeVisible();
  await page.mouse.wheel(0, 700);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
});

test("real map loads with readable, isolated attribution", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-live-demo]")).toHaveClass(/map-ready/);
  const attribution = page.locator(".maplibregl-ctrl-attrib");
  await expect(attribution).toBeVisible();
  expect(await attribution.locator("summary").evaluate((el) => getComputedStyle(el, "::after").content)).not.toBe('"+"');
  await page.locator('[data-map-location="ottawa"]').click();
  await expect(page.locator(".demo-popup")).toContainText("Ottawa");
  await page.locator("[data-map-reset]").click();
  for (const value of ["true-north", "sand-and-sage", "light"]) {
    await page.getByLabel("Try a style").selectOption(value);
    await expect(page.locator("[data-live-demo]")).toHaveClass(/map-ready/);
    expect(await page.locator(".maplibregl-canvas").count()).toBe(1);
  }
  if (process.env.TCM_CAPTURE === "1" && test.info().project.name === "chromium-1440") await page.locator("[data-live-map]").screenshot({ path: "apps/marketing/assets/live-demo/preview.png" });
  await page.reload();
  await expect(page.locator("[data-live-demo]")).toHaveClass(/map-ready/);
});
