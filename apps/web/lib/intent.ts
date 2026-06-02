// Convergence (Sprint 10, Slice 1) — Project Intent.
//
// Intent is the ONE question asked at creation. It sets the DEFAULT FOREGROUND of
// the Code Tab — never a mode, never a capability gate. Every tool is present and
// reachable under every intent; intent only decides what's foregrounded on first
// paint ("One Canvas, Progressive Reach"). Changeable later via the quiet
// "Layout wechseln" affordance on the project hub.

import type { ComponentType } from "react";
import { Browsers, SquaresFour, GithubLogo, Compass } from "@phosphor-icons/react";

export type Intent = "landing_page" | "web_app" | "import_repo" | "exploring";

export const DEFAULT_INTENT: Intent = "exploring";

export interface IntentDef {
  id: Intent;
  label: string;
  sub: string;
  icon: ComponentType<{ size?: number; weight?: "regular" | "duotone" | "fill" | "bold" }>;
  /** import_repo's actual import step ships Sprint 11; the intent is selectable now. */
  comingSoon?: boolean;
}

/** Display order in the create flow / layout switcher (default last). */
export const INTENTS: IntentDef[] = [
  { id: "landing_page", label: "Landing Page / Website", sub: "Eine Seite, die Besucher überzeugt.", icon: Browsers },
  { id: "web_app",      label: "Web-App",                sub: "Eine App mit mehreren Seiten und Logik.", icon: SquaresFour },
  { id: "import_repo",  label: "Code importieren",        sub: "Bestehender Code aus GitHub holen.", icon: GithubLogo, comingSoon: true },
  { id: "exploring",    label: "Nicht sicher / Ausprobieren", sub: "Du entscheidest später.", icon: Compass },
];

export function intentDef(intent: Intent | null | undefined): IntentDef {
  return INTENTS.find((i) => i.id === intent) ?? INTENTS[INTENTS.length - 1]!;
}

// ── Layout preset: first-paint foreground only ──────────────────────────────
// NOT a restriction. After mount the user can widen/collapse panels freely and
// those choices persist (per-session) — intent just sets where things start.
export interface LayoutPreset {
  /** Thread (composer + chat) column width %, desktop. Lower = editor-forward. */
  threadPct: number;
  /** Which column fills the mobile single-column on first paint. */
  mobileDefault: "thread" | "editor";
  /** Foreground the file tree rail (Sofia's reach) on first paint. */
  showTree: boolean;
}

const PRESETS: Record<Intent, LayoutPreset> = {
  // Max-forward: composer prominent, editor secondary, no tree, lands on thread.
  landing_page: { threadPct: 50, mobileDefault: "thread", showTree: false },
  exploring:    { threadPct: 46, mobileDefault: "thread", showTree: false },
  // Sofia-forward: editor prominent, tree visible, lands on editor.
  web_app:      { threadPct: 34, mobileDefault: "editor", showTree: true },
  import_repo:  { threadPct: 32, mobileDefault: "editor", showTree: true },
};

export function layoutPreset(intent: Intent | null | undefined): LayoutPreset {
  return PRESETS[intent ?? DEFAULT_INTENT] ?? PRESETS[DEFAULT_INTENT];
}

// ── localStorage hint ───────────────────────────────────────────────────────
// The DB is the source of truth, but migration 0057 may not be applied yet on the
// target DB. We stash the chosen intent locally on create / switch so the Code-Tab
// foreground is correct immediately; the persisted DB value wins once it exists.
const KEY = (projectId: string) => `goblin_intent_${projectId}`;

export function getStoredIntent(projectId: string): Intent | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY(projectId));
  return v && INTENTS.some((i) => i.id === v) ? (v as Intent) : null;
}

export function setStoredIntent(projectId: string, intent: Intent): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY(projectId), intent); } catch { /* quota — non-fatal */ }
}
