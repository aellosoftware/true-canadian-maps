import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CreateOrganizationForm } from "@/components/auth/AuthForms";
import { getSession } from "@/lib/session";
import { safeReturnPath } from "@/lib/safe-return";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeReturnPath((await searchParams).next);
  const session = await getSession(await headers());
  if (!session) redirect(`/login?next=${encodeURIComponent(`/onboarding?next=${encodeURIComponent(next)}`)}`);
  return <CreateOrganizationForm next={next} />;
}
