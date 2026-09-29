import { test } from "node:test";
import assert from "node:assert/strict";
import { isCourseStartReminderDue, notificationHref, tashkentDayKey } from "./notify-policy";
import { legacyTariffAdminWritesAllowed } from "./feature-flags";

const at = (iso: string) => new Date(iso);

test("course start reminder: first lesson tomorrow (Tashkent) during daytime", () => {
  assert.equal(isCourseStartReminderDue({ now: at("2026-10-01T05:00:00Z"), firstLessonAt: at("2026-10-02T09:00:00Z") }), true);
});

test("course start reminder: not at night, not today, not in two days", () => {
  assert.equal(isCourseStartReminderDue({ now: at("2026-10-01T02:00:00Z"), firstLessonAt: at("2026-10-02T09:00:00Z") }), false, "07:00 Tashkent");
  assert.equal(isCourseStartReminderDue({ now: at("2026-10-01T17:30:00Z"), firstLessonAt: at("2026-10-02T09:00:00Z") }), false, "22:30 Tashkent");
  assert.equal(isCourseStartReminderDue({ now: at("2026-10-01T05:00:00Z"), firstLessonAt: at("2026-10-01T14:00:00Z") }), false, "today");
  assert.equal(isCourseStartReminderDue({ now: at("2026-10-01T05:00:00Z"), firstLessonAt: at("2026-10-03T09:00:00Z") }), false, "day after tomorrow");
});

test("course start reminder: uses Tashkent calendar day, not UTC", () => {
  assert.equal(tashkentDayKey(at("2026-10-01T20:00:00Z")), "2026-10-02");
  // 16:00 Tashkent on Oct 1; lesson 20:30 UTC Oct 1 = 01:30 Tashkent Oct 2 → tomorrow.
  assert.equal(isCourseStartReminderDue({ now: at("2026-10-01T11:00:00Z"), firstLessonAt: at("2026-10-01T20:30:00Z") }), true);
});

test("notification href: typed events", () => {
  assert.equal(notificationHref("lesson_live", "L1", null), "/learn/L1");
  assert.equal(notificationHref("certificate", "C1", null), "/certificates/C1");
  assert.equal(notificationHref("purchase_success", "K1", null), "/courses/K1");
  assert.equal(notificationHref("course_starts_tomorrow", "K1", null), "/courses/K1");
  assert.equal(notificationHref("lesson_live", null, null), null);
});

test("notification href: system rows follow the resolved id kind (no /learn/<courseId>)", () => {
  assert.equal(notificationHref("system", "L1", "lesson"), "/learn/L1");
  assert.equal(notificationHref("system", "K1", "course"), "/courses/K1");
  assert.equal(notificationHref("system", "T1", null), null);
});

test("legacy tariff admin writes: closed in enrollment mode only", () => {
  assert.equal(legacyTariffAdminWritesAllowed("enrollment"), false);
  assert.equal(legacyTariffAdminWritesAllowed("dual"), true);
  assert.equal(legacyTariffAdminWritesAllowed("off"), true);
});
