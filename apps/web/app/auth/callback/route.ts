import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=Authentication+failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message ?? 'Authentication failed')}`
    );
  }

  const user = data.session.user;

  // Create user row on first login — ignore unique constraint violation on repeat logins
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('users')
    .insert({
      id: user.id,
      email: user.email ?? '',
      // Neutral default — first login no longer grants 'build' (a real paid plan).
      // The user actively chooses a trial or subscription at the gate. Requires
      // migration 0070 (adds 'none' to the users_plan_check constraint).
      plan: 'none',
    })
    .then(() => {}, () => {
      // Ignore — user row already exists (subsequent logins)
    });

  // Route fresh sign-ins without a BYOK key into the onboarding welcome flow.
  // Returning users with a key skip straight to the dashboard.
  let hasKey = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from('byok_keys')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    hasKey = (count ?? 0) > 0;
  } catch {
    /* fall through — welcome page double-checks client-side */
  }

  return NextResponse.redirect(`${origin}${hasKey ? '/dashboard' : '/welcome/language'}`);
}
