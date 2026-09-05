import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { publicConfig } from "@/lib/public-config";
import { withMailDeliveryResponse } from "@/lib/mail-delivery-status";

export const dynamic = "force-dynamic";
const handlers = toNextJsHandler(auth);
export const GET = handlers.GET;
export async function POST(req: Request) {
  if (new URL(req.url).pathname.endsWith("/request-password-reset") && !publicConfig().passwordRecoveryAvailable) {
    return Response.json({ message: "Password recovery is not available on this installation." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  return withMailDeliveryResponse(() => handlers.POST(req));
}
