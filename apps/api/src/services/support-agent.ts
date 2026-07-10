import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { type SupabaseClient } from '@supabase/supabase-js';
import { renderHelpForAgent } from '@goblin/shared/src/help-content';
import { resolveModel, streamCompletionGuarded } from './model-router';
import { sendSupportEscalation } from './support-email';
import { trackEvent } from '../lib/platform-events';

const __dir = dirname(fileURLToPath(import.meta.url));

// WAVE-J (J2): "Goblin Hilfe" support agent.
//
// BILLING (HARD RULE): support tokens are PLATFORM COGS, never user allowance.
// The completion is pinned to `goblin/efficient` (Swift) and run with
// `internalBilling: true`, so model-router (a) skips the user's allowance gate and
// (b) suppresses the completion_costs write, logging tokens as platform_cogs
// instead. We PRE-RESOLVE the route and refuse to run on anything but the
// goblin-hosted tier — the support agent must never silently spend a user's BYOK
// key. See docs/GOBLIN_CONSUMPTION_LEDGER.md M12.
//
// GROUNDING: the system prompt = support persona (prompts/support-agent-system.md)
// + the user's own safe context + the FULL help corpus (renderHelpForAgent, the
// single source of truth in @goblin/shared). No message archives, no other users'
// data, no secrets.

const SUPPORT_MODEL = 'goblin/efficient';
// Per-message OUTPUT budget — support replies are short (persona: ≤3–4 sentences).
// Bounds COGS per turn; the input side is bounded by the route schema + history cap.
const SUPPORT_MAX_TOKENS = Number(process.env.SUPPORT_MAX_TOKENS ?? 600);
// Per-user daily message cap (abuse guard). In-memory per instance — resets on
// deploy, not shared across replicas — exactly the M8 dictation / M11 search
// pattern. Promote to a persisted counter if support volume grows.
const SUPPORT_DAILY_CAP = Number(process.env.SUPPORT_DAILY_CAP ?? 30);

const BASE_SYSTEM_PROMPT = (() => {
  try {
    return readFileSync(join(__dir, '../prompts/support-agent-system.md'), 'utf-8');
  } catch {
    return 'Du bist Goblin Hilfe, der Support-Agent von Goblin. Hilf klar, direkt und ehrlich — erfinde nie eine Funktion.';
  }
})();

// The agent signals a genuine escalation with `[[ESCALATE:<reason>]]` at the end
// of its reply (see the system prompt). We strip it from what the user sees and
// fire the structured handoff. Reasons are constrained to the known set.
const ESCALATE_RE = /\[\[ESCALATE:(human_requested|stuck|out_of_scope)\]\]/i;
type EscalationReason = 'human_requested' | 'stuck' | 'out_of_scope';

// A user asking for a human in plain words is escalated IMMEDIATELY and
// deterministically — no model round-trip needed (saves COGS, guarantees the
// behaviour). Kept deliberately tight so it doesn't fire on unrelated mentions.
const EXPLICIT_HUMAN_RE =
  /\b(mit\s+(?:einem\s+)?menschen|einen\s+menschen|echten\s+menschen|mitarbeiter|support[- ]team\s+(?:sprechen|reden)|talk\s+to\s+(?:a\s+)?(?:human|person|someone)|speak\s+to\s+(?:a\s+)?(?:human|person|someone)|real\s+(?:human|person))\b/i;

// ── prompt-injection + PII guards (unchanged intent, kept) ───────────────────
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|your)\s+instructions/i,
  /forget\s+(your\s+)?(system\s+)?prompt/i,
  /you\s+are\s+now\s+/i,
  /act\s+as\s+(if\s+you\s+are\s+)?a\s+/i,
  /jailbreak/i,
  /DAN\s+mode/i,
];
function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

const PII_PATTERNS = [
  /sk-[A-Za-z0-9\-_]{20,}/g,
  /sk-ant-[A-Za-z0-9\-_]{20,}/g,
  /AIza[A-Za-z0-9\-_]{30,}/g,
  /\b4[0-9]{12}(?:[0-9]{3})?\b/g,
  /\b5[1-5][0-9]{14}\b/g,
];
function hasPII(text: string): boolean {
  return PII_PATTERNS.some((re) => { const m = re.test(text); re.lastIndex = 0; return m; });
}
function stripPII(text: string): string {
  let out = text;
  for (const re of PII_PATTERNS) { out = out.replace(re, '[REDACTED]'); re.lastIndex = 0; }
  return out;
}

