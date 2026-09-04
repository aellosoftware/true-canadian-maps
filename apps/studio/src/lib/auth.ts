import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { and, count, eq } from "drizzle-orm";
import { idForAuthModel } from "@tcm/shared";
import { invitations, users } from "@tcm/db";
import { ac, roles } from "./authz";
import { db, schema } from "./db";
import { env } from "./env";
import { sendMail } from "./mailer";
import { accountLink } from "./auth-links";

const e = env();
const studioOrigin = new URL(e.PUBLIC_STUDIO_URL).origin;
const apiOrigin = new URL(e.PUBLIC_API_URL).origin;

/**
 * Registration policy:
 *  - ALLOW_SIGNUP=true          anyone may register (hosted SaaS default)
 *  - ALLOW_SIGNUP=false         only the very first user (setup) or people holding a pending invitation
 */
async function assertSignupAllowed(email: string): Promise<void> {
  if (e.ALLOW_SIGNUP) return;
  const [row] = await db().select({ n: count() }).from(users);
  if (Number(row?.n ?? 0) === 0) return; // first-run setup
  const pending = await db()
    .select({ id: invitations.id })
    .from(invitations)
    .where(and(eq(invitations.email, email.toLowerCase()), eq(invitations.status, "pending")))
    .limit(1);
  if (pending.length > 0) return;
  throw new APIError("FORBIDDEN", { message: "Registration is by invitation only on this installation." });
}

export const auth = betterAuth({
  appName: "True Canadian Maps",
  baseURL: e.PUBLIC_STUDIO_URL,
  secret: e.BETTER_AUTH_SECRET,
  trustedOrigins: Array.from(new Set([studioOrigin, apiOrigin])),
  database: drizzleAdapter(db(), { provider: "pg", usePlural: true, schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    requireEmailVerification: e.REQUIRE_EMAIL_VERIFICATION,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, url, token }) {
      if (!e.PASSWORD_RECOVERY_ENABLED || !e.SMTP_URL || !e.SMTP_FROM) throw new APIError("SERVICE_UNAVAILABLE", { message: "Password recovery is not available on this installation." });
      await sendMail({
        to: user.email,
        subject: "Reset your True Canadian Maps password",
        text: `Hello ${user.name || ""},\n\nReset your password using this link (valid for one hour):\n${accountLink(e.PUBLIC_STUDIO_URL, "/reset-password", token, url)}\n\nIf you did not request this, you can ignore this message.`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: e.REQUIRE_EMAIL_VERIFICATION,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url, token }) {
      await sendMail({
        to: user.email,
        subject: "Verify your email for True Canadian Maps",
        text: `Hello ${user.name || ""},\n\nConfirm your email address:\n${accountLink(e.PUBLIC_STUDIO_URL, "/verify-email", token, url)}\n`,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
    // Check the database so password recovery revokes existing sessions immediately.
    cookieCache: { enabled: false },
  },
  advanced: {
    cookiePrefix: "tcm",
    database: { generateId: ({ model }) => idForAuthModel(model) },
    ...(e.COOKIE_DOMAIN ? { crossSubDomainCookies: { enabled: true, domain: e.COOKIE_DOMAIN } } : {}),
  },
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          await assertSignupAllowed(user.email);
          return { data: { ...user, email: user.email.toLowerCase() } };
        },
      },
    },
  },
  plugins: [
    organization({
      ac,
      roles,
      creatorRole: "owner",
      allowUserToCreateOrganization: true,
      invitationExpiresIn: 60 * 60 * 24 * 7,
      async sendInvitationEmail(data) {
        const link = `${e.PUBLIC_STUDIO_URL.replace(/\/$/, "")}/invite/${data.id}`;
        await sendMail({
          to: data.email,
          subject: `You're invited to ${data.organization.name} on True Canadian Maps`,
          text: `${data.inviter.user.name || data.inviter.user.email} invited you to join "${data.organization.name}" as ${data.role}.\n\nAccept the invitation:\n${link}\n\nThis link expires in 7 days.`,
        });
      },
    }),
    nextCookies(),
  ],
});

export type Auth = typeof auth;
export type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
