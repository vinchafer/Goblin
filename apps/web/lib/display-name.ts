// FIX3-4 (V2-P2-3): one canonical resolution for the user's display name so every
// surface (sidebar pill, settings ProfileCard, Personalisierung) shows the SAME
// value. Previously each read a different field/precedence, so a name stored in
// `display_name` vs `full_name` showed up as two different "Vincent 4xx" strings.
// Precedence matches the server (`/api/users/me` displayName): display_name first.
export function resolveDisplayName(
  source: { display_name?: unknown; full_name?: unknown; name?: unknown } | null | undefined,
  email?: string | null,
): string {
  const s = source ?? {};
  const pick = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  return (
    pick(s.display_name) ||
    pick(s.full_name) ||
    pick(s.name) ||
    (email ? email.split('@')[0] ?? '' : '') ||
    ''
  );
}
