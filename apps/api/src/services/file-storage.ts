import JSZip from 'jszip';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import logger from '../lib/logger';
import { byteLen, assertStorageRoom, applyStorageDelta } from './storage-usage';

/**
 * Storage-accounting options threaded into every write/delete. When `userId` is set
 * AND object storage is live, the write is metered against the user's plan cap and
 * the running counter (users.storage_bytes) is updated by the exact byte delta.
 *   • enforce (default true): block the write if it would exceed the cap. Pass
 *     enforce:false for NET-ZERO moves (rename/move/trash copy) and for multi-file
 *     batches already pre-checked in aggregate — they must account but never block.
 * Omitting userId (tests, scripts, the in-memory dev fallback) skips both — the
 * nightly reconcile is the backstop for any unmetered path.
 */
export interface WriteOpts {
  userId?: string;
  enforce?: boolean;
}

// DEV ONLY — nicht für Production. Storage-Keys (Backblaze B2, S3-compatible) in .env eintragen.
// Capped at 500 entries to prevent unbounded growth in long-running dev sessions.
const MEMORY_STORAGE_MAX = 500;
const memoryStorage = new Map<string, string>();

function memoryStorageSet(key: string, value: string) {
  if (!memoryStorage.has(key) && memoryStorage.size >= MEMORY_STORAGE_MAX) {
    const firstKey = memoryStorage.keys().next().value;
    if (firstKey !== undefined) memoryStorage.delete(firstKey);
  }
  memoryStorage.set(key, value);
}

// ── S3 Client factory ──────────────────────────────────────────────────────
let _s3Client: S3Client | null = null;
let _s3Available: boolean | null = null;

function getS3Client(): S3Client | null {
  if (_s3Available === false) return null;
  if (_s3Client) return _s3Client;

  const rawEndpoint = process.env.STORAGE_ENDPOINT;
  const accessKeyId = process.env.STORAGE_KEY;
  const secretAccessKey = process.env.STORAGE_SECRET;
  const bucket = process.env.STORAGE_BUCKET;

  if (!rawEndpoint || !accessKeyId || !secretAccessKey || !bucket) {
    console.warn('⚠️  Object Storage nicht konfiguriert — nutze In-Memory Fallback. Daten gehen beim Neustart verloren.');
    _s3Available = false;
    return null;
  }

  // Normalize endpoint — ensure https:// prefix
  const endpoint = rawEndpoint.startsWith('http') ? rawEndpoint : `https://${rawEndpoint}`;

  // Auto-detect region from Backblaze endpoint (s3.eu-central-003.backblazeb2.com → eu-central-003)
  // Falls back to STORAGE_REGION env var, then to us-east-1
  const b2RegionMatch = endpoint.match(/s3\.([^.]+)\.backblazeb2\.com/);
  const region = b2RegionMatch?.[1] ?? process.env.STORAGE_REGION ?? 'us-east-1';

  const config: S3ClientConfig = {
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  };

  _s3Client = new S3Client(config);
  _s3Available = true;
  logger.info({}, 's3_client_initialized');
  return _s3Client;
}

function getBucket(): string {
  return process.env.STORAGE_BUCKET || 'goblin-dev';
}

function storageKey(projectId: string, filePath: string): string {
  return `projects/${projectId}/${filePath}`;
}

function projectPrefix(projectId: string): string {
  return `projects/${projectId}/`;
}

// ── Storage accounting helpers ──────────────────────────────────────────────

/** ContentLength of an existing object, or null if it doesn't exist (404). */
async function headSize(s3: S3Client, key: string): Promise<number | null> {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return r.ContentLength ?? 0;
  } catch (err: unknown) {
    const code = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (code === 404) return null;
    throw err;
  }
}

/**
 * Put an object, metering it against the user's storage cap. Computes the true byte
 * DELTA (incoming − existing, so an overwrite is accounted correctly), enforces the
 * cap when asked, writes, then updates the counter. The single choke-point all
 * footprint writes pass through.
 */
async function guardedPut(
  s3: S3Client,
  key: string,
  body: string | Buffer,
  contentType: string,
  incoming: number,
  opts: WriteOpts,
  cacheControl?: string,
): Promise<void> {
  const { userId } = opts;
  const enforce = opts.enforce ?? true;

  let delta = incoming;
  if (userId) {
    const existing = await headSize(s3, key);
    delta = incoming - (existing ?? 0);
    if (enforce) await assertStorageRoom(userId, delta); // throws → 413/503 BEFORE the write
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      ...(cacheControl ? { CacheControl: cacheControl } : {}),
    }),
  );

  if (userId) await applyStorageDelta(userId, delta);
}

