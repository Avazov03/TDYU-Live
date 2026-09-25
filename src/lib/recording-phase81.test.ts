import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import {
  buildRecordingStorageKey,
  detectRecordingContainer,
  isStorageKeyForLesson,
  parseRecordingStorageKey,
  RecordingStorageError,
  resolveRecordingStorageRoot,
  resolveStorageKeyToPath,
  sha256Buffer,
  sha256File,
} from "@/lib/recording-storage";
import { classifyLegacyMedia, classifyPlaybackReference, mayProceedToIngest } from "@/lib/recording-media-state";
import {
  canIngestRecording,
  decideAssetPlayback,
  decideUploadReuse,
  ingestPassthrough,
  parseIngestPassthrough,
} from "@/lib/recording-mux-ingest";
import { legacyStudentMayPlay } from "@/lib/recording-playback-auth";
import type { MuxAssetDetail } from "@/lib/mux";

const COURSE = "11111111-1111-4111-8111-111111111111";
const LESSON = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const lesson = { id: LESSON, courseId: COURSE };
const KEY = `recordings/${COURSE}/${LESSON}/source-1758000000000.webm`;

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof RecordingStorageError ? e.code : "OTHER";
  }
  return undefined;
}

describe("Phase 8.1 storage root", () => {
  const release = path.resolve("/srv/app");
  it("fails closed in production without RECORDING_STORAGE_ROOT", () => {
    assert.equal(code(() => resolveRecordingStorageRoot({ NODE_ENV: "production" }, release)), "RECORDING_STORAGE_NOT_CONFIGURED");
  });
  it("rejects relative roots", () => {
    assert.equal(code(() => resolveRecordingStorageRoot({ RECORDING_STORAGE_ROOT: "data/rec" }, release)), "RECORDING_STORAGE_ROOT_NOT_ABSOLUTE");
  });
  it("rejects roots under public/ (directly web-served)", () => {
    const env = { RECORDING_STORAGE_ROOT: path.join(release, "public", "rec") };
    assert.equal(code(() => resolveRecordingStorageRoot(env, release)), "RECORDING_STORAGE_INSIDE_PUBLIC");
  });
  it("rejects roots inside the release dir in production (wiped on deploy)", () => {
    const env = { NODE_ENV: "production", RECORDING_STORAGE_ROOT: path.join(release, "data") };
    assert.equal(code(() => resolveRecordingStorageRoot(env, release)), "RECORDING_STORAGE_INSIDE_RELEASE");
  });
  it("accepts an absolute path outside the release dir", () => {
    const root = path.resolve("/var/lib/tdyu-live/recordings");
    assert.equal(resolveRecordingStorageRoot({ NODE_ENV: "production", RECORDING_STORAGE_ROOT: root }, release), root);
  });
  it("dev falls back to .data (never public)", () => {
    assert.equal(resolveRecordingStorageRoot({}, release), path.join(release, ".data", "recordings-store"));
  });
});

describe("Phase 8.1 storage keys + traversal", () => {
  it("builds a deterministic durable key", () => {
    assert.equal(buildRecordingStorageKey({ courseId: COURSE, lessonId: LESSON, container: "webm", nowMs: 1758000000000 }), KEY);
  });
  it("rejects non-uuid ids in key construction", () => {
    assert.equal(code(() => buildRecordingStorageKey({ courseId: "../x", lessonId: LESSON, container: "webm" })), "INVALID_STORAGE_KEY_INPUT");
  });
  it("rejects traversal and malformed keys", () => {
    for (const bad of [
      `recordings/${COURSE}/${LESSON}/../../etc/passwd`,
      `recordings/${COURSE}/${LESSON}/source-1758000000000.webm/../x`,
      "/uploads/recordings/../../.env",
      "/uploads/recordings/..webm",
      `/uploads/recordings/${LESSON}\0.webm`,
      "/etc/passwd",
      "https://evil.example/x.webm",
      `/uploads/lessons/${LESSON}.webm`,
    ]) {
      assert.equal(parseRecordingStorageKey(bad), null, bad);
      assert.equal(code(() => resolveStorageKeyToPath(bad)), "INVALID_STORAGE_KEY", bad);
    }
  });
  it("binds keys to lesson and course", () => {
    assert.equal(isStorageKeyForLesson(KEY, lesson), true);
    assert.equal(isStorageKeyForLesson(KEY, { id: LESSON, courseId: OTHER }), false);
    assert.equal(isStorageKeyForLesson(KEY, { id: OTHER, courseId: COURSE }), false);
    assert.equal(isStorageKeyForLesson(`/uploads/recordings/${LESSON}-1758000000000.webm`, lesson), true);
    assert.equal(isStorageKeyForLesson(`/uploads/recordings/${OTHER}-1758000000000.webm`, lesson), false);
  });
  it("resolves durable keys under the storage root only", () => {
    const root = path.resolve("/var/lib/rec");
    const r = resolveStorageKeyToPath(KEY, { env: { RECORDING_STORAGE_ROOT: root }, cwd: path.resolve("/srv/app") });
    assert.equal(r.kind, "durable");
    assert.ok(r.absPath.startsWith(root + path.sep));
    assert.ok(!r.absPath.includes(`${path.sep}public${path.sep}`));
  });
  it("durable key resolution fails closed in production without a root", () => {
    assert.equal(code(() => resolveStorageKeyToPath(KEY, { env: { NODE_ENV: "production" } })), "RECORDING_STORAGE_NOT_CONFIGURED");
  });
});

