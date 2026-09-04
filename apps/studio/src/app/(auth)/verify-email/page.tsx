import { VerifyEmailForm } from "@/components/auth/RecoveryForms";
export const metadata = { title: "Verify email", referrer: "no-referrer", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) { return <VerifyEmailForm next={(await searchParams).next} />; }
