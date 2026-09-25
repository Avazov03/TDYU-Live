/**
 * Phase 8.1 — RECOVERY_CANARY_001: exactly one recovered recording → signed Mux → teacher_review.
 *
 * Requires CONFIRM_PRODUCTION_RECORDING_CANARY=true. Stops at the first failed precondition.
 * Prerequisite: the file was already copied with db:recording:media-recovery --apply.
 * Never publishes; publishing is the course teacher's decision in the UI.
 *
 * Usage:
 *   CONFIRM_PRODUCTION_RECORDING_CANARY=true npm run db:recording:production-canary -- \
 *     --env-file /var/www/tdyu-live/.env --lesson <id> --storage-key <key> \
 *     [--enrolled-student <userId>] [--unenrolled-student <userId>] [--other-teacher <userId>] \
 *     [--allow-non-production]
 */

import { constants as fsc, existsSync, readFileSync } from "fs";
import { access } from "fs/promises";
import {
  argValue,
  assertEnvConsistent,
  confirmed,
  credentialStatus,
  dbName,
  hasFlag,
  loadScriptEnv,
} from "./recording-script-env";
import { runIngest } from "./recording-mux-ingest";

loadScriptEnv();

type Check = { check: string; ok: boolean; detail?: string };
const checks: Check[] = [];
function record(check: string, ok: boolean, detail?: string): boolean {
  checks.push({ check, ok, ...(detail ? { detail } : {}) });
  return ok;
}

function finish(status: string, extra: Record<string, unknown> = {}): never {
  console.log(JSON.stringify({ canary: "RECOVERY_CANARY_001", status, checks, ...extra }, null, 2));
  process.exit(status === "CANARY_PASS" ? 0 : 2);
}

async function health(): Promise<number | null> {
  const url = process.env.HEALTH_URL || `http://127.0.0.1:${process.env.PORT || 3100}/`;
  try {
    return (await fetch(url, { method: "GET", redirect: "manual" })).status;
  } catch {
    return null;
  }
}

async function cdnStatus(url: string): Promise<number | null> {
  try {
    return (await fetch(url, { method: "GET" })).status;
  } catch {
    return null;
  }
}

