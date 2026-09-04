/** WCAG 2.x relative luminance / contrast helpers for hex colours. */
export function parseHex(hex: string): { r: number; g: number; b: number; a: number } | null {
  const m = /^#([0-9a-f]{3,8})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return null;
  const n = parseInt(h, 16);
  const hasA = h.length === 8;
  return {
    r: (n >> (hasA ? 24 : 16)) & 255,
    g: (n >> (hasA ? 16 : 8)) & 255,
    b: (n >> (hasA ? 8 : 0)) & 255,
    a: hasA ? (n & 255) / 255 : 1,
  };
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number | null {
  const c = parseHex(hex);
  if (!c) return null;
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function contrastLevel(ratio: number | null): "fail" | "aa-large" | "aa" | "aaa" | "unknown" {
  if (ratio === null) return "unknown";
  if (ratio >= 7) return "aaa";
  if (ratio >= 4.5) return "aa";
  if (ratio >= 3) return "aa-large";
  return "fail";
}
