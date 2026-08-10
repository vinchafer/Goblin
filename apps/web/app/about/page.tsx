import type { Metadata } from 'next';
import { PublicPageShell } from '@/components/landing/PublicPageShell';
import { ABOUT_COPY } from '@/lib/copy/about';
import { AboutProse } from './AboutProse';

/**
 * WAVE-ABOUT-MANIFESTO · U4 — /about.
 *
 * A server component, so the route ships real metadata. The title and
 * description come from the EN copy keys and not from a second literal: the
 * canonical language of this copy is English, and the language a visitor
 * resolves is a client-side answer (localStorage precedence, lib/locale.ts) that
 * server-rendered `<head>` cannot know. `<html lang>` is corrected on the client
 * by <HtmlLangSync> inside AboutProse — that is the honest split, and it is why
 * the metadata below is not claimed to be locale-aware.
 */
export const metadata: Metadata = {
  title: ABOUT_COPY.en.metaTitle,
  description: ABOUT_COPY.en.metaDescription,
  alternates: { canonical: '/about' },
  openGraph: {
    title: ABOUT_COPY.en.metaTitle,
    description: ABOUT_COPY.en.metaDescription,
    url: 'https://justgoblin.com/about',
    type: 'article',
  },
};

export default function AboutPage() {
  return (
    <PublicPageShell>
      <AboutProse />
    </PublicPageShell>
  );
}
