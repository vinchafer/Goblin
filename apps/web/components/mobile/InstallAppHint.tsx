'use client';

// INSTALL-U4: a discreet, dismissible hint that explains installing Goblin as an
// app — platform-detected, so iOS users see the honest Safari route and Android
// users get a real install button when the browser offers one. Renders NOTHING
// when already installed (standalone), on desktop, or once dismissed. There is
// deliberately NO fake install button on iOS: iOS has no programmatic prompt, so
// the "Anleitung" link to /help/als-app-installieren IS the honest affordance.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang, t } from '@/lib/use-lang';
import {
  detectInstallPlatform,
  shouldShowInstallHint,
  showNativeInstallButton,
  INSTALL_HINT_DISMISS_KEY,
  INSTALL_ARTICLE_HREF,
  type InstallPlatform,
} from '@/lib/pwa-install';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallAppHint() {
  const lang = useLang();
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  const [dismissed, setDismissed] = useState(true); // assume dismissed until we read storage (no flash)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setMounted(true);
    setPlatform(detectInstallPlatform());
    try {
      setDismissed(localStorage.getItem(INSTALL_HINT_DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
    // Android/desktop Chromium: capture the install prompt so we can offer a real
    // button. iOS never fires this, so the iOS branch stays instruction-only.
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    // If the user installs (any route), hide the hint immediately.
    const onInstalled = () => setPlatform('installed');
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(INSTALL_HINT_DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
    dismiss();
  };

  if (!mounted || platform === null) return null;
  if (!shouldShowInstallHint(platform, dismissed)) return null;

  const isIOS = platform === 'ios';
  const showButton = showNativeInstallButton(platform, !!deferred);
  const line = isIOS
    ? t(lang, 'Teilen → „Zum Home-Bildschirm“ — eigenes Icon, Vollbild, kein App-Store.',
             'Share → “Add to Home Screen” — own icon, full screen, no app store.')
    : t(lang, 'Aufs Handy legen — eigenes Icon, Vollbild, kein App-Store.',
             'Put it on your phone — own icon, full screen, no app store.');

  return (
    <div
      data-testid="install-app-hint"
      role="note"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', marginBottom: 16, borderRadius: 12,
        background: 'var(--panel, #fff)', border: '1px solid var(--border)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span aria-hidden style={{ fontSize: 22, flexShrink: 0 }}>📲</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          {t(lang, 'Goblin als App installieren', 'Install Goblin as an app')}
        </span>
        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--meta)', marginTop: 2, lineHeight: 1.4 }}>
          {line}
        </span>
      </span>

      {/* Android/desktop-Chromium: a REAL install button, only when the browser
          actually offered one. iOS never reaches this branch — no phantom button. */}
      {showButton ? (
        <button
          data-testid="install-app-button"
          onClick={install}
          style={{
            flexShrink: 0, padding: '8px 12px', borderRadius: 8, minHeight: 40,
            background: 'var(--brand-green)', color: 'var(--bone, #F4ECD8)',
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: 'var(--font-sans)',
          }}
        >
          {t(lang, 'Installieren', 'Install')}
        </button>
      ) : (
        <Link
          data-testid="install-app-instructions"
          href={INSTALL_ARTICLE_HREF}
          style={{
            flexShrink: 0, padding: '8px 12px', borderRadius: 8, minHeight: 40,
            display: 'inline-flex', alignItems: 'center',
            background: 'transparent', color: 'var(--brand-green)',
            border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {t(lang, 'Anleitung', 'How to')}
        </Link>
      )}

      <button
        data-testid="install-app-dismiss"
        onClick={dismiss}
        aria-label={t(lang, 'Hinweis ausblenden', 'Dismiss hint')}
        style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: 8,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--meta)', fontSize: 18, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ×
      </button>
    </div>
  );
}
