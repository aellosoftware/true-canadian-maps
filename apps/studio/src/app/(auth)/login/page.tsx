import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/AuthForms";
import { env } from "@/lib/env";
import { needsSetup } from "@/lib/services/setup";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await needsSetup()) redirect("/setup");
  const { next } = await searchParams;
  return <LoginForm next={next} allowSignup={env().ALLOW_SIGNUP} />;
}
