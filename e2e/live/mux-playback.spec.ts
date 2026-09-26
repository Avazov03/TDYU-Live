import { expect, type Page } from "@playwright/test";
import { test } from "../fixtures";
import { loginAs } from "../auth/login";
import {
  adminCreds,
  isE2EDbReady,
  skipReasonDbNotReady,
  skipReasonMissingCreds,
  studentCreds,
  teacherCreds,
} from "../helpers/env";
import { STAGING_FIXTURE } from "../helpers/test-data";

/**
 * Phase 8.5 — Mux live playback with Enrollment access (staging only).
 *
 * Requires:
 * - E2E_DB_READY=1, E2E_LIVE_MUX=1
 * - FF_ENROLLMENT_ACCESS_MODE=enrollment, FF_LIVE_MUX_PLAYBACK_V1=true,
 *   FF_LIVE_WAITING_ROOM_V2 + FF_LIVE_ATTENDANCE_V3 on the target
 * - Real MUX_TOKEN_ID / MUX_TOKEN_SECRET on the target (creates ONE test stream; delete it after)
 * - Lesson STAGING_FIXTURE.liveMuxLessonId reset to status=scheduled
 */

function liveMuxEnabled() {
  const v = process.env.E2E_LIVE_MUX?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const LESSON_ID = process.env.E2E_LIVE_MUX_LESSON_ID?.trim() || STAGING_FIXTURE.liveMuxLessonId;
const DENY_LESSON_ID = process.env.E2E_DENY_LESSON_ID?.trim() || STAGING_FIXTURE.denyLessonId;

test.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
  permissions: ["camera", "microphone"],
});

async function api(page: Page, path: string) {
  return page.evaluate(async (p) => {
    const res = await fetch(p, { cache: "no-store" });
    return {
      status: res.status,
      retryAfter: res.headers.get("Retry-After"),
      text: await res.text(),
    };
  }, path);
}

async function openIntervals(page: Page) {
  const r = await api(page, `/api/live/attendance?lessonId=${encodeURIComponent(LESSON_ID)}`);
  expect(r.status).toBe(200);
  const body = JSON.parse(r.text) as { intervals?: { id: string; open?: boolean }[] };
  return (body.intervals ?? []).filter((i) => i.open);
}

const playbackPath = (lessonId: string) =>
  `/api/live/mux-playback?lessonId=${encodeURIComponent(lessonId)}`;

