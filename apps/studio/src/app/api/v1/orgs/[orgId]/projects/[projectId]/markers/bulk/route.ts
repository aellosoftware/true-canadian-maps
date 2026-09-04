import { handle, json, parseBody } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { BulkMarkersInput, bulkUpsertMarkers } from "@/lib/services/markers";

export const dynamic = "force-dynamic";

export const POST = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { marker: ["update"] });
  const input = await parseBody(req, BulkMarkersInput);
  return json(await bulkUpsertMarkers(params.orgId!, params.projectId!, session.user.id, input), { status: 201 });
});
