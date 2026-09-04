import { clientInfo, handle, json, parseBody } from "@/lib/api";
import { CreateProjectInput } from "@/lib/dto";
import { requireMember, requireSession } from "@/lib/session";
import { createProject, listProjects } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { project: ["read"] });
  return json({ projects: await listProjects(params.orgId!) });
});

export const POST = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { project: ["create"] });
  const input = await parseBody(req, CreateProjectInput);
  const project = await createProject(params.orgId!, session.user.id, input, clientInfo(req));
  return json({ project }, { status: 201 });
});
