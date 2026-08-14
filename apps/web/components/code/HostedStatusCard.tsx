"use client";

/**
 * AKT 2 · PHASE 5 · U5.3 — the owner's status card. [DESIGN-SENSITIVE]
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * THE ONE RULE THIS COMPONENT EXISTS TO KEEP: there is no code path here that
 * renders a state without the time it was measured. Not one. `stateLine()` takes
 * the state and the timestamp together and refuses to produce a sentence without
 * both — so "erreichbar" on its own is not something a careless edit can produce,
 * it is something the function cannot return.
 *
 * Every competitor's status widget is a green dot. A green dot is a claim with no
 * date on it, which makes it unfalsifiable, which makes it worthless. Ours reads
 * "Zuletzt geprüft 14:02 — erreichbar", and when we have not looked recently it
 * says so instead of staying green.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * ── UNKNOWN is not an error state ───────────────────────────────────────────────
 * It gets its own dashed, colourless treatment — the same visual language as the
 * founder console's UNBEKANNT pill and the inbox's unreadable state. It is
 * emphatically NOT red: "we do not know" is not "it is broken", and dressing it as
 * an alarm would train the owner to ignore alarms.
 *
 * ── The debounce is stated, not hidden ──────────────────────────────────────────
 * A single failed check shows as `eingeschränkt`, and the card SAYS that "nicht
 * erreichbar" requires two failures in a row. An undisclosed delay is a lie about
 * freshness; disclosing it costs one sentence.
 *
 * ── Mobile first, 390px ─────────────────────────────────────────────────────────
 * Every row is a block, nothing needs hover, nothing is a table.
 */

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useLang, t } from "@/lib/use-lang";

type Lang = "de" | "en";
type State = "healthy" | "degraded" | "down" | "unknown";
type Reason = "never_checked" | "stale" | "inconclusive" | "all_ok" | "mixed" | "sustained_failure";

interface SubjectState {
  subjectKey: string;
  state: State;
  reason: Reason;
  measuredAt: string | null;
  lastOutcome: string | null;
  samples: number;
}

interface CheckLine {
  subjectKey: string;
  outcome: string;
  httpStatus: number | null;
  latencyMs: number | null;
  measuredAt: string;
}

interface StatusBody {
  available: boolean;
  appName: string;
  registryStatus: string;
  entry: SubjectState;
  formStore: SubjectState | null;
  uptime: {
    ratio: number | null;
    measured: number;
    ok: number;
    inconclusive: number;
    coveredMs: number;
    windowMs: number;
  };
  recent: CheckLine[];
  cadenceMinutes: number;
  generatedAt: string;
}

type View =
  | { kind: "loading" }
  /** We could not ask at all. Distinct from "we asked and nothing is known yet". */
  | { kind: "unreachable"; message: string }
  | { kind: "ready"; body: StatusBody };

/** Time of day, which is what "zuletzt geprüft 14:02" means to a person. */
function clockTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(lang === "de" ? "de-DE" : "en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Full stamp for a measurement that is not from today's last few minutes. */
function fullStamp(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === "de" ? "de-DE" : "en-GB", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

/** "vor 3 Minuten" — an age, so a stale timestamp reads as stale at a glance. */
export function ageLabel(iso: string, now: number, lang: Lang): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const mins = Math.max(0, Math.round((now - then) / 60_000));
  if (mins < 1) return t(lang, "gerade eben", "just now");
  if (mins < 60) return t(lang, `vor ${mins} Min.`, `${mins} min ago`);
  const hours = Math.round(mins / 60);
  if (hours < 24) return t(lang, `vor ${hours} Std.`, `${hours} h ago`);
  return t(lang, `vor ${Math.round(hours / 24)} Tagen`, `${Math.round(hours / 24)} days ago`);
}

/** Coverage as something a person reads, for "gemessen über …". */
export function spanLabel(ms: number, lang: Lang): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return t(lang, "weniger als eine Stunde", "less than an hour");
  if (hours < 48) return t(lang, `${hours} Stunden`, `${hours} hours`);
  return t(lang, `${Math.floor(hours / 24)} Tage`, `${Math.floor(hours / 24)} days`);
}

/**
 * THE sentence — state and measurement time, together, always.
 *
 * The signature is the guarantee: there is no way to ask this function for a state
 * without handing it the time, and no branch returns a state word on its own. A
 * measurement time of `null` is only reachable for `never_checked`, which produces
 * a sentence that makes no claim about the app at all.
 */
