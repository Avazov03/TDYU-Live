-- Phase 2.4A: Align legacy runtime schema with Prisma (additive / idempotent)
-- Closes verified migration-history gaps for:
--   - public.entitlements (legacy platform tariff; still used by V1 paths)
--   - users.last_login_at (auth / admin)
--   - lessons.recording_url (legacy local recording URL; Recording model unchanged)
--
-- Safe on staging (objects already exist via earlier db push): IF NOT EXISTS / exception guards.
-- Safe on fresh migrate-only DBs: creates the missing objects.
--
-- Does NOT:
--   - drop or recreate entitlements
--   - delete data
--   - change Recording architecture
--   - enable Checkout V2
--
-- Rollback (manual, destructive — do not run on staging with live data without review):
--   ALTER TABLE "lessons" DROP COLUMN IF EXISTS "recording_url";
--   ALTER TABLE "users" DROP COLUMN IF EXISTS "last_login_at";
--   DROP TABLE IF EXISTS "entitlements";

-- 1) entitlements — match Prisma Entitlement model exactly (no updated_at)
CREATE TABLE IF NOT EXISTS "entitlements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tier" "TariffTier" NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "entitlements_user_id_key"
ON "entitlements"("user_id");

DO $$ BEGIN
  ALTER TABLE "entitlements"
    ADD CONSTRAINT "entitlements_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) users.last_login_at — DateTime? / TIMESTAMP(3) nullable
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3);

-- 3) lessons.recording_url — String? / TEXT nullable (legacy runtime column)
ALTER TABLE "lessons"
  ADD COLUMN IF NOT EXISTS "recording_url" TEXT;
