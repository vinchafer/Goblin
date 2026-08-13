"use client";

/**
 * AKT 2 · PHASE 3 · U3.4 — the publish sheet, v2. ALLOWLISTED ACCOUNTS ONLY.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A NEW FILE AND NOT AN EDIT TO VercelConnectSheet.
 *
 * The gate says a non-allowlisted account must see the existing sheet
 * PIXEL-IDENTICAL. The cheapest possible proof of that is for the existing
 * component to be BYTE-identical — no props added, no conditional branch threaded
 * through it, nothing to reason about. `git diff` on VercelConnectSheet.tsx is the
 * regression evidence, and it is empty.
 *
 * So SessionPane picks between two components, and the Vercel path a
 * non-allowlisted user sees is not "the old sheet with a flag off" — it is the old
 * sheet.
 *
 * ── The Vercel path is INTACT here too, not a stub ───────────────────────────
 * "Eigenes Vercel verbinden (für Fortgeschrittene)" does not open a reduced
 * version of the Vercel flow: it hands control back to SessionPane's existing
 * `liveStellen()`, which is the same function the button ran before this phase
 * existed — pre-check, connect JIT, deploy, truth-gated stream, all of it. The
 * hosted path became the DEFAULT; it did not become the only door.
 *
 * ── Honest affordances ───────────────────────────────────────────────────────
 * • The name check says what it is: a check, not a reservation. Two people can
 *   both be told "frei"; the unique index decides. The sentence says so rather
 *   than letting someone believe they are holding a name.
 * • The URL shown after a publish is the VERIFIED one from the server's own
 *   response. Nothing here composes `${name}.justgoblin.app` and calls it live.
 * • A held publish (`review`) is not an error and is not styled as one.
 * ════════════════════════════════════════════════════════════════════════════════
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { apiGet, apiPost } from "@/lib/api";
import { useLang, t } from "@/lib/use-lang";

interface Props {
  projectId: string;
  appsDomain: string;
  /** Hand control to the existing Vercel flow, entirely unchanged. */
  onUseVercel: () => void;
  onClose: () => void;
  /** A verified live URL came back — SessionPane records the publish. */
  onPublished: (url: string) => void;
}

type NameState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "free"; url: string }
  | { kind: "taken"; message: string }
  | { kind: "invalid"; message: string }
  /** The check itself failed. Not "taken", not "free" — unknown, and said so. */
  | { kind: "unknown" };

type Outcome =
  | { kind: "none" }
  | { kind: "publishing"; message: string }
  | { kind: "live"; url: string }
  | { kind: "review"; message: string }
  | { kind: "error"; message: string };

/** Lower-case, digits, hyphens — the same shape the API's `normalizeName` enforces. */
function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
}

