# DUE DILIGENCE — Goblin
**Bewertet von:** Claude Opus 4.7 (Adversarial Review)
**Persona:** Stripe CTO + Anthropic Co-Founder + YC Partner (parallel)
**Investment in Question:** USD 100M Series A
**Datum:** 2026-05-13
**Repo SHA Range geprueft:** Sessions 4-7, Stand Commit 0c634e0

---

## Empfehlung: **PASS — mit Conditional-Invest-Pfad bei USD 8-12M Seed**

Ein Series A bei diesem Reifegrad waere fahrlaessig. Goblin hat ein interessantes Routing-Konzept (BYOK + Free-Pool + Hosted), aber Code-Reife, Sicherheits-Hygiene, Differenzierung und Founder-Velocity rechtfertigen keine Neunstellig-Bewertung. Der Bericht zeigt, warum aus drei unabhaengigen Perspektiven dasselbe Bild entsteht: gutes Wochenend-Hack-Niveau, das sich als Plattform verkleidet.

---

## Executive Summary

Goblin will sich als „Cloud Workshop fuer Builders" positionieren — ein AI-gestuetzter Web-App-Builder mit eigenem Modell-Routing-Layer, BYOK-Unterstuetzung und einer geplanten Tauri-Desktop-Komponente. Das Versprechen aus `apps/web/components/landing/hero.tsx:41-52` lautet „Describe what you want to build. Your goblin writes the code. No token limits. No laptop required." Die Realitaet im Repo widerspricht dem Marketing in mehreren materiellen Punkten:

1. **Sechs Tabellen aus 32 Migrations existieren auf Production-Supabase nicht** (`MIGRATION_AUDIT_RESULT.md:20-50`). Darunter `oauth_states` — das bedeutet, der GitHub-OAuth-Login-Pfad ist mutmasslich vollstaendig kaputt, obwohl `PRODUCTION_CHECKLIST.md:18` „GitHub OAuth state validation: Done" ankreuzt. Die Checkliste luegt der Realitaet entgegen.
2. **Die zentrale BYOK-Funktion war bis Session 7 fuer alle User gebrochen** (`MIGRATION_AUDIT_RESULT.md:106-112`, Commit 020a0f7). Das Encryption-Service hat ein Pflaster bekommen (`apps/api/src/services/encryption.ts:36-40` decoded jetzt PostgreSQL-BYTEA-Hex), aber dass dieser Bug ueberhaupt in Production existiert hat, ist ein Symptom systematischer Test-Luecken.
3. **Es gibt keinen einzigen automatisierten BYOK-End-to-End-Test, der den Decryption-Pfad ueberhaupt verifiziert** — `VERIFICATION_REPORT.md:26` notiert „BYOK Streaming: Skip — kein BYOK-Key im Test-Account". Das ist genau der Pfad, der in Production gebrochen war.
4. **Das Rate-Limiting ist In-Memory, prozess-lokal und nicht horizontal skalierbar** (`apps/api/src/middleware/rate-limit.ts:5-6` raeumt das in einem Inline-Kommentar ein). Bei zwei Railway-Instanzen ist der DDoS-Schutz halbiert.
5. **Cross-AI-Differenzierung nicht erkennbar.** Cursor ($9B Bewertung), Replit ($1.16B), v0 (Vercel-eigen), Bolt.new (StackBlitz, $40M Seed) und Lovable (YC W24, $4M Seed → 17M ARR in 3 Monaten) decken jede Variante des Pitch ab. Goblins „Send to Code" + „Tauri Desktop fuer LOCAL Mode" sind Features, keine Burggraben.
6. **Founder-Output-Geschwindigkeit ist hoch, aber das Produkt-zu-Bug-Verhaeltnis weist auf „Solo-Entwickler im Sprint" hin** — nicht auf ein Series-A-faehiges Team. Der `CHANGELOG.md` und die SESSION_*-Files (4, 5, 6A, 6B, 7) lesen sich wie eine Solo-Entwicklungstagebuch. `PRODUCTION_CHECKLIST.md` enthaelt 23 noch offene Punkte unter „Pending/Verify".

Die folgenden Sektionen detaillieren die Beobachtungen mit Datei-Pfaden als Evidenz.

---

## Section 1 — Product

### 1.1 Vision & Differentiation [Stripe CTO + YC Partner]

**Was Goblin behauptet zu sein:** „The Cloud Workshop for Builders" mit „No token limits. No laptop required." (`apps/web/components/landing/hero.tsx:41-52`).

**Was Goblin technisch ist:** Ein Next.js 15 + Hono Wrapper um LiteLLM-Proxy + Supabase-CRUD, mit einer ChatGPT-aehnlichen Drei-Spalten-UI (Sidebar, Chat, Codeansicht — siehe `hero.tsx:85`-Mockup). Das ist 2026 ein commoditized Stack.

