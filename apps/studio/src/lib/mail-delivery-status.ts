import { AsyncLocalStorage } from "node:async_hooks";

const deliveryStatus = new AsyncLocalStorage<{ failed: boolean }>();

/** Record only the outcome, never email content, addresses or authentication links. */
export function markMailDeliveryFailed(): void {
  const status = deliveryStatus.getStore();
  if (status) status.failed = true;
}

/** Better Auth awaits mail callbacks but catches their errors before returning 200. */
export function withMailDeliveryResponse(handler: () => Promise<Response>): Promise<Response> {
  return deliveryStatus.run({ failed: false }, async () => {
    const response = await handler();
    if (!deliveryStatus.getStore()?.failed || !response.ok) return response;
    return Response.json(
      { code: "EMAIL_DELIVERY_FAILED", message: "Email delivery failed. Please try again shortly." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  });
}
