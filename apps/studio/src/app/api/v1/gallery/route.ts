import { handle, json } from "@/lib/api";
import { listGallery } from "@/lib/services/gallery";
export const dynamic = "force-dynamic";
export const GET = handle(async () => json({ styles: await listGallery() }, { headers: { "cache-control": "public, max-age=60" } }));