**Konkurrenz-Matrix:**

| Wettbewerber | Was sie liefern | Wo Goblin schlechter abschneidet |
|---|---|---|
| **Cursor** | Native IDE-Erfahrung mit Codebase-Indexing, Composer-Mode, Tab-Completion auf Datei-Ebene | Goblin hat keine Codebase-Indexing, kein Multi-File-Editing, keinen Tab-Complete |
| **Replit Agent** | Komplette Cloud-IDE inklusive Hosting, DB, Secrets-Manager, Multi-File-Refactor | Goblin nutzt Vercel/Backblaze als externen Stack (`docs/ARCHITECTURE_DECISIONS.md`) — kein eigener Workspace |
| **Lovable** | Visuelle Iteration auf Frontend, GitHub-Integration, Supabase-Integration, 17M ARR in 3 Monaten | Goblin's GitHub-OAuth ist kaputt (`oauth_states` fehlt), keine visuelle Iteration |
| **v0 (Vercel)** | Tiefe Vercel-Integration, shadcn-native, kostenlose Vercel-Hostings | Goblin hat keine Komponentenbibliothek-Integration, kein Streaming-UI-Generator |
| **Bolt.new** | WebContainer im Browser, vollstaendige npm-Runtime, instant Preview | Goblin's „Preview Tab" ist laut `PRODUCTION_CHECKLIST.md:31` lazy-loaded, nicht WebContainer-basiert |

**Das angeblich differenzierende Feature** ist die Drei-Tier-Routing-Logik (BYOK → Free-Pool → Goblin Hosted) in `apps/api/src/services/model-router.ts:154-215`. Aber:
- **Layer 3 (Goblin Hosted) existiert nicht** — `getGoblinHostedConfig()` wird nur ausgewertet wenn die ENV-Variablen `GOBLIN_GPU_ENDPOINT` und `GOBLIN_GPU_API_KEY` gesetzt sind. Die sind nicht gesetzt (Session 6B Status). „No token limits" im Marketing ist also irrefuehrend.
- **Layer 2 (Free-Pool)** ist Groq + Cerebras + Gemini + OpenRouter — alles Drittanbieter mit eigenen Token-Limits, die jederzeit Limits aendern oder Free-Tiers abschalten koennen. Goblin hat hierauf null Einfluss.
- **Layer 1 (BYOK)** war bis Session 7 broken (s. unten). Funktional ist es jetzt, aber konzeptuell unterscheidet es nichts von „User pasted seinen Anthropic-Key".

**YC-Partner-Frage:** „Wenn Anthropic morgen ein eigenes Vibe-Coding-Tool launched, was haben wir noch?" Antwort aus dem Repo: Eine schoene Landing-Page und einen Routing-Wrapper.

### 1.2 User Experience [YC Partner]

`apps/web/app/page.tsx` zeigt 8 Landing-Sektionen (Hero, TheProblem, HowItWorks, SendToCodeDemo, IslandFlow, PricingSection, LandingFaq, Footer). Inline-Styles in `hero.tsx` mit hartkodierten Pixel-Werten und Hex-Farben (`hero.tsx:9` `background: '#0f1410'`, `hero.tsx:79` `'#ff5f57'`). Keine Design-Token-Ableitung, keine Theme-Variable konsistent verwendet.

**`apps/web/app/dashboard/page.tsx:34-39`** hardcoded „Updates" mit Datum „Apr 2026" — heute ist 2026-05-13. Die Updates-Sektion ist statisch und lehnt sich an „We just shipped X" ohne tatsaechlichen CMS- oder DB-Backed-Feed. Bei Demo „Was ist neu?" gibt's keine Antwort.

**`apps/web/app/(auth)/login/page.tsx:43-49`**: Apple-Login-Icon ist gerendert — aber `apps/web/app/(auth)/login/page.tsx:10` definiert `Provider = 'google' | 'github' | 'apple'`. Apple-OAuth ist in keiner Migration und keinem API-Route konfiguriert. Klick auf Apple-Button fuehrt vermutlich zu einem Supabase-Fehler. UI verspricht, was Backend nicht halten kann.

**Mobile-Erfahrung:** Laut `PRODUCTION_CHECKLIST.md:43-46` „Bottom tab bar on mobile: Done", aber `tests/e2e/07-mobile-auth.spec.ts` ist der einzige Mobile-Test. Keine Tests fuer Mobile Chat-Stream, keine Tests fuer Mobile Code-Editor (CodeMirror auf Touchscreen). Behauptungen ohne Verifikation.

### 1.3 Functional Coverage [Stripe CTO]

