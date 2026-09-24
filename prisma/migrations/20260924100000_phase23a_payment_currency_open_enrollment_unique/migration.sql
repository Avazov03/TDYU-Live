-- Phase 2.3A: Checkout V2 additive schema
-- - Payment.currency (UZS) for explicit payment currency
-- - Partial unique: one open enrollment per (user_id, course_id)
-- Does NOT change Payment.tier (legacy NOT NULL remains).
-- Does NOT modify V1 application paths.
--
-- Rollback (manual):
--   DROP INDEX IF EXISTS "enrollments_one_open_per_user_course";
--   ALTER TABLE "payments" DROP COLUMN IF EXISTS "currency";

-- 1) Payment.currency — existing rows receive DEFAULT 'UZS' on ADD
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'UZS';

-- Explicit backfill (idempotent; safe if column already existed without values)
UPDATE "payments"
SET "currency" = 'UZS'
WHERE "currency" IS NULL OR btrim("currency") = '';

-- Ensure default remains for new inserts (idempotent)
ALTER TABLE "payments"
  ALTER COLUMN "currency" SET DEFAULT 'UZS';

ALTER TABLE "payments"
  ALTER COLUMN "currency" SET NOT NULL;

-- 2) Open-enrollment uniqueness (allows historical refunded/closed/cancelled rows)
-- Precondition: no duplicate (user_id, course_id) among open seats.
-- If CREATE fails → STOP; do not delete/merge rows automatically.
CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_one_open_per_user_course"
ON "enrollments" ("user_id", "course_id")
WHERE "access_open" = true
  AND "status" IN ('active', 'completed');
