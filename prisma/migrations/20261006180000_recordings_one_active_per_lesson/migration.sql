-- One active (non-failed, non-hidden) Recording per lesson.
-- Older duplicates are hidden, never deleted: published wins, then the newest row.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY lesson_id
           ORDER BY (status = 'published') DESC, created_at DESC
         ) AS rn
  FROM recordings
  WHERE status IN ('not_started', 'processing', 'ready', 'teacher_review', 'published')
)
UPDATE recordings
SET status = 'hidden',
    failure_reason = COALESCE(failure_reason, 'duplicate_recording_row'),
    updated_at = NOW()
FROM ranked
WHERE recordings.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "recordings_one_active_per_lesson"
  ON "recordings" ("lesson_id")
  WHERE status IN ('not_started', 'processing', 'ready', 'teacher_review', 'published');
