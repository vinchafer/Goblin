// F-08 (FIX-WAVE 3) GATE — System-theme follow is deterministic.
//   • System selected → the OS light/dark decides (and propagates live).
//   • An explicit Light/Dark choice → NEVER follows the OS.

import { describe, it, expect } from 'vitest';
import { resolveTheme } from './theme-resolve';

describe('resolveTheme — F-08 system follow', () => {
  it('system follows the OS: dark OS → dark', () => {
    expect(resolveTheme('system', true)).toBe('dark');
  });

  it('system follows the OS: light OS → light', () => {
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('explicit light IGNORES a dark OS', () => {
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('explicit dark IGNORES a light OS', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('explicit choice is stable across an OS flip (does not follow)', () => {
    // The same explicit choice resolves identically whether the OS is dark or light.
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
  });
});
