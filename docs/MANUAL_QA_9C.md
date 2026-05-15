# Manual QA Checklist — Session 9C

**Test-Umgebung:** Chrome DevTools mobile-mode 375×812 (iPhone 12/13)
**URL:** `https://justgoblin.com` (nach Push) oder `http://localhost:3000` (lokal nach `pnpm dev`)
**Account:** `vinc.hafner+test@gmail.com` (Real-Test-Account, free-pool)
**Geschätzte Dauer:** 15 Min

> **DevTools-Mode aktivieren:** Cmd/Ctrl+Shift+M → Device-Toolbar → "iPhone 12 Pro" oder "Responsive 375×812". Frischer Incognito-Tab pro Run.

---

## 9C Bug-Fixes (7 Checks)

### Mobile (375px Viewport)

- [ ] **BUG-010 — Mobile Create Project ohne "Invalid project data"**
  - **Aktion:**
    1. Login als Test-User → Dashboard öffnet
    2. Tap **Hamburger** (☰) oben links im Header
    3. Sidebar slidet von links rein
    4. Tap **"+ New Project"** (Moss-grüner Button im Sidebar oben)
    5. Modal öffnet → Tab "Blank Project" aktiv
    6. **Project Name** eingeben: `Test 9C-QA <aktuelle Zeit>`
    7. Description leer lassen, Color-Default akzeptieren
    8. Tap **"Create project →"**
  - **Erwartung:** Projekt entsteht, Modal schließt, Redirect zu `/dashboard/project/<id>`. Projekt erscheint in Sidebar-Liste.
  - **Failure-Signal:** Roter Error-Banner mit `"invalid project data"` ODER Modal bleibt offen mit Spinner.
  - **Screenshot wenn:** Failure.

- [ ] **BUG-012 — Sidebar slidet von LINKS, nicht von unten**
  - **Aktion:**
    1. Auf Dashboard-Page (oder beliebiger Inner-Page)
    2. Tap **Hamburger** (☰) oben links
  - **Erwartung:** Sidebar gleitet horizontal von links rein (`transform: translateX`). Endet bei `x=0`, `width≈85vw` (max 320px). Backdrop dimmer wird sichtbar rechts daneben.
  - **Failure-Signal:** Sidebar kommt von unten hoch (alte Bottom-Sheet-Animation) ODER überlagert komplett vollflächig.
  - **Screenshot wenn:** Failure ODER zur Doku der korrekten Animation (1 Foto während Transition, 1 Foto nach Open).

- [ ] **BUG-012b — Sidebar User-Pill statt Settings/Billing/API-Keys-Buttons**
  - **Aktion:** Sidebar offen, scroll bis ganz unten
  - **Erwartung:** EIN Button bottom mit Avatar (V) + Name + Gear-Icon. Tap → öffnet `/dashboard/settings`.
  - **Failure-Signal:** 3 separate Buttons "API Keys / Billing / Settings" sichtbar.

- [ ] **BUG-013 — Recent Chats zeigen Project-Badge**
  - **Vorbereitung:**
    1. Aus voriger Step heraus: im neu erstellten Projekt → Tap "Chat"-Tab im Bottom-Nav
    2. Eine Nachricht senden: `"hello"` → kurz auf Antwort warten
  - **Aktion:**
    1. Hamburger → Sidebar öffnen
    2. Scroll zu Section **"Recent Chats"**
  - **Erwartung:** Chat erscheint in Liste mit `📁 Test 9C-QA <Zeit>` Badge unterhalb des Titles.
  - **Failure-Signal:** Chat-Item ohne Badge ODER Chat fehlt komplett.

- [ ] **BUG-014 — Kein floating "?" Help-Button mehr**
  - **Aktion:** Auf irgendeiner `/dashboard/*` Page sein, scroll, schau nach unten rechts
  - **Erwartung:** **KEIN** runder dunkelgrüner "?" Button bottom-right. Send-Button im Chat ist nicht überdeckt.
  - **Failure-Signal:** "?" Button sichtbar (beweist `<SupportBubble>` ist noch im Layout).

### Desktop

