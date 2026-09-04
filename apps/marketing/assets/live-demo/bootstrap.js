/* Own the deadline before fetching any renderer modules or map data. */
(() => {
  const root = document.querySelector("[data-live-demo]");
  if (!root) return;
  const canvas = root.querySelector("[data-live-map]");
  const status = root.querySelector("[data-map-status]");
  const failure = root.querySelector("[data-map-error]");
  let current;

  function start() {
    current?.abort();
    const controller = new AbortController();
    current = controller;
    let ready = false;
    const controls = root.querySelectorAll("[data-map-location], [data-map-reset]");
    controls.forEach((button) => { button.disabled = true; });
    root.classList.remove("map-failed", "map-ready");
    failure.hidden = true;
    canvas.setAttribute("aria-busy", "true");
    status.lastChild.textContent = " Loading map";
    status.classList.remove("ready");
    const fail = () => {
      if (current !== controller || controller.signal.aborted) return;
      controller.abort();
      clearTimeout(deadline);
      root.classList.remove("map-ready");
      root.classList.add("map-failed");
      canvas.setAttribute("aria-busy", "false");
      failure.hidden = false;
      controls.forEach((button) => { button.disabled = true; });
      status.lastChild.textContent = " Static preview";
      status.classList.remove("ready");
    };
    const deadline = setTimeout(fail, 12000);
    controller.signal.addEventListener("abort", () => clearTimeout(deadline), { once: true });
    // Cache-bust the small entry module on retry: a failed import is otherwise cached.
    const entry = new URL("/assets/live-demo/live-map.js", location.origin);
    entry.searchParams.set("attempt", String(Date.now()));
    import(entry.href).then(({ mountLiveMap }) => {
      if (controller.signal.aborted) return;
      return mountLiveMap({ root, signal: controller.signal, fail, onReady() {
        if (controller.signal.aborted || ready) return;
        ready = true;
        clearTimeout(deadline);
        root.classList.add("map-ready");
        canvas.setAttribute("aria-busy", "false");
        controls.forEach((button) => { button.disabled = false; });
        status.lastChild.textContent = " Live map";
        status.classList.add("ready");
      } });
    }).catch(fail);
  }
  root.querySelector("[data-map-retry]").addEventListener("click", start);
  root.querySelector("[data-map-style]")?.addEventListener("change", start);
  start();
})();
