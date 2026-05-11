import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { type SupabaseClient } from '@supabase/supabase-js';
import { resolveModel } from './model-router';

const __dir = dirname(fileURLToPath(import.meta.url));

// Load system prompt once at startup
const SYSTEM_PROMPT = (() => {
  try {
    return readFileSync(join(__dir, '../prompts/setup-buddy-system.md'), 'utf-8');
  } catch {
    return 'You are the Goblin Setup Buddy. Help users set up Goblin in under 5 minutes. Be warm, direct, and concise.';
  }
})();

// PII patterns to redact before echoing
const PII_PATTERNS = [
  /sk-[A-Za-z0-9\-_]{20,}/g,          // OpenAI key
  /sk-ant-[A-Za-z0-9\-_]{20,}/g,       // Anthropic key
  /AIza[A-Za-z0-9\-_]{30,}/g,          // Google key
  /\b4[0-9]{12}(?:[0-9]{3})?\b/g,      // Visa
  /\b5[1-5][0-9]{14}\b/g,              // Mastercard
];

export function redactPII(text: string): { redacted: string; hadPII: boolean } {
  let redacted = text;
  let hadPII = false;
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(redacted)) {
      hadPII = true;
      redacted = redacted.replace(pattern, '[redacted]');
    }
    pattern.lastIndex = 0;
  }
  return { redacted, hadPII };
}

export interface BuddyMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface OnboardingState {
  goal?: string;
  ai_provider_choice?: string;
  code_hosting_choice?: string;
  deploy_choice?: string;
  completed?: boolean;
}

interface StreamSetupBuddyParams {
  userId: string;
  userMessage: string;
  history: BuddyMessage[];
  onboardingState: OnboardingState;
  supabase: SupabaseClient;
}

export async function* streamSetupBuddy({
  userId,
  userMessage,
  history,
  onboardingState,
  supabase,
}: StreamSetupBuddyParams): AsyncGenerator<string, void, unknown> {
  // Redact PII from user message
  const { redacted, hadPII } = redactPII(userMessage);
  if (hadPII) {
    yield JSON.stringify({
      type: 'pii_warning',
      message: "[I've hidden that for your security — API keys go in Settings → API Keys, not in chat]",
    });
    return;
  }

  // Build context-aware system prompt with current state
  const stateContext = buildStateContext(onboardingState);
  const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n## Current setup state\n${stateContext}`;

  // Build messages
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: redacted },
  ];

  // Resolve model — use user's BYOK if available, else free pool
  let route;
  try {
    route = await resolveModel(userId, undefined, supabase);
  } catch {
    // No model available — use rule-based fallback
    yield* ruleBasedFallback(redacted, onboardingState);
    return;
  }

  yield JSON.stringify({ type: 'meta', model: route.model, provider: route.provider });

  try {
    if (route.provider === 'anthropic') {
      const client = new Anthropic({ apiKey: route.apiKey });
      const stream = await client.messages.create({
        model: route.model,
        max_tokens: 1024,
        system: fullSystemPrompt,
        messages,
        stream: true,
      });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield JSON.stringify({ type: 'delta', content: event.delta.text });
        }
      }
    } else {
      const client = new OpenAI({ apiKey: route.apiKey, baseURL: route.baseURL });
      const stream = await client.chat.completions.create({
        model: route.model,
        max_tokens: 1024,
        messages: [{ role: 'system', content: fullSystemPrompt }, ...messages],
        stream: true,
      });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) yield JSON.stringify({ type: 'delta', content: text });
      }
    }
    yield JSON.stringify({ type: 'done' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stream failed';
    yield JSON.stringify({ type: 'error', message: msg });
  }
}

function buildStateContext(state: OnboardingState): string {
  const parts: string[] = [];
  if (state.goal) parts.push(`Goal: ${state.goal}`);
  if (state.ai_provider_choice) parts.push(`AI provider chosen: ${state.ai_provider_choice}`);
  if (state.code_hosting_choice) parts.push(`Code hosting chosen: ${state.code_hosting_choice}`);
  if (state.deploy_choice) parts.push(`Deploy target chosen: ${state.deploy_choice}`);
  if (parts.length === 0) return 'No setup completed yet. This is the beginning of the session.';
  return parts.join('\n');
}

// Simple rule-based fallback when no AI model is available
async function* ruleBasedFallback(
  message: string,
  state: OnboardingState,
): AsyncGenerator<string, void, unknown> {
  const lower = message.toLowerCase();

  let response = '';
  const recommendations: string[] = [];

  if (!state.ai_provider_choice) {
    response = "Great — let's get you set up. I'll recommend the best tools for your project.\n\n";
    recommendations.push(JSON.stringify({
      type: 'recommendation',
      category: 'ai_provider',
      recommended: {
        id: 'anthropic',
        label: 'Anthropic Claude',
        reason: 'Best for code generation — precise, follows instructions well.',
        deeplink: '/dashboard/settings/keys?provider=anthropic',
      },
      alternatives: [
        { id: 'openai', label: 'OpenAI GPT-4o' },
        { id: 'google', label: 'Google Gemini (free tier available)' },
      ],
    }));
  } else if (!state.code_hosting_choice) {
    const wantGithub = !lower.includes('no github') && !lower.includes('skip');
    response = wantGithub
      ? "Perfect. For code hosting, GitHub is the standard choice.\n\n"
      : "No problem — you can keep everything in Goblin Cloud.\n\n";
    recommendations.push(JSON.stringify({
      type: 'recommendation',
      category: 'code_hosting',
      recommended: wantGithub
        ? { id: 'github', label: 'GitHub', reason: 'Free private repos, works with Vercel.', deeplink: '/api/github/connect' }
        : { id: 'goblin_cloud', label: 'Goblin Cloud only', reason: 'No setup needed, export anytime.', deeplink: null },
      alternatives: wantGithub
        ? [{ id: 'goblin_cloud', label: 'Goblin Cloud only' }]
        : [{ id: 'github', label: 'GitHub' }],
    }));
  } else if (!state.deploy_choice) {
    response = "Almost done. For deploying your app:\n\n";
    recommendations.push(JSON.stringify({
      type: 'recommendation',
      category: 'deploy_target',
      recommended: { id: 'vercel', label: 'Vercel', reason: 'Zero-config deploys, free tier, instant.', deeplink: '/dashboard/settings/integrations' },
      alternatives: [{ id: 'preview_only', label: 'Just preview in Goblin' }, { id: 'skip', label: 'Skip for now' }],
    }));
  } else {
    response = "You're all set! Time to build.\n\n";
    recommendations.push(JSON.stringify({
      type: 'setup_complete',
      summary: {
        ai_provider: state.ai_provider_choice,
        code_hosting: state.code_hosting_choice,
        deploy_target: state.deploy_choice,
      },
    }));
  }

  // Stream the response character by character (simulates streaming)
  for (const char of response) {
    yield JSON.stringify({ type: 'delta', content: char });
  }
  for (const rec of recommendations) {
    yield JSON.stringify({ type: 'structured', data: rec });
  }
  yield JSON.stringify({ type: 'done' });
}
