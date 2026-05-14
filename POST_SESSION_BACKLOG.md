# Post-Session 7 Backlog
**Erstellt:** 2026-05-14  
**Basis:** DUE_DILIGENCE_REPORT.md (Opus 4.7)

---

## CRITICAL — Vor ersten paying customers beheben

### C-1: GitHub OAuth broken (oauth_states Tabelle fehlt)
**Aufwand:** 15 Min (SQL) + Test  
**Fix:** `APPLY_MIGRATIONS_SESSION.sql` ausführen → oauth_states Tabelle wird erstellt  
**Dario-Aktion erforderlich:** Ja (Supabase Studio)

### C-3: Encryption Salt statisch (Per-Tenant-Salt fehlt)
**Aufwand:** ~1 Tag + Key-Migration-Script  
**Fix:** AWS KMS oder per-user-salt in byok_keys; Migration aller bestehenden Keys  
**Risiko:** Breaking change für existing BYOK-Keys

### C-8: Free-Pool TOS-Verletzung (Groq/Cerebras Free-Keys für Multi-User)
**Aufwand:** Entscheidung (Upgrade zu kommerziellen Keys oder Free-Pool-Limit)  
**Fix:** Entweder Groq Business-Account oder pro-User Free-Pool-Limit einbauen

---

## MAJOR — Vor Launch-Push beheben

### M-1: Kein 2FA / Account-Lockout / Session-Timeout
**Aufwand:** 2-3 Tage  
**Fix:** Supabase MFA aktivieren + Session-Timeout-Config

### M-3: In-Memory Rate-Limiting
**Aufwand:** 1 Tag  
**Fix:** Redis-backed rate limiting (Railway Redis Add-on)

### M-5: 120s Timeout blockiert Hono-Worker
**Aufwand:** 4 Stunden  
**Fix:** Per-Request Timeout 30s + Retry-Logic im Frontend

### M-6: Inline-Styles ohne Design-System
**Aufwand:** 3-5 Tage  
**Fix:** CSS Modules oder Tailwind konsequent; alle inline-style-Objekte entfernen

### M-8: 4 API-Routen backed-by-fehlender-Tabelle
**Aufwand:** 30 Min (nach Migration-SQL-Ausführung)  
**Fix:** `APPLY_MIGRATIONS_SESSION.sql` ausführen (build_runs, templates, incidents)

### M-9: BYOK-Validation Code-Duplikation (8 fast-identische Switch-Cases)
**Aufwand:** 3 Stunden  
**Fix:** Provider-Config-Map + generische validate()-Funktion

### M-11: agent_runs.update fire-and-forget
**Aufwand:** 2 Stunden  
**Fix:** .throwOnError() + structured error logging

### M-12: users.is_admin / is_suspended fehlen
**Aufwand:** 15 Min (SQL in APPLY_MIGRATIONS_SESSION.sql bereits enthalten)  
**Fix:** Dario: APPLY_MIGRATIONS_SESSION.sql ausführen

---

## OPERATIONS — Vor erster Marketing-Kampagne

- Sentry DSN in Railway + Vercel setzen (PRODUCTION_CHECKLIST.md:55-56)
- Uptime-Monitoring (BetterUptime, Cronitor oder ähnlich)
- Health-Endpoint-Alarm bei degraded-Status

---

## PRODUCT — Series-A-Pfad

- Eval-Pipeline für Code-Generation-Qualität
- Differentiation Story: Entweder Local-Inference-USP oder Vertikal (z.B. Stripe-MVP-Fokus)
- Co-Founder mit Production-Engineering-Background
- GTM: Newsletter, Discord, Content-Engine

---

## Was diese Session NICHT gefixt hat (und warum)

| Issue | Grund für Skip |
|---|---|
| C-3 Static Salt | Breaking change — Key-Migration-Script nötig, >2h |
| M-1 2FA | Supabase MFA-Config + Frontend-Integration, >1 Tag |
| M-3 Redis Rate-Limit | Railway Redis nötig, kein Zugang in Session |
| M-6 Inline-Styles-Refactor | 3-5 Tage, Scope zu groß |
| Goblin Hosted (toter Code) | GPU-Infrastruktur-Entscheidung — strategisch, nicht technisch |
