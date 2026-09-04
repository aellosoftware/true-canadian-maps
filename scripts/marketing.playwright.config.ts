import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "../tests/marketing",
  outputDir: "../output/playwright/marketing",
  timeout: 35_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 1 : 3,
  reporter: [["list"]],
  use: { baseURL: process.env.MARKETING_TEST_URL ?? "http://127.0.0.1:8080", screenshot: "only-on-failure" },
  projects: ["chromium", "firefox", "webkit"].flatMap((browserName) =>
    [390, 768, 1440].map((width) => ({ name: `${browserName}-${width}`, use: { browserName: browserName as "chromium" | "firefox" | "webkit", viewport: { width, height: 960 }, ...(browserName === "firefox" ? { headless: process.env.PLAYWRIGHT_HEADED !== "1", launchOptions: { firefoxUserPrefs: { "webgl.force-enabled": true, "gfx.webrender.all": true } } } : {}) } }))),
});