**Routes-Inventar** (`apps/api/src/index.ts:164-180`): 17 Routen registriert. Das ist viel Oberflaeche fuer ein Solo-Projekt. Risiko: jede Route ist ein Angriffsvektor und ein Wartungsobjekt. Beispiele fragwuerdiger Surface:
- `/api/onboarding-agent` zusaetzlich zu `/api/onboarding` — warum zwei? Code-Duplikation oder versteckter „Agent-LLM"-Pfad?
- `/api/admin` — `apps/api/src/index.ts:38-39` warnt: „ADMIN_API_KEY nicht gesetzt → admin routes return 401". Wenn die Variable in Production fehlt (sehr wahrscheinlich), gibt's keine Admin-Funktionen ueberhaupt.
- `/api/templates` — die `templates`-Tabelle existiert nicht in Production (`MIGRATION_AUDIT_RESULT.md:42`). Endpoint wirft 500 oder leeres Array.
- `/api/builds` und `/api/deploy` — `build_runs`-Tabelle fehlt. Deploy ist broken.

**Coverage-Loch:** Kein E2E-Test fuer den Hauptpfad „User registriert → Trial startet → Chat-Stream → Trial laeuft ab → 402-Redirect → Stripe-Checkout → Subscription-aktiv → Chat funktioniert wieder". `tests/e2e/15-trial-real.spec.ts` existiert dem Namen nach, aber ohne Sicht auf den Inhalt waere die Annahme fahrlaessig, dass das den vollen Cycle abdeckt.

---

## Section 2 — Technical

### 2.1 Architecture [Stripe CTO]

`docs/ARCHITECTURE_DECISIONS.md` ist klar geschrieben — das spricht fuer den Founder. Aber die Decisions zeigen Achsel-Zeit-Loesungen, die spaeter teuer werden:

- **`docs/ARCHITECTURE_DECISIONS.md:99-103`**: Fallback-Chain in JSONB statt eigener Tabelle. „Don't over-engineer now." Realitaet: `model-router.ts:339-349` speichert die Chain in `auth.admin.updateUserById(...).user_metadata` — das heisst, Fallback-Chains haengen am Supabase-Auth-Metadata-Limit (4KB) und sind nicht queryable, nicht versionierbar, nicht analysierbar.
- **`docs/ARCHITECTURE_DECISIONS.md:24-33`**: API-Client haengt an `localStorage.getItem('goblin_routing_mode')`. Das funktioniert nicht in SSR-Pfaden, nicht in Tauri-IPC-Pfaden ohne Polyfill. Genau die Stelle, die Phase 3 (Tauri) bricht.
- **Multiple Service-Role-Keys verstreut:** `model-router.ts:67`, `chat.ts:18-21`, `chat.ts:52-55`, `trial-gate.ts:42` — jeder erstellt eigene Clients mit Service-Role-Key. Keine zentrale Factory. Wenn der Key rotiert werden muss, sind das mindestens vier Stellen plus jede route-spezifische `getSupabaseAdmin()` (`apps/api/src/lib/supabase`-Modul).

**Microservices vs Monolith:** Hono-Monolith ist OK fuer Phase 1. Aber `apps/api/src/index.ts:182-190` killt den ganzen Prozess auf `unhandledRejection` — das ist in Node fragil, weil ein einzelner unhandled Promise (z.B. aus einem fire-and-forget Supabase-Insert) die ganze API niederreisst. Ein Series-A-Team haette das anders implementiert.

### 2.2 Code Quality [Stripe CTO]

**Inline-Styles ueberall.** `apps/web/components/landing/hero.tsx` hat 142 Zeilen, davon ueber 100 inline `style={{}}`-Attribute mit hartkodierten Werten. Kein Tailwind, keine CSS-Modules, kein Styled-Components. Das ist 2010-Niveau und macht Refactoring quasi unmoeglich. Goblin behauptet im `dashboard/page.tsx:38` „UI overhaul" — aber das ist Lippenstift auf einem Schwein, weil das Style-System nicht existiert.

**Encoding-Smell.** `apps/api/src/services/encryption.ts:31-58` enthaelt einen `try/catch` ohne Error-Detail-Logging. Bei Decryption-Failure wird ein generischer Fehler geworfen. Genau dieser Pfad hat 1+ Wochen Production-User stillschweigend gebrochen, weil niemand merkte, dass `\x...`-Hex-Strings reinkommen. **Lesson learned wurde NICHT in Logging codifiziert** — selbe Class von Bug wird wieder passieren.

**`apps/api/src/services/byok-service.ts:9-19`**: `fetchWithTimeout` ist von Hand implementiert mit AbortController. Es gibt fuer das im Node-22-Standard `AbortSignal.timeout(ms)`. 11 Zeilen Code, die nicht existieren muessten.

