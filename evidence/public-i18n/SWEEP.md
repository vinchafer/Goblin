# Clean-visitor locale sweep — WAVE-KORREKTUR-1 · U2

Target: `http://localhost:3100` (LOCAL CHECKOUT, `next build` + `next start`) · viewport 390×844 · fresh context per case.

## A · clean visitor, Accept-Language en-US (no stored anything)

| Surface | Rendered | Probes that fired |
|---|---|---|
| Landing (/) | **EN (EN-only surface)** | EN:"Install Goblin as an app" EN:"Start building" |
| /login | **EN** | EN:"Welcome back" EN:"Sign in to continue building" |
| /login?mode=signup | **EN** | EN:"Create your account" |
| /register (→ signup) | **EN** | EN:"Create your account" |
| /auth/reset-password | **EN** | EN:"Set new password" EN:"Request a new password reset" |
| /auth/confirm | **EN** | EN:"Incomplete link" |
| /about | **EN** | EN:"About" EN:"← Back" |
| /help | **EN** | EN:"Help" EN:"Clear guides" |
| /help/[slug] | **EN** | EN:"← All help articles" |
| /pricing | **EN (EN-only surface)** | EN:"Get started" |
| /terms (legal shell) | **EN (EN-only surface)** | EN:"Terms" |
| /status | **EN (EN-only surface)** | EN:"Report an incident" |
| /badge | **EN (EN-only surface)** | EN:"Built with Goblin" |
| /models | **DE (DE-only surface)** | DE:"Modelle, geordnet" |
| /changelog | **EN (EN-only surface)** | EN:"← Back" EN:"Changelog" |
| /manifesto | **EN (EN-only surface)** | EN:"← Back" EN:"Manifesto" |
| 404 (via public prefix) | **EN (EN-only surface)** | EN:"This page ran away" |
| /deletion-pending | **DE (DE-only surface)** | DE:"Dein Konto wird gelöscht" |

## B · clean visitor, Accept-Language de-DE

| Surface | Rendered | Probes that fired |
|---|---|---|
| Landing (/) | **EN (EN-only surface)** | EN:"Install Goblin as an app" EN:"Start building" |
| /login | **DE** | DE:"Willkommen zurück" DE:"Melde dich an" |
| /login?mode=signup | **DE** | DE:"Erstelle dein Konto" |
| /register (→ signup) | **DE** | DE:"Erstelle dein Konto" |
| /auth/reset-password | **DE** | DE:"Neues Passwort setzen" DE:"Fordere einen neuen" |
| /auth/confirm | **DE** | DE:"Link unvollständig" |
| /about | **DE** | DE:"Über uns" DE:"← Zurück" |
| /help | **DE** | DE:"Hilfe" DE:"Verständliche Anleitungen" |
| /help/[slug] | **DE** | DE:"← Alle Hilfe-Artikel" |
| /pricing | **EN (EN-only surface)** | EN:"Get started" |
| /terms (legal shell) | **EN (EN-only surface)** | EN:"Terms" |
| /status | **EN (EN-only surface)** | EN:"Report an incident" |
| /badge | **EN (EN-only surface)** | EN:"Built with Goblin" |
| /models | **DE (DE-only surface)** | DE:"Modelle, geordnet" |
| /changelog | **EN (EN-only surface)** | EN:"← Back" EN:"Changelog" |
| /manifesto | **EN (EN-only surface)** | EN:"← Back" EN:"Manifesto" |
| 404 (via public prefix) | **EN (EN-only surface)** | EN:"This page ran away" |
| /deletion-pending | **DE (DE-only surface)** | DE:"Dein Konto wird gelöscht" |

## C · the founder's device: onboarding preference 'de', EN browser

| Surface | Rendered | Probes that fired |
|---|---|---|
| Landing (/) | **EN (EN-only surface)** | EN:"Install Goblin as an app" EN:"Start building" |
| /login | **DE** | DE:"Willkommen zurück" DE:"Melde dich an" |
| /login?mode=signup | **DE** | DE:"Erstelle dein Konto" |
| /register (→ signup) | **DE** | DE:"Erstelle dein Konto" |
| /auth/reset-password | **DE** | DE:"Neues Passwort setzen" DE:"Fordere einen neuen" |
| /auth/confirm | **DE** | DE:"Link unvollständig" |
| /about | **DE** | DE:"Über uns" DE:"← Zurück" |
| /help | **DE** | DE:"Hilfe" DE:"Verständliche Anleitungen" |
| /help/[slug] | **DE** | DE:"← Alle Hilfe-Artikel" |
| /pricing | **EN (EN-only surface)** | EN:"Get started" |
| /terms (legal shell) | **EN (EN-only surface)** | EN:"Terms" |
| /status | **EN (EN-only surface)** | EN:"Report an incident" |
| /badge | **EN (EN-only surface)** | EN:"Built with Goblin" |
| /models | **DE (DE-only surface)** | DE:"Modelle, geordnet" |
| /changelog | **EN (EN-only surface)** | EN:"← Back" EN:"Changelog" |
| /manifesto | **EN (EN-only surface)** | EN:"← Back" EN:"Manifesto" |
| 404 (via public prefix) | **EN (EN-only surface)** | EN:"This page ran away" |
| /deletion-pending | **DE (DE-only surface)** | DE:"Dein Konto wird gelöscht" |

