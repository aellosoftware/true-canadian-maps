import { handle, json } from "@/lib/api";
import { getGalleryStyle } from "@/lib/services/gallery";
export const dynamic = "force-dynamic";
export const GET = handle(async (_req, { params }) => json(await getGalleryStyle(params.slug!), { headers: { "cache-control": "public, max-age=60" } }));
