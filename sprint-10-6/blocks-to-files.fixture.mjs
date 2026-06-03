// Standalone fixture test for the Send-to-Code splitter (10.6-2).
// Mirrors apps/web/lib/{detect-filename,code-blocks-to-files}.ts logic in plain JS
// so it can run with `node` (no TS build). Verifies the split produces real,
// separately-named files and never the old `// File:`-glued blob.

function detectFilename(content, language) {
  const src = (content || '').trim();
  const lang = (language || '').toLowerCase();
  if (/^<!doctype html/i.test(src) || /<html[\s>]/i.test(src) || lang === 'html') return 'index.html';
  if (lang === 'json') return 'data.json';
  if (lang === 'tsx' || lang === 'jsx') return lang === 'jsx' ? 'Component.jsx' : 'Component.tsx';
  if (lang === 'ts' || lang === 'typescript') return 'script.ts';
  if (lang === 'css' || (/[.#]?[\w-]+\s*\{[^}]*:[^}]*\}/.test(src) && !/function|=>|;\s*$/.test((src.split('\n')[0]) || ''))) return 'styles.css';
  if (lang === 'python' || lang === 'py') return 'main.py';
  if (lang === 'md' || lang === 'markdown') return 'README.md';
  if (lang === 'js' || lang === 'javascript' || /\b(function|const|let|var)\b/.test(src)) return 'script.js';
  return 'snippet.txt';
}

const FILE_COMMENT = /^\s*(?:\/\/|#|<!--)\s*File:\s*(.+?)\s*(?:-->)?\s*$/i;
function stripFileComment(code) {
  const nl = code.indexOf('\n');
  const firstLine = nl === -1 ? code : code.slice(0, nl);
  const m = firstLine.match(FILE_COMMENT);
  if (m) return { hint: (m[1] ?? '').trim(), content: code.slice(nl === -1 ? code.length : nl + 1).replace(/^\n+/, '') };
  return { content: code };
}
function isHtml(content, lang) {
  if ((lang || '').toLowerCase() === 'html') return true;
  return /^<!doctype html/i.test(content.trim()) || /<html[\s>]/i.test(content);
}
function extractRefs(html) {
  const cssM = html.match(/<link[^>]+href=["']\.?\/?([^"'>:]+\.css)["']/i);
  const jsM = html.match(/<script[^>]+src=["']\.?\/?([^"'>:]+\.js)["']/i);
  return { css: cssM?.[1], js: jsM?.[1] };
}
function normalizePath(p) { return p.trim().replace(/^\.?\//, '').replace(/^\/+/, ''); }

function blocksToFiles(blocks) {
  const used = new Set();
  const out = [];
  let htmlSeen = false;
  let refs = {};
  for (const b of blocks) {
    const { content } = stripFileComment(b.code);
    if (isHtml(content, b.language)) { refs = extractRefs(content); break; }
  }
  const dedupe = (name) => {
    const clean = normalizePath(name) || 'snippet.txt';
    if (!used.has(clean)) { used.add(clean); return clean; }
    const slash = clean.lastIndexOf('/');
    const dir = slash >= 0 ? clean.slice(0, slash + 1) : '';
    const file = slash >= 0 ? clean.slice(slash + 1) : clean;
    const dot = file.lastIndexOf('.');
    const base = dot > 0 ? file.slice(0, dot) : file;
    const ext = dot > 0 ? file.slice(dot) : '';
    let i = 2;
    while (used.has(`${dir}${base}-${i}${ext}`)) i++;
    const result = `${dir}${base}-${i}${ext}`;
    used.add(result); return result;
  };
  for (const b of blocks) {
    const { hint, content } = stripFileComment(b.code);
    const lang = (b.language || '').toLowerCase();
    const explicit = (hint || b.filename || '').trim();
    let path;
    if (explicit) path = dedupe(explicit);
    else if (isHtml(content, lang)) { path = dedupe(htmlSeen ? 'page.html' : 'index.html'); htmlSeen = true; }
    else if ((lang === 'css' || detectFilename(content, lang) === 'styles.css') && refs.css) path = dedupe(refs.css);
    else if ((lang === 'js' || lang === 'javascript' || detectFilename(content, lang) === 'script.js') && refs.js) path = dedupe(refs.js);
    else path = dedupe(detectFilename(content, b.language));
    out.push({ path, content });
  }
  return out;
}

// ── Assertions ──────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}\n     expected ${e}\n     actual   ${a}`); }
}

console.log('Test 1: HTML + CSS + JS, HTML links style.css/script.js');
{
  const blocks = [
    { language: 'html', code: '<!DOCTYPE html>\n<html><head><link rel="stylesheet" href="style.css"></head><body><h1>Hi</h1><script src="script.js"></script></body></html>' },
    { language: 'css', code: 'body { font-family: sans-serif; }\n.hero { color: red; }' },
    { language: 'js', code: 'document.querySelector("h1").addEventListener("click", () => alert(1));' },
  ];
  const files = blocksToFiles(blocks);
  eq(files.map(f => f.path), ['index.html', 'style.css', 'script.js'], 'names match HTML refs, index.html at root');
  eq(files.some(f => /\/\/ File:/.test(f.content)), false, 'no // File: comments in content');
}

console.log('Test 2: explicit // File: markers win + stripped from content');
{
  const blocks = [
    { language: 'html', code: '// File: public/home.html\n<!DOCTYPE html><html></html>' },
    { language: 'css', code: '/* nothing */ a{color:blue}' },
  ];
  const files = blocksToFiles(blocks);
  eq(files[0].path, 'public/home.html', 'explicit path honored');
  eq(/File:/.test(files[0].content), false, 'marker stripped from content');
}

console.log('Test 3: single HTML block → index.html');
{
  const files = blocksToFiles([{ language: 'html', code: '<!DOCTYPE html><html><body>x</body></html>' }]);
  eq(files.map(f => f.path), ['index.html'], 'single html → index.html');
}

console.log('Test 4: two CSS blocks dedupe');
{
  const files = blocksToFiles([
    { language: 'css', code: 'a{color:red}' },
    { language: 'css', code: 'b{color:blue}' },
  ]);
  eq(files.map(f => f.path), ['styles.css', 'styles-2.css'], 'dedupe styles.css → styles-2.css');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
