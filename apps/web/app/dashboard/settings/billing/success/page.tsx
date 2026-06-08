"use client";
// Stripe checkout return → confirm briefly, then open the canonical billing
// section in the settings sheet (WALKFIX-2.1: the old /settings/billing page is
// retired).
import { useEffect } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

export default function BillingSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/dashboard?settings=billing');
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: 'var(--font-sans)' }}>
      <CheckCircle size={56} weight="fill" style={{ color: 'var(--brand-green)' }} />
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand-green)', margin: 0 }}>Zahlung bestätigt</h1>
      <p style={{ fontSize: 14, color: 'var(--meta)' }}>Dein Plan ist aktiv. Weiterleitung …</p>
    </div>
  );
}
