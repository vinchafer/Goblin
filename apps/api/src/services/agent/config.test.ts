// FEEL-3a — agent config: budget knobs, weighted units, and eligibility gate.

import { describe, it, expect, afterEach } from 'vitest';
import {
  agentMaxIterations,
  agentMaxUnits,
  runWeightedUnits,
  isAgentEligibleModel,
  isAgentLoopEnabled,
  agentEligibility,
} from './config';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe('agent config', () => {
  it('budget knobs default to 8 iterations / 200k units and honor env overrides', () => {
    delete process.env.AGENT_MAX_ITERATIONS;
    delete process.env.AGENT_MAX_UNITS;
    expect(agentMaxIterations()).toBe(8);
    expect(agentMaxUnits()).toBe(200_000);
    process.env.AGENT_MAX_ITERATIONS = '3';
    process.env.AGENT_MAX_UNITS = '50000';
    expect(agentMaxIterations()).toBe(3);
    expect(agentMaxUnits()).toBe(50_000);
    // garbage falls back to the default, never 0/NaN.
    process.env.AGENT_MAX_ITERATIONS = 'abc';
    expect(agentMaxIterations()).toBe(8);
  });

  it('weights Forge tokens 4.4× and Swift tokens 1× (reuses the locked FORGE_WEIGHT)', () => {
    expect(runWeightedUnits('goblin/efficient', 1000, 0)).toBe(1000);
    expect(runWeightedUnits('goblin/premium', 1000, 0)).toBe(4400);
    // negatives/NaN clamp to 0.
    expect(runWeightedUnits('goblin/efficient', -5, 0)).toBe(0);
  });

  it('only Swift + Forge are agent-eligible models', () => {
    expect(isAgentEligibleModel('goblin/efficient')).toBe(true);
    expect(isAgentEligibleModel('goblin/premium')).toBe(true);
    expect(isAgentEligibleModel('groq/llama')).toBe(false);
    expect(isAgentEligibleModel(null)).toBe(false);
  });

  it('flag default OFF; ON for the test account', () => {
    delete process.env.AGENT_LOOP;
    process.env.TEST_ACCOUNT_EMAIL = 'tester@example.com';
    expect(isAgentLoopEnabled('someone@else.com')).toBe(false);
    expect(isAgentLoopEnabled('tester@example.com')).toBe(true);
    expect(isAgentLoopEnabled('TESTER@EXAMPLE.COM')).toBe(true); // case-insensitive
    process.env.AGENT_LOOP = 'true';
    expect(isAgentLoopEnabled('someone@else.com')).toBe(true);
  });

  it('eligibility requires flag/test-account AND a project chat AND an eligible model', () => {
    process.env.AGENT_LOOP = 'true';
    expect(agentEligibility({ projectId: 'p1', modelSlug: 'goblin/efficient' })).toEqual({ eligible: true });
    // standalone chat (no project) is never eligible (D4).
    expect(agentEligibility({ projectId: null, modelSlug: 'goblin/efficient' }))
      .toMatchObject({ eligible: false, reason: 'standalone_chat' });
    // wrong model keeps today's behavior.
    expect(agentEligibility({ projectId: 'p1', modelSlug: 'groq/llama' }))
      .toMatchObject({ eligible: false, reason: 'model_not_eligible' });
    // flag off → blocked.
    delete process.env.AGENT_LOOP;
    delete process.env.TEST_ACCOUNT_EMAIL;
    expect(agentEligibility({ projectId: 'p1', modelSlug: 'goblin/efficient' }))
      .toMatchObject({ eligible: false, reason: 'flag_off' });
  });
});