async function main() {
  assertEnvConsistent();
  if (!record("confirm flag", confirmed("CONFIRM_PRODUCTION_RECORDING_CANARY"))) finish("BLOCKED");
  const production = dbName() === "tdyulive";
  if (!record("production database", production || hasFlag("--allow-non-production"), dbName() ? "named" : "missing")) {
    finish("BLOCKED");
  }

  const lessonId = argValue("--lesson");
  const storageKey = argValue("--storage-key");
  if (!record("exactly one candidate given", Boolean(lessonId && storageKey))) finish("BLOCKED");

  const creds = credentialStatus();
  record("Mux API credentials", creds.MUX_API === "AVAILABLE", creds.MUX_API);
  record("Mux signing key", creds.MUX_SIGNING === "AVAILABLE", creds.MUX_SIGNING);

  const storage = await import("../src/lib/recording-storage");
  let root: string | null = null;
  try {
    root = storage.resolveRecordingStorageRoot({ ...process.env, NODE_ENV: "production" }, process.cwd());
    await access(root, fsc.W_OK);
    record("persistent storage root", true);
  } catch (err) {
    record("persistent storage root", false, err instanceof Error ? err.message : "unavailable");
  }

  const baseHealth = await health();
  record("app health baseline", baseHealth !== null && baseHealth < 500, String(baseHealth));
  if (checks.some((c) => !c.ok)) finish("BLOCKED");

  const { prisma } = await import("../src/lib/prisma");
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId! } });
  if (!record("lesson exists", Boolean(lesson))) finish("BLOCKED");
  if (!record("storage key bound to lesson", storage.isStorageKeyForLesson(storageKey, lesson!) &&
    storage.parseRecordingStorageKey(storageKey)?.kind === "durable")) finish("BLOCKED");

  const { absPath } = storage.resolveStorageKeyToPath(storageKey!);
  if (!record("recovered file present", existsSync(absPath))) finish("BLOCKED");
  let expectedSha: string | null = null;
  try {
    expectedSha = (JSON.parse(readFileSync(`${absPath}.json`, "utf8")) as { sha256?: string }).sha256 ?? null;
  } catch {
    /* handled below */
  }
  const actualSha = await storage.sha256File(absPath);
  if (!record("checksum matches sidecar", Boolean(expectedSha) && expectedSha === actualSha)) finish("BLOCKED");

  const before = await prisma.recording.count({ where: { lessonId: lessonId! } });
  if (!record("no existing Recording", before === 0, String(before))) finish("BLOCKED");

  const result = await runIngest({
    lessonId: lessonId!,
    storageKey: storageKey!,
    origin: "legacy_recovery",
    expectedSha256: actualSha,
    timeoutMin: Number(argValue("--timeout-min") ?? 20),
  });
  const final = result.final;
  if (!record("signed Mux asset ready", final?.state === "READY", final?.state ?? result.started.state)) {
    finish("BLOCKED");
  }
  const ready = final as { recordingId: string; playbackId: string; assetId: string };

  const rows = await prisma.recording.findMany({ where: { lessonId: lessonId! } });
  record("exactly one Recording", rows.length === 1, String(rows.length));
  record("status teacher_review", rows[0]?.status === "teacher_review", rows[0]?.status);
  record("no auto-publish deadline", rows[0]?.reviewDeadlineAt === null);
  const lessonAfter = await prisma.lesson.findUnique({ where: { id: lessonId! } });
  record("lesson media columns untouched",
    lessonAfter?.muxVodPlaybackId === lesson!.muxVodPlaybackId && lessonAfter?.recordingUrl === lesson!.recordingUrl);

  const { getMuxPlaybackIdInfo } = await import("../src/lib/mux");
  const info = await getMuxPlaybackIdInfo(ready.playbackId);
  record("playback policy signed", info?.policy === "signed", info?.policy ?? "not found");

  const m3u8 = `https://stream.mux.com/${ready.playbackId}.m3u8`;
  record("CDN rejects missing token", (await cdnStatus(m3u8)) === 403);
  const { signMuxPlaybackToken } = await import("../src/lib/mux-signed-playback");
  const valid = signMuxPlaybackToken({ playbackId: ready.playbackId });
  record("CDN accepts valid token", (await cdnStatus(`${m3u8}?token=${valid.token}`)) === 200);
  const expired = signMuxPlaybackToken({ playbackId: ready.playbackId, nowSec: Math.floor(Date.now() / 1000) - 3600, ttlSec: 60 });
  record("CDN rejects expired token", (await cdnStatus(`${m3u8}?token=${expired.token}`)) === 403);

  const { authorizeRecordingPlayback, issueRecordingPlaybackToken } = await import("../src/lib/recording-playback-auth");
  const injected = await issueRecordingPlaybackToken({
    userId: "canary",
    userRole: "student",
    lessonId,
    playbackIdFromClient: ready.playbackId,
  });
  record("client playbackId rejected", !injected.ok && injected.code === "PLAYBACK_ID_NOT_ACCEPTED");

  const enrolled = argValue("--enrolled-student");
  if (enrolled) {
    const a = await authorizeRecordingPlayback({ userId: enrolled, userRole: "student", lessonId });
    record("enrolled student blocked before publish", !a.ok, a.ok ? "allowed" : a.code);
  }
  const unenrolled = argValue("--unenrolled-student");
  if (unenrolled) {
    const a = await authorizeRecordingPlayback({ userId: unenrolled, userRole: "student", lessonId });
    record("unenrolled student denied", !a.ok, a.ok ? "allowed" : a.code);
  }
  const otherTeacher = argValue("--other-teacher");
  if (otherTeacher) {
    const a = await authorizeRecordingPlayback({ userId: otherTeacher, userRole: "teacher", lessonId });
    record("other teacher denied", !a.ok, a.ok ? "allowed" : a.code);
  }

  const afterHealth = await health();
  record("app health unchanged", afterHealth === baseHealth, String(afterHealth));
  await prisma.$disconnect();

  finish(checks.every((c) => c.ok) ? "CANARY_PASS" : "BLOCKED", {
    recordingId: ready.recordingId,
    assetIdPresent: Boolean(ready.assetId),
    next: "CHECKPOINT — stop here. Teacher previews and publishes in the UI; no batch until approved.",
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
