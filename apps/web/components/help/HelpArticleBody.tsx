'use client';

// WAVE-J (J1): renders one help article from the SINGLE-SOURCE corpus in
// @goblin/shared (the same data the support agent is grounded on — no drift).
// Headings are anchor-linkable (id = section.anchor) so the agent's citations and
// deep-links land on the exact section. Design tokens only → dark/light automatic;
// 375px-first (max width, generous line-height, 56px tap targets on links).

import Link from 'next/link';
import type { HelpArticle } from '@goblin/shared/src/help-content';
import { useLang, t, type Lang } from '@/lib/use-lang';

export function HelpArticleBody({ article }: { article: HelpArticle }) {
  const lang: Lang = useLang();
  return (
    <article style={{ maxWidth: 720, margin: '0 auto' }}>
      <Link
        href="/help"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44,
          fontSize: 13, color: 'var(--meta)', textDecoration: 'none',
          fontFamily: 'var(--font-sans)', marginBottom: 16,
        }}
      >
        {t(lang, '← Alle Hilfe-Artikel', '← All help articles')}
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span aria-hidden style={{ fontSize: 30 }}>{article.icon}</span>
        <h1 style={{
          fontFamily: 'var(--font-sans)', fontSize: 'clamp(24px, 5vw, 34px)',
          color: 'var(--text)', fontWeight: 700, letterSpacing: '-0.5px', margin: 0,
        }}>
          {article.title[lang]}
        </h1>
      </div>
      <p style={{ fontSize: 15, color: 'var(--meta)', fontFamily: 'var(--font-sans)', margin: '0 0 28px', lineHeight: 1.6 }}>
        {article.summary[lang]}
      </p>

      {article.sections.map((s) => (
        <section key={s.anchor} id={s.anchor} style={{ marginBottom: 26, scrollMarginTop: 80 }}>
          <h2 style={{
            fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 600,
            color: 'var(--text)', margin: '0 0 8px',
          }}>
            {s.heading[lang]}
          </h2>
          <p style={{
            fontSize: 15, lineHeight: 1.7, color: 'var(--text-2, var(--meta))',
            fontFamily: 'var(--font-sans)', margin: 0, whiteSpace: 'pre-wrap',
          }}>
            {s.body[lang]}
          </p>
        </section>
      ))}
    </article>
  );
}
