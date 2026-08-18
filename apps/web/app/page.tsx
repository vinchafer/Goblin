import { LandingPage } from '@/components/landing/LandingPage';
import { LandingShell, landingMetadata } from '@/components/landing/LandingShell';

export const metadata = landingMetadata('en');

export default function Home() {
  return (
    <LandingShell lang="en">
      <LandingPage lang="en" />
    </LandingShell>
  );
}
