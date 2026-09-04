import { test, expect, type Page } from "@playwright/test";

const password = "Disposable-map-test-2026!";
async function saved(page: Page) {
  await expect(page.getByText("Style saved", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const state = (window as any).__TCM_EDITOR__?.store.getState();
    return state ? state.markerPending + Object.keys(state.markerDrafts).length : -1;
  })).toBe(0);
}

test.beforeAll(async ({ request }) => {
  const check = await request.get("/api/v1/setup");
  if ((await check.json()).needsSetup) {
    const response = await request.post("/api/v1/setup", { data: { name: "Validation Administrator", email: "admin@example.test", password, organizationName: "Disposable validation" } });
    expect(response.status()).toBe(201);
  }
});

test("gallery selection, signup, locations, publish, embed, export and recovery", async ({ page, browser }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const email = `journey-${info.project.name}-${Date.now()}@example.test`;
  await page.goto("/gallery?tag=standard&q=dark");
  await expect(page.getByRole("link", { name: "All tags", exact: true })).toHaveAttribute("href", /q=dark/);
  await page.getByRole("searchbox", { name: "Search styles" }).count();
  await page.getByRole("textbox", { name: "Search styles" }).fill("no-matching-style");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/tag=standard/);
  await expect(page.getByRole("heading", { name: "No matching styles" })).toBeVisible();
  await page.getByRole("link", { name: "Reset filters", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:16054/gallery");
  await page.locator('a[href="/gallery/true-north"]').click();
  await page.getByRole("button", { name: "Sign in to use this style" }).click();
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/next=/);
  await page.getByLabel("Name", { exact: true }).fill("Map Preview Team");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/onboarding\?next=/);
  await page.getByLabel("Organization name").fill(`Public locations ${info.project.name} ${Date.now()}`);
  await page.getByRole("button", { name: "Create organization", exact: true }).click();
  await expect(page).toHaveURL(/gallery\/true-north\?apply=1/);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/style/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const editorBase = new URL(page.url()).pathname.replace(/\/style$/, "");
  const me = await (await page.request.get("/api/v1/me")).json();
  const projectId = editorBase.split("/").at(-1)!;
  const apiBase = `/api/v1/orgs/${me.organizations[0].organizationId}/projects/${projectId}`;
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__TCM_EDITOR__?.map.isStyleLoaded()))).toBe(true);
  await page.locator('nav[aria-label="Editor sections"]').getByRole("link", { name: "Markers", exact: true }).click();
  await page.getByRole("button", { name: "Add marker", exact: true }).click();
  await page.locator(".maplibregl-canvas").click({ position: { x: 150, y: 120 } });
  await page.getByLabel("Title", { exact: true }).fill("Ottawa city centre");
  await page.getByLabel("Coordinates (lat, lng)").fill("45.4215, -75.6972");
  await page.getByLabel("Coordinates (lat, lng)").press("Tab");
  await saved(page);
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByLabel("Choose a CSV or GeoJSON file").setInputFiles({ name: "public-cities.geojson", mimeType: "application/geo+json", buffer: Buffer.from(JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [-73.5673,45.5019] }, properties: { title: "Montréal city centre" } }] })) });
  await page.getByRole("button", { name: /Import 1/ }).click();
  await saved(page);
  await expect(page.getByRole("list", { name: "Marker list" })).toContainText("Montréal");
  await page.locator('nav[aria-label="Editor sections"]').getByRole("link", { name: "Publish", exact: true }).click();
  await expect(page.getByText(/Published map content is public/)).toBeVisible();
  await page.getByRole("button", { name: "Publish draft to production" }).click();
  await expect(page.getByText("release #1", { exact: true })).toBeVisible({ timeout: 60000 });
  const first = (await (await page.request.get(`${apiBase}/releases`, { maxRetries: 2 })).json()).releases[0];
  expect((await page.request.get(first.manifest.urls.style)).status()).toBe(200);
  const range = await page.request.get("http://127.0.0.1:18054/base/base-ca-20260901-z6.pmtiles", { headers: { Range: "bytes=0-126" } });
  expect(range.status()).toBe(206);
  await page.getByRole("button", { name: "Republish", exact: true }).click();
  await expect(page.getByText("release #2", { exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByText("release #1", { exact: true })).toBeVisible();
  await page.locator('nav[aria-label="Editor sections"]').getByRole("link", { name: "Settings", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download export (.zip)" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
  await page.getByRole("button", { name: "New key", exact: true }).click();
  await page.getByLabel("Label", { exact: true }).fill("Preview website");
  await page.getByLabel("Allowed origins (one per line)").fill("http://127.0.0.1:8080");
  await page.getByRole("button", { name: "Create key", exact: true }).click();
  await page.locator('nav[aria-label="Editor sections"]').getByRole("link", { name: "Embed", exact: true }).click();
  await expect(page.locator("pre code")).toContainText("data-tcm-map");
  const snippet = await page.locator("pre code").innerText();
  const embed = await page.context().newPage();
  await embed.goto("http://127.0.0.1:8080/terms.html");
  await embed.setContent(`<html><body>${snippet}</body></html>`);
  await expect(embed.locator(".maplibregl-canvas")).toBeVisible();
  await embed.close();
  await page.screenshot({ path: `output/playwright/journey/studio-${info.project.name}.png`, fullPage: true });
  // SMTP is available in this disposable environment without requiring verification.
  expect(me.user.emailVerified).toBe(false);
  const recoveryContext = await browser.newContext({ viewport: info.project.use.viewport, reducedMotion: "reduce" });
  const recovery = await recoveryContext.newPage();
  await recovery.goto(`http://127.0.0.1:16054/forgot-password?next=${encodeURIComponent(editorBase + "/style")}`);
  await recovery.getByLabel("Email", { exact: true }).fill(email);
  await recovery.getByRole("button", { name: "Send reset link" }).click();
  await expect(recovery.getByRole("heading", { name: "Check your email" })).toBeVisible();
  let mailId = "";
  await expect.poll(async () => {
    const messages = await (await recovery.request.get("http://127.0.0.1:18025/api/v1/messages")).json();
    mailId = messages.messages.find((m: any) => m.To.some((to: any) => to.Address === email) && m.Subject.includes("Reset"))?.ID ?? "";
    return Boolean(mailId);
  }).toBe(true);
  const message = await (await recovery.request.get(`http://127.0.0.1:18025/api/v1/message/${mailId}`)).json();
  const resetUrl = message.Text.match(/http:\/\/127\.0\.0\.1:16054\/reset-password#[^\s]+/)[0];
  expect(new URL(resetUrl).search).toBe("");
  await recovery.goto(resetUrl);
  await recovery.getByLabel("New password", { exact: true }).fill(password + "updated");
  await recovery.getByLabel("Confirm new password", { exact: true }).fill(password + "updated");
  await recovery.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(recovery.getByRole("heading", { name: "Password updated" })).toBeVisible();
  expect((await page.request.get("/api/v1/me")).status()).toBe(401);
  await recovery.getByRole("link", { name: "Sign in", exact: true }).click();
  await recovery.getByLabel("Email", { exact: true }).fill(email);
  await recovery.getByLabel("Password", { exact: true }).fill(password + "updated");
  await recovery.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(recovery).toHaveURL(new RegExp(`/projects/${projectId}/style`));
  await recoveryContext.close();
});
