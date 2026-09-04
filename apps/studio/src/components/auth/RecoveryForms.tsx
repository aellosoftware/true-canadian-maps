"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { usePublicConfig } from "@/components/ConfigProvider";
import { useHydrated } from "@/lib/use-hydrated";
import { authClient } from "@/lib/auth-client";
import { safeReturnPath } from "@/lib/safe-return";

function subscribeHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function useLink() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const params = new URLSearchParams(hash.slice(1));
  return { token: params.get("token") ?? "", next: safeReturnPath(params.get("next")) };
}

export function ForgotPasswordForm({ next }: { next?: string }) {
  const { passwordRecoveryAvailable } = usePublicConfig();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const destination = safeReturnPath(next);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));
    setBusy(true); setError(null);
    try {
      const result = await authClient.requestPasswordReset({ email, redirectTo: `/reset-password?next=${encodeURIComponent(destination)}` });
      if (result.error) throw new Error(result.error.message ?? "Unable to send the email. Please try again.");
      setSent(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Email delivery failed. Please try again."); }
    finally { setBusy(false); }
  }
  return <Card>
    <h1 className="mb-3 text-2xl font-bold">Forgot password</h1>
    {!passwordRecoveryAvailable ? <Alert tone="info">Email recovery is not available on this installation yet. You can return to sign in and try again once recovery is available.</Alert> : sent ? <div role="status"><h2 className="font-semibold">Check your email</h2><p className="mt-2 text-sm text-muted">If an account matches that address, a reset link will arrive shortly. Check spam. Links expire after one hour.</p><Button className="mt-3" variant="secondary" onClick={() => setSent(false)}>Request another link</Button></div> : <form method="post" className="space-y-4" onSubmit={submit}>
      <p className="text-sm text-muted">Enter your account email to receive a password reset link.</p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Field label="Email" htmlFor="email"><Input name="email" id="email" type="email" autoComplete="email" required /></Field>
      <Button type="submit" disabled={busy || !hydrated}>{busy ? "Sending…" : "Send reset link"}</Button>
    </form>}
    <a className="mt-4 block text-sm text-red" href={`/login?next=${encodeURIComponent(destination)}`}>Back to sign in</a>
  </Card>;
}

export function ResetPasswordForm() {
  const { token, next } = useLink();
  const router = useRouter();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmation")) { setError("The passwords do not match."); return; }
    setBusy(true); setError(null);
    try {
      const result = await authClient.resetPassword({ token, newPassword: String(form.get("password")) });
      if (result.error) throw new Error("This link is invalid or has expired. Request a new reset link.");
      // Remove the used token from this history entry.
      router.replace(`/auth/confirmed?kind=reset&next=${encodeURIComponent(next)}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Password reset failed. Please try again."); }
    finally { setBusy(false); }
  }
  return <Card>
    <h1 className="mb-3 text-2xl font-bold">Reset password</h1>
    {!token ? <Alert tone="error">Open the complete link from your email. If it is missing or expired, request a new reset link.</Alert> : <form method="post" className="space-y-4" onSubmit={submit}>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Field label="New password" htmlFor="password" hint="At least 10 characters."><Input id="password" name="password" type="password" minLength={10} autoComplete="new-password" required /></Field>
      <Field label="Confirm new password" htmlFor="confirmation"><Input id="confirmation" name="confirmation" type="password" minLength={10} autoComplete="new-password" required /></Field>
      <Button disabled={busy || !hydrated} type="submit">{busy ? "Updating…" : "Update password"}</Button>
    </form>}
    <a className="mt-4 block text-sm text-red" href={`/forgot-password?next=${encodeURIComponent(next)}`}>Request a new reset link</a>
  </Card>;
}

export function VerifyEmailForm({ next: requestedNext }: { next?: string }) {
  const { token, next } = useLink();
  const destination = safeReturnPath(requestedNext, next);
  const { emailVerificationRequired } = usePublicConfig();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function verify() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/account/verify-email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      if (!res.ok) throw new Error("This verification link is invalid or expired. Request a new email below.");
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Verification failed. Please try again."); }
    finally { setBusy(false); }
  }
  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));
    setBusy(true); setError(null);
    try {
      const result = await authClient.sendVerificationEmail({ email, callbackURL: `/auth/confirmed?next=${encodeURIComponent(destination)}` });
      if (result.error) throw new Error(result.error.message ?? "Email delivery failed. Please try again.");
      setSent(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Email delivery failed. Please try again."); }
    finally { setBusy(false); }
  }
  return <Card>
    <h1 className="mb-3 text-2xl font-bold">{done ? "Email confirmed" : "Verify your email"}</h1>
    {error ? <Alert tone="error">{error}</Alert> : null}
    {done ? <a className="text-red underline" href={`/onboarding?next=${encodeURIComponent(destination)}`}>Continue to Studio</a> : <>
      {token ? <Button className="my-3" disabled={busy || !hydrated} onClick={verify}>Confirm email address</Button> : null}
      {sent ? <p role="status" className="my-3 text-sm">If your account needs verification, an email will arrive shortly. Check spam before trying again.</p> : null}
      {emailVerificationRequired ? <form method="post" onSubmit={resend} className="mt-4 space-y-3"><Field label="Account email" htmlFor="email"><Input id="email" name="email" type="email" required autoComplete="email" /></Field><Button type="submit" variant="secondary" disabled={busy || !hydrated}>Request verification email</Button></form> : <p className="text-sm text-muted">Email verification is not required on this installation.</p>}
    </>}
    <a className="mt-4 block text-sm text-red" href={`/login?next=${encodeURIComponent(destination)}`}>Back to sign in</a>
  </Card>;
}
