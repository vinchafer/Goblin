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

## Result

- [ ] **Alle 10 Checks green** → 9C bereit für Vercel-Deploy + Session 9D
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
