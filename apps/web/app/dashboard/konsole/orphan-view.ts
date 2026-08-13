/**
 * AKT 2 · X1-S — how the orphan sweep's answer is READ, as a pure function.
 *
 * `GET /api/admin/ops/orphans` answers three independent lists, and each of them
 * can be `null`. `null` does not mean "none" — it means the check could not be
 * completed (KV unreadable, R2 unreadable, registry unreadable). Confusing the two
 * is the single way this card could do damage: an operator who reads "0" where the
 * truth is "we could not look" stops looking, and a publicly reachable orphaned
 * hostname is exactly the thing nobody would then find.
 *
 * The mapping lives here rather than inline in the JSX for one reason: it is the
 * part that can be wrong, and a pure function is the part a test can hold. The
 * component below only picks a CSS class from what this returns.
 *
 * Deliberately absent: anything that deletes. Purging stays a named-id-only,
 * reason-required call (`purgeOrphans`), and it is not reachable from this file.
 */

/** One list from the report, in the only three states it can be in. */
export type OrphanFinding =
  /** The field came back `null` — the check did not complete. NOT "none found". */
  | { kind: 'unknown' }
  /** The check ran and found nothing. This is a real, earned zero. */
  | { kind: 'clean' }
  /** The check ran and found these. */
  | { kind: 'found'; names: string[] };

export interface OrphanReportBody {
  orphans: string[] | null;
  routeOrphans: string[] | null;
  routesOnDeletedApps: string[] | null;
  knownApps: number | null;
  prefixesInR2: number | null;
  routesInKv: number | null;
  notes: string[];
  timestamp: string;
}

/**
 * One field → one finding.
 *
 * `undefined` is folded into `unknown` on purpose: a field the API did not send is
 * a field nobody checked, and an older API answering without it must not read as a
 * clean sweep.
 */
export function findingOf(value: string[] | null | undefined): OrphanFinding {
  if (value === null || value === undefined) return { kind: 'unknown' };
  if (value.length === 0) return { kind: 'clean' };
  return { kind: 'found', names: value };
}

/**
 * The one-line verdict over all three lists.
 *
 * The ordering is a judgement and worth stating:
 *   • `found` outranks everything. A real finding is actionable now, and an
 *     incomplete sweep alongside it does not make it less so.
 *   • `unknown` (nothing at all could be checked) is called out separately from
 *     `incomplete` (some of it could), because they need different next steps:
 *     the first is "the call did not work", the second is "one half of it did".
 *   • `clean` is only ever returned when all three lists really came back empty.
 *     There is no path in here from a null to a green.
 */
export type OrphanVerdict = 'found' | 'unknown' | 'incomplete' | 'clean';

export function verdictOf(report: OrphanReportBody): OrphanVerdict {
  const fields = [report.routeOrphans, report.routesOnDeletedApps, report.orphans];
  const findings = fields.map(findingOf);
  if (findings.some((f) => f.kind === 'found')) return 'found';
  if (findings.every((f) => f.kind === 'unknown')) return 'unknown';
  if (findings.some((f) => f.kind === 'unknown')) return 'incomplete';
  return 'clean';
}

/** The pill class for a finding. `unknown` is dashed and colourless, never green. */
export function findingClass(finding: OrphanFinding): 'ok' | 'bad' | 'unknown' {
  if (finding.kind === 'unknown') return 'unknown';
  return finding.kind === 'clean' ? 'ok' : 'bad';
}

/**
 * The pill class for the verdict.
 *
 * `incomplete` is `warn`, not `unknown`: something WAS established, and rendering
 * it in the same colourless dashed pill as "nothing could be checked" would throw
 * away the half of the answer that came back.
 */
export function verdictClass(verdict: OrphanVerdict): 'ok' | 'bad' | 'warn' | 'unknown' {
  switch (verdict) {
    case 'found':
      return 'bad';
    case 'clean':
      return 'ok';
    case 'incomplete':
      return 'warn';
    default:
      return 'unknown';
  }
}
