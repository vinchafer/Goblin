# Goblin Design Vision V1
**Session 9A.5 — Phase 0**
**Date:** 2026-05-14

---

## Reference Benchmark

| Tool | What Goblin borrows |
|---|---|
| **Linear.app** | Settings sidebar hierarchy, dense information, keyboard-shortcut culture |
| **claude.ai** | Sidebar collapse/expand, sticky User menu bottom, clean empty states |
| **Vercel Dashboard** | Light-mode primary, usage cards, tab navigation, project list density |
| **Cursor** | Code-editor integration feel, bottom bar |
| **GitHub** | Auth: multi-provider equal weight, Settings: logical grouping |

---

## 5 Design Principles

### 1. Information density over whitespace
Goblin is a developer tool. Whitespace signals hierarchy — not emptiness. An empty page is a broken page. Every screen has an empty state with value.

### 2. Light mode is the default. Dark mode is premium-opt-in.
We optimize for builders who code in cafés, offices, in the sun. Default to cream/white surfaces. Dark mode is available and fully supported but not imposed.

### 3. Brand color as accent, not wallpaper
Moss Green marks exactly one thing per screen: the primary action or the active state. Ochre marks exactly one accent element. Neither color should appear more than twice on any screen.

### 4. Every screen has one obvious next action
There is always a clear primary CTA. Secondary actions are subtle. Tertiary actions are hidden until needed. No competing calls-to-action.

### 5. Goblin has personality, not clutter
The Goblin mark appears in the logo and loading states. Nowhere else. Tone is professional-but-human. We can be slightly cheeky in empty states. We cannot be juvenile in data-critical screens (billing, settings, auth).

---

## What Goblin Is (Visual Personality)

- **Professional + approachable**: Like a very competent junior dev who is also good company
- **Mobile-first but not mobile-only**: Desktop experience is full-featured, not an afterthought
- **Global builder tool**: Cream/white surfaces work in all lighting conditions
- **Honest about being a solo product**: We don't fake enterprise complexity. We solve focused problems cleanly.

---

## Structural Problems Diagnosed (Pre-9A.5)

| Problem | Root Cause | Fix |
|---|---|---|
| Footer unreadable | `var(--moss)` bg + `rgba(255,255,255,0.35)` text = ~2:1 contrast | Light footer bg |
| Hero unreadable in sun | Hardcoded `#0f1410` | Offer light hero OR fix contrast to >7:1 |
| Auth dark | Fine aesthetically, but password field lacks show/hide | Add show/hide toggle |
| Sidebar too basic | 220px, no collapse, no Chats, emoji icons | Full sidebar redesign |
| Settings hierarchy wrong | Developer as tab under Account | Move to Advanced section (adv mode only) |
| Dashboard CTA weak | "New Project" is ghost button, small, top-right | Prominent button in sidebar + in-content |
| Workspace whitespace | No empty states in Chat/Code/Preview tabs | Add meaningful empty states |

---

## Token System (Semantic)

The goal is 0 hardcoded hex values in component code. All colors via CSS variables.

**Surfaces:** `--cream` (page bg), `--panel` (card bg), `--subtle` (recessed)
**Text:** `--text` (primary), `--text-2` (secondary), `--meta` (captions)
**Borders:** `--border` (subtle), `--div` (dividers)
**Brand:** `--moss` (primary action), `--ochre` (single accent per screen)
**Status:** `--success`, `--error`, `--warning`

---

## Iteration Plan

- **Iteration 1 (9A.5):** All 7 phases. 8-10h.
- **Stop after Iteration 1:** Self-critique + screenshots. Wait for Vincent.
- **Iteration 2 (9A.6):** Only if Vincent approves + scores < 8 in 3+ categories.
- **Hard stop after Iteration 2:** Honest assessment, external designer recommendation if needed.
