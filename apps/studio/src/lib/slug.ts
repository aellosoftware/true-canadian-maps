export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "map";
}

/** Appends -2, -3, … until `exists` reports the slug as free. */
export async function uniqueSlug(base: string, exists: (candidate: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base);
  if (!(await exists(root))) return root;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${root.slice(0, 60)}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root.slice(0, 50)}-${Date.now().toString(36)}`;
}
