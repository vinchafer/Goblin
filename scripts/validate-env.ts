/**
 * Environment variable validation script.
 * Run with: npx tsx scripts/validate-env.ts
 *
 * Checks that all required environment variables are set and valid
 * before starting the application.
 */

const REQUIRED_VARS = [
  // Supabase
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",

  // API
  "NEXT_PUBLIC_API_URL",

  // Encryption (for BYOK keys and GitHub tokens)
  "ENCRYPTION_KEY",

  // AI Providers (at least one must be set)
  "ANTHROPIC_API_KEY",
] as const;

const OPTIONAL_VARS = [
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_APP_ID",
  "GITHUB_APP_PRIVATE_KEY",
] as const;

interface ValidationResult {
  missing: string[];
  warnings: string[];
  valid: boolean;
}

function validateEnv(): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required vars
  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Check optional vars (warn if not set)
  for (const key of OPTIONAL_VARS) {
    if (!process.env[key]) {
      warnings.push(
        `${key} is not set — some features may be unavailable`
      );
    }
  }

  // Validate specific formats
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    } catch {
      missing.push(
        "NEXT_PUBLIC_SUPABASE_URL is not a valid URL"
      );
    }
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    try {
      new URL(process.env.NEXT_PUBLIC_API_URL);
    } catch {
      missing.push("NEXT_PUBLIC_API_URL is not a valid URL");
    }
  }

  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32) {
    warnings.push(
      "ENCRYPTION_KEY is shorter than 32 characters — consider using a longer key"
    );
  }

  // Check that at least one AI provider key is set
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  if (!hasAnthropic && !hasOpenAI) {
    warnings.push(
      "No AI provider API key is set (ANTHROPIC_API_KEY or OPENAI_API_KEY) — AI features will not work"
    );
  }

  return {
    missing,
    warnings,
    valid: missing.length === 0,
  };
}

// Run validation
const result = validateEnv();

console.log("\n🔍 Environment Variable Validation\n");
console.log("═══════════════════════════════════\n");

if (result.valid) {
  console.log("✅ All required environment variables are set.\n");
} else {
  console.log("❌ Missing required environment variables:\n");
  for (const m of result.missing) {
    console.log(`   - ${m}`);
  }
  console.log();
}

if (result.warnings.length > 0) {
  console.log("⚠️  Warnings:\n");
  for (const w of result.warnings) {
    console.log(`   - ${w}`);
  }
  console.log();
}

if (!result.valid) {
  console.log(
    "💡 Tip: Copy .env.example to .env and fill in the required values.\n"
  );
  process.exit(1);
} else {
  console.log("✨ Environment is ready!\n");
  process.exit(0);
}