// WAVE-D · D-3 gate — the agent_runs sink. Injects a secret into the run's step log and
// report (both flow verbatim from tool errors / model text) and asserts the row written
// to agent_runs carries no raw secret material — only [REDACTED].

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture what finalizeAgentRun writes to agent_runs.
const captured: { update?: Record<string, unknown> } = {};
function makeFakeSb() {
  return {
    from(_t: string) {
      return {
        update(patch: Record<string, unknown>) {
          captured.update = patch;
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    },
  };
}
vi.mock('../../lib/supabase', () => ({ getSupabaseAdmin: () => makeFakeSb() }));

// eslint-disable-next-line import/first
import { finalizeAgentRun } from './run-store';

// FAKE specimens, built by concatenation so no contiguous secret-shaped literal exists
// in source (keeps secret-scanners from flagging the fixtures; runtime value is intact).
const SECRET = 'sk-' + 'ant-' + 'api03-' + 'LEAK0123456789LEAK0123456789LEAK01';
const JWT = 'eyJ' + 'hbGciOiJIUzI1NiJ9' + '.eyJyb2xlIjoic2VydmljZV9yb2xlIn0' + '.deadbeefdeadbeef';

beforeEach(() => { captured.update = undefined; });

describe('D-3 · finalizeAgentRun scrubs the persisted run log + report', () => {
  it('no raw secret reaches agent_runs.step_log or report', async () => {
    await finalizeAgentRun('run-1', {
      status: 'failed',
      outcome: 'error',
      iterations: 2,
      toolsUsed: ['write_file', 'publish'],
      steps: [
        { tool: 'publish', args: `token=${SECRET}`, outcome: `401: ${SECRET}`, ms: 12 },
      ],
      report: {
        outcome: 'error',
        state: 'failed',
        files: [],
        unitsConsumed: 0,
        modelText: `Der Provider meldete ${JWT}`,
        followUps: [],
        failureReason: `Upstream: ${SECRET}`,
      },
    });

    const flat = JSON.stringify(captured.update ?? {});
    expect(flat).not.toContain(SECRET);
    expect(flat).not.toContain(JWT);
    expect(flat).toContain('[REDACTED]');
    // The non-secret log structure is preserved.
    expect(flat).toContain('publish');
  });
});
