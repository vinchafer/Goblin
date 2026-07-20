// FOUNDER-WALK-2 U5.5 — SSR guard for the admin Health page.
//
// /admin/health is a server component that ran Promise.all over four fetches
// (db stats, api health, recent errors, trial stats). Only getApiHealth caught
// its own errors; the three Supabase reads did not, so a single rejected query
// (network blip, permission error) rejected the whole Promise.all and THREW
// during SSR — the page rendered a 500 / blank instead of degrading.
//
// `settle` runs a fetch and can never throw: on failure it returns a fallback
// plus ok:false, so the page composes reliably and can show an honest
// "unavailable" state for just the section that failed. Pure + tested.

export interface Settled<T> {
  ok: boolean;
  data: T;
}

export async function settle<T>(work: () => Promise<T>, fallback: T): Promise<Settled<T>> {
  try {
    return { ok: true, data: await work() };
  } catch {
    return { ok: false, data: fallback };
  }
}
