import { defineConfig } from "vitest/config";
// Playwright specs live in e2e/ and must not be picked up by vitest.
export default defineConfig({ test: { include: ["src/**/*.test.{ts,tsx}"], passWithNoTests: true } });
