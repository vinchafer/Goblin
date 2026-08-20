// F4.2 (feel-4): global user preferences ("Wie Goblin arbeitet"), injected into
// EVERY chat and agent run so the model addresses the user by name, matches the
// requested register (knapp/ausführlich), and includes or omits the why-paragraph.
//
// Tolerant by design: the pref_* columns land in migration 0082 (authored, not yet
// applied). Until the founder applies it, the select below errors on the missing
// columns and we fall back to reading only custom_instructions (already live since
// 0048) — so the global user block still injects the user's free-text instructions
// (previously stored-but-never-injected) while the three structured prefs stay inert.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface UserPreferences {
  /** custom_instructions (0048) — free-text global instructions, always injected when set. */
  customInstructions?: string | null;
  /** F4.2: how to address the user, in greetings and reports. */
  addressName?: string | null;
  /** F4.2: response register. */
  responseStyle?: 'knapp' | 'ausfuehrlich' | null;
  /** F4.2: include the why-paragraph on code changes / in agent report cards. */
  explainChanges?: boolean | null;
  /**
   * FOUNDER-WALK-7 · U3(b): users.preferred_lang (0059) — the SAME account-level
   * language choice the Settings → Sprache switcher writes (web:
   * lib/account-lang.ts persistLangToAccount). Previously read only by the web
   * frontend (hydrateLangFromAccount) — never by chat/agent, so an EN account still
   * got German prose unless the user's own wording happened to be English. 'de' when
   * unset (matches the web surface default, lib/use-lang.ts).
   */
  preferredLang?: 'de' | 'en';
}

/** Load a user's global preferences. Returns null only when nothing is set. */
export async function loadUserPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserPreferences | null> {
  // Try the full set first (post-0082). On a missing-column error, retry with the
  // always-present custom_instructions so the global block never fully goes dark.
  const full = await supabase
    .from('users')
    .select('custom_instructions, pref_address_name, pref_response_style, pref_explain_changes, preferred_lang')
    .eq('id', userId)
    .maybeSingle();

  let row = full.data as Record<string, unknown> | null;
  if (full.error) {
    // U3(b): keep preferred_lang in the fallback too — it is 0059 (long applied,
    // already live for the web switcher), independent of the 0082 pref_* columns
    // this fallback exists for. A DB with 0059 but not yet 0082 must still get it.
    const fallback = await supabase
      .from('users')
      .select('custom_instructions, preferred_lang')
      .eq('id', userId)
      .maybeSingle();
    if (fallback.error) return null;
    row = fallback.data as Record<string, unknown> | null;
  }
  if (!row) return null;

  const customInstructions = typeof row.custom_instructions === 'string' ? row.custom_instructions.trim() : '';
  const addressName = typeof row.pref_address_name === 'string' ? row.pref_address_name.trim() : '';
  const responseStyle =
    row.pref_response_style === 'knapp' || row.pref_response_style === 'ausfuehrlich'
      ? row.pref_response_style
      : null;
  const explainChanges = typeof row.pref_explain_changes === 'boolean' ? row.pref_explain_changes : null;
  const preferredLang: 'de' | 'en' = row.preferred_lang === 'en' ? 'en' : 'de';

  const prefs: UserPreferences = {
    customInstructions: customInstructions || null,
    addressName: addressName || null,
    responseStyle,
    explainChanges,
    preferredLang,
  };
  // U3(b): preferredLang always has a value (default 'de'), so it must NOT gate
  // `anySet` the way the other, genuinely-optional prefs do — a null return here
  // would silently drop an EN account's language back to unset. The other three
  // stay the existing "only when something is actually set" rule.
  const anySet = prefs.customInstructions || prefs.addressName || prefs.responseStyle || prefs.explainChanges != null;
  return anySet ? prefs : { preferredLang };
}
