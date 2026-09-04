import { handle, json, parseBody } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { CreateKeyInput, createKey, listKeys } from "@/lib/services/keys";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { apikey: ["read"] });
  return json({ keys: await listKeys(params.orgId!, params.projectId!) });
});

export const POST = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { apikey: ["manage"] });
  const input = await parseBody(req, CreateKeyInput);
  return json({ key: await createKey(params.orgId!, params.projectId!, session.user.id, input) }, { status: 201 });
});
