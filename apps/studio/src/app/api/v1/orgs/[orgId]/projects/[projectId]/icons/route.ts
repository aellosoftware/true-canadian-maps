import { ApiError } from "@tcm/shared";
import { handle, json } from "@/lib/api";
import { requireMember, requireSession } from "@/lib/session";
import { listIcons, uploadIcon } from "@/lib/services/icons";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { icon: ["read"] });
  return json({ icons: await listIcons(params.orgId!, params.projectId!) });
});

/** multipart/form-data: file=<svg>, name=<optional>; or JSON { name, svg } */
export const POST = handle(async (req, { params }) => {
  const session = await requireSession(req.headers);
  await requireMember(params.orgId!, session.user.id, { icon: ["update"] });
  const ct = req.headers.get("content-type") ?? "";
  let name = "icon", svg = "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("bad_request", "file field is required");
    if (file.size > 64 * 1024) throw new ApiError("payload_too_large", "SVG files are limited to 64 KB");
    name = String(form.get("name") ?? file.name ?? "icon");
    svg = await file.text();
  } else {
    const body = (await req.json().catch(() => null)) as { name?: string; svg?: string } | null;
    if (!body?.svg) throw new ApiError("bad_request", "svg is required");
    name = body.name ?? "icon"; svg = body.svg;
  }
  return json({ icon: await uploadIcon(params.orgId!, params.projectId!, session.user.id, name, svg) }, { status: 201 });
});
