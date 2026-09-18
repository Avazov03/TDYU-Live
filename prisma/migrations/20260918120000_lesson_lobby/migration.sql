DO $$ BEGIN
  ALTER TYPE "LessonStatus" ADD VALUE 'lobby';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
