// WAVE-E E3 — dependency allowlist + exact-pin policy (D-E2), and the honest edge copy.

import { describe, it, expect } from 'vitest';
import {
  isAllowedPackage,
  isExactVersion,
  isAllowedDependency,
  validatePackageJson,
  dependencyRejectionMessage,
  ALLOWED_PACKAGES,
} from './deps-allowlist';
import { SUPPORTED_FRAMEWORKS, FRAMEWORK_TEMPLATES } from './framework-templates';

describe('allowlist (selection gate)', () => {
  it('accepts the vetted React/Vite baseline', () => {
    for (const p of ['react', 'react-dom', 'vite', '@vitejs/plugin-react', 'typescript']) {
      expect(isAllowedPackage(p)).toBe(true);
    }
  });
  it('rejects anything outside the curated set (typosquats, unknowns)', () => {
    for (const p of ['reactt', 'react-donm', 'left-pad', 'event-stream', 'malicious-pkg', '@evil/exfil']) {
      expect(isAllowedPackage(p)).toBe(false);
    }
  });
});

describe('exact-pin (mutation gate)', () => {
  it('accepts exact semver (incl. prerelease)', () => {
    for (const v of ['18.3.1', '5.4.11', '4.0.0-rc.1']) expect(isExactVersion(v)).toBe(true);
  });
  it('rejects ranges, tags, urls, git specs', () => {
    for (const v of ['^18.3.1', '~5.4.0', '18.x', '*', 'latest', '>=1', 'github:foo/bar', 'file:../x']) {
      expect(isExactVersion(v)).toBe(false);
    }
  });
});

describe('validatePackageJson', () => {
  it('passes a clean allowlisted, pinned manifest', () => {
    const content = JSON.stringify({
      dependencies: { react: '18.3.1', 'react-dom': '18.3.1' },
      devDependencies: { vite: '5.4.11', typescript: '5.6.3' },
    });
    expect(validatePackageJson(content).ok).toBe(true);
  });

  it('rejects a non-allowlisted (typosquat) dependency, names it', () => {
    const content = JSON.stringify({ dependencies: { react: '18.3.1', 'react-donm': '1.0.0' } });
    const v = validatePackageJson(content);
    expect(v.ok).toBe(false);
    expect(v.rejected).toEqual([{ name: 'react-donm', version: '1.0.0', reason: 'not_allowlisted' }]);
  });

  it('rejects an unpinned allowlisted dependency', () => {
    const content = JSON.stringify({ dependencies: { react: '^18.0.0' } });
    const v = validatePackageJson(content);
    expect(v.ok).toBe(false);
    expect(v.rejected[0]).toMatchObject({ name: 'react', reason: 'not_pinned' });
  });

  it('does NOT block on malformed JSON (build fails honestly downstream instead)', () => {
    const v = validatePackageJson('{ not json');
    expect(v.ok).toBe(true);
    expect(v.unparseable).toBe(true);
  });

  it('checks every dependency field incl. optional/peer', () => {
    const content = JSON.stringify({ optionalDependencies: { 'crypto-miner': '1.0.0' } });
    expect(validatePackageJson(content).ok).toBe(false);
  });
});

describe('dependencyRejectionMessage (E5 honest edge)', () => {
  it('is bilingual (DE + EN) and names the offending package', () => {
    const msg = dependencyRejectionMessage([{ name: 'evil-pkg', version: '1.0.0', reason: 'not_allowlisted' }]);
    expect(msg).toContain('evil-pkg');
    expect(msg).toContain('Freigabeliste');
    expect(msg).toContain('[EN]');
    expect(msg).toContain('allowlist');
  });
});

describe('template ↔ allowlist lockstep (no drift)', () => {
  it('every framework-template dependency is on the allowlist AND pinned', () => {
    for (const id of SUPPORTED_FRAMEWORKS) {
      const tpl = FRAMEWORK_TEMPLATES[id];
      for (const [name, version] of Object.entries({ ...tpl.dependencies, ...tpl.devDependencies })) {
        expect(isAllowedDependency(name, version)).toBe(true);
      }
    }
  });
  it('the allowlist is non-empty and curated (not full-npm)', () => {
    expect(ALLOWED_PACKAGES.size).toBeGreaterThan(5);
    expect(ALLOWED_PACKAGES.size).toBeLessThan(60); // bounded, reviewed set — not an open registry
  });
});
