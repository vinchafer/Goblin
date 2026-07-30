# Auth-Mail-Vorschauen (AKT1-STRANG-2 · U4)

Mit den echten Templates gerendert, **nichts verschickt**. Der Token im Button-Link
ist ein Platzhalter — die Links funktionieren bewusst nicht.

Empfänger im Beispiel: `vinc.hafner3@gmail.com` · Origin: `https://www.justgoblin.com`

Jede Mail trägt Deutsch **und** Englisch in einer Nachricht — eine Datei pro Typ
ist also die vollständige zweisprachige Vorschau.

| Typ | Betreff | Datei |
|---|---|---|
| `recovery` | Passwort zurücksetzen · Reset your password | [recovery.html](./recovery.html) |
| `signup` | Bestätige deine E-Mail-Adresse · Confirm your email address | [signup.html](./signup.html) |
| `email_change` | Neue E-Mail-Adresse bestätigen · Confirm your new email address | [email_change.html](./email_change.html) |
| `magiclink` | Dein Anmeldelink für Goblin · Your sign-in link for Goblin | [magiclink.html](./magiclink.html) |
| `invite` | Du wurdest zu Goblin eingeladen · You have been invited to Goblin | [invite.html](./invite.html) |

Neu erzeugen:

```
pnpm --filter @goblin/api exec tsx src/scripts/render-auth-mail-previews.ts
```