const PUBLIC_MAPS_ORIGIN = "https://maps.truecanadianmaps.com";
const RELEASE_PATH = "/assets/live-demo/export/";
const MARKER_LAYER = "tcm-markers";
const INITIAL_BOUNDS = [[-76.1, 45.0], [-70.7, 47.2]];
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const releaseUrl = new URL(RELEASE_PATH, window.location.origin);

function rewriteExportUrl(value) {
  if (typeof value !== "string") return value;
  if (value.includes("/assets/live-demo/export/")) return new URL(value.split("/assets/live-demo/export/")[1], releaseUrl).href;
  const publishedRelease = value.match(/\/t\/.*\/rel_[^/]+\/(.*)$/);
  if (publishedRelease) return new URL(publishedRelease[1], releaseUrl).href;
  return value.replace("http://localhost:8081", PUBLIC_MAPS_ORIGIN);
}

function loadProtocol(signal) {
  if (globalThis.pmtiles) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `/assets/live-demo/pmtiles-global.js?attempt=${Date.now()}`;
    script.onload = () => { script.remove(); resolve(); };
    script.onerror = () => { script.remove(); reject(new Error("Protocol download failed")); };
    signal.addEventListener("abort", () => { script.remove(); reject(signal.reason); }, { once: true });
    document.head.append(script);
  });
}

function popupContent(properties) {
  const content = document.createElement("div");
  content.className = "demo-popup";
  const kicker = document.createElement("span");
  kicker.textContent = properties.category || "Public location";
  const title = document.createElement("strong");
  title.textContent = properties.title || "Map location";
  content.append(kicker, title);
  return content;
}

export async function mountLiveMap({ root, signal, fail, onReady }) {
  const container = root.querySelector("[data-live-map]");
  const moduleUrl = new URL(".", import.meta.url);
  const rendererUrl = new URL("maplibre-gl.mjs", moduleUrl);
  rendererUrl.search = new URL(import.meta.url).search;
  const selectedStyle = root.querySelector("[data-map-style]")?.value || "light";
  const styleFile = { light: "style.json", "true-north": "true-north.json", "sand-and-sage": "sand-and-sage.json" }[selectedStyle] || "style.json";
  const [renderer, , styleResponse, markerResponse] = await Promise.all([
    import(rendererUrl.href), loadProtocol(signal),
    fetch(new URL(styleFile, releaseUrl), { signal, cache: "no-cache" }),
    fetch(new URL("markers.geojson", releaseUrl), { signal, cache: "no-cache" }),
  ]);
  if (signal.aborted) return;
  if (!styleResponse.ok || !markerResponse.ok) throw new Error("Map artifacts unavailable");
  const [style, markers] = await Promise.all([styleResponse.json(), markerResponse.json()]);
  if (signal.aborted) return;
  const { Map, NavigationControl, FullscreenControl, Popup, addProtocol, setWorkerUrl } = renderer;
  style.glyphs = rewriteExportUrl(style.glyphs);
  style.sprite = Array.isArray(style.sprite)
    ? style.sprite.map((sprite) => ({ ...sprite, url: rewriteExportUrl(sprite.url) }))
    : rewriteExportUrl(style.sprite);
  style.sources.basemap.url = rewriteExportUrl(style.sources.basemap.url);
  style.sources[MARKER_LAYER].data = markers;
  setWorkerUrl(new URL("maplibre-gl-worker.mjs", moduleUrl).href);
  addProtocol("pmtiles", new globalThis.pmtiles.Protocol().tile);
  let map;
  try {
    map = new Map({
      container, style, bounds: INITIAL_BOUNDS,
      fitBoundsOptions: { padding: 58, duration: 0 }, minZoom: 2, maxZoom: 15,
      maxPitch: 0, cooperativeGestures: true,
      attributionControl: { compact: true }, validateStyle: false,
    });
  } catch (error) {
    container.replaceChildren();
    throw error;
  }
  signal.addEventListener("abort", () => map.remove(), { once: true });
  if (signal.aborted) { map.remove(); return; }
  map.addControl(new NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new FullscreenControl(), "top-right");
  map.on("error", fail);
  map.getCanvas().addEventListener("webglcontextlost", fail, { signal });
  map.once("load", onReady);
  let popup;
  const locations = new globalThis.Map(markers.features.map((feature) => [String(feature.properties.id), feature]));
  function selectLocation(id, move = true) {
    if (signal.aborted) return;
    const feature = locations.get(String(id));
    if (!feature) return;
    popup?.remove();
    popup = new Popup({ offset: 27, maxWidth: "260px", focusAfterOpen: true })
      .setLngLat(feature.geometry.coordinates).setDOMContent(popupContent(feature.properties)).addTo(map);
    if (move) map.flyTo({ center: feature.geometry.coordinates, zoom: Math.max(map.getZoom(), 6.4), duration: REDUCED_MOTION ? 0 : 850 });
    root.querySelectorAll("[data-map-location]").forEach((button) => button.classList.toggle("active", button.dataset.mapLocation === String(id)));
  }
  map.on("click", MARKER_LAYER, (event) => {
    const id = event.features?.[0]?.properties?.id;
    if (id) selectLocation(id, false);
  });
  map.on("mouseenter", MARKER_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", MARKER_LAYER, () => { map.getCanvas().style.cursor = ""; });
  root.querySelectorAll("[data-map-location]").forEach((button) => {
    button.addEventListener("click", () => selectLocation(button.dataset.mapLocation), { signal });
  });
  root.querySelector("[data-map-reset]").addEventListener("click", () => {
    popup?.remove();
    root.querySelectorAll("[data-map-location]").forEach((button) => button.classList.remove("active"));
    map.fitBounds(INITIAL_BOUNDS, { padding: { top: 72, right: 58, bottom: 72, left: 58 }, duration: REDUCED_MOTION ? 0 : 700 });
  }, { signal });
}
