/**
 * Min-max normalization to 0.0–1.0 within (source, dimension) cohort.
 */
export function normalizeScores(scores: Array<{ key: string; value: number }>): Map<string, number> {
  const valid = scores.filter((s) => !isNaN(s.value) && isFinite(s.value));
  if (valid.length === 0) return new Map();
  if (valid.length === 1) return new Map([[valid[0]!.key, 1.0]]);

  const values = valid.map((s) => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (max === min) {
    return new Map(valid.map((s) => [s.key, 0.5]));
  }

  const result = new Map<string, number>();
  for (const s of valid) {
    const normalized = (s.value - min) / (max - min);
    result.set(s.key, Number(normalized.toFixed(4)));
  }
  return result;
}

export function invertForLowerIsBetter(
  scores: Array<{ key: string; value: number }>,
): Array<{ key: string; value: number }> {
  return scores.map((s) => ({ key: s.key, value: -s.value }));
}
