/**
 * Phase 8.1 — legacy lesson media classification.
 *
 * Lesson.muxVodPlaybackId is misnamed: in production it holds live-stream playback IDs.
 * A live_stream playback ID is never a recording.
 */

export type LegacyMediaState =
  | "REAL_MUX_VOD"
  | "RECOVERABLE_LOCAL_MEDIA"
  | "RECOVERABLE_BACKUP_MEDIA"
  | "MISSING_MEDIA"
  | "INVALID_LEGACY_PLAYBACK_REFERENCE"
  | "NO_MEDIA";

export type LegacyPlaybackReference =
  | "NONE"
  | "LEGACY_LIVE_STREAM_PLAYBACK_REFERENCE"
  | "VOD_ASSET_PLAYBACK"
  | "UNRESOLVED";

export type LegacyMediaInput = {
  muxVodPlaybackId: string | null;
  /** Mux GET /playback-ids object.type; null when not looked up or not found. */
  muxObjectType: "asset" | "live_stream" | null;
  muxLookupFound: boolean;
  /** Asset exists and status === "ready". */
  muxAssetReady: boolean;
  recordingUrl: string | null;
  localFileFound: boolean;
  backupFileFound: boolean;
  /** Recovered file passed container + checksum validation. */
  mediaValid?: boolean;
};

export function classifyPlaybackReference(input: LegacyMediaInput): LegacyPlaybackReference {
  if (!input.muxVodPlaybackId) return "NONE";
  if (!input.muxLookupFound) return "UNRESOLVED";
  if (input.muxObjectType === "live_stream") return "LEGACY_LIVE_STREAM_PLAYBACK_REFERENCE";
  if (input.muxObjectType === "asset") return "VOD_ASSET_PLAYBACK";
  return "UNRESOLVED";
}

export function classifyLegacyMedia(input: LegacyMediaInput): LegacyMediaState {
  const ref = classifyPlaybackReference(input);
  if (ref === "VOD_ASSET_PLAYBACK" && input.muxAssetReady) return "REAL_MUX_VOD";

  const valid = input.mediaValid !== false;
  if (input.localFileFound && valid) return "RECOVERABLE_LOCAL_MEDIA";
  if (input.backupFileFound && valid) return "RECOVERABLE_BACKUP_MEDIA";

  if (input.recordingUrl) return "MISSING_MEDIA";
  if (ref === "UNRESOLVED" || ref === "VOD_ASSET_PLAYBACK") return "INVALID_LEGACY_PLAYBACK_REFERENCE";
  if (ref === "LEGACY_LIVE_STREAM_PLAYBACK_REFERENCE") return "MISSING_MEDIA";
  return "NO_MEDIA";
}

/** Only real, validated media may proceed to storage / Mux ingest. */
export function mayProceedToIngest(state: LegacyMediaState): boolean {
  return state === "RECOVERABLE_LOCAL_MEDIA" || state === "RECOVERABLE_BACKUP_MEDIA";
}
