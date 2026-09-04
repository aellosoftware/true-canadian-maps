/**
 * Pin composer: wraps a 15x15 glyph (or nothing) in the brand pin silhouette.
 * Output is a self-contained SVG string, identical in browser and Node, so
 * editor previews and published sprites match pixel-for-pixel (modulo AA).
 */
export type PinShape = "pin" | "circle" | "square";

export interface ComposeOptions {
  /** Inner glyph SVG (15x15 viewBox). Omit for a plain pin with a white dot. */
  glyphSvg?: string | null;
  color: string;
  shape?: PinShape;
  /** CSS pixel size of the longest side at 1x. */
  size?: number;
  glyphColor?: string;
  outlineColor?: string;
}

export const PIN_WIDTH = 24;
export const PIN_HEIGHT = 32;

/** Extract inner markup + viewBox from a glyph SVG string. */
export function glyphInner(svg: string): { inner: string; viewBox: string } {
  const vb = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? "0 0 15 15";
  const m = /<svg[^>]*>([\s\S]*?)<\/svg>/i.exec(svg);
  return { inner: (m?.[1] ?? "").trim(), viewBox: vb };
}

export function composePinSvg(opts: ComposeOptions): string {
  const shape = opts.shape ?? "pin";
  const glyph = opts.glyphSvg ? glyphInner(opts.glyphSvg) : null;
  const glyphColor = opts.glyphColor ?? "#ffffff";
  const outline = opts.outlineColor ?? "rgba(16,45,60,0.35)";
  const size = opts.size ?? PIN_HEIGHT;
  const scale = size / PIN_HEIGHT;
  const w = Math.round(PIN_WIDTH * scale * 100) / 100;
  const h = Math.round(PIN_HEIGHT * scale * 100) / 100;

  let body = "";
  let glyphBox = { x: 4.5, y: 4, s: 15 }; // where the 15x15 glyph is placed inside the 24x32 pin
  if (shape === "pin") {
    body = `<path d="M12 31C12 31 1 18 1 11.5C1 5.5 6 1 12 1C18 1 23 5.5 23 11.5C23 18 12 31 12 31Z" fill="${opts.color}" stroke="${outline}" stroke-width="1.5"/>`;
    glyphBox = { x: 4.5, y: 4, s: 15 };
  } else if (shape === "circle") {
    body = `<circle cx="12" cy="16" r="11" fill="${opts.color}" stroke="${outline}" stroke-width="1.5"/>`;
    glyphBox = { x: 4.5, y: 8.5, s: 15 };
  } else {
    body = `<rect x="1.5" y="5.5" width="21" height="21" rx="4" fill="${opts.color}" stroke="${outline}" stroke-width="1.5"/>`;
    glyphBox = { x: 4.5, y: 8.5, s: 15 };
  }
  const content = glyph
    ? `<svg x="${glyphBox.x}" y="${glyphBox.y}" width="${glyphBox.s}" height="${glyphBox.s}" viewBox="${glyph.viewBox}" fill="${glyphColor}" color="${glyphColor}">${glyph.inner}</svg>`
    : shape === "pin"
      ? `<circle cx="12" cy="11.5" r="4.2" fill="${glyphColor}"/>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${PIN_WIDTH} ${PIN_HEIGHT}">${body}${content}</svg>`;
}

/** Anchor point (bottom tip of the pin) as a fraction of height; circles/squares are centre-anchored. */
export function pinAnchor(shape: PinShape = "pin"): "bottom" | "center" {
  return shape === "pin" ? "bottom" : "center";
}
