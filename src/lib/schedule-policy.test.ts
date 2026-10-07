import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkEarlyStart,
  checkLessonRemoval,
  checkNewLessonTime,
  checkReschedule,
  lessonEnd,
  overlappingLessons,
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
  it("draft course (noticeRequired=false): no 24h rule, still no past time or conflict", () => {
    const draft = { ...base, noticeRequired: false };
    assert.deepEqual(checkReschedule({ ...draft, currentStart: at(2), nextStart: at(3), nextEnd: at(4.5) }), {
      ok: true,
    });
    const past = checkReschedule({ ...draft, currentStart: at(2), nextStart: at(-1), nextEnd: at(0.5) });
    assert.equal(!past.ok && past.code, "INVALID_TIME");
    const clash = checkReschedule({
      ...draft,
      currentStart: at(2),
      nextStart: at(5.5),
      nextEnd: at(7),
      others: [win("other", 5)],
    });
    assert.equal(!clash.ok && clash.code, "CONFLICT");
  });
});

describe("overlappingLessons", () => {
  const item = (id: string, startH: number, minutes = 90) => ({
    id,
    title: `Dars ${id}`,
    start: at(startH),
    end: new Date(at(startH).getTime() + minutes * 60_000),
  });
  it("marks both sides of an overlap, ignores back-to-back", () => {
    const hits = overlappingLessons([item("a", 10), item("b", 11), item("c", 12.5), item("d", 20)]);
    assert.deepEqual(hits.get("a"), ["Dars b"]);
    assert.deepEqual(hits.get("b"), ["Dars a"]);
    assert.equal(hits.has("c"), false);
    assert.equal(hits.has("d"), false);
  });
});

describe("checkLessonRemoval", () => {
  it("only ≥24h ahead", () => {
    assert.equal(checkLessonRemoval({ currentStart: at(2), now }).ok, false);
    assert.equal(checkLessonRemoval({ currentStart: at(25), now }).ok, true);
  });
  it("a missed lesson (slot over) can be removed; one in progress cannot", () => {
    assert.equal(checkLessonRemoval({ currentStart: at(-48), currentEnd: at(-46.5), now }).ok, true);
    assert.equal(checkLessonRemoval({ currentStart: at(-1), currentEnd: at(0.5), now }).ok, false);
  });
});

describe("checkReschedule — missed lesson", () => {
  const base = { lessonId: "x", currentStart: at(-48), currentEnd: at(-46.5), now, others: [], formatWhen: fmt };
  it("old time no longer blocks, new time still needs 24h notice", () => {
    assert.equal(checkReschedule({ ...base, nextStart: at(30), nextEnd: at(31.5) }).ok, true);
    const soon = checkReschedule({ ...base, nextStart: at(3), nextEnd: at(4.5) });
    assert.equal(soon.ok, false);
    if (!soon.ok) assert.equal(soon.code, "TOO_LATE");
  });
});

describe("checkEarlyStart", () => {
  const base = { lessonId: "me", now, durationEnd: at(1.5), formatWhen: fmt };
  it("allowed early when nothing overlaps", () => {
    assert.deepEqual(checkEarlyStart({ ...base, others: [win("me", 3), win("later", 5)] }), { ok: true });
  });
  it("blocked while another lesson is waiting, live or paused", () => {
    for (const status of ["live", "lobby", "waiting_room", "paused"]) {
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