- [ ] **BUG-011 — Pricing 3 Cards + Geo-Toggle auf Landing**
  - **Aktion:**
    1. Logout (oder Incognito) → `https://justgoblin.com` (oder `localhost:3000`)
    2. Scroll zur Pricing-Section (oder anchor `#pricing`)
  - **Erwartung:**
    - **3 Plan-Cards** nebeneinander (Build $9 / Pro $19 / Power $39 — Standard-Tier)
    - "Pro" highlighted mit Moss-Border + "Most popular" Badge
    - Geo-Toggle-Pills oben mit 3 Buttons: "Standard", "Latam / Eastern Europe", "India / Africa"
    - Tap auf Tier-2-Pill → Preise wechseln zu $4/$9/$19
    - Tap auf Tier-3-Pill → Preise wechseln zu $3/$6/$12
  - **Failure-Signal:** Nur 1 Card ($9) sichtbar ODER Toggle fehlt ODER Preise wechseln nicht.

- [ ] **BUG-014/015 — Help erreichbar via Avatar-Menu, /help zeigt FAQ**
  - **Aktion:**
    1. Eingeloggt im Dashboard
    2. Tap auf **Avatar** (initial-circle oben rechts im Header)
    3. Dropdown öffnet
    4. Tap auf **"Help & Support"**
  - **Erwartung:**
    - Dropdown-Items in Reihenfolge: API Keys / Billing / Settings / **Help & Support** / Sign out
    - Klick navigiert zu `/help`
    - Page zeigt H1 "Hilfe & Support" + 7 FAQ-Akkordeons (erstes geöffnet)
    - Bottom: Moss-Card mit `support@justgoblin.com` mailto-Link
  - **Failure-Signal:** "Help & Support" fehlt im Menu ODER `/help` 404 ODER Page zeigt alten Support-Chat.

- [ ] **Footer-Labels statt cryptic D/X/G**
  - **Aktion:** `https://justgoblin.com` → scroll bis Footer
  - **Erwartung:** Brand-Block links zeigt 3 bordered Pills mit vollen Texten **"Discord"**, **"Twitter"**, **"GitHub"**. Klickbar.
  - **Failure-Signal:** Einzelne Buchstaben "D", "X", "G" als Avatar-Circles.

---

## Regression Checks (3 — sollte noch funktionieren)

- [ ] **Login mit Magic-Link**
  - **Aktion:** Logout → `/login` → Email eingeben → "Send magic link" → Inbox checken → Link öffnen
  - **Erwartung:** Redirect zu `/dashboard`, eingeloggt.
  - **Failure-Signal:** Bleibt auf Login-Page ODER 500-Error.

- [ ] **BYOK Key speichern**
  - **Aktion:** `/dashboard/settings/keys` → "Add Key" → Provider "Anthropic" → Test-Key eingeben → Save
  - **Erwartung:** Key erscheint in Liste mit masked Wert (`sk-ant-...****`).
  - **Failure-Signal:** Save-Button-Spinner hängt ODER Error-Toast ODER Liste leer nach reload.

- [ ] **Chat senden + Antwort empfangen**
  - **Aktion:** In einem Projekt → Chat-Tab → "hello" senden
  - **Erwartung:** User-Message erscheint, "..."-Indicator, dann Assistant-Response streamt rein.
  - **Failure-Signal:** Loading-Spinner bricht ab ODER Error-Message ODER kein Token-Stream.

---

## 9C1 Bug-Fixes (5 zusätzliche Checks, Foundation-Fixes nach Manual-QA)

- [ ] **BUG-016 — Create-Project erstellt echtes Projekt + Dashboard refresht**
  - **Aktion:**
    1. Sidebar → Plus-Icon neben "PROJECTS" Header
    2. Modal öffnet → Name `BUG-016 Test`, Beschreibung optional, Create
    3. Redirect zu `/dashboard/project/<id>` (ProjectWorkspace mit Chat|Code|Preview Pills)
    4. Browser-Back zu `/dashboard`
  - **Erwartung:** Projekt erscheint in Dashboard-Liste UND in Sidebar.
  - **Bonus:** Chat-Input testen — KEINE 400-LiteLLM-Errors mehr beim Senden via `free/gemini-flash` (jetzt korrekt zu `gemini/gemini-1.5-flash` gemappt).

