#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const TEST_ANTHROPIC_KEY = process.env.TEST_ANTHROPIC_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  console.log('🚀 GOBLIN FULL PHASE 1 SMOKE TEST\n');
  const testEmail = `test-${randomBytes(8).toString('hex')}@example.com`;
  let userId: string;
  let token: string;
  let projectId: string;

  // Step 1: Create test user
  try {
    console.log('✅ Step 1: Creating test user...');
    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'testpass123',
      email_confirm: true
    });

    if (error) throw error;
    userId = data.user.id;

    const { data: session } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: 'testpass123'
    });
    token = session.data.session!.access_token;

    console.log('✅ PASS: User created, authenticated');
  } catch (err) {
    console.error('❌ FAIL: Step 1 failed', err);
    process.exit(1);
  }

  // Step 2: Create project
  try {
    console.log('\n✅ Step 2: Creating test project...');
    const response = await fetch(`${API_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Smoke Test Project',
        description: 'Created by smoke test'
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const project = await response.json();
    projectId = project.id;

    console.log('✅ PASS: Project created');
  } catch (err) {
    console.error('❌ FAIL: Step 2 failed', err);
    process.exit(1);
  }

  // Step 3: Add BYOK key
  try {
    console.log('\n✅ Step 3: Adding BYOK key...');
    const response = await fetch(`${API_URL}/api/byok-keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Key',
        provider: 'anthropic',
        api_key: TEST_ANTHROPIC_KEY
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    console.log('✅ PASS: BYOK key added');
  } catch (err) {
    console.error('❌ FAIL: Step 3 failed', err);
    process.exit(1);
  }

  // Step 4: Chat stream
  try {
    console.log('\n✅ Step 4: Testing chat stream...');
    const response = await fetch(`${API_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Hi, this is a test',
        projectId
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const reader = response.body!.getReader();
    let chunks = 0;
    let done = false;

    const timeout = setTimeout(() => {
      throw new Error('Stream timed out');
    }, 30000);

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      if (value) chunks++;
    }

    clearTimeout(timeout);

    if (chunks === 0) throw new Error('No tokens received');

    console.log(`✅ PASS: Chat stream received ${chunks} chunks`);
  } catch (err) {
    console.error('❌ FAIL: Step 4 failed', err);
    process.exit(1);
  }

  // Step 5: Check usage counter
  try {
    console.log('\n✅ Step 5: Checking usage counter...');
    const response = await fetch(`${API_URL}/api/usage`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const usage = await response.json();

    if (usage.monthly_requests_used === 0) throw new Error('Usage not incremented');

    console.log(`✅ PASS: Usage counter at ${usage.monthly_requests_used}`);
  } catch (err) {
    console.error('❌ FAIL: Step 5 failed', err);
    process.exit(1);
  }

  // Step 6: Health check
  try {
    console.log('\n✅ Step 6: Health check...');
    const response = await fetch(`${API_URL}/health`);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const health = await response.json();

    if (health.status !== 'ok') throw new Error('Health check degraded');

    console.log(`✅ PASS: Health check status: ${health.status}`);
  } catch (err) {
    console.error('❌ FAIL: Step 6 failed', err);
    process.exit(1);
  }

  console.log('\n🎉 ALL TESTS PASSED - GOBLIN IS READY FOR LAUNCH');
  console.log(`   Test user: ${testEmail}`);
  process.exit(0);
}

run().catch(err => {
  console.error('\n💥 SMOKE TEST FAILED', err);
  process.exit(1);
});