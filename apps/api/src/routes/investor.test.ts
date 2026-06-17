/**
 * Investor-gated model-mapping endpoint (HR-2/HR-4).
 *
 * Proves the gate: no token / wrong token / unset secret → 401 (never the names);
 * correct token → the real Swift/Forge mapping; the wholesale provider + key are
 * never in the body. Exercises the Hono app directly (no network).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { investor } from './investor';
import { DEFAULT_MODEL_EFFICIENT, DEFAULT_MODEL_PREMIUM } from '../services/goblin-hosted';

const ORIG = { ...process.env };
afterEach(() => { process.env = { ...ORIG }; });

function call(headers: Record<string, string> = {}) {
  return investor.request('/models', { method: 'GET', headers });
}

describe('GET /api/investor/models — auth gate', () => {
  it('401 when no token is sent (even if the secret is set)', async () => {
    process.env.INVESTOR_MODELS_TOKEN = 'the-secret';
    const res = await call();
    expect(res.status).toBe(401);
    const body = JSON.stringify(await res.json()).toLowerCase();
    expect(body).not.toContain('deepseek');
    expect(body).not.toContain('kimi');
  });

  it('401 on a wrong token', async () => {
    process.env.INVESTOR_MODELS_TOKEN = 'the-secret';
    const res = await call({ 'x-investor-token': 'nope' });
    expect(res.status).toBe(401);
  });

  it('401 (fail closed) when the secret env var is unset', async () => {
    delete process.env.INVESTOR_MODELS_TOKEN;
    const res = await call({ 'x-investor-token': 'anything' });
    expect(res.status).toBe(401);
  });

  it('200 with the correct token → real Swift/Forge mapping, no provider/key leak', async () => {
    process.env.INVESTOR_MODELS_TOKEN = 'the-secret';
    process.env.DEEPINFRA_API_KEY = 'secret-key-should-never-appear';
    const res = await call({ 'x-investor-token': 'the-secret' });
    expect(res.status).toBe(200);
    const data = await res.json() as {
      swift: { label: string; slug: string; model: string };
      forge: { label: string; slug: string; model: string };
    };
    expect(data.swift.label).toBe('Goblin Swift');
    expect(data.swift.slug).toBe(DEFAULT_MODEL_EFFICIENT);
    expect(data.forge.label).toBe('Goblin Forge');
    expect(data.forge.slug).toBe(DEFAULT_MODEL_PREMIUM);

    const blob = JSON.stringify(data).toLowerCase();
    expect(blob).not.toContain('deepinfra');
    expect(blob).not.toContain('secret-key-should-never-appear');
  });
});