function detectGerman(text: string): boolean {
  const germanWords = /\b(ich|du|wir|ihr|bitte|kannst|hilf|danke|hallo|wie|was|warum|nicht|aber|auch|noch|schon|mal|dann|jetzt|hier|sein|haben|werden|können|müssen|sollen)\b/i;
  const germanChars = /[äöüÄÖÜß]/;
  return germanChars.test(text) || (germanWords.test(text) && text.split(' ').length > 2);
}

// ── daily cap (in-memory) ────────────────────────────────────────────────────
const supportCounter = new Map<string, number>();
function todayKey(userId: string): string {
  return `${userId}:${new Date().toISOString().slice(0, 10)}`;
}
/** Consume one support message from the user's daily quota. */
export function consumeSupportQuota(userId: string): { allowed: boolean; remaining: number } {
  const key = todayKey(userId);
  // Cheap prune: drop keys from previous days when the map grows.
  if (supportCounter.size > 5000) {
    const today = new Date().toISOString().slice(0, 10);
    for (const k of supportCounter.keys()) if (!k.endsWith(today)) supportCounter.delete(k);
  }
  const used = supportCounter.get(key) ?? 0;
  if (used >= SUPPORT_DAILY_CAP) return { allowed: false, remaining: 0 };
  supportCounter.set(key, used + 1);
  return { allowed: true, remaining: SUPPORT_DAILY_CAP - used - 1 };
}
/** Test seam. */
export function __resetSupportQuota(): void { supportCounter.clear(); }

// ── user context (content-free-ish; names/counts only, never file/chat bodies) ─
interface UserContext {
  plan: string;
  buildsThisMonth: number;
  providers: string[];
  projectCount: number;
  vercelConnected: boolean;
  recentErrors: string[];
}

async function loadUserContext(userId: string, supabase: SupabaseClient): Promise<UserContext> {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [userRes, projectsRes, runsRes, buildsRes, vercelRes, keysRes] = await Promise.all([
      supabase.from('users').select('plan').eq('id', userId).single(),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('agent_runs').select('error').eq('user_id', userId).eq('status', 'failed').order('created_at', { ascending: false }).limit(3),
      supabase.from('agent_runs').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'success').gte('created_at', startOfMonth),
      supabase.from('vercel_tokens').select('user_id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('byok_keys').select('provider').eq('user_id', userId).eq('status', 'active'),
    ]);

    return {
      plan: (userRes.data?.plan as string) ?? 'unknown',
      buildsThisMonth: buildsRes.count ?? 0,
      providers: (keysRes.data ?? []).map((k) => k.provider as string),
      projectCount: projectsRes.count ?? 0,
      vercelConnected: (vercelRes.count ?? 0) > 0,
      // The last error MESSAGE is operational context (not chat/file content) and
      // helps the agent point at the right article. Truncated + PII-stripped.
      recentErrors: (runsRes.data ?? []).map((r) => stripPII(String(r.error ?? '')).slice(0, 160)).filter(Boolean),
    };
  } catch {
    return { plan: 'unknown', buildsThisMonth: 0, providers: [], projectCount: 0, vercelConnected: false, recentErrors: [] };
  }
}

export interface SupportMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface StreamSupportAgentParams {
  userId: string;
  userEmail: string;
  userMessage: string;
  history: SupportMessage[];
  supabase: SupabaseClient;
}

function honest(lang: 'de' | 'en', de: string, en: string): string {
  return lang === 'de' ? de : en;
}

const ESCALATION_CLOSING = {
  de: 'Ich habe alles an einen Menschen übergeben — du hörst per E-Mail von uns.',
  en: "I've handed everything to a human — you'll hear from us by email.",
};

