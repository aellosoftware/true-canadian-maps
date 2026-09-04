import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ArtifactExistsError, FsArtifactStore } from "../src";

const root = mkdtempSync(path.join(tmpdir(), "tcm-store-"));
const store = new FsArtifactStore(root);
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("FsArtifactStore", () => {
  it("writes, reads and hashes", async () => {
    const r = await store.put("t/org/prj/rel/style.json", '{"a":1}', { contentType: "application/json" });
    expect(r.size).toBe(7);
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(new TextDecoder().decode((await store.get("t/org/prj/rel/style.json"))!)).toBe('{"a":1}');
    expect(await store.exists("t/org/prj/rel/style.json")).toBe(true);
    expect(await store.get("nope.json")).toBeNull();
  });
  it("refuses to overwrite immutable keys unless told otherwise", async () => {
    await expect(store.put("t/org/prj/rel/style.json", "x", { contentType: "text/plain" })).rejects.toBeInstanceOf(ArtifactExistsError);
    await store.put("p/prj/production.json", "v1", { contentType: "application/json", ifNoneMatch: false });
    await store.put("p/prj/production.json", "v2", { contentType: "application/json", ifNoneMatch: false });
    expect(new TextDecoder().decode((await store.get("p/prj/production.json"))!)).toBe("v2");
  });
  it("lists and deletes by prefix", async () => {
    await store.put("t/org/prj/rel/markers.geojson", "{}", { contentType: "application/geo+json" });
    expect(await store.list("t/org/prj/rel/")).toEqual(["t/org/prj/rel/markers.geojson", "t/org/prj/rel/style.json"]);
    expect(await store.deletePrefix("t/org/prj/rel/")).toBe(2);
    expect(await store.list("t/org/prj/rel/")).toEqual([]);
  });
  it("rejects unsafe keys", async () => {
    await expect(store.put("../escape", "x", { contentType: "text/plain" })).rejects.toThrow(/invalid artifact key/);
    await expect(store.put("/abs", "x", { contentType: "text/plain" })).rejects.toThrow(/invalid artifact key/);
    await expect(store.put("a/../../b", "x", { contentType: "text/plain" })).rejects.toThrow(/invalid artifact key/);
    await expect(store.put("with space.json", "x", { contentType: "text/plain" })).rejects.toThrow(/invalid artifact key/);
  });
});
