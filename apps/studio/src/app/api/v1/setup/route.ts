import { ApiError } from "@tcm/shared";
import { handle, json, parseBody } from "@/lib/api";
import { auth } from "@/lib/auth";
import { SetupInput } from "@/lib/dto";
import { recordAudit } from "@/lib/services/audit";
import { needsSetup } from "@/lib/services/setup";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

/** First-run: create the initial administrator and their organization. Locks itself once a user exists. */
export const GET = handle(async () => json({ needsSetup: await needsSetup() }));

export const POST = handle(async (req) => {
  if (!(await needsSetup())) throw new ApiError("conflict", "setup has already been completed");
  const input = await parseBody(req, SetupInput);

  const signUp = await auth.api.signUpEmail({
    body: { name: input.name, email: input.email, password: input.password },
    returnHeaders: true,
  });
  // Server-side call on behalf of the new user (no session cookie juggling).
  const org = await auth.api.createOrganization({
    body: { name: input.organizationName, slug: slugify(input.organizationName), userId: signUp.response.user.id },
  });
  if (!org) throw new Error("organization creation failed");
  await recordAudit({ organizationId: org.id, actorUserId: signUp.response.user.id, actorType: "system", action: "installation.setup", targetType: "organization", targetId: org.id });

  const res = json({ user: { id: signUp.response.user.id, email: signUp.response.user.email }, organization: { id: org.id, slug: org.slug, name: org.name } }, { status: 201 });
  // Better Auth sets the durable session token and the short-lived session cache
  // as separate cookies. Keep them separate: collapsing Set-Cookie values into one
  // header can make the durable token inherit the cache's five-minute lifetime.
  for (const cookie of signUp.headers.getSetCookie()) res.headers.append("set-cookie", cookie);
  return res;
});
