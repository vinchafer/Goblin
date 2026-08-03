import Link from "next/link";
import { GoblinLogo } from "@/components/brand/GoblinLogo";

export default function NotFound() {
  return (
    // WAVE-KORREKTUR-1 · U1: 404 is a full-screen public surface — a mistyped or
    // stale link inside the installed PWA lands here. Content is centred, but the
    // padding still has to clear the notch/home indicator when the card is tall.
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--paper)', padding: '24px', textAlign: 'center',
      paddingTop: 'max(24px, env(safe-area-inset-top, 0px))',
      paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
      paddingLeft: 'max(24px, env(safe-area-inset-left, 0px))',
      paddingRight: 'max(24px, env(safe-area-inset-right, 0px))',
    }}>
      <div style={{ marginBottom: 24 }}><GoblinLogo state="idle" size={80} variant="gold" /></div>
      <h1 style={{
        fontFamily: 'var(--font-sans)', fontSize: 'clamp(32px, 6vw, 56px)',
        color: 'var(--brand-green)', fontWeight: 900, letterSpacing: '-2px',
        marginBottom: 12,
      }}>
        404
      </h1>
      <p style={{
        fontSize: 18, color: 'var(--meta)', marginBottom: 8,
        fontFamily: 'var(--font-sans)',
      }}>
        This page ran away. Your goblin can&apos;t find it.
      </p>
      <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text-faint)', marginBottom: 36, fontFamily: 'var(--font-sans)' }}>
        Maybe it got deployed somewhere else.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          href="/dashboard"
          style={{
            background: 'var(--brand-green)', color: '#fff', padding: '12px 24px',
            borderRadius: 10, fontSize: 'var(--t-small-fs)', fontWeight: 500, textDecoration: 'none',
          }}
        >
          Back to workshop →
        </Link>
        <Link
          href="/"
          style={{
            background: 'transparent', color: 'var(--meta)', padding: '12px 24px',
            borderRadius: 10, fontSize: 'var(--t-small-fs)', fontWeight: 400, textDecoration: 'none',
            border: '1px solid rgba(0,0,0,0.12)',
          }}
        >
          Home
        </Link>
      </div>
    </div>
  );
}
