import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./safe-return";

describe("internal return destinations", () => {
  it("preserves a selected gallery style", () => expect(safeReturnPath("/gallery/dark?apply=1")).toBe("/gallery/dark?apply=1"));
  it.each(["//evil.test", "/\\evil.test", "/%5cevil.test", "/%2fexample.test", "javascript:alert(1)", "https://evil.test", "/%0a/evil.test", "/api/auth/sign-out", "/login", "/%252fexample.test"])("rejects %s", (path) => expect(safeReturnPath(path)).toBe("/"));
});
