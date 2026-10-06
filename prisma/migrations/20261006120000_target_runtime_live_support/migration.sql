-- Target runtime: teaching clock beats, one live lock per student, support tickets.
ALTER TABLE "live_sessions"
  ADD COLUMN IF NOT EXISTS "last_teacher_beat_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "manual_pause" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "live_account_locks" (
  "user_id" TEXT NOT NULL,
  "lesson_id" TEXT NOT NULL,
  "instance_id" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "live_account_locks_pkey" PRIMARY KEY ("user_id")
);

CREATE INDEX IF NOT EXISTS "live_account_locks_lesson_id_idx" ON "live_account_locks"("lesson_id");

DO $$ BEGIN
  ALTER TABLE "live_account_locks"
    ADD CONSTRAINT "live_account_locks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "course_id" TEXT,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "support_tickets_user_id_status_idx" ON "support_tickets"("user_id", "status");
CREATE INDEX IF NOT EXISTS "support_tickets_status_created_at_idx" ON "support_tickets"("status", "created_at");

DO $$ BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
