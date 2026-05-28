-- =================================================================
-- Goblin Security Fix: RLS + Function Lockdown + View Fix
-- =================================================================
-- Context: Supabase Security Advisor flagged these issues.
--
-- The Hono API (apps/api) uses the SERVICE ROLE key, which bypasses
-- RLS and REVOKE. These changes only constrain the anon/authenticated
-- keys used from the browser. No backend functionality is affected.
-- =================================================================


-- =================================================================
-- PART A: Enable RLS on backend-only tables
-- =================================================================
-- Enabling RLS with NO policy = default-deny for anon/authenticated.
-- The service-role key bypasses RLS, so the backend is unaffected.

-- 1. free_api_usage — free-tier API usage per provider
ALTER TABLE public.free_api_usage ENABLE ROW LEVEL SECURITY;

-- 2. oauth_states — CSRF state tokens for GitHub OAuth flow
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- 3. incidents — internal incident tracking
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- 4. login_attempts — login attempt logs (IPs, timestamps)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- 5. deletion_audit_log — backend-only audit trail.
-- RLS already enabled with zero policies. Default-deny is intentional
-- and correct: only the service role should ever touch this table.
COMMENT ON TABLE public.deletion_audit_log IS
  'Backend-only audit trail. RLS enabled with NO policy by design: default-deny for anon/authenticated; service role bypasses RLS.';

-- 6. user_recovery_codes — users must read their own recovery codes
-- from the frontend. Add a SELECT-only owner policy.
DROP POLICY IF EXISTS "user_recovery_codes_owner_select" ON public.user_recovery_codes;
CREATE POLICY "user_recovery_codes_owner_select" ON public.user_recovery_codes
  FOR SELECT USING (auth.uid() = user_id);


-- =================================================================
-- PART B: Lock down SECURITY DEFINER functions
-- =================================================================
-- These six functions are backend-internal and must NOT be callable
-- via PostgREST (/rest/v1/rpc/<name>) by anon or authenticated keys.
-- The service-role key is unaffected by REVOKE.
-- Argument types verified against the source migrations.

REVOKE EXECUTE ON FUNCTION public.get_or_create_user_kek(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_user_kek(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.increment_byok_usage(uuid, text, bigint, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.increment_daily_request_count(uuid, date) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.increment_free_api_usage(text) FROM anon, authenticated, public;


-- =================================================================
-- PART C: Fix SECURITY DEFINER view + mutable search_path
-- =================================================================

-- C1. monthly_costs_per_user — recreate as SECURITY INVOKER so it runs
-- with the querier's permissions and respects RLS on completion_costs.
DROP VIEW IF EXISTS public.monthly_costs_per_user;
CREATE VIEW public.monthly_costs_per_user
  WITH (security_invoker = true)
AS
select
  user_id,
  date_trunc('month', created_at) as month,
  provider,
  sum(tokens_in) as tokens_in,
  sum(tokens_out) as tokens_out,
  sum(cost_usd) as cost_usd,
  count(*) as completions
from public.completion_costs
group by user_id, date_trunc('month', created_at), provider;

-- C2. Pin search_path on functions with mutable search_path.
-- handle_new_user and increment_byok_usage already reference their tables
-- with the public. schema prefix, so an empty search_path is safe.
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.increment_byok_usage(uuid, text, bigint, bigint) SET search_path = '';

-- increment_free_api_usage referenced its table UNQUALIFIED in the original
-- definition (0008). With search_path = '' that would fail at runtime, so
-- recreate it with public.-qualified table references before pinning.
CREATE OR REPLACE FUNCTION public.increment_free_api_usage(p_provider TEXT)
RETURNS TABLE(request_count INTEGER, daily_limit INTEGER) AS $$
DECLARE
  v_count INTEGER;
  v_limit INTEGER;
BEGIN
  INSERT INTO public.free_api_usage (provider, date, request_count)
  VALUES (p_provider, CURRENT_DATE, 1)
  ON CONFLICT (provider, date)
  DO UPDATE SET request_count = public.free_api_usage.request_count + 1
  RETURNING public.free_api_usage.request_count INTO v_count;

  v_limit := CASE p_provider
    WHEN 'gemini' THEN 1500
    WHEN 'groq' THEN 14000
    ELSE 100
  END;

  RETURN QUERY SELECT v_count, v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- =================================================================
-- PART D: Manual action reminder
-- =================================================================
-- MANUAL ACTION REQUIRED: In Supabase Dashboard → Authentication → Settings →
-- enable "Leaked Password Protection" (HaveIBeenPwned check).
-- This cannot be set via SQL migration.
