# Session 8 — Vincent's Manual TODOs
**Priorität:** CRITICAL (API ist down bis Env-Vars gesetzt sind)

---

## 1. CRITICAL: Railway Env-Vars aktualisieren (API bootet nicht ohne diese)

### Neue Vars hinzufügen in Railway:
```
STRIPE_PRICE_BUILD_TIER1=price_1TX0OfLFeloHeQzLuBlXHhnK
STRIPE_PRICE_BUILD_TIER2=price_1TX0buLFeloHeQzLqPvv2ukx
STRIPE_PRICE_BUILD_TIER3=price_1TX0buLFeloHeQzLKaHdMxQf

STRIPE_PRICE_PRO_TIER1=price_1TX0fyLFeloHeQzLExSpC2Ve
STRIPE_PRICE_PRO_TIER2=price_1TX0fyLFeloHeQzLA2AkH8AR
STRIPE_PRICE_PRO_TIER3=price_1TX0fyLFeloHeQzLyHBOg4tV

STRIPE_PRICE_POWER_TIER1=price_1TX0hwLFeloHeQzLjR6Dtk1U
STRIPE_PRICE_POWER_TIER2=price_1TX0hwLFeloHeQzLQLJVXAww
STRIPE_PRICE_POWER_TIER3=price_1TX0hwLFeloHeQzL50L9M82v

GOBLIN_HOSTED_ENABLED=false
```

### Alte Vars entfernen aus Railway:
```
STRIPE_PRICE_SEED      ← LÖSCHEN
STRIPE_PRICE_CRAFT     ← LÖSCHEN
STRIPE_PRICE_FORGE     ← LÖSCHEN
GOOGLE_FREE_API_KEY    ← LÖSCHEN (C-8 fix)
CEREBRAS_FREE_API_KEY  ← LÖSCHEN (C-8 fix)
OPENROUTER_FREE_API_KEY ← LÖSCHEN (C-8 fix)
GROQ_FREE_API_KEY      ← Vorerst lassen für Testing, VOR Test-User-Phase löschen
```

### Vercel Env-Vars (Frontend):
```
NEXT_PUBLIC_GOBLIN_HOSTED_ENABLED=false
```

---

## 2. CRITICAL: APPLY_MIGRATIONS_SESSION.sql ausführen

In Supabase Studio → SQL Editor:

```sql
-- Führe ALLE Sections aus (Section 10-14 sind neu in Session 8)
```

Öffne die Datei `APPLY_MIGRATIONS_SESSION.sql` und führe sie vollständig aus.

**Neue Sections in Session 8:**
- Section 10: Plan-Namen rename (seed→build, craft→pro, forge→power)
- Section 11: users.encryption_salt + byok_keys.key_encrypted_legacy
- Section 12: goblin_hosted_usage Tabelle
- Section 13: project_secrets Tabelle
- Section 14: users.advanced_mode column

**Verifikation:** Die abschließende SELECT-Abfrage sollte 0 zurückgeben:
```sql
SELECT COUNT(*) as legacy_plan_rows FROM users WHERE plan IN ('seed', 'craft', 'forge');
```

---

## 3. BYOK Encryption Migration ausführen (nach Punkt 2)

Wenn du existierende BYOK-Keys hast:
```bash
# Dry-run zuerst:
DRY_RUN=1 npx ts-node --esm scripts/migrate-encryption.ts

# Dann live:
npx ts-node --esm scripts/migrate-encryption.ts
```

---

## 4. Stripe Tax aktivieren (vor Live-Mode)

In Stripe Dashboard → Tax → Enable
Für automatische VAT-Berechnung per Geo.

---

## 5. Layer C Aktivierung (wenn bereit)

Lies: `infra/GOBLIN_HOSTED_ACTIVATION.md`
Trigger: 30+ zahlende User, Funding, oder BYOK-Adoption < 50%
Zeit: ~1 Stunde

---

## 6. Health Check nach allen Schritten

```bash
curl https://goblinapi-production.up.railway.app/health/deep
```

Erwartung: alle Status `ok`

---

## Prioritäten-Reihenfolge

1. ✅ Railway Env-Vars (sofort — API ist down)
2. ✅ APPLY_MIGRATIONS_SESSION.sql
3. ☐ BYOK Migration (wenn User existieren)
4. ☐ Stripe Tax (vor Live-Launch)
5. ☐ GROQ_FREE_API_KEY löschen (vor Test-User-Phase)
6. ☐ Layer C Aktivierung (bei Trigger)
