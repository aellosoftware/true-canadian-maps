import { describe, expect, it } from "vitest";
import { isValidOriginRule, normalizeOrigin, originMatches } from "../src/origin.js";

describe("normalizeOrigin", () => {
  it("normalizes valid origins", () => {
    expect(normalizeOrigin("https://Example.com")).toBe("https://example.com");
    expect(normalizeOrigin("https://example.com/")).toBe("https://example.com");
    expect(normalizeOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });
  it("rejects non-origins", () => {
    expect(normalizeOrigin("ftp://x.com")).toBeNull();
    expect(normalizeOrigin("https://example.com/path")).toBeNull();
    expect(normalizeOrigin("not a url")).toBeNull();
  });
});

describe("originMatches", () => {
  const rules = ["https://example.com", "https://*.shop.ca", "http://localhost:*"];
  it("matches exact origins", () => {
    expect(originMatches("https://example.com", rules)).toBe(true);
    expect(originMatches("https://example.com:443", rules)).toBe(true);
  });
  it("requires scheme match", () => {
    expect(originMatches("http://example.com", rules)).toBe(false);
  });
  it("matches wildcard subdomains but not the apex", () => {
    expect(originMatches("https://www.shop.ca", rules)).toBe(true);
    expect(originMatches("https://a.b.shop.ca", rules)).toBe(true);
    expect(originMatches("https://shop.ca", rules)).toBe(false);
    expect(originMatches("https://evilshop.ca", rules)).toBe(false);
    expect(originMatches("https://www.shop.ca:8443", rules)).toBe(false);
  });
  it("matches localhost on any port", () => {
    expect(originMatches("http://localhost:5173", rules)).toBe(true);
    expect(originMatches("http://localhost", rules)).toBe(true);
    expect(originMatches("https://localhost:5173", rules)).toBe(false);
  });
  it("never matches a missing origin", () => {
    expect(originMatches(null, rules)).toBe(false);
    expect(originMatches("", rules)).toBe(false);
    expect(originMatches("https://example.com", [])).toBe(false);
  });
});

describe("isValidOriginRule", () => {
  it("accepts supported rule shapes", () => {
    expect(isValidOriginRule("https://example.com")).toBe(true);
    expect(isValidOriginRule("https://*.example.com")).toBe(true);
    expect(isValidOriginRule("http://localhost:*")).toBe(true);
  });
  it("rejects unsupported shapes", () => {
    expect(isValidOriginRule("*")).toBe(false);
    expect(isValidOriginRule("https://*")).toBe(false);
    expect(isValidOriginRule("example.com")).toBe(false);
    expect(isValidOriginRule("https://example.com/path")).toBe(false);
  });
});
