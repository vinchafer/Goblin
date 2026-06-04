# Sprint 10.9-5 — Admin User Setup (Founder action)

`/admin/catalog` (and the rest of `/admin`) is gated by `users.is_admin`. Grant
yourself admin once migration 0064 is applied:

```sql
UPDATE users SET is_admin = TRUE WHERE email = 'vinc.hafner@gmail.com';
```

Run it in Supabase Studio → SQL Editor.

## Before the migration / as a fallback

The admin layout **and** the `/api/admin` proxy also honour an `ADMIN_EMAIL`
env var: if the signed-in user's email equals `ADMIN_EMAIL`, they get admin even
without the `is_admin` flag. This is env-only (never a hardcoded email). Useful
to verify the dashboard before granting the DB flag.

- Set on the **web** service: `ADMIN_EMAIL=vinc.hafner@gmail.com`
- Remove it again once `is_admin` is set, if you prefer DB-only gating.

## Verify the deny path

A non-admin user (e.g. `vinc.hafner3@gmail.com`, no `is_admin`, not `ADMIN_EMAIL`)
hitting `/admin/catalog` is redirected to `/dashboard`, and `GET /api/admin/catalog`
returns **403**.
