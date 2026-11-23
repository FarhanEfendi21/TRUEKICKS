-- ============================================================
-- TrueKicks Tier 1 Migration:
-- Payment Gateway (Midtrans Snap) + Idempotent Webhook Columns
-- 1. Payment tracking columns on `orders`
-- 2. Unique index on `payment_gateway_order_id` for O(1) webhook lookup
-- 3. Safe backfill for historical pre-gateway orders
-- Idempotent: Safe to run multiple times in Supabase SQL Editor.
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'midtrans';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_gateway_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_token TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_redirect_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_restored BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_gateway_order_id
  ON orders(payment_gateway_order_id)
  WHERE payment_gateway_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON orders(payment_status);

-- Backfill historical orders placed before Payment Gateway rollout so they
-- remain treated as paid and do not display "Pay Now" prompts.
UPDATE orders
SET payment_status = 'paid',
    paid_at = COALESCE(paid_at, created_at)
WHERE payment_gateway_order_id IS NULL
  AND payment_status = 'pending'
  AND LOWER(COALESCE(status, '')) IN ('processing', 'packed', 'shipped', 'delivered', 'completed', 'paid');
