"use client";

import { LogOut, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AccountMenu({ email, role }: { email: string; role: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setPending(true);
    setError(null);
    const result = await authClient.signOut();
    if (result.error) {
      setError(result.error.message ?? "Could not sign out");
      setPending(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-pale-navy [&::-webkit-details-marker]:hidden">
        <UserCircle size={17} aria-hidden />
        <span>Account</span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-line bg-white p-3 shadow-lg">
        <p className="truncate text-sm font-semibold text-navy">{email}</p>
        <p className="mb-3 text-xs capitalize text-muted">{role}</p>
        {error ? <p role="alert" className="mb-2 text-xs text-red-dark">{error}</p> : null}
        <button type="button" onClick={signOut} disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold text-navy hover:bg-pale-navy disabled:cursor-not-allowed disabled:opacity-60">
          <LogOut size={16} aria-hidden /> {pending ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </details>
  );
}
