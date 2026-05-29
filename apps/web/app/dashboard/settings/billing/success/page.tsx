"use client";
// LEGACY — superseded by SettingsRoot + SettingsModal. Direct-URL
// access only. Do not extend; future settings additions belong in
// SettingsRoot (apps/web/components/settings/SettingsRoot.tsx)
// and components/settings/sections.ts.

import { useEffect } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

export default function BillingSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/dashboard/settings/billing');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: 'rgba(74, 124, 59, 0.1)' }}>
          <CheckCircle className="w-10 h-10" style={{ color: 'var(--success)' }} />
        </div>

        <h1 className="text-2xl font-semibold mb-3" style={{ color: 'var(--ink-1)' }}>
          Subscription activated!
        </h1>

        <p className="mb-6" style={{ color: 'var(--ink-3)' }}>
          Your goblin just got stronger. Redirecting you back to billing settings...
        </p>
      </div>
    </div>
  );
}