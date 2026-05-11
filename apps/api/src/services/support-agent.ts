import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { type SupabaseClient } from '@supabase/supabase-js';
import { resolveModel } from './model-router';
import { getKnowledgeBase } from './support-knowledge';

const __dir = dirname(fileURLToPath(import.meta.url));

const BASE_SYSTEM_PROMPT = (() => {
  try {
    return readFileSync(join(__dir, '../prompts/support-agent-system.md'), 'utf-8');
  } catch {
    return 'You are the Goblin Support Agent. Help users with Goblin questions. Be clear, direct, and concise.';
  }
})();

// Prompt injection patterns to detect and log
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|your)\s+instructions/i,
  /forget\s+(your\s+)?(system\s+)?prompt/i,
  /you\s+are\s+now\s+/i,
  /act\s+as\s+(if\s+you\s+are\s+)?a\s+/i,
  /jailbreak/i,
  /DAN\s+mode/i,
];

function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some(re => re.test(text));
}

// PII patterns
const PII_PATTERNS = [
  /sk-[A-Za-z0-9\-_]{20,}/g,
  /sk-ant-[A-Za-z0-9\-_]{20,}/g,
  /AIza[A-Za-z0-9\-_]{30,}/g,
  /\b4[0-9]{12}(?:[0-9]{3})?\b/g,
  /\b5[1-5][0-9]{14}\b/g,
];

function hasPII(text: string): boolean {
  return PII_PATTERNS.some(re => { const m = re.test(text); re.lastIndex = 0; return m; });
}

interface UserContext {
  plan: string;
  monthlyUsed: number;
  monthlyLimit: number;
  providers: string[];
  projectCount: number;
  recentErrors: string[];
}

async function loadUserContext(userId: string, supabase: SupabaseClient): Promise<UserContext> {
  try {
    const [userRes, projectsRes, runsRes] = await Promise.all([
      supabase.from('users').select('plan, monthly_requests_used, monthly_limit').eq('id', userId).single(),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('agent_runs').select('model_used, status, error').eq('user_id', userId).eq('status', 'failed').order('created_at', { ascending: false }).limit(5),
    ]);

    const keysRes = await supabase.from('byok_keys').select('provider').eq('user_id', userId).eq('status', 'active');

    return {
      plan: (userRes.data?.plan as string) ?? 'free',
      monthlyUsed: (userRes.data?.monthly_requests_used as number) ?? 0,
      monthlyLimit: (userRes.data?.monthly_limit as number) ?? 0,
      providers: (keysRes.data ?? []).map(k => k.provider as string),
      projectCount: projectsRes.count ?? 0,
      recentErrors: (runsRes.data ?? []).map(r => r.error as string).filter(Boolean),
    };
  } catch {
    return { plan: 'unknown', monthlyUsed: 0, monthlyLimit: 0, providers: [], projectCount: 0, recentErrors: [] };
  }
}

export interface SupportMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface StreamSupportAgentParams {
  userId: string;
  userMessage: string;
  history: SupportMessage[];
  supabase: SupabaseClient;
  discordWebhookUrl?: string;
}

export async function* streamSupportAgent({
  userId,
  userMessage,
  history,
  supabase,
  discordWebhookUrl,
}: StreamSupportAgentParams): AsyncGenerator<string, void, unknown> {
  // PII check
  if (hasPII(userMessage)) {
    yield JSON.stringify({
      type: 'message',
      content: "[Please don't share that here — API keys belong in Settings → API Keys, other sensitive info should go to our support channel]",
    });
    yield JSON.stringify({ type: 'done' });
    return;
  }

  // Injection detection
  if (detectInjection(userMessage)) {
    // Log silently (fire-and-forget)
    supabase.from('support_tickets').insert({
      user_id: userId,
      message: userMessage.slice(0, 500),
      abuse_flag: true,
      created_at: new Date().toISOString(),
    }).then(() => {}).catch(() => {});

    yield JSON.stringify({ type: 'message', content: "I'm here to help with Goblin questions. What can I help you with?" });
    yield JSON.stringify({ type: 'done' });
    return;
  }

  // Load user context
  const ctx = await loadUserContext(userId, supabase);
  const knowledge = getKnowledgeBase();

  const systemPrompt = `${BASE_SYSTEM_PROMPT}

## User Context (read-only, use this to give personalized help)
- Plan: ${ctx.plan} (${ctx.monthlyUsed}/${ctx.monthlyLimit} requests used this cycle)
- Connected AI providers: ${ctx.providers.length > 0 ? ctx.providers.join(', ') : 'none'}
- Number of projects: ${ctx.projectCount}
- Recent errors: ${ctx.recentErrors.length > 0 ? ctx.recentErrors.slice(0, 3).join('; ') : 'none'}

## Knowledge Base
${knowledge}`;

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  // Check if escalation is needed based on keywords
  const escalationKeywords = ['refund', 'cancel subscription', 'delete account', 'billing dispute', 'charged twice'];
  const needsEscalation = escalationKeywords.some(kw => userMessage.toLowerCase().includes(kw));

  if (needsEscalation && discordWebhookUrl) {
    // Fire escalation webhook
    fetch(discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `**Support Escalation** — User ${userId}\nMessage: ${userMessage.slice(0, 200)}`,
      }),
    }).catch(() => {});
  }

  // Resolve model
  let route;
  try {
    route = await resolveModel(userId, undefined, supabase);
  } catch {
    // Fallback to simple text response
    yield JSON.stringify({ type: 'message', content: "I'm having trouble connecting right now. Please try again in a moment, or reach out on Discord for immediate help." });
    yield JSON.stringify({ type: 'done' });
    return;
  }

  yield JSON.stringify({ type: 'meta' });

  try {
    let fullResponse = '';

    if (route.provider === 'anthropic') {
      const client = new Anthropic({ apiKey: route.apiKey });
      const stream = await client.messages.create({
        model: route.model,
        max_tokens: 512,
        system: systemPrompt,
        messages,
        stream: true,
      });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullResponse += event.delta.text;
          yield JSON.stringify({ type: 'delta', content: event.delta.text });
        }
      }
    } else {
      const client = new OpenAI({ apiKey: route.apiKey, baseURL: route.baseURL });
      const stream = await client.chat.completions.create({
        model: route.model,
        max_tokens: 512,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
      });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) {
          fullResponse += text;
          yield JSON.stringify({ type: 'delta', content: text });
        }
      }
    }

    // Check if agent wants to escalate
    if (fullResponse.toLowerCase().includes("escalate") && discordWebhookUrl && !needsEscalation) {
      fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `**Support Escalation (agent-triggered)** — User ${userId}\nConversation: ${messages.slice(-2).map(m => `${m.role}: ${m.content}`).join('\n')}`,
        }),
      }).catch(() => {});
    }

    // Save ticket for tracking
    supabase.from('support_tickets').insert({
      user_id: userId,
      message: userMessage.slice(0, 1000),
      response: fullResponse.slice(0, 2000),
      created_at: new Date().toISOString(),
    }).then(() => {}).catch(() => {});

    yield JSON.stringify({ type: 'done' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    yield JSON.stringify({ type: 'error', message: `Something went wrong. ${msg}` });
  }
}
