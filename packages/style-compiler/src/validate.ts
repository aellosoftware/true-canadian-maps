import { validateStyleMin, type StyleSpecification } from "@maplibre/maplibre-gl-style-spec";

export interface StyleIssue { message: string; line?: number }

/** Validate a compiled style against the MapLibre style specification. */
export function validateCompiledStyle(style: StyleSpecification): StyleIssue[] {
  const errors = validateStyleMin(style) as Array<{ message: string; line?: number }>;
  return errors.map((e) => ({ message: e.message, ...(e.line !== undefined ? { line: e.line } : {}) }));
}
