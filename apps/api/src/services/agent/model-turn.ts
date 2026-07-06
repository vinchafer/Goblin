// FEEL-3a — the model turn: one request to the Goblin-hosted model with native
// function calling, over the same DeepInfra OpenAI-compatible endpoint the streaming
// client uses (reuses getGoblinHostedConfig for key/baseURL/model resolution — no
// parallel capability, just the non-streaming tool-calling shape the streaming
// client doesn't offer).
//
// The loop drives an `AgentModel`. When the response carries native tool_calls we
// normalize them; when it doesn't, the orchestrator falls back to the JSON protocol
// on the message text (protocol.ts). Injectable factory so unit tests substitute a
// deterministic model without the network.

import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import {
  getGoblinHostedConfig,
  mapProviderError,
  GOBLIN_MAX_TOKENS_PER_REQUEST,
  type GoblinTierId,
} from '../goblin-hosted';
import type { AgentModel, AgentMessage, ModelTurn, ToolSpec, ToolCall } from './types';

/** Convert the loop's messages into OpenAI chat message params. */
function toOpenAIMessages(messages: AgentMessage[]): ChatCompletionMessageParam[] {
  return messages.map((m): ChatCompletionMessageParam => {
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId ?? '', content: m.content };
    }
    if (m.role === 'assistant' && m.raw) {
      // Round-trip the raw assistant message so native tool_call ids line up with results.
      return m.raw as ChatCompletionMessageParam;
    }
    if (m.role === 'assistant') return { role: 'assistant', content: m.content };
    if (m.role === 'system') return { role: 'system', content: m.content };
    return { role: 'user', content: m.content };
  });
}

/** Convert ToolSpec[] into OpenAI function-tool definitions. */
function toOpenAITools(tools: ToolSpec[]): ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

/** Normalize native tool_calls off a response message. Malformed argument JSON → skipped
 *  (the orchestrator then treats the turn as having no usable call and repairs/aborts). */
function normalizeToolCalls(message: OpenAI.Chat.Completions.ChatCompletionMessage): ToolCall[] {
  const calls = message.tool_calls ?? [];
  const out: ToolCall[] = [];
  for (const c of calls) {
    if (c.type !== 'function') continue;
    let args: Record<string, unknown> = {};
    try {
      args = c.function.arguments ? (JSON.parse(c.function.arguments) as Record<string, unknown>) : {};
    } catch {
      // Leave args empty; a required-arg tool will report a structured error downstream.
      args = {};
    }
    out.push({ id: c.id, name: c.function.name, args });
  }
  return out;
}

/**
 * The real Goblin-hosted agent model (native tools). `tierId` selects Swift/Forge;
 * the provider slug is resolved through the same open-source-invariant config as the
 * streaming path. Throws a GoblinError (calm, code-tagged) on provider failure.
 */
export function nativeGoblinModel(tierId: GoblinTierId): AgentModel {
  return {
    supportsNativeTools: true,
    async turn({ messages, tools, signal }): Promise<ModelTurn> {
      const config = getGoblinHostedConfig();
      if (!config) throw new Error('Goblin-hosted model is not configured');
      const model = config.resolveModel(tierId);
      const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
      let resp: OpenAI.Chat.Completions.ChatCompletion;
      try {
        resp = await client.chat.completions.create(
          {
            model,
            messages: toOpenAIMessages(messages),
            tools: toOpenAITools(tools),
            tool_choice: 'auto',
            max_tokens: GOBLIN_MAX_TOKENS_PER_REQUEST,
          },
          { signal },
        );
      } catch (err) {
        throw mapProviderError(err);
      }
      const choice = resp.choices[0];
      const message = choice?.message;
      return {
        content: message?.content ?? '',
        toolCalls: message ? normalizeToolCalls(message) : [],
        usage: {
          inputTokens: resp.usage?.prompt_tokens ?? 0,
          outputTokens: resp.usage?.completion_tokens ?? 0,
        },
        assistantMessage: message,
      };
    },
  };
}

// Injectable factory so the orchestrator tests run a deterministic model offline.
let modelFactory: (tierId: GoblinTierId) => AgentModel = nativeGoblinModel;

export function getAgentModel(tierId: GoblinTierId): AgentModel {
  return modelFactory(tierId);
}

export function setAgentModelFactory(factory: (tierId: GoblinTierId) => AgentModel): void {
  modelFactory = factory;
}

export function resetAgentModelFactory(): void {
  modelFactory = nativeGoblinModel;
}
