import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(env().PUBLIC_STUDIO_URL).origin) return Response.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const { token } = await req.json();
    if (typeof token !== "string" || token.length > 4096) throw new Error("Invalid token");
    return await auth.api.verifyEmail({ query: { token }, headers: req.headers, asResponse: true });
  } catch {
    return Response.json({ error: "Verification link invalid or expired" }, { status: 400, headers: { "cache-control": "no-store" } });
  }
}
