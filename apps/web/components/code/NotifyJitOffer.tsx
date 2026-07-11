"use client";

// A-5 (WAVE-A) — the JIT notification ask. After the FIRST long agent run, offer once to
// turn on push ("Sag dir Bescheid, wenn's fertig ist?") right where the user just waited,
// instead of burying it in settings. Honest + unobtrusive: shows only when push is
// actually supported and not already on, and never again once dismissed or enabled.

import { useEffect, useState } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useLang, t } from "@/lib/use-lang";

const DISMISS_KEY = "goblin-notify-jit-dismissed";

export function NotifyJitOffer({ trigger }: { trigger: boolean }) {
  const lang = useLang();
  const { subscribe, isSubscribed, isSupported, loading } = usePushNotifications();
  const [dismissed, setDismissed] = useState(true); // assume dismissed until localStorage read
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1"); } catch { setDismissed(false); }
  }, []);

  if (loading || !trigger || !isSupported || isSubscribed || dismissed) return null;

  function close() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  async function enable() {
    setBusy(true);
    try { await subscribe(); } finally { setBusy(false); close(); }
  }

  return (
    <div
      data-testid="notify-jit-offer"
      style={{ margin: "0 14px 10px", padding: "10px 12px", border: "1px solid var(--ed-rule)", borderRadius: 10, background: "var(--ed-chrome)", display: "flex", alignItems: "center", gap: 10 }}
    >
      <span aria-hidden style={{ fontSize: 15 }}>🔔</span>
      <span style={{ flex: 1, fontSize: 12.5, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)", lineHeight: 1.4 }}>
        {t(lang, "Soll ich dir Bescheid sagen, wenn's fertig ist? Du musst dann nicht warten.", "Want a ping when it's done? Then you don't have to wait around.")}
      </span>
      <button type="button" onClick={enable} disabled={busy} style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-sans)", color: "var(--ed-on-primary, #fff)", background: "var(--ed-primary, var(--brand-green))", border: "none", borderRadius: 7, padding: "6px 12px", cursor: busy ? "wait" : "pointer", flexShrink: 0 }}>
        {t(lang, "Bescheid geben", "Notify me")}
      </button>
      <button type="button" aria-label={t(lang, "Schließen", "Dismiss")} onClick={close} style={{ fontSize: 14, color: "var(--ed-fg-3)", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0, padding: 2 }}>
        ✕
      </button>
    </div>
  );
}
