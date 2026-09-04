import { z } from "zod";
import { clientInfo, handle, json } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { requestPublish } from "@/lib/services/releases";

export const dynamic = "force-dynamic";

const Body = z.object({ environment: z.enum(["production"]).default("production") });

export const POST = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { project: ["publish"] });
  const raw = await req.text();
  const input = Body.parse(raw ? JSON.parse(raw) : {});
  const release = await requestPublish(params.orgId!, params.projectId!, session.user.id, input.environment, clientInfo(req));
  return json({ release }, { status: 202 });
});