describe("Phase 8.1 media validation + checksum", () => {
  it("sniffs webm / mp4 and rejects others", () => {
    assert.equal(detectRecordingContainer(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0])), "webm");
    assert.equal(detectRecordingContainer(Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70])), "mp4");
    assert.equal(detectRecordingContainer(Buffer.from("<html><script>")), null);
    assert.equal(detectRecordingContainer(Uint8Array.from([0x1a])), null);
  });
  it("streaming file checksum equals buffer checksum; changes detect mismatch", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rec81-"));
    const f = path.join(dir, "a.webm");
    const data = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(4096, 7)]);
    writeFileSync(f, data);
    assert.equal(await sha256File(f), sha256Buffer(data));
    writeFileSync(f, Buffer.concat([data, Buffer.from([1])]));
    assert.notEqual(await sha256File(f), sha256Buffer(data));
  });
});

describe("Phase 8.1 legacy media classification", () => {
  const base = {
    muxVodPlaybackId: null,
    muxObjectType: null,
    muxLookupFound: false,
    muxAssetReady: false,
    recordingUrl: null,
    localFileFound: false,
    backupFileFound: false,
  } as const;
  it("live-stream playback id is never VOD", () => {
    const i = { ...base, muxVodPlaybackId: "abc", muxObjectType: "live_stream" as const, muxLookupFound: true };
    assert.equal(classifyPlaybackReference(i), "LEGACY_LIVE_STREAM_PLAYBACK_REFERENCE");
    assert.equal(classifyLegacyMedia(i), "MISSING_MEDIA");
    assert.equal(mayProceedToIngest(classifyLegacyMedia(i)), false);
  });
  it("missing local file with recordingUrl is MISSING_MEDIA (no reconstruction)", () => {
    const i = { ...base, muxVodPlaybackId: "abc", muxObjectType: "live_stream" as const, muxLookupFound: true, recordingUrl: `/uploads/recordings/${LESSON}-1.webm` };
    assert.equal(classifyLegacyMedia(i), "MISSING_MEDIA");
  });
  it("found + valid local file is recoverable; invalid is not", () => {
    const i = { ...base, recordingUrl: "/uploads/recordings/x.webm", localFileFound: true };
    assert.equal(classifyLegacyMedia({ ...i, mediaValid: true }), "RECOVERABLE_LOCAL_MEDIA");
    assert.equal(classifyLegacyMedia({ ...i, mediaValid: false }), "MISSING_MEDIA");
    assert.equal(classifyLegacyMedia({ ...base, backupFileFound: true, mediaValid: true }), "RECOVERABLE_BACKUP_MEDIA");
  });
  it("ready asset is REAL_MUX_VOD; unresolved id is invalid; nothing is NO_MEDIA", () => {
    assert.equal(classifyLegacyMedia({ ...base, muxVodPlaybackId: "p", muxObjectType: "asset", muxLookupFound: true, muxAssetReady: true }), "REAL_MUX_VOD");
    assert.equal(classifyLegacyMedia({ ...base, muxVodPlaybackId: "p" }), "INVALID_LEGACY_PLAYBACK_REFERENCE");
    assert.equal(classifyLegacyMedia(base), "NO_MEDIA");
  });
});

