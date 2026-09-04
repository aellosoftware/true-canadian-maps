import { test, expect } from "@playwright/test";

test("self-host downloads remain readable and keyboard accessible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/downloads.html");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your infrastructure");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await expect(page.getByRole("link", { name: "Download Linux x64 installer" })).toHaveAttribute("href", /\/v0\.2\.0\/true-canadian-maps-0\.2\.0-linux-x64\.tar\.gz$/);
  await expect(page.getByText("A public npm package is not available yet.", { exact: false })).toBeVisible();
  await page.screenshot({ path: `output/playwright/marketing/downloads-${test.info().project.name}.png`, fullPage: true });
});
