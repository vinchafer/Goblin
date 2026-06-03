import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { Manrope, Instrument_Serif } from 'next/font/google';
import { OnboardingChrome } from './_components/chrome';

// App route (B-S9): lock zoom so the onboarding flow can't be pinch-zoomed into
// a broken layout on mobile. Marketing routes keep zoom (root layout).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1A3A2A',
};
import '../../styles/onboarding-tokens.css';

// Scoped font variables for the .gobl-onb wrapper. Manrope + Instrument
// Serif are also loaded globally in app/layout.tsx; these scoped loaders
// expose them under the --font-onb-* variable names the onboarding CSS uses.
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-onb-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-onb-serif',
  display: 'swap',
  weight: '400',
  style: ['normal', 'italic'],
});

export default function WelcomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`gobl-onb ${manrope.variable} ${instrumentSerif.variable}`}>
      <OnboardingChrome>{children}</OnboardingChrome>
    </div>
  );
}
