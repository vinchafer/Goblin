import JSZip from 'jszip';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import type { S3ClientConfig } from '@aws-sdk/client-s3';

// DEV ONLY — nicht für Production. Hetzner Keys in .env eintragen.
const memoryStorage = new Map<string, string>();

// ── S3 Client factory ──────────────────────────────────────────────────────
let _s3Client: S3Client | null = null;
let _s3Available: boolean | null = null;

function getS3Client(): S3Client | null {
  if (_s3Available === false) return null;
  if (_s3Client) return _s3Client;

  const endpoint = process.env.STORAGE_ENDPOINT;
  const accessKeyId = process.env.STORAGE_KEY;
  const secretAccessKey = process.env.STORAGE_SECRET;
  const bucket = process.env.STORAGE_BUCKET;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    console.warn('⚠️  Hetzner Storage nicht konfiguriert — nutze In-Memory Fallback. Daten gehen beim Neustart verloren.');
    _s3Available = false;
    return null;
  }

  const config: S3ClientConfig = {
    endpoint,
    region: process.env.STORAGE_REGION || 'fsn1',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  };

  _s3Client = new S3Client(config);
  _s3Available = true;
  console.log('[file-storage] Hetzner S3 client initialized');
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

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Upload a single file to storage.
 * Returns the storage key.
 */
export async function uploadFile(projectId: string, filePath: string, content: string): Promise<string> {
  const key = storageKey(projectId, filePath);
  const s3 = getS3Client();

  if (!s3) {
    memoryStorage.set(key, content);
    return key;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: content,
      ContentType: 'text/plain',
    })
  );

  return key;
}

/**
 * Alias for uploadFile — used by project-generator.ts.
 */
export async function saveFile(projectId: string, filePath: string, content: string): Promise<void> {
  await uploadFile(projectId, filePath, content);
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

/**
 * Delete a single file from storage.
 */
export async function deleteFile(projectId: string, filePath: string): Promise<void> {
  const key = storageKey(projectId, filePath);
  const s3 = getS3Client();

  if (!s3) {
    memoryStorage.delete(key);
    return;
  }

  await s3.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );
}

/**
 * Delete all files belonging to a project.
 */
export async function deleteProject(projectId: string): Promise<void> {
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

  // List all objects with the project prefix
  const keys: { Key: string }[] = [];
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
}

/**
 * Create a ZIP file containing all project files.
 * Returns a Buffer of the ZIP data.
 */
export async function createZip(projectId: string): Promise<Buffer> {
  const zip = new JSZip();
  const files = await listFiles(projectId);

  for (const filePath of files) {
    const content = await getFile(projectId, filePath);
    if (content) {
      zip.file(filePath, content);
    }
  }

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}