describe("Phase 8.1 signed Mux ingest decisions", () => {
  const pt = ingestPassthrough(LESSON, KEY);
  const asset = (over: Partial<MuxAssetDetail>): MuxAssetDetail => ({
    assetId: "asset1",
    status: "ready",
    durationSeconds: 10,
    passthrough: pt,
    playbackIds: [],
    errorMessages: [],
    ...over,
  });
  it("passthrough is stable per (lesson, key) and parseable", () => {
    assert.equal(ingestPassthrough(LESSON, KEY), pt);
    assert.notEqual(ingestPassthrough(LESSON, KEY.replace("webm", "mp4")), pt);
    assert.deepEqual(parseIngestPassthrough(pt), { lessonId: LESSON });
    assert.equal(parseIngestPassthrough("lexify:rec:v1:../x:0000"), null);
    assert.equal(parseIngestPassthrough(null), null);
  });
  it("creates a signed id for a ready asset without playback ids", () => {
    assert.deepEqual(decideAssetPlayback(asset({}), pt), { action: "CREATE_SIGNED" });
  });
  it("reuses an existing signed id (idempotent)", () => {
    assert.deepEqual(decideAssetPlayback(asset({ playbackIds: [{ id: "s1", policy: "signed" }] }), pt), { action: "USE_SIGNED", playbackId: "s1" });
  });
  it("blocks any public playback id", () => {
    assert.equal(decideAssetPlayback(asset({ playbackIds: [{ id: "p1", policy: "public" }, { id: "s1", policy: "signed" }] }), pt).action, "BLOCK");
  });
  it("blocks an asset belonging to another lesson/key", () => {
    assert.equal(decideAssetPlayback(asset({ passthrough: ingestPassthrough(OTHER, KEY) }), pt).action, "BLOCK");
  });
  it("processing failure → FAIL; still processing → PENDING; missing → FAIL", () => {
    assert.equal(decideAssetPlayback(asset({ status: "errored", errorMessages: ["bad input"] }), pt).action, "FAIL");
    assert.equal(decideAssetPlayback(asset({ status: "preparing" }), pt).action, "PENDING");
    assert.equal(decideAssetPlayback(null, pt).action, "FAIL");
  });
  it("upload retry: reuse live uploads/assets, restart only failed ones", () => {
    assert.equal(decideUploadReuse(null), "NEW_UPLOAD");
    assert.equal(decideUploadReuse({ status: "asset_created", assetId: "a" }), "REUSE_ASSET");
    assert.equal(decideUploadReuse({ status: "waiting", assetId: null }), "WAIT_UPLOAD");
    assert.equal(decideUploadReuse({ status: "errored", assetId: null }), "NEW_UPLOAD");
    assert.equal(decideUploadReuse({ status: "timed_out", assetId: null }), "NEW_UPLOAD");
  });
  it("duplicate prevention: a recording with Mux playback is never re-ingested", () => {
    assert.deepEqual(canIngestRecording({ status: "teacher_review", muxPlaybackId: "s1" }), { ok: false, code: "ALREADY_HAS_MUX_PLAYBACK" });
    assert.deepEqual(canIngestRecording({ status: "hidden", muxPlaybackId: null }), { ok: false, code: "HIDDEN" });
    assert.deepEqual(canIngestRecording({ status: "failed", muxPlaybackId: null }), { ok: true });
    assert.deepEqual(canIngestRecording(null), { ok: true });
  });
});

describe("Phase 8.1 student authorization (review flag off)", () => {
  it("recordings awaiting teacher approval are never playable by students", () => {
    for (const status of ["teacher_review", "hidden", "failed", "processing"]) {
      assert.equal(legacyStudentMayPlay({ status, muxPlaybackId: "s1", storageKey: KEY }), false, status);
    }
  });
  it("published recordings are playable; empty legacy rows are not", () => {
    assert.equal(legacyStudentMayPlay({ status: "published", muxPlaybackId: "s1", storageKey: null }), true);
    assert.equal(legacyStudentMayPlay({ status: "ready", muxPlaybackId: null, storageKey: null }), false);
  });
});
