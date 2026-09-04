"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { useHydrated } from "@/lib/use-hydrated";
import { authClient } from "@/lib/auth-client";
import { safeReturnPath } from "@/lib/safe-return";
import { usePublicConfig } from "@/components/ConfigProvider";

type ApiErrorBody = {
  error?: {
    message?: string;
    details?: Array<{ message?: string; path?: Array<string | number> }>;
  };
};

const FIELD_LABELS: Record<string, string> = {
  name: "Your name",
  email: "Email",
  password: "Password",
  organizationName: "Organization name",
};

function apiErrorMessage(body: ApiErrorBody | null, fallback: string): string {
  const issue = body?.error?.details?.[0];
  if (issue?.message) {
    const key = String(issue.path?.at(-1) ?? "");
    const label = FIELD_LABELS[key];
    return label ? `${label}: ${issue.message}` : issue.message;
  }
  return body?.error?.message ?? fallback;
}

function useSubmit() {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<{ error?: { message?: string } | null } | void>) {
    setPending(true);
    setError(null);
    try {
      const res = await fn();
      if (res && res.error) setError(res.error.message ?? "Something went wrong");
      return !(res && res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, error, run, hydrated };
}

export function LoginForm({ next, allowSignup }: { next?: string; allowSignup: boolean }) {
  const { passwordRecoveryAvailable } = usePublicConfig();
  const destination = safeReturnPath(next);
  const router = useRouter();
  const { pending, error, run, hydrated } = useSubmit();
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await run(() =>
      authClient.signIn.email({ email: String(f.get("email")), password: String(f.get("password")) }),
    );
    if (ok) router.push(destination);
  }
  return (
    <Card>
      <h1 className="mb-4 text-2xl font-bold">Sign in</h1>
      <form method="post" onSubmit={onSubmit} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" disabled={pending || !hydrated} className="w-full">{pending ? "Signing in…" : "Sign in"}</Button>
      </form>
      {passwordRecoveryAvailable ? <p className="mt-4 text-sm"><a className="font-semibold text-red" href={`/forgot-password?next=${encodeURIComponent(destination)}`}>Forgot password?</a></p> : null}
      {allowSignup ? (
        <p className="mt-4 text-sm text-muted">
          New here? <a className="font-semibold text-red" href={`/signup?next=${encodeURIComponent(destination)}`}>Create an account</a>
        </p>
      ) : null}
    </Card>
  );
}

export function SignupForm({ invitationId, next }: { invitationId?: string; next?: string }) {
  const destination = safeReturnPath(next);
  const router = useRouter();
  const { pending, error, run, hydrated } = useSubmit();
  const [done, setDone] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await run(() =>
      authClient.signUp.email({ name: String(f.get("name")), email: String(f.get("email")), password: String(f.get("password")), callbackURL: `/auth/confirmed?next=${encodeURIComponent(destination)}` }),
    );
    if (!ok) return;
    if (invitationId) {
      const accepted = await run(() => authClient.organization.acceptInvitation({ invitationId }));
      if (accepted) router.push(destination);
      return;
    }
    // If email verification is required the session may not exist yet.
    const session = await authClient.getSession();
    if (session.data) router.push(`/onboarding?next=${encodeURIComponent(destination)}`);
    else setDone(true);
  }
  if (done) {
    return (
      <Card>
        <h1 className="mb-2 text-2xl font-bold">Check your email</h1>
        <p className="text-sm text-muted">Open the verification link to finish creating your account. If it does not arrive, check spam or request a new link.</p><a className="mt-4 block text-sm text-red" href={`/verify-email?next=${encodeURIComponent(destination)}`}>Request another verification email</a>
      </Card>
    );
  }
  return (
    <Card>
      <h1 className="mb-4 text-2xl font-bold">Create your account</h1>
      <form method="post" onSubmit={onSubmit} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 10 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        </Field>
        <Button type="submit" disabled={pending || !hydrated} className="w-full">{pending ? "Creating…" : "Create account"}</Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already have an account? <a className="font-semibold text-red" href={`/login?next=${encodeURIComponent(destination)}`}>Sign in</a>
      </p>
    </Card>
  );
}

export function SetupForm() {
  const router = useRouter();
  const { pending, error, run, hydrated } = useSubmit();
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await run(async () => {
      const res = await fetch("/api/v1/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: f.get("name"),
          email: f.get("email"),
          password: f.get("password"),
          organizationName: f.get("organizationName"),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
        return { error: { message: apiErrorMessage(body, `Setup failed (${res.status})`) } };
      }
      return;
    });
    if (ok) router.push("/");
  }
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wider text-red">First-run setup</p>
      <h1 className="mb-1 text-2xl font-bold">Create the administrator account</h1>
      <p className="mb-4 text-sm text-muted">This page disappears once the first account exists.</p>
      <form method="post" onSubmit={onSubmit} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Your name" htmlFor="name"><Input id="name" name="name" autoComplete="name" required /></Field>
        <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Password" htmlFor="password" hint="At least 10 characters.">
          <Input id="password" name="password" type="password" minLength={10} required autoComplete="new-password" />
        </Field>
        <Field label="Organization name" htmlFor="organizationName" hint="Your team or company. You can add more later.">
          <Input id="organizationName" name="organizationName" autoComplete="organization" required />
        </Field>
        <Button type="submit" disabled={pending || !hydrated} className="w-full">{pending ? "Setting up…" : "Finish setup"}</Button>
      </form>
    </Card>
  );
}

export function CreateOrganizationForm({ next }: { next?: string }) {
  const router = useRouter();
  const { pending, error, run, hydrated } = useSubmit();
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    let slug = "";
    const ok = await run(async () => {
      const res = await fetch("/api/v1/orgs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: f.get("name") }),
      });
      const body = (await res.json().catch(() => null)) as { organization?: { slug: string }; error?: { message?: string } } | null;
      if (!res.ok) return { error: { message: body?.error?.message ?? `Failed (${res.status})` } };
      slug = body?.organization?.slug ?? "";
      return;
    });
    if (ok) router.push(safeReturnPath(next, `/o/${slug}`) === "/" ? `/o/${slug}` : safeReturnPath(next));
  }
  return (
    <Card>
      <h1 className="mb-1 text-2xl font-bold">Create an organization</h1>
      <p className="mb-4 text-sm text-muted">Maps, team members and keys live inside an organization.</p>
      <form method="post" onSubmit={onSubmit} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Organization name" htmlFor="name"><Input id="name" name="name" autoComplete="organization" required /></Field>
        <Button type="submit" disabled={pending || !hydrated} className="w-full">{pending ? "Creating…" : "Create organization"}</Button>
      </form>
    </Card>
  );
}

export function AcceptInvitation({ invitationId, organizationName, role, email }: { invitationId: string; organizationName: string; role: string; email: string }) {
  const router = useRouter();
  const { pending, error, run, hydrated } = useSubmit();
  async function accept() {
    const ok = await run(() => authClient.organization.acceptInvitation({ invitationId }));
    if (ok) router.push("/");
  }
  return (
    <Card>
      <h1 className="mb-2 text-2xl font-bold">Join {organizationName}</h1>
      <p className="mb-4 text-sm text-muted">
        You were invited as <strong>{role}</strong> ({email}).
      </p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button onClick={accept} disabled={pending || !hydrated} className="mt-2 w-full">{pending ? "Joining…" : "Accept invitation"}</Button>
    </Card>
  );
}
