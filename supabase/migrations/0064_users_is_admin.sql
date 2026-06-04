-- Sprint 10.9-5 — Admin flag for /admin/catalog gating.
-- Additive + idempotent; founder applies in Supabase Studio.
-- (The column is already referenced by routes/admin.ts; this guarantees it
--  exists in every environment. Until applied, the route falls back to gating
--  by ADMIN_EMAIL — see ADMIN_USER_SETUP.md.)

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
