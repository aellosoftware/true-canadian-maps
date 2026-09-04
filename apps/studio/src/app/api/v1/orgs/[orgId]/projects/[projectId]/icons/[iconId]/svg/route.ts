import { handle } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { readIconSvg } from "@/lib/services/icons";

export const dynamic = "force-dynamic";

/** Sanitized SVG source for the editor preview. */
export const GET = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { icon: ["read"] });
  const { svg } = await readIconSvg(params.orgId!, params.iconId!);
  return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "private, max-age=3600", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } });
});
