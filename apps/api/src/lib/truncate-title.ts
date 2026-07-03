// A4.2 — character-safe title truncation. String.prototype.slice cuts at UTF-16
// code units, so a cut landing inside a surrogate pair (emoji, rare CJK) leaves
// a lone surrogate that renders as U+FFFD. Truncate at code-point boundaries.
export function truncateTitle(text: string, maxCodePoints: number): string {
  const points = [...text.trim()];
  return points.slice(0, maxCodePoints).join('');
}
