import { LandingPage } from '@/components/landing/LandingPage';
import { LandingShell, landingMetadata } from '@/components/landing/LandingShell';

// U6 — the German landing. Same document, same section order, same components:
// only the dictionary differs (components/landing/copy.ts). Before this route
// existed the nav's DE·EN control could set a language the page under it had no
// way to honour, so a German reader switched to DE and watched nothing change.
export const metadata = landingMetadata('de');

export default function HomeDe() {
  return (
    <LandingShell lang="de">
      <LandingPage lang="de" />
    </LandingShell>
  );
}
