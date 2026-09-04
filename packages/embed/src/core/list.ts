import { strings } from "./i18n";
import type { LocationRecord } from "./types";

/** Accessible location list: the primary path for screen-reader and keyboard users. */
export function renderList(target: HTMLElement, locations: LocationRecord[], locale: string | undefined, onSelect: (id: string) => void): { update(ids: Set<string> | null): void; announce(text: string): void } {
  const t = strings(locale);
  target.innerHTML = "";
  const section = document.createElement("section");
  section.className = "tcm-list";
  section.setAttribute("aria-label", t.locations);
  const live = document.createElement("p");
  live.className = "tcm-sr-only";
  live.setAttribute("aria-live", "polite");
  section.appendChild(live);
  const ul = document.createElement("ul");
  ul.className = "tcm-list-items";
  const items = new Map<string, HTMLLIElement>();
  for (const loc of locations) {
    const li = document.createElement("li");
    li.className = "tcm-list-item";
    li.dataset.id = loc.id;
    const h = document.createElement("h3");
    h.className = "tcm-list-title";
    h.textContent = loc.title;
    li.appendChild(h);
    if (loc.category) {
      const c = document.createElement("span");
      c.className = "tcm-list-category";
      c.textContent = loc.category;
      li.appendChild(c);
    }
    if (loc.description) {
      const p = document.createElement("p");
      p.className = "tcm-list-desc";
      p.textContent = loc.description;
      li.appendChild(p);
    }
    const actions = document.createElement("div");
    actions.className = "tcm-list-actions";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tcm-list-button";
    btn.textContent = t.showOnMap;
    btn.setAttribute("aria-label", `${t.showOnMap}: ${loc.title}`);
    btn.addEventListener("click", () => onSelect(loc.id));
    actions.appendChild(btn);
    if (loc.link && /^https?:\/\//i.test(loc.link.url)) {
      const a = document.createElement("a");
      a.className = "tcm-list-link";
      a.href = loc.link.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = loc.link.label;
      actions.appendChild(a);
    }
    li.appendChild(actions);
    ul.appendChild(li);
    items.set(loc.id, li);
  }
  if (locations.length === 0) {
    const p = document.createElement("p");
    p.className = "tcm-list-empty";
    p.textContent = t.noLocations;
    section.appendChild(p);
  }
  section.appendChild(ul);
  target.appendChild(section);
  return {
    update(ids) {
      for (const [id, li] of items) li.hidden = ids ? !ids.has(id) : false;
    },
    announce(text) {
      live.textContent = text;
    },
  };
}
