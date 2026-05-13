import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Only available when ENABLE_TEST_AUTH=true — never enable in production
const isTestEnabled = () => process.env.ENABLE_TEST_AUTH === 'true';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  if (!isTestEnabled()) {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  const testToken = process.env.TEST_AUTH_TOKEN;
  if (!testToken) {
    return NextResponse.json({ error: 'TEST_AUTH_TOKEN not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('X-Test-Auth-Token');
  if (authHeader !== testToken) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await request.json();
  const { plan = 'seed', redirectTo = 'http://localhost:3000/auth/test-callback' } = body;
  const testEmail = body.email || `playwright-${crypto.randomUUID()}@test.justgoblin.com`;

  const supabase = adminClient();

  // Find or create auth user
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }
  const existing = users.find(u => u.email === testEmail);

  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      email_confirm: true,
    });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? 'create user failed' }, { status: 500 });
    }
    userId = data.user.id;

    // Create users row
    await supabase.from('users').insert({
      id: userId,
      email: testEmail,
      plan,
      monthly_requests_used: 0,
    }).then(() => {}, () => {});

    // Mark onboarding completed so dashboard doesn't redirect
    await supabase.from('onboarding_steps').insert({
      user_id: userId,
      completed: true,
      current_step: 5,
    }).then(() => {}, () => {});
  }

  // Optionally create a test project (so isFirstLogin=false → no tour shown)
  let projectId: string | null = null;
  if (body.createProject !== false) {
    const { data: existingProjects } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (!existingProjects?.length) {
      const newProjectId = crypto.randomUUID();
      const { data: proj } = await supabase.from('projects').insert({
        id: newProjectId,
        name: 'Test Project',
        description: 'Created by Playwright tests',
        user_id: userId,
        color: '#2D4A2B',
      }).select('id').single();
      projectId = proj?.id ?? newProjectId;
    } else {
      projectId = existingProjects[0]!.id;
    }
  }

  // Generate magic link
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: testEmail,
    options: { redirectTo },
  });

  if (linkError || !linkData.properties?.action_link) {
    return NextResponse.json({ error: linkError?.message ?? 'link generation failed' }, { status: 500 });
  }

  return NextResponse.json({
    email: testEmail,
    userId,
    projectId,
    magicLink: linkData.properties.action_link,
  });
}

// Delete test users after test run
export async function DELETE(request: NextRequest) {
  if (!isTestEnabled()) {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }

  const testToken = process.env.TEST_AUTH_TOKEN;
  const authHeader = request.headers.get('X-Test-Auth-Token');
  if (!testToken || authHeader !== testToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userIds } = await request.json();
  const supabase = adminClient();

  const results = await Promise.allSettled(
    (userIds as string[]).map((id) => supabase.auth.admin.deleteUser(id))
  );

  return NextResponse.json({
    deleted: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  });
}
