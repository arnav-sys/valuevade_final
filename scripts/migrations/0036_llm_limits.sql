-- 0036_llm_limits.sql — Feb 2026
--
-- Enforce two hard limits per user:
--  (1) Personalised path (`/customize/generate`) — max 4 generations lifetime.
--  (2) Pari chatbot (all doubt sessions & extended chats) — cumulative LLM
--      cost capped at ₹500 per user. Once exceeded, Pari is disabled.
--
-- Also backfills missing `user_capstone_projects` rows so the multi-capstone
-- (CAP-01/02/03) flow renders correctly for every active enrollment.

BEGIN;

-- 1. Profile counters ---------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS customize_generations_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pari_total_cost_inr numeric(12, 4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.customize_generations_count IS
  'Lifetime count of successful /customize/generate calls. Hard-capped at 4 in server.py.';
COMMENT ON COLUMN public.profiles.pari_total_cost_inr IS
  'Cumulative INR cost of Claude Haiku calls attributed to this user across doubts + extended chats. Hard-capped at 500.00.';

-- 2. Atomic increment helpers (rpc/*) ----------------------------------------
CREATE OR REPLACE FUNCTION public.increment_customize_generations(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.profiles
     SET customize_generations_count = COALESCE(customize_generations_count, 0) + 1
   WHERE id = p_user_id
  RETURNING customize_generations_count INTO v_count;
  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_pari_cost(p_user_id uuid, p_cost_inr numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
BEGIN
  UPDATE public.profiles
     SET pari_total_cost_inr = COALESCE(pari_total_cost_inr, 0) + GREATEST(p_cost_inr, 0)
   WHERE id = p_user_id
  RETURNING pari_total_cost_inr INTO v_total;
  RETURN COALESCE(v_total, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_customize_generations(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_pari_cost(uuid, numeric)          TO service_role;

-- 3. Backfill missing user_capstone_projects rows ----------------------------
-- Ensure every active enrollment has a user_capstone_projects row for every
-- master capstone tied to its path. Idempotent: skips rows that already exist.
INSERT INTO public.user_capstone_projects (enrollment_id, master_capstone_id)
SELECT
  ue.id AS enrollment_id,
  mcp.id AS master_capstone_id
FROM public.user_enrollments ue
JOIN public.master_capstone_projects mcp
  ON mcp.path_id = ue.master_path_id
WHERE ue.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_capstone_projects ucp
     WHERE ucp.enrollment_id = ue.id
       AND ucp.master_capstone_id = mcp.id
  )
ON CONFLICT DO NOTHING;

COMMIT;
