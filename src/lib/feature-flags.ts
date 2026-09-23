/**
 * Lexify feature / compatibility flags (Phase 1–2).
 *
 * Defaults keep CURRENT behavior.
 * Documented in docs/architecture/PHASE1-FEATURE-FLAGS.md
 */

export type EnrollmentAccessMode = "off" | "shadow" | "dual";

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const v = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return defaultValue;
}

/**
 * Enrollment access mode.
 *
 * Preferred env: FF_ENROLLMENT_ACCESS_MODE=off|shadow|dual (default off)
 *
 * Compatibility with Phase 1 boolean FF_ENROLLMENT_ACCESS:
 * - unset / false / off → off
 * - shadow → shadow
 * - true / dual / on / 1 → dual
 *
 * OFF: legacy Subscription access only (serve OLD).
 * SHADOW: serve OLD; compute NEW; log MATCH/MISMATCH (no UX change).
 * DUAL: prefer NEW when Enrollment seat open; else legacy fallback.
 */
export function getEnrollmentAccessMode(): EnrollmentAccessMode {
  const modeRaw = process.env.FF_ENROLLMENT_ACCESS_MODE?.trim().toLowerCase();
  if (modeRaw === "off" || modeRaw === "shadow" || modeRaw === "dual") {
    return modeRaw;
  }

  const legacy = process.env.FF_ENROLLMENT_ACCESS?.trim().toLowerCase();
  if (!legacy || legacy === "" || ["0", "false", "no", "off"].includes(legacy)) {
    return "off";
  }
  if (legacy === "shadow") return "shadow";
  if (["1", "true", "yes", "on", "dual"].includes(legacy)) return "dual";
  return "off";
}

export const featureFlags = {
  /**
   * @deprecated Prefer getEnrollmentAccessMode(). Kept boolean for docs compatibility:
   * true only when mode === dual.
   */
  get enrollmentAccess(): boolean {
    return getEnrollmentAccessMode() === "dual";
  },

  /**
   * When true: checkout writes Purchase+Enrollment (Phase 3).
   * Default false — legacy demo payment + entitlement path.
   */
  courseCheckoutV2: envFlag("FF_COURSE_CHECKOUT_V2", false),

  /**
   * When true: hide/disable Student Tarif UI entry points.
   * Default false — Phase 1 does not change UI.
   */
  disableTariffUi: envFlag("FF_DISABLE_TARIFF_UI", false),

  /**
   * When true: disable /onboard + POST /api/enroll for students.
   * Default false.
   */
  disableOnboardEnroll: envFlag("FF_DISABLE_ONBOARD_ENROLL", false),

  /**
   * When true: waiting-room signal allowed + target live SM (Phase 7–8).
   * Default false — current lobby/live behavior.
   */
  liveWaitingRoomV2: envFlag("FF_LIVE_WAITING_ROOM_V2", false),

  /**
   * When true: shared live room store (Redis etc.). Default false.
   */
  liveSharedRooms: envFlag("FF_LIVE_SHARED_ROOMS", false),

  /**
   * When true: Recording TEACHER_REVIEW + 24h auto-publish. Default false.
   */
  recordingReview24h: envFlag("FF_RECORDING_REVIEW_24H", false),

  /**
   * When true: refund APIs/policies active. Default false.
   */
  refundsV1: envFlag("FF_REFUNDS_V1", false),
} as const;

export type FeatureFlagName = keyof typeof featureFlags;

export function isFeatureEnabled(name: FeatureFlagName): boolean {
  const v = featureFlags[name];
  return Boolean(v);
}
