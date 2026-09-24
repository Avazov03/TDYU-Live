-- Phase 4 foundation closeout: capture LessonAsset in migration history
-- Staging already has public.lesson_assets (historical db push). Fresh migrate-only DBs did not.
-- Additive / idempotent. Does not delete data. Does not change Recording architecture.
--
-- Rollback (manual, destructive):
--   DROP TABLE IF EXISTS "lesson_assets";

CREATE TABLE IF NOT EXISTS "lesson_assets" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lesson_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lesson_assets_lesson_id_idx"
ON "lesson_assets"("lesson_id");

DO $$ BEGIN
  ALTER TABLE "lesson_assets"
    ADD CONSTRAINT "lesson_assets_lesson_id_fkey"
    FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