## D · explicit switcher choice DE, EN browser

| Surface | Rendered | Probes that fired |
|---|---|---|
| Landing (/) | **EN (EN-only surface)** | EN:"Install Goblin as an app" EN:"Start building" |
| /login | **DE** | DE:"Willkommen zurück" DE:"Melde dich an" |
| /login?mode=signup | **DE** | DE:"Erstelle dein Konto" |
| /register (→ signup) | **DE** | DE:"Erstelle dein Konto" |
| /auth/reset-password | **DE** | DE:"Neues Passwort setzen" DE:"Fordere einen neuen" |
| /auth/confirm | **DE** | DE:"Link unvollständig" |
| /about | **DE** | DE:"Über uns" DE:"← Zurück" |
| /help | **DE** | DE:"Hilfe" DE:"Verständliche Anleitungen" |
| /help/[slug] | **DE** | DE:"← Alle Hilfe-Artikel" |
| /pricing | **EN (EN-only surface)** | EN:"Get started" |
| /terms (legal shell) | **EN (EN-only surface)** | EN:"Terms" |
| /status | **EN (EN-only surface)** | EN:"Report an incident" |
| /badge | **EN (EN-only surface)** | EN:"Built with Goblin" |
| /models | **DE (DE-only surface)** | DE:"Modelle, geordnet" |
| /changelog | **EN (EN-only surface)** | EN:"← Back" EN:"Changelog" |
| /manifesto | **EN (EN-only surface)** | EN:"← Back" EN:"Manifesto" |
| 404 (via public prefix) | **EN (EN-only surface)** | EN:"This page ran away" |
| /deletion-pending | **DE (DE-only surface)** | DE:"Dein Konto wird gelöscht" |

## E · explicit switcher choice EN, DE browser (choice must outrank detection)

| Surface | Rendered | Probes that fired |
|---|---|---|
| Landing (/) | **EN (EN-only surface)** | EN:"Install Goblin as an app" EN:"Start building" |
| /login | **EN** | EN:"Welcome back" EN:"Sign in to continue building" |
| /login?mode=signup | **EN** | EN:"Create your account" |
| /register (→ signup) | **EN** | EN:"Create your account" |
| /auth/reset-password | **EN** | EN:"Set new password" EN:"Request a new password reset" |
| /auth/confirm | **EN** | EN:"Incomplete link" |
| /about | **EN** | EN:"About" EN:"← Back" |
| /help | **EN** | EN:"Help" EN:"Clear guides" |
| /help/[slug] | **EN** | EN:"← All help articles" |
| /pricing | **EN (EN-only surface)** | EN:"Get started" |
| /terms (legal shell) | **EN (EN-only surface)** | EN:"Terms" |
| /status | **EN (EN-only surface)** | EN:"Report an incident" |
| /badge | **EN (EN-only surface)** | EN:"Built with Goblin" |
| /models | **DE (DE-only surface)** | DE:"Modelle, geordnet" |
| /changelog | **EN (EN-only surface)** | EN:"← Back" EN:"Changelog" |
| /manifesto | **EN (EN-only surface)** | EN:"← Back" EN:"Manifesto" |
| 404 (via public prefix) | **EN (EN-only surface)** | EN:"This page ran away" |
| /deletion-pending | **DE (DE-only surface)** | DE:"Dein Konto wird gelöscht" |

## Switcher walk (the founder's acceptance test, automated)

| Step | Expected | Got | |
|---|---|---|---|
| landing → press DE → /login | DE | DE | ✅ |
| /login → press EN (instant, no reload) | EN | EN | ✅ |
| EN survives navigation away and back | EN | EN | ✅ |
| persisted key goblin:lang-choice | en | en | ✅ |
