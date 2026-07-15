/**
 * WAVE D-G U4 — deterministic style-compliance checker.
 * Scores each generated archetype on 5 objective checks. Pure text analysis over the
 * generated files (no model, no browser) → reproducible. Target: ≥4/5 on 3/3 archetypes.
 *
 * Usage: tsx scripts/dg-beauty/style-check.ts <before|after>
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BANNED_BLUE = /#(007bff|0d6efd)\b/i;
const GOOGLE_FONTS = /fonts\.googleapis\.com|fonts\.gstatic\.com/i;
// System / generic families that do NOT count as an "intentional" typeface choice.
const SYSTEM_FAMILY = /^(system-ui|-apple-system|BlinkMacSystemFont|Segoe UI( Emoji| Symbol)?|Roboto|Helvetica( Neue)?|Arial|sans-serif|serif|monospace|cursive|fantasy|Tahoma|Geneva|Verdana|Times( New Roman)?|Courier( New)?|ui-sans-serif|ui-serif|ui-monospace|Cantarell|Oxygen|Ubuntu|Droid Sans|Apple Color Emoji|Noto Color Emoji|emoji|math|Liberation Sans|sans)$/i;

/** Intentional typography = a Google Fonts link, OR a font-family that names a real
 *  (non-system, non-generic) typeface. A bare system stack ('Segoe UI', Arial, …) fails. */
function hasIntentionalFont(code: string): boolean {
  if (GOOGLE_FONTS.test(code)) return true;
  const decls = code.match(/font-family\s*:\s*[^;}\n]+/gi) || [];
  for (const d of decls) {
    const families = d.replace(/font-family\s*:/i, '').split(',');
    for (let fam of families) {
      fam = fam.replace(/["']/g, '').trim();
      if (fam && !SYSTEM_FAMILY.test(fam)) return true;
    }
  }
  return false;
}
const ROOT_BLOCK = /:root\s*\{[^}]*--[\w-]+\s*:/;
const VAR_USE = /var\(\s*--[\w-]+/;
const RADIUS_VAR = /--(radius|rounded|corner)[\w-]*\s*:/i;
const RADIUS_LITERAL = /border-radius\s*:\s*([^;}\n]+)/gi;
const TRANSITION = /transition\s*:/i;

interface Check { key: string; label: string; pass: boolean; detail: string; }

function collect(dir: string): string {
  let out = '';
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_')) continue; // skip _raw.md / _meta.json
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out += collect(full);
    else if (/\.(html?|css|js)$/i.test(name)) out += '\n' + readFileSync(full, 'utf8');
  }
  return out;
}

/** Count distinct non-zero border-radius literal values (ignoring var()-based ones). */
function distinctRadii(code: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(RADIUS_LITERAL.source, 'gi');
  while ((m = re.exec(code)) !== null) {
    const val = (m[1] || '').trim();
    if (/var\(/.test(val)) continue; // consistent by construction
    // normalize each length token; keep non-zero numeric radii
    for (const tok of val.split(/\s+/)) {
      const t = tok.trim();
      if (/^0(px|rem|em|%)?$/.test(t)) continue;
      if (/^\d*\.?\d+(px|rem|em|%)$/.test(t)) set.add(t);
    }
  }
  return [...set];
}

function scoreArchetype(dir: string): { checks: Check[]; score: number } {
  const code = collect(dir);
  const radii = distinctRadii(code);
  const hasRadiusVar = RADIUS_VAR.test(code);
  const checks: Check[] = [
    {
      key: 'a', label: 'no banned default-blue',
      pass: !BANNED_BLUE.test(code),
      detail: BANNED_BLUE.test(code) ? 'contains #007bff/#0d6efd' : 'clean',
    },
    {
      key: 'b', label: 'intentional fonts (Google Fonts or real typeface)',
      pass: hasIntentionalFont(code),
      detail: GOOGLE_FONTS.test(code) ? 'Google Fonts link' : hasIntentionalFont(code) ? 'named non-system typeface' : 'system stack only',
    },
    {
      key: 'c', label: ':root custom-property palette, referenced',
      pass: ROOT_BLOCK.test(code) && VAR_USE.test(code),
      detail: `:root-vars=${ROOT_BLOCK.test(code)} var()-used=${VAR_USE.test(code)}`,
    },
    {
      key: 'd', label: 'consistent border-radius',
      pass: hasRadiusVar || radii.length <= 2,
      detail: hasRadiusVar ? '--radius var' : `distinct radii: [${radii.join(', ')}] (${radii.length})`,
    },
    {
      key: 'e', label: 'transitions on interactive elements',
      pass: TRANSITION.test(code),
      detail: TRANSITION.test(code) ? 'transition present' : 'no transition',
    },
  ];
  return { checks, score: checks.filter((c) => c.pass).length };
}

function main() {
  const phase = process.argv[2] || 'after';
  const root = join('evidence', 'dg-beauty', phase);
  const archetypes = readdirSync(root).filter((n) => statSync(join(root, n)).isDirectory() && n !== 'register').sort();
  const rows: string[] = [];
  const results: Record<string, unknown> = {};
  let passArchetypes = 0;
  rows.push(`| Archetype | a: no banned blue | b: intentional fonts | c: :root palette | d: consistent radius | e: transitions | Score |`);
  rows.push(`|---|---|---|---|---|---|---|`);
  for (const a of archetypes) {
    const { checks, score } = scoreArchetype(join(root, a));
    results[a] = { score, checks };
    if (score >= 4) passArchetypes++;
    const cell = (c: Check) => (c.pass ? '✅' : '❌');
    rows.push(`| ${a} | ${cell(checks[0]!)} | ${cell(checks[1]!)} | ${cell(checks[2]!)} | ${cell(checks[3]!)} | ${cell(checks[4]!)} | **${score}/5** |`);
  }
  const summary = `\n**${phase.toUpperCase()}** — ${passArchetypes}/${archetypes.length} archetypes at ≥4/5 (target: 3/3)\n`;
  const md = `# Style compliance — ${phase}\n\n${rows.join('\n')}\n${summary}`;
  const outPath = join(root, '_style-compliance.md');
  writeFileSync(outPath, md);
  writeFileSync(join(root, '_style-compliance.json'), JSON.stringify(results, null, 2));
  console.log(md);
  console.log(`written → ${outPath}`);
}

main();
