import { describe, expect, it } from "vitest";
import { getEmbedRequestOrigin } from "./embed-request-origin";

describe("getEmbedRequestOrigin", () => {
  it("uses the browser Origin header for cross-origin embeds", () => {
    const req = new Request("https://api.example.ca/api/v1/embed/config", {
      headers: { origin: "https://www.example.ca" },
    });
    expect(getEmbedRequestOrigin(req)).toEqual({
      origin: "https://www.example.ca",
      corsOrigin: "https://www.example.ca",
    });
  });

  it("uses the request URL for same-origin embeds", () => {
    const req = new Request("https://maps.example.ca/api/v1/embed/config");
    expect(getEmbedRequestOrigin(req)).toEqual({
      origin: "https://maps.example.ca",
      corsOrigin: null,
    });
  });
});
