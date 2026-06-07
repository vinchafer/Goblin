import { redirect } from "next/navigation";

// BUG (Walk-4): /onboarding 404'd for logged-in users. The real onboarding lives
// at /welcome/*; the dashboard layout already routes brand-new users there. So a
// hit on /onboarding just forwards into the app instead of dead-ending on a 404.
export const dynamic = "force-dynamic";

export default function OnboardingRedirect() {
  redirect("/dashboard");
}
