// U1 (feel-sprint-2): file-content injection — budget, priority, markers.
// Runs against the in-memory storage fallback (no STORAGE_* env in tests).
import { describe, it, expect, beforeAll } from 'vitest';
import { uploadFile } from '../services/file-storage';
import { loadProjectContextFiles, FILE_CONTENT_BUDGET_CHARS, isTextFile, isSoftDeletedPath } from '../services/project-context';
import { buildGoblinChatSystemPrompt } from '../prompts/goblin-chat-system';

const PID = 'test-project-context';

const INDEX_HTML = `<!doctype html><html><head>
  <link rel="stylesheet" href="styles.css">
  <script src="app.js"></script>
</head><body><h1>Habit Tracker</h1><img src="logo.png"></body></html>`;

beforeAll(async () => {
  await uploadFile(PID, 'index.html', INDEX_HTML);
  await uploadFile(PID, 'styles.css', 'body { margin: 0; }');
  await uploadFile(PID, 'app.js', 'console.log("hi");');
  await uploadFile(PID, 'logo.png', 'PNGDATA'); // binary by extension
  await uploadFile(PID, 'huge.json', 'x'.repeat(FILE_CONTENT_BUDGET_CHARS + 1000));
});

describe('loadProjectContextFiles', () => {
  it('loads text files within budget, marks binary and over-budget files', async () => {
    const files = await loadProjectContextFiles(PID);
    const byPath = new Map(files.map((f) => [f.path, f]));

    expect(byPath.get('index.html')?.content).toBe(INDEX_HTML);
    expect(byPath.get('styles.css')?.content).toContain('margin');
    expect(byPath.get('app.js')?.content).toContain('console.log');
    expect(byPath.get('logo.png')?.content).toBeUndefined();
    expect(byPath.get('logo.png')?.notLoaded).toBe('binary');
    expect(byPath.get('huge.json')?.content).toBeUndefined();
    expect(byPath.get('huge.json')?.notLoaded).toBe('too-large');
  });

  it('stays under the total character budget', async () => {
    const files = await loadProjectContextFiles(PID);
    const total = files.reduce((n, f) => n + (f.content?.length ?? 0), 0);
    expect(total).toBeLessThanOrEqual(FILE_CONTENT_BUDGET_CHARS);
  });
});

describe('buildGoblinChatSystemPrompt with contents', () => {
  it('renders real contents in fenced blocks and marks not-loaded files', async () => {
    const files = await loadProjectContextFiles(PID);
    const prompt = buildGoblinChatSystemPrompt({ projectName: 'Habit Tracker', files });

    expect(prompt).toContain('Datei: index.html');
    expect(prompt).toContain('<h1>Habit Tracker</h1>');
    expect(prompt).toContain('Dateiinhalte');
    expect(prompt).toContain('huge.json');
    expect(prompt).toContain('(Inhalt nicht geladen — zu gross)');
    expect(prompt).toContain('(Binärdatei — kein Inhalt)');
    // The huge file's content must NOT be present.
    expect(prompt).not.toContain('x'.repeat(200));
  });

  it('escalates the fence when a file contains triple backticks', () => {
    const prompt = buildGoblinChatSystemPrompt({
      projectName: 'X',
      files: [{ path: 'README.md', size: 20, content: 'a\n```js\ncode\n```\nb' }],
    });
    expect(prompt).toContain('````md README.md');
  });
});

describe('B6 — soft-deleted (.trash/) files are excluded from model context', () => {
  const TRASH_PID = 'test-project-context-trash';
  const TRASHED_CONTENT = 'SECRET_TRASHED_MARKER_should_never_reach_the_model';

  beforeAll(async () => {
    await uploadFile(TRASH_PID, 'index.html', '<h1>Live</h1>');
    await uploadFile(TRASH_PID, 'keep.js', 'console.log("keep");');
    // A soft-deleted file (text extension, would otherwise be injected).
    await uploadFile(TRASH_PID, '.trash/1699999999_old.json', TRASHED_CONTENT);
  });

  it('isSoftDeletedPath flags .trash/ paths only', () => {
    expect(isSoftDeletedPath('.trash/1_x.json')).toBe(true);
    expect(isSoftDeletedPath('.trash')).toBe(true);
    expect(isSoftDeletedPath('src/.trash-not-a-prefix.js')).toBe(false);
    expect(isSoftDeletedPath('keep.js')).toBe(false);
  });

  it('loadProjectContextFiles returns no .trash path and no trashed content', async () => {
    const files = await loadProjectContextFiles(TRASH_PID);
    expect(files.some((f) => f.path.startsWith('.trash'))).toBe(false);
    expect(files.some((f) => (f.content ?? '').includes(TRASHED_CONTENT))).toBe(false);
    // the live files are still present
    expect(files.some((f) => f.path === 'keep.js')).toBe(true);
  });

  it('built system prompt contains no .trash path and no trashed content', async () => {
    const files = await loadProjectContextFiles(TRASH_PID);
    const prompt = buildGoblinChatSystemPrompt({ projectName: 'Trash Test', files });
    expect(prompt).not.toContain('.trash');
    expect(prompt).not.toContain(TRASHED_CONTENT);
    expect(prompt).toContain('keep.js'); // live file survives
  });
});

describe('isTextFile', () => {
  it('classifies common extensions', () => {
    expect(isTextFile('a/b/index.html')).toBe(true);
    expect(isTextFile('style.css')).toBe(true);
    expect(isTextFile('img/photo.jpg')).toBe(false);
    expect(isTextFile('font.woff2')).toBe(false);
  });
});