/**
 * Byte size of a project file in storage (0 if absent). Used by multi-file callers
 * to pre-check an ENTIRE batch's aggregate delta against the cap before any write,
 * so a build/generation never half-writes at the boundary.
 */
export async function headBytes(projectId: string, filePath: string): Promise<number> {
  const s3 = getS3Client();
  if (!s3) {
    const v = memoryStorage.get(storageKey(projectId, filePath));
    return v == null ? 0 : Buffer.byteLength(v, 'utf8');
  }
  return (await headSize(s3, storageKey(projectId, filePath))) ?? 0;
}

/**
 * Visit every object under a raw key prefix with its key + size (reconcile job).
 * One paginated list walk; callback accumulates per-user totals.
 */
export async function walkPrefixObjects(
  prefix: string, cb: (key: string, size: number) => void,
): Promise<void> {
  const s3 = getS3Client();
  if (!s3) {
    for (const [key, val] of memoryStorage.entries()) {
      if (key.startsWith(prefix)) cb(key, Buffer.byteLength(val, 'utf8'));
    }
    return;
  }
  let continuationToken: string | undefined;
  do {
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: getBucket(), Prefix: prefix, ContinuationToken: continuationToken,
    }));
    for (const obj of response.Contents ?? []) {
      if (obj.Key) cb(obj.Key, obj.Size ?? 0);
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
}

/** Sum the byte sizes of every object under a raw key prefix (reconcile job). */
export async function sumPrefixBytes(prefix: string): Promise<number> {
  const s3 = getS3Client();
  if (!s3) {
    let total = 0;
    for (const [key, val] of memoryStorage.entries()) {
      if (key.startsWith(prefix)) total += Buffer.byteLength(val, 'utf8');
    }
    return total;
  }
  let total = 0;
  let continuationToken: string | undefined;
  do {
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: getBucket(), Prefix: prefix, ContinuationToken: continuationToken,
    }));
    for (const obj of response.Contents ?? []) total += obj.Size ?? 0;
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  return total;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Upload a single file to storage.
 * Returns the storage key.
 */
export async function uploadFile(
  projectId: string, filePath: string, content: string, opts: WriteOpts = {},
): Promise<string> {
  const key = storageKey(projectId, filePath);
  const s3 = getS3Client();

  if (!s3) {
    memoryStorageSet(key, content);
    return key;
  }

  await guardedPut(s3, key, content, 'text/plain', byteLen(content), opts);
  return key;
}

/**
 * Alias for uploadFile — used by project-generator.ts / templates.ts.
 */
export async function saveFile(
  projectId: string, filePath: string, content: string, opts: WriteOpts = {},
): Promise<void> {
  await uploadFile(projectId, filePath, content, opts);
}

/**
 * Download a single file from storage.
 * Returns the file content as a string, or null if not found.
 */
export async function downloadFile(projectId: string, filePath: string): Promise<string | null> {
  const key = storageKey(projectId, filePath);
  const s3 = getS3Client();

  if (!s3) {
    return memoryStorage.get(key) ?? null;
  }

  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
      })
    );

    if (!response.Body) return null;
    return await response.Body.transformToString('utf-8');
  } catch (err: unknown) {
    const code = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (code === 404) return null;
    throw err;
  }
}

/**
 * Alias for downloadFile — used by projects.ts routes.
 */
export async function getFile(projectId: string, filePath: string): Promise<string | null> {
  return downloadFile(projectId, filePath);
}

/**
 * List all files in a project.
 * Returns array of relative file paths (without the project prefix).
 */
export async function listFiles(projectId: string): Promise<string[]> {
  const prefix = projectPrefix(projectId);
  const s3 = getS3Client();

  if (!s3) {
    const results: string[] = [];
    for (const key of memoryStorage.keys()) {
      if (key.startsWith(prefix)) {
        results.push(key.slice(prefix.length));
      }
    }
    return results;
  }

  const files: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: getBucket(),
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          files.push(obj.Key.slice(prefix.length));
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
}

export interface FileMeta { path: string; size: number; modified: string | null; }

