import { handle, json } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { getEnvironments, listReleases } from "@/lib/services/releases";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { project: ["read"] });
  const [releases, environments] = await Promise.all([listReleases(params.orgId!, params.projectId!), getEnvironments(params.orgId!, params.projectId!)]);
  return json({ releases, environments });
});
