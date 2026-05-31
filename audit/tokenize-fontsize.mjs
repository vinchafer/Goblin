// Phase-1 safe tokenization: replace hardcoded fontSize literals with the matching
// --t-* token ONLY where the token value is identical at every breakpoint (zero visual change).
//   16px -> var(--t-body-fs)     (16 mobile+desktop)
//   14px -> var(--t-small-fs)    (14 mobile+desktop)
//   12px -> var(--t-caption-fs)  (12 mobile+desktop)
// Skips: 11/13/15/18/20/22/24/etc (either no stable token or breakpoint-variant).
import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd();
const exts = new Set(['.tsx', '.ts']);
const SKIP = ['node_modules', '.next', 'audit', 'sprint-', 'Dashboard_Design_Export', '.chrome-debug-profile', 'tests', 'playwright-report', 'test-results'];
const map = [
  // numeric form: fontSize: 16  /  fontSize:16,  (not 16.x, not 160)
  [/fontSize:\s*16(?![\d.])/g, "fontSize: 'var(--t-body-fs)'"],
  [/fontSize:\s*14(?![\d.])/g, "fontSize: 'var(--t-small-fs)'"],
  [/fontSize:\s*12(?![\d.])/g, "fontSize: 'var(--t-caption-fs)'"],
  // string px form: fontSize: '16px' / "16px"
  [/fontSize:\s*['"]16px['"]/g, "fontSize: 'var(--t-body-fs)'"],
  [/fontSize:\s*['"]14px['"]/g, "fontSize: 'var(--t-small-fs)'"],
  [/fontSize:\s*['"]12px['"]/g, "fontSize: 'var(--t-caption-fs)'"],
];
let files = 0, edits = 0; const touched = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (SKIP.some(s => p.includes(s))) continue;
    if (e.isDirectory()) walk(p);
    else if (exts.has(path.extname(e.name))) {
      let src = fs.readFileSync(p, 'utf8'); const orig = src; let n = 0;
      for (const [re, rep] of map) src = src.replace(re, m => { n++; return rep; });
      if (src !== orig) { fs.writeFileSync(p, src); files++; edits += n; touched.push(path.relative(ROOT, p) + ' (' + n + ')'); }
    }
  }
}
walk(path.join(ROOT, 'apps', 'web'));
console.log(`TOKENIZE_DONE files=${files} edits=${edits}`);
fs.writeFileSync(path.join(ROOT, 'sprint-5', 'typography', 'tokenized-files.txt'), touched.sort().join('\n'));
