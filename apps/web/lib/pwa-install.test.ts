// INSTALL-U4 gate: platform detection + the honest-affordance decisions that
// drive the install hint. Pure logic (matches the web app's node vitest env).
import { describe, it, expect } from 'vitest';
import {
  platformFromUA,
  detectInstallPlatform,
  isStandaloneDisplay,
  shouldShowInstallHint,
  showNativeInstallButton,
} from './pwa-install';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
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
