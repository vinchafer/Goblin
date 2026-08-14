"use client";

/**
 * AKT 2 · PHASE 4 · U4.4 — the owner's inbox.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * THIS IS SOMEBODY ELSE'S PERSONAL DATA, shown to the person responsible for it.
 * The people in this list never agreed to anything with Goblin: they filled in a
 * form on somebody's website. That is why the delete paths are real deletes, why
 * the export exists, and why nothing here is clever.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * ── The empty state and the error state are DIFFERENT THINGS ─────────────────
 * `available: false` from the API means "we could not read the inbox", and it is
 * rendered as a warning with its own colour and its own sentence. `total: 0` means
 * "we looked, and nothing has arrived", and it is rendered as a calm, plain card.
 * Collapsing the two — the silent-empty-card defect this codebase has met before —
 * would tell an owner their form is quiet when in fact nobody could look. The
 * precedent is why this component has two separate branches that share no styling.
 *
 * ── Mobile first, 390px ──────────────────────────────────────────────────────
 * The founder operates from a phone and so will the builders. Every row is a card,
 * not a table cell; the actions are full-width taps; nothing needs a hover.
 */

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { API_URL, apiGet, apiPost, getAuthHeaders } from "@/lib/api";
import { useLang, t } from "@/lib/use-lang";

interface Submission {
  id: string;
  formId: string;
  createdAt: string;
  fields: Record<string, string>;
  readAt: string | null;
}

interface InboxBody {
  available: boolean;
  message?: string;
  total?: number;
  monthlyCap?: number;
  acceptedThisMonth?: number | null;
  notifications?: boolean;
  submissions?: Submission[];
}

/**
 * What the sheet knows. `unknown` is a first-class state and never renders as an
 * empty inbox — the whole point of the branch split above.
 */
type State =
  | { kind: "loading" }
  | { kind: "unknown"; message: string }
  | { kind: "ready"; body: Required<Pick<InboxBody, "total" | "submissions">> & InboxBody };

interface Props {
  appId: string;
  appName: string;
  onClose: () => void;
}