export function stateLine(state: State, reason: Reason, measuredAt: string | null, now: number, lang: Lang): string {
  if (measuredAt === null) {
    return t(lang,
      "Noch nie geprüft. Sobald Goblin das erste Mal nachgesehen hat, steht das Ergebnis hier.",
      "Never checked yet. As soon as Goblin has looked once, the result appears here.");
  }
  const when = clockTime(measuredAt, lang);
  const age = ageLabel(measuredAt, now, lang);

  if (state === "unknown") {
    // Never a green, never a red, and never silent about which kind of blindness
    // this is: a gap in the checks and a check that came back inconclusive are
    // different things and lead somewhere different.
    if (reason === "stale") {
      return t(lang,
        `Wir wissen es gerade nicht. Zuletzt geprüft ${when} (${age}) — seitdem ist keine Prüfung durchgekommen. Das heißt NICHT, dass etwas kaputt ist; es heißt, dass wir nicht nachgesehen haben.`,
        `We do not know right now. Last checked ${when} (${age}) — no check has come through since. That does NOT mean something is broken; it means we have not looked.`);
    }
    return t(lang,
      `Wir wissen es gerade nicht. Die Prüfung um ${when} kam zu keinem Ergebnis — das lag an uns, nicht an deiner App.`,
      `We do not know right now. The check at ${when} reached no verdict — that was on us, not on your app.`);
  }
  if (state === "healthy") {
    return t(lang, `Zuletzt geprüft ${when} — erreichbar.`, `Last checked ${when} — reachable.`);
  }
  if (state === "degraded") {
    return t(lang,
      `Zuletzt geprüft ${when} — eingeschränkt. Eine Prüfung ist fehlgeschlagen.`,
      `Last checked ${when} — impaired. One check failed.`);
  }
  return t(lang,
    `Zuletzt geprüft ${when} — nicht erreichbar. Zwei Prüfungen hintereinander sind fehlgeschlagen.`,
    `Last checked ${when} — not reachable. Two checks in a row failed.`);
}

/** Colour by state. UNKNOWN is deliberately colourless — it is not an alarm. */
function tone(state: State): { fg: string; border: string; dashed: boolean } {
  switch (state) {
    case "healthy":
      return { fg: "var(--ed-accent)", border: "var(--ed-rule)", dashed: false };
    case "degraded":
      return { fg: "var(--warning, #B07A2A)", border: "var(--warning, #B07A2A)", dashed: false };
    case "down":
      return { fg: "var(--danger, #B0432A)", border: "var(--danger, #B0432A)", dashed: false };
    default:
      return { fg: "var(--ed-fg-3)", border: "var(--ed-fg-3)", dashed: true };
  }
}

