/**
 * Schedule time parsing — datetime-local values are Asia/Tashkent wall-clock.
 *   npx tsx --test src/lib/schedule-time.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseClientDateTime } from "./utils";

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
