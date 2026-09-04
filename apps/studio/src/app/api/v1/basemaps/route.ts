import { handle, json } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { listBasemaps } from "@/lib/services/styles";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  await requireSession(req.headers);
  return json({ basemaps: await listBasemaps() });
});
