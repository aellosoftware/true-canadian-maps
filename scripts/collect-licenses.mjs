import { readdirSync, readFileSync, existsSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const destination = path.resolve("THIRD_PARTY_LICENSES");
mkdirSync(destination, { recursive: true });
const inventory = [];
for (const entry of readdirSync("node_modules/.pnpm", { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === "node_modules") continue;
  const modules = path.join("node_modules/.pnpm", entry.name, "node_modules");
  if (!existsSync(modules)) continue;
  const packages = readdirSync(modules, { withFileTypes: true }).filter((p) => p.isDirectory()).flatMap((p) => p.name.startsWith("@") ? readdirSync(path.join(modules, p.name), { withFileTypes: true }).filter((s) => s.isDirectory()).map((s) => path.join(modules, p.name, s.name)) : [path.join(modules, p.name)]);
  for (const directory of packages) {
    if (!existsSync(path.join(directory, "package.json"))) continue;
    const pkg = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"));
    const folder = `${pkg.name.replaceAll("/", "__")}@${pkg.version}`;
    const files = readdirSync(directory, { withFileTypes: true }).filter((f) => f.isFile() && /^(licen[cs]e|copying|notice)([.-].*)?$/i.test(f.name));
    mkdirSync(path.join(destination, folder), { recursive: true });
    for (const file of files) copyFileSync(path.join(directory, file.name), path.join(destination, folder, file.name));
    inventory.push({ name: pkg.name, version: pkg.version, license: pkg.license ?? null, notices: files.map((f) => f.name) });
  }
}
writeFileSync(path.join(destination, "inventory.json"), JSON.stringify(inventory.sort((a, b) => a.name.localeCompare(b.name)), null, 2) + "\n");
console.log(`Preserved notices for ${inventory.length} dependency packages`);
