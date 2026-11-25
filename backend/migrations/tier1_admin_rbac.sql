-- ============================================================
-- TrueKicks Tier 1 Migration:
-- Role-Based Access Control (RBAC) for Admin Dashboard (/admin)
-- 1. Adds `role` column ('customer' | 'admin') on `users`
-- 2. Adds CHECK constraint and index for fast admin lookups
-- 3. Keeps existing accounts as 'customer' by default
-- Idempotent: Safe to run multiple times in Supabase SQL Editor.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================
-- Promote your store owner account to Admin after running this:
-- Replace the email below with your TrueKicks account email.
-- ============================================================
-- UPDATE users
-- SET role = 'admin'
-- WHERE LOWER(email) = 'your-admin-email@example.com';
