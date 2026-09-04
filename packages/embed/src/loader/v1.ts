/**
 * Tiny mutable loader: <script src="https://maps.example.com/embed/v1.js" defer>
 * Resolves its own base URL, injects the versioned CSS, imports the versioned core, mounts [data-tcm-map].
 * __TCM_VERSION__ is baked in at build time so the core URL is immutable.
 */
declare const __TCM_VERSION__: string;

(() => {
  const w = window as Window & { TCM?: unknown };
  if ((w as { __tcmLoaderRan?: boolean }).__tcmLoaderRan) return;
  (w as { __tcmLoaderRan?: boolean }).__tcmLoaderRan = true;

  const script = document.currentScript as HTMLScriptElement | null;
  const src = script?.src ?? (document.querySelector<HTMLScriptElement>('script[src*="/embed/v1.js"]')?.src ?? "");
  if (!src) { console.error("True Canadian Maps: cannot determine loader URL"); return; }
  const base = new URL(`./v1/${__TCM_VERSION__}/`, src).href;

  if (!document.querySelector(`link[href="${base}tcm.css"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${base}tcm.css`;
    document.head.appendChild(link);
  }

  const run = async () => {
    const core = (await import(/* @vite-ignore */ `${base}tcm.js`)) as { createMap: unknown; mountAll: (root?: ParentNode) => Promise<unknown[]>; version: string };
    w.TCM = { createMap: core.createMap, mount: core.mountAll, version: core.version };
    await core.mountAll().catch(() => {});
    document.dispatchEvent(new CustomEvent("tcm:loaded"));
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void run(), { once: true });
  else void run();
})();
