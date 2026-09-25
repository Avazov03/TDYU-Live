/**
 * Phase 8.1 — persistent recording storage (outside the deploy directory).
 *
 * Storage keys (Recording.storageKey / Lesson.recordingUrl):
 *   durable: recordings/<courseId>/<lessonId>/source-<epochMs>.<webm|mp4>
 *   legacy:  /uploads/recordings/<lessonId>-<epochMs>.webm  (read-only compat, deploy dir)
 *
 * Production (NODE_ENV=production) requires RECORDING_STORAGE_ROOT — no silent
 * fallback to public/uploads/recordings.
 */

import { createHash } from "crypto";
import { createReadStream } from "fs";
import path from "path";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const DURABLE_KEY_RE = new RegExp(`^recordings/(${UUID})/(${UUID})/source-(\\d{13})\\.(webm|mp4)$`);
const LEGACY_KEY_RE = /^\/uploads\/recordings\/([A-Za-z0-9][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+)*)\.webm$/;

export type RecordingContainer = "webm" | "mp4";

export class RecordingStorageError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
    this.name = "RecordingStorageError";
  }
}

type EnvLike = Record<string, string | undefined>;

function isProductionRuntime(env: EnvLike): boolean {
  return env.NODE_ENV === "production";
}

/**
 * Absolute storage root. Throws RECORDING_STORAGE_NOT_CONFIGURED in production
 * when unset; RECORDING_STORAGE_INSIDE_PUBLIC if it points under public/.
 */
export function resolveRecordingStorageRoot(
  env: EnvLike = process.env,
  cwd: string = process.cwd(),
): string {
  const raw = env.RECORDING_STORAGE_ROOT?.trim();
  if (!raw) {
    if (isProductionRuntime(env)) {
      throw new RecordingStorageError(
        "RECORDING_STORAGE_NOT_CONFIGURED",
        "RECORDING_STORAGE_ROOT must be set in production (persistent path outside the release directory)",
      );
    }
    return path.resolve(cwd, ".data", "recordings-store");
  }
  if (!path.isAbsolute(raw)) {
    throw new RecordingStorageError("RECORDING_STORAGE_ROOT_NOT_ABSOLUTE");
  }
  const root = path.resolve(raw);
  const publicDir = path.resolve(cwd, "public");
  if (root === publicDir || root.startsWith(publicDir + path.sep)) {
    throw new RecordingStorageError("RECORDING_STORAGE_INSIDE_PUBLIC");
  }
  if (isProductionRuntime(env)) {
    const release = path.resolve(cwd);
    if (root === release || root.startsWith(release + path.sep)) {
      throw new RecordingStorageError("RECORDING_STORAGE_INSIDE_RELEASE");
    }
  }
  return root;
}

export function buildRecordingStorageKey(input: {
  courseId: string;
  lessonId: string;
  container: RecordingContainer;
  nowMs?: number;
}): string {
  const key = `recordings/${input.courseId}/${input.lessonId}/source-${String(
    input.nowMs ?? Date.now(),
  ).padStart(13, "0")}.${input.container}`;
  if (!DURABLE_KEY_RE.test(key)) {
    throw new RecordingStorageError("INVALID_STORAGE_KEY_INPUT");
  }
  return key;
}

export type ParsedStorageKey =
  | { kind: "durable"; courseId: string; lessonId: string; container: RecordingContainer }
  | { kind: "legacy"; fileStem: string; container: "webm" };

export function parseRecordingStorageKey(key: string | null | undefined): ParsedStorageKey | null {
  if (!key || key.includes("\0") || key.length > 300) return null;
  const d = DURABLE_KEY_RE.exec(key);
  if (d) return { kind: "durable", courseId: d[1], lessonId: d[2], container: d[4] as RecordingContainer };
  const l = LEGACY_KEY_RE.exec(key);
  if (l) return { kind: "legacy", fileStem: l[1], container: "webm" };
  return null;
}

/** True only when the key is well-formed AND bound to this lesson (and course for durable keys). */
export function isStorageKeyForLesson(
  key: string | null | undefined,
  lesson: { id: string; courseId: string },
): boolean {
  const parsed = parseRecordingStorageKey(key);
  if (!parsed) return false;
  if (parsed.kind === "legacy") return parsed.fileStem.includes(lesson.id);
  return parsed.lessonId === lesson.id && parsed.courseId === lesson.courseId;
}

/** Resolve a storage key to an absolute file path, refusing anything outside its root. */
export function resolveStorageKeyToPath(
  key: string,
  opts: { env?: EnvLike; cwd?: string } = {},
): { absPath: string; container: RecordingContainer; kind: ParsedStorageKey["kind"] } {
  const parsed = parseRecordingStorageKey(key);
  if (!parsed) throw new RecordingStorageError("INVALID_STORAGE_KEY");
  const cwd = opts.cwd ?? process.cwd();
  const root =
    parsed.kind === "durable"
      ? resolveRecordingStorageRoot(opts.env ?? process.env, cwd)
      : path.resolve(cwd, "public");
  const rel = parsed.kind === "durable" ? key : key.replace(/^\/+/, "");
  const absPath = path.resolve(root, rel);
  if (!absPath.startsWith(root + path.sep)) {
    throw new RecordingStorageError("STORAGE_PATH_ESCAPE");
  }
  return { absPath, container: parsed.container, kind: parsed.kind };
}

/** Sniff container from leading bytes. Never trust client filename or MIME. */
export function detectRecordingContainer(head: Uint8Array): RecordingContainer | null {
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    return "webm";
  }
  if (
    head.length >= 8 &&
    head[4] === 0x66 && // f
    head[5] === 0x74 && // t
    head[6] === 0x79 && // y
    head[7] === 0x70 // p
  ) {
    return "mp4";
  }
  return null;
}

export function sha256Buffer(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function sha256File(absPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(absPath)
      .on("data", (chunk) => h.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(h.digest("hex")));
  });
}

export function recordingContentType(container: RecordingContainer): string {
  return container === "mp4" ? "video/mp4" : "video/webm";
}
