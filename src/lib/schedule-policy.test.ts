import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkEarlyStart,
  checkLessonRemoval,
  checkNewLessonTime,
  checkReschedule,
  lessonEnd,
  type LessonWindow,
} from "./schedule-policy";

const H = 3_600_000;
const now = new Date("2026-10-01T10:00:00Z");
const at = (hoursFromNow: number) => new Date(now.getTime() + hoursFromNow * H);
const fmt = (d: Date) => d.toISOString();
const win = (id: string, startH: number, status = "scheduled", minutes = 90): LessonWindow => ({
  id,
  titleUz: `Dars ${id}`,
  courseTitleUz: "Boshqa kurs",
  start: at(startH),
  end: new Date(at(startH).getTime() + minutes * 60_000),
  status,
});

describe("lessonEnd", () => {
  it("defaults to 90 minutes, honours duration and explicit end", () => {
    const s = at(0);
    assert.equal(lessonEnd({ scheduledAt: s }).getTime() - s.getTime(), 90 * 60_000);
    assert.equal(lessonEnd({ scheduledAt: s, durationMinutes: 45 }).getTime() - s.getTime(), 45 * 60_000);
    assert.equal(lessonEnd({ scheduledAt: s, scheduledEndAt: at(2) }).getTime(), at(2).getTime());
  });
});

describe("checkNewLessonTime", () => {
  const base = { now, formatWhen: fmt };
  it("rejects past or now", () => {
    for (const h of [-1, 0]) {
      const r = checkNewLessonTime({ ...base, start: at(h), end: at(h + 1.5), others: [] });
      assert.equal(!r.ok && r.code, "INVALID_TIME", `h=${h}`);
    }
  });
  it("rejects overlap with another Teacher lesson, names it", () => {
    const r = checkNewLessonTime({ ...base, start: at(49), end: at(50.5), others: [win("x", 48)] });
    assert.equal(!r.ok && r.code, "CONFLICT");
    assert.ok(!r.ok && r.message.includes("Dars x"));
  });
  it("back-to-back is fine; cancelled/ended lessons never block", () => {
    assert.deepEqual(
      checkNewLessonTime({ ...base, start: at(49.5), end: at(51), others: [win("x", 48)] }),
      { ok: true },
    );
    for (const status of ["cancelled", "ended"]) {
      assert.deepEqual(
        checkNewLessonTime({ ...base, start: at(48), end: at(49.5), others: [win("x", 48, status)] }),
        { ok: true },
      );
    }
  });
});

describe("checkReschedule (24h rule)", () => {
  const base = { lessonId: "me", now, formatWhen: fmt, others: [] as LessonWindow[] };
  it("blocked when current start is < 24h away", () => {
    const r = checkReschedule({ ...base, currentStart: at(23.9), nextStart: at(72), nextEnd: at(73.5) });
    assert.equal(!r.ok && r.code, "TOO_LATE");
  });
  it("blocked when the new time is < 24h away", () => {
    const r = checkReschedule({ ...base, currentStart: at(72), nextStart: at(5), nextEnd: at(6.5) });
    assert.equal(!r.ok && r.code, "TOO_LATE");
  });
  it("allowed at ≥24h both sides, own slot ignored", () => {
    assert.deepEqual(
      checkReschedule({
        ...base,
        currentStart: at(24),
        nextStart: at(48.5),
        nextEnd: at(50),
        others: [win("me", 48)],
      }),
      { ok: true },
    );
  });
  it("blocked on conflict with another course", () => {
    const r = checkReschedule({
      ...base,
      currentStart: at(72),
      nextStart: at(96.5),
      nextEnd: at(98),
      others: [win("other", 96)],
    });
    assert.equal(!r.ok && r.code, "CONFLICT");
  });
});

describe("checkLessonRemoval", () => {
  it("only ≥24h ahead", () => {
    assert.equal(checkLessonRemoval({ currentStart: at(2), now }).ok, false);
    assert.equal(checkLessonRemoval({ currentStart: at(25), now }).ok, true);
  });
});

describe("checkEarlyStart", () => {
  const base = { lessonId: "me", now, durationEnd: at(1.5), formatWhen: fmt };
  it("allowed early when nothing overlaps", () => {
    assert.deepEqual(checkEarlyStart({ ...base, others: [win("me", 3), win("later", 5)] }), { ok: true });
  });
  it("blocked while another lesson is live or in lobby", () => {
    for (const status of ["live", "lobby"]) {
      const r = checkEarlyStart({ ...base, others: [win("x", -0.5, status)] });
      assert.equal(!r.ok && r.code, "CONFLICT", status);
    }
  });
  it("blocked when starting now would run into another scheduled lesson", () => {
    const r = checkEarlyStart({ ...base, others: [win("next", 1)] });
    assert.equal(!r.ok && r.code, "CONFLICT");
  });
  it("a missed (never started) earlier lesson does not block", () => {
    assert.deepEqual(checkEarlyStart({ ...base, others: [win("missed", -0.5)] }), { ok: true });
  });
});
