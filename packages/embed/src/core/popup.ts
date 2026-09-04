import type { LocationRecord } from "./types";

const SAFE_URL = /^https?:\/\//i;

/** Structured popup rendered with DOM APIs only (no HTML injection from user data). */
export function renderPopup(loc: LocationRecord): HTMLElement {
  const root = document.createElement("div");
  root.className = "tcm-popup";
  const title = document.createElement("strong");
  title.className = "tcm-popup-title";
  title.textContent = loc.title;
  root.appendChild(title);
  if (loc.imageUrl && SAFE_URL.test(loc.imageUrl)) {
    const img = document.createElement("img");
    img.className = "tcm-popup-image";
    img.src = loc.imageUrl;
    img.alt = "";
    img.loading = "lazy";
    root.appendChild(img);
  }
  if (loc.description) {
    const p = document.createElement("p");
    p.className = "tcm-popup-desc";
    loc.description.split("\n").forEach((line, i) => {
      if (i) p.appendChild(document.createElement("br"));
      p.appendChild(document.createTextNode(line));
    });
    root.appendChild(p);
  }
  if (loc.link && SAFE_URL.test(loc.link.url)) {
    const a = document.createElement("a");
    a.className = "tcm-popup-link";
    a.href = loc.link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = loc.link.label;
    root.appendChild(a);
  }
  return root;
}