/**
 * List project files with size + last-modified metadata (for the file explorer).
 * Same prefix walk as listFiles but keeps Size / LastModified.
 */
export async function listFilesWithMeta(projectId: string): Promise<FileMeta[]> {
  const prefix = projectPrefix(projectId);
  const s3 = getS3Client();

  if (!s3) {
    const out: FileMeta[] = [];
    for (const [key, val] of memoryStorage.entries()) {
      if (key.startsWith(prefix)) out.push({ path: key.slice(prefix.length), size: val.length, modified: null });
    }
    return out;
  }

  const out: FileMeta[] = [];
  let continuationToken: string | undefined;
  do {
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: getBucket(), Prefix: prefix, ContinuationToken: continuationToken,
    }));
    for (const obj of response.Contents ?? []) {
      if (obj.Key) out.push({
        path: obj.Key.slice(prefix.length),
        size: obj.Size ?? 0,
        modified: obj.LastModified ? new Date(obj.LastModified).toISOString() : null,
      });
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  return out;
}

/**
 * Fetch raw bytes + content-type for a single file (image preview / download).
 */
export async function getFileBytes(
  projectId: string, filePath: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const key = storageKey(projectId, filePath);
  const s3 = getS3Client();
  if (!s3) {
    const v = memoryStorage.get(key);
    if (v == null) return null;
    return { bytes: Buffer.from(v, 'utf-8'), contentType: 'application/octet-stream' };
  }
  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
    if (!response.Body) return null;
    const bytes = Buffer.from(await response.Body.transformToByteArray());
    return { bytes, contentType: response.ContentType ?? 'application/octet-stream' };
  } catch (err: unknown) {
    const code = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (code === 404) return null;
    throw err;
  }
}

/**
 * Upload raw bytes to a project-relative path (file explorer upload, any type).
 */
export async function uploadProjectFileBytes(
  projectId: string, filePath: string, body: Buffer, contentType: string, opts: WriteOpts = {},
): Promise<string> {
  return (await uploadBytes(storageKey(projectId, filePath), body, contentType, opts)).key;
}

/**
 * Delete a single file from storage. When `userId` is set, the freed bytes are
 * subtracted from the user's counter (delete always frees — never enforced/blocked).
 */
export async function deleteFile(
  projectId: string, filePath: string, opts: { userId?: string } = {},
): Promise<void> {
  const key = storageKey(projectId, filePath);
  const s3 = getS3Client();

  if (!s3) {
    memoryStorage.delete(key);
    return;
  }

  let removed = 0;
  if (opts.userId) removed = (await headSize(s3, key)) ?? 0;

  await s3.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );

  if (opts.userId && removed) await applyStorageDelta(opts.userId, -removed);
}

/**
 * Delete all files belonging to a project. When `userId` is set, the project's total
 * bytes are subtracted from the user's counter.
 */
export async function deleteProject(
  projectId: string, opts: { userId?: string } = {},
): Promise<void> {
  const prefix = projectPrefix(projectId);
  const s3 = getS3Client();

  if (!s3) {
    for (const key of memoryStorage.keys()) {
      if (key.startsWith(prefix)) {
        memoryStorage.delete(key);
      }
    }
    return;
  }

  // List all objects with the project prefix (summing sizes for counter accounting).
  const keys: { Key: string }[] = [];
  let freed = 0;
  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: getBucket(),
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          keys.push({ Key: obj.Key });
          freed += obj.Size ?? 0;
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  // Delete in batches of 1000 (S3 limit)
  if (keys.length > 0) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: getBucket(),
        Delete: { Objects: keys },
      })
    );
  }

  if (opts.userId && freed) await applyStorageDelta(opts.userId, -freed);
}

/**
 * Upload arbitrary bytes at a given storage key with explicit content type
 * and a long cache-control. Returns the public URL if STORAGE_PUBLIC_URL is
 * configured (e.g. for a public-read B2 bucket), otherwise null — caller can
 * fall back to a signed URL or store the bare key.
 */
export async function uploadBytes(
  key: string,
  body: Buffer,
  contentType: string,
  opts: WriteOpts = {},
): Promise<{ key: string; publicUrl: string | null }> {
  const s3 = getS3Client();
  if (!s3) {
    memoryStorageSet(key, body.toString('base64'));
    return { key, publicUrl: null };
  }

  await guardedPut(s3, key, body, contentType, body.length, opts, 'public, max-age=31536000, immutable');

  const base = process.env.STORAGE_PUBLIC_URL;
  return {
    key,
    publicUrl: base ? `${base.replace(/\/$/, '')}/${key}` : null,
  };
}

