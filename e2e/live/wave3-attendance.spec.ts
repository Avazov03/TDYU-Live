import { expect } from "@playwright/test";
import { test } from "../fixtures";
import { loginAs } from "../auth/login";
import {
  isE2EDbReady,
  skipReasonDbNotReady,
  studentCreds,
  teacherCreds,
  skipReasonMissingCreds,
} from "../helpers/env";
import { STAGING_FIXTURE } from "../helpers/test-data";
import { resetE2EFixtures, teardownE2EFixtures } from "../helpers/fixture-reset";
import { studioAction } from "../helpers/live-studio";

/**
 * Phase 7 Live Wave 3 — AttendanceInterval against staging.
 *
 * Requires:
 * - E2E_DB_READY=1
 * - E2E_LIVE_WAVE3=1
 * - FF_LIVE_WAITING_ROOM_V2 + FF_LIVE_ATTENDANCE_V3 on staging
 * - Dedicated lesson E2E_LIVE_LESSON_ID_WAVE3 / STAGING_FIXTURE.liveLessonIdWave3
 */

function liveWave3Enabled() {
  const v = process.env.E2E_LIVE_WAVE3?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const LIVE_LESSON_ID =
  process.env.E2E_LIVE_LESSON_ID_WAVE3?.trim() ||
  STAGING_FIXTURE.liveLessonIdWave3 ||
  "";

test.describe("Live Wave 3 attendance", () => {
  test.beforeEach(async () => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    test.skip(
      !liveWave3Enabled(),
      "Skipped: set E2E_LIVE_WAVE3=1 and FF_LIVE_ATTENDANCE_V3=true on staging",
    );
    test.skip(!LIVE_LESSON_ID, "Missing E2E_LIVE_LESSON_ID_WAVE3");
    await resetE2EFixtures([LIVE_LESSON_ID]);
  });

  test.afterAll(async () => {
    if (isE2EDbReady() && liveWave3Enabled() && LIVE_LESSON_ID) {
      await teardownE2EFixtures([LIVE_LESSON_ID]);
    }
  });

  test("Waiting ≠ attendance; LIVE join/leave/rejoin; end closes opens", async ({
    browser,
    monitor,
  }) => {
    const teacher = teacherCreds();
    const student = studentCreds();
    test.skip(!teacher, skipReasonMissingCreds("teacher"));
    test.skip(!student, skipReasonMissingCreds("student"));

    const teacherCtx = await browser.newContext();
    const studentCtx = await browser.newContext();
    const teacherPage = await teacherCtx.newPage();
    const studentPage = await studentCtx.newPage();

    monitor.noteAction("Teacher opens waiting room");
    await loginAs(teacherPage, teacher!, { monitor });
    await teacherPage.goto(`/teacher/live/${LIVE_LESSON_ID}`);
    await expect(teacherPage.locator(".live-studio")).toBeVisible({ timeout: 15_000 });

    await studioAction(teacherPage, LIVE_LESSON_ID, "lobby");
    await teacherPage.goto(`/teacher/live/${LIVE_LESSON_ID}`);
    await expect(teacherPage.getByTestId("live-start")).toBeVisible({ timeout: 15_000 });

    monitor.noteAction("Student joins waiting — no attendance interval");
    await loginAs(studentPage, student!, { monitor });
    await studentPage.goto(`/learn/${LIVE_LESSON_ID}`);
    await expect(studentPage.getByTestId("live-waiting-message")).toBeVisible({
      timeout: 20_000,
    });

    const waitingAtt = await studentPage.evaluate(async (lessonId) => {
      const res = await fetch(`/api/live/attendance?lessonId=${encodeURIComponent(lessonId)}`);
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, LIVE_LESSON_ID);
    // Flag on → 200 with empty intervals for this session (waiting join must not create rows)
    if (waitingAtt.status === 200) {
      const intervals = waitingAtt.body?.intervals ?? [];
      expect(intervals.filter((i: { open?: boolean }) => i.open)).toHaveLength(0);
    }

    monitor.noteAction("Teacher starts LIVE");
    await studioAction(teacherPage, LIVE_LESSON_ID, "start");
    await teacherPage.goto(`/teacher/live/${LIVE_LESSON_ID}`);
    await expect(teacherPage.getByTestId("live-end")).toBeVisible({ timeout: 20_000 });

    const readAttendance = () =>
      studentPage.evaluate(async (lessonId) => {
        const res = await fetch(`/api/live/attendance?lessonId=${encodeURIComponent(lessonId)}`);
        return { status: res.status, body: await res.json().catch(() => ({})) };
      }, LIVE_LESSON_ID);
    // The banner renders before MeetRoom's async POST /api/live/join (after media negotiation) lands.
    const waitForOpenInterval = () =>
      expect
        .poll(
          async () =>
            ((await readAttendance()).body.intervals ?? []).filter((i: { open?: boolean }) => i.open)
              .length,
          { timeout: 15_000 },
        )
        .toBeGreaterThan(0);

    monitor.noteAction("Student joins LIVE — open interval");
    await studentPage.reload();
    await expect(studentPage.getByTestId("live-live-banner")).toBeVisible({ timeout: 25_000 });
    await waitForOpenInterval();

    const liveAtt = await readAttendance();
    expect(liveAtt.status).toBe(200);
    const open1 = (liveAtt.body.intervals ?? []).filter((i: { open?: boolean }) => i.open);
    expect(open1.length).toBe(1);
    expect(open1[0].joinedAt).toBeTruthy();
    expect(open1[0].leftAt).toBeNull();
    const firstId = open1[0].id as string;

    monitor.noteAction("Student leave closes interval");
    const leaveStatus = await studentPage.evaluate(async (lessonId) => {
      const res = await fetch("/api/live/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, action: "leave" }),
      });
      return res.status;
    }, LIVE_LESSON_ID);
    expect(leaveStatus).toBe(200);

    const afterLeave = (await readAttendance()).body;
    const closed = (afterLeave.intervals ?? []).find((i: { id: string }) => i.id === firstId);
    expect(closed?.leftAt).toBeTruthy();
    expect((afterLeave.intervals ?? []).filter((i: { open?: boolean }) => i.open)).toHaveLength(0);

    monitor.noteAction("Student rejoin creates NEW interval");
    await studentPage.reload();
    await expect(studentPage.getByTestId("live-live-banner")).toBeVisible({ timeout: 25_000 });
    await waitForOpenInterval();
    const afterRejoin = (await readAttendance()).body;
    const open2 = (afterRejoin.intervals ?? []).filter((i: { open?: boolean }) => i.open);
    expect(open2.length).toBe(1);
    expect(open2[0].id).not.toBe(firstId);

    monitor.noteAction("Teacher ends live — no open intervals");
    await teacherPage.getByTestId("live-end").click();
    // /end finishes the final recording upload and Mux completion before closing intervals.
    await expect
      .poll(
        async () => {
          const r = await readAttendance();
          if (r.status !== 200) return `HTTP ${r.status}`;
          return (r.body.intervals ?? []).filter((i: { open?: boolean }) => i.open).length;
        },
        { timeout: 30_000 },
      )
      .toBe(0);

    monitor.noteAction("Unauthorized deny lesson cannot open attendance via join");
    const denyLesson =
      process.env.E2E_DENY_LESSON_ID?.trim() || STAGING_FIXTURE.denyLessonId;
    const denyJoin = await studentPage.evaluate(async (lessonId) => {
      const res = await fetch("/api/live/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, denyLesson);
    expect(denyJoin.status).toBeGreaterThanOrEqual(400);

    await teacherCtx.close();
    await studentCtx.close();
  });
});
