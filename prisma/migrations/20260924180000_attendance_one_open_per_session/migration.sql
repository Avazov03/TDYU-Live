-- Phase 7 Live Wave 3: at most one open AttendanceInterval per user + live session.
-- Non-destructive; reversible by DROP INDEX.

CREATE UNIQUE INDEX IF NOT EXISTS attendance_intervals_one_open_per_user_session
ON attendance_intervals (user_id, live_session_id)
WHERE left_at IS NULL AND live_session_id IS NOT NULL;
