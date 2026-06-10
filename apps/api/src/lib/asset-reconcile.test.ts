import { describe, it, expect } from 'vitest';
import { parseCodeBlocks } from './parse-code-blocks';
import { linkedLocalAssets, reconcileBlockPaths } from './asset-reconcile';

// The EXACT prod scenario captured on 2026-06-10 for project test 322r42
// (DEPLOY_TRACE_2): index.html links `style.css`, but the model emits a
// `styles.css` block — so the edit must be retargeted to `style.css`, the file
// the live page actually loads.
const PROD_INDEX = `<!DOCTYPE html>
<html>
<head>
  <title>Landingpage mit Anmeldeformular</title>
  <link rel="stylesheet" href="style.css">
</head>
<body><div class="container"><h1>Hi</h1></div></body>
</html>`;

describe('linkedLocalAssets', () => {
  it('finds the singular style.css the prod index links', () => {
    const a = linkedLocalAssets(PROD_INDEX);
    expect([...a.css]).toEqual(['style.css']);
    expect(a.js.size).toBe(0);
  });

  it('normalises ./ and leading / and ignores remote stylesheets', () => {
    const html = `<link rel="stylesheet" href="./assets/main.css">
      <link rel="stylesheet" href="https://cdn.example.com/x.css">
      <link rel="preload" href="/nope.css">
      <script src="/app.js"></script>`;
    const a = linkedLocalAssets(html);
    expect([...a.css]).toEqual(['assets/main.css']); // remote dropped, preload (not stylesheet) dropped
    expect([...a.js]).toEqual(['app.js']);
  });
});

describe('reconcileBlockPaths — the deploy-stale fix', () => {
  it('retargets a styles.css edit to the linked style.css (founder repro)', () => {
    const blocks = parseCodeBlocks(
      'Anpassung:\n```css\n<!-- styles.css -->\nbody { background-color: #0000FF; }\n```',
    );
    expect(blocks[0]!.path).toBe('styles.css'); // model named the wrong sibling
    reconcileBlockPaths(blocks, [{ path: 'index.html', content: PROD_INDEX }]);
    expect(blocks[0]!.path).toBe('style.css');  // → lands where the page loads it
    expect(blocks[0]!.content).toContain('#0000FF');
  });

  it('leaves a block already matching the linked href untouched', () => {
    const blocks = parseCodeBlocks('```css\n<!-- style.css -->\nbody{color:red}\n```');
    reconcileBlockPaths(blocks, [{ path: 'index.html', content: PROD_INDEX }]);
    expect(blocks[0]!.path).toBe('style.css');
  });

  it('does NOT retarget when the HTML links multiple stylesheets (ambiguous)', () => {
    const html = `<link rel="stylesheet" href="a.css"><link rel="stylesheet" href="b.css">`;
    const blocks = parseCodeBlocks('```css\nbody{}\n```'); // → styles.css (inferred)
    reconcileBlockPaths(blocks, [{ path: 'index.html', content: html }]);
    expect(blocks[0]!.path).toBe('styles.css'); // unchanged — too ambiguous to guess
  });

  it('does NOT retarget for a new project with no linked assets', () => {
    const blocks = parseCodeBlocks('```css\nbody{}\n```');
    reconcileBlockPaths(blocks, []);
    expect(blocks[0]!.path).toBe('styles.css');
  });

  it('retargets a script edit to the linked src', () => {
    const html = `<script src="main.js"></script>`;
    const blocks = parseCodeBlocks('```js\n<!-- script.js -->\nconsole.log(1)\n```');
    expect(blocks[0]!.path).toBe('script.js');
    reconcileBlockPaths(blocks, [{ path: 'index.html', content: html }]);
    expect(blocks[0]!.path).toBe('main.js');
  });

  it('does not touch html blocks', () => {
    const blocks = parseCodeBlocks('```html\n<!-- index.html -->\n<h1>x</h1>\n```');
    reconcileBlockPaths(blocks, [{ path: 'index.html', content: PROD_INDEX }]);
    expect(blocks[0]!.path).toBe('index.html');
  });
});
