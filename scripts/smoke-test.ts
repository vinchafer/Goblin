#!/usr/bin/env tsx
/**
 * Goblin Smoke Test
 * Run with: npx tsx scripts/smoke-test.ts
 *
 * Tests the core API flow: user creation, project creation, chat streaming,
 * and health check. Requires a running API server and Supabase instance.
 *
 * Prerequisites:
 *   - .env file with valid Supabase credentials
 *   - API server running on NEXT_PUBLIC_API_URL
 *   - Optional: TEST_ANTHROPIC_KEY for BYOK key test
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

// ─── Configuration ───────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const TEST_ANTHROPIC_KEY = process.env.TEST_ANTHROPIC_KEY;

// ─── Validation ──────────────────────────────────────────────────────────────

function validateConfig(): void {
  const missing: string[] = [];

  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_SERVICE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!API_URL) missing.push("NEXT_PUBLIC_API_URL");

  if (missing.length > 0) {
    console.error(
      `❌ Missing required environment variables: ${missing.join(", ")}`
    );
    console.error("   Make sure you have a .env file with these values set.");
    process.exit(1);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function logStep(step: number, description: string): void {
  console.log(`\n📋 Step ${step}: ${description}...`);
}

function logPass(message: string): void {
  console.log(`   ✅ PASS: ${message}`);
}

function logFail(message: string, err: unknown): void {
  const errorMessage = err instanceof Error ? err.message : String(err);
  console.error(`   ❌ FAIL: ${message}`);
  console.error(`      Error: ${errorMessage}`);
}

function logSkip(message: string): void {
  console.log(`   ⏭️  SKIP: ${message}`);
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log("🚀 GOBLIN SMOKE TEST\n");
  console.log("═══════════════════════════════════════\n");

  validateConfig();

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
  const testEmail = `test-${randomBytes(8).toString("hex")}@example.com`;
  let userId: string;
  let token: string;
  let projectId: string;

  // ── Step 1: Create test user ─────────────────────────────────────────────

  logStep(1, "Creating test user");
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: "testpass123",
      email_confirm: true,
    });

    if (error) throw error;
    userId = data.user.id;

    const { data: sessionData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: "testpass123",
      });

    if (signInError) throw signInError;
    if (!sessionData.session?.access_token) {
      throw new Error("No access token returned");
    }
    token = sessionData.session.access_token;

    logPass(`User created and authenticated (${testEmail})`);
  } catch (err) {
    logFail("User creation failed", err);
    process.exit(1);
  }

  // ── Step 2: Create project ──────────────────────────────────────────────

  logStep(2, "Creating test project");
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/projects`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Smoke Test Project",
        description: "Created by smoke test",
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body}`);
    }

    const project = (await response.json()) as { id: string };
    projectId = project.id;

    logPass(`Project created (id: ${projectId})`);
  } catch (err) {
    logFail("Project creation failed", err);
    process.exit(1);
  }

  // ── Step 3: Add BYOK key (optional) ─────────────────────────────────────

  logStep(3, "Adding BYOK key");
  if (!TEST_ANTHROPIC_KEY) {
    logSkip("TEST_ANTHROPIC_KEY not set — skipping BYOK key test");
  } else {
    try {
      const response = await fetchWithTimeout(`${API_URL}/api/byok-keys`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test Key",
          provider: "anthropic",
          api_key: TEST_ANTHROPIC_KEY,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body}`);
      }

      logPass("BYOK key added successfully");
    } catch (err) {
      logFail("BYOK key addition failed", err);
      // Non-fatal — continue with other tests
    }
  }

  // ── Step 4: Chat stream ─────────────────────────────────────────────────

  logStep(4, "Testing chat stream");
  try {
    const response = await fetchWithTimeout(
      `${API_URL}/api/chat/stream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Hi, this is a smoke test. Say hello!",
          projectId,
        }),
      },
      60000 // 60s timeout for AI response
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body}`);
    }

    if (!response.body) {
      throw new Error("Response has no body (streaming not supported)");
    }

    const reader = response.body.getReader();
    let chunks = 0;
    let done = false;
    let totalBytes = 0;

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      if (value) {
        chunks++;
        totalBytes += value.length;
      }
    }

    if (chunks === 0) {
      throw new Error("No stream chunks received");
    }

    logPass(`Chat stream received ${chunks} chunks (${totalBytes} bytes)`);
  } catch (err) {
    logFail("Chat stream test failed", err);
    // Non-fatal — the API might not have AI keys configured
    console.log(
      "   💡 Tip: Make sure ANTHROPIC_API_KEY is set and the API server is running."
    );
  }

  // ── Step 5: Health check ────────────────────────────────────────────────

  logStep(5, "Health check");
  try {
    const response = await fetchWithTimeout(`${API_URL}/health`, {});

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const health = (await response.json()) as { status: string };
    logPass(`Health check status: ${health.status}`);
  } catch (err) {
    logFail("Health check failed", err);
    console.log(
      "   💡 Tip: Make sure the API server is running on " + API_URL
    );
    process.exit(1);
  }

  // ── Step 6: Cleanup ─────────────────────────────────────────────────────

  logStep(6, "Cleaning up test user");
  try {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
    logPass("Test user deleted");
  } catch (err) {
    logFail("Cleanup failed", err);
    console.log(`   Test user may need manual cleanup: ${testEmail}`);
  }

  // ── Done ─────────────────────────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════");
  console.log("🎉 Smoke test complete!");
  console.log("═══════════════════════════════════════\n");
}

run().catch((err) => {
  console.error("\n💥 SMOKE TEST FAILED:", err);
  process.exit(1);
});
