import { handle, json, parseBody } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { UpdateKeyInput, updateKey } from "@/lib/services/keys";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { apikey: ["manage"] });
  const input = await parseBody(req, UpdateKeyInput);
  return json({ key: await updateKey(params.orgId!, params.projectId!, params.keyId!, session.user.id, input) });
});
