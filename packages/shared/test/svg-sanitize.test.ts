import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "../src/svg-sanitize";

const good = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15" data-name="x"><!-- c --><path d="M1 1h13v13H1z" fill="#000" onclick2="no"/></svg>`;

describe("sanitizeSvg", () => {
  it("accepts a simple glyph and strips unknown attributes/comments", () => {
    const r = sanitizeSvg(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.width).toBe(15);
      expect(r.svg).not.toContain("data-name");
      expect(r.svg).not.toContain("<!--");
      expect(r.svg).toContain('<path d="M1 1h13v13H1z" fill="#000"');
    }
  });
  it("rejects scripts, handlers, external refs, images and styles", () => {
    for (const bad of [
      `<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>`,
      `<svg viewBox="0 0 1 1"><rect onload="x()" /></svg>`,
      `<svg viewBox="0 0 1 1"><use href="https://evil/x.svg#a"/></svg>`,
      `<svg viewBox="0 0 1 1"><image href="x.png"/></svg>`,
      `<svg viewBox="0 0 1 1"><style>rect{fill:red}</style></svg>`,
      `<svg viewBox="0 0 1 1"><foreignObject/></svg>`,
      `<!DOCTYPE svg [<!ENTITY x "y">]><svg viewBox="0 0 1 1"/>`,
      `<div>not svg</div>`,
    ]) expect(sanitizeSvg(bad).ok, bad).toBe(false);
  });
  it("requires dimensions and derives a viewBox from width/height", () => {
    expect(sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>`).ok).toBe(false);
    const r = sanitizeSvg(`<svg width="20" height="10"><path d="M0 0"/></svg>`);
    expect(r.ok && r.svg.includes('viewBox="0 0 20 10"')).toBe(true);
  });
  it("keeps local references only", () => {
    const r = sanitizeSvg(`<svg viewBox="0 0 2 2"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect fill="url(#g)" width="2" height="2"/><use href="#g"/></svg>`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.svg).toContain('href="#g"');
  });
});
