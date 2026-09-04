"use client";
import { useEffect } from "react";
import { useEditor } from "./EditorContext";
import { hasUnsavedWork } from "./marker-writes";
type GuardWindow = Window & { __TCM_NAVIGATION_GUARD__?: (event: PopStateEvent) => void };

export function useUnsavedGuard() {
  const { store, project } = useEditor();
  useEffect(() => {
    const base = `/o/${project.orgSlug}/projects/${project.id}`;
    const staying = (url: URL) => url.origin === location.origin && (url.pathname === base || url.pathname.startsWith(`${base}/`));
    const confirmLeave = () => !hasUnsavedWork(store) || window.confirm("This map has unsaved changes. Leave and discard those changes? Stay to retry saving or download your draft.");
    const beforeUnload = (event: BeforeUnloadEvent) => { if (hasUnsavedWork(store)) { event.preventDefault(); event.returnValue = ""; } };
    const click = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.download || anchor.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
      if (!staying(new URL(anchor.href)) && !confirmLeave()) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    // Preserve Next's own history state and annotate entries to undo a cancelled
    // browser Back/Forward before Next receives the popstate event.
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    let index = 0;
    let restoring = false;
    originalReplace.call(history, { ...history.state, tcmGuardIndex: index }, "");
    const push: History["pushState"] = function (data, unused, url) { index++; originalPush.call(history, { ...data, tcmGuardIndex: index }, unused, url); };
    const replace: History["replaceState"] = function (data, unused, url) { originalReplace.call(history, { ...data, tcmGuardIndex: index }, unused, url); };
    history.pushState = push;
    history.replaceState = replace;
    const pop = (event: PopStateEvent) => {
      const next = typeof event.state?.tcmGuardIndex === "number" ? event.state.tcmGuardIndex : index - 1;
      if (restoring) { restoring = false; event.stopImmediatePropagation(); return; }
      if (!staying(new URL(location.href)) && !confirmLeave()) {
        event.stopImmediatePropagation();
        restoring = true;
        history.go(index - next || 1);
      } else index = next;
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    // The early listener runs before Next's traversal handler. A listener added
    // after entering the editor can run after the router has already navigated.
    (window as GuardWindow).__TCM_NAVIGATION_GUARD__ = pop;
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
      if ((window as GuardWindow).__TCM_NAVIGATION_GUARD__ === pop) delete (window as GuardWindow).__TCM_NAVIGATION_GUARD__;
      if (history.pushState === push) history.pushState = originalPush;
      if (history.replaceState === replace) history.replaceState = originalReplace;
    };
  }, [store, project.orgSlug, project.id]);
}
