// Copy the built embed (loader + versioned core + worker) into a delivery root and write embed/v1/config.json.
// usage: node scripts/publish-to-delivery.mjs <deliveryRoot> <apiUrl>
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const [root, apiUrl] = process.argv.slice(2);
if (!root || !apiUrl) { console.error("usage: publish-to-delivery.mjs <deliveryRoot> <apiUrl>"); process.exit(2); }
const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist/embed");
if (!existsSync(src)) { console.error("run `pnpm --filter @truecanadianmaps/web build` first"); process.exit(1); }
const dest = path.join(root, "embed");
mkdirSync(path.join(dest, "v1"), { recursive: true });
function equalTree(a, b) {
  const entries = readdirSync(a, { withFileTypes: true });
  if (entries.length !== readdirSync(b).length) return false;
  return entries.every((entry) => {
    const left = path.join(a, entry.name), right = path.join(b, entry.name);
    return existsSync(right) && (entry.isDirectory() ? equalTree(left, right) : readFileSync(left).equals(readFileSync(right)));
  });
}
for (const entry of readdirSync(path.join(src, "v1"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const from = path.join(src, "v1", entry.name), to = path.join(dest, "v1", entry.name);
  if (existsSync(to)) {
    if (!equalTree(from, to)) throw new Error(`Refusing to overwrite immutable embed version ${entry.name}`);
  } else {
    cpSync(from, `${to}.tmp`, { recursive: true });
    renameSync(`${to}.tmp`, to);
  }
}
for (const file of ["v1.js", "version.json"]) {
  cpSync(path.join(src, file), path.join(dest, `${file}.tmp`));
  renameSync(path.join(dest, `${file}.tmp`), path.join(dest, file));
}
writeFileSync(path.join(dest, "v1", "config.json"), JSON.stringify({ apiUrl: apiUrl.replace(/\/$/, "") }));
console.log(`embed copied to ${dest} (apiUrl=${apiUrl})`);
