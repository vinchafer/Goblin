import type { Metadata } from 'next';
import { PublicPageShell } from '@/components/landing/PublicPageShell';
import { MANIFESTO_COPY } from '@/lib/copy/manifesto';
import { ManifestoProse } from './ManifestoProse';

/**
 * WAVE-ABOUT-MANIFESTO · U4 — /manifesto.
 *
 * Server component for the metadata; the locale-bound reading half is
 * ManifestoProse. See app/about/page.tsx for why the metadata is EN-canonical
 * while `<html lang>` is corrected client-side.
 */
export const metadata: Metadata = {
  title: MANIFESTO_COPY.en.metaTitle,
  description: MANIFESTO_COPY.en.metaDescription,
  alternates: { canonical: '/manifesto' },
  openGraph: {
    title: MANIFESTO_COPY.en.metaTitle,
    description: MANIFESTO_COPY.en.metaDescription,
    url: 'https://justgoblin.com/manifesto',
    type: 'article',
  },
};

export default function ManifestoPage() {
  return (
    <PublicPageShell>
      <ManifestoProse />
    </PublicPageShell>
  );
}
