import { handle } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { deleteIcon } from "@/lib/services/icons";

export const dynamic = "force-dynamic";

export const DELETE = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { icon: ["update"] });
  await deleteIcon(params.orgId!, params.projectId!, params.iconId!, session.user.id);
  return new Response(null, { status: 204 });
});
