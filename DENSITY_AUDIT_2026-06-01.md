# Density Audit — Sprint 7 (2026-06-01)

Goal: settle the long-standing "übergross" feeling. Sprint 5 located the real lever
as **spacing + heading weight**, not font tokens. Sprint 6 deferred. This is the
Sprint-7 pass — deliberately **compressed** per §12(c), see "Honest scope" below.

## Method
Walked surfaces at 1280 via CDP. Screenshots in `sprint-7/density-audit/`.
Reference band — where Goblin should sit ("calm dense"):
- Linear: dense, heading weight ≤ 600.
- Vercel: medium, 600 for h2–h3.
- Claude.ai: medium-airy, 500–600.

## Findings per surface

| Surface | State | Verdict |
|---|---|---|
| **Project hub** (`/dashboard/project/[id]`) | rendered clean | Already calm-dense. Card headers 15px/600, padding 14–18px, good rhythm. **No change needed** — prior sprints largely tuned this. |
| **Pricing** (marketing) | rendered clean | Generous on purpose; marketing breathing room is correct. **Leave as-is** (§9.2: keep `--space-9` for marketing). |
| **Dashboard** (`/dashboard`) | client shell stuck on "Workspace wird geladen" in the CDP/headless session | Could not walk reliably tonight. The one app-level heading style it uses (`.section-title`) was **18px/700** — heavier than the calm-dense band. **Softened to 600.** |
| **Settings** (`/dashboard/settings/*`) | same loader gate | Could not walk reliably. Deferred (see below). |

## Applied
- `globals.css .section-title`: `font-weight: 700 → 600`. The canonical, lowest-risk
  "calm dense" move; the project hub already uses 600 for its card headers, so this
  brings the dashboard section headings into line with the rest of the system.
  **No blanket spacing replacement** — per §9.2, per-screen judgment, and the hub
  did not warrant tightening.

## Honest scope (why compressed)
1. The clearly-rendered app surface (project hub) was already at the target density —
   so the headline "übergross" worry is, on evidence, largely resolved by Sprints 5–6.
2. `/dashboard` and `/dashboard/settings/*` are client shells that did not advance
   past the workspace-loading splash in the headless CDP session, so I could not
   produce trustworthy before/after evidence for them. Rather than blanket-edit
   spacing tokens **blind** (explicitly warned against in §16), I made only the one
   change I could justify from rendered evidence + the design system, and documented
   the rest as a quick founder-side follow-up.

## Founder follow-up (low effort, when you can walk the screens live)
- Eyeball `/dashboard` and each `/dashboard/settings/*` sub-section at 1280 + 390.
- If a list area still feels tall: `--space-6 → --space-5` in that specific list,
  and any remaining 700-weight card headings → 600. Per-screen, not global.