export function HostedPublishSheet({ projectId, appsDomain, onUseVercel, onClose, onPublished }: Props) {
  const lang = useLang();
  const [name, setName] = useState("");
  const [nameState, setNameState] = useState<NameState>({ kind: "idle" });
  const [outcome, setOutcome] = useState<Outcome>({ kind: "none" });
  const seq = useRef(0);

  const normalized = normalize(name);

  // Debounced availability check. `seq` discards a stale answer: typing fast
  // otherwise lets an earlier "frei" land after a later "vergeben".
  useEffect(() => {
    if (!normalized) { setNameState({ kind: "idle" }); return; }
    const mine = ++seq.current;
    setNameState({ kind: "checking" });
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const r = await apiGet<{ available: boolean; url?: string; reason?: string; message?: string }>(
            `/api/ops/apps/name-check?name=${encodeURIComponent(normalized)}`,
          );
          if (mine !== seq.current) return;
          if (r.available) setNameState({ kind: "free", url: r.url ?? `https://${normalized}.${appsDomain}` });
          else if (r.reason === "taken" || r.reason === "released") setNameState({ kind: "taken", message: r.message ?? "" });
          else setNameState({ kind: "invalid", message: r.message ?? "" });
        } catch {
          if (mine !== seq.current) return;
          // A failed check is UNKNOWN. Rendering it as "frei" would invite someone
          // to publish into a collision; as "vergeben" it would refuse a name that
          // is theirs for the taking.
          setNameState({ kind: "unknown" });
        }
      })();
    }, 400);
    return () => clearTimeout(timer);
  }, [normalized, appsDomain]);

  const publish = useCallback(async () => {
    if (!normalized) return;
    setOutcome({ kind: "publishing", message: t(lang, "Wird geprüft und veröffentlicht …", "Checking and publishing …") });
    try {
      const r = await apiPost<{ url?: string; status?: string; message?: string }>("/api/ops/apps/publish", {
        projectId,
        name: normalized,
      });
      // 202 → held for review. The server's own German is shown verbatim; this
      // component does not author a sentence about why a publish was held.
      if (r?.status === "review") {
        setOutcome({ kind: "review", message: r.message ?? "" });
        return;
      }
      if (r?.url) {
        setOutcome({ kind: "live", url: r.url });
        onPublished(r.url);
        return;
      }
      setOutcome({ kind: "error", message: t(lang, "Die Antwort war unvollständig.", "The response was incomplete.") });
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      setOutcome({ kind: "error", message: msg || t(lang, "Veröffentlichen fehlgeschlagen.", "Publishing failed.") });
    }
  }, [normalized, projectId, lang, onPublished]);

  const busy = outcome.kind === "publishing";
  const canPublish = !!normalized && nameState.kind === "free" && !busy;

  return (
    <>
      <div
        style={{ position: "absolute", inset: 0, zIndex: 84, background: "var(--surface-overlay, rgba(0,0,0,0.4))" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={t(lang, "App live stellen", "Publish your app")}
        data-testid="hosted-publish-sheet"
        style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          background: "var(--ed-chrome-2)", border: "1px solid var(--ed-rule)", borderRadius: 16,
          padding: "24px 24px 20px", zIndex: 85, width: "min(420px, calc(100% - 32px))",
          maxHeight: "calc(100dvh - 48px)", overflow: "auto",
          boxShadow: "0 20px 48px rgba(15,43,30,0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)" }}>
            {t(lang, "Live stellen", "Go live")}
          </span>
          <button onClick={onClose} aria-label={t(lang, "Schließen", "Close")}
            style={{ background: "transparent", border: "none", color: "var(--ed-fg-3)", cursor: "pointer", display: "inline-flex", padding: 4 }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* ── The hosted path: the visible default ── */}
        <p style={{ margin: "0 0 4px", fontSize: 14, lineHeight: 1.55, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)", fontWeight: 600 }}>
          {t(lang, `Live auf {name}.${appsDomain} — nichts zu verbinden`, `Live at {name}.${appsDomain} — nothing to connect`)}
        </p>
        <p style={{ margin: "0 0 14px", fontSize: 12.5, lineHeight: 1.5, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)" }}>
          {t(lang,
            "Goblin hostet deine App selbst. Kein Konto bei einem anderen Anbieter, kein Token. Vor dem Veröffentlichen läuft eine automatische Prüfung.",
            "Goblin hosts your app itself. No account with another provider, no token. An automated check runs before publishing.")}
        </p>

        <label htmlFor="hosted-name" style={{ display: "block", fontSize: 12.5, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)", marginBottom: 6 }}>
          {t(lang, "Adresse", "Address")}
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            id="hosted-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(lang, "z. B. mein-laden", "e.g. my-shop")}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            data-testid="hosted-name"
            disabled={busy}
            style={{
              flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 9, boxSizing: "border-box",
              border: "1px solid var(--ed-rule)", background: "var(--ed-canvas)", color: "var(--ed-fg-1)",
              fontSize: 13, fontFamily: "var(--font-mono)", outline: "none",
            }}
          />
          <span style={{ fontSize: 12.5, color: "var(--ed-fg-3)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
            .{appsDomain}
          </span>
        </div>

        <div data-testid="hosted-name-state" style={{ marginTop: 6, fontSize: 12.5, fontFamily: "var(--font-sans)", minHeight: 18 }}>
          {nameState.kind === "checking" && <span style={{ color: "var(--ed-fg-3)" }}>{t(lang, "wird geprüft …", "checking …")}</span>}
          {nameState.kind === "free" && <span style={{ color: "#6db97b" }}>{t(lang, "Dieser Name ist frei.", "This name is free.")}</span>}
          {nameState.kind === "taken" && <span style={{ color: "var(--danger, #B0432A)" }}>{t(lang, "Dieser Name ist vergeben.", "This name is taken.")}</span>}
          {nameState.kind === "invalid" && <span style={{ color: "var(--danger, #B0432A)" }}>{t(lang, "Dieser Name geht nicht.", "This name will not work.")}</span>}
          {/* UNKNOWN is its own answer and never dressed as one of the other two. */}
          {nameState.kind === "unknown" && (
            <span style={{ color: "var(--ed-fg-3)" }}>
              {t(lang, "Konnte gerade nicht geprüft werden — beim Veröffentlichen entscheidet es sich.", "Could not be checked right now — publishing will settle it.")}
            </span>
          )}
        </div>

        <p style={{ margin: "6px 0 16px", fontSize: 11, lineHeight: 1.45, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)" }}>
          {t(lang,
            "Kleinbuchstaben, Ziffern und Bindestriche. Die Prüfung ist keine Reservierung — der Name gehört dir erst, wenn die App live ist.",
            "Lower-case letters, digits and hyphens. Checking is not reserving — the name is yours only once the app is live.")}
        </p>

        <button
          onClick={() => void publish()}
          disabled={!canPublish}
          data-testid="hosted-publish"
          style={{
            width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "11px 16px", borderRadius: 10, border: "none",
            background: canPublish ? "var(--ed-primary)" : "transparent",
            color: canPublish ? "var(--ed-on-primary)" : "var(--ed-fg-3)",
            fontSize: 14, fontWeight: 700, cursor: busy ? "wait" : canPublish ? "pointer" : "not-allowed",
            fontFamily: "var(--font-sans)",
          }}
        >
          {busy ? t(lang, "Veröffentliche …", "Publishing …") : <><Icon name="play" size={15} /> {t(lang, "Live stellen", "Go live")}</>}
        </button>

        {/* A disabled button always says why — no phantom affordance. */}
        {!canPublish && !busy && (
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)" }}>
            {!normalized
              ? t(lang, "Erst einen Namen eingeben.", "Enter a name first.")
              : nameState.kind === "taken"
                ? t(lang, "Dieser Name ist vergeben — bitte einen anderen.", "This name is taken — please pick another.")
                : nameState.kind === "invalid"
                  ? t(lang, "Dieser Name geht nicht.", "This name will not work.")
                  : t(lang, "Der Name wird noch geprüft.", "The name is still being checked.")}
          </p>
        )}

        {/* ── Outcomes ── */}
        {outcome.kind === "live" && (
          <div data-testid="hosted-live" style={{ marginTop: 14, fontSize: 13, lineHeight: 1.5, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)" }}>
            {t(lang, "Live.", "Live.")}{" "}
            {/* The server's verified URL, not a string this component built. */}
            <a href={outcome.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ed-accent)" }}>
              {outcome.url} ↗
            </a>
          </div>
        )}
        {outcome.kind === "review" && (
          <div data-testid="hosted-review" style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.55, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)" }}>
            {outcome.message}
          </div>
        )}
        {outcome.kind === "error" && (
          <div data-testid="hosted-error" style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.55, color: "var(--danger, #B0432A)", fontFamily: "var(--font-sans)" }}>
            {outcome.message}
          </div>
        )}

        {/* ── The Vercel path, beside it and fully intact ── */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--ed-rule)" }}>
          <button
            onClick={onUseVercel}
            disabled={busy}
            data-testid="hosted-use-vercel"
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              border: "1px solid var(--ed-rule)", background: "transparent", color: "var(--ed-fg-2)",
              fontSize: 13, fontWeight: 600, cursor: busy ? "wait" : "pointer", fontFamily: "var(--font-sans)",
            }}
          >
            {t(lang, "Eigenes Vercel verbinden (für Fortgeschrittene)", "Connect your own Vercel (advanced)")}
          </button>
          <p style={{ margin: "6px 0 0", fontSize: 11, lineHeight: 1.45, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)" }}>
            {t(lang,
              "Deine Seite läuft dann in deinem eigenen Vercel-Account — deine Deployments, deine Kosten, unter einer echten öffentlichen Adresse.",
              "Your site then runs in your own Vercel account — your deployments, your cost, at a real public address.")}
          </p>
        </div>
      </div>
    </>
  );
}
