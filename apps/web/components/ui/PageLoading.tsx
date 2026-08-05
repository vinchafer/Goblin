'use client';

/**
 * FINAL-POLISH · U4 — the ONE loading screen.
 *
 * The founder, on prod: "es gibt mehrere verschiedene Ladeschirme … sieht extrem
 * unprofessionell aus" — sometimes a small gold mark, sometimes the large green one, and
 * sometimes a jump from one to the other mid-load. The cause was six independently written
 * loading states: the root route splash (green, 64), three list pages (green, 32/36), the
 * code workspace (green, 28) and the chat history load (GOLD, via GoblinLoader's inline
 * "thinking" indicator). Navigating from one to the next is what produced the jump.
 *
 * Founder decision: the GREEN one is right — "vor allem seine Grösse". So there is now one
 * component, one colour, one size, and a context line each site supplies (or omits),
 * because "Workspace wird geladen" is not true on the chats list.
 *
 * The mark uses the `brand` variant (--brand-fg), NOT `green` (--brand-green). Rendering
 * this screen in dark mode showed why: --brand-green is the locked brand anchor and never
 * flips, so the mark was dark green on the dark green page surface — very nearly
 * invisible. The old app/loading.tsx had that bug too. --brand-fg is the foreground twin:
 * brand green in light, sage in dark.
 *
 * NOTE on the "old gold logo asset": there isn't one. `gold` and `green` are colour
 * variants of the SAME inline mark in GoblinLogo.tsx (one G_MARK_PATH, `fill=currentColor`)
 * — there is no legacy asset left to sweep, so the grep-proof the wave asked for is a
 * proof about VARIANT USE on loading surfaces, not about a file. See PageLoading.test.ts.
 *
 * Deliberately NOT changed: the small gold marks that sit inline inside working UI — the
 * "Stoppen" button, the agent step rows, the build-status pill. Those are activity
 * indicators next to text, not loading screens, and gold is their established brand use.
 */

import { GoblinLogo } from '@/components/brand/GoblinLogo';
import { useLang } from '@/lib/use-lang';

/** The one mark size for a loading screen. The founder picked the large green one. */
export const PAGE_LOADING_MARK_SIZE = 64;

/**
 * What is being loaded. Each maps to one honest line — never a claim about a different
 * surface. `none` renders the mark alone, for places where a caption would be noise.
 */
export type PageLoadingContext =
  | 'none'
  | 'workspace'
  | 'projects'
  | 'chats'
  | 'chat'
  | 'code'
  | 'files';

export const CONTEXT_COPY: Record<Exclude<PageLoadingContext, 'none'>, { de: string; en: string }> = {
  workspace: { de: 'Arbeitsbereich wird geladen', en: 'Loading your workspace' },
  projects:  { de: 'Projekte werden geladen',     en: 'Loading your projects' },
  chats:     { de: 'Chats werden geladen',        en: 'Loading your chats' },
  chat:      { de: 'Chat wird geladen',           en: 'Loading this chat' },
  code:      { de: 'Code wird geladen',           en: 'Loading your code' },
  files:     { de: 'Dateien werden geladen',      en: 'Loading your files' },
};

export interface PageLoadingProps {
  context?: PageLoadingContext;
  /**
   * `viewport` fills the screen (a route-level splash); `region` fills whatever box it is
   * placed in (a pane or list area that is still loading). The mark and copy are identical
   * either way — that identity is the whole point.
   */
  fill?: 'viewport' | 'region';
}

export function PageLoading({ context = 'none', fill = 'region' }: PageLoadingProps) {
  const lang = useLang();
  const copy = context === 'none' ? null : CONTEXT_COPY[context];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'var(--surface-page)',
        ...(fill === 'viewport'
          ? { minHeight: '100dvh' }
          : { flex: 1, minHeight: 220, width: '100%' }),
      }}
    >
      <GoblinLogo state="breath" size={PAGE_LOADING_MARK_SIZE} variant="brand" />
      {copy && (
        <p
          style={{
            fontFamily: 'var(--font-mono), JetBrains Mono, ui-monospace, monospace',
            fontSize: 12.5,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: 'var(--ink-muted)',
            margin: 0,
            textAlign: 'center',
            padding: '0 16px',
          }}
        >
          {lang === 'en' ? copy.en : copy.de}
        </p>
      )}
    </div>
  );
}

export default PageLoading;
