import { ForgotPasswordForm } from "@/components/auth/RecoveryForms";
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <ForgotPasswordForm next={(await searchParams).next} />;
}
