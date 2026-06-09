import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@goblin/shared/src/database.types';
import { isDemoActive } from '@/lib/demo/demo-flag';
import { createDemoSupabaseClient } from '@/lib/demo/demo-supabase';

export function createClient() {
  // Demo choke point (Sprint 10 §B.1): on a /demo-* route the single client
  // factory returns a no-op stub whose auth.getSession()/getUser() resolve to
  // DEMO_USER and whose query builder resolves to empty — neutralizing every
  // inline createClient() auth/data call across the production tree without
  // forking a single component. Zero effect for real users (isDemoActive() is
  // false everywhere outside the demo tree). See docs/DEMO_MODE_ARCHITECTURE.md.
  if (isDemoActive()) return createDemoSupabaseClient();

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
