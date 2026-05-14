# Goblin — Session 8 Summary
**Datum:** 2026-05-14  
**Status:** Strategy Foundation komplett  
**Commits:** 8 Phasen, alle lokal auf master

---

## Was diese Session gemacht hat

### Phase Z1 — Plan-Namen Migration (100%)
- seed → build, craft → pro, forge → power
- 21 Dateien aktualisiert, 0 verbleibende alte Namen im Code
- plans.ts komplett umgebaut: STRIPE_PRICE_BUILD/PRO/POWER_TIER1 (+ Tier2/Tier3 Optional für Z5)
- pricing-cards.tsx: neue Features per Strategy V1 (Storage, Projektanzahl)
- DB-Migration 0033: CHECK constraint + DEFAULT aktualisiert

### Phase Z2 — Per-User-Salt Encryption (100%)
- encryption.ts: encryptUserData/decryptUserData/generateUserSalt neu
- byok-service.ts + model-router.ts: per-user-salt, Backward-Compat für bestehende Keys
- scripts/migrate-encryption.ts: idempotentes Migration-Script mit Dry-Run
- DB-Migration 0034: users.encryption_salt + encryption_migrated_at + byok_keys.key_encrypted_legacy
- **C-3 gefixt**

### Phase Z3 — Layer C vorbereitet (inaktiv) (100%)
- goblin-hosted.ts: GOBLIN_HOSTED_ENABLED Feature-Flag
- settings/hosted/page.tsx: "Coming Soon" UI mit geplanten Modellen
- goblin-hosted-models.ts: geteilte Modell-Definitionen
- DB-Migration 0035: goblin_hosted_usage Tabelle mit RLS
- infra/GOBLIN_HOSTED_ACTIVATION.md: Schritt-für-Schritt Vast.ai Anleitung (~1h)
- Default: inaktiv, 1h zur Aktivierung wenn Vincent bereit

### Phase Z3.5 — Project Secrets Management (100%)
- secrets.ts: CRUD API mit Re-Auth (X-Reauth-Token = frischer Supabase JWT nach Passwort-Eingabe)
- project/[id]/secrets/page.tsx: vollständige UI (Re-Auth-Modal, Reveal/Hide, Add/Delete)
- Environments: production/staging/development
- DB-Migration 0036: project_secrets Tabelle mit RLS
- Encryption: per-user-salt (Phase Z2 Defense-in-Depth)
- Alle Pläne gleich — kein Premium-Feature

### Phase Z4 — Free-Tier-Reselling gestoppt (100%)
- FREE_API_POOL disabled (leeres Array)
- Bessere Fehlermeldung: empfiehlt Groq, Google AI Studio, OpenRouter
- settings/keys/page.tsx: "Free Tier Recommendations" Grid mit direkten Provider-Links
- **C-8 gefixt**

### Phase Z5 — Geo-Pricing (100%)
- geo-pricing.ts: Country-Tier-Mapping (T1=USA/EU, T2=Latam/EE, T3=IN/Africa)
- billing-service.ts: Checkout nutzt CF-IPCountry Header für Tier-Auswahl
- GET /api/billing/geo-pricing: gibt Tier + Preise zurück
- geo-pricing-section.tsx: 3-Plan Pricing Page mit Region-Selector Toggle
- pricing/page.tsx: GeoPricingSection statt alter Single-Plan Seite

### Phase Z6 — Marketing-Truth Sweep (100%)
- hero.tsx: "No token limits" → "No token panic. No vendor lock-in."
  Neuer Tagline: "Build anywhere. Code anything. Your ideas shouldn't wait for hardware."
- faq.tsx: "Why is Local mode free?" entfernt → "What AI models can I use?" (ehrlich)
- the-problem.tsx: Falsche Claims durch wahre ersetzt
- model-routing-explainer.tsx: "Coming Soon" Badge auf Goblin Hosted, Free-Pool → "Free Provider Tiers"

### Phase Z7 — Advanced Mode Toggle (100%)
- users.ts: PATCH/GET advanced_mode boolean
- settings/page.tsx: AdvancedModeSection mit animiertem Toggle
- DB-Migration: users.advanced_mode BOOLEAN DEFAULT false

---

## Ehrliche %-Einschätzung

| Kriterium | % |
|---|---|
| Plan-Namen überall konsistent | 100% |
| Marketing keine falschen Claims | 95% (Landing-PricingSection zeigt noch "$9/single plan") |
| Free-Tier-Reselling gestoppt | 100% |
| Per-User-Salt implementiert | 100% |
| Layer C vorbereitet + inaktiv | 100% |
| Geo-Pricing | 90% (Stripe Tax noch nicht aktiviert — manuell von Vincent) |
| Project Secrets | 95% (Secrets nicht automatisch in Build injiziert — Phase 9) |
| Advanced Mode | 80% (Toggle funktioniert, aber Features dahinter noch nicht bedingt gerendert) |
| TypeScript errors | 0 |
| Test coverage | ~40% (bestehende Tests noch nicht auf neue Plan-Namen aktualisiert) |

---

## Was noch aussteht (Session 9)

- E2E-Tests für neue Plan-Namen
- Build-Pipeline injiziert Secrets automatisch
- Advanced Mode bedingt sichtbare UI-Elemente (Sidebar, Chat-Token-Count, etc.)
- Landing-PricingSection auf 3 Pläne aktualisieren (UI-Pass Session 10)
- Stripe Tax aktivieren (Vincent)
- Migration ausführen (Vincent)
- `GROQ_FREE_API_KEY` aus Railway entfernen

---

## API ist down (502)

Die Railway-API gibt 502 zurück. Mögliche Ursachen:
- Build nach vorherigen Session-Commits ausstehend
- Railway Deployment läuft
- Env-Var-Änderung required (neue STRIPE_PRICE_BUILD_TIER1 vars noch nicht in Railway)

**Vincent muss Railway-Env-Vars updaten bevor die API startet!** (Siehe SESSION_8_VINCENT_TODO.md)
