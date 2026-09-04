import { Card } from "@/components/ui";
import { safeReturnPath } from "@/lib/safe-return";
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; kind?: string }> }) {
  const { next, kind } = await searchParams;
  const target = safeReturnPath(next);
  return <Card><h1 className="mb-3 text-2xl font-bold">{kind === "reset" ? "Password updated" : "Continue to Studio"}</h1><p className="text-sm text-muted">{kind === "reset" ? "Sign in with your new password. Existing sessions have been signed out." : "Your selected style is preserved. Finish setting up your organization to continue."}</p><a className="mt-4 block text-red underline" href={kind === "reset" ? `/login?next=${encodeURIComponent(target)}` : `/onboarding?next=${encodeURIComponent(target)}`}>{kind === "reset" ? "Sign in" : "Continue"}</a></Card>;
}