export async function* streamSupportAgent({
  userId,
  userEmail,
  userMessage,
  history,
  supabase,
}: StreamSupportAgentParams): AsyncGenerator<string, void, unknown> {
  const lang: 'de' | 'en' =
    detectGerman(userMessage) || history.some((m) => m.role === 'user' && detectGerman(m.content)) ? 'de' : 'en';

  // support_chat_started — first turn of a session. Metadata only.
  if (history.length === 0) {
    trackEvent({ eventType: 'support_chat_started', userId, meta: { lang } });
  }

  // 1) PII guard — never echo a shared secret back.
  if (hasPII(userMessage)) {
    yield JSON.stringify({
      type: 'message',
      content: honest(lang,
        'Bitte teile das hier nicht — API-Schlüssel gehören in Einstellungen → API-Keys. Womit kann ich sonst helfen?',
        "Please don't share that here — API keys belong in Settings → API Keys. What else can I help with?"),
    });
    yield JSON.stringify({ type: 'done' });
    return;
  }

  // 2) Injection guard — deflect + log an abuse ticket (fire-and-forget).
  if (detectInjection(userMessage)) {
    void supabase.from('support_tickets').insert({
      user_id: userId, kind: 'abuse', abuse_flag: true,
      reason: stripPII(userMessage).slice(0, 200),
    }).then(() => {}, () => {});
    yield JSON.stringify({
      type: 'message',
      content: honest(lang,
        'Ich bin hier für Goblin-Fragen da. Womit kann ich helfen?',
        "I'm here to help with Goblin questions. What can I help you with?"),
    });
    yield JSON.stringify({ type: 'done' });
    return;
  }

  const ctx = await loadUserContext(userId, supabase);

  // 3) Explicit human request → escalate immediately, no model call.
  if (EXPLICIT_HUMAN_RE.test(userMessage)) {
    const closing = honest(lang,
      `Klar — ich gebe dich an einen Menschen weiter. ${ESCALATION_CLOSING.de}`,
      `Of course — I'll pass you to a human. ${ESCALATION_CLOSING.en}`);
    await escalate({ reason: 'human_requested', userId, userEmail, ctx, history, userMessage, assistantText: closing, supabase });
    yield JSON.stringify({ type: 'message', content: closing });
    yield JSON.stringify({ type: 'done' });
    return;
  }

  // 4) Pre-resolve the route: the support agent runs ONLY on the platform Swift
  // tier (true platform COGS). If goblin-hosted isn't available, degrade honestly
  // rather than spending the user's BYOK key on a support chat.
  let route;
  try {
    route = await resolveModel(userId, SUPPORT_MODEL, supabase);
  } catch {
    route = null;
  }
  if (!route || route.layer !== 'goblin_hosted') {
    yield JSON.stringify({
      type: 'message',
      content: honest(lang,
        'Der Hilfe-Agent ist gerade nicht verfügbar. Schau solange in die Hilfe-Artikel oder schreib uns an support@justgoblin.com.',
        'The help agent is unavailable right now. Meanwhile see the help articles, or email us at support@justgoblin.com.'),
    });
    yield JSON.stringify({ type: 'done' });
    return;
  }

  const systemPrompt = `${BASE_SYSTEM_PROMPT}

## Nutzerkontext (read-only — nutze ihn für konkrete Hilfe, gib ihn nicht wörtlich aus)
- Plan: ${ctx.plan} (${ctx.buildsThisMonth} Builds diesen Monat)
- Vercel verbunden: ${ctx.vercelConnected ? 'ja' : 'nein'}
- Eigene Modell-Keys (BYOK): ${ctx.providers.length ? ctx.providers.join(', ') : 'keine'}
- Anzahl Projekte: ${ctx.projectCount}
- Letzte Fehlermeldung(en): ${ctx.recentErrors.length ? ctx.recentErrors.join(' | ') : 'keine'}

## Hilfe-Inhalte (deine einzige Faktenquelle — zitiere die Artikel)
${renderHelpForAgent(lang)}`;

  yield JSON.stringify({ type: 'meta' });

  // 5) Buffer the reply (short by design), so the [[ESCALATE]] marker can be
  // stripped cleanly before anything is shown — no marker ever leaks to the user.
  let full = '';
  try {
    for await (const jsonToken of streamCompletionGuarded({
      userId,
      message: userMessage,
      chatHistory: history.map((m) => ({ role: m.role, content: m.content })),
      systemPrompt,
      modelPreference: SUPPORT_MODEL,
      internalBilling: true, // PLATFORM COGS — never user allowance
      maxTokens: SUPPORT_MAX_TOKENS,
      supabase,
    })) {
      const parsed = JSON.parse(jsonToken) as { type?: string; content?: string; message?: string };
      if (parsed.type === 'delta') full += parsed.content ?? '';
      else if (parsed.type === 'error') {
        yield JSON.stringify({
          type: 'message',
          content: honest(lang,
            'Da ist gerade etwas schiefgelaufen. Versuch es gleich nochmal, oder schreib uns an support@justgoblin.com.',
            'Something went wrong just now. Try again shortly, or email support@justgoblin.com.'),
        });
        yield JSON.stringify({ type: 'done' });
        return;
      }
    }
  } catch {
    yield JSON.stringify({
      type: 'message',
      content: honest(lang,
        'Da ist gerade etwas schiefgelaufen. Versuch es gleich nochmal, oder schreib uns an support@justgoblin.com.',
        'Something went wrong just now. Try again shortly, or email support@justgoblin.com.'),
    });
    yield JSON.stringify({ type: 'done' });
    return;
  }

  const match = full.match(ESCALATE_RE);
  const visible = full.replace(ESCALATE_RE, '').trim() || ESCALATION_CLOSING[lang];

  if (match) {
    const reason = match[1]!.toLowerCase() as EscalationReason;
    await escalate({ reason, userId, userEmail, ctx, history, userMessage, assistantText: visible, supabase });
  }

  yield JSON.stringify({ type: 'message', content: visible, escalated: !!match });
  yield JSON.stringify({ type: 'done' });
}

