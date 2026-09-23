-- Phase 1: additive target domain foundation.
-- Legacy Tariff/Entitlement/Subscription/Payment demo flow UNCHANGED at application layer.
-- Rollback: DROP new tables/columns/enums (see docs/architecture/MIGRATION-PLAN.md).

-- LessonStatus additive values (keep lobby)
DO $$ BEGIN ALTER TYPE "LessonStatus" ADD VALUE 'waiting_room'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "LessonStatus" ADD VALUE 'paused'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "LessonStatus" ADD VALUE 'recording_processing'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "LessonStatus" ADD VALUE 'recording_ready'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "LessonStatus" ADD VALUE 'teacher_review'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "LessonStatus" ADD VALUE 'published'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "LessonStatus" ADD VALUE 'cancelled'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TYPE "PaymentStatus" ADD VALUE 'cancelled'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "PaymentStatus" ADD VALUE 'refund_requested'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "PaymentStatus" ADD VALUE 'refund_processing'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "PaymentStatus" ADD VALUE 'refunded'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "PaymentStatus" ADD VALUE 'refund_failed'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'course_published'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'purchase_success'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'course_starts_tomorrow'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'schedule_changed'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'lesson_cancelled'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'course_cancelled'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'refund_completed'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'recording_published'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'teacher_changed'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CourseLifecycleStatus" AS ENUM (
    'draft', 'submitted', 'in_review', 'changes_requested', 'rejected', 'approved',
    'published', 'upcoming', 'active', 'completed', 'archived', 'cancelled', 'unpublished'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AccountStatus" AS ENUM ('active', 'restricted', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PurchaseStatus" AS ENUM (
    'pending', 'completed', 'failed', 'refunded', 'partially_refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'completed', 'cancelled', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RefundStatus" AS ENUM (
    'requested', 'approved', 'processing', 'refunded', 'failed', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RefundType" AS ENUM ('full_100', 'half_50', 'course_cancel_100');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LiveSessionStatus" AS ENUM (
    'created', 'waiting', 'live', 'paused', 'ended', 'abandoned'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RecordingStatus" AS ENUM (
    'not_started', 'processing', 'ready', 'teacher_review', 'published', 'failed', 'hidden'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CourseReviewDecision" AS ENUM (
    'submitted', 'changes_requested', 'rejected', 'approve_publish'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IncidentLevel" AS ENUM ('info', 'warning', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IncidentStatus" AS ENUM ('open', 'acknowledged', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User additive columns
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "purchase_allowed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_status" "AccountStatus" NOT NULL DEFAULT 'active';

UPDATE "users"
SET
  "purchase_allowed" = NOT "is_blocked",
  "account_status" = CASE WHEN "is_blocked" THEN 'restricted'::"AccountStatus" ELSE 'active'::"AccountStatus" END;

-- Course additive columns
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "lifecycle_status" "CourseLifecycleStatus";
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "list_price" INTEGER;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "capacity" INTEGER;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "topic_uz" TEXT;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "short_description_uz" TEXT;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "starts_at_approx" TIMESTAMP(3);
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Tashkent';
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "approved_by_user_id" TEXT;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "published_by_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "courses_lifecycle_status_idx" ON "courses"("lifecycle_status");
CREATE INDEX IF NOT EXISTS "courses_teacher_id_idx" ON "courses"("teacher_id");

ALTER TABLE "courses"
  DROP CONSTRAINT IF EXISTS "courses_created_by_user_id_fkey",
  DROP CONSTRAINT IF EXISTS "courses_approved_by_user_id_fkey",
  DROP CONSTRAINT IF EXISTS "courses_published_by_user_id_fkey";

ALTER TABLE "courses"
  ADD CONSTRAINT "courses_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "courses_approved_by_user_id_fkey"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "courses_published_by_user_id_fkey"
    FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lesson additive columns
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "topic_uz" TEXT;
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "scheduled_end_at" TIMESTAMP(3);
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER;
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "is_additional" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "lessons_status_scheduled_at_idx" ON "lessons"("status", "scheduled_at");

-- Payment additive columns
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "purchase_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "is_demo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "external_txn_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);

UPDATE "payments" SET "is_demo" = true WHERE "is_demo" IS DISTINCT FROM true;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotency_key_key" ON "payments"("idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_external_txn_id_key" ON "payments"("external_txn_id");
CREATE INDEX IF NOT EXISTS "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "payments_course_id_idx" ON "payments"("course_id");

-- purchases
CREATE TABLE IF NOT EXISTS "purchases" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "amount_paid" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UZS',
  "status" "PurchaseStatus" NOT NULL DEFAULT 'pending',
  "idempotency_key" TEXT,
  "legacy_backfill" BOOLEAN NOT NULL DEFAULT false,
  "legacy_tier" "TariffTier",
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "purchases_idempotency_key_key" ON "purchases"("idempotency_key");
CREATE INDEX IF NOT EXISTS "purchases_user_id_created_at_idx" ON "purchases"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "purchases_course_id_idx" ON "purchases"("course_id");
CREATE INDEX IF NOT EXISTS "purchases_status_idx" ON "purchases"("status");

ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "purchases_user_id_fkey";
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "purchases_course_id_fkey";
ALTER TABLE "purchases"
  ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "purchases_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- enrollments
CREATE TABLE IF NOT EXISTS "enrollments" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "purchase_id" TEXT,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'active',
  "access_open" BOOLEAN NOT NULL DEFAULT true,
  "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "legacy_subscription_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_legacy_subscription_id_key" ON "enrollments"("legacy_subscription_id");
CREATE INDEX IF NOT EXISTS "enrollments_user_id_status_idx" ON "enrollments"("user_id", "status");
CREATE INDEX IF NOT EXISTS "enrollments_course_id_status_idx" ON "enrollments"("course_id", "status");
CREATE INDEX IF NOT EXISTS "enrollments_user_id_course_id_idx" ON "enrollments"("user_id", "course_id");
-- One ACTIVE enrollment per user+course (re-purchase after refund allowed)
CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_user_course_active_unique"
  ON "enrollments"("user_id", "course_id")
  WHERE "status" = 'active';

ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_user_id_fkey";
ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_course_id_fkey";
ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_purchase_id_fkey";
ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "enrollments_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- payments.purchase_id FK (after purchases exist)
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_purchase_id_fkey";
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_purchase_id_fkey"
  FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- refunds
CREATE TABLE IF NOT EXISTS "refunds" (
  "id" TEXT NOT NULL,
  "purchase_id" TEXT NOT NULL,
  "requested_by_id" TEXT NOT NULL,
  "decided_by_id" TEXT,
  "type" "RefundType" NOT NULL,
  "status" "RefundStatus" NOT NULL DEFAULT 'requested',
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "progress_percent" INTEGER,
  "decided_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "idempotency_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "refunds_idempotency_key_key" ON "refunds"("idempotency_key");
CREATE INDEX IF NOT EXISTS "refunds_purchase_id_idx" ON "refunds"("purchase_id");
CREATE INDEX IF NOT EXISTS "refunds_status_idx" ON "refunds"("status");

ALTER TABLE "refunds" DROP CONSTRAINT IF EXISTS "refunds_purchase_id_fkey";
ALTER TABLE "refunds" DROP CONSTRAINT IF EXISTS "refunds_requested_by_id_fkey";
ALTER TABLE "refunds" DROP CONSTRAINT IF EXISTS "refunds_decided_by_id_fkey";
ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "refunds_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "refunds_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- live_sessions
CREATE TABLE IF NOT EXISTS "live_sessions" (
  "id" TEXT NOT NULL,
  "lesson_id" TEXT NOT NULL,
  "status" "LiveSessionStatus" NOT NULL DEFAULT 'created',
  "active_teaching_seconds" INTEGER NOT NULL DEFAULT 0,
  "pause_seconds" INTEGER NOT NULL DEFAULT 0,
  "session_started_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "warn_55_sent" BOOLEAN NOT NULL DEFAULT false,
  "warn_58_sent" BOOLEAN NOT NULL DEFAULT false,
  "warn_59_sent" BOOLEAN NOT NULL DEFAULT false,
  "room_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "live_sessions_lesson_id_status_idx" ON "live_sessions"("lesson_id", "status");

ALTER TABLE "live_sessions" DROP CONSTRAINT IF EXISTS "live_sessions_lesson_id_fkey";
ALTER TABLE "live_sessions"
  ADD CONSTRAINT "live_sessions_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- recordings
CREATE TABLE IF NOT EXISTS "recordings" (
  "id" TEXT NOT NULL,
  "lesson_id" TEXT NOT NULL,
  "live_session_id" TEXT,
  "status" "RecordingStatus" NOT NULL DEFAULT 'not_started',
  "storage_key" TEXT,
  "mux_playback_id" TEXT,
  "duration_seconds" INTEGER,
  "ready_at" TIMESTAMP(3),
  "review_deadline_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "auto_published" BOOLEAN NOT NULL DEFAULT false,
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recordings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "recordings_lesson_id_status_idx" ON "recordings"("lesson_id", "status");
CREATE INDEX IF NOT EXISTS "recordings_status_review_deadline_at_idx" ON "recordings"("status", "review_deadline_at");

ALTER TABLE "recordings" DROP CONSTRAINT IF EXISTS "recordings_lesson_id_fkey";
ALTER TABLE "recordings" DROP CONSTRAINT IF EXISTS "recordings_live_session_id_fkey";
ALTER TABLE "recordings"
  ADD CONSTRAINT "recordings_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "recordings_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "live_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- attendance_intervals
CREATE TABLE IF NOT EXISTS "attendance_intervals" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "lesson_id" TEXT NOT NULL,
  "live_session_id" TEXT,
  "joined_at" TIMESTAMP(3) NOT NULL,
  "left_at" TIMESTAMP(3),
  "source" TEXT NOT NULL DEFAULT 'live',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_intervals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_intervals_user_id_lesson_id_idx" ON "attendance_intervals"("user_id", "lesson_id");
CREATE INDEX IF NOT EXISTS "attendance_intervals_lesson_id_joined_at_idx" ON "attendance_intervals"("lesson_id", "joined_at");

ALTER TABLE "attendance_intervals" DROP CONSTRAINT IF EXISTS "attendance_intervals_user_id_fkey";
ALTER TABLE "attendance_intervals" DROP CONSTRAINT IF EXISTS "attendance_intervals_lesson_id_fkey";
ALTER TABLE "attendance_intervals" DROP CONSTRAINT IF EXISTS "attendance_intervals_live_session_id_fkey";
ALTER TABLE "attendance_intervals"
  ADD CONSTRAINT "attendance_intervals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_intervals_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_intervals_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "live_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- course_review_events
CREATE TABLE IF NOT EXISTS "course_review_events" (
  "id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "decision" "CourseReviewDecision" NOT NULL,
  "reason" TEXT,
  "price_set" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "course_review_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "course_review_events_course_id_created_at_idx" ON "course_review_events"("course_id", "created_at");

ALTER TABLE "course_review_events" DROP CONSTRAINT IF EXISTS "course_review_events_course_id_fkey";
ALTER TABLE "course_review_events" DROP CONSTRAINT IF EXISTS "course_review_events_actor_id_fkey";
ALTER TABLE "course_review_events"
  ADD CONSTRAINT "course_review_events_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "course_review_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- audit_logs
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "metadata" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");

ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_actor_id_fkey";
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- incidents
CREATE TABLE IF NOT EXISTS "incidents" (
  "id" TEXT NOT NULL,
  "level" "IncidentLevel" NOT NULL DEFAULT 'warning',
  "status" "IncidentStatus" NOT NULL DEFAULT 'open',
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "source" TEXT,
  "related_type" TEXT,
  "related_id" TEXT,
  "acknowledged_by_id" TEXT,
  "acknowledged_at" TIMESTAMP(3),
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "incidents_status_level_idx" ON "incidents"("status", "level");
CREATE INDEX IF NOT EXISTS "incidents_created_at_idx" ON "incidents"("created_at");

ALTER TABLE "incidents" DROP CONSTRAINT IF EXISTS "incidents_acknowledged_by_id_fkey";
ALTER TABLE "incidents"
  ADD CONSTRAINT "incidents_acknowledged_by_id_fkey"
  FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- security_events
CREATE TABLE IF NOT EXISTS "security_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "kind" TEXT NOT NULL,
  "detail" TEXT,
  "ip" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "security_events_user_id_created_at_idx" ON "security_events"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "security_events_kind_created_at_idx" ON "security_events"("kind", "created_at");

ALTER TABLE "security_events" DROP CONSTRAINT IF EXISTS "security_events_user_id_fkey";
ALTER TABLE "security_events"
  ADD CONSTRAINT "security_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
