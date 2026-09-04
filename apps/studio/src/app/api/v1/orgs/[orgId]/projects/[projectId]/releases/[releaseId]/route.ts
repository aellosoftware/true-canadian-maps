import { handle, json } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { getRelease } from "@/lib/services/releases";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { project: ["read"] });
  return json({ release: await getRelease(params.orgId!, params.projectId!, params.releaseId!) });
});