// ── structured handoff ────────────────────────────────────────────────────────
interface EscalateParams {
  reason: EscalationReason;
  userId: string;
  userEmail: string;
  ctx: UserContext;
  history: SupportMessage[];
  userMessage: string;
  assistantText: string;
  supabase: SupabaseClient;
}

async function escalate(p: EscalateParams): Promise<void> {
  const ticketId = crypto.randomUUID();
  const fullHistory = [...p.history, { role: 'user' as const, content: p.userMessage }, { role: 'assistant' as const, content: p.assistantText }];
  // Bounded, PII-stripped transcript for the founder handoff (the one legitimate
  // content-bearing surface — and it is purged on account deletion).
  const transcript = fullHistory.slice(-20).map((m) => ({ role: m.role, content: stripPII(m.content).slice(0, 2000) }));
  const contextSnapshot = {
    plan: p.ctx.plan,
    builds_this_month: p.ctx.buildsThisMonth,
    project_count: p.ctx.projectCount,
    vercel_connected: p.ctx.vercelConnected,
    providers: p.ctx.providers,
  };

  // support_chat_escalated — metadata only (reason), NEVER transcript content.
  trackEvent({ eventType: 'support_chat_escalated', userId: p.userId, meta: { reason: p.reason } });

  // Email the founder (best-effort, never throws) — transcript + context + reply-to.
  let emailOk = false;
  let emailErr: string | null = null;
  try {
    const res = await sendSupportEscalation({
      ticketId,
      userId: p.userId,
      userEmail: p.userEmail,
      plan: p.ctx.plan,
      history: fullHistory,
      escalationReason: `${p.reason}: ${stripPII(p.userMessage).slice(0, 160)}`,
      timestamp: new Date().toISOString(),
    });
    emailOk = res.ok;
    emailErr = res.error ?? null;
  } catch (e) {
    emailErr = e instanceof Error ? e.message : 'unknown';
  }

  // Persist the ticket (fire-and-forget silent-fail; pre-migration tolerant).
  void p.supabase.from('support_tickets').insert({
    id: ticketId,
    user_id: p.userId,
    kind: 'escalation',
    category: p.reason,
    reason: stripPII(p.userMessage).slice(0, 200),
    transcript,
    context_snapshot: contextSnapshot,
    email_sent: emailOk,
    email_error: emailErr,
  }).then(() => {}, () => {});
}
