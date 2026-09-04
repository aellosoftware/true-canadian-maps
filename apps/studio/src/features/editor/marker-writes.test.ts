import { expect, it, vi } from "vitest";
import { defaultConfig } from "@tcm/style-compiler";
import { createEditorStore } from "./store";
import { hasUnsavedWork, retryMarkerWrites, writeMarkers } from "./marker-writes";
it("retains failed and queued marker operations and blocks publishing until retry succeeds", async () => {
  const store = createEditorStore({ orgId: "o", projectId: "p", doc: { config: defaultConfig(), layerOverrides: null }, revision: 1, etag: '"one"' });
  const first = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  const second = vi.fn().mockResolvedValue(undefined);
  await writeMarkers(store, "Marker update", first).catch(() => {});
  const pending = writeMarkers(store, "Marker import", second);
  expect(second).not.toHaveBeenCalled();
  expect(hasUnsavedWork(store)).toBe(true);
  expect(store.getState().markerPending).toBe(2);
  retryMarkerWrites(store);
  await pending;
  expect(first).toHaveBeenCalledTimes(2);
  expect(second).toHaveBeenCalledTimes(1);
  expect(hasUnsavedWork(store)).toBe(false);
});
