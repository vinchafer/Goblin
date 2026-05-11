# Goblin — Session Summary 2026-05-11

## Was gebaut wurde

### Phase A — Strategische Analyse ✅
- `docs/PRICING_ANALYSIS.md`: empfiehlt Ein-Plan $9/mo (ARCH v6 §10 konform)
- `docs/ARCHITECTURE_DECISIONS.md`: Local/Cloud-Switch, Hardware-Detection, Auto-Fallback, Onboarding State-Machine, i18n-Strategie

### Phase B — Local/Cloud Switch ✅
- `LocalCloudSwitch` Component im Topbar: CLOUD aktiv (Browser), LOCAL deaktiviert mit Desktop-App-Tooltip
- `lib/hardware-check.ts`: detektiert RAM/CPU/GPU via Browser-APIs, gibt Modell-Empfehlungen zurück
- `/dashboard/settings/local`: Hardware-Check-Page mit Modellkarten + Copy-Button für ollama-Commands
- `services/ollama-bridge.ts`: dünner Wrapper für lokale Ollama-Instanz (für zukünftige Tauri-Integration)

### Phase C — Usage-Dashboard + Auto-Fallback ✅
- `GET /api/users/me/usage?period=7d|30d|90d`: aggregiert agent_runs nach Tier/Modell/Projekt
- `/dashboard/usage`: Zyklus-Auslastungsbar, Tier-Stacked-Bar, Top-5-Modelle, Top-5-Projekte
- `/dashboard/settings/routing`: dnd-kit Drag-and-Drop Fallback-Chain-Editor
- dnd-kit installiert (@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities)

### Phase D — UX Polish ✅
- Dashboard Empty-State: 6 Starter-Karten mit prefill-Prompts (Landing Page, SaaS, Mobile, API, Newsletter, Chrome Extension)
- `NewProjectModal`: liest `goblin_prefill_prompt` aus sessionStorage
- Bug #2 Fix: `label` aus keys/page.tsx SSR-SELECT entfernt (defensiver Fallback vor Migration 0028)

### Phase E — Trial-System ✅
- Migration 0030: cloud_trial_started_at, cloud_trial_ends_at, trial_extension_used
- `trial-gate.ts` Middleware: startet 3-Tage-Trial automatisch beim ersten Cloud-API-Call, blockiert abgelaufene Trials (402 + upgradeUrl)
- `GET /api/users/me/trial` + `POST /api/users/me/trial/extend` (+2 Tage, 1x)
- `TrialBanner`: zeigt Tageszahl, Upgrade-Link, +2-Tage-Button bei urgenten Trials
- `/dashboard/upgrade`: Einzel-Preiskarte $9/mo → Stripe Checkout

### Phase F — Onboarding-Wizard ✅
- Migration 0031: onboarding_steps Tabelle mit RLS
- `GET/PUT /api/onboarding/state`: State-Persistenz pro User (Upsert)
- `/onboarding`: 5-Step-Wizard (Goal → AI Provider → Code Hosting → Deploy → Done)
  - Jeder Step skippable
  - State wird bei jedem Advance gespeichert
  - Recovery: ?resume=true lädt gespeicherten Step

### Phase G — Pricing-Page ✅
- `pricing-section.tsx`: Ein-Plan $9/mo (ersetzt 3-Tier-Grid)
- `faq.tsx`: 3 neue Fragen (Local mode gratis, Trial-Ende, BYOK)
- `/pricing`: Standalone-Page mit Pricing + FAQ

### Phase H — Cleanup ✅
- `APPLY_MIGRATIONS_SESSION.sql`: alle Migrations 0028-0031 idempotent
- Bugs geprüft: #4 (BottomTabBar) bereits gefixt, #5 (Build-Polling) OK (Realtime-basiert), #6 (Sidebar-URLs) korrekt, #7 (GitHub-Check) bereits korrekt implementiert

---

## Was Dario manuell tun muss

