# GOBLIN — Strategy V1 (FINAL)
**Datum:** 2026-05-14
**Status:** EINGEFROREN — Basis für Sessions 8-10
**Founder:** Vincent (Solo, Schweiz)
**Mission:** Build with AI from anywhere — kein Laptop, keine Token-Panik, keine Provider-Abhängigkeit.

---

## 1. Mission Statement

> **"Build anywhere. Code anything. Your ideas shouldn't wait for hardware."**

**Sub-Promise:** Hardware-frei. Provider-frei. Mobil. Du erschaffst, wir machen es möglich.

---

## 2. Zielgruppen

### Primary Persona
**Max in Berlin** — 31, Content Manager, Side-Project Builder.
- Hat Claude Pro + ChatGPT Plus (~$40/Monat), hits Token-Limits regelmäßig
- Will bauen, kein Hardcore-Developer
- Akzeptiert $9/Monat für unlimited-feel

### Secondary Personas
**Maria in São Paulo** — 25, beginnt zu programmieren.
- Kann sich keine $20-Tools leisten
- Hat altes Notebook + neueres Handy
- Akzeptiert $4/Monat wenn echtes Tool

**Arjun in Bangalore** — 28, CS-Absolvent, baut SaaS nebenher.
- Preissensitiv aber technikaffin
- Akzeptiert $3/Monat wenn Quality stimmt

### Doppelter Anspruch: Anfänger UND Senior Devs
- **Default-Modus** = Anfänger-friendly (Setup Buddy, klare Settings, geführt)
- **Power-Modus** (Toggle "Show Advanced" in Settings) schaltet frei:
  - Direktes Editieren von `.env` Files
  - Custom Model-Routing per Project
  - Keyboard-Shortcuts wie in Cursor
  - Eigene LiteLLM-Config
  - CLI-Access für Git/npm/etc.
  - API-Endpoint-Debugging-Tools

---

## 3. Pricing (FINAL)

### Plan-Struktur: Build / Pro / Power

| Plan | Tier 1 (USA/EU/CH) | Tier 2 (Latam/EE) | Tier 3 (Indien/Africa) | Goblin-Hosted (Phase 2) | Storage |
|---|---|---|---|---|---|
| **Build** | $9 | $4 | $3 | 3.000 Calls/Monat* | 5 GB |
| **Pro** | $19 | $9 | $6 | 10.000 Calls/Monat* | 20 GB |
| **Power** | $39 | $19 | $12 | Unlimited Fair-Use* | 100 GB |

*Layer C (Goblin-Hosted) ist vorbereitet aber **nicht aktiv** in Phase 1. UI zeigt "Coming Soon". User-Vorteil aktuell: BYOK-Routing + Free-Tier-Empfehlungen + Mobile-Excellence + Storage.

**Pricing-Floor:** $3 — nirgendwo drunter.

### Geo-Pricing-Logik via Stripe
- **Stripe-Geo-Detection** via Kreditkarten-Land (nicht primär IP — schützt vor VPN)
- **Tier 1:** USA, EU, UK, Australia, Canada, Japan, Singapur, Schweiz, Norwegen
- **Tier 2:** Latam, Eastern Europe, Türkei, Südafrika, Südostasien (außer Singapur)
- **Tier 3:** Indien, Pakistan, Bangladesh, Nigeria, Kenia, Sub-Sahara
- **Default:** Tier 1 wenn nicht erkennbar

### Plan-Differenzierung

**Was unterscheidet die Plans (Phase 1, ohne Layer C aktiv):**
- ✅ **Storage** (5GB / 20GB / 100GB)
- ✅ **Anzahl Projekte** (10 / 50 / Unlimited)
- ✅ **Goblin-Hosted Fair-Use** (wenn Layer C aktiv, vorbereitet)
- ✅ **Bessere Modelle in Goblin-Hosted** (wenn aktiv: Pro/Power bekommen Llama 70B zusätzlich)

**Was NICHT unterscheidet (alle Pläne gleich):**
- ❌ Feature-Set — Mobile, BYOK, Send-to-Code, GitHub-Push, Vercel-Deploy, Env-Files, Advanced-Mode-Toggle
- ❌ Support — alle Community-Support
- ❌ Env-Files-Management — alle bekommen das gleiche Modell

**Begründung:** Vincent zahlt nicht für Feature-Entwicklung, nur für Variable Costs (GPU-Compute wenn Layer C aktiv, Storage, Stripe-Gebühren). Wo es Vincent etwas kostet → höherer Plan. Wo nicht → für alle gleich.

