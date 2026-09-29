import { Injectable, NotImplementedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface StoredObject {
  backend: string;
  key: string;
  sha256: string;
  sizeBytes: number;
}

/** File storage behind an interface: local disk in dev, MinIO/S3 at scale. */
export interface StorageAdapter {
  readonly name: string;
  put(key: string, data: Buffer): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
}

export const STORAGE = Symbol('STORAGE');

/** Default (STORAGE_BACKEND=local): files under STORAGE_DIR (default backend/storage). */
@Injectable()
export class LocalDiskStorage implements StorageAdapter {
  readonly name = 'local';
  private readonly root = path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), 'storage'));

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    // Refuse keys that escape the storage root (../../etc/passwd).
    if (!full.startsWith(this.root + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  async put(key: string, data: Buffer): Promise<StoredObject> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return { backend: this.name, key, sha256: crypto.createHash('sha256').update(data).digest('hex'), sizeBytes: data.length };
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }
}

/**
 * STORAGE_BACKEND=minio. Documented stub: MinIO needs its own process, which
 * does not fit the 2 GB dev laptop. Implementation plan: `minio` npm client,
 * bucket MINIO_BUCKET, key = same layout as local, server-side SHA-256 check.
 */
@Injectable()
export class MinioStorage implements StorageAdapter {
  readonly name = 'minio';
  async put(): Promise<StoredObject> {
    throw new NotImplementedException('MinIO adapter not implemented; set STORAGE_BACKEND=local');
  }
  async get(): Promise<Buffer> {
    throw new NotImplementedException('MinIO adapter not implemented; set STORAGE_BACKEND=local');
  }
}