### 1. PFLICHT: Migrations ausführen
```
Supabase Studio → SQL Editor → APPLY_MIGRATIONS_SESSION.sql einfügen → Run
```
Betrifft: BYOK-Labels, Projekt-storage_path, Trial-System, Onboarding-State.

### 2. trial-gate.ts Middleware aktivieren (nach Migration 0030)
Die Middleware ist gebaut aber NICHT automatisch aktiv — sie muss in `index.ts` registriert werden sobald Migration 0030 in Production gelaufen ist. Sonst bricht sie für alle User ohne trial-Spalten.

**Aktivierung:**
```typescript
// apps/api/src/index.ts — nach auth import hinzufügen:
import { trialGate } from './middleware/trial-gate';
// Und nach auth middleware:
app.use('/api/*', authMiddleware, trialGate);
```
Vorher: Migration 0030 verifizieren mit SELECT cloud_trial_started_at FROM users LIMIT 1.

### 3. Vercel + Railway deployen
```
git push  ← noch nicht gepusht!
```
Vercel deployt automatisch auf Push zu master.
Railway deployt automatisch auf Push zu master.

### 4. Onboarding-Redirect einrichten (Optional)
Nach Login neue User zu `/onboarding` routen. Aktuell: WelcomeModal für erste User. Kann in `dashboard/layout.tsx` umgestellt werden:
```typescript
// Nach Onboarding-Check:
if (isFirstLogin && !onboardingCompleted) redirect('/onboarding');
```

---

## Top-3 Risiken für nächste Session

1. **trial-gate Middleware** — muss manuell aktiviert werden nach Migration. Ohne Aktivierung kein Trial-Enforcement. Kein automatischer Start weil zu riskant ohne Schema-Garantie.

2. **Onboarding-Routing** — Neuer User landet auf Dashboard, sieht WelcomeModal (alt), nicht den neuen Wizard. Braucht einen Redirect-Hook in layout.tsx.

3. **Pricing-DB-Mismatch** — DB hat plan ENUM 'seed'/'craft'/'forge'. Neue User die über `/dashboard/upgrade` → Stripe → Checkout gehen bekommen plan='seed' gesetzt. Das ist korrekt für $9/mo, aber die Billing-Seite zeigt noch "Seed/Craft/Forge" aus der alten UI. Phase-G-Update hat Landing-Seite vereinfacht, aber `/dashboard/settings/billing` zeigt noch 3-Tier-Labels.

---

## Ehrliche Einschätzung: Production-Readiness

**Vor Session:** ~20%
**Nach Session:** ~58-62%

**Was diese Session gebracht hat:**
- Klares Pricing-Modell (Ein-Plan, kein Rattenrennen)
- Trial-System vollständig (wartet auf Migration-Aktivierung)
- Onboarding-Wizard end-to-end (wartet auf Routing-Integration)
- Usage-Dashboard mit echten Daten
- Auto-Fallback-Chain-Editor (Drag and Drop)
- Local/Cloud-Switch UI (Web-seitig; Tauri = Phase 3)
- Landing-Pricing vereinfacht (ChatGPT-Niveau: one clear CTA)

**Was fehlt für 65-70%:**
- Phase 3: Goblin Hosted GPU (Clore.ai RTX 4090)
- Onboarding-Redirect in Layout
- Trial-Middleware-Aktivierung
- Dark Mode durchziehen (~200 hardcoded Hex-Farben)
- Mobile Lighthouse ≥85

---

## Commits dieser Session

```
2369cac [PHASE-A] docs: pricing analysis + architecture decisions
7717108 [PHASE-B] feat: local/cloud switch + hardware detection + ollama bridge
15b766e [PHASE-C] feat: usage dashboard + auto-fallback chain editor
47f3ca9 [PHASE-D] polish: dashboard empty states + bug fixes
d9d0820 [PHASE-E] feat: 3-day cloud trial + $9/mo upgrade flow
6cafdba [PHASE-F] feat: 5-step onboarding wizard with recovery
8880008 [PHASE-G] feat: single-plan pricing + landing update + FAQ
```