**Phase 1 (ohne Layer C):** Hauptdifferenzierung läuft über Storage + Anzahl Projekte. Bei Pro/Power kompensieren wir die noch fehlende Layer C durch mehr Cloud-Storage + Unlimited Projekte.

### Trial-Mechanik
- **3 Tage Cloud-Trial** mit voller Funktionalität (keine Kreditkarte nötig)
- **300 Calls/Tag Limit** während Trial (Burn-Schutz)
- Nach Tag 3: **Upgrade-Pflicht ODER Lokal-Mode-Only** (wenn Tauri verfügbar)

### Local-Mode (Phase 2, Sessions 11+)
- **Tauri Desktop App** mit Local-Mode bleibt **gratis** für immer
- User mit Local-Mode bekommt: BYOK, Free-Tier-Empfehlungen, lokale Storage/Inference (via Ollama)
- User mit Local-Mode bekommt NICHT: Goblin-Hosted-Modelle, Cloud-Storage, Mobile-Sync, Push-Notifications
- **Local-Mode = Funnel zu Mobile-Subscription** (User lernt Goblin kennen, will später Mobile)

### Stripe-Setup (Schweiz)
- **Einzelfirma in CH für Phase 1** (bis CHF 100k Jahresumsatz, keine MWST-Pflicht)
- **Stripe Switzerland** mit allen Payment-Methoden:
  - Kreditkarten (Visa, Mastercard, Amex)
  - Google Pay
  - Apple Pay
  - PayPal (via Stripe)
  - SEPA für EU
- **Stripe-Gebühren typisch:** 2.9% + $0.30 (USA/EU), 4.3% (Indien)
- **Stripe Tax** automatische Geo-Detection und Tax-Calculation

---

## 4. Layer-Architektur (FINAL — Vincents Definition)

### Layer A — BYOK (Bring Your Own Key)
**Zweck:** User nutzt eigenen Provider-Account direkt durch Goblin

**Setup:**
- User loggt sich ein, hinterlegt einen Key von **welchem Provider auch immer**
- Unterstützte Provider: Anthropic, OpenAI, Google AI Studio, Mistral, xAI/Grok, DeepSeek, Together.ai, Fireworks, Groq, OpenRouter, Custom OpenAI-compatible
- **Setup-Buddy berät** bei Auswahl basierend auf User-Goal
- **Goblin verdient nichts** an Token-Margin
- **Goblin verdient an Plattform-Subscription**

**Beispiel:** Max hat Claude Pro mit $20/Monat. Er gibt seinen Anthropic-Key in Goblin ein. Goblin routet seine Calls über seinen Key. Anthropic billed Max direkt.

### Layer B — Free-Tier-Empfehlungen (User-Eigene Keys)
**Zweck:** User profitiert von Provider-Free-Tiers ohne Token-Kosten

