import { describe, it, expect, beforeEach } from 'vitest';
import { parseCodeBlocks } from '../lib/parse-code-blocks';
import { reconcileBlockPaths } from '../lib/asset-reconcile';
import { uploadFile, getFile, listFiles, deleteProject } from '../services/file-storage';

// ─────────────────────────────────────────────────────────────────────────────
// WS-A — the build-loop safety net.
//
// This is the test that would have caught the `style.css` vs `styles.css` deploy-
// stale bug (DEPLOY_TRACE_2, founder lost a week to it). It drives the REAL loop
// functions end to end and asserts on the REAL persisted bytes in storage — the
// `file-storage` module's in-memory backend (active whenever STORAGE_* env is
// absent, i.e. in CI) IS the deploy source the live page loads.
//
// The loop's three steps, faithful to apps/api/src/routes/code-sessions.ts:
//   1. hydrate   — pull the project's real files (S3) into the session set
//   2. message   — model returns code → parseCodeBlocks → reconcileBlockPaths
//                  → upsert as DRAFT files
//   3. save      — promote each draft → uploadFile() into project storage (S3),
//                  the exact bytes the next deploy ships
//
// If the reconcile step is ever removed or the save path regresses, the deploy-
// source file the HTML links would NOT carry the edit and this test goes RED.
// ─────────────────────────────────────────────────────────────────────────────

// The EXACT prod index from project test 322r42 (DEPLOY_TRACE_2): it links the
// singular `style.css`, but the model emits `styles.css` (parse-code-blocks
// LANG_EXT default). Without reconcile the edit lands in an UNLINKED sibling.
const PROD_INDEX = `<!DOCTYPE html>
<html>
<head>
  <title>Landingpage</title>
  <link rel="stylesheet" href="style.css">
</head>
<body><div class="container"><h1>Hi</h1></div></body>
</html>`;

const ORIGINAL_CSS = `body { background-color: #ffffff; }`;

/** In-memory draft store — mirrors the `code_session_files` draft rows. */
type Draft = { path: string; content: string; state: 'draft' | 'saved' };

/**
 * Step 1 + 2: hydrate the session from real storage, then apply a model turn.
 * Mirrors POST /:sessionId/messages — parse → reconcile → draft upsert — using
 * the real loop helpers. Returns the resulting draft set.
 */
async function runMessageTurn(projectId: string, modelResponse: string): Promise<Draft[]> {
  // hydrate: the project's real files (what the HTML actually links lives here)
  const paths = await listFiles(projectId);
  const existingFiles: Array<{ path: string; content: string }> = [];
  for (const p of paths) {
    const content = await getFile(projectId, p);
    if (content != null) existingFiles.push({ path: p, content });
  }

  // model turn: parse blocks, then the WALK2-1 reconcile against the real files
  const blocks = parseCodeBlocks(modelResponse);
  reconcileBlockPaths(blocks, existingFiles);

  return blocks.map((b) => ({ path: b.path, content: b.content, state: 'draft' as const }));
}

/** Step 3: save — promote drafts into project storage (the deploy source). */
async function runSave(projectId: string, drafts: Draft[]): Promise<string[]> {
  const saved: string[] = [];
  for (const d of drafts) {
    if (d.state !== 'draft') continue;
    await uploadFile(projectId, d.path, d.content);
    d.state = 'saved';
    saved.push(d.path);
  }
  return saved;
}

describe('build loop — edit reaches the live file (deploy-stale regression net)', () => {
  const projectId = 'test-build-loop-322r42';

  beforeEach(async () => {
    await deleteProject(projectId);
    // Seed the project's real storage exactly as the generator left it.
    await uploadFile(projectId, 'index.html', PROD_INDEX);
    await uploadFile(projectId, 'style.css', ORIGINAL_CSS);
  });

  it('an edit named styles.css lands on the style.css the HTML links — on real bytes', async () => {
    // Model returns the "mach den Hintergrund blau" edit but names it `styles.css`.
    const response = [
      'Klar, ich mache den Hintergrund blau:',
      '```css',
      '/* styles.css */',
      'body { background-color: #0000FF; }',
      '```',
    ].join('\n');

    const drafts = await runMessageTurn(projectId, response);
    await runSave(projectId, drafts);

    // The deploy source — the file index.html actually links — carries the edit.
    const deployedCss = await getFile(projectId, 'style.css');
    expect(deployedCss).toContain('#0000FF');

    // And NO orphaned styles.css sibling was created next to it.
    const files = await listFiles(projectId);
    expect(files).toContain('style.css');
    expect(files).not.toContain('styles.css');

    // index.html still links style.css — unchanged.
    const html = await getFile(projectId, 'index.html');
    expect(html).toContain('href="style.css"');
  });

  it('regression proof: WITHOUT reconcile the edit orphans into styles.css and never ships', async () => {
    // Same model turn but skipping the reconcile step → reproduces the original bug.
    const response = '```css\n/* styles.css */\nbody { background-color: #0000FF; }\n```';
    const blocks = parseCodeBlocks(response);
    // (deliberately NOT calling reconcileBlockPaths)
    for (const b of blocks) await uploadFile(projectId, b.path, b.content);

    // The bug's exact signature: edit lands in the unlinked sibling…
    expect(await getFile(projectId, 'styles.css')).toContain('#0000FF');
    // …while the file the page loads stays stale white. This is what we now prevent.
    expect(await getFile(projectId, 'style.css')).toBe(ORIGINAL_CSS);
  });

  it('edit-in-place on a correctly-linked file updates the same deploy source', async () => {
    // Model names the file correctly → no reconcile needed, edit overwrites in place.
    const response = '```css\n/* style.css */\nbody { background-color: #008000; }\n```';
    const drafts = await runMessageTurn(projectId, response);
    await runSave(projectId, drafts);

    expect(await getFile(projectId, 'style.css')).toContain('#008000');
    expect(await listFiles(projectId)).not.toContain('styles.css');
  });

  it('a genuinely new file (multi-asset project) is left alone — reconcile stays conservative', async () => {
    // A second stylesheet makes the link ambiguous → reconcile must NOT retarget.
    await uploadFile(
      projectId,
      'index.html',
      PROD_INDEX.replace('</head>', '  <link rel="stylesheet" href="theme.css">\n</head>'),
    );
    const response = '```css\n/* styles.css */\nbody { color: red; }\n```';
    const drafts = await runMessageTurn(projectId, response);
    await runSave(projectId, drafts);

    // Ambiguous → block keeps its own name, written as its own file (no guessing).
    expect(await listFiles(projectId)).toContain('styles.css');
  });
});
