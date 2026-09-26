/**
 * Schedule time parsing — datetime-local values are Asia/Tashkent wall-clock.
 *   npx tsx --test src/lib/schedule-time.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDateTime, parseClientDateTime } from "./utils";
import { clockLabel, dayTitle } from "./plan";

describe("Uzbek date labels (ICU-independent)", () => {
  const d = new Date("2026-10-05T13:00:00Z");
  it("formatDateTime uses Tashkent time and spelled-out month", () => {
    assert.equal(formatDateTime(d), "05-okt, 2026, 18:00");
    assert.equal(formatDateTime(new Date("2026-12-31T19:30:00Z")), "01-yan, 2027, 00:30");
  });
  it("dayTitle / clockLabel", () => {
    assert.equal(dayTitle(d), "5-oktabr");
    assert.equal(clockLabel(d), "18:00");
  });
});

describe("parseClientDateTime", () => {
  it("treats naive datetime-local as Tashkent (UTC+5)", () => {
    assert.equal(parseClientDateTime("2026-10-03T18:00").toISOString(), "2026-10-03T13:00:00.000Z");
    assert.equal(parseClientDateTime("2026-10-03T18:00:30").toISOString(), "2026-10-03T13:00:30.000Z");
  });
  it("keeps explicit zones untouched", () => {
    assert.equal(parseClientDateTime("2026-10-03T13:00:00.000Z").toISOString(), "2026-10-03T13:00:00.000Z");
    assert.equal(parseClientDateTime("2026-10-03T18:00+05:00").toISOString(), "2026-10-03T13:00:00.000Z");
  });
  it("invalid input stays invalid", () => {
    assert.ok(Number.isNaN(parseClientDateTime("ertaga").getTime()));
    assert.ok(Number.isNaN(parseClientDateTime("").getTime()));
  });
});
