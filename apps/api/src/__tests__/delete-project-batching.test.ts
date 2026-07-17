/**
 * #18 regression: deleteProject must chunk DeleteObjects into ≤1000-key batches.
 *
 * The in-memory storage fallback (used by every other storage test) iterates a Map
 * and never hits the S3 1000-object cap, so the bug is invisible there. This test
 * mocks @aws-sdk/client-s3 to drive the REAL S3 code path with >1000 objects and
 * asserts: (a) no single DeleteObjects request exceeds 1000 keys, (b) every listed
 * object is deleted exactly once. Before the fix, deleteProject issued ONE
 * DeleteObjects with all 2500 keys — which B2/S3 reject at 1000.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// Storage env must be present BEFORE importing file-storage so getS3Client() takes
// the real (mocked) S3 branch instead of the in-memory fallback.
const savedEnv = { ...process.env };
beforeAll(() => {
  process.env.STORAGE_ENDPOINT = 'https://s3.example.com';
  process.env.STORAGE_KEY = 'test-key';
  process.env.STORAGE_SECRET = 'test-secret';
  process.env.STORAGE_BUCKET = 'test-bucket';
});
afterAll(() => {
  // Restore so a shared worker's later files fall back to in-memory storage.
  for (const k of ['STORAGE_ENDPOINT', 'STORAGE_KEY', 'STORAGE_SECRET', 'STORAGE_BUCKET'] as const) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

const TOTAL = 2500; // spans three 1000-key batches
const PROJECT_ID = 'proj-batch-1';
const PREFIX = `projects/${PROJECT_ID}/`;

// The synthetic object universe the mocked bucket "contains".
const allKeys: string[] = Array.from({ length: TOTAL }, (_, i) => `${PREFIX}file-${i}.txt`);
const deleteBatchSizes: number[] = [];
const deletedKeys = new Set<string>();

vi.mock('@aws-sdk/client-s3', () => {
  class Cmd {
    input: Record<string, unknown>;
    __type: string;
    constructor(input: Record<string, unknown>, type: string) { this.input = input; this.__type = type; }
  }
  class ListObjectsV2Command extends Cmd { constructor(i: Record<string, unknown>) { super(i, 'list'); } }
  class DeleteObjectsCommand extends Cmd { constructor(i: Record<string, unknown>) { super(i, 'deleteMany'); } }
  class DeleteObjectCommand extends Cmd { constructor(i: Record<string, unknown>) { super(i, 'deleteOne'); } }
  class PutObjectCommand extends Cmd { constructor(i: Record<string, unknown>) { super(i, 'put'); } }
  class GetObjectCommand extends Cmd { constructor(i: Record<string, unknown>) { super(i, 'get'); } }
  class HeadObjectCommand extends Cmd { constructor(i: Record<string, unknown>) { super(i, 'head'); } }

  class S3Client {
    async send(cmd: Cmd) {
      if (cmd.__type === 'list') {
        // Paginate: 1000 keys per page, continuation token = next offset.
        const token = (cmd.input.ContinuationToken as string) ?? '0';
        const start = parseInt(token, 10);
        const page = allKeys.slice(start, start + 1000);
        const next = start + 1000;
        return {
          Contents: page.map((Key) => ({ Key, Size: 10 })),
          NextContinuationToken: next < allKeys.length ? String(next) : undefined,
        };
      }
      if (cmd.__type === 'deleteMany') {
        const objs = (cmd.input.Delete as { Objects: { Key: string }[] }).Objects;
        deleteBatchSizes.push(objs.length);
        for (const o of objs) deletedKeys.add(o.Key);
        return {};
      }
      return {};
    }
  }

  return { S3Client, ListObjectsV2Command, DeleteObjectsCommand, DeleteObjectCommand, PutObjectCommand, GetObjectCommand, HeadObjectCommand };
});

describe('deleteProject — #18 batched delete (>1000 objects)', () => {
  it('chunks DeleteObjects to ≤1000 keys/request and deletes every object', async () => {
    const { deleteProject } = await import('../services/file-storage');

    await deleteProject(PROJECT_ID); // no userId → no storage-counter path

    // (a) it actually deleted all 2500 objects
    expect(deletedKeys.size).toBe(TOTAL);
    for (const k of allKeys) expect(deletedKeys.has(k)).toBe(true);

    // (b) no batch exceeded the 1000-object hard cap, and it took the expected 3 batches
    expect(deleteBatchSizes.length).toBe(Math.ceil(TOTAL / 1000)); // 3
    for (const size of deleteBatchSizes) expect(size).toBeLessThanOrEqual(1000);
    expect(deleteBatchSizes.reduce((a, b) => a + b, 0)).toBe(TOTAL);
  });
});