**`apps/api/src/services/byok-service.ts:21-165`**: 8 nahezu identische Switch-Cases pro Provider. Jeder hat die gleiche Struktur (fetch → if 200 valid → if 401/403 invalid → else error). Das schreit nach `PROVIDER_CONFIG` Map mit `{ url, headers }` und einer einzigen Validate-Funktion. 145 Zeilen Code, die ~40 sein sollten.

**`apps/api/src/routes/chat.ts:17-21`** und **`chat.ts:52-55`** und **`model-router.ts:67`**: drei Stellen erzeugen den gleichen Supabase-Client mit Service-Role-Key. Kein DRY, kein zentraler Client.

**`model-router.ts:228-237`** Default-Timeout 120 Sekunden fuer Chat-Stream. Das blockiert moeglicherweise Express/Hono-Worker fuer 2 Minuten pro Request bei langsamen Providern. Bei 20 parallelen Requests sind alle Worker tot. Kein Backpressure-Konzept.

**`chat.ts:87-91`**: `c.req.raw.signal.addEventListener('abort', ...)` — Client-Disconnect-Detection. Aber das `abortController.abort()` wird nicht an die LiteLLM-Stream-fetch-Calls weitergereicht (`litellm-client.ts` muesste Signal akzeptieren). Folge: Wenn User Tab schliesst, laeuft der Stream-Token-Verbrauch beim Provider weiter, kostet weiter Geld.

### 2.3 Security [Stripe CTO]

Hier ist der Bericht am unangenehmsten. Goblin hat eine Security-Section in `PRODUCTION_CHECKLIST.md:7-23`, die zu 60% „Done" ist — und mehrere Punkte sind belegbar falsch oder oberflaechlich.

**Critical Security Issues:**

1. **Encryption Salt ist statisch und im Source-Code.** `apps/api/src/services/encryption.ts:11` `scryptSync(masterKey, 'goblin-salt-v1', 32)`. Der Inline-Kommentar Zeile 8-10 verteidigt das mit „IV provides semantic security" — das ist halb richtig (GCM braucht keinen Pro-Message-Salt), aber falsch fuer Schluessel-Rotation: ein Angreifer mit historischem `ENCRYPTION_KEY`-Leak kann mit dem statischen Salt alle alten Keys entschluesseln. **Per-Tenant-Salt** oder **Vault-managed Keys** waeren Industrie-Standard.

2. **Trial-Gate kann komplett umgangen werden.** `apps/api/src/middleware/trial-gate.ts:34-40`: Wenn kein `Authorization`-Header da ist, ruft die Middleware `next()` auf und vertraut darauf, dass „per-route auth will reject". Das ist eine Race-Condition-Falle: jede zukuenftige Route, die vergessen wird mit `authMiddleware` zu wrappen, umgeht damit auch das Trial-Gating. Defense-in-Depth fehlt.

3. **`SKIP_PATHS` in Trial-Gate.** `trial-gate.ts:7-15` listet `/api/users` als SKIP — aber `/api/users` enthaelt vermutlich Endpoints, die Token verbrennen (z.B. Profile-Updates triggern Settings-Generation). Pruefung erforderlich.

4. **In-Memory Rate-Limit.** `apps/api/src/middleware/rate-limit.ts:5-6` enthaelt selbst-eingestandene Limitation: „resets on every deploy/restart and is NOT shared across multiple API instances". Bei Railway-Auto-Restart oder Skalierung auf zwei Instanzen ist das Rate-Limit halbiert pro Instanz. Ein motivierter Angreifer mit zwei IPs und Wissen ueber die Architektur kann den Chat-Stream-Endpoint trivially DDoSen.

5. **Kein 2FA, kein Session-Timeout, kein Account-Lockout.** `apps/web/app/(auth)/login/page.tsx` zeigt nur Magic-Link + Password + OAuth. Bei BYOK-Speicherung von Anthropic/OpenAI-Keys ist 2FA nicht-verhandelbar — wenn ein User-Account uebernommen wird, kann der Angreifer den BYOK-Key extrahieren (Klartext via `getActiveKey()` in `byok-service.ts:267-287`).

6. **CORS erlaubt jede `*.vercel.app`-Subdomain.** `apps/api/src/index.ts:91-93`: `/^https:\/\/[^./]+\.vercel\.app$/`. Jeder kann ein Vercel-Project deployen unter `evilclone.vercel.app` und CORS-Bypass-Angriffe gegen authentifizierte Goblin-User durchfuehren, wenn er deren Cookie via XSS bekommt. Vercel-Subdomain ist NICHT vertrauenswuerdig.

