import { defineConfig } from "@playwright/test";
const baseURL = process.env.TCM_TEST_URL ?? "http://127.0.0.1:16054";
if (!["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname) || new URL(baseURL).port !== "16054") throw new Error("Journey tests require the isolated local port 16054");
export default defineConfig({
  testDir: "../tests/journey", outputDir: "../output/playwright/journey", timeout: 120_000,
  expect: { timeout: 15000 }, workers: 1, reporter: "list",
  use: { baseURL, actionTimeout: 15000, screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: ["chromium", "firefox", "webkit"].flatMap((browserName) => [390, 768, 1440].map((width) => ({
    name: `${browserName}-${width}`, use: { browserName: browserName as "chromium" | "firefox" | "webkit", viewport: { width, height: 960 },
      ...(browserName === "firefox" ? { headless: process.env.PLAYWRIGHT_HEADED !== "1", launchOptions: { firefoxUserPrefs: { "webgl.force-enabled": true, "gfx.webrender.all": true } } } : {}) },
  }))),
});
