// Demo Supabase client — a chainable no-op stub returned by createClient() when
// isDemoActive() (the single choke point that neutralizes all ~45 inline auth
// call sites; see docs/DEMO_MODE_ARCHITECTURE.md §2).
//
// Contract (Checkpoint #1 follow-up):
//  - auth.getSession()/getUser() resolve to DEMO_USER → no component redirects to
//    /login.
//  - query builder (from().select().eq()…) is a thenable chain resolving to
//    { data: [], error: null }. Demo views get real content via props, not these.
//  - EVERY property access returns a truthy callable → cleanup paths
//    (subscription.unsubscribe(), removeChannel()) never hit undefined.
//  - Unmodelled call paths console.warn ONCE in dev (fail-loud, not silent) while
//    still returning a safe value.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@goblin/shared/src/database.types";
import { DEMO_USER } from "./demo-user";

const warned = new Set<string>();
function warnOnce(path: string): void {
  if (process.env.NODE_ENV !== "production" && !warned.has(path)) {
    warned.add(path);
    // eslint-disable-next-line no-console
    console.warn(`[demo-supabase] unmodelled call: ${path}`);
  }
}

// PostgREST builder methods we expect — anything outside this set warns.
const KNOWN_QUERY = new Set<string>([
  "from", "select", "insert", "update", "upsert", "delete", "rpc",
  "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in",
  "contains", "containedBy", "or", "and", "not", "match", "filter", "textSearch",
  "order", "limit", "range", "single", "maybeSingle", "csv", "then",
  "abortSignal", "throwOnError", "returns", "overrideTypes",
]);

type QueryResult = { data: never[]; error: null };

/** A callable, awaitable, infinitely-chainable proxy that resolves to empty. */
function makeChain(path: string): unknown {
  const base = (): unknown => makeChain(path);
  return new Proxy(base, {
    get(_target, prop): unknown {
      if (prop === "then") {
        return (resolve: (value: QueryResult) => unknown): unknown =>
          resolve({ data: [], error: null });
      }
      if (typeof prop === "symbol") return makeChain(path);
      if (!KNOWN_QUERY.has(prop)) warnOnce(`${path}.${prop}`);
      return makeChain(`${path}.${prop}`);
    },
    apply(): unknown {
      return makeChain(path);
    },
  });
}

const DEMO_SESSION = {
  access_token: "demo-access-token",
  refresh_token: "demo-refresh-token",
  expires_at: 9_999_999_999,
  expires_in: 3600,
  token_type: "bearer",
  user: DEMO_USER,
};

const auth = {
  getSession: async () => ({ data: { session: DEMO_SESSION }, error: null }),
  getUser: async () => ({ data: { user: DEMO_USER }, error: null }),
  signOut: async () => ({ error: null }),
  refreshSession: async () => ({ data: { session: DEMO_SESSION, user: DEMO_USER }, error: null }),
  setSession: async () => ({ data: { session: DEMO_SESSION, user: DEMO_USER }, error: null }),
  updateUser: async () => ({ data: { user: DEMO_USER }, error: null }),
  onAuthStateChange: (_callback: unknown) => ({
    data: { subscription: { id: "demo-sub", callback: _callback, unsubscribe: (): void => {} } },
  }),
};

/**
 * Returns a stub typed as the production SupabaseClient. The single `as unknown
 * as` cast is the deliberate boundary between the dynamic proxy and the typed
 * client surface — no `any`, no `@ts-ignore`.
 */
export function createDemoSupabaseClient(): SupabaseClient<Database> {
  const client = new Proxy(
    { auth },
    {
      get(target, prop): unknown {
        if (prop === "auth") return target.auth;
        if (prop === "from") return (table: string): unknown => makeChain(`from(${table})`);
        if (prop === "rpc") return (fn: string): unknown => makeChain(`rpc(${fn})`);
        if (prop === "channel") return (): unknown => makeChain("channel");
        if (prop === "removeChannel") return (): void => {};
        if (prop === "removeAllChannels") return (): void => {};
        if (typeof prop === "symbol") return makeChain("client");
        warnOnce(prop);
        return makeChain(prop);
      },
    },
  );
  return client as unknown as SupabaseClient<Database>;
}
