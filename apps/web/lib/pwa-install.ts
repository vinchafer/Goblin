// INSTALL-U4: platform detection for the "Goblin als App installieren" hint.
//
// The honest affordance rule (per the corpus article als-app-installieren):
//   • iOS has NO programmatic install prompt — the instruction IS the affordance.
//   • Android/desktop Chromium fire `beforeinstallprompt`, which CAN be triggered.
// So the hint shows platform-appropriate steps and only offers a real install
// button where one genuinely exists.

export type InstallPlatform = 'ios' | 'android' | 'desktop' | 'installed';

export const INSTALL_HINT_DISMISS_KEY = 'goblin_install_hint_dismissed';
export const INSTALL_ARTICLE_HREF = '/help/als-app-installieren';

/** Pure UA → platform classifier (testable without a DOM). */
export function platformFromUA(ua: string): 'ios' | 'android' | 'desktop' {
  const s = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(s)) return 'ios';
  if (/android/.test(s)) return 'android';
  return 'desktop';
}

/** True when the page is already running as an installed standalone PWA. */
export function isStandaloneDisplay(win: Window = window): boolean {
  try {
    const mm = win.matchMedia && win.matchMedia('(display-mode: standalone)').matches;
    // iOS Safari exposes navigator.standalone instead of the display-mode query.
    const iosStandalone = (win.navigator as unknown as { standalone?: boolean }).standalone === true;
    return !!mm || iosStandalone;
  } catch {
    return false;
  }
}

/**
 * Resolve the install platform for the current environment. Returns 'installed'
 * when already running standalone (the hint should then never show). iPadOS 13+
 * reports a desktop-Mac UA, so we treat a touch-capable "Mac" as iOS.
 */
export function detectInstallPlatform(win: Window = window): InstallPlatform {
  if (isStandaloneDisplay(win)) return 'installed';
  const nav = win.navigator;
  const ua = nav.userAgent || '';
  // iPadOS masquerading as macOS: Macintosh UA + a touch screen.
  if (/macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1) return 'ios';
  return platformFromUA(ua);
}

/** Whether the install hint should render, given platform + dismissed state. */
export function shouldShowInstallHint(platform: InstallPlatform, dismissed: boolean): boolean {
  if (dismissed) return false;
  // Discreet by design: only offer it on phones/tablets, never when installed.
  return platform === 'ios' || platform === 'android';
}

/**
 * Whether to show a REAL, clickable install button. The honesty invariant:
 * iOS has no programmatic install prompt, so it NEVER gets a button (only the
 * instruction link) — even if a stray beforeinstallprompt event were present.
 * A button appears only where the browser genuinely fired the prompt.
 */
export function showNativeInstallButton(platform: InstallPlatform, hasDeferredPrompt: boolean): boolean {
  if (platform === 'ios') return false; // no phantom install button on iOS, ever
  return hasDeferredPrompt;
}