- [ ] **BUG-017 — Sidebar: inline Plus-Icons statt großer Moss-Button**
  - **Aktion:** Sidebar öffnen
  - **Erwartung:** KEIN großer Moss-grüner "+ New Project" Button mehr. Stattdessen:
    - "PROJECTS" Section-Header mit kleinem Plus-Icon (16px outline) rechts → onClick öffnet Project-Modal
    - "RECENT CHATS" Section-Header mit Plus-Icon rechts → onClick erstellt neuen Chat
    - Beide Labels sind klickbar (navigate zu /dashboard bzw /dashboard/chat)

- [ ] **BUG-018 — Settings Bottom-Sheet überlagert + 2-Level-Navigation**
  - **Aktion:**
    1. Sidebar bottom → User-Pill (Avatar + Name + Gear) klicken
    2. Settings-Sheet slidet von UNTEN (mobile) oder erscheint als zentriertes Modal (desktop)
    3. Liste zeigt 11 Items + Section "Developer Settings" mit 5 weiteren
    4. Tap "Profil" → Detail-Pane mit Identität/Sicherheit/Sessions/Danger Zone
    5. Top-Left "<" zurück → zurück zur Liste
    6. ESC oder X-Button → Sheet schließt
  - **Erwartung:** KEIN Page-Change (URL bleibt). Sheet überlagert.
  - **Failure-Signal:** Routing zu `/dashboard/settings` (alte Page-basierte Settings).

- [ ] **BUG-019 — Header: Hamburger + Logo + Tab-Pills + Ochre Plus**
  - **Aktion:** In Projekt-Workspace
  - **Erwartung Mobile-Header (von links nach rechts):**
    - Hamburger (24px outline)
    - Goblin-Wordmark (Fraunces, var(--ochre))
    - Tab-Pills (Chat | Code | Preview als Icons-only, active filled)
    - Ochre Plus-FAB (36px round) — onClick öffnet Popover mit "Neuer Chat" / "Neues Projekt"
  - **Erwartung Desktop:** wie Mobile, aber Tab-Pills zeigen Labels + Avatar-Dropdown sichtbar
  - **Failure-Signal:** "Help" Button noch im Avatar-Menu. Tabs unsichtbar in Workspace. Plus-Button fehlt.

- [ ] **BUG-020 — Recent Chats Project-Badge**
  - **Vorbereitung:** Chat in Projekt erstellen + 1 Nachricht senden
  - **Aktion:** Sidebar öffnen → Recent Chats scrollen
  - **Erwartung:** Chat-Eintrag zeigt 📁 + Projekt-Name als kleines Badge unter Title.
  - **Failure-Signal:** Nur Title sichtbar ohne Badge.

---

## Result

- [ ] **Alle 15 Checks green** → 9C+9C1 bereit für Vercel-Deploy + Session 9D
- [ ] **Mindestens 1 red** → siehe Notes unten + Screenshots, zurück zu Claude Code

### Notes (bei red Checks)

```
BUG-XXX: Beschreibung was passiert ist + Screenshot-Path
```

---

## Anti-Patterns die NICHT mehr existieren sollten (Negative-Checks)

- ❌ Mobile-Sidebar slidet von unten hoch
- ❌ "API Keys / Billing / Settings" als 3 separate Buttons in Mobile-Bottom-Row
- ❌ Floating "?" Help-Bubble bottom-right
- ❌ Support-Chat-Modal das öffnet aber nicht antwortet
- ❌ Footer Social-Icons als Single-Letters
- ❌ Landing-Pricing als Single-Plan ($9 only)
- ❌ Modal-Submit "Erstellen" → roter "invalid project data" Error

## Vor wichtigen Pushes — Lokales E2E

Zusätzlich zur Manual-QA:
```bash
pnpm test:e2e:local
```

Deckt Bereiche ab, die CI nicht testet:
- BYOK Decrypt + Usage
- Stripe Checkout
- Echte AI-Responses (Streaming, Send-to-Code, multi-block)
- Email-Delivery (Resend)
- Push-Notifications
- GitHub OAuth