test.describe("Phase 8.5 live Mux playback", () => {
  test.beforeEach(() => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    test.skip(!liveMuxEnabled(), "Skipped: set E2E_LIVE_MUX=1 against a staging target with the flag on");
  });

  test("enrollment-gated player, opt-in room, hide keeps connection, end removes live source", async ({
    browser,
    monitor,
  }) => {
    test.setTimeout(180_000);
    const teacher = teacherCreds();
    const student = studentCreds();
    const admin = adminCreds();
    test.skip(!teacher, skipReasonMissingCreds("teacher"));
    test.skip(!student, skipReasonMissingCreds("student"));
    test.skip(!admin, skipReasonMissingCreds("admin"));

    const anonCtx = await browser.newContext();
    const teacherCtx = await browser.newContext();
    const studentCtx = await browser.newContext();
    const adminCtx = await browser.newContext();
    const anonPage = await anonCtx.newPage();
    const teacherPage = await teacherCtx.newPage();
    const studentPage = await studentCtx.newPage();
    const adminPage = await adminCtx.newPage();

    monitor.noteAction("Anonymous is denied");
    await anonPage.goto("/");
    expect((await api(anonPage, playbackPath(LESSON_ID))).status).toBe(401);

    monitor.noteAction("Teacher opens waiting room and starts live (creates one Mux test stream)");
    await loginAs(teacherPage, teacher!, { monitor });
    await teacherPage.goto(`/teacher/live/${LESSON_ID}`);
    await expect(teacherPage.locator(".live-studio")).toBeVisible({ timeout: 15_000 });
    const openBtn = teacherPage.getByTestId("live-open-waiting");
    const startBtn = teacherPage.getByTestId("live-start");
    if ((await openBtn.count()) === 0 && (await startBtn.count()) === 0) {
      throw new Error(`Fixture lesson ${LESSON_ID} is not reopenable — reset status to scheduled.`);
    }
    if (await openBtn.count()) {
      await openBtn.click();
      await teacherPage.waitForTimeout(800);
      await teacherPage.goto(`/teacher/live/${LESSON_ID}`);
    }
    await teacherPage.getByTestId("live-start").click();
    await expect(teacherPage.getByTestId("live-end")).toBeVisible({ timeout: 30_000 });
    await teacherPage.goto(`/teacher/live/${LESSON_ID}`);
    // Stream key lives in the collapsed OBS <details>; textContent reads it without opening.
    const codes = await teacherPage.locator(".live-obs-extra code").allTextContents();
    const streamKey = codes.map((c) => c.trim()).find((c) => c && !c.startsWith("rtmp")) ?? "";
    expect(streamKey.length, "teacher studio shows the real stream key").toBeGreaterThan(8);

    monitor.noteAction("Student: waiting-for-encoder state, no player, no secrets");
    await loginAs(studentPage, student!, { monitor });
    await studentPage.goto(`/learn/${LESSON_ID}`);
    await expect(studentPage.getByTestId("live-mux-stage")).toBeVisible({ timeout: 20_000 });
    await expect(studentPage.getByTestId("live-mux-player")).toHaveCount(0);
    await expect(studentPage.getByTestId("live-mux-idle")).toBeVisible();
    const html = await studentPage.content();
    expect(html).not.toContain(streamKey);
    expect(html).not.toContain("player.mux.com");
    const idle = await api(studentPage, playbackPath(LESSON_ID));
    expect(idle.status).toBe(200);
    expect(JSON.parse(idle.text)).toMatchObject({ status: "idle", playback: null });
    expect(idle.text).not.toContain(streamKey);
    expect(idle.text.toLowerCase()).not.toContain("stream_key");

    monitor.noteAction("Wrong course is denied");
    expect((await api(studentPage, playbackPath(DENY_LESSON_ID))).status).toBe(403);

    monitor.noteAction("Watching is not attendance");
    await expect(studentPage.getByTestId("live-room-note")).toContainText(
      "Davomat jonli xonaga qo‘shilganda hisoblanadi",
    );
    expect(await openIntervals(studentPage)).toHaveLength(0);

    monitor.noteAction("Join room opens exactly one interval");
    await studentPage.getByTestId("live-room-join").click();
    await expect(studentPage.locator(".meet-frame")).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await openIntervals(studentPage)).length, { timeout: 20_000 }).toBe(1);
    const [joined] = await openIntervals(studentPage);

    monitor.noteAction("Hide keeps the connection");
    await studentPage.getByTestId("live-room-toggle").click();
    await expect(studentPage.getByTestId("live-room-body")).toBeHidden();
    await expect(studentPage.getByTestId("live-room-toggle")).toHaveText("Ko‘rsatish");
    await studentPage.waitForTimeout(4_000);
    const stillOpen = await openIntervals(studentPage);
    expect(stillOpen).toHaveLength(1);
    expect(stillOpen[0]!.id).toBe(joined!.id);

    monitor.noteAction("Show again — same connection, no duplicate");
    await studentPage.getByTestId("live-room-toggle").click();
    await expect(studentPage.locator(".meet-frame")).toBeVisible();
    const afterShow = await openIntervals(studentPage);
    expect(afterShow).toHaveLength(1);
    expect(afterShow[0]!.id).toBe(joined!.id);

    monitor.noteAction("Leave closes the interval");
    await studentPage.getByTestId("live-room-leave").click();
    await expect(studentPage.getByTestId("live-room-join")).toBeVisible();
    await expect.poll(async () => (await openIntervals(studentPage)).length, { timeout: 15_000 }).toBe(0);

    monitor.noteAction("Admin may view");
    await loginAs(adminPage, admin!, { monitor });
    await adminPage.goto("/");
    expect((await api(adminPage, playbackPath(LESSON_ID))).status).toBe(200);

    monitor.noteAction("Teacher ends — live source disappears for the student");
    await teacherPage.getByTestId("live-end").click();
    // End saves the browser recording first, then closes the stream.
    await expect
      .poll(async () => (await api(studentPage, playbackPath(LESSON_ID))).status, { timeout: 45_000 })
      .toBe(409);
    await studentPage.goto(`/learn/${LESSON_ID}`);
    await expect(studentPage.getByTestId("live-mux-stage")).toHaveCount(0);
    const endedHtml = await studentPage.content();
    expect(endedHtml).not.toContain("player.mux.com");
    expect(endedHtml).not.toContain("image.mux.com");

    monitor.noteAction("Server rate limit answers 429 with Retry-After");
    const burst = await studentPage.evaluate(async (p) => {
      const out: { status: number; retryAfter: string | null }[] = [];
      for (let i = 0; i < 14; i++) {
        const res = await fetch(p, { cache: "no-store" });
        out.push({ status: res.status, retryAfter: res.headers.get("Retry-After") });
      }
      return out;
    }, playbackPath(LESSON_ID));
    const limited = burst.find((r) => r.status === 429);
    expect(limited, "burst hits the limiter").toBeTruthy();
    expect(limited!.retryAfter).toBe("30");

    await Promise.all([anonCtx.close(), teacherCtx.close(), studentCtx.close(), adminCtx.close()]);
  });
});
