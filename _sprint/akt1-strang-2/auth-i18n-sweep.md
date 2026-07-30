# U3 — Auth-Surface i18n Sweep

**Founder's report:** starting on the English landing, navigating to Login → the
login page renders in German. He was unsure whether that is a leak or his own
stored preference.

**Verdict: both answers are right, for different pages.**

- `/login` is **not** leaking. A clean English visitor gets English.
  The founder's German login screen is his own stored preference.
- `/auth/confirm` and `/auth/reset-password` **were** leaking. A clean English
  visitor got German. Those are the two surfaces the reset-chain work added, and
  they are fixed in this unit.

---

## How the auth pages resolve locale

No URL segment, no cookie, no `Accept-Language`. One localStorage key,
`goblin:preferred-lang`, written at onboarding Step 0 and mirrored to
`users.preferred_lang`. The only thing that varies is **what happens when the key
is absent**, and there are two answers:

| Hook | Default when unset | Meant for |
|---|---|---|
| `useLang()` (`lib/use-lang.ts:36`) | **`de`** | app surfaces — the user has already answered Step 0 |
| `useAuthLang()` (`lib/use-auth-lang.ts`) | **`en`** | pre-auth surfaces — the visitor came from the English landing |

The marketing landing has no i18n mechanism at all: it is a static English
surface (`app/page.tsx`). So nothing "propagates" from landing to `/login` —
there is nothing to propagate. The pre-auth default *is* the mechanism, and
picking `useLang()` on a pre-auth page silently makes that page German.

## Clean-visitor simulation — BEFORE

Server-rendered first paint from **this checkout** (`next dev`, `curl` with
`Accept-Language: en-US,en;q=0.9`, no stored preference). Not production.

```
login                DE=[]                                  EN=[Password, Sign in]
confirm (recovery)   DE=[Bestätige, Passwort]               EN=[]
confirm (signup)     DE=[Bestätige, bestätigen]             EN=[]
reset-password       DE=[Passwort, Wähle ein starkes]       EN=[]
```

`/auth/confirm` is the page a user reaches by clicking the button in a password-
reset mail sent from an English screen. It greeted them with
*"Bestätige mit einem Klick, dass du diesen Link geöffnet hast"*.

## Clean-visitor simulation — AFTER

Same method, same checkout, after the fix:

```
login                DE=[] EN=[Password, Sign in]
confirm (recovery)   DE=[] EN=[Set a new password]
confirm (signup)     DE=[] EN=[Confirm your …]
confirm (incomplete) DE=[] EN=[Incomplete link]
reset-password       DE=[] EN=[Choose a strong …]
```

## The fix

`useAuthLang` was private to `app/(auth)/login/page.tsx`, which is why the two
newer pages could not reach it and grabbed `useLang()` instead. It now lives in
`lib/use-auth-lang.ts` and all three pre-auth pages import it — the surface
declares which locale family it belongs to, exactly as the landing's
`InstallAppBlock` was fixed to do.

Regression guard: `lib/use-auth-lang.test.ts` (10 tests). Besides the default
behaviour it holds a **static** assertion — each pre-auth page must import
`useAuthLang` and must not import `useLang` — because the regression is a wrong
import, which no runtime assertion on these pure functions could catch.

## Should a returning user's stored preference override the landing locale?

**Recommendation, not a decision — this is the founder's call.**

Today the stored preference wins on every surface, and we recommend keeping it.
A user who chose German at onboarding chose it for the product, and the landing
being English is a property of the landing (it has no toggle), not a signal about
the user. Flipping the rule would mean a German user is shown a German app but an
English login screen every time their session expires, which reads as a bug.

The remaining rough edge is the first frame: SSR renders the default (`en`), then
the client corrects to `de` on mount. A returning German user sees one English
frame. Removing it needs the preference in a cookie so the server can read it —
a real change, deliberately not made here.

## Honest limitations

- All rendered evidence above is the **server-rendered first paint**. That is
  precisely what a clean visitor sees and what the bug was about, but it does not
  exercise hydration.
- The **DE direction** (stored `de` → German pre-auth pages) is covered by unit
  test (`readAuthLang` returns `de` when stored), **not** by rendered proof. The
  local dev server in this container did not hydrate reliably — a click on a
  React handler produced no DOM change — so no browser-level assertion about
  post-mount language is claimed. On-device check for the founder: open
  `/login` with German chosen; it must be German.
- Nothing here was verified against the deployed production app.
