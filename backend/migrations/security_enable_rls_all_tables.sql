-- ============================================================
-- TrueKicks Security Hardening Migration:
-- Enable Row Level Security (RLS) Across All Public Tables
--
-- IMPORTANT — EXECUTION ORDER (ZERO DOWNTIME):
--   1. FIRST set SUPABASE_SERVICE_ROLE_KEY in backend/.env AND
--      in Vercel Backend Environment Variables, then restart backend.
--   2. SECOND run this SQL script in Supabase SQL Editor.
--
-- Architecture:
--   - Express backend authenticates users via HttpOnly JWT cookie
--     (authMiddleware) and accesses Supabase with `service_role`,
--     which bypasses RLS safely on the server only.
--   - Browser (`VITE_SUPABASE_ANON_KEY`) gets READ-ONLY access
--     exclusively to public storefront tables & Realtime channels
--     (`product_variants`, `reviews`).
--   - All sensitive tables (`users`, `orders`, `cart_items`,
--     `wishlist_items`, `user_addresses`, `coupons`, `drop_reminders`)
--     have RLS enabled with ZERO public policies (100% blocked from
--     direct browser/anon access).
--
-- Idempotent: Safe to run multiple times.
-- ============================================================

-- 1. PRIVATE / SENSITIVE TABLES (RLS ON, ZERO PUBLIC POLICIES — service_role ONLY)
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
  private_tables TEXT[] := ARRAY[
    'users',
    'orders',
    'cart_items',
    'wishlist_items',
    'user_addresses',
    'coupons',
    'drop_reminders'
  ];
BEGIN
  FOREACH tbl IN ARRAY private_tables LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

      -- Drop any overly permissive existing policies on private tables
      FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- 2. PUBLIC READ-ONLY CATALOG & REALTIME TABLES (RLS ON, SELECT ONLY FOR anon/authenticated)
-- No INSERT / UPDATE / DELETE policies exist for anon or authenticated,
-- so browser clients cannot mutate catalog, stock, or reviews directly.
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
  public_read_tables TEXT[] := ARRAY[
    'sneakers',
    'apparel',
    'products',
    'sale_products',
    'categories',
    'product_variants',
    'reviews',
    'drops'
  ];
BEGIN
  FOREACH tbl IN ARRAY public_read_tables LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

      -- Replace any existing policies with a strict read-only policy
      FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
      END LOOP;

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true);',
        'Public read ' || tbl,
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- 3. LOCK DOWN ATOMIC STOCK RPCs TO service_role ONLY
-- Prevents anonymous callers from invoking stock deduction/restoration via PostgREST.
DO $$
BEGIN
  IF to_regprocedure('public.deduct_variant_stocks(jsonb)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.deduct_variant_stocks(JSONB) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.deduct_variant_stocks(JSONB) TO service_role;
  END IF;

  IF to_regprocedure('public.restore_variant_stocks(jsonb)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.restore_variant_stocks(JSONB) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.restore_variant_stocks(JSONB) TO service_role;
  END IF;
END $$;
