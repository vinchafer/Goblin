import { describe, it, expect } from 'vitest';
import { usageModelLabel } from './model-label';

// Two-level-truth scrub for the usage / activity model breakdown. Guards the
// founder-walk leak: the usage "Pro Modell" view must show "Goblin Swift" /
// "Goblin Forge" and clean human labels — never `goblin/efficient`, never an
// underlying provider slug, never a raw `…/llama-3.3-70b-versatile`.
describe('usageModelLabel', () => {
  it('maps Goblin tier ids to public names, never the tier id', () => {
    expect(usageModelLabel('goblin/efficient', 'goblin_hosted')).toBe('Goblin Swift');
    expect(usageModelLabel('goblin/premium', 'goblin_hosted')).toBe('Goblin Forge');
    // …even if source_tier is missing (model id alone is decisive).
    expect(usageModelLabel('goblin/efficient')).toBe('Goblin Swift');
  });

  it('never surfaces an underlying provider slug for a goblin_hosted run', () => {
    const label = usageModelLabel('deepseek-ai/DeepSeek-V3.2', 'goblin_hosted');
    expect(label).toBe('Goblin');
    const blob = label.toLowerCase();
    expect(blob).not.toContain('deepseek');
    expect(blob).not.toContain('kimi');
    expect(blob).not.toContain('moonshot');
  });

  it('humanizes BYOK slugs — no raw slug, no provider prefix', () => {
    const label = usageModelLabel('groq/llama-3.3-70b-versatile', 'byok');
    expect(label).not.toContain('/');
    expect(label.toLowerCase()).not.toContain('versatile');
    expect(label).toContain('Llama');
  });

  it('strips the trailing date from Anthropic slugs', () => {
    const label = usageModelLabel('anthropic/claude-3-5-sonnet-20240620', 'byok');
    expect(label).not.toMatch(/\d{8}/);
    expect(label.toLowerCase()).toContain('sonnet');
  });

  it('handles empty / null', () => {
    expect(usageModelLabel('', 'byok')).toBeTruthy();
    expect(usageModelLabel(null, 'goblin_hosted')).toBe('Goblin');
    expect(usageModelLabel(undefined)).toBeTruthy();
  });
});
