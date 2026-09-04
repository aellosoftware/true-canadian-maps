import { test, expect, type Page } from "@playwright/test";

async function openDraft(page: Page) {
  const login = await page.request.post("/api/auth/sign-in/email", { headers: { Origin: "http://127.0.0.1:16054" }, data: { email: "admin@example.test", password: "Disposable-map-test-2026!" } });
  expect(login.ok()).toBe(true);
  const org = (await (await page.request.get("/api/v1/me")).json()).organizations[0];
  const response = await page.request.post(`/api/v1/orgs/${org.organizationId}/projects`, { data: { name: "Save reliability validation" } });
  expect(response.status()).toBe(201);
  const { project } = await response.json();
  const base = `/o/${org.slug}/projects/${project.id}`;
  await page.goto(`/o/${org.slug}`);
  await page.locator(`a[href="${base}/style"]`).click();
  await expect(page).toHaveURL(new RegExp(`${base}/style`));
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__TCM_EDITOR__?.store))).toBe(true);
  return { base, api: `/api/v1/orgs/${org.organizationId}/projects/${project.id}` };
}
async function edit(page: Page, color: string) { await page.evaluate((value) => (window as any).__TCM_EDITOR__.store.getState().setToken("water", value), color); }
async function state(page: Page) { return page.evaluate(() => { const s = (window as any).__TCM_EDITOR__.store.getState(); return { save: s.saveState, color: s.config.tokens.water, inFlight: s.saveInFlight }; }); }

test("serial saves, edits during saving, explicit retry and navigation protection", async ({ page }) => {
  const { base, api } = await openDraft(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let writes = 0;
  await page.route(`**${api}/style`, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    writes++;
    if (writes === 1) await gate;
    await route.continue();
  });
  await edit(page, "#112233");
  await expect.poll(() => writes).toBe(1);
  await edit(page, "#445566");
  await page.locator('nav[aria-label="Editor sections"]').getByRole("link", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Publish draft to production" })).toBeDisabled();
  expect(writes).toBe(1);
  release();
  await expect.poll(async () => (await state(page)).save).toBe("saved");
  expect(writes).toBe(2);
  expect((await (await page.request.get(`${api}/style`)).json()).style.config.tokens.water).toBe("#445566");
  await page.unroute(`**${api}/style`);
  await page.route(`**${api}/style`, (route) => route.request().method() === "PUT" ? route.abort() : route.continue());
  await edit(page, "#778899");
  await expect(page.getByRole("button", { name: "Retry save", exact: true })).toBeVisible();
  await edit(page, "#8899aa");
  expect((await state(page)).save).toBe("error");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Back to maps", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/publish`));
  // Back within this editor is safe; Back out of the editor must be cancellable.
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${base}/style`));
  expect((await state(page)).color).toBe("#8899aa");
  expect((await state(page)).save).toBe("error");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(new RegExp(`${base}/style`));
  expect((await state(page)).color).toBe("#8899aa");
  await page.unroute(`**${api}/style`);
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect.poll(async () => (await state(page)).save).toBe("saved");
  expect((await (await page.request.get(`${api}/style`)).json()).style.config.tokens.water).toBe("#8899aa");
});

test("database ETags are atomic and editor conflicts preserve the local draft", async ({ page }) => {
  const { api } = await openDraft(page);
  const response = await page.request.get(`${api}/style`);
  const initial = (await response.json()).style;
  const writes = await Promise.all(["#123456", "#abcdef"].map((water) => page.request.put(`${api}/style`, {
    headers: { "If-Match": response.headers().etag }, data: { config: { ...initial.config, tokens: { ...initial.config.tokens, water } }, layerOverrides: initial.layerOverrides },
  })));
  expect(writes.map((r) => r.status()).sort()).toEqual([200, 412]);
  const server = (await (await page.request.get(`${api}/style`)).json()).style;
  expect(server.revision).toBe(initial.revision + 1);
  await edit(page, "#765432");
  await expect(page.getByText("Style conflict", { exact: true })).toBeVisible();
  expect((await state(page)).color).toBe("#765432");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download draft", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/unsaved-draft\.json$/);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Reload server style", exact: true }).click();
  expect((await state(page)).color).toBe("#765432");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reload server style", exact: true }).click();
  await expect.poll(async () => (await state(page)).save).toBe("saved");
  expect((await state(page)).color).toBe(server.config.tokens.water);
});

test("pending and failed marker requests block publishing and retain edits", async ({ page }) => {
  const { api } = await openDraft(page);
  const response = await page.request.post(`${api}/markers`, { data: { title: "Ottawa", lng: -75.6972, lat: 45.4215 } });
  expect(response.ok()).toBe(true);
  await page.reload();
  await page.locator('nav[aria-label="Editor sections"]').getByRole("link", { name: "Markers", exact: true }).click();
  await page.getByRole("list", { name: "Marker list" }).getByRole("button").filter({ hasText: "Ottawa" }).click();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**${api}/markers/*`, async (route) => { if (route.request().method() === "PATCH") { await gate; await route.abort(); } else await route.continue(); });
  await page.getByLabel("Title", { exact: true }).fill("Ottawa city guide");
  await page.getByLabel("Title", { exact: true }).press("Tab");
  await page.locator('nav[aria-label="Editor sections"]').getByRole("link", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Publish draft to production" })).toBeDisabled();
  release();
  await expect(page.getByRole("button", { name: "Retry location updates", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish draft to production" })).toBeDisabled();
  await page.unroute(`**${api}/markers/*`);
  await page.getByRole("button", { name: "Retry location updates", exact: true }).click();
  await expect(page.getByRole("button", { name: "Publish draft to production" })).toBeEnabled();
  expect((await (await page.request.get(`${api}/markers`)).json()).markers[0].title).toBe("Ottawa city guide");
});

test("recovery errors, internal redirects, policy links and form hydration", async ({ page, browser }) => {
  await page.goto("/login?next=https://example.com");
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup?next=%2F");
  await expect(page.getByRole("link", { name: "Preview terms" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy notice" })).toBeVisible();
  await page.goto("/reset-password#token=expired-test-token&next=%2Fgallery%2Ftrue-north");
  await page.getByLabel("New password", { exact: true }).fill("Disposable-expired-test!");
  await page.getByLabel("Confirm new password", { exact: true }).fill("Disposable-expired-test!");
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "expired" })).toBeVisible();
  await page.getByRole("link", { name: "Request a new reset link" }).click();
  await page.route("**/api/auth/request-password-reset", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Email delivery failed. Please try again." }) }));
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "delivery failed" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const form = await noJs.newPage();
  await form.goto("http://127.0.0.1:16054/login");
  await expect(form.getByRole("button", { name: "Sign in", exact: true })).toBeDisabled();
  await expect(form.locator("form")).toHaveAttribute("method", "post");
  await noJs.close();
});
