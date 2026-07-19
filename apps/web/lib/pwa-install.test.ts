// INSTALL-U4 gate: platform detection + the honest-affordance decisions that
// drive the install hint. Pure logic (matches the web app's node vitest env).
import { describe, it, expect } from 'vitest';
import {
  platformFromUA,
  detectInstallPlatform,
  isStandaloneDisplay,
  shouldShowInstallHint,
  showNativeInstallButton,
  browserFamilyFromUA,
  isMacOsUA,
  resolveLandingInstallMode,
  detectLandingInstallMode,
} from './pwa-install';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 Edg/124.0.0.0',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  firefoxMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',
};

// Minimal Window stub for detectInstallPlatform/isStandaloneDisplay.
function fakeWin(opts: { ua: string; standalone?: boolean; displayMode?: boolean; touch?: number }): Window {
  return {
    navigator: { userAgent: opts.ua, standalone: opts.standalone, maxTouchPoints: opts.touch ?? 0 },
    matchMedia: (q: string) => ({ matches: q.includes('standalone') ? !!opts.displayMode : false }),
  } as unknown as Window;
}

describe('platformFromUA', () => {
  it('classifies iPhone/iPad as ios', () => {
    expect(platformFromUA(UA.iphone)).toBe('ios');
    expect(platformFromUA(UA.ipad)).toBe('ios');
  });
  it('classifies Android and desktop', () => {
    expect(platformFromUA(UA.android)).toBe('android');
    expect(platformFromUA(UA.desktop)).toBe('desktop');
  });
});

describe('isStandaloneDisplay', () => {
  it('true via display-mode query', () => {
    expect(isStandaloneDisplay(fakeWin({ ua: UA.android, displayMode: true }))).toBe(true);
  });
  it('true via iOS navigator.standalone', () => {
    expect(isStandaloneDisplay(fakeWin({ ua: UA.iphone, standalone: true }))).toBe(true);
  });
  it('false in a normal browser tab', () => {
    expect(isStandaloneDisplay(fakeWin({ ua: UA.iphone }))).toBe(false);
  });
});

describe('detectInstallPlatform', () => {
  it('returns installed when standalone (hint must never show)', () => {
    expect(detectInstallPlatform(fakeWin({ ua: UA.iphone, standalone: true }))).toBe('installed');
    expect(detectInstallPlatform(fakeWin({ ua: UA.android, displayMode: true }))).toBe('installed');
  });
  it('detects ios / android / desktop in a normal tab', () => {
    expect(detectInstallPlatform(fakeWin({ ua: UA.iphone }))).toBe('ios');
    expect(detectInstallPlatform(fakeWin({ ua: UA.android }))).toBe('android');
    expect(detectInstallPlatform(fakeWin({ ua: UA.desktop }))).toBe('desktop');
  });
  it('treats touch-capable iPadOS-in-desktop-mode as ios', () => {
    expect(detectInstallPlatform(fakeWin({ ua: UA.ipadDesktopMode, touch: 5 }))).toBe('ios');
    // A real Mac (no touch) stays desktop.
    expect(detectInstallPlatform(fakeWin({ ua: UA.ipadDesktopMode, touch: 0 }))).toBe('desktop');
  });
});

describe('shouldShowInstallHint — renders + dismisses', () => {
  it('shows on ios/android when not dismissed', () => {
    expect(shouldShowInstallHint('ios', false)).toBe(true);
    expect(shouldShowInstallHint('android', false)).toBe(true);
  });
  it('hides when dismissed', () => {
    expect(shouldShowInstallHint('ios', true)).toBe(false);
    expect(shouldShowInstallHint('android', true)).toBe(false);
  });
  it('hides on desktop and when already installed', () => {
    expect(shouldShowInstallHint('desktop', false)).toBe(false);
    expect(shouldShowInstallHint('installed', false)).toBe(false);
  });
});

describe('showNativeInstallButton — NO phantom install button on iOS', () => {
  it('iOS never gets a button, even with a stray deferred prompt', () => {
    expect(showNativeInstallButton('ios', true)).toBe(false);
    expect(showNativeInstallButton('ios', false)).toBe(false);
  });
  it('Android shows a button only when the browser fired the prompt', () => {
    expect(showNativeInstallButton('android', true)).toBe(true);
    expect(showNativeInstallButton('android', false)).toBe(false);
  });
});

