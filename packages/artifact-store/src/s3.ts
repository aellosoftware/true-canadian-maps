import { createHash } from "node:crypto";
import {
  DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client,
} from "@aws-sdk/client-s3";
import { ArtifactExistsError, assertKey, toBytes, type ArtifactStore, type PutOptions, type StoredObject } from "./types";

export interface S3StoreConfig {
  endpoint?: string | undefined;
  region?: string | undefined;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** path-style addressing (Garage and most self-hosted S3 servers) */
  forcePathStyle?: boolean | undefined;
  /** key prefix inside the bucket */
  prefix?: string | undefined;
}

/** S3-compatible driver (Garage, Cloudflare R2, AWS S3, …). */
export class S3ArtifactStore implements ArtifactStore {
  readonly kind = "s3" as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(cfg: S3StoreConfig) {
    this.client = new S3Client({
      region: cfg.region ?? "auto",
      ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
      forcePathStyle: cfg.forcePathStyle ?? true,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
    this.bucket = cfg.bucket;
    this.prefix = cfg.prefix ? cfg.prefix.replace(/^\/+|\/+$/g, "") + "/" : "";
  }

  private k(key: string): string {
    assertKey(key);
    return this.prefix + key;
  }

  async put(key: string, body: Uint8Array | string, opts: PutOptions): Promise<StoredObject> {
    const bytes = toBytes(body);
    if (opts.ifNoneMatch !== false && (await this.exists(key))) throw new ArtifactExistsError(key);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: this.k(key), Body: bytes, ContentType: opts.contentType, ...(opts.cacheControl ? { CacheControl: opts.cacheControl } : {}) }),
    );
    return { key, size: bytes.byteLength, contentType: opts.contentType, sha256: createHash("sha256").update(bytes).digest("hex") };
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.k(key) }));
      return res.Body ? new Uint8Array(await res.Body.transformToByteArray()) : null;
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.k(key) }));
      return true;
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === "NotFound" || name === "NoSuchKey") return false;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.k(key) }));
  }

  async deletePrefix(prefix: string): Promise<number> {
    const keys = await this.list(prefix);
    for (let i = 0; i < keys.length; i += 1000) {
      await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys.slice(i, i + 1000).map((k) => ({ Key: this.prefix + k })) } }));
    }
    return keys.length;
  }

  async list(prefix: string): Promise<string[]> {
    const out: string[] = [];
    let token: string | undefined;
    do {
      const res = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: this.k(prefix), ContinuationToken: token }));
      for (const o of res.Contents ?? []) if (o.Key) out.push(o.Key.slice(this.prefix.length));
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return out.sort();
  }
}
