import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { applyGalleryStyle } from "@/lib/services/gallery";
import { styleEtag } from "@/lib/services/styles";
export const dynamic = "force-dynamic";
export const POST = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { style: ["update"] });
  const { slug } = await parseBody(req, z.object({ slug: z.string().min(1) }));
  const style = await applyGalleryStyle(params.orgId!, params.projectId!, session.user.id, slug);
  return json({ style }, { headers: { etag: styleEtag(style) } });
});
