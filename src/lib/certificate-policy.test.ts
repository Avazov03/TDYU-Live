import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CERTIFICATE_MAX_BYTES,
  buildCertificateFileKey,
  canViewCertificate,
  checkCertificateFile,
  checkRevokeReason,
  isCourseFinishedForCertificate,
  isLowAttendance,
  isValidCertificateFileKey,
} from "./certificate-policy";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

describe("certificate: course must be finished", () => {
  it("review-flow course only when completed", () => {
    assert.equal(isCourseFinishedForCertificate({ lifecycleStatus: "completed", lessonStatuses: [] }), true);
    for (const s of ["active", "upcoming", "published", "approved", "cancelled"] as const) {
      assert.equal(
        isCourseFinishedForCertificate({ lifecycleStatus: s, lessonStatuses: ["published", "ended"] }),
        false,
        s,
      );
    }
  });

  it("legacy course when every planned lesson is over", () => {
    assert.equal(
      isCourseFinishedForCertificate({ lifecycleStatus: null, lessonStatuses: ["ended", "published", "cancelled"] }),
      true,
    );
    assert.equal(
      isCourseFinishedForCertificate({ lifecycleStatus: null, lessonStatuses: ["ended", "scheduled"] }),
      false,
    );
    assert.equal(isCourseFinishedForCertificate({ lifecycleStatus: null, lessonStatuses: ["live"] }), false);
  });

  it("legacy course with no held lessons is not finished", () => {
    assert.equal(isCourseFinishedForCertificate({ lifecycleStatus: null, lessonStatuses: [] }), false);
    assert.equal(isCourseFinishedForCertificate({ lifecycleStatus: null, lessonStatuses: ["cancelled"] }), false);
  });
});

describe("certificate: uploaded file", () => {
  it("accepts PDF / PNG / JPG by content", () => {
    for (const [head, ext] of [[PDF, "pdf"], [PNG, "png"], [JPG, "jpg"]] as const) {
      const r = checkCertificateFile({ size: 1000, head });
      assert.equal(r.ok, true, ext);
      if (r.ok) assert.equal(r.kind.ext, ext);
    }
  });

  it("rejects empty, oversized and other content", () => {
    const empty = checkCertificateFile({ size: 0, head: new Uint8Array() });
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.code, "FILE_REQUIRED");
    const big = checkCertificateFile({ size: CERTIFICATE_MAX_BYTES + 1, head: PDF });
    assert.equal(big.ok, false);
    if (!big.ok) assert.equal(big.code, "FILE_TOO_LARGE");
    const html = checkCertificateFile({ size: 100, head: new TextEncoder().encode("<html><script>") });
    assert.equal(html.ok, false);
    if (!html.ok) assert.equal(html.code, "FILE_TYPE");
  });

  it("storage key is scoped and validated", () => {
    const courseId = "a4444444-4444-4444-4444-444444444401";
    const certificateId = "c1111111-1111-4111-8111-111111111111";
    const key = buildCertificateFileKey({ courseId, certificateId, ext: "pdf", now: 1759140000000 });
    assert.equal(key, `certificates/${courseId}/${certificateId}-1759140000000.pdf`);
    assert.equal(isValidCertificateFileKey(key), true);
    assert.equal(isValidCertificateFileKey(`certificates/${courseId}/../../etc/passwd`), false);
    assert.equal(isValidCertificateFileKey(null), false);
  });
});

describe("certificate: attendance warning, revoke reason, visibility", () => {
  it("warns below 50% attendance only", () => {
    assert.equal(isLowAttendance(0, 9), true);
    assert.equal(isLowAttendance(4, 9), true);
    assert.equal(isLowAttendance(5, 9), false);
    assert.equal(isLowAttendance(0, 0), false);
  });

  it("revocation needs a reason", () => {
    assert.equal(checkRevokeReason("xato").ok, false);
    assert.equal(checkRevokeReason("   ").ok, false);
    const ok = checkRevokeReason("  noto‘g‘ri o‘quvchi  ");
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.reason, "noto‘g‘ri o‘quvchi");
  });

  it("student sees only own active certificate; teacher/admin also revoked", () => {
    const base = { viewerId: "u1", ownerId: "u1", isAdmin: false, isCourseTeacher: false, revoked: false };
    assert.equal(canViewCertificate(base), true);
    assert.equal(canViewCertificate({ ...base, revoked: true }), false);
    assert.equal(canViewCertificate({ ...base, viewerId: "u2" }), false);
    assert.equal(canViewCertificate({ ...base, viewerId: "t", isCourseTeacher: true, revoked: true }), true);
    assert.equal(canViewCertificate({ ...base, viewerId: "a", isAdmin: true, revoked: true }), true);
  });
});
