import type { EditorStore } from "./store";

interface Job { label: string; key?: string; retrySafe: boolean; run: () => Promise<void>; resolve: () => void; reject: (error: unknown) => void }
const queues = new WeakMap<EditorStore, { jobs: Job[]; active: boolean; failed: boolean }>();
function queueFor(store: EditorStore) {
  let queue = queues.get(store);
  if (!queue) { queue = { jobs: [], active: false, failed: false }; queues.set(store, queue); }
  return queue;
}
async function drain(store: EditorStore) {
  const queue = queueFor(store);
  if (queue.active || queue.failed) return;
  queue.active = true;
  try {
    while (queue.jobs.length) {
      const job = queue.jobs[0]!;
      try { await job.run(); }
      catch (error) {
        queue.failed = true;
        store.setState({ markerRequiresReload: !job.retrySafe, markerError: job.retrySafe ? `${job.label} failed. Your pending changes are retained. Retry when the connection is available.` : `${job.label} could not be confirmed. Reload server locations before trying again, because the request may have completed.` });
        job.reject(error);
        return;
      }
      queue.jobs.shift();
      store.setState({ markerPending: queue.jobs.length, markerError: null });
      job.resolve();
    }
  } finally { queue.active = false; }
}
/** Serialize all marker mutations. A failed job and later jobs remain queued. */
export function writeMarkers(store: EditorStore, label: string, run: () => Promise<void>, options: { key?: string; retrySafe?: boolean } = {}): Promise<void> {
  const queue = queueFor(store);
  if (queue.failed && options.key && queue.jobs[0]?.key === options.key && queue.jobs[0]?.retrySafe) {
    queue.jobs.shift(); queue.failed = false; store.setState({ markerError: null });
  }
  const result = new Promise<void>((resolve, reject) => queue.jobs.push({ label, run, resolve, reject, key: options.key, retrySafe: options.retrySafe !== false }));
  store.setState({ markerPending: queue.jobs.length });
  void drain(store);
  return result;
}
export function retryMarkerWrites(store: EditorStore) {
  const queue = queueFor(store);
  if (queue.active || store.getState().markerRequiresReload) return;
  queue.failed = false;
  store.setState({ markerError: null });
  void drain(store);
}
export function discardMarkerWrites(store: EditorStore) {
  const queue = queueFor(store);
  if (queue.active) throw new Error("Location writes are still active");
  for (const job of queue.jobs) job.reject(new Error("Pending location changes discarded after confirmation"));
  queue.jobs = []; queue.failed = false;
  store.setState({ markerPending: 0, markerError: null, markerRequiresReload: false, markerDrafts: {} });
}
export function hasUnsavedWork(store: EditorStore) {
  const state = store.getState();
  return state.saveState !== "saved" || state.saveInFlight || state.markerPending > 0 || Boolean(state.markerError) || Object.keys(state.markerDrafts).length > 0;
}
