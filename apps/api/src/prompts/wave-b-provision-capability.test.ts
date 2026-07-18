// WAVE-B B2 — the provisioning capability map is present ONLY when full-stack is enabled,
// never in the byte-stable static prefix, and teaches the RLS-always + client-wiring pattern.

import { describe, it, expect } from 'vitest';
import { buildAgentSystemPrompt, AGENT_STATIC_PREFIX } from './goblin-chat-system';
import { agentToolsFor, PROVISION_BACKEND_TOOL } from '../services/agent/tools';

describe('B2 — provision_backend capability block', () => {
  it('is ABSENT by default (existing runs unchanged) and NOT in the static prefix', () => {
    expect(AGENT_STATIC_PREFIX).not.toContain('provision_backend');
    const off = buildAgentSystemPrompt({ projectName: 'X' });
    expect(off).not.toContain('provision_backend');
    expect(off).not.toContain('Row-Level-Security');
  });

  it('is PRESENT when provisionAvailable and teaches RLS-always + client wiring', () => {
    const on = buildAgentSystemPrompt({ projectName: 'X', provisionAvailable: true });
    expect(on).toContain('provision_backend');
    expect(on).toContain('Row-Level-Security');
    // The honest capability boundaries + the schema→RLS→client few-shot.
    expect(on).toContain('no_supabase_connection');
    expect(on).toContain('anonKey');
    expect(on).toContain('service_role'); // told it will NEVER receive it
    expect(on).toContain('Aufgabenliste mit Login'); // the verbatim proof few-shot
    expect(on).toContain('@supabase/supabase-js');
  });

  it('appends the block AFTER the static prefix (prefix stays byte-stable)', () => {
    const on = buildAgentSystemPrompt({ projectName: 'X', provisionAvailable: true });
    expect(on.startsWith(AGENT_STATIC_PREFIX)).toBe(true);
    expect(on.indexOf('provision_backend')).toBeGreaterThan(AGENT_STATIC_PREFIX.length);
  });
});

describe('B2 — provision_backend tool gating', () => {
  it('is advertised ONLY when provision is granted for the run', () => {
    const without = agentToolsFor({ search: false });
    expect(without.find((t) => t.name === 'provision_backend')).toBeUndefined();
    const with_ = agentToolsFor({ search: false, provision: true });
    expect(with_.find((t) => t.name === 'provision_backend')).toBe(PROVISION_BACKEND_TOOL);
  });

  it('the tool schema forbids raw SQL (structured tables only)', () => {
    const props = PROVISION_BACKEND_TOOL.parameters.properties as Record<string, unknown>;
    expect(props.tables).toBeDefined();
    expect(props.sql).toBeUndefined();
    expect(props.query).toBeUndefined();
  });
});
