"use client";

// P1.11 — the publish-moment JIT. The founder tapped "Live stellen" with no Vercel
// token and hit a dead end. Founder decision (2026-07-07): Goblin does NOT host
// user deploys — every user connects their OWN Vercel; that's part of becoming a
// real builder. So this sheet is the canonical first-publish path for every new
// user: welcoming, clear, zero dead ends. It detects the missing connection BEFORE
// the deploy fails, lets the user connect inline in ~2 minutes, and returns them to
// a still-pending "Live stellen" (onConnected resumes the publish).

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { apiPost } from "@/lib/api";
import { useLang, t } from "@/lib/use-lang";

interface Props {
  /** Resume the pending publish after a successful connect. */
  onConnected: () => void;
  onClose: () => void;
}

export function VercelConnectSheet({ onConnected, onClose }: Props) {
  const lang = useLang();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    if (!token.trim()) { setError(t(lang, "Bitte Token einfügen", "Please paste a token")); return; }
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/integrations/vercel", { token: token.trim() });
      // Connected → resume the publish the user already asked for.
      onConnected();
    } catch (e) {
      setError((e as Error)?.message || t(lang, "Verbindung fehlgeschlagen", "Connection failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        style={{ position: "absolute", inset: 0, zIndex: 84, background: "var(--surface-overlay, rgba(0,0,0,0.4))" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={t(lang, "Vercel verbinden, um live zu gehen", "Connect Vercel to go live")}
        data-testid="vercel-jit-sheet"
        style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          background: "var(--ed-chrome-2)", border: "1px solid var(--ed-rule)", borderRadius: 16,
          padding: "24px 24px 20px", zIndex: 85, width: "min(420px, calc(100% - 32px))",
          maxHeight: "calc(100dvh - 48px)", overflow: "auto",
          boxShadow: "0 20px 48px rgba(15,43,30,0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 34, height: 34, borderRadius: 9, background: "var(--ed-canvas)", border: "1px solid var(--ed-rule)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, color: "var(--ed-fg-2)",
            }}>V</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)" }}>
              {t(lang, "Noch ein Schritt bis live", "One step from live")}
            </span>
          </div>
          <button onClick={onClose} aria-label={t(lang, "Schließen", "Close")}
            style={{ background: "transparent", border: "none", color: "var(--ed-fg-3)", cursor: "pointer", display: "inline-flex", padding: 4 }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <p style={{ margin: "0 0 6px", fontSize: 14, lineHeight: 1.55, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)" }}>
          {t(lang,
            "Um live zu gehen, verbinde einmalig dein Vercel-Konto — das dauert etwa 2 Minuten.",
            "To go live, connect your Vercel account once — it takes about 2 minutes.")}
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 12.5, lineHeight: 1.5, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)" }}>
          {t(lang,
            "Deine Seite läuft dann in deinem eigenen Vercel-Account — deine Deployments, deine Kosten, unter einer echten öffentlichen Adresse.",
            "Your site then runs in your own Vercel account — your deployments, your cost, at a real public address.")}
        </p>

        <ol style={{ margin: "0 0 14px", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
          <li style={{ fontSize: 12.5, color: "var(--ed-fg-3)", lineHeight: 1.5, fontFamily: "var(--font-sans)" }}>
            {t(lang, "In Vercel: Settings → Tokens → Token erstellen", "In Vercel: Settings → Tokens → Create Token")}
            {" "}
            <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--ed-accent)", textDecoration: "none" }}>
              vercel.com/account/tokens ↗
            </a>
          </li>
          <li style={{ fontSize: 12.5, color: "var(--ed-fg-3)", lineHeight: 1.5, fontFamily: "var(--font-sans)" }}>
            {t(lang, "Token hier einfügen und verbinden", "Paste the token here and connect")}
          </li>
        </ol>

        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={t(lang, "Vercel-Token einfügen", "Paste Vercel token")}
          autoComplete="off"
          spellCheck={false}
          data-testid="vercel-jit-token"
          onKeyDown={(e) => { if (e.key === "Enter" && token.trim() && !busy) void connect(); }}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 9, boxSizing: "border-box",
            border: "1px solid var(--ed-rule)", background: "var(--ed-canvas)", color: "var(--ed-fg-1)",
            fontSize: 13, fontFamily: "var(--font-mono)", outline: "none",
          }}
        />
        {error && (
          <div data-testid="vercel-jit-error" style={{ marginTop: 8, fontSize: 12.5, color: "var(--danger, #B0432A)", fontFamily: "var(--font-sans)" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            onClick={connect}
            disabled={busy || !token.trim()}
            data-testid="vercel-jit-connect"
            style={{
              flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "11px 16px", borderRadius: 10, border: "none",
              background: token.trim() ? "var(--ed-primary)" : "transparent",
              color: token.trim() ? "var(--ed-on-primary)" : "var(--ed-fg-3)",
              fontSize: 14, fontWeight: 700, cursor: busy ? "wait" : (token.trim() ? "pointer" : "not-allowed"),
              fontFamily: "var(--font-sans)",
            }}
          >
            {busy ? t(lang, "Verbinde…", "Connecting…") : <><Icon name="play" size={15} /> {t(lang, "Verbinden & live stellen", "Connect & publish")}</>}
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--ed-fg-3)", lineHeight: 1.45, fontFamily: "var(--font-sans)" }}>
          {t(lang,
            "Wird gegen die Vercel-API geprüft und verschlüsselt gespeichert. Nur Account-Ebene.",
            "Validated against the Vercel API and stored encrypted. Account level only.")}
        </div>
      </div>
    </>
  );
}
