import { defineConfig, devices } from "@playwright/test";
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:16054";
if (!["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname) || new URL(baseURL).port !== "16054") throw new Error("E2E tests require the dedicated disposable installation on port 16054");

export default defineConfig({
  testDir: "./apps/studio/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
});