**Setup:**
- Goblin **empfiehlt** Groq, Google AI Studio, OpenRouter Free-Tiers
- User hinterlegt **EIGENEN Free-Tier-Key** (sein eigener Account, nicht Goblin's)
- **Goblin macht KEIN Reselling**
- User profitiert von Free-Tier (z.B. 1.500 Gemini Flash Requests/Tag gratis)

**Beispiel:** Maria erstellt einen Groq-Account (gratis), holt sich ihren Free-Tier-Key, fügt ihn in Goblin ein. Sie kann Llama 3.3 70B kostenlos nutzen (innerhalb Groq's Limits).

### Layer C — Goblin-Hosted Fallback-Modelle (VORBEREITET, NICHT AKTIV)
**Zweck:** Wenn User keine eigenen Keys hat oder seine Token aufgebraucht sind, gibt's Goblin's eigene Hosted-Modelle

**Status Phase 1:** **NICHT AKTIV** — Cash-Burn vermeiden bis erste User Traction zeigen oder Funding kommt.

**Vollständig vorbereitet in Code:**
- Settings-UI mit "Coming Soon" Badge für Goblin-Hosted Models
- Backend-Routes existieren als Stubs (returnen "service_unavailable")
- DB-Schema komplett (goblin_hosted_usage Tabelle, Fair-Use-Tracking)
- LiteLLM-Config-Slot reserviert
- Health-Check-Endpunkt mit `disabled` Status
- Feature-Flag `GOBLIN_HOSTED_ENABLED=false` in Env

**Aktivierung in einer Mini-Session (~1h):**
- Feature-Flag auf `true` setzen
- Vast.ai-Instance starten (RTX 3060 ~$30/mo oder RTX 4090 ~$130/mo)
- `GOBLIN_HOSTED_URL` + `GOBLIN_HOSTED_API_KEY` in Railway eintragen
- vLLM-Container mit Qwen Coder 14B starten
- Health-Check grün → UI zeigt Layer C als aktiv
- **Innerhalb 1h von Entscheidung zu Live**

**Geplante Plan-Differenzierung (wenn aktiv):**
- Build: 3.000 Goblin-Hosted-Calls/Monat (Qwen Coder 14B)
- Pro: 10.000 Calls/Monat (Qwen Coder 14B + Llama 3.3 70B)
- Power: Unlimited Fair-Use (alle Modelle inkl. zukünftige Premium-Modelle)

**Trigger zur Aktivierung:**
- Vincent hat Funding ODER
- 30+ zahlende User signalisieren Bedarf nach Layer C ODER
- BYOK-Adoption-Rate ist <50% (User wollen ohne eigene Keys arbeiten)

**Routing (wenn aktiv):**
- Goblin-API → LiteLLM → Vast.ai-Endpoint
- Bei busy GPU: Queue (max 20s) → Fehler mit BYOK-Vorschlag
- Goblin-Hosted = Fallback wenn User keine eigenen Keys hat

---

## 5. Marketing-Truth — Was wir sagen vs. NICHT sagen

### ✅ Sagen wir (sobald Session 8 fertig)
- "Open-source models, hosted by us" — Qwen Coder 14B auf Vast.ai läuft ab Session 8 live
- "Build from your phone" — PWA funktioniert
- "No token panic" — Fair-Use ist transparent kommuniziert
- "Bring your own AI" — BYOK funktioniert
- "Works on any device with internet"
- "Free open-source models when you need them"

### ❌ Sagen wir NICHT (sofort entfernen)
- ❌ "Local mode" / "Free local" — bis Tauri Desktop steht (Sessions 11+)
- ❌ "Unlimited" ohne "Fair Use"-Qualifier
- ❌ "DeepSeek R1 hosted" — wir hosten R1 nicht (zu groß für unsere GPU)
- ❌ "Llama 70B hosted" — bis 2. GPU live (Phase 2)
- ❌ Konkrete Performance-Claims ohne Benchmarks

### Konkrete Marketing-Fixes (Session 8)
1. Landing-Page: alle Aussagen prüfen gegen diese Liste
2. Pricing-Page: Build/Pro/Power mit Geo-Pricing-Hinweis
3. FAQ: "What models do you support?" — ehrlich beantworten
4. Twitter/Social Bio: Update zu neuer Positionierung
5. Hero-Section: "Build anywhere..." Statement prominent

---

## 6. Mobile-Coding-Excellence (Phase 1 Ziel)

**Vision:** Das beste Mobile-Coding-Tool das es gibt.

**Konkrete Features bis Session 10:**
- CodeMirror 6 mit Touch-Gestures (Swipe für Indent, Long-Press, Pinch-Zoom)
- Floating-Toolbar über Keyboard (Tab, Save, Find, Replace immer einen Tap entfernt)
- Voice-Input für längere Code-Anweisungen
- Snippet-Library mobile verfügbar
- Multi-File-Tab-Switcher mit Swipe
- Diff-View Mobile-optimiert
- Preview-Tab mit Viewport-Switcher (Mobile 375px / Tablet / Desktop)
- Live-Preview via Vercel-Deploy oder iframe

---

## 7. Operations & Compliance

### Bus-Factor (Vincent Solo)
**Mitigation Sessions 8-10:**
- Disaster-Recovery-Docs (was wenn Vincent down ist)
- Operations-Runbook (deploy, rollback, log)
- Bus-Factor-Insurance:
  - Stripe-Account → Recovery-Email-Plan
  - Domain → Backup-Owner-Email
  - Critical-Credentials → 1Password mit Trusted-Contact
  - Server-Backups → automatisierte Off-Site-Snapshots
- Phase 2: Trusted Advisor mit Emergency-Access

**Hire-Roadmap (Phase 2):**
- Bis $5-10k MRR Solo
- Dann: 1 Hire (Senior Full-Stack + DevOps)
- Bei $25k MRR: Co-Founder-Suche aktivieren

### IT Security (Critical, ab Session 8)
- **Per-User-Salt** für BYOK-Encryption (Migration aller existing Keys)
- **Supabase MFA** für Cloud-Mode
- **Redis-Rate-Limiting** (statt In-Memory)
- **Session-Timeout** konfigurieren
- **Pen-Test** bei $5k MRR (extern, ~$3k)
- **Secrets-Audit** quartalsweise

### Financial Accounting
- **Phase 1:** Notion/Sheets, Stripe-Reports
- **Phase 2 (ab $2k MRR):** Bexio (CH) für Buchhaltung
- **Phase 3:** Steuerberater + GmbH-Setup

### Compliance
- **GDPR:** EU-Hosting (Cloudflare EU, Backblaze EU-Central-003, Supabase EU-Frankfurt)
- **Stripe Tax:** Automatische VAT-Handling
- **EU AI-Act:** "AI-generated content" Labels überall
- **TOS Free-Provider:** Free-Tier-Pool deaktiviert — User braucht eigene Free-Tier-Keys
- **Schweizer DSG:** Adapted Privacy Policy

---

## 8. Env-Files & Secret-Management (Session 8 — alle Plans gleich)

**Problem:** Wenn User in Goblin Code schreibt der `.env`-Secrets braucht, wo liegen die?

**Lösung (alle Pläne gleich — kein Tier-Unterschied):**

**Standard für alle Plans (Build / Pro / Power):**
- Settings → Project Secrets pro Projekt
- User gibt sein Login-Passwort erneut ein um Secrets-Section zu öffnen (Double-Auth-Layer)
- Secrets werden verschlüsselt gespeichert (per-User-Salt KMS-Envelope)
- Secrets pro Project, nicht global
- Secrets werden bei Build/Deploy automatisch injected (env-Variables im Runtime)
- Secrets werden NIE in Git committed (auto-add zu .gitignore)
- Secrets-View zeigt nur Hint (z.B. "sk-...abc4") nicht Klartext
- Edit/Delete mit Re-Authentication

**Power-User-Feature (Advanced Mode, nicht Plan-gebunden):**
- Doppler/Infisical-OAuth-Integration für Multi-Environment-Secrets möglich
- Production/Staging/Dev-Trennung
- Aktivierbar via Advanced-Mode-Toggle in Settings

**Wichtig:** **Env-Files-Management ist KEIN Premium-Feature.** Maria in São Paulo bekommt das gleiche wie Vincent. Anders gesagt: ein Build-User kann Stripe-Keys, Anthropic-Keys, DB-URLs etc. genau so verwalten wie ein Power-User.

---

## 9. Roadmap Sessions 8-10

### Session 8: "Strategy Foundation"
**Ziele:**
- Apply Migrations (Vincent manuell in Supabase Studio)
- Marketing-Truth-Sweep (alle falschen Claims raus)
- Build/Pro/Power Plan-Namen + Geo-Pricing in Stripe
- Layer C Setup: Vast.ai RTX 3060 mit Qwen Coder 14B
- Fair-Use-Tracking pro User
- Per-User-Salt (Critical C-3 fix)
- Free-Tier-Reselling stoppen (Critical C-8 fix)
- Goblin-Hosted-Marketing aktualisieren (C-7 fix)

### Session 9: "Polish + Quality Foundation"
**Ziele:**
- Eval-Framework für Modell-Performance-Tracking
- Smart Routing (best model for THIS task)
- Mobile Lighthouse ≥90 auf allen Hauptseiten
- Power-Mode-Toggle (Advanced Settings für Devs)
- Env-Files / Secret-Management (Standard-Implementation)
- Disaster-Recovery-Docs
- Operations-Runbook

### Session 10: "Pre-Investor Polish + DD V2"
**Ziele:**
- Full Monitoring (Sentry + Uptime + Cost-Tracking)
- UI/UX 3-4 Levels höher (Vincent's "120% happy")
- DD-Bericht V2 (Opus, harter Standard)
- Fixes auf V2-Bericht-CRITICAL
- Final Production-Readiness-Audit
- Mobile-Coding-Excellence komplett

**Nach Session 10:**
- DD V2 sollte sagen: CONDITIONAL 25-40M Series A
- Live-Beta für 50-100 User möglich
- Klare Story für Investoren
- Sessions 11-14: Tauri Desktop + Mobile-Apps

---

## 10. Was Vincent JETZT manuell tun muss (vor Session 8)

1. **`APPLY_MIGRATIONS_SESSION.sql` in Supabase Studio ausführen** (15 min)
   - Behebt: oauth_states, free_api_usage, push_subscriptions, build_runs, templates, incidents Tabellen
   - + fehlende Spalten in users + projects

2. **Vast.ai Account erstellen** (10 min)
   - Vast.ai Sign-up
   - $30-50 Credits einzahlen (Tom-Up)
   - Optional: Bevorzugte Region (EU für Latency)

3. **Stripe-Tax aktivieren** (5 min)
   - Stripe Dashboard → Tax → Enable
   - Für automatische Geo-Pricing in Session 8

---

## 11. Eingefroren — Änderungen nur via Strategy V2

Diese Strategie ist verbindlich für Sessions 8-10. Änderungen daran erfordern explizit ein Update zu Strategy V2 mit Vincents Bestätigung.

**Session 8 wird auf Basis dieser Strategy gebaut.**
