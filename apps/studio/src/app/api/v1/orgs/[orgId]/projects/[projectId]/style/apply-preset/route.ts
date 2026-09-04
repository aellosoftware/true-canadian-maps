import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { applyPresetToProject, styleEtag } from "@/lib/services/styles";

export const dynamic = "force-dynamic";

const Input = z.object({ preset: z.string().min(1), keepVisibility: z.boolean().optional(), keepMarkers: z.boolean().optional() });

export const POST = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { style: ["update"] });
  const input = await parseBody(req, Input);
  const style = await applyPresetToProject(params.orgId!, params.projectId!, session.user.id, input.preset, input);
  return json({ style }, { headers: { etag: styleEtag(style) } });
});
