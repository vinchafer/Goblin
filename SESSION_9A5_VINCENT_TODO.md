# SESSION 9A5 — Vincent TODOs (Manuell)

## Priorität 1 — Muss für Trust/Auth

### Supabase Custom Domain
**Problem:** Nach Google-OAuth ist `https://[supabase-id].supabase.co/auth/v1/callback` in der URL-Bar sichtbar. Das ist ein Trust-Killer.

**Fix:**
1. Supabase Dashboard → Project Settings → Custom Domains
2. Add `auth.justgoblin.com` als CNAME zu `[project-id].supabase.co`
3. Supabase Dashboard → Authentication → URL Configuration:
   - Site URL: `https://app.justgoblin.com`
   - Redirect URLs: `https://app.justgoblin.com/auth/callback`
4. DNS bei deinem Domain-Provider: `auth.justgoblin.com CNAME [project-id].supabase.co`

### GitHub OAuth aktivieren (falls noch nicht)
**Prüfe:** Settings → Auth → Providers → GitHub. Falls disabled, aktivieren:
1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Callback URL: `https://[project-id].supabase.co/auth/v1/callback` (oder nach Custom Domain: `https://auth.justgoblin.com/auth/v1/callback`)
3. Client ID + Secret in Supabase eintragen

---

## Priorität 2 — Sidebar FloatingToolbar (aus Session 9A)

Die FloatingToolbar wurde in Session 9A gebaut (`components/mobile/floating-toolbar.tsx`) aber noch nicht verdrahtet. Lies `SESSION_9A_VINCENT_TODO.md` für Details.

---

## Priorität 3 — Review & Iteration 2

1. Schau Screenshots in `docs/screenshots/after-9A5/` an (wenn vorhanden)
2. Schreib konkrete Punkte in `docs/VINCENT_FEEDBACK_9A5_ITERATION_1.md`
3. Falls Iteration 2 gewünscht: Schreib am Ende: `## Approve Iteration 2: YES`

**Meine Empfehlung:** Iteration 2 ist sinnvoll für:
- Workspace Empty States (größter Impact)
- Auth-Page Lesbarkeit bei Sonne
- Notifications + Appearance als eigenständige Settings-Pages

---

## Priorität 4 — Optional / Nice-to-have

- `pnpm remove lucide-react --filter @goblin/web` (aus Session 9A, optional cleanup)
- Voice Input auf iPhone testen
