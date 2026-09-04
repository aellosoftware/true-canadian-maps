import { clientInfo, handle, json, parseBody } from "@/lib/api";
import { UpdateProjectInput } from "@/lib/dto";
import { requireMember, requireSession } from "@/lib/session";
import { deleteProject, getProject, updateProject } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { project: ["read"] });
  return json({ project: await getProject(params.orgId!, params.projectId!) });
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { project: ["update"] });
  const input = await parseBody(req, UpdateProjectInput);
  return json({ project: await updateProject(params.orgId!, params.projectId!, session.user.id, input, clientInfo(req)) });
});

export const DELETE = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { project: ["delete"] });
  await deleteProject(params.orgId!, params.projectId!, session.user.id, clientInfo(req));
  return new Response(null, { status: 204 });
});
