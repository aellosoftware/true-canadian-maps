import { handle, json } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { markersGeoJSON } from "@/lib/services/markers";

export const dynamic = "force-dynamic";

/** Draft markers as GeoJSON for the editor preview. */
export const GET = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { marker: ["read"] });
  return json(await markersGeoJSON(params.orgId!, params.projectId!), { headers: { "content-type": "application/geo+json; charset=utf-8" } });
});
