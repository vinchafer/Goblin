import { describe, it, expect } from 'vitest';
import { settle } from './settle';

describe('settle', () => {
  it('returns ok:true and the value when work resolves', async () => {
    const r = await settle(async () => ({ users: 5 }), { users: 0 });
    expect(r).toEqual({ ok: true, data: { users: 5 } });
  });

  it('returns ok:false and the fallback when work rejects (never throws)', async () => {
    const r = await settle<number>(async () => { throw new Error('db down'); }, -1);
    expect(r.ok).toBe(false);
    expect(r.data).toBe(-1);
  });

  it('swallows a synchronous throw inside work too', async () => {
    const r = await settle<string>(() => { throw new Error('boom'); }, 'fallback');
    expect(r.ok).toBe(false);
    expect(r.data).toBe('fallback');
  });

  it('a Promise.all of settled fetches never rejects (the SSR guarantee)', async () => {
    const results = await Promise.all([
      settle(async () => 1, 0),
      settle<number>(async () => { throw new Error('x'); }, 0),
      settle(async () => 3, 0),
    ]);
    expect(results.map((r) => r.ok)).toEqual([true, false, true]);
    expect(results.map((r) => r.data)).toEqual([1, 0, 3]);
  });
});
