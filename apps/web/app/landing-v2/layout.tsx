import { Manrope, JetBrains_Mono, Instrument_Serif } from 'next/font/google';
import { GoblinMarkSprite } from '@/components/landing-v2/brand/GoblinMarkSprite';
import './landing-v2.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--lp2-font-sans',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--lp2-font-mono',
  display: 'swap',
});
const serif = Instrument_Serif({
  subsets: ['latin'],
  style: ['italic', 'normal'],
  weight: '400',
  variable: '--lp2-font-serif',
  display: 'swap',
});

const PRE_PAINT_SCRIPT = `(function(){
  try {
    var t = localStorage.getItem('goblin-theme');
    if (t === 'dark') document.documentElement.classList.add('lp2-dark');
    else if (t === 'light') document.documentElement.classList.add('lp2-light');
  } catch(e) {}
})();`;

export const metadata = {
  title: 'Goblin — The cloud workshop for builders',
  description:
    "Tell it what you want. It ships. The cloud workshop for builders who don't wait for a laptop. Bring your own AI keys. Push to GitHub. Deploy to Vercel.",
};

export default function LandingV2Layout({ children }: { children: React.ReactNode }) {
  const rootClassName = `landing-root ${manrope.variable} ${mono.variable} ${serif.variable}`;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
      <div
        className={rootClassName}
        data-theme="light"
        data-accent="restrained"
        data-density="compact"
      >
        <GoblinMarkSprite />
        {children}
      </div>
    </>
  );
}
