// @vitest-environment jsdom
/**
 * FOUNDER-WALK-6 · U5 (F1) — `pendingCodePayload` is a single, global context
 * value with no project scope of its own, set by a "send to code" event
 * dispatched only from the chat panel of whichever project is currently open.
 * Left uncleared across a project switch, a payload authored for project A
 * could still be sitting there when `CodeWorkspace` mounts for project B and
 * treat it as B's own incoming payload — the same class of cross-project leak
 * as the session-picker bug, through a different piece of state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { CodeTab } from './code-tab';

// CodeTab's own (unrelated) availability probe resolves `getToken()` a tick
// after mount; flushing it keeps the assertions below free of React's "not
// wrapped in act" noise without touching what is actually under test here.
async function flush() {
  await act(async () => { await Promise.resolve(); });
}

const setPendingCodePayload = vi.fn();
vi.mock('@/contexts/app-context', () => ({
  useApp: () => ({ setPendingCodePayload }),
}));
vi.mock('@/hooks/code/useEditorTheme', () => ({ useEditorTheme: () => ['dark', vi.fn(), vi.fn()] }));
vi.mock('@/components/code/CodeWorkspace', () => ({ CodeWorkspace: () => null }));
vi.mock('./code-tab-classic', () => ({ CodeTabClassic: () => null }));
vi.mock('@/hooks/code/getToken', () => ({ getToken: vi.fn(async () => null), API_URL: 'https://api.test' }));

describe('CodeTab clears the pending-code payload on a project switch (U5/F1)', () => {
  beforeEach(() => setPendingCodePayload.mockClear());

  it('does NOT clear on first mount — there is nothing stale yet', async () => {
    render(<CodeTab projectId="p1" />);
    await flush();
    expect(setPendingCodePayload).not.toHaveBeenCalled();
  });

  it('clears the moment projectId actually changes to a different project', async () => {
    const { rerender } = render(<CodeTab projectId="p1" />);
    await flush();
    rerender(<CodeTab projectId="p2" />);
    await flush();
    expect(setPendingCodePayload).toHaveBeenCalledWith(null);
  });

  it('does not clear again on a re-render with the SAME projectId', async () => {
    const { rerender } = render(<CodeTab projectId="p1" />);
    await flush();
    rerender(<CodeTab projectId="p1" />);
    await flush();
    expect(setPendingCodePayload).not.toHaveBeenCalled();
  });

  it('clears exactly once per switch, not on every subsequent render', async () => {
    const { rerender } = render(<CodeTab projectId="p1" />);
    await flush();
    rerender(<CodeTab projectId="p2" />);
    await flush();
    rerender(<CodeTab projectId="p2" />);
    await flush();
    rerender(<CodeTab projectId="p2" />);
    await flush();
    expect(setPendingCodePayload).toHaveBeenCalledTimes(1);
  });
});
