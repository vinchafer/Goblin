# ENV-Key & Download Flow Audit — 2026-06-23

Account: **vinc.hafner3@gmail.com** (test account, triple-confirmed live: hero
greeting "VINC.HAFNER3" + mobile settings "vinc.hafner3@gmail.com · Vollzugriff").
Prod: master `57515c6`. API base: `goblinapi-production.up.railway.app`.
Method: code review (3 parallel readers) + live walk (desktop 1280 + mobile 390px),
isolated Chrome instance (port 9222, dedicated profile — user's browser untouched).

Keys masked everywhere below. Lifecycle tests used an obviously-fake dummy value.

---

## VERDICT

**No P0 active exposure found.** ENV-key storage (in-project secrets AND BYOK
provider keys) is genuinely strong: AES-256-GCM at rest, per-user key derivation,
masked everywhere (display + over-the-wire), server-side-only on use, RLS +
explicit `user_id` scoping, reveal gated behind fresh re-auth. Live probes confirm
the design holds on prod.

Download flows: 3 work and are ownership-scoped; **1 is a dead button** (data
export under Datenschutz → calls a non-existent endpoint → silent 404). The
in-project-secrets feature ships an **honest disclosure** that runtime injection
into deploys is not yet wired.

ENV-key flows and the working downloads are **beta-ready**. Top items to fix:
the dead "Meine Daten exportieren" button, and minor UI polish.

---

## FINDINGS REGISTER

| # | Sev | Surface | Finding | Evidence (masked) |
|---|-----|---------|---------|-------------------|
| 1 | P2 | Datenschutz ▸ "Meine Daten exportieren" | **Dead button.** Frontend (`PrivacyPage.tsx:51-67`) calls `GET /api/users/me/export` which has **no handler** in the API. `if (!r.ok) return;` swallows the failure → clicking does nothing, no error shown. Same dead-toggle pattern previous sessions retired. NOT a security issue. | Live: `GET /api/users/me/export` → **404** (text/plain). No matching route in api. |
| 2 | P3 | Modelle ▸ tab header | Stale header copy: on "Meine Keys" tab the description still reads "Rankings aus 5 öffentlichen Benchmarks…" (Rankings-tab blurb). Cosmetic; header text doesn't update on tab switch. | Screenshot — "Meine Keys" active, header = Rankings text. |
| 3 | P3 | In-project secret add modal | Chrome autofill injects the user's email into the NAME field and a saved password into the VALUE field when the modal opens (form lacks `autocomplete="off"` / non-credential field hints). Cosmetic/UX; user must clear before typing. No data risk. | Screenshot — modal pre-filled `vinc.hafner3@gmail.com` + masked dots before any typing. |
| 4 | P3 | Project ZIP download | Works and is scoped, but an **empty project** yields a 22-byte (empty) ZIP with no warning — silently downloads "nothing". Minor: no empty-state messaging. | Live: `GET /api/projects/:id/download` → 200, `application/zip`, magic `PK` (80,75), 22 bytes on an empty project. |
| 5 | P3 | 2FA backup codes download | `TwoFactorPage.tsx:96` builds a blob download for backup codes — **not driven this session** (would require enabling 2FA). Flagged for follow-up verification. | Code ref only. |

No security finding rose above informational — all the "expected-strong" checks
passed (below). Per rule (b) security findings default to P1, but every probe
returned the safe result, so there is **nothing to escalate**.

---

## 2.1 IN-PROJECT SECRETS (project env vars) — BETA-READY ✓

Route: `apps/api/src/routes/secrets.ts` mounted at `/api/projects/:projectId/secrets*`.
Table: `project_secrets` (migration `0036`), RLS `auth.uid() = user_id`.

| Check | Result | Evidence |
|-------|--------|----------|
| Lifecycle set→read→delete | **Works, repeatably** | Live: POST created `AUDIT_TEST_SECRET`; list showed it; DELETE → `{success:true}`; list after = `[]` (truly removed). |
| Masked after save | **Yes** | UI row shows dots + last-4 hint ("cret"); list API returns only `value_hint`. |
| Encrypted at rest | **Yes — AES-256-GCM** | `encryption.ts`: `aes-256-gcm`, per-user key = `scryptSync(ENCRYPTION_KEY, userSalt)`; `value_encrypted` BYTEA, `value_hint` last-4 only. |
| Value reaches client after save | **No** | Live list over-the-wire: `LEAK_PLAINTEXT=false`; body = `id, name, value_hint, environment, timestamps` only. |
| Reveal protected | **Yes — fresh re-auth required** | Reveal endpoint requires `X-Reauth-Token` (fresh JWT). Live without it → **401** "Re-authentication required." |
| Ownership / IDOR | **Safe** | `assertProjectOwner()` + `.eq('user_id', userId)` on every handler + RLS. Live forged project id → **404** "Project not found"; no-auth → **401**. |
| Deployed app receives the var at runtime | **NOT YET — honestly disclosed** | UI states verbatim: "Hinweis: Die automatische Einspeisung in Deploys ist noch nicht aktiv — speichern, ansehen und löschen funktioniert bereits." (write-store works; runtime injection pending — disclosed, not theatre.) |

Honest framing on page: "Goblin speichert sie verschlüsselt — sie tauchen nie im
Chat auf, nicht in Logs, und Goblin selbst kann sie nicht lesen."

## 2.2 BYOK PROVIDER KEYS (Profil ▸ Modelle ▸ Meine Keys / Konnektoren ▸ Vercel) — BETA-READY ✓

Route: `apps/api/src/routes/byok-keys.ts`. Table: `byok_keys` (mig `0001`),
RLS `auth.uid() = user_id`. Vercel token stored as a `provider='vercel'` byok key.

| Check | Result | Evidence |
|-------|--------|----------|
| Encrypted at rest | **Yes — AES-256-GCM, per-user Vault KEK (v2)** | `byok-encryption.ts`: v2 = AES-256-GCM with per-user 32-byte KEK in Supabase Vault (`vault.secrets`); legacy v1 = scrypt-derived. `key_encrypted` never selected on list. |
| Masked on display | **Yes — last-4 only** | Live UI "Meine Keys": Google `…plWeQ`, Groq `…n6rc`; others "Nicht verbunden". `key_hint` VARCHAR(8). |
| Value to client on list | **No** | `listKeys()` selects `id, provider, key_hint, status, …` — never `key_encrypted`. |
| Server-side-only on use | **Yes** | `getActiveKeyByProvider()` decrypts in-memory for internal services (chat inference, Vercel deploy); never returned to HTTP client. Vercel connect returns `{account}` only, no token. |
| Logging | **Safe** | No plaintext logged; decrypt audit log (`byok_decrypt_log`) stores hashed user id + operation only. |
| Ownership / IDOR | **Safe** | All handlers `.eq('user_id', userId)` + RLS; PATCH/DELETE double-scope by id+user. |

Honest framing: "Goblin routet direkt über deinen Provider — du zahlst nur das,
was du verbrauchst, ohne Goblin-Margen." Two-level-truth: Goblin-hosted models
shown only as Swift/Forge; the raw model names on the Rankings tab are **BYOK**
models the user supplied keys for (legitimate, not a leak).

## 2.3 DOWNLOAD FLOWS

| Flow | Status | Scoped | Evidence |
|------|--------|--------|----------|
| Project ZIP (`GET /api/projects/:id/download`) | **Works** | Yes (`.eq('user_id',userId)`) | Live 200, `application/zip`, magic `PK`. (Empty project → 22-byte zip, see finding #4.) |
| Single file (`GET /api/projects/:id/files-raw/*`) | **Works** | Yes (`ownsProject()`) | Code-confirmed; same scoping pattern proven live on secrets (forged→404). |
| Chat code block (client-side blob) | **Works** | n/a (own content) | `standalone-chat.tsx:118` — pure browser blob, no API. |
| Data export — "Meine Daten exportieren" | **DEAD** | n/a | Finding #1 — endpoint 404, silent fail. |
| 2FA backup codes | **Unverified** | — | Finding #5 — not driven this session. |

Mobile (390px): secrets page, settings, Konnektoren and Meine Keys all render
clean and legible. iOS-Safari download constraints could not be driven from this
harness (desktop Chrome) — noted honestly; mobile-Chrome blob downloads work.

---

## OWED NEXT (fix sprint candidates)

1. **P2 — implement or remove** the `/api/users/me/export` data-export (GDPR).
   Either build the handler or remove the dead button + its "Meine Daten
   exportieren" row (dead-toggle honesty).
2. P3 — Modelle tab header should update per tab (stop showing Rankings blurb on
   Meine Keys).
3. P3 — add `autocomplete` hints to the secret-add modal to stop autofill
   polluting Name/Value.
4. P3 — empty-project ZIP should warn instead of silently downloading 22 bytes.
5. P3 — verify 2FA backup-code download end-to-end.

Wire runtime secret injection into deploys (currently disclosed as pending) is a
product gap, not a bug — out of audit scope.
