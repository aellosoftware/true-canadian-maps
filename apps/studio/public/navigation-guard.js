// Register before the router: a cancelled traversal must not reach its listener.
window.addEventListener("popstate", function (event) {
  window.__TCM_NAVIGATION_GUARD__?.(event);
}, true);
