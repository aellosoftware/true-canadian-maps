import { describe, expect, it, vi } from "vitest";
import { isId, newId, parseId } from "../src/ids.js";
import { PUBLIC_KEY_PATTERN, newPublicKey } from "../src/public-key.js";

describe("ids", () => {
  it("keeps identifiers unique and ordered within one millisecond", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1788559600000);
    try {
      const ids = Array.from({ length: 1000 }, () => newId("project"));
      expect(new Set(ids).size).toBe(1000);
      expect(ids).toEqual([...ids].sort());
    } finally { now.mockRestore(); }
  });
  it("creates prefixed, sortable ids", () => {
    const a = newId("project");
    const b = newId("project");
    expect(a).toMatch(/^prj_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(a < b || a === b).toBe(true);
    expect(parseId(a)?.prefix).toBe("prj");
    expect(isId(a, "project")).toBe(true);
    expect(isId(a, "organization")).toBe(false);
    expect(isId("prj_short")).toBe(false);
    expect(isId("zzz_01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(false);
  });
});

describe("public keys", () => {
  it("generates well-formed keys", () => {
    const k = newPublicKey();
    expect(k).toMatch(PUBLIC_KEY_PATTERN);
    expect(newPublicKey("test").startsWith("pk_test_")).toBe(true);
  });
});
