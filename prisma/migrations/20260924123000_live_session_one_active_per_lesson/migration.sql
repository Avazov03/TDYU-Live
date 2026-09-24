-- Phase 7 Live Wave 1: at most one active LiveSession per lesson.
-- Does not delete data. Ended/abandoned rows remain free for history.
CREATE UNIQUE INDEX IF NOT EXISTS live_sessions_one_active_per_lesson
ON live_sessions (lesson_id)
WHERE status IN ('created', 'waiting', 'live', 'paused');
