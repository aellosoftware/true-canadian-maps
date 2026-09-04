import { z } from "zod";
import { LayerOverridesSchema, StyleConfigSchema } from "@tcm/style-compiler";
import { handle, json, parseBody } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { getStyle, saveStyle, styleEtag } from "@/lib/services/styles";

export const dynamic = "force-dynamic";

const PutStyleInput = z.object({
  config: StyleConfigSchema,
  layerOverrides: LayerOverridesSchema.nullable().optional(),
  presetId: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(80).optional(),
});

export const GET = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { style: ["read"] });
  const style = await getStyle(params.orgId!, params.projectId!);
  return json({ style }, { headers: { etag: styleEtag(style) } });
});

export const PUT = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { style: ["update"] });
  const input = await parseBody(req, PutStyleInput);
  const style = await saveStyle(params.orgId!, params.projectId!, session.user.id, input, req.headers.get("if-match"));
  return json({ style }, { headers: { etag: styleEtag(style) } });
});