function formatWhen(iso: string, lang: "de" | "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === "de" ? "de-DE" : "en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function HostedInboxSheet({ appId, appName, onClose }: Props) {
  const lang = useLang();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  /** The delete-everything confirmation is a two-step, in the sheet, not a browser dialog. */
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const body = await apiGet<InboxBody>(`/api/ops/apps/${appId}/submissions`);
      if (!body?.available) {
        setState({
          kind: "unknown",
          message:
            body?.message ??
            t(lang,
              "Der Posteingang liess sich gerade nicht lesen. Das heißt NICHT, dass nichts da ist — wir konnten nur nicht nachsehen.",
              "The inbox could not be read just now. That does NOT mean nothing is there — we simply could not look."),
        });
        return;
      }
      setState({ kind: "ready", body: { ...body, total: body.total ?? 0, submissions: body.submissions ?? [] } });
    } catch {
      setState({
        kind: "unknown",
        message: t(lang,
          "Der Posteingang liess sich gerade nicht laden. Das heißt NICHT, dass nichts da ist.",
          "The inbox could not be loaded just now. That does NOT mean nothing is there."),
      });
    }
  }, [appId, lang]);

  useEffect(() => { void load(); }, [load]);

  const markRead = useCallback(async (id: string) => {
    setBusy(id);
    try {
      await apiPost(`/api/ops/apps/${appId}/submissions/${id}/read`);
      await load();
    } catch {
      setNotice(t(lang, "Das liess sich gerade nicht speichern.", "That could not be saved just now."));
    } finally { setBusy(null); }
  }, [appId, lang, load]);

  const removeOne = useCallback(async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`${API_URL}/api/ops/apps/${appId}/submissions/${id}`, {
        method: "DELETE", headers: await getAuthHeaders(),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setNotice(t(lang, "Das liess sich gerade nicht löschen.", "That could not be deleted just now."));
    } finally { setBusy(null); }
  }, [appId, lang, load]);

  const removeAll = useCallback(async () => {
    setBusy("all");
    try {
      // The confirm token is the server's guard, not this component's: a stray
      // request cannot empty somebody's inbox even if this UI is bypassed.
      const res = await fetch(`${API_URL}/api/ops/apps/${appId}/submissions?confirm=ALLES-LOESCHEN`, {
        method: "DELETE", headers: await getAuthHeaders(),
      });
      if (!res.ok) throw new Error();
      setConfirmingAll(false);
      await load();
    } catch {
      setNotice(t(lang, "Es liess sich gerade nichts löschen.", "Nothing could be deleted just now."));
    } finally { setBusy(null); }
  }, [appId, lang, load]);

  const exportCsv = useCallback(async () => {
    setBusy("csv");
    try {
      const res = await fetch(`${API_URL}/api/ops/apps/${appId}/submissions.csv`, { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error();
      // The header the API sets rather than an assumption: an export that was cut
      // short says so instead of looking complete.
      if (res.headers.get("x-goblin-export-truncated") === "true") {
        setNotice(t(lang,
          "Der Export enthält die ältesten 5.000 Einsendungen — es sind mehr da.",
          "The export contains the oldest 5,000 submissions — there are more."));
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `einsendungen-${appName}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice(t(lang, "Der Export liess sich gerade nicht erstellen.", "The export could not be created just now."));
    } finally { setBusy(null); }
  }, [appId, appName, lang]);

  const toggleNotifications = useCallback(async (next: boolean) => {
    setBusy("notify");
    try {
      await apiPost(`/api/ops/apps/${appId}/notifications`, { enabled: next });
      await load();
    } catch {
      setNotice(t(lang, "Die Einstellung liess sich gerade nicht speichern.", "The setting could not be saved just now."));
    } finally { setBusy(null); }
  }, [appId, lang, load]);

  const card: React.CSSProperties = {
    border: "1px solid var(--ed-rule)", borderRadius: 12, padding: "12px 14px",
    background: "var(--ed-canvas)", marginBottom: 10,
  };

  return (
    <>
      <div
        style={{ position: "absolute", inset: 0, zIndex: 86, background: "var(--surface-overlay, rgba(0,0,0,0.4))" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={t(lang, "Posteingang", "Inbox")}
        data-testid="hosted-inbox-sheet"
        style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          background: "var(--ed-chrome-2)", border: "1px solid var(--ed-rule)", borderRadius: 16,
          padding: "20px 18px 18px", zIndex: 87, width: "min(390px, calc(100% - 24px))",
          maxHeight: "calc(100dvh - 48px)", overflow: "auto",
          boxShadow: "0 20px 48px rgba(15,43,30,0.3)", fontFamily: "var(--font-sans)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: "var(--ed-fg-1)" }}>
            {t(lang, "Posteingang", "Inbox")}
          </span>
          <button onClick={onClose} aria-label={t(lang, "Schließen", "Close")}
            style={{ background: "transparent", border: "none", color: "var(--ed-fg-3)", cursor: "pointer", display: "inline-flex", padding: 4 }}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--ed-fg-3)" }}>{appName}</p>

        {state.kind === "loading" && (
          <p data-testid="inbox-loading" style={{ fontSize: 13, color: "var(--ed-fg-3)" }}>
            {t(lang, "Wird geladen …", "Loading …")}
          </p>
        )}

        {/* UNKNOWN. Its own colour, its own words. Never an empty inbox. */}
        {state.kind === "unknown" && (
          <div
            data-testid="inbox-unknown"
            style={{
              border: "1px dashed var(--danger, #B0432A)", borderRadius: 12, padding: "14px",
              fontSize: 13, lineHeight: 1.5, color: "var(--danger, #B0432A)",
            }}
          >
            {state.message}
            <button onClick={() => void load()}
              style={{ display: "block", marginTop: 10, background: "transparent", border: "none", padding: 0,
                color: "var(--ed-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
              {t(lang, "Nochmal versuchen", "Try again")}
            </button>
          </div>
        )}

        {state.kind === "ready" && (
          <>
            {/* The honest empty state — calm, not alarming, and not the same card. */}
            {state.body.total === 0 ? (
              <div data-testid="inbox-empty" style={{ ...card, textAlign: "center", padding: "22px 14px" }}>
                <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: "var(--ed-fg-1)" }}>
                  {t(lang, "Noch keine Einsendungen.", "No submissions yet.")}
                </p>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--ed-fg-3)" }}>
                  {t(lang,
                    "Das Formular ist eingerichtet und nimmt entgegen. Sobald jemand etwas abschickt, steht es hier.",
                    "The form is set up and accepting. As soon as somebody sends something, it appears here.")}
                </p>
              </div>
            ) : (
              <ul data-testid="inbox-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {state.body.submissions.map((s) => (
                  <li key={s.id} data-testid="inbox-item" style={{ ...card, borderLeft: s.readAt ? undefined : "3px solid var(--ed-accent)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11.5, color: "var(--ed-fg-3)" }}>{formatWhen(s.createdAt, lang)}</span>
                      <span style={{ fontSize: 11.5, color: "var(--ed-fg-3)", fontFamily: "var(--font-mono)" }}>{s.formId}</span>
                    </div>
                    {Object.entries(s.fields).map(([key, value]) => (
                      <div key={key} style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 11, color: "var(--ed-fg-3)" }}>{key}</div>
                        <div style={{ fontSize: 13.5, color: "var(--ed-fg-1)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{value}</div>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
                      {!s.readAt && (
                        <button onClick={() => void markRead(s.id)} disabled={busy === s.id} data-testid="inbox-mark-read"
                          style={{ background: "transparent", border: "none", padding: 0, color: "var(--ed-accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                          {t(lang, "Als gelesen markieren", "Mark as read")}
                        </button>
                      )}
                      <button onClick={() => void removeOne(s.id)} disabled={busy === s.id} data-testid="inbox-delete-one"
                        style={{ background: "transparent", border: "none", padding: 0, color: "var(--danger, #B0432A)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                        {t(lang, "Löschen", "Delete")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* The month, as a measured number — never a bar that implies a forecast. */}
            <p style={{ margin: "12px 0 0", fontSize: 11.5, lineHeight: 1.5, color: "var(--ed-fg-3)" }}>
              {state.body.acceptedThisMonth === null || state.body.acceptedThisMonth === undefined
                ? t(lang,
                    "Wie viele Einsendungen dieser Monat hatte, liess sich gerade nicht feststellen.",
                    "How many submissions this month has had could not be established just now.")
                : t(lang,
                    `${state.body.acceptedThisMonth} von ${state.body.monthlyCap ?? "?"} Einsendungen in diesem Monat.`,
                    `${state.body.acceptedThisMonth} of ${state.body.monthlyCap ?? "?"} submissions this month.`)}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              <button onClick={() => void exportCsv()} disabled={busy === "csv" || state.body.total === 0} data-testid="inbox-export"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--ed-rule)",
                  background: "transparent", color: state.body.total === 0 ? "var(--ed-fg-3)" : "var(--ed-fg-2)",
                  fontSize: 13, fontWeight: 600, cursor: state.body.total === 0 ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)",
                }}>
                {t(lang, "Als CSV exportieren", "Export as CSV")}
              </button>

              <button onClick={() => void toggleNotifications(!state.body.notifications)} disabled={busy === "notify"} data-testid="inbox-notify-toggle"
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--ed-rule)",
                  background: "transparent", color: "var(--ed-fg-2)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)",
                }}>
                {state.body.notifications
                  ? t(lang, "E-Mails bei neuen Einsendungen: an", "E-mails for new submissions: on")
                  : t(lang, "E-Mails bei neuen Einsendungen: aus", "E-mails for new submissions: off")}
              </button>

              {state.body.total > 0 && !confirmingAll && (
                <button onClick={() => setConfirmingAll(true)} data-testid="inbox-delete-all"
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--ed-rule)",
                    background: "transparent", color: "var(--danger, #B0432A)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)",
                  }}>
                  {t(lang, "Alle Einsendungen löschen", "Delete all submissions")}
                </button>
              )}

              {confirmingAll && (
                <div data-testid="inbox-delete-all-confirm" style={{ border: "1px solid var(--danger, #B0432A)", borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.5, color: "var(--ed-fg-1)" }}>
                    {t(lang,
                      `Das löscht alle ${state.body.total} Einsendungen dieser App — endgültig, für dich und für Goblin. Exportiere sie vorher, wenn du sie behalten willst.`,
                      `This deletes all ${state.body.total} submissions of this app — permanently, for you and for Goblin. Export them first if you want to keep them.`)}
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => void removeAll()} disabled={busy === "all"} data-testid="inbox-delete-all-yes"
                      style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: "none", background: "var(--danger, #B0432A)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                      {busy === "all" ? t(lang, "Löscht …", "Deleting …") : t(lang, "Ja, alle löschen", "Yes, delete all")}
                    </button>
                    <button onClick={() => setConfirmingAll(false)}
                      style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: "1px solid var(--ed-rule)", background: "transparent", color: "var(--ed-fg-2)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                      {t(lang, "Abbrechen", "Cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <p style={{ margin: "14px 0 0", paddingTop: 12, borderTop: "1px solid var(--ed-rule)", fontSize: 11, lineHeight: 1.5, color: "var(--ed-fg-3)" }}>
              {t(lang,
                "Diese Nachrichten haben fremde Menschen in dein Formular geschrieben. Goblin hat den Inhalt nicht geprüft. Du bist dafür verantwortlich, was damit passiert — und du kannst sie hier jederzeit löschen.",
                "Strangers wrote these messages into your form. Goblin has not checked the content. You are responsible for what happens to it — and you can delete it here at any time.")}
            </p>
          </>
        )}

        {notice && (
          <p data-testid="inbox-notice" style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--danger, #B0432A)" }}>{notice}</p>
        )}
      </div>
    </>
  );
}