export function HostedStatusCard({ appId }: { appId: string }) {
  const lang = useLang() as Lang;
  const [view, setView] = useState<View>({ kind: "loading" });
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const body = await apiGet<StatusBody>(`/api/ops/apps/${appId}/status`);
      setNow(Date.now());
      if (!body) throw new Error("empty");
      setView({ kind: "ready", body });
    } catch {
      setView({
        kind: "unreachable",
        message: t(lang,
          "Der Zustand liess sich gerade nicht abrufen. Das sagt nichts darüber, ob deine App läuft — wir konnten nur nicht nachsehen.",
          "The status could not be fetched just now. That says nothing about whether your app is running — we simply could not look."),
      });
    }
  }, [appId, lang]);

  useEffect(() => { void load(); }, [load]);

  const card: React.CSSProperties = {
    marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--ed-rule)", fontFamily: "var(--font-sans)",
  };

  if (view.kind === "loading") {
    return (
      <div style={card} data-testid="hosted-status-loading">
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ed-fg-3)" }}>{t(lang, "Zustand wird geladen …", "Loading status …")}</p>
      </div>
    );
  }

  if (view.kind === "unreachable") {
    return (
      <div style={card} data-testid="hosted-status-unreachable">
        <div style={{ border: "1px dashed var(--ed-fg-3)", borderRadius: 12, padding: 12, fontSize: 12.5, lineHeight: 1.5, color: "var(--ed-fg-3)" }}>
          {view.message}
          <button
            onClick={() => void load()}
            style={{ display: "block", marginTop: 8, background: "transparent", border: "none", padding: 0, color: "var(--ed-accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}
          >
            {t(lang, "Nochmal versuchen", "Try again")}
          </button>
        </div>
      </div>
    );
  }

  const { body } = view;
  const entryTone = tone(body.entry.state);
  const uptime = body.uptime;

  return (
    <div style={card} data-testid="hosted-status-card">
      <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--ed-fg-1)" }}>
        {t(lang, "Zustand", "Status")}
      </p>

      {/* The store itself could not be read. Its own words, not an empty card. */}
      {!body.available && (
        <div
          data-testid="hosted-status-store-unavailable"
          style={{ border: "1px dashed var(--ed-fg-3)", borderRadius: 12, padding: 12, marginBottom: 10, fontSize: 12, lineHeight: 1.5, color: "var(--ed-fg-3)" }}
        >
          {t(lang,
            "Die Prüfergebnisse liessen sich nicht lesen. Was unten steht, ist deshalb UNBEKANNT — nicht „alles in Ordnung“.",
            "The check results could not be read. What follows is therefore UNKNOWN — not “all fine”.")}
        </div>
      )}

      {/* ── The state, with its measurement time. Never one without the other. ── */}
      <div
        data-testid="hosted-status-entry"
        style={{
          border: `1px ${entryTone.dashed ? "dashed" : "solid"} ${entryTone.border}`,
          borderRadius: 12, padding: "12px 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span
            aria-hidden
            style={{
              width: 9, height: 9, borderRadius: "50%",
              background: entryTone.dashed ? "transparent" : entryTone.fg,
              border: entryTone.dashed ? `1px dashed ${entryTone.fg}` : "none",
              flexShrink: 0,
            }}
          />
          <span data-testid="hosted-status-word" style={{ fontSize: 13, fontWeight: 700, color: entryTone.fg }}>
            {body.entry.state === "healthy" ? t(lang, "Erreichbar", "Reachable")
              : body.entry.state === "degraded" ? t(lang, "Eingeschränkt", "Impaired")
              : body.entry.state === "down" ? t(lang, "Nicht erreichbar", "Not reachable")
              : t(lang, "UNBEKANNT", "UNKNOWN")}
          </span>
        </div>
        <p data-testid="hosted-status-line" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--ed-fg-2)" }}>
          {stateLine(body.entry.state, body.entry.reason, body.entry.measuredAt, now, lang)}
        </p>
      </div>

      {/* ── The 7-day number: measured, with its sample count, or honestly absent ── */}
      <p data-testid="hosted-status-uptime" style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.55, color: "var(--ed-fg-3)" }}>
        {uptime.ratio === null
          ? t(lang,
              `Für eine Erreichbarkeits-Quote reichen die Daten noch nicht — gemessen über ${spanLabel(uptime.coveredMs, lang)}, ${uptime.measured} Prüfungen.`,
              `Not enough data for an availability figure yet — measured over ${spanLabel(uptime.coveredMs, lang)}, ${uptime.measured} checks.`)
          : t(lang,
              `Erreichbar in ${(uptime.ratio * 100).toFixed(1).replace(".", ",")} % der Prüfungen — aus ${uptime.measured} Messungen über ${spanLabel(uptime.coveredMs, lang)}.`,
              `Reachable in ${(uptime.ratio * 100).toFixed(1)} % of checks — from ${uptime.measured} measurements over ${spanLabel(uptime.coveredMs, lang)}.`)}
        {uptime.inconclusive > 0 && (
          <>
            {" "}
            {/* The exclusion that would otherwise flatter the number, said out loud. */}
            {t(lang,
              `${uptime.inconclusive} Prüfungen kamen zu keinem Ergebnis und zählen nicht mit.`,
              `${uptime.inconclusive} checks reached no verdict and are not counted.`)}
          </>
        )}
      </p>

      {/* ── The form store, only for apps that have one ── */}
      {body.formStore && (
        <p data-testid="hosted-status-formstore" style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.55, color: "var(--ed-fg-3)" }}>
          {t(lang, "Formular-Speicher: ", "Form storage: ")}
          {stateLine(body.formStore.state, body.formStore.reason, body.formStore.measuredAt, now, lang)}
        </p>
      )}

      {/* ── The last few measurements, each with its own time ── */}
      {body.recent.length > 0 && (
        <ul data-testid="hosted-status-recent" style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
          {body.recent.map((line, i) => (
            <li
              key={`${line.subjectKey}-${line.measuredAt}-${i}`}
              style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11.5, color: "var(--ed-fg-3)", padding: "3px 0" }}
            >
              <span>{fullStamp(line.measuredAt, lang)}</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {line.outcome === "ok" ? t(lang, "erreichbar", "reachable")
                  : line.outcome === "warn" ? t(lang, "Warnung", "warning")
                  : line.outcome === "fail" ? t(lang, "fehlgeschlagen", "failed")
                  : t(lang, "kein Ergebnis", "no verdict")}
                {line.httpStatus !== null ? ` · ${line.httpStatus}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* ── The two things the owner must know to read the card correctly ── */}
      <p style={{ margin: "10px 0 0", fontSize: 11, lineHeight: 1.5, color: "var(--ed-fg-3)" }}>
        {t(lang,
          `Goblin sieht etwa alle ${body.cadenceMinutes} Minuten nach. Ein einzelner Ausfall wird als „eingeschränkt“ gezeigt; „nicht erreichbar“ steht erst, wenn zwei Prüfungen hintereinander fehlgeschlagen sind — damit ein kurzer Aussetzer nicht als Ausfall gemeldet wird.`,
          `Goblin looks roughly every ${body.cadenceMinutes} minutes. A single failure shows as “impaired”; “not reachable” appears only after two consecutive failed checks — so a brief blip is not reported as an outage.`)}
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 11, lineHeight: 1.5, color: "var(--ed-fg-3)" }}>
        {t(lang,
          "Hier steht nur, was gemessen wurde. Zwischen zwei Prüfungen weiss Goblin nichts — und sagt dann UNBEKANNT statt zu raten.",
          "This shows only what was measured. Between two checks Goblin knows nothing — and then says UNKNOWN instead of guessing.")}
      </p>
    </div>
  );
}
