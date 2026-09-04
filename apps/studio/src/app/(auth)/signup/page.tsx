import { notFound, redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/AuthForms";
import { env } from "@/lib/env";
import { needsSetup } from "@/lib/services/setup";

export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ invitation?: string; next?: string }> }) {
  if (await needsSetup()) redirect("/setup");
  const { invitation, next } = await searchParams;
  if (!env().ALLOW_SIGNUP && !invitation) notFound();
  return <SignupForm invitationId={invitation} next={next} />;
}
