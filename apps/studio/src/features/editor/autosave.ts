import type { EditorDoc, EditorStore } from "./store";

type Save = (doc: EditorDoc, etag: string | null) => Promise<{ revision: number; etag: string | null }>;

/** One in-flight write per store, even across effect cleanup/remount. */
export function startAutosave(store: EditorStore, save: Save, delay = 1500) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  function schedule() {
    clearTimeout(timer);
    const state = store.getState();
    if (stopped || state.saveState !== "dirty" || state.saveInFlight) return;
    timer = setTimeout(() => { void run(); }, delay);
  }
  async function run() {
    const state = store.getState();
    if (stopped || state.saveState !== "dirty" || state.saveInFlight) return;
    const snapshot = structuredClone({ config: state.config, layerOverrides: state.layerOverrides });
    state.markSaving();
    try {
      const result = await save(snapshot, state.etag);
      store.getState().markSaved(result.revision, result.etag, snapshot);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed. Please retry.";
      if (err && typeof err === "object" && "status" in err && err.status === 412) store.getState().markConflict(message);
      else store.getState().markError(message);
    }
  }
  const unsubscribe = store.subscribe(schedule);
  schedule();
  return () => { stopped = true; clearTimeout(timer); unsubscribe(); };
}
