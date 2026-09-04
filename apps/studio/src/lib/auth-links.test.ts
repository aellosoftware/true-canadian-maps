import { expect, it } from "vitest";
import { accountLink } from "./auth-links";
it("keeps tokens out of request URLs while retaining a gallery destination", () => {
  const url = new URL(accountLink("https://studio.example.test", "/reset-password", "test-only-token", "https://studio.example.test/api/auth/reset-password/token?callbackURL=%2Freset-password%3Fnext%3D%252Fgallery%252Fdark%253Fapply%253D1"));
  expect(url.pathname).toBe("/reset-password");
  expect(url.search).toBe("");
  expect(new URLSearchParams(url.hash.slice(1)).get("next")).toBe("/gallery/dark?apply=1");
});