/**
 * Delete everything under `users/{userId}/` from object storage. Best-effort,
 * used by the GDPR hard-delete cron. Returns the number of objects removed.
 */
export async function deleteUserStorage(userId: string): Promise<number> {
  const prefix = `users/${userId}/`;
  const s3 = getS3Client();

  if (!s3) {
    let n = 0;
    for (const key of memoryStorage.keys()) {
      if (key.startsWith(prefix)) {
        memoryStorage.delete(key);
        n++;
      }
    }
    return n;
  }

  const keys: { Key: string }[] = [];
  let continuationToken: string | undefined;
  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: getBucket(),
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) keys.push({ Key: obj.Key });
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  if (keys.length === 0) return 0;

  // S3 caps DeleteObjects at 1000 per call.
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: getBucket(),
        Delete: { Objects: batch, Quiet: true },
      }),
    );
  }
  return keys.length;
}

export interface ProjectPurgeResult {
  /** how many project prefixes were requested */
  requested: number;
  /** projectIds whose `projects/<id>/` prefix was deleted AND verified empty */
  purged: string[];
  /** projectIds that could not be fully purged (kept for a safe re-run) */
  failed: Array<{ projectId: string; error: string }>;
  /** total objects removed across all prefixes this run */
  objectsDeleted: number;
}

/**
 * GDPR hard-delete helper: purge every `projects/<projectId>/` prefix — including
 * each project's `.trash/` — from object storage. Used when a user is erased, so
 * their project files don't outlive the account (DSGVO Art. 17).
 *
 * Idempotent and resumable: a prefix that is already empty is a no-op success, and
 * a per-project failure is COLLECTED, not thrown, so the caller can safely re-run
 * against the same ids. After deleting, each prefix is re-listed to VERIFY it is
 * empty before being reported as purged — a prefix that still lists objects is
 * reported in `failed`, never as complete. Deletes in batches of 1000 (S3 cap).
 */
export async function purgeProjectStorage(projectIds: string[]): Promise<ProjectPurgeResult> {
  const result: ProjectPurgeResult = {
    requested: projectIds.length, purged: [], failed: [], objectsDeleted: 0,
  };
  const s3 = getS3Client();

  for (const projectId of projectIds) {
    const prefix = projectPrefix(projectId);
    try {
      // 1. Enumerate every object under projects/<id>/ (incl. .trash/).
      const keys: string[] = [];
      await walkPrefixObjects(prefix, (key) => keys.push(key));

      // 2. Delete — memory fallback for dev/test, batched DeleteObjects for S3/B2.
      if (!s3) {
        for (const key of keys) memoryStorage.delete(key);
      } else {
        for (let i = 0; i < keys.length; i += 1000) {
          await s3.send(new DeleteObjectsCommand({
            Bucket: getBucket(),
            Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
          }));
        }
      }
      result.objectsDeleted += keys.length;

      // 3. VERIFY the prefix is now empty — never claim completion on a partial purge.
      const remaining: string[] = [];
      await walkPrefixObjects(prefix, (key) => remaining.push(key));
      if (remaining.length > 0) {
        result.failed.push({
          projectId,
          error: `prefix not empty after purge (${remaining.length} objects remain)`,
        });
      } else {
        result.purged.push(projectId);
      }
    } catch (err) {
      result.failed.push({ projectId, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

/**
 * Create a ZIP file containing all project files.
 * Returns a Buffer of the ZIP data.
 */
export async function createZip(projectId: string): Promise<Buffer> {
  const zip = new JSZip();
  const files = await listFiles(projectId);

  const entries = await Promise.all(
    files.map(async (filePath) => ({ filePath, content: await getFile(projectId, filePath) }))
  );

  for (const { filePath, content } of entries) {
    if (content) zip.file(filePath, content);
  }

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

export async function checkStorageConnection(): Promise<{ ok: boolean; error?: string }> {
  const s3 = getS3Client();
  if (!s3) return { ok: false, error: 'storage_not_configured' };
  try {
    await s3.send(new ListObjectsV2Command({ Bucket: getBucket(), MaxKeys: 1 }));
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error({ err: msg }, 's3_connection_check_failed');
    return { ok: false, error: msg };
  }
}