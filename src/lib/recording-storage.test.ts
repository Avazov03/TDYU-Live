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
