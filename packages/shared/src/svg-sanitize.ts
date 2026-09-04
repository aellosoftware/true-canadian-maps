/**
 * Conservative SVG sanitizer for uploaded marker glyphs. DOM-free so it runs in API routes and the worker.
 * Policy: allow a small whitelist of shape/paint elements and attributes; reject anything that can execute
 * or load remote content. Returns the cleaned document or a list of reasons it was rejected.
 */
const ALLOWED_TAGS = new Set([
  "svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "defs", "clippath", "mask",
  "lineargradient", "radialgradient", "stop", "title", "desc", "symbol", "use",
]);
const ALLOWED_ATTRS = new Set([
  "viewbox", "width", "height", "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "points", "transform",
  "fill", "fill-rule", "fill-opacity", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke-dasharray",
  "opacity", "clip-path", "clip-rule", "mask", "id", "offset", "stop-color", "stop-opacity", "gradientunits", "gradienttransform", "xmlns", "xmlns:xlink", "href", "xlink:href",
]);
const MAX_BYTES = 64 * 1024;

export type SanitizeResult = { ok: true; svg: string; width: number; height: number } | { ok: false; reasons: string[] };

export function sanitizeSvg(input: string): SanitizeResult {
  const reasons: string[] = [];
  if (Buffer.byteLength(input, "utf8") > MAX_BYTES) reasons.push(`file is larger than ${MAX_BYTES / 1024} KB`);
  let s = input.replace(/^\uFEFF/, "").trim();
  if (!/^<\?xml[^>]*>\s*<svg[\s>]|^<svg[\s>]/i.test(s)) reasons.push("not an SVG document");
  if (/<!DOCTYPE|<!ENTITY/i.test(s)) reasons.push("DOCTYPE/ENTITY declarations are not allowed");
  if (/<script|<foreignObject|<iframe|<object|<embed|<image|<animate|<set\b|<video|<audio/i.test(s)) reasons.push("scripts, foreign objects, images, animations and media are not allowed");
  if (/\son[a-z]+\s*=/i.test(s)) reasons.push("event handler attributes are not allowed");
  if (/javascript:|data:(?!image\/svg)/i.test(s)) reasons.push("javascript: and data: URLs are not allowed");
  if (/url\(\s*['"]?\s*(https?:|\/\/)/i.test(s) || /(href)\s*=\s*['"]\s*(https?:|\/\/)/i.test(s)) reasons.push("external references are not allowed");
  if (/<style/i.test(s)) reasons.push("<style> blocks are not allowed; use presentation attributes");
  if (reasons.length) return { ok: false, reasons };

  // strip comments, processing instructions, and metadata
  s = s.replace(/<\?xml[^>]*>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<metadata[\s\S]*?<\/metadata>/gi, "").trim();

  // element whitelist
  const tags = [...s.matchAll(/<\/?([a-zA-Z][\w:-]*)/g)].map((m) => m[1]!.toLowerCase());
  const bad = [...new Set(tags.filter((t) => !ALLOWED_TAGS.has(t)))];
  if (bad.length) return { ok: false, reasons: [`unsupported elements: ${bad.join(", ")}`] };

  // attribute whitelist (drop unknown attributes rather than rejecting)
  s = s.replace(/<([a-zA-Z][\w:-]*)((?:\s+[^\s=>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g, (_m, tag: string, attrs: string, selfClose: string) => {
    const kept: string[] = [];
    for (const a of attrs.matchAll(/([^\s=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g)) {
      const name = a[1]!.toLowerCase();
      if (!ALLOWED_ATTRS.has(name)) continue;
      const val = a[2] ?? '""';
      if ((name === "href" || name === "xlink:href") && !/^["']?#/.test(val)) continue; // only local refs
      kept.push(`${a[1]}=${val}`);
    }
    return `<${tag}${kept.length ? " " + kept.join(" ") : ""}${selfClose ? " /" : ""}>`;
  });

  const vb = /viewBox="([^"]+)"/i.exec(s)?.[1]?.trim().split(/[\s,]+/).map(Number);
  let width = 0, height = 0;
  if (vb && vb.length === 4 && vb.every((n) => Number.isFinite(n))) { width = vb[2]!; height = vb[3]!; }
  else {
    const w = Number(/\swidth="([\d.]+)/i.exec(s)?.[1]), h = Number(/\sheight="([\d.]+)/i.exec(s)?.[1]);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) { width = w; height = h; s = s.replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`); }
  }
  if (!width || !height) return { ok: false, reasons: ["SVG needs a viewBox (or width and height)"] };
  if (!/xmlns=/.test(s)) s = s.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return { ok: true, svg: s, width, height };
}
