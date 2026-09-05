import { describe, expect, it } from "vitest";
import { markMailDeliveryFailed, withMailDeliveryResponse } from "./mail-delivery-status";

describe("authentication mail delivery response", () => {
  it("reports a retryable failure when the provider catches a mail callback error", async () => {
    const response = await withMailDeliveryResponse(async () => {
      markMailDeliveryFailed();
      return Response.json({ status: true });
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ code: "EMAIL_DELIVERY_FAILED", message: "Email delivery failed. Please try again shortly." });
  });

  it("keeps concurrent mail failures isolated from successful requests", async () => {
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const success = Response.json({ status: true });
    const failed = withMailDeliveryResponse(async () => {
      markMailDeliveryFailed();
      await waiting;
      return Response.json({ status: true });
    });
    const unaffected = await withMailDeliveryResponse(async () => {
      await Promise.resolve();
      release();
      return success;
    });
    expect(unaffected).toBe(success);
    expect((await failed).status).toBe(503);
    expect(await withMailDeliveryResponse(async () => success)).toBe(success);
  });

  it("preserves provider errors and generic responses without a mail attempt", async () => {
    const providerError = Response.json({ code: "INVALID_ORIGIN" }, { status: 403 });
    expect(await withMailDeliveryResponse(async () => {
      markMailDeliveryFailed();
      return providerError;
    })).toBe(providerError);
    const generic = Response.json({ status: true, message: "Check your email if an account exists." });
    expect(await withMailDeliveryResponse(async () => generic)).toBe(generic);
  });
});
