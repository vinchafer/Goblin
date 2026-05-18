import { describe, it, expect } from 'vitest';
import { canonicalize, extractFamily } from './canonicalize';

describe('canonicalize', () => {
  it('normalizes Anthropic models', () => {
    expect(canonicalize('anthropic/claude-sonnet-4.6')).toBe('anthropic/claude-sonnet-4-6');
    expect(canonicalize('claude-sonnet-4-6-20260514')).toBe('anthropic/claude-sonnet-4-6');
    expect(canonicalize('Anthropic/Claude-Sonnet-4.6')).toBe('anthropic/claude-sonnet-4-6');
  });

  it('normalizes OpenAI models', () => {
    expect(canonicalize('openai/gpt-5.1')).toBe('openai/gpt-5-1');
    expect(canonicalize('gpt-4o-mini')).toBe('openai/gpt-4o-mini');
  });

  it('normalizes DeepSeek aliases', () => {
    expect(canonicalize('deepseek-ai/deepseek-coder-v3')).toBe('deepseek/deepseek-coder-v3');
    expect(canonicalize('deepseek/deepseek-r1')).toBe('deepseek/deepseek-r1');
  });

  it('infers provider from prefix when missing', () => {
    expect(canonicalize('llama-3.3-70b')).toBe('meta/llama-3-3-70b');
    expect(canonicalize('gemini-2.5-flash')).toBe('google/gemini-2-5-flash');
  });

  it('handles unknown providers gracefully', () => {
    expect(canonicalize('weird-model-xyz')).toBe('unknown/weird-model-xyz');
  });

  it('extracts family', () => {
    expect(extractFamily('anthropic/claude-sonnet-4-6')).toBe('claude');
    expect(extractFamily('openai/gpt-5-1')).toBe('gpt');
    expect(extractFamily('deepseek/deepseek-r1')).toBe('deepseek');
  });
});

describe('canonicalize — SWE-Bench style names', () => {
  it('handles space-separated Claude names', () => {
    expect(canonicalize('Claude 3.5 Sonnet')).toBe('anthropic/claude-3-5-sonnet');
    expect(canonicalize('Claude 3.7 Sonnet')).toBe('anthropic/claude-3-7-sonnet');
    expect(canonicalize('Claude Sonnet 4')).toBe('anthropic/claude-sonnet-4');
  });

  it('handles space-separated GPT names', () => {
    expect(canonicalize('GPT-4o')).toBe('openai/gpt-4o');
    expect(canonicalize('GPT-4')).toBe('openai/gpt-4');
  });

  it('handles space-separated Gemini names', () => {
    expect(canonicalize('Gemini 1.5 Pro')).toBe('google/gemini-1-5-pro');
  });

  it('handles space-separated DeepSeek names', () => {
    expect(canonicalize('DeepSeek V3')).toBe('deepseek/deepseek-v3');
    expect(canonicalize('DeepSeek R1')).toBe('deepseek/deepseek-r1');
  });

  it('handles Qwen variants', () => {
    expect(canonicalize('Qwen2.5-Coder')).toBe('alibaba/qwen2-5-coder');
  });

  it('handles Llama with size suffix', () => {
    expect(canonicalize('Llama 3.1 405B')).toBe('meta/llama-3-1-405b');
  });
});
