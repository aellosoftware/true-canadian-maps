import { safeReturnPath } from "./safe-return";

/** Tokens stay in URL fragments, outside HTTP access logs and referrer headers. */
export function accountLink(studio: string, route: "/reset-password" | "/verify-email", token: string, providerUrl: string): string {
  const callback = new URL(providerUrl).searchParams.get("callbackURL");
  let next = "/";
  if (callback) {
    try { next = safeReturnPath(new URL(callback, studio).searchParams.get("next")); } catch { /* use home */ }
  }
  const link = new URL(route, studio);
  link.hash = new URLSearchParams({ token, next }).toString();
  return link.href;
}
