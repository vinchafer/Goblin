export interface ScoreResult {
  score: number;
  compiled: boolean;
  matched_keywords: string[];
  missing_keywords: string[];
}

/**
 * MVP scoring: case-insensitive substring match of expected keywords.
 * Real compile-check is deferred to 9E.
 */
export function scoreOutput(output: string, expectedKeywords: string[]): ScoreResult {
  if (!output || output.length < 5) {
    return { score: 0, compiled: false, matched_keywords: [], missing_keywords: expectedKeywords };
  }

  const lower = output.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of expectedKeywords) {
    if (lower.includes(kw.toLowerCase())) matched.push(kw);
    else missing.push(kw);
  }

  const score = expectedKeywords.length > 0
    ? Number((matched.length / expectedKeywords.length).toFixed(2))
    : 0;

  const compiled = score >= 0.8;

  return { score, compiled, matched_keywords: matched, missing_keywords: missing };
}
