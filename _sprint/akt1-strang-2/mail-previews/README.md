# Auth-Mail-Vorschauen (AKT1-STRANG-2 · U4)

Mit den echten Templates gerendert, **nichts verschickt**. Der Token im Button-Link
ist ein Platzhalter — die Links funktionieren bewusst nicht.

Empfänger im Beispiel: `vinc.hafner3@gmail.com` · Origin: `https://www.justgoblin.com`

Jede Mail trägt Deutsch **und** Englisch in einer Nachricht — eine Datei pro Typ
ist also die vollständige zweisprachige Vorschau.

Jede Mail geht als **multipart/alternative** raus — HTML *und* Textteil.

| Typ | Betreff | HTML | Text |
|---|---|---|---|
| `recovery` | Goblin — Passwort zurücksetzen · Reset your password | [recovery.html](./recovery.html) | [recovery.txt](./recovery.txt) |
| `signup` | Goblin — E-Mail bestätigen · Confirm your email | [signup.html](./signup.html) | [signup.txt](./signup.txt) |
| `email_change` | Goblin — Neue Adresse bestätigen · Confirm your new address | [email_change.html](./email_change.html) | [email_change.txt](./email_change.txt) |
| `magiclink` | Goblin — Dein Anmeldelink · Your sign-in link | [magiclink.html](./magiclink.html) | [magiclink.txt](./magiclink.txt) |
| `invite` | Goblin — Deine Einladung · Your invitation | [invite.html](./invite.html) | [invite.txt](./invite.txt) |

Neu erzeugen:

```
pnpm --filter @goblin/api exec tsx src/scripts/render-auth-mail-previews.ts
```