import { z } from "zod";
import { MarkerInputSchema } from "@tcm/style-compiler";
import { handle, json, parseBody } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { createMarker, deleteMarkers, listMarkers } from "@/lib/services/markers";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { marker: ["read"] });
  return json({ markers: await listMarkers(params.orgId!, params.projectId!) });
});

export const POST = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { marker: ["update"] });
  const input = await parseBody(req, MarkerInputSchema);
  return json({ marker: await createMarker(params.orgId!, params.projectId!, session.user.id, input) }, { status: 201 });
});

/** Bulk delete: { ids: [...] } */
export const DELETE = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { marker: ["update"] });
  const { ids } = await parseBody(req, z.object({ ids: z.array(z.string()).min(1).max(5000) }));
  return json({ deleted: await deleteMarkers(params.orgId!, params.projectId!, session.user.id, ids) });
});
