import { handle, json, parseBody } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { UpdateMarkerInput, deleteMarkers, updateMarker } from "@/lib/services/markers";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { marker: ["update"] });
  const input = await parseBody(req, UpdateMarkerInput);
  return json({ marker: await updateMarker(params.orgId!, params.projectId!, params.markerId!, session.user.id, input) });
});

export const DELETE = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { marker: ["update"] });
  const n = await deleteMarkers(params.orgId!, params.projectId!, session.user.id, [params.markerId!]);
  return n ? new Response(null, { status: 204 }) : json({ error: { code: "not_found", message: "marker not found", correlationId: "" } }, { status: 404 });
});