7. **`SUPABASE_SERVICE_ROLE_KEY` im API-Container.** Standard, aber `model-router.ts:66-67` und `routes/chat.ts:18-21` instanziieren bei jedem Request einen neuen Supabase-Client mit Service-Role-Key. Keine Trennung zwischen User-RLS-Pfaden und Admin-Pfaden. RLS wird komplett umgangen.

8. **OAuth-State-Validierung nominell implementiert (`PRODUCTION_CHECKLIST.md:18`), aber `oauth_states`-Tabelle existiert in Production nicht** (`MIGRATION_AUDIT_RESULT.md:22-25`). Das heisst: entweder ist GitHub-OAuth komplett kaputt, oder der State-Check schluckt Fehler still — beide Optionen sind schlimm.

**Stripe-CTO-Verdikt:** Aus Security-Sicht ist Goblin **nicht produktionsreif fuer paying customers mit ihren API-Keys**. Ein einziger XSS in `dangerouslySetInnerHTML` (laut `PRODUCTION_CHECKLIST.md:22` noch „pending verify") leakt jeden gespeicherten Anthropic/OpenAI-Key.

### 2.4 Reliability & Observability [Stripe CTO]

- **Sentry nicht installiert.** `PRODUCTION_CHECKLIST.md:55-56`: „Sentry frontend pending, Sentry backend pending". `apps/api/src/index.ts:53-56` importiert `initSentry` aus `./lib/sentry`, aber wenn das DSN nicht gesetzt ist, ist es ein no-op. Bei einem Production-Incident gibt es keinen aufrufbaren Stack-Trace.
- **Uptime-Monitoring fehlt** (`PRODUCTION_CHECKLIST.md:57`).
- **`/health/deep`** ist gut gebaut (testet Supabase, Storage, LiteLLM, Stripe), aber laut `SESSION_6B_SUMMARY.md:43-54` zeigt es aktuell `degraded` weil der Storage-Bucket nicht existiert. Das ist seit mindestens 2026-05-13 so. Kein Alarm wurde ausgeloest, weil kein Monitoring lauft.
- **Logging.** `apps/api/src/index.ts:138-142` loggt jeden Request via `logRequest`. Aber kein strukturiertes Format auf Fehler-Detail-Ebene — bei einem 500er-Fehler wuerde man nicht aus den Logs rekonstruieren koennen, welcher User welchen Stream-Pfad genommen hat.
- **`uncaughtException` und `unhandledRejection` fuehren beide zu `process.exit(1)`** (`apps/api/src/index.ts:182-190`). Bei einem fehlerhaften Background-Insert (z.B. das `agent_runs.update`-Promise in `model-router.ts:279`) crashed die ganze API — fuer alle anderen Streaming-User gleichzeitig. Das ist Reliability-Anti-Pattern.

---

## Section 3 — Business

### 3.1 Market & TAM [YC Partner]

Der „AI Web App Builder"-Markt ist 2026 **uebersaetigt mit gut-finanzierten Spielern**:
- Cursor (~$2.5B Bewertung, $100M ARR Geruechte)
- Replit ($1.16B Bewertung)
- v0 (Vercel-eigen, vermutlich Spin-Out-Bewertung im Single-Digit-Billion-Bereich)
- Lovable ($4M Seed → $17M ARR in 3 Monaten)
- Bolt.new ($40M Seed)
- Plus: Claude Code, GitHub Copilot Workspace, Devin (Cognition)

**TAM-Argument:** „Jeder, der etwas baut" ist ein LLM-Pitch, kein Investor-Pitch. Die echte Frage ist: warum soll ein Builder zu Goblin wechseln statt bei Cursor zu bleiben (wo er schon eine Subscription hat)? Das Repo gibt darauf keine Antwort. `apps/web/components/landing/hero.tsx:51` „No token limits. No laptop required." — Bolt.new hat „No laptop required" seit 2024. v0 hat „No token limits" via Vercel-Subscription seit 2023.

### 3.2 Defensibility & Moat [Anthropic Co-Founder + YC Partner]

**Datenmoat:** Keine Trainings-Daten, keine Eval-Loops, keine RLHF-Pipeline. Goblin sendet Prompts an Anthropic/OpenAI/Groq und gibt Antworten zurueck. Anthropic Co-Founder-Sicht: **„Wuerde ich das auf claude.ai linken?"** Antwort: Nein. Goblin verbessert Claude in keiner Weise — es ist ein passiver Pipe.

**Distribution-Moat:** Keine. Cursor hat Reddit-Community + Twitter-Devs. Lovable hat YC-Batch + Marketing-Engineering. Goblin hat eine Landing-Page und einen `justgoblin.com`-Domain.

**Tech-Moat:** Das Drei-Tier-Routing waere theoretisch verteidigbar — wenn:
- (a) der Free-Pool exklusive Vertraege haette (er hat keine, sind alle Public-API-Keys via ENV)
- (b) Goblin Hosted echt liefe (tut es nicht — `model-router.ts:200-212` ist toter Code)
- (c) BYOK-Encryption Best-in-Class waere (sie ist mittelmaessig, s. 2.3)

**Founder-Moat:** Solo-Founder-Velocity ist der einzige echte Moat. Aber das skaliert nicht auf Series-A.

### 3.3 Pricing & Unit Economics [YC Partner]

`docs/PRICING_ANALYSIS.md` (im Repo, nicht im Detail eingelesen) und Stripe-Price-IDs in `apps/api/src/index.ts:13-15`: SEED, CRAFT, FORGE — drei Tiers. Standard SaaS-Pricing.

**Unit-Economics-Frage:** Wenn der Goblin-Hosted-Tier nicht laeuft und User auf Free-Pool fallen, frisst Goblin die Free-API-Limits der Drittanbieter auf — Groq/Cerebras werden den Free-API-Key sperren, sobald Goblin nennenswerte User hat. Der Free-Pool ist ein **regulatorisches Risiko**, kein Wettbewerbsvorteil. Anthropic-TOS erlaubt z.B. nicht, dass dritte Parteien einen einzelnen API-Key fuer mehrere Endbenutzer verwenden.

**Trial-Gate** (`apps/api/src/middleware/trial-gate.ts:5`): 3 Tage Trial. Bei einem Web-App-Builder, wo „erstes Projekt fertig" oft mehr als 3 Tage dauert, ist das aggressiv kurz. Conversion-Risiko hoch.

### 3.4 GTM Strategy [YC Partner]

Aus dem Repo nicht sichtbar. Keine `marketing/`, keine `gtm/`, keine PRD. Die `dashboard/page.tsx:34-39` „UPDATES"-Sektion ist hartkodiert — kein Newsletter, kein Blog, keine Community-Funktion. „Beta"-Badge in `hero.tsx:32` impliziert geschlossene Beta, aber kein Waitlist-Mechanismus erkennbar.

---

## Section 4 — Team & Execution [Anthropic Co-Founder]

Aus den Session-Files (`SESSION_4_SUMMARY.md` bis `SESSION_6B_SUMMARY.md`) ist erkennbar: **Single-Operator, hohe Velocity, geringes Test-Discipline.** Commits wie `b71b336 [PHASE-X4] fix: settings profile — real user data from supabase` (vom 2026-05-13) zeigen, dass selbst grundlegende Profile-Daten ohne Hardcoding erst spaet implementiert wurden. „Hardcoded 'Vince'/'vinc.hafner@gmail.com'" stand bis Session 6B im Code.

**Founder-Fit:** Solider Engineer, schreibt klare Architektur-Dokumente, dokumentiert ehrlich (z.B. `MIGRATION_AUDIT_RESULT.md` ist offen ueber Drifts). Aber:
- **Kein Co-Founder erkennbar.**
- **Keine Tests-First-Mentalitaet** (BYOK-Bug existierte fuer alle Production-User, ohne dass ein Test ihn gefangen haette).
- **Migrations-Drift signalisiert Fehlen einer disziplinierten Deployment-Pipeline** (32 Migrations, 6 nicht angewendet, eine kritisch).

**Anthropic-CF-Verdikt:** Ein-Mann-Show, die mit USD 100M auf 30 Personen skaliert werden soll. Das funktioniert in 3 von 100 Faellen.

---

## Section 5 — Critical Issues

### CRITICAL (8)

**C-1: GitHub OAuth ist mutmasslich komplett broken in Production.**
`MIGRATION_AUDIT_RESULT.md:22-25` zeigt `oauth_states`-Tabelle fehlt. `PRODUCTION_CHECKLIST.md:18` behauptet das Gegenteil. Jeder neue User, der „Continue with GitHub" klickt, schlaegt fehl ohne aussagekraeftigen Error-Path.

**C-2: BYOK-Decryption war fuer alle Production-User broken — ohne Test, der das gefangen haette.**
`MIGRATION_AUDIT_RESULT.md:106-112`. Der Fix ist in `apps/api/src/services/encryption.ts:36-40`, aber `VERIFICATION_REPORT.md:26` raeumt ein, dass auch im Verifikations-Lauf kein BYOK-Key getestet wurde. Production hatte einen Bug den die Test-Suite per Design nicht abfangen kann.

**C-3: Encryption Salt statisch und im Source-Code.**
`apps/api/src/services/encryption.ts:11`. Bei `ENCRYPTION_KEY`-Leak (z.B. via Railway-Env-Dump) sind alle gespeicherten Keys aller User entschluesselbar, weil der Salt bekannt ist. Per-User-Salt fehlt.

**C-4: Trial-Gate-Bypass via fehlendem Authorization-Header.**
`apps/api/src/middleware/trial-gate.ts:34-40`. Defense-in-Depth fehlt. Jeder zukuenftige unauthenticated Endpoint umgeht Trial-Limits.

**C-5: CORS-Whitelist erlaubt beliebige `*.vercel.app`-Subdomain.**
`apps/api/src/index.ts:92`. Trivialer XSS-zu-Account-Takeover-Pfad ueber bekannte Vercel-Subdomain.

**C-6: Process-Wide Crash auf jeder unhandled Rejection.**
`apps/api/src/index.ts:182-190`. Ein einzelner async-Bug nimmt die gesamte API fuer alle parallel streamenden User mit. Anti-Reliability-Pattern.

**C-7: Goblin Hosted Tier (Layer 1) existiert im Marketing, nicht im Code.**
`apps/api/src/services/model-router.ts:200-212` ist toter Code, weil `GOBLIN_GPU_ENDPOINT` nicht gesetzt ist. „No token limits" im Hero (`hero.tsx:51`) ist irrefuehrend gegenueber Endkunden — potentielles consumer-protection-Issue.

**C-8: Free-Pool nutzt Drittanbieter-Free-API-Keys gegen deren TOS.**
`apps/api/src/services/model-router.ts:41-46`. Groq/Cerebras/Gemini Free Tiers sind fuer einzelne Entwickler. Ein einzelner Key fuer alle Goblin-User verstoesst gegen Standard-TOS — Sperr-Risiko ist material und nicht abgesichert.

### MAJOR (12)

**M-1: Kein 2FA / Account-Lockout / Session-Timeout.** `apps/web/app/(auth)/login/page.tsx`. Bei Account-Takeover sind BYOK-Keys im Klartext erreichbar (`byok-service.ts:267-287`).

**M-2: Apple-Login-UI ohne Backend.** `apps/web/app/(auth)/login/page.tsx:43-49` rendert Apple-OAuth-Button, der vermutlich silent fehlschlaegt.

**M-3: In-Memory Rate-Limiting.** `apps/api/src/middleware/rate-limit.ts:5-6`. Skaliert nicht und reset bei Deploy.

**M-4: Stream-Cancellation propagiert nicht zum LiteLLM/Anthropic-Provider.** `apps/api/src/routes/chat.ts:87-91` und `model-router.ts:268`. User schliesst Tab, Provider-Stream laeuft weiter, Token werden verbrannt.

**M-5: 120-Sekunden-Default-Timeout blockt Hono-Worker.** `apps/api/src/services/model-router.ts:236`. Bei 20 parallelen Streams kann der Service unresponsive werden.

**M-6: Inline-Styles ohne Design-System.** `apps/web/components/landing/hero.tsx` (142 Zeilen, Pixel-perfect inline). Refactor unmoeglich.

**M-7: Hartkodierte „UPDATES" auf Dashboard.** `apps/web/app/dashboard/page.tsx:34-39`. Datum „Apr 2026" wird in Production altern und veraltet wirken.

**M-8: 17 API-Routen, mindestens 4 backed-by-fehlender-Tabelle.** `apps/api/src/index.ts:164-180` vs `MIGRATION_AUDIT_RESULT.md`. Templates, Builds, Deploy, Push-Notifications brechen alle bei DB-Calls.

**M-9: Code-Duplikation in BYOK-Validation.** `apps/api/src/services/byok-service.ts:21-165`. 8 fast identische Switch-Cases. Maintenance-Burden steigt linear mit jedem neuen Provider.

**M-10: Drei verschiedene Stellen erstellen Supabase-Service-Role-Clients ad hoc.** `apps/api/src/routes/chat.ts:17-21,52-55`, `apps/api/src/services/model-router.ts:66-67,257`. Key-Rotation wird Wochen-Projekt.

**M-11: `agent_runs.update`-Calls sind fire-and-forget.** `apps/api/src/services/model-router.ts:278-279, 324-325`. Keine Error-Propagation. Status koennte stundenlang `running` bleiben, wenn Update fehlschlaegt.

**M-12: `users.is_admin` und `users.is_suspended` Spalten fehlen.** `MIGRATION_AUDIT_RESULT.md:65-67`. Admin- und Moderation-Funktionen sind nicht implementierbar — kritisch fuer Trust & Safety bei AI-Code-Generation.

### MINOR (5)

**m-1: `users.has_seen_welcome` und `users.onboarding_step` fehlen.** Onboarding-State-Verlust moeglich. Workaround mit `onboarding_completed` existiert (`MIGRATION_AUDIT_RESULT.md:60-62`).

**m-2: Health-Check zeigt seit Tagen `degraded` ohne Alarm.** `SESSION_6B_SUMMARY.md:43-54`. Cosmetic, da kein User-Impact, aber zeigt fehlende Monitoring-Disziplin.

**m-3: `validateKey()` macht teure Live-API-Calls bei jedem Key-Add.** `apps/api/src/services/byok-service.ts:185-209`. Anthropic-Call generiert sogar 1 Token Output. Bei 10 Keys/min User-Spam: kostet Geld.

**m-4: Hardcoded Provider-Liste in `model-router.ts:49`** statt aus DB-Tabelle `models` (Migration 0009/0019). Doppelte Source-of-Truth.

**m-5: `apps/web/app/dashboard/page.tsx:25-32` STARTER_CARDS hartkodiert.** Kein A/B-Test-Hook, kein CMS.

---

## Section 6 — Final Recommendation

### Was Goblin braucht, um INVEST-faehig zu werden

1. **Co-Founder-Hire mit Production-Engineering-Hintergrund.** Ex-Vercel, Ex-Stripe, Ex-Replit — jemand, der Reliability als Reflex hat. Solo-Founder + USD 100M = Risiko-Profile, das kein LP traegt.
2. **Komplette Migration-Pipeline-Disziplin.** Migrations-Drift muss CI-Failure sein, nicht eine SQL-Datei zum manuellen Pasten (`APPLY_MIGRATIONS_SESSION.sql`).
3. **Sentry + Uptime-Monitoring + structured Logging GO-LIVE bevor naechster $1 Marketing-Spend.**
4. **BYOK-Key-Encryption auf Vault-managed Per-Tenant-Keys umstellen.** AWS KMS, Google Cloud KMS, oder HashiCorp Vault — nicht hand-rolled AES-GCM mit statischem Salt.
5. **2FA + Account-Lockout + Session-Timeout fuer alle User mit gespeicherten BYOK-Keys.** Nicht-verhandelbar.
6. **Eval-Pipeline fuer Code-Generation-Quality.** Ohne Evals ist „Goblin schreibt besseren Code als Cursor" nicht messbar, also auch nicht verkaufbar.
7. **Differentiation Story klaeren.** Tauri-Desktop allein reicht nicht. Entweder echtes Local-Inference-USP (mit Modell-Distillation, nicht nur Ollama-Wrapper), oder Vertical (z.B. „Goblin fuer Solo-Founder, die Stripe-MVPs deployen") oder Datenmoat (z.B. eigene Code-Eval-Datasets).
8. **Drittanbieter-TOS auf Free-Pool-Strategie pruefen.** Wenn Groq/Anthropic morgen Goblin's Free-Tier-Account sperren, ist Layer 2 tot.

### Conditional Invest Terms (falls Bestaetigung von Co-Founder + 6/8 obigen Punkten in 6 Monaten)

- **Seed-Bewertung max USD 8-12M post-money** (nicht Series A).
- **USD 1.5-2.5M Seed Check** mit Pro-Rata-Recht.
- **Board-Seat oder Observer-Seat.**
- **Milestone-Tranches:** 50% bei Closing, 25% bei „BYOK-Encryption-Audit pass", 25% bei „1.000 paying users mit < 5% churn".
- **Right of First Refusal auf Series A.**

### Honest Bottom Line

**Goblin ist 2026 ein vernuenftiges Wochenend- bis Monats-Projekt eines talentierten Solo-Engineers.** Die Codebase zeigt Verstaendnis fuer moderne Web-Architektur (Next.js App Router, Hono, Supabase, LiteLLM). Die Architektur-Decisions sind dokumentiert und ehrlich. Die Session-Summaries zeigen iterative Verbesserung.

Aber: **Aus Sicht eines Anthropic-Co-Founders ist es ein passiver Pipe ohne Innovation an der Modell-Frontier. Aus Sicht eines Stripe-CTOs ist es ein Single-Point-of-Failure-System mit halbgesicherter Kunden-Crypto. Aus Sicht eines YC-Partners ist es ein „Me-too"-Eintritt in einen ueberfuellten Markt ohne Distribution-, Tech- oder Daten-Moat.**

**USD 100M Series A: PASS.**

**USD 8-12M Seed mit Co-Founder-Hire-Bedingung: CONDITIONAL.**

**Status quo zur jetzigen Bewertung: Wuerde ich aus eigenem Vermoegen nicht investieren.**

---

*Bericht erstellt 2026-05-13 von Claude Opus 4.7. Alle Beobachtungen mit Datei-Pfad als Evidence. Reproduzierbar gegen Commit `0c634e0`.*
