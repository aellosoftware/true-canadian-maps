import { handle, json } from "@/lib/api";
import { getSession } from "@/lib/session";
import { listPresets } from "@/lib/services/styles";

export const dynamic = "force-dynamic";

/** Platform + public presets. Signed-in users also see their active organization's private presets. */
export const GET = handle(async (req) => {
  const session = await getSession(req.headers);
  const orgId = (session?.session as { activeOrganizationId?: string | null } | undefined)?.activeOrganizationId ?? null;
  const presets = await listPresets(orgId);
  return json({ presets }, { headers: { "cache-control": "private, max-age=60" } });
});
