import { env } from "./env";

export interface PublicConfig {
  studioBase: string;
  apiBase: string;
  mapsBase: string;
  edition: "cloud" | "selfhosted";
  version: string;
  sourceUrl: string | null;
  passwordRecoveryAvailable: boolean;
  emailVerificationRequired: boolean;
}

/** Runtime URLs handed to client components. Never hardcoded. */
export function publicConfig(): PublicConfig {
  const e = env();
  return {
    studioBase: e.PUBLIC_STUDIO_URL.replace(/\/$/, ""),
    apiBase: e.PUBLIC_API_URL.replace(/\/$/, ""),
    mapsBase: e.PUBLIC_MAPS_URL.replace(/\/$/, ""),
    edition: e.TCM_EDITION,
    version: e.TCM_VERSION,
    sourceUrl: e.TCM_SOURCE_REVISION ? `${e.PUBLIC_MAPS_URL.replace(/\/$/, "")}/source/${e.TCM_SOURCE_REVISION}.tar.gz` : null,
    passwordRecoveryAvailable: e.PASSWORD_RECOVERY_ENABLED && Boolean(e.SMTP_URL && e.SMTP_FROM),
    emailVerificationRequired: e.REQUIRE_EMAIL_VERIFICATION,
  };
}
