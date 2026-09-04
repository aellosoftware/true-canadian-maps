export interface PutOptions {
  contentType: string;
  /** e.g. "public, max-age=31536000, immutable" */
  cacheControl?: string;
  /** Refuse to overwrite an existing key (default true: published artifacts are immutable). */
  ifNoneMatch?: boolean;
}

export interface StoredObject {
  key: string;
  size: number;
  contentType: string;
  sha256: string;
}

/**
 * Object storage boundary for artifacts (styles, GeoJSON, sprites, manifests, pointers, uploads).
 * Keys never start with "/". Implementations: filesystem volume (default) and S3-compatible.
 */
export interface ArtifactStore {
  readonly kind: "fs" | "s3";
  put(key: string, body: Uint8Array | string, opts: PutOptions): Promise<StoredObject>;
  get(key: string): Promise<Uint8Array | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  /** Delete every object under a prefix (e.g. a failed release). */
  deletePrefix(prefix: string): Promise<number>;
  list(prefix: string): Promise<string[]>;
}

export class ArtifactExistsError extends Error {
  constructor(public readonly key: string) {
    super(`artifact already exists: ${key}`);
    this.name = "ArtifactExistsError";
  }
}

// control characters, DEL, and whitespace are never valid in keys
const UNSAFE = /[\x00-\x1f\x7f\s]/;

export function assertKey(key: string): void {
  if (!key || key.startsWith("/") || key.split("/").includes("..") || key.includes("\\") || UNSAFE.test(key)) {
    throw new Error(`invalid artifact key: ${JSON.stringify(key)}`);
  }
}

export function toBytes(body: Uint8Array | string): Uint8Array {
  return typeof body === "string" ? new TextEncoder().encode(body) : body;
}
