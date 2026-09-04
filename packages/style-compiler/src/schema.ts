import { z } from "zod";
import { FLAVOR_COLOR_KEYS, LANDCOVER_KEYS, POI_KEYS } from "./flavor-keys";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC = /^(?:rgba?|hsla?)\(\s*[\d.%]+\s*[, ]\s*[\d.%]+\s*[, ]\s*[\d.%]+\s*(?:[,/]\s*[\d.%]+\s*)?\)$/i;

export const ColorSchema = z.string().trim().refine((v) => HEX.test(v) || FUNC.test(v), "must be a hex, rgb(a) or hsl(a) colour");
export type Color = z.infer<typeof ColorSchema>;

const colourRecord = <K extends string>(keys: readonly K[]) =>
  z.object(Object.fromEntries(keys.map((k) => [k, ColorSchema.optional()])) as Record<K, z.ZodOptional<typeof ColorSchema>>).strict();

export const FlavorOverrideSchema = colourRecord(FLAVOR_COLOR_KEYS)
  .extend({
    pois: colourRecord(POI_KEYS).optional(),
    landcover: colourRecord(LANDCOVER_KEYS).optional(),
  })
  .strict();
export type FlavorOverride = z.infer<typeof FlavorOverrideSchema>;

export const BaseFlavorSchema = z.enum(["light", "dark", "white", "grayscale", "black"]);
export type BaseFlavor = z.infer<typeof BaseFlavorSchema>;

export const VisibilitySchema = z.object({
  pois: z.boolean(),
  buildings: z.boolean(),
  addresses: z.boolean(),
  boundaries: z.boolean(),
  landuse: z.boolean(),
  landcover: z.boolean(),
  rail: z.boolean(),
  roadLabels: z.boolean(),
  roadShields: z.boolean(),
  placeLabels: z.boolean(),
  waterLabels: z.boolean(),
});
export type Visibility = z.infer<typeof VisibilitySchema>;
export type VisibilityKey = keyof Visibility;

export const LabelLangSchema = z.enum(["en", "fr", "local"]);
export type LabelLang = z.infer<typeof LabelLangSchema>;

export const FontStackSchema = z.enum(["noto-sans"]);

export const MarkerSettingsSchema = z.object({
  cluster: z.boolean(),
  clusterRadius: z.number().int().min(20).max(120),
  iconScale: z.number().min(0.5).max(2),
  showTitles: z.boolean(),
  defaultIcon: z.string().min(1).max(80),
  defaultColor: ColorSchema,
});
export type MarkerSettings = z.infer<typeof MarkerSettingsSchema>;

export const StyleConfigSchema = z.object({
  version: z.literal(1),
  base: BaseFlavorSchema,
  tokens: FlavorOverrideSchema,
  visibility: VisibilitySchema,
  labels: z.object({ lang: LabelLangSchema }),
  fonts: z.object({ stack: FontStackSchema }),
  markers: MarkerSettingsSchema,
});
export type StyleConfig = z.infer<typeof StyleConfigSchema>;

/** Raw MapLibre layer patches keyed by layer id. Only presentation keys may be patched. */
export const LayerOverrideSchema = z
  .object({
    paint: z.record(z.string(), z.unknown()).optional(),
    layout: z.record(z.string(), z.unknown()).optional(),
    filter: z.unknown().optional(),
    minzoom: z.number().min(0).max(24).optional(),
    maxzoom: z.number().min(0).max(24).optional(),
  })
  .strict();
export const LayerOverridesSchema = z.record(z.string(), LayerOverrideSchema);
export type LayerOverrides = z.infer<typeof LayerOverridesSchema>;

export function validateStyleConfig(input: unknown): { ok: true; config: StyleConfig } | { ok: false; issues: z.core.$ZodIssue[] } {
  const r = StyleConfigSchema.safeParse(input);
  return r.success ? { ok: true, config: r.data } : { ok: false, issues: r.error.issues };
}

/** Upgrade older config documents. v1 is the only version today. */
export function migrateStyleConfig(input: unknown): StyleConfig {
  const r = StyleConfigSchema.safeParse(input);
  if (r.success) return r.data;
  throw new Error(`unsupported style config: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
}
