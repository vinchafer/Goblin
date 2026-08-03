'use client';

// WAVE-J (J1): a single help article page at /help/<slug>. Client component so it
// shares the app's useLang (DE/EN) source of truth; the corpus is static, so the
// article is resolved from @goblin/shared with no fetch.

import { useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { helpArticleBySlug } from '@goblin/shared/src/help-content';
import { HelpArticleBody } from '@/components/help/HelpArticleBody';
import { emitEvent } from '@/lib/api';

export default function HelpArticlePage() {
  const params = useParams<{ slug: string }>();
  const article = helpArticleBySlug(params.slug);

  // help_opened funnel signal (metadata only — which article, never content).
  useEffect(() => {
    if (article) emitEvent('help_opened', { article: article.slug });
  }, [article]);

  if (!article) return notFound();

  return (
    // WAVE-KORREKTUR-1 · U1: same treatment as the /help index — public,
    // full-screen, top padding under a typical iOS inset.
    <div style={{
      minHeight: '100dvh', background: 'var(--surface-page)', padding: '28px 20px 80px',
      paddingTop: 'max(28px, calc(env(safe-area-inset-top, 0px) + 12px))',
      paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
      paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
      paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
    }}>
      <HelpArticleBody article={article} />
    </div>
  );
}
