import { execFileSync } from "node:child_process";
import type { APIRequestContext, Page } from "@playwright/test";

export const ADMIN = { name: "Ada Admin", email: "ada@example.com", password: "correct-horse-battery", org: "Northern Trails Co-op" };

const PSQL = process.env.PSQL ?? `${process.env.HOME}/.local/share/mamba/envs/tcm-pg/bin/psql`;
const DB = process.env.DATABASE_URL;

/** Wipe tenant data (keeps presets + basemaps) so each run starts from first-run setup. */
export function resetDatabase(): void {
  if (!DB || process.env.TCM_DISPOSABLE_E2E !== "true") throw new Error("E2E reset requires an explicitly disposable database");
  const target = new URL(DB);
  if (target.pathname !== "/tcm_e2e" || !["127.0.0.1", "localhost", "tcm-e2e-db"].includes(target.hostname)) {
    throw new Error("Refusing reset: expected local tcm_e2e database");
  }
  execFileSync(PSQL, [DB, "-q", "-c", "DELETE FROM organizations; DELETE FROM users; DELETE FROM verifications;"], { stdio: "ignore" });
}

export async function setupAdmin(request: APIRequestContext): Promise<{ orgId: string; orgSlug: string }> {
  const res = await request.post("/api/v1/setup", {
    data: { name: ADMIN.name, email: ADMIN.email, password: ADMIN.password, organizationName: ADMIN.org },
  });
  if (!res.ok()) throw new Error(`setup failed: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as { organization: { id: string; slug: string } };
  return { orgId: body.organization.id, orgSlug: body.organization.slug };
}

export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/o\//);
}

export async function createProject(request: APIRequestContext, orgId: string, name: string, presetSlug = "light"): Promise<string> {
  const res = await request.post(`/api/v1/orgs/${orgId}/projects`, { data: { name, template: "store_locator", presetSlug } });
  if (!res.ok()) throw new Error(`project create failed: ${res.status()} ${await res.text()}`);
  return ((await res.json()) as { project: { id: string } }).project.id;
}
