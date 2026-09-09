-- Pivot: YouTube-klon jadvallarni olib tashlash, LMS sxemasini yaratish
DROP TABLE IF EXISTS "playlist_items" CASCADE;
DROP TABLE IF EXISTS "playlists" CASCADE;
DROP TABLE IF EXISTS "watch_history" CASCADE;
DROP TABLE IF EXISTS "reports" CASCADE;
DROP TABLE IF EXISTS "blocked_words" CASCADE;
DROP TABLE IF EXISTS "site_announcements" CASCADE;
DROP TABLE IF EXISTS "video_chapters" CASCADE;
DROP TABLE IF EXISTS "comments" CASCADE;
DROP TABLE IF EXISTS "reactions" CASCADE;
DROP TABLE IF EXISTS "shorts" CASCADE;
DROP TABLE IF EXISTS "videos" CASCADE;
DROP TABLE IF EXISTS "subscriptions" CASCADE;
DROP TABLE IF EXISTS "notifications" CASCADE;
DROP TABLE IF EXISTS "chat_messages" CASCADE;
DROP TABLE IF EXISTS "submissions" CASCADE;
DROP TABLE IF EXISTS "assignments" CASCADE;
DROP TABLE IF EXISTS "attendance" CASCADE;
DROP TABLE IF EXISTS "certificates" CASCADE;
DROP TABLE IF EXISTS "payments" CASCADE;
DROP TABLE IF EXISTS "lessons" CASCADE;
DROP TABLE IF EXISTS "teacher_invites" CASCADE;
DROP TABLE IF EXISTS "courses" CASCADE;
DROP TABLE IF EXISTS "teachers" CASCADE;
DROP TABLE IF EXISTS "subjects" CASCADE;
DROP TABLE IF EXISTS "departments" CASCADE;
DROP TABLE IF EXISTS "faculties" CASCADE;
DROP TABLE IF EXISTS "site_settings" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

DROP TYPE IF EXISTS "UserRole" CASCADE;
DROP TYPE IF EXISTS "Language" CASCADE;
DROP TYPE IF EXISTS "Theme" CASCADE;
DROP TYPE IF EXISTS "VideoStatus" CASCADE;
DROP TYPE IF EXISTS "CommentStatus" CASCADE;
DROP TYPE IF EXISTS "ReactionType" CASCADE;
DROP TYPE IF EXISTS "NotificationType" CASCADE;
DROP TYPE IF EXISTS "PlaylistType" CASCADE;
DROP TYPE IF EXISTS "ReportTargetType" CASCADE;
DROP TYPE IF EXISTS "ReportStatus" CASCADE;
DROP TYPE IF EXISTS "BlockedWordScope" CASCADE;
DROP TYPE IF EXISTS "TariffTier" CASCADE;
DROP TYPE IF EXISTS "LessonStatus" CASCADE;
DROP TYPE IF EXISTS "PaymentStatus" CASCADE;
DROP TYPE IF EXISTS "PaymentProvider" CASCADE;

CREATE TYPE "UserRole" AS ENUM ('student', 'teacher', 'admin');
CREATE TYPE "Language" AS ENUM ('uz', 'ru', 'en');
CREATE TYPE "Theme" AS ENUM ('dark', 'light');
CREATE TYPE "TariffTier" AS ENUM ('t1', 't2', 't3');
CREATE TYPE "LessonStatus" AS ENUM ('scheduled', 'live', 'ended');
CREATE TYPE "PaymentStatus" AS ENUM ('demo_paid', 'pending', 'paid', 'failed');
CREATE TYPE "PaymentProvider" AS ENUM ('demo', 'payme', 'click');
CREATE TYPE "NotificationType" AS ENUM ('lesson_starting', 'lesson_live', 'assignment', 'grade', 'certificate', 'system');

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "google_id" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'student',
    "avatar_url" TEXT,
    "language" "Language" NOT NULL DEFAULT 'uz',
    "theme" "Theme" NOT NULL DEFAULT 'dark',
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "telegram_chat_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "faculties" (
    "id" TEXT NOT NULL,
    "name_uz" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "faculties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "name_uz" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "faculty_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teacher_invites" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "teacher_invites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "title_uz" TEXT NOT NULL,
    "description_uz" TEXT NOT NULL,
    "price_t1" INTEGER NOT NULL,
    "price_t2" INTEGER NOT NULL,
    "price_t3" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "tier" "TariffTier" NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title_uz" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'scheduled',
    "mux_live_stream_id" TEXT,
    "mux_live_playback_id" TEXT,
    "mux_vod_playback_id" TEXT,
    "stream_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "lesson_id" TEXT,
    "title_uz" TEXT NOT NULL,
    "description_uz" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "text" TEXT,
    "file_name" TEXT,
    "file_url" TEXT,
    "grade" INTEGER,
    "teacher_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "graded_at" TIMESTAMP(3),
    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issued_by" TEXT,
    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "tier" "TariffTier" NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'demo_paid',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'demo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title_uz" TEXT NOT NULL,
    "message_uz" TEXT NOT NULL,
    "related_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "priority" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "teachers_user_id_key" ON "teachers"("user_id");
CREATE UNIQUE INDEX "teacher_invites_token_key" ON "teacher_invites"("token");
CREATE UNIQUE INDEX "subscriptions_user_id_course_id_key" ON "subscriptions"("user_id", "course_id");
CREATE INDEX "lessons_course_id_idx" ON "lessons"("course_id");
CREATE UNIQUE INDEX "attendance_user_id_lesson_id_key" ON "attendance"("user_id", "lesson_id");
CREATE UNIQUE INDEX "submissions_assignment_id_user_id_key" ON "submissions"("assignment_id", "user_id");
CREATE UNIQUE INDEX "certificates_user_id_course_id_key" ON "certificates"("user_id", "course_id");
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");
CREATE INDEX "chat_messages_lesson_id_created_at_idx" ON "chat_messages"("lesson_id", "created_at");
CREATE UNIQUE INDEX "site_settings_key_key" ON "site_settings"("key");

ALTER TABLE "subjects" ADD CONSTRAINT "subjects_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_invites" ADD CONSTRAINT "teacher_invites_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
