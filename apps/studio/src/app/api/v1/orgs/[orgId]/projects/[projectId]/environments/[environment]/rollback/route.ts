import { z } from "zod";
import { clientInfo, handle, json, parseBody } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { rollback } from "@/lib/services/releases";

export const dynamic = "force-dynamic";

export const POST = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { project: ["publish"] });
  const { releaseId } = await parseBody(req, z.object({ releaseId: z.string().min(1) }));
  const environment = await rollback(params.orgId!, params.projectId!, session.user.id, params.environment!, releaseId, clientInfo(req));
  return json({ environment });
});
