/**
 * Sprite sheet builder: SVG marker images -> sprite.png/.json (+ @2x), MapLibre sprite index format.
 * Pure JS/WASM (resvg-wasm, potpack, fast-png): no native dependencies in the worker image.
 */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { decode, encode } from "fast-png";
import potpack from "potpack";

export interface SpriteInput { name: string; svg: string; /** CSS px at 1x */ width: number; height: number }
export interface SpriteIndexEntry { width: number; height: number; x: number; y: number; pixelRatio: number }
export interface SpriteSheet { png: Uint8Array; json: Record<string, SpriteIndexEntry>; width: number; height: number }

let wasmReady: Promise<void> | null = null;
export function ensureResvg(): Promise<void> {
  if (!wasmReady) {
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
    wasmReady = readFile(wasmPath).then((buf) => initWasm(buf)).catch((err: unknown) => {
      // already initialised in this process is fine
      if (String(err).includes("Already initialized") || String(err).includes("already")) return;
      throw err;
    });
  }
  return wasmReady;
}

interface Rendered { name: string; w: number; h: number; rgba: Uint8Array; x?: number; y?: number }

async function render(input: SpriteInput, ratio: number): Promise<Rendered> {
  const r = new Resvg(input.svg, { fitTo: { mode: "width", value: Math.round(input.width * ratio) }, font: { loadSystemFonts: false }, background: "rgba(0,0,0,0)" });
  const img = r.render();
  const pngBytes = img.asPng();
  const decoded = decode(pngBytes);
  let rgba: Uint8Array;
  if (decoded.channels === 4 && decoded.depth === 8) rgba = new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength);
  else {
    // normalise to RGBA8
    const px = decoded.width * decoded.height;
    rgba = new Uint8Array(px * 4);
    const src = decoded.data as Uint8Array;
    for (let i = 0; i < px; i++) {
      const c = decoded.channels;
      const base = i * c;
      const [rr, gg, bb, aa] = c === 3 ? [src[base]!, src[base + 1]!, src[base + 2]!, 255] : c === 1 ? [src[base]!, src[base]!, src[base]!, 255] : c === 2 ? [src[base]!, src[base]!, src[base]!, src[base + 1]!] : [src[base]!, src[base + 1]!, src[base + 2]!, src[base + 3]!];
      rgba.set([rr, gg, bb, aa], i * 4);
    }
  }
  return { name: input.name, w: decoded.width, h: decoded.height, rgba };
}

export async function buildSpriteSheet(inputs: readonly SpriteInput[], pixelRatio: 1 | 2): Promise<SpriteSheet> {
  await ensureResvg();
  const sorted = [...inputs].sort((a, b) => a.name.localeCompare(b.name)); // deterministic packing
  const rendered = await Promise.all(sorted.map((i) => render(i, pixelRatio)));
  const boxes = rendered.map((r) => ({ w: r.w + 2, h: r.h + 2, ref: r })); // 1px gutter
  const { w: W, h: H } = boxes.length ? potpack(boxes) : { w: 1, h: 1 };
  const width = Math.max(1, W), height = Math.max(1, H);
  const sheet = new Uint8Array(width * height * 4);
  const json: Record<string, SpriteIndexEntry> = {};
  for (const b of boxes as Array<{ w: number; h: number; x: number; y: number; ref: Rendered }>) {
    const x = b.x + 1, y = b.y + 1;
    for (let row = 0; row < b.ref.h; row++) {
      sheet.set(b.ref.rgba.subarray(row * b.ref.w * 4, (row + 1) * b.ref.w * 4), ((y + row) * width + x) * 4);
    }
    json[b.ref.name] = { width: b.ref.w, height: b.ref.h, x, y, pixelRatio };
  }
  const png = encode({ width, height, data: sheet, channels: 4, depth: 8 });
  return { png, json: Object.fromEntries(Object.entries(json).sort(([a], [b]) => a.localeCompare(b))), width, height };
}
