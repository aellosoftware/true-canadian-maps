import { z } from "zod";

/**
 * Runtime configuration. Every deployment (hosted SaaS or self-hosted) sets these;
 * nothing else in the codebase knows a hostname.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  PUBLIC_STUDIO_URL: z.string().url(),
  PUBLIC_API_URL: z.string().url(),
  PUBLIC_MAPS_URL: z.string().url(),
  COOKIE_DOMAIN: z.string().optional(),
  ALLOW_SIGNUP: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  TCM_EDITION: z.enum(["cloud", "selfhosted"]).default("selfhosted"),
  ARTIFACT_STORE: z.enum(["fs", "s3"]).default("fs"),
  ARTIFACT_FS_ROOT: z.string().default("./.data/delivery"),
  BASEMAP_URL: z.string().optional(),
  SMTP_URL: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  REQUIRE_EMAIL_VERIFICATION: z.string().default("false").transform((v) => v === "true" || v === "1"),
  PASSWORD_RECOVERY_ENABLED: z.string().default("false").transform((v) => v === "true" || v === "1"),
  LOG_LEVEL: z.string().default("info"),
  TCM_VERSION: z.string().default("dev"),
  TCM_SOURCE_REVISION: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** True when API and studio share one origin (self-host single-host mode). */
export function isSingleHost(e: Env = env()): boolean {
  return new URL(e.PUBLIC_API_URL).origin === new URL(e.PUBLIC_STUDIO_URL).origin;
}
