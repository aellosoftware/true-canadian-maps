import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ArtifactExistsError, assertKey, toBytes, type ArtifactStore, type PutOptions, type StoredObject } from "./types";

/**
 * Filesystem driver: writes into a directory that the delivery web server serves read-only.
 * Content type and cache policy are applied by the web server based on path conventions.
 */
export class FsArtifactStore implements ArtifactStore {
  readonly kind = "fs" as const;
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    assertKey(key);
    const rootAbs = path.resolve(this.root);
    const full = path.resolve(rootAbs, key);
    if (!full.startsWith(rootAbs + path.sep)) throw new Error(`key escapes root: ${key}`);
    return full;
  }

  async put(key: string, body: Uint8Array | string, opts: PutOptions): Promise<StoredObject> {
    const full = this.resolve(key);
    const bytes = toBytes(body);
    if (opts.ifNoneMatch !== false && (await this.exists(key))) throw new ArtifactExistsError(key);
    await mkdir(path.dirname(full), { recursive: true });
    const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, bytes);
    await rename(tmp, full); // atomic on the same filesystem
    return { key, size: bytes.byteLength, contentType: opts.contentType, sha256: createHash("sha256").update(bytes).digest("hex") };
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.resolve(key)));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async deletePrefix(prefix: string): Promise<number> {
    const keys = await this.list(prefix);
    await rm(this.resolve(prefix.replace(/\/$/, "")), { recursive: true, force: true });
    return keys.length;
  }

  async list(prefix: string): Promise<string[]> {
    const dir = this.resolve(prefix.replace(/\/$/, ""));
    const rootAbs = path.resolve(this.root);
    const out: string[] = [];
    const walk = async (d: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(d, { withFileTypes: true });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
        throw err;
      }
      for (const e of entries) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) await walk(p);
        else if (!e.name.endsWith(".tmp")) out.push(path.relative(rootAbs, p).split(path.sep).join("/"));
      }
    };
    await walk(dir);
    return out.sort();
  }
}
