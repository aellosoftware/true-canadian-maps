import { redirect } from "next/navigation";
import { SetupForm } from "@/components/auth/AuthForms";
import { needsSetup } from "@/lib/services/setup";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (!(await needsSetup())) redirect("/login");
  return <SetupForm />;
}
