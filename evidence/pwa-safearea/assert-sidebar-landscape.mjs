// LANDSCAPE-U2 deterministic gate — the sidebar collapse/expand state machine.
//
// Models the exact `collapsed` derivation + `toggle` from Sidebar.tsx, for BOTH
// the old logic and the shipped fix, and proves the behavioural difference in the
// landscape-phone band (768–959px → viewportNarrow=true):
//   OLD: the expand toggle can NEVER win against the forced-collapse OR  → bug
//   NEW: an explicit toggle hands control back to the user               → fixed
// Also proves desktop (≥960) behaviour is unchanged. Deterministic; exits non-zero
// on any miss. Run: node evidence/pwa-safearea/assert-sidebar-landscape.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ── OLD logic (pre-fix), reproduced ──
function oldMachine({ viewportNarrow }) {
  let userCollapsed = viewportNarrow; // stored default: collapsed on mobile/narrow
  const collapsed = () => userCollapsed || viewportNarrow;
  const toggle = () => { userCollapsed = !userCollapsed; }; // flipped the STORED flag
  return { collapsed, toggle };
}
// ── NEW logic (shipped fix), reproduced ──
function newMachine({ viewportNarrow }) {
  let userCollapsed = viewportNarrow;
  let narrowOverride = false;
  const collapsed = () => (narrowOverride ? userCollapsed : (userCollapsed || viewportNarrow));
  const toggle = () => { const next = !collapsed(); userCollapsed = next; narrowOverride = true; };
  return { collapsed, toggle };
}

let pass = 0, fail = 0;
const out = [];
const check = (label, cond) => { out.push({ label, ok: !!cond }); cond ? pass++ : fail++; };

// Landscape phone (e.g. iPhone 14 landscape = 844px wide) → viewportNarrow=true.
const landscape = { viewportNarrow: true };

// OLD: starts collapsed, and clicking expand does NOT expand (the bug).
{
  const m = oldMachine(landscape);
  check('OLD landscape: starts collapsed', m.collapsed() === true);
  m.toggle();
  check('OLD landscape: expand toggle is DEAD (still collapsed) — reproduces the bug', m.collapsed() === true);
}
// NEW: starts collapsed (default preserved), clicking expand WORKS, click again collapses.
{
  const m = newMachine(landscape);
  check('NEW landscape: starts collapsed (default preserved)', m.collapsed() === true);
  m.toggle();
  check('NEW landscape: expand toggle now EXPANDS the sidebar', m.collapsed() === false);
  m.toggle();
  check('NEW landscape: toggling again collapses it (operable both ways)', m.collapsed() === true);
}
// Desktop wide (≥960) → viewportNarrow=false → behaviour identical old vs new.
{
  const wide = { viewportNarrow: false };
  const o = oldMachine(wide), n = newMachine(wide);
  // both start expanded (stored default false), toggle → collapsed, toggle → expanded
  check('DESKTOP: old & new both start expanded', o.collapsed() === false && n.collapsed() === false);
  o.toggle(); n.toggle();
  check('DESKTOP: old & new both collapse on toggle', o.collapsed() === true && n.collapsed() === true);
  o.toggle(); n.toggle();
  check('DESKTOP: old & new both re-expand (unchanged)', o.collapsed() === false && n.collapsed() === false);
}

// Source guard: the shipped file actually carries the fix (not just this model).
const src = readFileSync(fileURLToPath(new URL('../../apps/web/components/layout/Sidebar.tsx', import.meta.url)), 'utf8');
check('Sidebar.tsx: narrowOverride state exists', /const \[narrowOverride, setNarrowOverride\] = useState/.test(src));
check('Sidebar.tsx: collapsed uses narrowOverride branch', /narrowOverride \? userCollapsed : \(userCollapsed \|\| viewportNarrow\)/.test(src));
check('Sidebar.tsx: toggle flips effective state + sets override', /const next = !collapsed;[\s\S]*setNarrowOverride\(true\)/.test(src));

console.log('\nLANDSCAPE-U2 — sidebar expand/collapse state machine\n' + '─'.repeat(58));
for (const r of out) console.log(`${r.ok ? '  PASS' : '  FAIL'}  ${r.label}`);
console.log('─'.repeat(58));
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
