import { handle, json, parseBody } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { ShareStyleInput, shareStyle } from "@/lib/services/gallery";
export const dynamic = "force-dynamic";
export const POST = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { style: ["update"] });
  const input = await parseBody(req, ShareStyleInput);
  return json({ style: await shareStyle(params.orgId!, params.projectId!, session.user.id, input) }, { status: 201 });
});
