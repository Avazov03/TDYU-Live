/**
 * Phase 8.1 — copy ONE real, recovered media file into persistent recording storage.
 *
 * Dry-run by default. Never moves or deletes the source. Never edits Lesson media columns.
 * Apply on production requires CONFIRM_PRODUCTION_RECORDING_RECOVERY=true.
 *
 * Usage:
 *   npm run db:recording:media-recovery -- --env-file <.env> --lesson <id> --source <abs file> [--apply]
 */

import { constants as fsc, existsSync } from "fs";
import { copyFile, mkdir, open, stat, writeFile } from "fs/promises";
import path from "path";
import {
  argValue,
  assertEnvConsistent,
  confirmed,
  dbName,
  hasFlag,
  isProductionTarget,
  loadScriptEnv,
} from "./recording-script-env";

loadScriptEnv();

function out(obj: Record<string, unknown>): void {
  console.log(JSON.stringify(obj, null, 2));
}

async function main() {
  assertEnvConsistent();
  const apply = hasFlag("--apply");
  const lessonId = argValue("--lesson");
  const source = argValue("--source");
  if (!lessonId || !source) throw new Error("usage: --lesson <id> --source <abs file> [--apply]");
  if (!path.isAbsolute(source)) throw new Error("SOURCE_NOT_ABSOLUTE");
  if (apply && isProductionTarget() && !confirmed("CONFIRM_PRODUCTION_RECORDING_RECOVERY")) {
    throw new Error("REFUSING: set CONFIRM_PRODUCTION_RECORDING_RECOVERY=true for production apply");
  }

  const storage = await import("../src/lib/recording-storage");
  const { prisma } = await import("../src/lib/prisma");

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, courseId: true, recordingUrl: true, muxVodPlaybackId: true },
  });
  if (!lesson) return out({ status: "BLOCKED", code: "LESSON_NOT_FOUND" });
  if (!lesson.recordingUrl && !lesson.muxVodPlaybackId) {
    return out({ status: "BLOCKED", code: "LESSON_HAS_NO_LEGACY_MEDIA_REFERENCE" });
  }
  const existing = await prisma.recording.count({ where: { lessonId } });
  if (existing > 0) return out({ status: "BLOCKED", code: "RECORDING_ALREADY_EXISTS" });

  if (!existsSync(source)) return out({ status: "BLOCKED", code: "SOURCE_MISSING" });
  const fh = await open(source, "r");
  const head = Buffer.alloc(16);
  await fh.read(head, 0, 16, 0);
  await fh.close();
  const container = storage.detectRecordingContainer(head);
  if (!container) return out({ status: "BLOCKED", code: "INVALID_MEDIA_CONTAINER" });
  const size = (await stat(source)).size;
  const sha256 = await storage.sha256File(source);

  // Deterministic key: legacy filename timestamp when present, else source mtime.
  const legacyTs = /-(\d{13})\.webm$/.exec(lesson.recordingUrl ?? "")?.[1];
  const nowMs = legacyTs ? Number(legacyTs) : Math.floor((await stat(source)).mtimeMs);
  const storageKey = storage.buildRecordingStorageKey({
    courseId: lesson.courseId,
    lessonId: lesson.id,
    container,
    nowMs,
  });
  const { absPath } = storage.resolveStorageKeyToPath(storageKey);

  if (existsSync(absPath)) {
    const destSha = await storage.sha256File(absPath);
    if (destSha === sha256) return out({ status: "SKIPPED", code: "ALREADY_RECOVERED", storageKey, sha256 });
    return out({ status: "BLOCKED", code: "DESTINATION_EXISTS_WITH_DIFFERENT_CHECKSUM", storageKey });
  }

  const plan = { lessonId, courseId: lesson.courseId, storageKey, container, size, sha256, db: dbName() };
  if (!apply) return out({ status: "DRY_RUN", ...plan });

  await mkdir(path.dirname(absPath), { recursive: true, mode: 0o750 });
  await copyFile(source, absPath, fsc.COPYFILE_EXCL);
  const destSha = await storage.sha256File(absPath);
  if (destSha !== sha256) {
    // Keep both files for investigation; never delete automatically.
    return out({ status: "BLOCKED", code: "CHECKSUM_MISMATCH_AFTER_COPY", storageKey });
  }
  await writeFile(
    `${absPath}.json`,
    JSON.stringify({
      sha256,
      size,
      container,
      lessonId,
      courseId: lesson.courseId,
      origin: "legacy_recovery",
      recoveredAt: new Date().toISOString(),
      sourceBasename: path.basename(source),
    }),
    { flag: "wx", mode: 0o640 },
  );
  await prisma.auditLog.create({
    data: {
      action: "recording.media_recovered",
      entityType: "Lesson",
      entityId: lessonId,
      metadata: JSON.stringify({ storageKey, sha256, size, container, origin: "legacy_recovery" }),
    },
  });
  out({ status: "RECOVERED", ...plan });
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
