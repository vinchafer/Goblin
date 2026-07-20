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

// ── LAUNCH-ASSIST U1: the prominent landing-page install block ──────────────────
// The dashboard hint (above) only covers phones (ios/android). The landing block
// does the MAXIMUM each platform allows, so it needs a finer read: on DESKTOP it
// must tell Chromium (real install prompt), macOS Safari (Dock hint), and
// Firefox/other (honest "no install, works in the tab") apart. These extra
// classifiers are additive and pure — the dashboard hint and its detection above
// are untouched.

export type BrowserFamily = 'chromium' | 'safari' | 'firefox' | 'other';

/**
 * The install affordance to render on the landing block:
 *   installed     → already a PWA; render nothing
 *   ios-share     → iPhone/iPad Safari: the honest two-step Share instruction (no button)
 *   prompt        → Chromium (Android/Desktop/Edge): a REAL button IF beforeinstallprompt
 *                   fired, otherwise an honest fallback line
 *   macos-safari  → macOS Safari: the "Ablage → Zum Dock hinzufügen" instruction
 *   unsupported   → Firefox / anything without an install path: honest one-liner
 */
export type LandingInstallMode = 'installed' | 'ios-share' | 'prompt' | 'macos-safari' | 'unsupported';

/**
 * Pure UA → browser family. Order matters: a Chrome UA also contains the token
 * "Safari", and an Edge UA contains "Chrome", so the most specific tokens are
 * tested first (Firefox → Edge/Opera → Chrome → Safari → other).
 */
export function browserFamilyFromUA(ua: string): BrowserFamily {
  const s = ua.toLowerCase();
  if (/firefox|fxios/.test(s)) return 'firefox';
  if (/edg\//.test(s)) return 'chromium';        // Edge (Chromium-based)
  if (/opr\/|opera/.test(s)) return 'chromium';  // Opera (Chromium-based)
  if (/chrome|chromium|crios/.test(s)) return 'chromium';
  if (/safari/.test(s)) return 'safari';
  return 'other';
}

/** Pure UA → is this a macOS desktop? (iPadOS is already reclassified to 'ios'.) */
export function isMacOsUA(ua: string): boolean {
  return /macintosh|mac os x/i.test(ua);
}

/**
 * Resolve which landing affordance to show from the already-detected platform,
 * browser family and OS. Independent of the deferred prompt: within 'prompt' the
 * component still uses `showNativeInstallButton` to decide button vs honest
 * fallback line, so no phantom button is ever shown.
 */
export function resolveLandingInstallMode(
  platform: InstallPlatform,
  browser: BrowserFamily,
  isMac: boolean,
): LandingInstallMode {
  if (platform === 'installed') return 'installed';
  if (platform === 'ios') return 'ios-share';
  if (platform === 'android') return 'prompt'; // Chromium Android fires beforeinstallprompt
  // desktop:
  if (browser === 'chromium') return 'prompt'; // Chrome / Edge / Opera desktop
  if (browser === 'safari' && isMac) return 'macos-safari';
  return 'unsupported'; // Firefox, or any desktop browser with no install path
}

/** Compose the full landing detection from a window (thin wrapper over the pure fns). */
export function detectLandingInstallMode(win: Window = window): LandingInstallMode {
  const platform = detectInstallPlatform(win);
  const ua = win.navigator?.userAgent || '';
  return resolveLandingInstallMode(platform, browserFamilyFromUA(ua), isMacOsUA(ua));
}

// ── FOUNDER-WALK-1 U3: the four-tab install block ───────────────────────────────
// The block is now four always-selectable tabs (iOS · Android · Mac · Windows).
// Detection still matters — it picks the DEFAULT-active tab — but every tab is
// clickable, so a desktop visitor can read the iOS steps and vice-versa. This is a
// pure detection→tab mapping on top of the classifiers above; the beforeinstallprompt
// path and the honest "button only where the event fired" rule are unchanged.

export type InstallTab = 'ios' | 'android' | 'mac' | 'windows';

export const INSTALL_TABS: InstallTab[] = ['ios', 'android', 'mac', 'windows'];

/**
 * The tab to open by default, from the detected platform + OS. iOS/Android map
 * straight through; desktop splits Mac vs Windows by UA (Windows is the catch-all
 * for non-Mac desktop — Linux/ChromeOS Chromium share the address-bar install
 * route). 'installed' never surfaces (the block hides), so it also defaults sanely.
 */
export function defaultInstallTab(platform: InstallPlatform, isMac: boolean): InstallTab {
  if (platform === 'ios') return 'ios';
  if (platform === 'android') return 'android';
  return isMac ? 'mac' : 'windows';
}

/** Compose the default tab from a window (thin wrapper over the pure fns). */
export function detectDefaultInstallTab(win: Window = window): InstallTab {
  const platform = detectInstallPlatform(win);
  const ua = win.navigator?.userAgent || '';
  return defaultInstallTab(platform, isMacOsUA(ua));
}