// ── LAUNCH-ASSIST U1: landing-block detection ───────────────────────────────────

describe('browserFamilyFromUA', () => {
  it('classifies Chromium desktop (Chrome UA also contains "Safari")', () => {
    expect(browserFamilyFromUA(UA.desktop)).toBe('chromium');
    expect(browserFamilyFromUA(UA.macChrome)).toBe('chromium');
    expect(browserFamilyFromUA(UA.android)).toBe('chromium');
  });
  it('classifies Edge/Opera as chromium (Edge UA contains "Chrome")', () => {
    expect(browserFamilyFromUA(UA.edge)).toBe('chromium');
  });
  it('classifies real Safari (no Chrome token) as safari', () => {
    expect(browserFamilyFromUA(UA.macSafari)).toBe('safari');
    expect(browserFamilyFromUA(UA.iphone)).toBe('safari');
  });
  it('classifies Firefox as firefox', () => {
    expect(browserFamilyFromUA(UA.firefox)).toBe('firefox');
    expect(browserFamilyFromUA(UA.firefoxMac)).toBe('firefox');
  });
});

describe('isMacOsUA', () => {
  it('true for Mac desktop UAs, false for Windows/Android', () => {
    expect(isMacOsUA(UA.macSafari)).toBe(true);
    expect(isMacOsUA(UA.macChrome)).toBe(true);
    expect(isMacOsUA(UA.desktop)).toBe(false);
    expect(isMacOsUA(UA.android)).toBe(false);
  });
});

describe('resolveLandingInstallMode — MAXIMUM honest affordance per platform', () => {
  it('installed → render nothing', () => {
    expect(resolveLandingInstallMode('installed', 'chromium', false)).toBe('installed');
  });
  it('iOS Safari → the honest Share instruction (never a button)', () => {
    expect(resolveLandingInstallMode('ios', 'safari', false)).toBe('ios-share');
  });
  it('Android Chromium → real install prompt path', () => {
    expect(resolveLandingInstallMode('android', 'chromium', false)).toBe('prompt');
  });
  it('Desktop Chrome/Edge → real install prompt path', () => {
    expect(resolveLandingInstallMode('desktop', 'chromium', false)).toBe('prompt');
    expect(resolveLandingInstallMode('desktop', 'chromium', true)).toBe('prompt');
  });
  it('macOS Safari → Dock instruction', () => {
    expect(resolveLandingInstallMode('desktop', 'safari', true)).toBe('macos-safari');
  });
  it('Firefox / non-installable desktop → honest unsupported one-liner', () => {
    expect(resolveLandingInstallMode('desktop', 'firefox', true)).toBe('unsupported');
    expect(resolveLandingInstallMode('desktop', 'firefox', false)).toBe('unsupported');
    expect(resolveLandingInstallMode('desktop', 'other', false)).toBe('unsupported');
    // Safari that is NOT on macOS (would be exotic) has no Dock path → unsupported.
    expect(resolveLandingInstallMode('desktop', 'safari', false)).toBe('unsupported');
  });
});

describe('detectLandingInstallMode — end-to-end from a window', () => {
  it('iPhone Safari → ios-share', () => {
    expect(detectLandingInstallMode(fakeWin({ ua: UA.iphone }))).toBe('ios-share');
  });
  it('Android Chrome → prompt', () => {
    expect(detectLandingInstallMode(fakeWin({ ua: UA.android }))).toBe('prompt');
  });
  it('Desktop Chrome → prompt; Desktop Edge → prompt', () => {
    expect(detectLandingInstallMode(fakeWin({ ua: UA.desktop }))).toBe('prompt');
    expect(detectLandingInstallMode(fakeWin({ ua: UA.edge }))).toBe('prompt');
  });
  it('macOS Safari → macos-safari; macOS Firefox → unsupported', () => {
    expect(detectLandingInstallMode(fakeWin({ ua: UA.macSafari }))).toBe('macos-safari');
    expect(detectLandingInstallMode(fakeWin({ ua: UA.firefoxMac }))).toBe('unsupported');
  });
  it('installed PWA → installed (block hides)', () => {
    expect(detectLandingInstallMode(fakeWin({ ua: UA.iphone, standalone: true }))).toBe('installed');
    expect(detectLandingInstallMode(fakeWin({ ua: UA.desktop, displayMode: true }))).toBe('installed');
  });
});
