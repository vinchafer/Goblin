import { createBrowserClient as _createBrowserClient, createServerClient as _createServerClient } from '@supabase/ssr';
import type { Database } from './database.types';

export function createBrowserClient() {
  if (typeof window === 'undefined') {
    throw new Error('createBrowserClient should only be called in the browser');
  }

  return _createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function createServerClient(serviceRole: boolean = false) {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = serviceRole
    ? process.env.SUPABASE_SERVICE_ROLE_KEY!
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return _createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {}
  });
}

export type SupabaseClient = ReturnType<typeof createBrowserClient>;