// WAVE-E E3 — dependency safety (D-E2 = allowlist + lockfile-pinning).
//
// Under D-E1 = A, dependencies install + run on the USER'S OWN Vercel build, never on
// Goblin infra — so this is NOT "stop a package from pwning Goblin's server" (it can't
// reach it). The residual risk is a CONTENT-AUTHORING one: could the agent be tricked
// into writing a malicious / typosquatted / exfiltrating package name into the
// package.json Goblin authors on the user's behalf, which then runs in the user's build
// and ships in the user's live site? This module bounds exactly that.
//
// Two independent gates (Wave-D orthogonal — that sandboxes tool execution; this bounds
// what package.json the agent may author):
//   1. ALLOWLIST (selection): the dependency NAME must be on a curated, vetted set.
//      A name outside it is unreachable — typosquats/exfil packages can't be authored.
//   2. EXACT-PIN (mutation): the version must be an exact semver (no ^, ~, ranges, tags,
//      urls, git specs) — the lockfile-pinning half, at the manifest level.
//
// Single source of truth: both the create_project_structure template and the write-time
// enforcement (finalizeDraftWrite) read this list, and the adversarial test asserts
// against it. Expanding v1 = a founder-reviewed edit here (an honest, bounded surface).

/**
 * The curated v1 allowlist: the React/Vite baseline + a short set of popular, widely-
 * audited libraries. Adding to this is a deliberate, reviewed act (Escalation: security
 * model). NOT full npm — that is the founder-gated future once a vetting story exists.
 */
export const ALLOWED_PACKAGES: ReadonlySet<string> = new Set([
  // React runtime
  'react',
  'react-dom',
  'react-router-dom',
  // Vite + build toolchain
  'vite',
  '@vitejs/plugin-react',
  '@vitejs/plugin-react-swc',
  'typescript',
  // TS types
  '@types/react',
  '@types/react-dom',
  '@types/node',
  // Small, popular, well-audited utilities
  'clsx',
  'classnames',
  'zustand',
  'zod',
  'date-fns',
  'nanoid',
  'uuid',
  'immer',
]);

/** Exact semver: MAJOR.MINOR.PATCH with an optional prerelease/build (e.g. 1.2.3,
 *  4.0.0-rc.1). Rejects ranges (^, ~, x, *, ||, -), tags (latest), urls, git specs. */
const EXACT_SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function isAllowedPackage(name: string): boolean {
  return ALLOWED_PACKAGES.has(name);
}

export function isExactVersion(version: string): boolean {
  return EXACT_SEMVER.test(version.trim());
}

/** A dependency passes iff its name is allowlisted AND its version is exact-pinned. */
export function isAllowedDependency(name: string, version: string): boolean {
  return isAllowedPackage(name) && isExactVersion(version);
}

export interface RejectedDep {
  name: string;
  version: string;
  reason: 'not_allowlisted' | 'not_pinned';
}

export interface PackageJsonVerdict {
  ok: boolean;
  rejected: RejectedDep[];
  /** True when the content could not be parsed as JSON (validation skipped, not a block). */
  unparseable: boolean;
}

const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;

/**
 * Validate a package.json's declared dependencies against the allowlist + exact-pin
 * policy. Malformed JSON is NOT a policy block (npm/Vercel will fail it honestly at
 * build) — it returns { ok:true, unparseable:true } so the enforcement layer lets the
 * write through and the honest build failure surfaces downstream. A parseable manifest
 * with a non-allowlisted or unpinned dependency returns ok:false with the offenders.
 */
export function validatePackageJson(content: string): PackageJsonVerdict {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: true, rejected: [], unparseable: true };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: true, rejected: [], unparseable: true };
  }

  const rejected: RejectedDep[] = [];
  const obj = parsed as Record<string, unknown>;
  for (const field of DEP_FIELDS) {
    const deps = obj[field];
    if (!deps || typeof deps !== 'object') continue;
    for (const [name, versionRaw] of Object.entries(deps as Record<string, unknown>)) {
      const version = typeof versionRaw === 'string' ? versionRaw : String(versionRaw);
      if (!isAllowedPackage(name)) {
        rejected.push({ name, version, reason: 'not_allowlisted' });
      } else if (!isExactVersion(version)) {
        rejected.push({ name, version, reason: 'not_pinned' });
      }
    }
  }
  return { ok: rejected.length === 0, rejected, unparseable: false };
}

/**
 * E5 honest edge copy (DE + EN) for a rejected package.json — names the offending
 * packages and why, and stays actionable. Never a raw stack trace.
 */
export function dependencyRejectionMessage(rejected: RejectedDep[]): string {
  const notAllowed = rejected.filter((r) => r.reason === 'not_allowlisted');
  const notPinned = rejected.filter((r) => r.reason === 'not_pinned');
  const parts: string[] = [];
  if (notAllowed.length) {
    const names = notAllowed.map((r) => `„${r.name}"`).join(', ');
    parts.push(
      `Diese Pakete stehen nicht auf der Freigabeliste und können aus Sicherheitsgründen nicht hinzugefügt werden: ${names}. ` +
      `Erlaubt sind derzeit u.a. react, react-dom, react-router-dom, vite, zustand, zod, date-fns, clsx. ` +
      `Nutze eines davon oder löse die Aufgabe ohne dieses Paket.`,
    );
  }
  if (notPinned.length) {
    const names = notPinned.map((r) => `„${r.name}: ${r.version}"`).join(', ');
    parts.push(
      `Bitte pinne jede Abhängigkeit auf eine exakte Version (z.B. "18.3.1", nicht "^18" oder "latest"): ${names}.`,
    );
  }
  const en: string[] = [];
  if (notAllowed.length) {
    en.push(
      `These packages are not on the allowlist and can't be added for security reasons: ` +
      `${notAllowed.map((r) => `"${r.name}"`).join(', ')}. Allowed today include react, react-dom, ` +
      `react-router-dom, vite, zustand, zod, date-fns, clsx.`,
    );
  }
  if (notPinned.length) {
    en.push(`Pin every dependency to an exact version (e.g. "18.3.1", not "^18" or "latest").`);
  }
  return `${parts.join(' ')}\n\n[EN] ${en.join(' ')}`;
}
