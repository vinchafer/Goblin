# Auth-Mail über den Supabase Send-Email-Hook — Einrichtung

**AKT 1 · FEHLERSTRANG-1 · U2+U3 · Stand 2026-07-28**

Dieses Dokument beschreibt den **einen** Schritt, den der Founder im Supabase-Dashboard
klicken muss, damit Goblins Auth-Mails aus dem Repo kommen statt aus Supabase-Defaults.
Alles andere ist Code.

---

## Was sich ändert

**Vorher:** Supabase rendert die Auth-Mails selbst (minimaler Text, ein nackter Link) und
verschickt sie über seinen eingebauten Mailer. Der Link trägt einen PKCE-`code`, der nur
in dem Browser eingelöst werden kann, der den Reset **angefordert** hat.

**Nachher:** Supabase ruft bei jeder Auth-Mail `POST /api/auth/email-hook` auf. Goblin
rendert die Mail aus `apps/api/src/lib/auth-email-templates.ts` (DE + EN in einer Mail)
und verschickt sie über den bestehenden Resend-Service. Der Link zeigt auf
`/auth/confirm?token_hash=…` — einlösbar in **jedem** Browser, und er löst **nichts** ein,
solange niemand den Button drückt.

**Bis der Hook aktiviert ist, ändert sich nichts.** Ohne `SUPABASE_AUTH_HOOK_SECRET`
verweigert der Endpoint jeden Aufruf, Supabase verschickt weiter selbst. Der Code ist in
beiden Zuständen lauffähig — die alten `?code=`-Links in bereits verschickten Mails
funktionieren unverändert weiter (Legacy-Pfad in `/auth/reset-password`).

---

## Der eine Dashboard-Schritt

1. Supabase Dashboard → **Authentication → Hooks** → **Send Email** → *Enable*.
2. **Hook-Typ:** `HTTPS`.
3. **URL:** `https://<API-Origin>/api/auth/email-hook`
   (derselbe Origin wie `NEXT_PUBLIC_API_URL` — der Railway-API-Host, **nicht** justgoblin.com).
4. Supabase erzeugt beim Aktivieren ein **Secret** in der Form `v1,whsec_…`.
   Diesen Wert kopieren.

## Die begleitenden Env-Variablen (API-Host, z. B. Railway)

| Variable | Wert | Wirkung |
|---|---|---|
| `SUPABASE_AUTH_HOOK_SECRET` | das in Schritt 4 kopierte Secret | **Kill-Switch.** Nicht gesetzt ⇒ der Endpoint lehnt jeden Aufruf ab. |
| `NEXT_PUBLIC_APP_URL` | `https://justgoblin.com` | Origin für Button-Link und Footer-Links. Fällt sonst auf `https://justgoblin.com` zurück. |
| `RESEND_API_KEY` | bereits gesetzt | Versandweg. Ohne ihn wird nichts verschickt (und der Hook meldet das als Fehler, statt Erfolg vorzutäuschen). |

Das Secret gehört **nur** in die Env des API-Hosts. Es steht in keinem Repo-File.

---

## Verifikation nach dem Aktivieren

Nur mit Testaccount (`vinc.hafner3@gmail.com`), nie mit dem persönlichen Konto.

1. **Reset device-übergreifend:** Reset in der installierten PWA anfordern → Mail in der
   Gmail-App öffnen → Link tippt sich in Safari auf → die Seite zeigt einen Button, **nicht**
   sofort ein Ergebnis → Button drücken → Passwort-Formular erscheint → neues Passwort
   setzen → Anmeldung mit dem neuen Passwort.
   *Das ist der Fall, der vorher immer „Reset link expired or already used" ergab.*
2. **Scanner-Test:** Den Link aus der Mail kopieren und mit `curl -sI "<link>"` abrufen,
   **ohne** ihn im Browser zu öffnen. Danach den Link im Browser öffnen und den Button
   drücken — er muss noch funktionieren. Ein GET darf den Token nicht verbrauchen.
3. **Signup-Bestätigung:** frisches Konto anlegen → Bestätigungsmail (ggf. aus dem
   Spam-Ordner) → Button → Anmeldung möglich.
4. **Spam-Prüfung:** Landet die neue Mail im Posteingang statt im Spam? DKIM/SPF sind
   bereits grün; DMARC ist bewusst nicht gesetzt (Founder-Entscheidung) und wird hier
   nicht vorausgesetzt.

## Zurückdrehen

`SUPABASE_AUTH_HOOK_SECRET` entfernen **oder** den Hook im Dashboard deaktivieren.
Beides bringt sofort das Supabase-Default-Verhalten zurück, ohne Deploy.

---

## Warum überhaupt ein Hook (und nicht nur bessere Dashboard-Templates)

Bessere Templates im Dashboard hätten das Spam-Problem teilweise adressiert, aber **nicht**
das Reset-Problem: Der Linktyp ist der Kern des Defekts. Ein Dashboard-Template kann zwar
`{{ .TokenHash }}` verwenden, aber die Templates lebten dann weiter außerhalb des Repos —
nicht versioniert, nicht reviewbar, nicht testbar, und jede Änderung wäre wieder
Handarbeit. Der Hook löst beide Probleme mit einem Mechanismus und kostet den Founder
genau einen Klick plus eine Env-Variable.

Der Fallback-Pfad (fertige Copy-Paste-Templates fürs Dashboard) ist damit **nicht** nötig
und wurde bewusst nicht gebaut.
