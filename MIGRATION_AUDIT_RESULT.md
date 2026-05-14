# Migration Audit Result
**Datum:** 2026-05-14  
**Session:** 7 (Phase Y2)  
**Migrations gesamt:** 32 (0001–0032)  
**DB:** Supabase Production (ogrkollxnoawfdkzdmtn)

---

## Zusammenfassung

| Status | Anzahl |
|---|---|
| Tabellen fehlend (kritisch) | 6 |
| Tabellen fehlend (non-kritisch) | 0 |
| Spalten fehlend | 6 |
| Migrations ohne Drift | 26 |

---

## KRITISCHE DRIFTS — Fehlende Tabellen

### oauth_states (Migration 0007)
**Status:** FEHLT — 404  
**Impact:** KRITISCH — GitHub OAuth Login komplett broken wenn oauth_states fehlt  
**SQL:** In `APPLY_MIGRATIONS_SESSION.sql`

### push_subscriptions (Migrations 0012, 0015)  
**Status:** FEHLT — 404  
**Impact:** HOCH — Push-Notifications broken, aber kein Core-Feature  
**SQL:** In `APPLY_MIGRATIONS_SESSION.sql`

### free_api_usage (Migration 0008)
**Status:** FEHLT — 404  
**Impact:** MITTEL — Free-API-Pool-Tracking bricht ab. Backend wirft möglicherweise 500 bei INSERT. Code prüfen.  
**SQL:** In `APPLY_MIGRATIONS_SESSION.sql`

### build_runs (Migrations 0017, 0024)
**Status:** FEHLT — 404  
**Impact:** MITTEL — Build/Deploy-Tracking broken. Deploy-Route wirft 500 bei INSERT.  
**SQL:** In `APPLY_MIGRATIONS_SESSION.sql`

### templates (Migration 0020)
**Status:** FEHLT — 404  
**Impact:** MITTEL — Template-Marketplace-Feature nicht nutzbar  
**SQL:** In `APPLY_MIGRATIONS_SESSION.sql`

### incidents (Migration 0026)
**Status:** FEHLT — 404  
**Impact:** NIEDRIG — Status-Page-Incidents-Tracking fehlt  
**SQL:** In `APPLY_MIGRATIONS_SESSION.sql`

---

## DRIFTS — Fehlende Spalten

### users.github_connected_at (Migration 0003)
**Status:** FEHLT — SELECT gibt 400  
**Impact:** MITTEL — GitHub-connected_at Timestamp fehlt (github_username + github_access_token_encrypted existieren)

### users.has_seen_welcome + users.onboarding_step (Migration 0023)
**Status:** FEHLT — SELECT gibt 400  
**Impact:** NIEDRIG — Onboarding-State Flags (onboarding_completed existiert als Ersatz)

### users.is_admin + users.is_suspended (Migration 0025)
**Status:** FEHLT — SELECT gibt 400  
**Impact:** MITTEL — Admin-Funktionen und User-Suspension nicht implementierbar

### projects.last_deployed_at (Migrations 0016, 0027)
**Status:** FEHLT — SELECT gibt 400  
**Impact:** NIEDRIG — Deploy-Timestamp nicht sichtbar (preview_url existiert)

---

## GRÜNE DRIFTS — Existieren wie erwartet

| Tabelle | Status |
|---|---|
| users | ✅ (mit 4 fehlenden Spalten, s.o.) |
| projects | ✅ (mit 1 fehlenden Spalte) |
| byok_keys | ✅ (alle erwarteten Spalten incl. revoked_at) |
| code_injections | ✅ (leer, aber existent) |
| agent_runs | ✅ |
| chat_messages | ✅ |
| models | ✅ |
| onboarding_steps | ✅ |
| oauth_states | ❌ FEHLT |
| push_subscriptions | ❌ FEHLT |

---

## Migrations ohne Drift (grün)

0001, 0004, 0005, 0006, 0009, 0010, 0011, 0013, 0014, 0016 (preview_url OK), 0018, 0019, 0021, 0022, 0024 (dupliziert 0017), 0027 (preview_url OK), 0028, 0029, 0030, 0031, 0032

---

## Was Dario ausführen muss

**Datei:** `APPLY_MIGRATIONS_SESSION.sql`  
**Wo:** Supabase Studio → SQL Editor → Paste + Run  
**Risiko:** Alle Statements sind idempotent (IF NOT EXISTS / IF NOT EXISTS). Keine Daten werden gelöscht.  
**Erwartetes Ergebnis:** Alle 6 fehlenden Tabellen + 6 fehlende Spalten existieren danach.

---

## Kritischer Bug (separat): BYOK Decryption

Während dem Audit wurde ein separater kritischer Bug gefunden:
- `key_encrypted` ist BYTEA-Spalte
- PostgREST gibt BYTEA als `\x{hex}` zurück
- `decryptData()` erwartete base64 → alle BYOK-User konnten nicht streamen
- **FIX bereits in Session 7 deployed** (encryption.ts, Commit 020a0f7)
