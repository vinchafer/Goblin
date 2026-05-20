import { createClient } from '@/lib/supabase/client';

export async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
