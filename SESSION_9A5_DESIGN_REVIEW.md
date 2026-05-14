# SESSION 9A5 — Self-Critique (Iteration 1)
**Date:** 2026-05-14

---

## Was gemacht wurde

| Phase | Status | Was geändert |
|---|---|---|
| Design Vision | ✅ | DESIGN_VISION_V1.md mit 5 Prinzipien |
| Landing Hero | ✅ | Cream background, moss CTA, dot grid |
| Footer | ✅ | Cream/subtle bg, volle Lesbarkeit, echte Links |
| Auth: Password Toggle | ✅ | Show/hide Eye-Button |
| Dashboard: New Project | ✅ | Moss-filled Button statt Ghost |
| Settings Hierarchy | ✅ | Linear-Style Groups (ACCOUNT/AI/WORKSPACE/BILLING/ADVANCED) |
| Developer Settings | ✅ | Unter ADVANCED, nur bei Advanced Mode sichtbar |
| Integrations | ✅ | Coming Soon Einträge (GitLab, Vercel, etc.) |
| Sidebar Icons | ✅ | Phosphor Icons für API Keys, Billing, Settings |

---

## Vergleichs-Tabelle (Iteration 1)

```
                 │ Claude.ai │ Cursor │ Linear │ Vercel │ Goblin │
─────────────────┼───────────┼────────┼────────┼────────┼────────┤
Sidebar          │     9     │   8    │   10   │   9    │   7    │
Settings         │     9     │   7    │   10   │   9    │   7    │
Empty States     │     8     │   7    │   9    │   9    │   5    │
Color System     │     9     │   8    │   9    │   10   │   8    │
Typography       │     9     │   8    │   10   │   9    │   7    │
Auth Flow        │     8     │   8    │   9    │   9    │   7    │
Landing Page     │     9     │   9    │   10   │   10   │   7    │
Mobile UX        │     7     │   5    │   8    │   8    │   6    │
Overall Polish   │     9     │   8    │   10   │   9    │   7    │
```

---

## Begründungen

### Sidebar — 7/10
**Was gut ist:** Collapse/expand vorhanden. Chats-Section under Projects. Phosphor Icons in Bottom Nav.
**Was fehlt vs. Linear:**
- Keine Usage-Bars für API-Keys
- Kein User-Avatar mit Plan-Badge unten
- Bottom-Nav-Buttons sind text-only — Linear hat nur Icons im collapsed state
- "Projekte" und "Chats" Labels fehlen noch im collapsed state

**→ 7/10 ehrlich. Mit 1 weiteren Pass → 8.5/10 erreichbar.**

### Settings — 7/10
**Was gut ist:** ACCOUNT/AI/WORKSPACE/BILLING/ADVANCED Hierarchy. Developer Tools unter ADVANCED. Coming Soon in Integrations.
**Was fehlt vs. Linear:**
- Kein separates "Appearance" Page (noch embedded unter Account)
- Notifications-Page existiert nicht (404 wenn geklickt)
- Profile-Page: kein Avatar-Upload
- Billing-Page ist ok aber fehlt: Plan-Vergleich auf der Seite selbst
- Hosted AI "Coming Soon" könnte stärker designed sein

**→ 7/10. Mit Appearance + Notifications Pages → 8.5/10.**

### Empty States — 5/10
**Was fehlt:**
- Workspace Chat-Tab: keine Goblin-Prompt-Suggestions
- Workspace Code-Tab: kein sinnvoller Empty State
- Workspace Preview-Tab: kein Empty State
- Dashboard Empty State existiert (gut), aber Starter-Cards könnten stärker sein

**→ 5/10. Größter Gap. Iteration 2 wenn freigegeben.**

### Color System — 8/10
**Was gut ist:** CSS Var System ist sauber. Light Mode ist Default. Dark Mode funktioniert.
**Was fehlt:**
- Auth-Page ist immer dark (hardcoded), ignoriert System-Theme
- Auth-Page Kontrast für sehr schwachen Text (rgba(255,255,255,0.18)) = fail WCAG
- Einige Footer-Links hatten zu wenig Kontrast (jetzt gefixt)

**→ 8/10. Auth-Page ist der einzige echte Schwachpunkt.**

### Typography — 7/10
**Was gut ist:** Fraunces für Brand-Headings, DM Sans für UI, JetBrains Mono für Code.
**Was fehlt:**
- Heading-Sizes inkonsistent zwischen Settings-Pages
- Keine klare Typographie-Hierarchie für Body vs. Captions (sie variieren pro Seite)
- Landing-Page: Sub-headline könnte stärker sein

**→ 7/10. OK aber nicht systematisch.**

### Auth Flow — 7/10
**Was gut ist:** Google + GitHub beide vorhanden. Password Show/Hide jetzt da. Form-Validierung.
**Was fehlt:**
- Auth-Page noch dark → schlechte Lesbarkeit in Sonne
- Supabase-URL nach Google-OAuth noch sichtbar (braucht Custom Domain → Vincent-Task)
- Kein "Back to landing" Link auf der Login-Page

**→ 7/10. Custom Domain ist blocker für Vertrauen — Vincent-Task.**

### Landing Page — 7/10
**Was gut ist:** Hero jetzt light (cream), lesbar. Footer jetzt lesbar. CTA Button prominent.
**Was fehlt:**
- Hero Headline: "The Cloud Workshop for Builders" ist OK aber nicht so sharp wie Linear's "Plan. Build. Ship."
- Kein Screenshot der App (App-Window-Mockup ist Platzhalter)
- Problem-Section sieht noch nach Template aus
- Pricing-Section: Geo-Toggle fehlt noch

**→ 7/10. Lesbarkeit gefixt. Substanz ausbaufähig.**

### Mobile UX — 6/10
**Was gut ist:** Bottom-Sheet-Drawer vorhanden. Touch-Targets 44px.
**Was fehlt:**
- FloatingToolbar noch nicht verdrahtet (Vincent-Task von 9A)
- Workspace auf Mobile ist schwierig (File-Tree + Chat + Preview)
- Bottom-Tab-Bar fehlt noch

**→ 6/10. Mobile ist strukturell OK aber nicht poliert.**

---

## Iteration 2 Empfehlung

**Iteration 2 BENÖTIGT:** JA — 6 von 9 Kategorien unter 8.

**Prioritäten für Iteration 2:**
1. Empty States im Workspace (Chat, Code, Preview) — größter Impact
2. Auth-Page: Light Mode Option oder Kontrast-Fix
3. Appearance + Notifications als eigenständige Settings-Pages
4. Workspace: Model Picker größer/sichtbarer
5. Dashboard "What's New" → nur zeigen wenn wirklich neu

---

## Vincent's Self-Assessment-Fragen

**Würde Vincent das seinem Investor zeigen?** — Teilweise. Footer, Hero, Sidebar-Hierarchy: JA. Workspace Empty States, Auth-Sunlight-Lesbarkeit: NEIN.

**Sieht das aus wie ein $9-$39/Monat Tool?** — Dafür ausreichend, aber nicht überzeugend. Settings-Hierarchy jetzt professionell. Workspace braucht noch Arbeit.

**Findet ein neuer User in 30 Sekunden was er machen soll?** — JA auf Dashboard (New Project Button prominent). NEIN im Workspace (keine Führung was als nächstes).

**Ist die Visual-Hierarchy klar?** — Auf den meisten Pages JA. Im Workspace NEIN.
